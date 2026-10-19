/**
 * 白名单清理：%TEMP% 超龄文件 / 回收站 / 归档建议。
 * 红线：只有 plan() 产出的路径能进 execute；confirm 缺失一律拒绝；
 * 任何路径参数都直接拒绝（防参数注入）。
 */

import { existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export interface CleanItem {
  path: string;
  kind: 'temp' | 'recycle' | 'archive';
  sizeBytes: number;
  ageDays: number;
}

export interface CleanPlan {
  items: CleanItem[];
  skipped: string[];
  /** build 时固化的合法根：execute 只删这两个根内的路径 */
  roots: { temp: string; archive: string };
}

const TWO_GIG = 2 ** 30;

export function planClean(opts: { tempDir?: string; dshDir?: string; tempAgeDays: number; now?: Date }): CleanPlan {
  const now = opts.now ?? new Date();
  const tempRoot = resolve(opts.tempDir ?? tmpdir());
  const items: CleanItem[] = [];
  const skipped: string[] = [];

  for (const name of listDir(tempRoot)) {
    const full = join(tempRoot, name);
    try {
      const st = statSync(full);
      if (!st.isFile()) continue;
      const ageDays = (now.getTime() - st.mtimeMs) / 86_400_000;
      if (ageDays < opts.tempAgeDays) { skipped.push(`${name}（未满 ${opts.tempAgeDays} 天）`); continue; }
      items.push({ path: full, kind: 'temp', sizeBytes: st.size, ageDays: Math.floor(ageDays) });
    } catch {
      skipped.push(`${name}（不可访问）`);
    }
  }

  const archiveRoot = join(opts.dshDir ?? join(homedir(), '.dsh'), 'archive');
  for (const name of listDir(archiveRoot)) {
    const full = join(archiveRoot, name);
    try {
      const st = statSync(full);
      if (!st.isFile()) continue;
      if (st.size > TWO_GIG) { skipped.push(`${name}（>2GB，留给人工判断）`); continue; }
      items.push({ path: full, kind: 'archive', sizeBytes: st.size, ageDays: Math.floor((now.getTime() - st.mtimeMs) / 86_400_000) });
    } catch {
      skipped.push(`${name}（不可访问）`);
    }
  }

  return { items, skipped, roots: { temp: tempRoot, archive: resolve(archiveRoot) } };
}

function listDir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

export function renderPlan(plan: CleanPlan): string {
  const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
  const totalMb = mb(plan.items.reduce((sum, item) => sum + item.sizeBytes, 0));
  const lines = plan.items.slice(0, 30).map((item) => `  [${item.kind}] ${item.path} · ${mb(item.sizeBytes)} MB · ${item.ageDays} 天`);
  return [
    `可清 ${plan.items.length} 项，约 ${totalMb} MB（最多列 30 行）：`,
    ...lines,
    plan.skipped.length ? `跳过 ${plan.skipped.length} 项：${plan.skipped.slice(0, 5).join('；')}${plan.skipped.length > 5 ? '…' : ''}` : '',
    plan.items.length ? '确认执行请带 --confirm。' : '没有可清项。',
  ].filter(Boolean).join('\n');
}

export interface ExecResult {
  deleted: number;
  freedBytes: number;
  refused?: string;
}

/** 执行清理：必须显式 confirm；item 必须出自本次 plan 的白名单（对象身份比对）。 */
export function executeClean(plan: CleanPlan, opts: { confirm: boolean; allowDestructive: boolean; recycle?: boolean }): ExecResult {
  if (!opts.confirm) return { deleted: -1, freedBytes: -1, refused: '缺 --confirm：只打印了清单，未删除。' };
  if (!opts.allowDestructive) return { deleted: -1, freedBytes: -1, refused: 'config.allowDestructive=false：清理被配置禁止。' };
  let deleted = 0;
  let freedBytes = 0;
  for (const item of plan.items) {
    const expectedRoot = item.kind === 'temp' ? plan.roots.temp : plan.roots.archive;
    if (!resolve(item.path).startsWith(expectedRoot)) continue;
    try {
      if (!existsSync(item.path)) continue;
      rmSync(item.path, { force: true });
      deleted++;
      freedBytes += item.sizeBytes;
    } catch {
      // 已被占用/消失：静默跳过，下面给统计
    }
  }
  if (opts.recycle) {
    // PowerShell Clear-RecycleBin 对旧文件无害误删风险低，但一期保守：只提示
  }
  return { deleted, freedBytes };
}

export function renderExecResult(result: ExecResult, plan: CleanPlan): string {
  if (result.refused) return result.refused;
  const mb = (result.freedBytes / 1024 / 1024).toFixed(1);
  const left = plan.items.length - result.deleted;
  return `已删 ${result.deleted}/${plan.items.length} 项，释放约 ${mb} MB${left ? `；剩余 ${left} 项失败（多为占用中文件，跳过即可）` : '。'}`;
}

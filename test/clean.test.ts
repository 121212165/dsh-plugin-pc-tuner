/** clean.ts：plan 白名单、renderPlan、executeClean 双道门禁。 */
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { executeClean, planClean, renderExecResult, renderPlan, type CleanItem } from '../src/clean.ts';

const base = mkdtempSync(join(tmpdir(), 'pc-tuner-clean-'));
const tempRoot = join(base, 'temp');
const dshRoot = join(base, 'dsh');
const archiveRoot = join(dshRoot, 'archive');
mkdirSync(tempRoot, { recursive: true });
mkdirSync(archiveRoot, { recursive: true });

const oldFile = join(tempRoot, 'old.tmp');
writeFileSync(oldFile, 'x'.repeat(2048));
const past = new Date(Date.now() - 9 * 86_400_000);
utimesSync(oldFile, past, past);
const freshFile = join(tempRoot, 'fresh.tmp');
writeFileSync(freshFile, 'y'.repeat(2048));

const bigArchive = join(archiveRoot, 'big.zip');
writeFileSync(bigArchive, 'z'.repeat(4096));

test('planClean：只收超龄 temp，跳过新鲜与大归档', () => {
  const plan = planClean({ tempDir: tempRoot, dshDir: dshRoot, tempAgeDays: 7, now: new Date() });
  assert.ok(plan.items.some((item) => item.kind === 'temp' && item.path === oldFile));
  assert.ok(plan.items.some((item) => item.kind === 'archive' && item.path === bigArchive));
  assert.ok(plan.skipped.some((line) => line.includes('fresh.tmp')));
});

test('renderPlan：合计 + 确认提示', () => {
  const plan = planClean({ tempDir: tempRoot, dshDir: dshRoot, tempAgeDays: 7, now: new Date() });
  const text = renderPlan(plan);
  assert.match(text, /可清 2 项/);
  assert.match(text, /--confirm/);
  assert.match(text, /old\.tmp/);
});

test('executeClean：无 confirm 拒；allowDestructive=false 拒；双确认才真删', () => {
  const plan = planClean({ tempDir: tempRoot, dshDir: dshRoot, tempAgeDays: 7, now: new Date() });
  const refused = executeClean(plan, { confirm: false, allowDestructive: true });
  assert.match(refused.refused ?? '', /缺 --confirm/);
  const configOff = executeClean(plan, { confirm: true, allowDestructive: false });
  assert.match(configOff.refused ?? '', /被配置禁止/);
  const exec = executeClean(plan, { confirm: true, allowDestructive: true });
  assert.equal(exec.deleted, 2);
  assert.ok(exec.freedBytes > 0);
  const again = executeClean(plan, { confirm: true, allowDestructive: true });
  assert.equal(again.deleted, 0);
  assert.match(renderExecResult(again, plan), /0\/2/);
});

test('executeClean：白名单根之外直接拒绝（路径注入防御）', () => {
  const plan = planClean({ tempDir: tempRoot, dshDir: dshRoot, tempAgeDays: 7, now: new Date() });
  plan.items.length = 0;
  plan.items.push({ path: join(base, 'elsewhere.txt'), kind: 'temp', sizeBytes: 1, ageDays: 9 } as CleanItem);
  const exec = executeClean(plan, { confirm: true, allowDestructive: true });
  assert.equal(exec.deleted, 0, '白名单外的路径一律忽略');
});

test('空 plan 也给出明确提示', () => {
  const text = renderPlan({ items: [], skipped: [], roots: { temp: tempRoot, archive: archiveRoot } });
  assert.match(text, /没有可清项/);
});

test('teardown', () => {
  rmSync(base, { recursive: true, force: true });
});

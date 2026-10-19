/**
 * PowerShell 执行封装：单次 spawn `powershell -NoProfile`（M$ 稳定内置，避免
 * pwsh 不在 PATH），JSON -Compress 输出 → parse。超时杀进程返回明确错误。
 */

import { spawn } from 'node:child_process';

export interface PsResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

export const PS_TIMEOUT_MS = 20_000;

export function isWindows(): boolean {
  return process.platform === 'win32';
}

export function runPs(script: string, timeoutMs = PS_TIMEOUT_MS): Promise<PsResult> {
  if (!isWindows()) return Promise.resolve({ ok: false, stdout: '', stderr: '非 Windows 平台：pc-tuner 的快照/清理只在 Windows 上可用。' });
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok, stdout: stdout.trimEnd(), stderr: stderr.trimEnd() });
    };
    child.on('close', (code) => done(code === 0));
    child.on('error', (error) => { stderr = String(error); done(false); });
  });
}

/** 解析 PowerShell JSON 输出；解析失败返回 null（附 stderr） */
export function parseJsonPs<T>(result: PsResult): { value: T | null; error?: string } {
  if (!result.ok) return { value: null, error: result.stderr || 'powershell 非零退出' };
  try {
    return { value: JSON.parse(result.stdout) as T };
  } catch (error) {
    return { value: null, error: `JSON 解析失败: ${String(error)} · stdout 前 200 字符: ${result.stdout.slice(0, 200)}` };
  }
}

/** 把 JS 对象转成内嵌 PS 字面量（受控输入，永不注入用户文本） */
export function psNull(): string {
  return '$null';
}

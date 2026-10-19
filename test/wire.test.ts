/** ps 封装与插件接线：非 Windows 拒绝语义 + /perf 命令分支的 Mount 覆盖。 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseJsonPs, runPs } from '../src/ps.ts';
import { apply } from '../src/plugin.ts';

test('runPs：非 Windows 平台返回明确错误说明', async () => {
  const result = await runPs('Get-Process');
  if (process.platform === 'win32') {
    assert.equal(result.ok, true, 'win 本机应能真跑 powershell');
  } else {
    assert.equal(result.ok, false);
    assert.match(result.stderr, /Windows/);
  }
});

test('parseJsonPs：非 JSON 与非零退出都有可读错误', () => {
  const bad = parseJsonPs<number>({ ok: true, stdout: 'not-json', stderr: '' });
  assert.equal(bad.value, null);
  assert.match(bad.error ?? '', /JSON/);
  const nonzero = parseJsonPs<number>({ ok: false, stdout: '', stderr: 'boom' });
  assert.equal(nonzero.value, null);
  assert.match(nonzero.error ?? '', /boom/);
});

if (process.platform === 'win32') {
  test('apply 接线（win）：/perf clean 无 confirm 只列清单、perf_snapshot 工具真跑', async () => {
    const commands: { name: string; handler: (args: { rawInput?: string }) => { kind: string; text: string } }[] = [];
    const tools: { name: string; execute: (args?: Record<string, unknown>) => Promise<string> }[] = [];
    const ctx = {
      logger: () => ({ info() {}, warn() {} }),
      commands: { register(definition: never) { commands.push(definition as never); } },
      tools: { register(definition: never) { tools.push(definition as never); } },
    } as never;
    apply(ctx, { enabled: true, topN: 3, tempAgeDays: 7, allowDestructive: false, order: 760 });
    const perf = commands.find((entry) => entry.name === 'perf')!;
    const cleanList = await perf.handler({ rawInput: 'clean' });
    assert.equal(cleanList.kind, 'success');
    assert.match(cleanList.text, /--confirm/);
    assert.doesNotMatch(cleanList.text, /被配置禁止/);

    const snapshotTool = tools.find((entry) => entry.name === 'perf_snapshot')!;
    const snapText = await snapshotTool.execute({});
    assert.match(snapText, /性能快照 @/);

    const diffTool = tools.find((entry) => entry.name === 'perf_diff')!;
    const first = await diffTool.execute({});
    assert.match(first, /与 .* 相比/, 'snapshot 已留 baseline：直接出对比');
  });
}

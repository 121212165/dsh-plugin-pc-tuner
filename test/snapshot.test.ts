/** snapshot.ts 纯函数：行解析 / 快照渲染 / diff。 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { diffSnapshots, parseProcessRows, renderDiff, renderSnapshot, type Snapshot } from '../src/snapshot.ts';

const shot = (over: Partial<Snapshot>, at = '2026-10-19T10:00:00.000Z'): Snapshot => ({
  at,
  cpuTop: [],
  memTop: [],
  powerPlan: '平衡',
  loadPercent: 0,
  battery: 'desktop',
  ...over,
});

test('parseProcessRows：对象/非对象/越界值各归其位', () => {
  const rows = parseProcessRows([
    { name: 'chrome', value: '1024.3', unit: 'MB' },
    { name: 'pwsh', value: 12, unit: 'sec' },
    null,
    { name: 'bad', value: 'NaN!', unit: 'MB' },
    { name: 'x'.repeat(200), value: 1, unit: 'MB' },
  ]);
  assert.equal(rows.length, 4, 'null 行丢弃，name 缺失行带 "?" 丢弃，剩 4');
  assert.deepEqual(rows[0], { name: 'chrome', value: 1024.3, unit: 'MB' });
  assert.deepEqual(rows[1], { name: 'pwsh', value: 12, unit: 'sec' });
  assert.equal(rows[2]!.value, 0, 'NaN 值归 0');
  assert.ok((rows as { name: string }[]).every((row) => row.name.length <= 60));
  // 上限 50 行
  const many = parseProcessRows(Array.from({ length: 60 }, (_, index) => ({ name: `p${index}`, value: index, unit: 'MB' })));
  assert.equal(many.length, 50);
});

test('renderSnapshot：标题/分区都是人类可读', () => {
  const text = renderSnapshot(shot({ cpuTop: [{ name: 'chrome', value: 30, unit: 'sec' }], loadPercent: 42 }));
  assert.match(text, /性能快照 @ 2026-10-19 10:00/);
  assert.match(text, /电源计划：平衡/);
  assert.match(text, /chrome/);
  assert.match(text, /42%/);
});

test('diffSnapshots：新增/消失/涨跌 + 阈值内不列', () => {
  const base = shot({
    cpuTop: [{ name: 'a', value: 10, unit: 'sec' }, { name: 'c', value: 60, unit: 'sec' }],
    memTop: [{ name: 'm', value: 500, unit: 'MB' }],
  });
  const next = shot({
    cpuTop: [{ name: 'a', value: 13, unit: 'sec' }, { name: 'new', value: 80, unit: 'sec' }],
    memTop: [{ name: 'm', value: 900, unit: 'MB' }],
  });
  const diff = diffSnapshots(base, next);
  assert.deepEqual(diff.added.map((row) => row.name), ['new']);
  assert.deepEqual(diff.dropped.map((row) => row.name), ['c']);
  // a 涨 3sec(<5 阈值)不列；m 涨 400MB(≥256)列
  assert.deepEqual(diff.moved, [{ name: 'm', from: 500, to: 900 }]);
});

test('diffSnapshots：阈值内全部不列 → "无显著变化"渲染', () => {
  const base = shot({ cpuTop: [{ name: 'a', value: 10, unit: 'sec' }], at: '2026-10-19T09:00:00.000Z' });
  const next = shot({ cpuTop: [{ name: 'a', value: 12, unit: 'sec' }] });
  const text = renderDiff(diffSnapshots(base, next), base.at);
  assert.match(text, /无显著变化/);
  assert.match(text, /09:00/);
});

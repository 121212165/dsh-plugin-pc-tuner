/**
 * 快照与 diff：fixture 解析器是纯函数，PowerShell 端只负责吐 JSON。
 */

export interface MetricRow {
  name: string;
  /** CPU 行是进程累计秒数（CPU 累计时间），内存/磁盘为 MB */
  value: number;
  unit: 'cpu%' | 'sec' | 'MB';
}

export interface Snapshot {
  at: string;
  cpuTop: MetricRow[];
  memTop: MetricRow[];
  powerPlan: string;
  loadPercent: number;
  battery: string;
}

export interface SnapshotDiff {
  added: MetricRow[];
  dropped: MetricRow[];
  moved: { name: string; from: number; to: number }[];
}

export function parseProcessRows(raw: unknown): MetricRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).map((row) => {
    if (typeof row === 'object' && row !== null) {
      const obj = row as Record<string, unknown>;
      const unitRaw = String(obj.unit ?? 'MB');
      return {
        name: String(obj.name ?? '?').slice(0, 60),
        value: Number.isFinite(Number(obj.value)) ? Number(obj.value) : 0,
        unit: (unitRaw === 'cpu%' || unitRaw === 'sec' ? unitRaw : 'MB') as MetricRow['unit'],
      };
    }
    return { name: '?', value: 0, unit: 'MB' as const };
  }).filter((row) => row.name !== '?');
}

const isInterest = (row: MetricRow) => row.unit !== 'MB';

export function renderSnapshot(snapshot: Snapshot): string {
  const render = (rows: MetricRow[]): string =>
    rows.length ? rows.map((row) => `  ${row.name.padEnd(24, ' ')} ${row.value.toFixed(1)} ${row.unit}`).join('\n') : '  （空）';
  return [
`性能快照 @ ${snapshot.at.slice(0, 19).replace('T', ' ')}`,
`电源计划：${snapshot.powerPlan} · 系统负载 ${snapshot.loadPercent.toFixed(0)}% · ${snapshot.battery}`,
    'CPU 累计时间 top（sec）：', render(snapshot.cpuTop),
    '内存占用 top（MB）：', render(snapshot.memTop),
  ].join('\n');
}

/** 与上一份快照对比：新增/消失/挪动。超阈值 5sec 或 256MB 才列。 */
export function diffSnapshots(base: Snapshot, next: Snapshot): SnapshotDiff {
  const index = (rows: MetricRow[]) => new Map(rows.map((row) => [row.name, row] as const));
  const a = index(base.cpuTop.concat(base.memTop));
  const b = index(next.cpuTop.concat(next.memTop));
  const added: MetricRow[] = [];
  const dropped: MetricRow[] = [];
  const moved: { name: string; from: number; to: number }[] = [];
  for (const [name, row] of b) {
    const before = a.get(name);
    if (!before) added.push(row);
    else if (Math.abs(row.value - before.value) >= (isInterest(row) ? 5 : 256)) {
      moved.push({ name, from: before.value, to: row.value });
    }
  }
  for (const [name, row] of a) if (!b.has(name)) dropped.push(row);
  return { added, dropped, moved };
}

export function renderDiff(diff: SnapshotDiff, baselineAt: string): string {
  if (!diff.added.length && !diff.dropped.length && !diff.moved.length) {
    return `与 ${baselineAt.slice(0, 19).replace('T', ' ')} 相比：无显著变化（阈值 5sec / 256MB）。`;
  }
  const fmtRow = (row: MetricRow) => `  ${row.name} ${row.value.toFixed(1)} ${row.unit}`;
  const fmtMove = (move: { name: string; from: number; to: number }) => `  ${move.name} ${move.from.toFixed(1)} → ${move.to.toFixed(1)}`;
  return [
    `与 ${baselineAt.slice(0, 19).replace('T', ' ')} 相比：`,
    diff.added.length ? ['新增：', ...diff.added.map(fmtRow)].join('\n') : '',
    diff.dropped.length ? ['消失：', ...diff.dropped.map(fmtRow)].join('\n') : '',
    diff.moved.length ? ['变化：', ...diff.moved.map(fmtMove)].join('\n') : '',
  ].filter(Boolean).join('\n');
}

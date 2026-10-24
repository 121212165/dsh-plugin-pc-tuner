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
    moved: {
        name: string;
        from: number;
        to: number;
    }[];
}
export declare function parseProcessRows(raw: unknown): MetricRow[];
export declare function renderSnapshot(snapshot: Snapshot): string;
/** 与上一份快照对比：新增/消失/挪动。超阈值 5sec 或 256MB 才列。 */
export declare function diffSnapshots(base: Snapshot, next: Snapshot): SnapshotDiff;
export declare function renderDiff(diff: SnapshotDiff, baselineAt: string): string;
//# sourceMappingURL=snapshot.d.ts.map
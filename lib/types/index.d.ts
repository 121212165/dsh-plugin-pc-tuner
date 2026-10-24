export { name, Config, apply, inject } from './plugin.ts';
export type { Config as PcTunerConfig } from './plugin.ts';
export { isWindows, runPs, parseJsonPs, PS_TIMEOUT_MS, type PsResult } from './ps.ts';
export { diffSnapshots, parseProcessRows, renderDiff, renderSnapshot, type MetricRow, type Snapshot, type SnapshotDiff, } from './snapshot.ts';
export { executeClean, planClean, renderExecResult, renderPlan, type CleanItem, type CleanPlan, type ExecResult, } from './clean.ts';
//# sourceMappingURL=index.d.ts.map
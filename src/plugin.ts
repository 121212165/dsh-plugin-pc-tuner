/**
 * dsh wiring for pc-tuner：只读快照工具 + confirm 门禁的清理命令。
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-commands';

import { parseJsonPs, runPs } from './ps.ts';
import { diffSnapshots, parseProcessRows, renderDiff, renderSnapshot, type Snapshot } from './snapshot.ts';
import { executeClean, planClean, renderExecResult, renderPlan } from './clean.ts';

export const name = 'pc-tuner';
export const inject = ['commands', 'tools'];

export interface Config {
  enabled: boolean;
  dataDir?: string;
  topN: number;
  tempAgeDays: number;
  allowDestructive: boolean;
  order: number;
}

export const Config = Schema.object({
  enabled: Schema.boolean().default(true),
  dataDir: Schema.string(),
  topN: Schema.natural().default(10),
  tempAgeDays: Schema.natural().default(7),
  allowDestructive: Schema.boolean().default(false),
  order: Schema.number().default(760),
});

const SNAPSHOT_PS = `
$cpu = Get-Process | Sort-Object CPU -Descending | Select-Object -First 12 |
  ForEach-Object { [ordered]@{ name = $_.ProcessName; value = [math]::Round($_.CPU, 1); unit = 'sec' } } ;
$mem = Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 12 |
  ForEach-Object { [ordered]@{ name = $_.ProcessName; value = [math]::Round($_.WorkingSet64 / 1MB, 1); unit = 'MB' } } ;
$plan = (powercfg /getactivescheme) -join ' ' ;
$load = 0 ;
try { $load = [math]::Round((Get-Counter '\\Processor(_InfoTotal)\\% Processor Time').CounterSamples.CookedValue, 0) } catch {} ;
$battery = 'desktop' ;
try {
  $os = Get-CimInstance Win32_OperatingSystem ;
  if ($os.BatteryStatus -ne $null) { $battery = "battery-status:$($os.BatteryStatus)" }
} catch {} ;
$m = [ordered]@{
  cpuTop = $cpu ; memTop = $mem ;
  powerPlan = $plan ; loadPercent = $load ; battery = $battery ; at = (Get-Date -Format o) ;
} ;
ConvertTo-Json -Compress -Depth 3 @($m) | Write-Output
`;

/** PowerShell 结果 → Snapshot（把 unit=sec 的 CPU 行换算成 cpu%:保守不做换算，只标注） */
async function takeSnapshot(config: Config): Promise<{ snapshot?: Snapshot; error?: string }> {
  const { value, error } = parseJsonPs<{ cpuTop: unknown; memTop: unknown; powerPlan: string; loadPercent: number; battery: string; at: string }>(
    await runPs(SNAPSHOT_PS),
  );
  if (!value) return { error: error ?? 'powershell 无输出' };
  const entry = Array.isArray(value) ? value[0] : value;
  if (!entry) return { error: 'powershell 输出为空' };
  const snapshot: Snapshot = entry as unknown as Snapshot;
  snapshot.cpuTop = parseProcessRows(entry.cpuTop).slice(0, config.topN);
  snapshot.memTop = parseProcessRows(entry.memTop).slice(0, config.topN);
  return { snapshot };
}

export function apply(ctx: Context, config: Config): void {
  const log = ctx.logger(name);
  if (!config.enabled) return void log.info('disabled by config');
  if (config.topN < 1) throw new TypeError('pc-tuner: topN 必须 ≥ 1');
  if (config.tempAgeDays < 1) throw new TypeError('pc-tuner: tempAgeDays 必须 ≥ 1');
  let baseline: Snapshot | null = null;

  ctx.commands.register({
    name: 'perf',
    description: 'Windows 性能快照与低风险清理：/perf | /perf diff | /perf clean [--confirm]',
    input: { hint: '[diff|clean] [--confirm]' },
    handler: async ({ rawInput }) => {
      const raw = String(rawInput ?? '').trim();
      const verb = raw.split(/\s+/)[0] ?? '';
      if (verb === 'clean') {
        const plan = planClean({ tempAgeDays: config.tempAgeDays });
        if (!raw.includes('--confirm')) {
          return { kind: 'success', text: `${renderPlan(plan)}\n当前 allowDestructive=${config.allowDestructive}。` };
        }
        const exec = executeClean(plan, { confirm: true, allowDestructive: config.allowDestructive });
        return { kind: 'success', text: renderExecResult(exec, plan) };
      }
      const { snapshot, error } = await takeSnapshot(config);
      if (!snapshot) return { kind: 'error', text: `快照失败：${error}` };
      if (verb === 'diff') {
        if (!baseline) {
          baseline = snapshot;
          return { kind: 'success', text: ' 第一次无 baseline：已记录本次快照，下次 /perf diff 即出对比。' };
        }
        const text = renderDiff(diffSnapshots(baseline, snapshot), baseline.at);
        baseline = snapshot;
        return { kind: 'success', text };
      }
      baseline = snapshot;
      return { kind: 'success', text: renderSnapshot(snapshot) };
    },
  });

  ctx.tools.register(
    defineTool({
      name: 'perf_snapshot',
      description: '只读 Windows 性能快照：CPU/内存 top、活动电源计划、系统负载。诊断"电脑怎么变慢了"先用它。',
      parameters: {},
      output: { schema: { type: 'string' } as const, render: (_args, value) => [{ type: 'text', text: value }] },
      presentCall: () => ({ card: 'generic' as const, title: '性能快照', kind: 'search' as const }),
      presentResult: (_args, value) => ({ card: 'generic' as const, title: String(value).split('\n')[0]!.slice(0, 60), kind: 'search' as const, rawInput: value }),
      async execute() {
        const { snapshot, error } = await takeSnapshot(config);
        if (!snapshot) return `快照失败：${error}`;
        baseline = snapshot;
        return renderSnapshot(snapshot);
      },
    }),
  );

  ctx.tools.register(
    defineTool({
      name: 'perf_diff',
      description: '与上一次 perf_snapshot 对比列出新增/消失/明显涨跌的进程。连续调用之间自动留 baseline。',
      parameters: {},
      output: { schema: { type: 'string' } as const, render: (_args, value) => [{ type: 'text', text: value }] },
      presentCall: () => ({ card: 'generic' as const, title: '性能对比', kind: 'search' as const }),
      presentResult: (_args, value) => ({ card: 'generic' as const, title: String(value).split('\n')[0]!.slice(0, 60), kind: 'search' as const, rawInput: value }),
      async execute() {
        const { snapshot, error } = await takeSnapshot(config);
        if (!snapshot) return `快照失败：${error}`;
        if (!baseline) { baseline = snapshot; return '第一次无 baseline：已记录本次快照，下次调用即出对比。'; }
        const text = renderDiff(diffSnapshots(baseline, snapshot), baseline.at);
        baseline = snapshot;
        return text;
      },
    }),
  );

  log.info(`mounted · topN=${config.topN} tempAgeDays=${config.tempAgeDays} allowDestructive=${config.allowDestructive}`);
}

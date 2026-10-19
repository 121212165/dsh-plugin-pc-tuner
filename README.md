# dsh-plugin-pc-tuner

> **dsh 插件家族**：22 个插件同一目录 **[dsh-plugin-family](https://github.com/121212165/dsh-plugin-family)** · 配对插件 **[dsh-plugin-eye](https://github.com/121212165/dsh-plugin-eye)**（看电脑）。

**EN** — Windows performance snapshot & low-risk cleanup for dsh: read-only CPU/memory top + active power plan, `/perf diff` to watch what changed, `/perf clean` with a **whitelist + `--confirm` double gate** (config `allowDestructive` off by default). Tools `perf_snapshot` / `perf_diff`; `process_top`. Windows-only; everything runs through a single `powershell -NoProfile` spawn, zero npm runtime deps.

**中文** —— Windows 性能诊断：只读快照（CPU/内存 top、活动电源计划、系统负载）+ 低风险清理（%TEMP% 超龄文件、`~\.dsh\archive` 归档建议）。清理**双道门禁**：先 `/perf clean`（无 --confirm 只打印清单），真删还要 config `allowDestructive=true`；不做路径参数、不碰用户文档目录、凭据文件永不出现在输出。

## 用法

- **`/perf`** —— 一次快照；**`/perf diff`** —— 与上一份对比（≥5sec/256MB 才列）；**`/perf clean`** 打印可清清单（清单本体也可让 agent 处理）；**`/perf clean --confirm`** 执行白名单清理。
- **`perf_snapshot` / `perf_diff` 工具** —— Agent 诊断"电脑怎么变慢了"先行调用。
- 行为红线：拒绝任何路径参数；跳过 >2GB 的归档文件（留给人工）；占用中文件直接跳过。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | |
| `dataDir` | `~/.dsh/pc-tuner` | 预留（快照历史） |
| `topN` | `10` | CPU/内存 top N |
| `tempAgeDays` | `7` | %TEMP% 只清超过 N 天的文件 |
| `allowDestructive` | `false` | **总开关**：false 时 `--confirm` 也只报"被配置禁止" |
| `order` | `760` | prompt section 顺序 |

## 限制

- 仅 Windows（非 win32 平台返回明确错误说明）；CPU 行是进程**累计 CPU 秒数**（不含实时% 采样，嫡系方式是任务管理器）;电源计划名截断 60 字符。
- 一期不做：篡改电源计划、结束进程、开机项管理（全部属于非低风险操作，不做）。

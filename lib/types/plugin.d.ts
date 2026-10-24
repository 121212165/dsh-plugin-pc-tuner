/**
 * dsh wiring for pc-tuner：只读快照工具 + confirm 门禁的清理命令。
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
export declare const name = "pc-tuner";
export declare const inject: string[];
export interface Config {
    enabled: boolean;
    dataDir?: string;
    topN: number;
    tempAgeDays: number;
    allowDestructive: boolean;
    order: number;
}
export declare const Config: Schema<Schemastery.ObjectS<{
    enabled: Schema<boolean, boolean>;
    dataDir: Schema<string, string>;
    topN: Schema<number, number>;
    tempAgeDays: Schema<number, number>;
    allowDestructive: Schema<boolean, boolean>;
    order: Schema<number, number>;
}>, Schemastery.ObjectT<{
    enabled: Schema<boolean, boolean>;
    dataDir: Schema<string, string>;
    topN: Schema<number, number>;
    tempAgeDays: Schema<number, number>;
    allowDestructive: Schema<boolean, boolean>;
    order: Schema<number, number>;
}>>;
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=plugin.d.ts.map
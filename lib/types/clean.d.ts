/**
 * 白名单清理：%TEMP% 超龄文件 / 回收站 / 归档建议。
 * 红线：只有 plan() 产出的路径能进 execute；confirm 缺失一律拒绝；
 * 任何路径参数都直接拒绝（防参数注入）。
 */
export interface CleanItem {
    path: string;
    kind: 'temp' | 'recycle' | 'archive';
    sizeBytes: number;
    ageDays: number;
}
export interface CleanPlan {
    items: CleanItem[];
    skipped: string[];
    /** build 时固化的合法根：execute 只删这两个根内的路径 */
    roots: {
        temp: string;
        archive: string;
    };
}
export declare function planClean(opts: {
    tempDir?: string;
    dshDir?: string;
    tempAgeDays: number;
    now?: Date;
}): CleanPlan;
export declare function renderPlan(plan: CleanPlan): string;
export interface ExecResult {
    deleted: number;
    freedBytes: number;
    refused?: string;
}
/** 执行清理：必须显式 confirm；item 必须出自本次 plan 的白名单（对象身份比对）。 */
export declare function executeClean(plan: CleanPlan, opts: {
    confirm: boolean;
    allowDestructive: boolean;
    recycle?: boolean;
}): ExecResult;
export declare function renderExecResult(result: ExecResult, plan: CleanPlan): string;
//# sourceMappingURL=clean.d.ts.map
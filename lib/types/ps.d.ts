/**
 * PowerShell 执行封装：单次 spawn `powershell -NoProfile`（M$ 稳定内置，避免
 * pwsh 不在 PATH），JSON -Compress 输出 → parse。超时杀进程返回明确错误。
 */
export interface PsResult {
    ok: boolean;
    stdout: string;
    stderr: string;
}
export declare const PS_TIMEOUT_MS = 20000;
export declare function isWindows(): boolean;
export declare function runPs(script: string, timeoutMs?: number): Promise<PsResult>;
/** 解析 PowerShell JSON 输出；解析失败返回 null（附 stderr） */
export declare function parseJsonPs<T>(result: PsResult): {
    value: T | null;
    error?: string;
};
/** 把 JS 对象转成内嵌 PS 字面量（受控输入，永不注入用户文本） */
export declare function psNull(): string;
//# sourceMappingURL=ps.d.ts.map
// @ts-ignore
@external('env', 'logStatic')
export declare function __logStatic(ptr: ArrayBuffer): void;

export function log(v: string): void {
    return __logStatic(String.UTF8.encode(v));
}

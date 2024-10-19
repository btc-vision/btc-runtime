export function assert(condition: boolean, e: string): void {
    if (!condition) throw new Error(e);
}

interface WithToString {
    toString(): string;
}

export function assertEq<T extends WithToString>(a: T, b: T): void {
    assert(a === b, 'expected ' + a.toString() + ' to equal ' + b.toString());
}

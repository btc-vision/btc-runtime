import { u256 } from 'as-bignum/assembly';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';

import { b32decode as _b32decode, bech32m as _bech32m, fromWords, toWords } from './b32';

export function bech32m(v: u256): string {
    return String.UTF8.decode(_bech32m(String.UTF8.encode('bc'), toWords(toArrayBuffer(v))));
}

export function b32decode(v: string): u256 {
    return fromArrayBuffer(fromWords(_b32decode(v).words)) as u256;
}

export function arrayBufferToArray(data: ArrayBuffer): Array<u8> {
    const result = new Array<u8>(data.byteLength);
    store<usize>(changetype<usize>(result), changetype<usize>(data));
    store<usize>(changetype<usize>(result) + sizeof<usize>(), changetype<usize>(data));
    return result;
}

export function toArrayBuffer<T extends u256>(data: T): ArrayBuffer {
    const bytes = data.toBytes();
    return changetype<Uint8Array>(bytes).buffer;
}

export function primitiveToBuffer<T>(value: T): ArrayBuffer {
    const buffer = new ArrayBuffer(sizeof<T>());
    store<T>(changetype<usize>(buffer), value);
    return buffer;
}

export function fromArrayBuffer(data: ArrayBuffer): MemorySlotPointer {
    if (data.byteLength === 0) return u256.Zero;
    return u256.fromBytes(changetype<u8[]>(Uint8Array.wrap(data)));
}

export function concat(a: ArrayBuffer, b: ArrayBuffer): ArrayBuffer {
    const result = new ArrayBuffer(a.byteLength + b.byteLength);
    memory.copy(changetype<usize>(result), changetype<usize>(a), <usize>a.byteLength);
    memory.copy(
        changetype<usize>(result) + <usize>a.byteLength,
        changetype<usize>(b),
        <usize>b.byteLength,
    );
    return result;
}

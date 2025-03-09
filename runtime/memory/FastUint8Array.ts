import { Revert } from '../types/Revert';
import { ArrayBuffer } from 'arraybuffer';

export class FastUint8Array {
    public length: i32;
    private ptr: usize;

    [key: number]: u8;

    constructor(length: i32) {
        if (length < 0) {
            throw new Revert('Negative length in FastUint8Array constructor');
        }

        this.length = length;
        this.ptr = __alloc(<usize>length);
    }

    public static fromUint8Array(arr: Uint8Array): FastUint8Array {
        const buffer = new FastUint8Array(arr.length);
        for (let i: u32 = 0; i < arr.length; i++) {
            buffer[i] = arr[i];
        }

        return buffer;
    }

    toArrayBuffer(): ArrayBuffer {
        const arr = new Uint8Array(this.length);
        for (let i: u32 = 0; i < arr.length; i++) {
            arr[i] = this[i];
        }

        return arr.buffer;
    }

    /**
     * Fills the buffer with a specified byte value.
     */
    fill(value: u8): void {
        memory.fill(this.ptr, value, <usize>this.length);
    }

    /**
     * Copies bytes from another FastUint8Array into this one, starting at `destOffset`.
     */
    copyFrom(source: FastUint8Array, destOffset: i32 = 0): void {
        if (destOffset < 0) {
            throw new Revert(`Negative destOffset in copyFrom: ${destOffset}`);
        }

        let maxBytes = source.length;
        const destRemaining = this.length - destOffset;
        if (destRemaining < maxBytes) {
            maxBytes = destRemaining;
        }

        if (maxBytes <= 0) return;

        memory.copy(
            this.ptr + <usize>destOffset,
            source.ptr,
            <usize>maxBytes,
        );
    }

    free(): void {
        if (this.ptr != 0) {
            __free(this.ptr);
            this.ptr = 0;
            this.length = 0;
        }
    }

    /**
     * Safe read operator: buffer[i]
     * Throws on out-of-bounds.
     */
    @operator('[]')
    private __get(index: i32): u8 {
        if (<u32>index >= <u32>this.length) {
            throw new Revert('Index out of range in __get');
        }
        return load<u8>(this.ptr + <usize>index);
    }

    /**
     * Safe write operator: buffer[i] = value
     * Throws on out-of-bounds.
     */
    @operator('[]=')
    private __set(index: i32, value: u8): void {
        if (<u32>index >= <u32>this.length) {
            throw new Revert('Index out of range in __set');
        }
        store<u8>(this.ptr + <usize>index, value);
    }

    /**
     * Braces read operator: buffer{i}
     * Now also throws on out-of-bounds for safety.
     */
    @operator('{}')
    private __uget(index: i32): u8 {
        if (<u32>index >= <u32>this.length) {
            throw new Revert('Index out of range in __uget');
        }
        return load<u8>(this.ptr + <usize>index);
    }

    /**
     * Braces write operator: buffer{i} = value
     * Now also throws on out-of-bounds.
     */
    @operator('{}=')
    private __uset(index: i32, value: u8): void {
        if (<u32>index >= <u32>this.length) {
            throw new Revert('Index out of range in __uset');
        }
        store<u8>(this.ptr + <usize>index, value);
    }
}
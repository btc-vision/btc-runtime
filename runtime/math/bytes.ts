import {Revert} from '../types/Revert';
import {BytesWriter} from '../buffer/BytesWriter';
import {BytesReader} from '../buffer/BytesReader';

/**
 * Convert a 4-byte big-endian array into a u32.
 * Index 0 is most significant, index 3 is least significant.
 */
@inline
export function bytesToU32(number: Uint8Array): u32 {
    if (number.length < 4) {
        throw new Revert('bytesToU32: input must be at least 4 bytes');
    }
    return (u32(number[0]) << 24) |
        (u32(number[1]) << 16) |
        (u32(number[2]) << 8) |
        u32(number[3]);
}

// 32-byte buffer of all zeros
export const EMPTY_BUFFER: Uint8Array = new Uint8Array(32);

// 30-byte buffer of all zeros
export const EMPTY_POINTER: Uint8Array = new Uint8Array(30);

// 32-byte buffer representing 1 in big-endian form:
// index 31 is the least significant byte.
export const ONE_BUFFER: Uint8Array = new Uint8Array(32);
ONE_BUFFER[31] = 1;

/**
 * Return a new 32-byte zero buffer.
 */
@inline
export function GET_EMPTY_BUFFER(): Uint8Array {
    return new Uint8Array(32);
}

/**
 * A helper to add two 32-byte big-endian Uint8Arrays.
 * Returns a new 32-byte Uint8Array with (a + b) mod 2^256.
 *
 * In big-endian, the LSB is at index 31, so we iterate from i = 31 down to 0.
 */
@inline
export function addUint8ArraysBE(a: Uint8Array, b: Uint8Array): Uint8Array {
    if (a.length !== 32 || b.length !== 32) {
        throw new Revert('addUint8ArraysBE expects 32-byte inputs');
    }

    const result = new Uint8Array(32);
    let carry = 0;

    // index 31 is least significant byte
    for (let i = 31; i >= 0; i--) {
        const sum = (a[i] as u32) + (b[i] as u32) + carry;
        result[i] = sum & 0xff;
        carry = sum >> 8;
    }

    return result;
}

/**
 * Convert a u64 value to a 32-byte big-endian Uint8Array,
 * placing the u64 in the *last* 8 bytes (indices 24..31).
 * The most significant 24 bytes (indices 0..23) remain 0.
 */
@inline
export function u64ToBE32Bytes(value: u64): Uint8Array {
    const arr = new Uint8Array(32);

    // Write big-endian into the final 8 bytes:
    for (let i = 0; i < 8; i++) {
        arr[31 - i] = <u8>(value & 0xff);
        value >>= 8;
    }

    return arr;
}

/**
 * Get the bit at `bitIndex` (0..255) in a 32-byte buffer **in big-endian bit numbering**.
 * - bitIndex = 0 => the MSB of buffer[0].
 * - bitIndex = 7 => the LSB of buffer[0].
 * - bitIndex = 255 => the LSB of buffer[31].
 */
@inline
export function getBit(buffer: Uint8Array, bitIndex: u16): bool {
    if (bitIndex >= 256) {
        throw new Revert('Bit index out of range');
    }

    // Which byte?
    const byteIndex: u8 = <u8>(bitIndex >>> 3);

    // Which bit within that byte? (MSB = bit offset 7)
    const offset: u8 = <u8>(7 - (bitIndex & 7));

    const b: u8 = buffer[byteIndex];
    return ((b >>> offset) & 1) == 1;
}

/**
 * Set or clear the bit at `bitIndex` (0..255) in a 32-byte buffer (**big-endian** bit numbering).
 * - bitIndex = 0 => sets the MSB of buffer[0].
 * - bitIndex = 255 => sets the LSB of buffer[31].
 */
@inline
export function setBit(buffer: Uint8Array, bitIndex: u16, bitValue: bool): void {
    if (bitIndex >= 256) {
        throw new Revert('Bit index out of range');
    }

    // Which byte?
    const byteIndex: u8 = <u8>(bitIndex >>> 3);

    // Which bit within that byte? (MSB = bit offset 7)
    const offset: u8 = <u8>(7 - (bitIndex & 7));

    let b: u8 = buffer[byteIndex];
    if (bitValue) {
        b |= 1 << offset;
    } else {
        b &= ~(1 << offset);
    }

    buffer[byteIndex] = b;
}


/**
 * Assume the data is at least 16 bytes, read two u64s from it in big-endian order.
 */
@inline
export function readLengthAndStartIndex(data: Uint8Array): u32[] {
    if (data.length < 16) {
        return [0, 0];
    }

    const reader = new BytesReader(data);
    const length = reader.readU32();
    const startIndex = reader.readU32();

    return [length, startIndex];
}

/**
 * Write two u64s into a 32-byte buffer in big-endian order
 */
@inline
export function writeLengthAndStartIndex(length: u32, startIndex: u32): Uint8Array {
    const writer = new BytesWriter(32);
    writer.writeU32(length);
    writer.writeU32(startIndex);

    return writer.getBuffer();
}

@inline
export function bigEndianAdd(base: Uint8Array, increment: u64): Uint8Array {
    if(base.length !== 32) {
        throw new Revert('bigEndianAdd: base must be 32 bytes');
    }

    const add = u64ToBE32Bytes(increment);

    return addUint8ArraysBE(base, add);
}

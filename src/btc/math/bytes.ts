import { u256 } from 'as-bignum/assembly';

export function bytes(number: u256[]): Uint8Array {
    const result = new Uint8Array(32 * number.length);
    for (let i: u8 = 0; i < 32; i++) {
        const num: Uint8Array = number[31 - i].toUint8Array();
        for (let j: u8 = 0; j < number.length; j++) {
            result[i + j * 32] = num[i];
        }
    }

    return result;
}

export function bytes4(number: Uint8Array): u32 {
    return u32(number[0]) << 24 | u32(number[1]) << 16 | u32(number[2]) << 8 | u32(number[3]);
}

export function bytes8(number: Uint8Array): u64 {
    return u64(number[0]) << u64(56) | u64(number[1]) << u64(48) | u64(number[2]) << u64(40) | u64(number[3]) << u64(32) | u64(number[4]) << 24 | u64(number[5]) << 16 | u64(number[6]) << 8 | u64(number[7]);
}

export function bytes32(number: Uint8Array): u256 {
    return u256.fromBytes(number);
}

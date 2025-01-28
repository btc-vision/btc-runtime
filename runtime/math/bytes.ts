import { u128, u256 } from '@btc-vision/as-bignum/assembly';

export function bytes(numbers: u256[]): Uint8Array {
    const len = numbers.length;
    const result = new Uint8Array(32 * len);

    // Loop through the array in reverse order, so that the last element (index = len-1)
    // becomes the first chunk in the output, and so on.
    for (let i = 0; i < len; i++) {
        // Reverse index to pick elements from the end
        const rev = len - 1 - i;
        const chunk: Uint8Array = numbers[rev].toUint8Array();

        // Copy this 32-byte chunk into the output at offset i * 32.
        const offset = i * 32;
        for (let b: u32 = 0; b < 32; b++) {
            result[offset + b] = chunk[b];
        }
    }

    return result;
}

export function bytes4(number: Uint8Array): u32 {
    return (u32(number[0]) << 24) | (u32(number[1]) << 16) | (u32(number[2]) << 8) | u32(number[3]);
}

export function bytes8(number: Uint8Array): u64 {
    return (
        (u64(number[0]) << u64(56)) |
        (u64(number[1]) << u64(48)) |
        (u64(number[2]) << u64(40)) |
        (u64(number[3]) << u64(32)) |
        (u64(number[4]) << 24) |
        (u64(number[5]) << 16) |
        (u64(number[6]) << 8) |
        u64(number[7])
    );
}

export function bytes16(buffer: Uint8Array): u128 {
    // Validate that the buffer is at least 16 bytes:
    if (buffer.length < 16) {
        throw new Error('bytes16: Buffer must be at least 16 bytes long');
    }

    // If it's larger than 16, slice it down:
    if (buffer.length > 16) {
        buffer = buffer.slice(0, 16);
    }

    return u128.fromBytes(buffer);
}

export function bytes32(number: Uint8Array): u256 {
    return u256.fromBytes(number);
}

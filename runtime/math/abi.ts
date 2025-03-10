import { bytesToU32 } from './bytes';
import { sha256 } from '../env/global';
import { u256 } from '@btc-vision/as-bignum/assembly';

export type Selector = u32;

export function encodeSelector(name: string): Selector {
    const typed = Uint8Array.wrap(String.UTF8.encode(name));
    const hash = sha256(typed);

    return bytesToU32(hash);
}

/**
 * Use more gas.
 * @param uniqueIdentifier
 * @param typed
 */
export function encodePointerUnknownLength(uniqueIdentifier: u16, typed: Uint8Array): Uint8Array {
    const hash = sha256(typed);

    return encodePointer(uniqueIdentifier, hash, false);
}

export function ensureAtLeast30Bytes(typed: Uint8Array): Uint8Array {
    if (typed.length >= 30) {
        return typed;
    }

    const result = new Uint8Array(30);
    for (let i = 0; i < typed.length; i++) {
        result[i] = typed[i];
    }

    return result;
}

@inline
function toArrayBufferBE(buffer: usize, val: u256): void {
    // Write the upper 3 chunks (each 64 bits) in one shot:
    store<u64>(buffer, bswap(val.hi2), 0); // 0..7
    store<u64>(buffer, bswap(val.hi1), 8); // 8..15
    store<u64>(buffer, bswap(val.lo2), 16); // 16..23

    // Now handle the final 64 bits (val.lo1) in [32 + 16 + 16] form.
    //  - lo1High32 = top 32 bits   [bits 63..32]
    //  - lo1Mid16  = middle 16 bits [bits 31..16]
    //  - lo1Low16  = bottom 16 bits [bits 15..0]
    const lo1High32 = u32(val.lo1 >>> 32);
    const lo1Mid16 = u16((val.lo1 >>> 16) & 0xffff);

    // Store them in ascending offsets. Because each store is little-endian,
    // we bswap the values so that the final bytes in memory are big-endian.

    // Offsets 24..27 (4 bytes): top 32 bits of lo1
    store<u32>(buffer, bswap(lo1High32), 24);

    // Offsets 28..29 (2 bytes): mid 16 bits of lo1
    store<u16>(buffer, bswap(lo1Mid16), 28);
}

export function u256To30Bytes(value: u256): Uint8Array {
    const result = new Uint8Array(30);
    toArrayBufferBE(changetype<usize>(result.dataStart), value);
    return result;
}

/**
 * Optimized pointer encoding, see encodePointerUnknownLength for a more generic version.
 * @param uniqueIdentifier
 * @param typed
 * @param safe
 */
export function encodePointer(uniqueIdentifier: u16, typed: Uint8Array, safe: boolean = true): Uint8Array {
    const array = ensureAtLeast30Bytes(typed);

    if (safe) assert(array.length === 30, `Pointers must be 30 bytes. Got ${array.length}.`);

    const finalPointer = new Uint8Array(32);
    finalPointer[0] = uniqueIdentifier & 0xff;
    finalPointer[1] = (uniqueIdentifier >> 8) & 0xff;

    for (let i = 0; i < 30; i++) {
        finalPointer[i + 2] = array[i];
    }

    return finalPointer;
}

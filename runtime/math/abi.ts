import { bytesToU32 } from './bytes';
import { sha256 } from '../env/global';

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

    return encodePointer(uniqueIdentifier, hash);
}

function ensureAtLeast30Bytes(typed: Uint8Array): Uint8Array {
    if (typed.length >= 30) {
        return typed;
    }

    const result = new Uint8Array(30);
    for (let i = 0; i < typed.length; i++) {
        result[i] = typed[i];
    }

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

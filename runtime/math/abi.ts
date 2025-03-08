import { bytesToU32 } from './bytes';
import { sha256 } from '../env/global';
import { FastUint8Array } from '../memory/FastUint8Array';

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
export function encodePointerUnknownLength(uniqueIdentifier: u16, typed: Uint8Array): FastUint8Array {
    const hash = sha256(typed);

    return encodePointer(uniqueIdentifier, FastUint8Array.fromUint8Array(hash));
}

/**
 * Optimized pointer encoding, see encodePointerUnknownLength for a more generic version.
 * @param uniqueIdentifier
 * @param typed
 * @param safe
 */
export function encodePointer(uniqueIdentifier: u16, typed: FastUint8Array, safe: boolean = true): FastUint8Array {
    if (safe) assert(typed.length === 30, `Pointers must be 30 bytes. Got ${typed.length}.`);

    const finalPointer = new FastUint8Array(32);
    finalPointer[0] = u8(uniqueIdentifier & 0xff);
    finalPointer[1] = u8((uniqueIdentifier >> 8) & 0xff);

    for (let i = 0; i < 30; i++) {
        finalPointer[i + 2] = typed[i];
    }

    return finalPointer;
}

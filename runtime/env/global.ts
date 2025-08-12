import { Sha256 } from '../SHA256/sha256';
import { ripemd160f } from '../SHA256/ripemd160f';
import { Blockchain } from './index';

/**
 * Computes the SHA-256 hash of the given data.
 * @param {Uint8Array} data - The data to hash.
 * @returns {Uint8Array} - The SHA-256 hash.
 */
export function sha256(data: Uint8Array): Uint8Array {
    return Sha256.hash(data);
}

export function sha256String(data: string): Uint8Array {
    return sha256(stringToBytes(data));
}

function stringToBytes(str: string): Uint8Array {
    const bytes = String.UTF8.encode(str);
    return Uint8Array.wrap(bytes);
}

export function ripemd160(data: Uint8Array): Uint8Array {
    return ripemd160f(data);
}

export function inputs(): Uint8Array {
    return Blockchain.mockedTransactionInputs();
}

export function outputs(): Uint8Array {
    return Blockchain.mockedTransactionOutput();
}
/**
 * Computes the SHA-256 hash of a string.
 * @param {string} data - The string to hash.
 * @returns {Uint8Array} - The SHA-256 hash.
 */
/**
 * Computes the HASH160 (RIPEMD-160 of SHA-256) of the given data.
 * @param {Uint8Array} data - The data to hash.
 * @returns {Uint8Array} - The HASH160 result.
 */
export function hash160(data: Uint8Array): Uint8Array {
    return ripemd160(sha256(data));
}

/**
 * Computes the double SHA-256 hash of the given data.
 * @param {Uint8Array} data - The data to hash.
 * @returns {Uint8Array} - The double SHA-256 hash.
 */
export function hash256(data: Uint8Array): Uint8Array {
    return sha256(sha256(data));
}

/**
 * Converts a string to a byte array.
 * @param {string} str - The string to convert.
 * @returns {Uint8Array} - The byte array.
 */

export * from './Atomic';

/**
 * Keccak-256 implementation for OPNet (AssemblyScript / btc-runtime compatible)
 *
 * This implements the ORIGINAL Keccak-256 as used by Ethereum (pre-NIST),
 * NOT the NIST SHA-3-256 standard. The difference is the domain separation
 * padding byte: Keccak uses 0x01, SHA-3 uses 0x06.
 *
 * Reference: https://keccak.team/keccak_specs_summary.html
 * Ported from: https://github.com/debris/tiny-keccak (Rust)
 * Verified against: Ethereum keccak256 test vectors
 *
 * @module keccak256
 * @license MIT
 */

@inline const ROUNDS: i32 = 24;

// Rate in bytes: (1600 - 2*256) / 8 = 136 for Keccak-256
@inline const RATE_BYTES: i32 = 136;

// Output hash size in bytes
@inline const HASH_BYTES: i32 = 32;

// State size: 5x5 matrix of 64-bit words
@inline const STATE_SIZE: i32 = 25;

// Round constants for Keccak-f[1600] (24 rounds)
// Each 64-bit constant is split into [high u32, low u32]
// Source: FIPS 202 / Keccak reference implementation
const RC_HI: u32[] = [
    0x00000000, 0x00000000, 0x80000000, 0x80000000,
    0x00000000, 0x00000000, 0x80000000, 0x80000000,
    0x00000000, 0x00000000, 0x00000000, 0x00000000,
    0x00000000, 0x80000000, 0x80000000, 0x80000000,
    0x80000000, 0x80000000, 0x00000000, 0x80000000,
    0x80000000, 0x80000000, 0x00000000, 0x80000000,
];

const RC_LO: u32[] = [
    0x00000001, 0x00008082, 0x0000808A, 0x80008000,
    0x0000808B, 0x80000001, 0x80008081, 0x00008009,
    0x0000008A, 0x00000088, 0x80008009, 0x8000000A,
    0x8000808B, 0x0000008B, 0x00008089, 0x00008003,
    0x00008002, 0x00000080, 0x0000800A, 0x8000000A,
    0x80008081, 0x00008080, 0x80000001, 0x80008008,
];

// Rotation offsets for rho step
const ROTC: i32[] = [
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14,
    27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44,
];

// Pi step permutation indices
const PILN: i32[] = [
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4,
    15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1,
];

/**
 * Keccak-256 hash function (Ethereum-compatible)
 *
 * Computes the Keccak-256 hash of the input data.
 * Uses 0x01 padding (original Keccak, NOT SHA-3's 0x06).
 *
 * @param data - Input bytes to hash
 * @returns 32-byte Keccak-256 digest as Uint8Array
 *
 * @example
 * ```typescript
 * import { keccak256 } from './keccak256';
 *
 * const input = Uint8Array.wrap(String.UTF8.encode("hello"));
 * const hash: Uint8Array = keccak256(input);
 * // hash == 0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8
 * ```
 */
export function keccak256(data: Uint8Array): Uint8Array {
    // State: 25 x 64-bit words, stored as paired u32 arrays (lo/hi)
    const sLo = new Array<u32>(STATE_SIZE);
    const sHi = new Array<u32>(STATE_SIZE);

    for (let i = 0; i < STATE_SIZE; i++) {
        sLo[i] = 0;
        sHi[i] = 0;
    }

    const dataLen: i32 = data.length;
    let offset: i32 = 0;

    // Absorb phase: process full rate-sized blocks
    while (offset + RATE_BYTES <= dataLen) {
        xorBlock(sLo, sHi, data, offset);
        keccakF1600(sLo, sHi);
        offset += RATE_BYTES;
    }

    // Padding: create final padded block
    const remaining: i32 = dataLen - offset;
    const padded = new Uint8Array(RATE_BYTES);

    // Copy remaining bytes
    for (let i: i32 = 0; i < remaining; i++) {
        padded[i] = data[offset + i];
    }

    // Keccak padding (NOT SHA-3):
    // - Set first padding byte to 0x01 (Keccak domain separation)
    // - Set last byte of rate block to OR with 0x80
    // For SHA-3, the first padding byte would be 0x06 instead.
    padded[remaining] = 0x01;
    padded[RATE_BYTES - 1] |= 0x80;

    // Absorb final padded block
    xorBlock(sLo, sHi, padded, 0);
    keccakF1600(sLo, sHi);

    // Squeeze phase: extract 32-byte hash output
    const output = new Uint8Array(HASH_BYTES);
    for (let i: i32 = 0; i < HASH_BYTES / 8; i++) {
        const lo: u32 = sLo[i];
        const hi: u32 = sHi[i];

        // Little-endian encoding of each 64-bit state word
        output[i * 8] = <u8>(lo & 0xff);
        output[i * 8 + 1] = <u8>((lo >>> 8) & 0xff);
        output[i * 8 + 2] = <u8>((lo >>> 16) & 0xff);
        output[i * 8 + 3] = <u8>((lo >>> 24) & 0xff);
        output[i * 8 + 4] = <u8>(hi & 0xff);
        output[i * 8 + 5] = <u8>((hi >>> 8) & 0xff);
        output[i * 8 + 6] = <u8>((hi >>> 16) & 0xff);
        output[i * 8 + 7] = <u8>((hi >>> 24) & 0xff);
    }

    return output;
}

/**
 * Keccak-256 hash of two concatenated byte arrays.
 * Common pattern for Ethereum-style mapping keys: keccak256(abi.encodePacked(a, b))
 *
 * @param a - First byte array
 * @param b - Second byte array
 * @returns 32-byte Keccak-256 digest
 */
export function keccak256Concat(a: Uint8Array, b: Uint8Array): Uint8Array {
    const combined = new Uint8Array(a.length + b.length);
    combined.set(a, 0);
    combined.set(b, a.length);
    return keccak256(combined);
}

/**
 * Compute Ethereum-style 4-byte function selector.
 * selector = keccak256(signature)[0:4]
 *
 * @param signature - Function signature string, e.g. "transfer(address,uint256)"
 * @returns 4-byte selector as Uint8Array
 */
export function functionSelector(signature: string): Uint8Array {
    const encoded = Uint8Array.wrap(String.UTF8.encode(signature));
    const hash = keccak256(encoded);
    const selector = new Uint8Array(4);
    selector[0] = hash[0];
    selector[1] = hash[1];
    selector[2] = hash[2];
    selector[3] = hash[3];
    return selector;
}

/**
 * Compute Ethereum-style address from uncompressed public key.
 * address = keccak256(pubkey)[12:32]
 *
 * @param publicKey - 64-byte uncompressed public key (without 0x04 prefix)
 * @returns 20-byte Ethereum address as Uint8Array
 */
export function ethAddressFromPubKey(publicKey: Uint8Array): Uint8Array {
    if (publicKey.length !== 64) {
        throw new Error(
            `ethAddressFromPubKey expects a 64-byte uncompressed public key (without 0x04 prefix), got ${publicKey.length} bytes`,
        );
    }

    const hash = keccak256(publicKey);
    const addr = new Uint8Array(20);
    for (let i: i32 = 0; i < 20; i++) {
        addr[i] = hash[12 + i];
    }
    return addr;
}

// ============================================================================
// Internal: Keccak-f[1600] permutation
// ============================================================================

/**
 * Rotate a 64-bit value (stored as lo/hi u32 pair) left by n bits.
 * Returns [newLo, newHi].
 */
// @ts-ignore: decorator
@inline
export function rot64Lo(lo: u32, hi: u32, n: i32): u32 {
    if (n == 0) return lo;
    if (n == 32) return hi;
    if (n < 32) return (lo << n) | (hi >>> (32 - n));
    return (hi << (n - 32)) | (lo >>> (64 - n));
}

// @ts-ignore: decorator
@inline
export function rot64Hi(lo: u32, hi: u32, n: i32): u32 {
    if (n == 0) return hi;
    if (n == 32) return lo;
    if (n < 32) return (hi << n) | (lo >>> (32 - n));
    return (lo << (n - 32)) | (hi >>> (64 - n));
}

/**
 * XOR a rate-sized block of data into the state.
 * Data is read as little-endian 64-bit words split into lo/hi u32.
 */
function xorBlock(
    sLo: Array<u32>,
    sHi: Array<u32>,
    data: Uint8Array,
    offset: i32,
): void {
    const words: i32 = RATE_BYTES / 8; // 17 words for rate=136
    for (let i: i32 = 0; i < words; i++) {
        const pos: i32 = offset + i * 8;
        const lo: u32 =
            <u32>data[pos] |
            (<u32>data[pos + 1] << 8) |
            (<u32>data[pos + 2] << 16) |
            (<u32>data[pos + 3] << 24);
        const hi: u32 =
            <u32>data[pos + 4] |
            (<u32>data[pos + 5] << 8) |
            (<u32>data[pos + 6] << 16) |
            (<u32>data[pos + 7] << 24);

        sLo[i] ^= lo;
        sHi[i] ^= hi;
    }
}

/**
 * Keccak-f[1600] permutation: 24 rounds of theta, rho, pi, chi, iota.
 * Operates on the state as 25 pairs of u32 (lo, hi) representing 64-bit words.
 */
function keccakF1600(sLo: Array<u32>, sHi: Array<u32>): void {
    // Temporaries for theta
    const cLo = new Array<u32>(5);
    const cHi = new Array<u32>(5);

    for (let round: i32 = 0; round < ROUNDS; round++) {
        // ---- Theta ----
        // C[x] = A[x,0] ^ A[x,1] ^ A[x,2] ^ A[x,3] ^ A[x,4]
        for (let x: i32 = 0; x < 5; x++) {
            cLo[x] = sLo[x] ^ sLo[x + 5] ^ sLo[x + 10] ^ sLo[x + 15] ^ sLo[x + 20];
            cHi[x] = sHi[x] ^ sHi[x + 5] ^ sHi[x + 10] ^ sHi[x + 15] ^ sHi[x + 20];
        }

        for (let x: i32 = 0; x < 5; x++) {
            const x4: i32 = (x + 4) % 5;
            const x1: i32 = (x + 1) % 5;

            // D[x] = C[x-1] ^ ROT(C[x+1], 1)
            const rLo: u32 = rot64Lo(cLo[x1], cHi[x1], 1);
            const rHi: u32 = rot64Hi(cLo[x1], cHi[x1], 1);
            const dLo: u32 = cLo[x4] ^ rLo;
            const dHi: u32 = cHi[x4] ^ rHi;

            for (let y: i32 = 0; y < 25; y += 5) {
                sLo[y + x] ^= dLo;
                sHi[y + x] ^= dHi;
            }
        }

        // ---- Rho + Pi ----
        let tLo: u32 = sLo[1];
        let tHi: u32 = sHi[1];

        for (let i: i32 = 0; i < 24; i++) {
            const j: i32 = PILN[i];
            const bcLo: u32 = sLo[j];
            const bcHi: u32 = sHi[j];

            sLo[j] = rot64Lo(tLo, tHi, ROTC[i]);
            sHi[j] = rot64Hi(tLo, tHi, ROTC[i]);

            tLo = bcLo;
            tHi = bcHi;
        }

        // ---- Chi ----
        for (let y: i32 = 0; y < 25; y += 5) {
            const b0Lo: u32 = sLo[y];     const b0Hi: u32 = sHi[y];
            const b1Lo: u32 = sLo[y + 1]; const b1Hi: u32 = sHi[y + 1];
            const b2Lo: u32 = sLo[y + 2]; const b2Hi: u32 = sHi[y + 2];
            const b3Lo: u32 = sLo[y + 3]; const b3Hi: u32 = sHi[y + 3];
            const b4Lo: u32 = sLo[y + 4]; const b4Hi: u32 = sHi[y + 4];

            sLo[y]     = b0Lo ^ (~b1Lo & b2Lo);
            sHi[y]     = b0Hi ^ (~b1Hi & b2Hi);
            sLo[y + 1] = b1Lo ^ (~b2Lo & b3Lo);
            sHi[y + 1] = b1Hi ^ (~b2Hi & b3Hi);
            sLo[y + 2] = b2Lo ^ (~b3Lo & b4Lo);
            sHi[y + 2] = b2Hi ^ (~b3Hi & b4Hi);
            sLo[y + 3] = b3Lo ^ (~b4Lo & b0Lo);
            sHi[y + 3] = b3Hi ^ (~b4Hi & b0Hi);
            sLo[y + 4] = b4Lo ^ (~b0Lo & b1Lo);
            sHi[y + 4] = b4Hi ^ (~b0Hi & b1Hi);
        }

        // ---- Iota ----
        sLo[0] ^= RC_LO[round];
        sHi[0] ^= RC_HI[round];
    }
}

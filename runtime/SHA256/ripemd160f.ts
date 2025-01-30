const BLOCK_SIZE: u32 = 64;        // 512 bits
const HASH_SIZE: u32  = 20;        // 160 bits output
const PADDING_BYTE: u8 = 0x80;     // 1000 0000 in binary

// Initial state constants (little-endian)
const INIT0: u32 = 0x67452301;
const INIT1: u32 = 0xefcdab89;
const INIT2: u32 = 0x98badcfe;
const INIT3: u32 = 0x10325476;
const INIT4: u32 = 0xc3d2e1f0;

// Rotation left utility
@inline
function rotl(x: u32, n: u32): u32 {
    return (x << n) | (x >> (32 - n));
}

// Some basic functions used by RIPEMD160 round steps:
@inline
function f(j: u32, x: u32, y: u32, z: u32): u32 {
    if (j <= 15) {
        return x ^ y ^ z;
    } else if (j <= 31) {
        return (x & y) | (~x & z);
    } else if (j <= 47) {
        return (x | ~y) ^ z;
    } else if (j <= 63) {
        return (x & z) | (y & ~z);
    } else {
        return x ^ (y | ~z);
    }
}

// Amounts for rotate left in each round:
const RL1: u8[] = [11,14,15,12, 5,8,7,9, 11,13,14,15, 6,7,9,8];
const RL2: u8[] = [12, 5, 9, 7,11,13,14,15, 6, 8,13,6, 5,12,7,5];
const RL3: u8[] = [11,13, 6, 7,14, 9,13,15,14, 8,13,6, 5,12, 7,5];
const RL4: u8[] = [11,14,15,12, 5, 8, 7, 9,11,13,14,15, 6, 7, 9, 8];
const RL5: u8[] = [12, 5, 9, 7,11,13,14,15, 6, 8,13,6, 5,12, 7,5];

// Index permutations:
const RL1_I: u8[] = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15];
const RL2_I: u8[] = [ 7, 4,13, 1,10, 6,15, 3,12, 0, 9, 5, 2,14,11, 8];
const RL3_I: u8[] = [ 3,10,14, 4, 9,15, 8, 1, 2, 7, 0, 6,13,11, 5,12];
const RL4_I: u8[] = [ 1, 9,11,10, 0, 8,12, 4,13, 3, 7,15,14, 5, 6, 2];
const RL5_I: u8[] = [ 4, 0, 5, 9, 7,12, 2,10,14, 1, 3, 8,11, 6,15,13];

// The compression function processes 512-bit (64-byte) chunks
function compress(chunk: Uint8Array, h: Uint32Array): void {
    // 1) parse 16 little-endian words from chunk
    let x = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
        let j = i << 2; // i*4
        x[i] = <u32>(
            chunk[j]        |
            (chunk[j + 1] << 8) |
            (chunk[j + 2] << 16)|
            (chunk[j + 3] << 24)
        );
    }

    // 2) copy current state
    let al: u32 = h[0];
    let bl: u32 = h[1];
    let cl: u32 = h[2];
    let dl: u32 = h[3];
    let el: u32 = h[4];

    let ar: u32 = h[0];
    let br: u32 = h[1];
    let cr: u32 = h[2];
    let dr: u32 = h[3];
    let er: u32 = h[4];

    // Expand over 80 rounds, but we do it in 5 blocks of 16
    for (let j: u32 = 0; j < 80; j++) {
        let s: u32, t: u32;
        if (j < 16) {
            // left
            t = al + f(j, bl, cl, dl) + x[RL1_I[j]] + 0x00000000;
            t = rotl(t, RL1[j % 16]) + el;
            al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;

            // right
            t = ar + f(79 - j, br, cr, dr) + x[RL5_I[j]] + 0x50a28be6;
            t = rotl(t, RL5[j % 16]) + er;
            ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
        }
        else if (j < 32) {
            t = al + f(j, bl, cl, dl) + x[RL2_I[j % 16]] + 0x5a827999;
            t = rotl(t, RL2[j % 16]) + el;
            al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;

            t = ar + f(79 - j, br, cr, dr) + x[RL4_I[j % 16]] + 0x5c4dd124;
            t = rotl(t, RL4[j % 16]) + er;
            ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
        }
        else if (j < 48) {
            t = al + f(j, bl, cl, dl) + x[RL3_I[j % 16]] + 0x6ed9eba1;
            t = rotl(t, RL3[j % 16]) + el;
            al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;

            t = ar + f(79 - j, br, cr, dr) + x[RL3_I[j % 16]] + 0x6d703ef3;
            t = rotl(t, RL3[j % 16]) + er;
            ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
        }
        else if (j < 64) {
            t = al + f(j, bl, cl, dl) + x[RL4_I[j % 16]] + 0x8f1bbcdc;
            t = rotl(t, RL4[j % 16]) + el;
            al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;

            t = ar + f(79 - j, br, cr, dr) + x[RL2_I[j % 16]] + 0x7a6d76e9;
            t = rotl(t, RL2[j % 16]) + er;
            ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
        }
        else {
            t = al + f(j, bl, cl, dl) + x[RL5_I[j % 16]] + 0xa953fd4e;
            t = rotl(t, RL5[j % 16]) + el;
            al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;

            t = ar + f(79 - j, br, cr, dr) + x[RL1_I[j % 16]] + 0x00000000;
            t = rotl(t, RL1[j % 16]) + er;
            ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
        }
    }

    // Combine results
    let t: u32 = (h[1] + cl + dr) & 0xffffffff;
    h[1]       = (h[2] + dl + er) & 0xffffffff;
    h[2]       = (h[3] + el + ar) & 0xffffffff;
    h[3]       = (h[4] + al + br) & 0xffffffff;
    h[4]       = (h[0] + bl + cr) & 0xffffffff;
    h[0]       = t;
}

// The main function: ripemd160(input: Uint8Array) => 20-byte array
export function ripemd160f(data: Uint8Array): Uint8Array {
    // 1) Initialize state
    let h = new Uint32Array(5);
    h[0] = INIT0;
    h[1] = INIT1;
    h[2] = INIT2;
    h[3] = INIT3;
    h[4] = INIT4;

    // 2) Pre-processing (length in bits)
    let len = data.length;
    let bitLen = <u64>len << 3;

    // 3) Create a buffer that includes padding
    //    Usually we append 0x80, then zero bytes, then length (little endian).
    //    The padded length must be multiple of 64.
    // Calculate final message size
    let padLength = <i32>((56 - (len + 1) % 64) % 64);
    let totalLength = len + 1 + padLength + 8; // +8 for length

    let msg = new Uint8Array(totalLength);
    msg.set(data, 0);

    // Append 0x80
    msg[len] = PADDING_BYTE;

    // Append length in little-endian 64 bits
    // The final 8 bytes are the bit length
    let bitLenLow = <u32>(bitLen & 0xffffffff);
    let bitLenHigh = <u32>(bitLen >> 32);

    msg[totalLength - 8] = <u8>(bitLenLow       & 0xff);
    msg[totalLength - 7] = <u8>((bitLenLow >> 8) & 0xff);
    msg[totalLength - 6] = <u8>((bitLenLow >>16) & 0xff);
    msg[totalLength - 5] = <u8>((bitLenLow >>24) & 0xff);

    msg[totalLength - 4] = <u8>(bitLenHigh       & 0xff);
    msg[totalLength - 3] = <u8>((bitLenHigh >> 8) & 0xff);
    msg[totalLength - 2] = <u8>((bitLenHigh >>16) & 0xff);
    msg[totalLength - 1] = <u8>((bitLenHigh >>24) & 0xff);

    // 4) Process each 64-byte chunk
    for (let i = 0; i < totalLength; i += BLOCK_SIZE) {
        compress(msg.subarray(i, i + BLOCK_SIZE), h);
    }

    // 5) Output final 20-byte (160-bit) array in little-endian format
    let out = new Uint8Array(HASH_SIZE);

    // h[0..4] are 32-bit words in little-endian
    for (let i = 0; i < 5; i++) {
        let val = h[i];
        let j = i << 2; // i*4
        out[j]   = <u8>( val        & 0xff);
        out[j+1] = <u8>((val >> 8)  & 0xff);
        out[j+2] = <u8>((val >>16)  & 0xff);
        out[j+3] = <u8>((val >>24)  & 0xff);
    }

    return out;
}

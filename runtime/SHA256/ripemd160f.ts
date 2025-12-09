const BLOCK_SIZE: u32 = 64;
const HASH_SIZE: u32 = 20;
const PADDING_BYTE: u8 = 0x80;

const INIT0: u32 = 0x67452301;
const INIT1: u32 = 0xefcdab89;
const INIT2: u32 = 0x98badcfe;
const INIT3: u32 = 0x10325476;
const INIT4: u32 = 0xc3d2e1f0;

@inline
function rotl(x: u32, n: u32): u32 {
    return (x << n) | (x >>> (32 - n));
}

@inline
function f0(x: u32, y: u32, z: u32): u32 {
    return x ^ y ^ z;
}

@inline
function f1(x: u32, y: u32, z: u32): u32 {
    return (x & y) | (~x & z);
}

@inline
function f2(x: u32, y: u32, z: u32): u32 {
    return (x | ~y) ^ z;
}

@inline
function f3(x: u32, y: u32, z: u32): u32 {
    return (x & z) | (y & ~z);
}

@inline
function f4(x: u32, y: u32, z: u32): u32 {
    return x ^ (y | ~z);
}

function compress(data: Uint8Array, offset: i32, h: Uint32Array): void {
    const x = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
        const j = offset + (i << 2);
        x[i] = <u32>(
            data[j] |
            (data[j + 1] << 8) |
            (data[j + 2] << 16) |
            (data[j + 3] << 24)
        );
    }

    let al: u32 = h[0], bl: u32 = h[1], cl: u32 = h[2], dl: u32 = h[3], el: u32 = h[4];
    let ar: u32 = h[0], br: u32 = h[1], cr: u32 = h[2], dr: u32 = h[3], er: u32 = h[4];
    let t: u32;

    // Round 1 left: f0, K=0x00000000
    t = rotl(al + f0(bl, cl, dl) + x[0] + 0x00000000, 11) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f0(bl, cl, dl) + x[1] + 0x00000000, 14) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f0(bl, cl, dl) + x[2] + 0x00000000, 15) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f0(bl, cl, dl) + x[3] + 0x00000000, 12) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f0(bl, cl, dl) + x[4] + 0x00000000, 5) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f0(bl, cl, dl) + x[5] + 0x00000000, 8) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f0(bl, cl, dl) + x[6] + 0x00000000, 7) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f0(bl, cl, dl) + x[7] + 0x00000000, 9) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f0(bl, cl, dl) + x[8] + 0x00000000, 11) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f0(bl, cl, dl) + x[9] + 0x00000000, 13) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f0(bl, cl, dl) + x[10] + 0x00000000, 14) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f0(bl, cl, dl) + x[11] + 0x00000000, 15) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f0(bl, cl, dl) + x[12] + 0x00000000, 6) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f0(bl, cl, dl) + x[13] + 0x00000000, 7) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f0(bl, cl, dl) + x[14] + 0x00000000, 9) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f0(bl, cl, dl) + x[15] + 0x00000000, 8) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;

    // Round 2 left: f1, K=0x5a827999
    t = rotl(al + f1(bl, cl, dl) + x[7] + 0x5a827999, 7) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f1(bl, cl, dl) + x[4] + 0x5a827999, 6) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f1(bl, cl, dl) + x[13] + 0x5a827999, 8) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f1(bl, cl, dl) + x[1] + 0x5a827999, 13) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f1(bl, cl, dl) + x[10] + 0x5a827999, 11) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f1(bl, cl, dl) + x[6] + 0x5a827999, 9) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f1(bl, cl, dl) + x[15] + 0x5a827999, 7) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f1(bl, cl, dl) + x[3] + 0x5a827999, 15) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f1(bl, cl, dl) + x[12] + 0x5a827999, 7) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f1(bl, cl, dl) + x[0] + 0x5a827999, 12) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f1(bl, cl, dl) + x[9] + 0x5a827999, 15) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f1(bl, cl, dl) + x[5] + 0x5a827999, 9) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f1(bl, cl, dl) + x[2] + 0x5a827999, 11) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f1(bl, cl, dl) + x[14] + 0x5a827999, 7) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f1(bl, cl, dl) + x[11] + 0x5a827999, 13) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f1(bl, cl, dl) + x[8] + 0x5a827999, 12) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;

    // Round 3 left: f2, K=0x6ed9eba1
    t = rotl(al + f2(bl, cl, dl) + x[3] + 0x6ed9eba1, 11) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f2(bl, cl, dl) + x[10] + 0x6ed9eba1, 13) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f2(bl, cl, dl) + x[14] + 0x6ed9eba1, 6) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f2(bl, cl, dl) + x[4] + 0x6ed9eba1, 7) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f2(bl, cl, dl) + x[9] + 0x6ed9eba1, 14) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f2(bl, cl, dl) + x[15] + 0x6ed9eba1, 9) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f2(bl, cl, dl) + x[8] + 0x6ed9eba1, 13) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f2(bl, cl, dl) + x[1] + 0x6ed9eba1, 15) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f2(bl, cl, dl) + x[2] + 0x6ed9eba1, 14) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f2(bl, cl, dl) + x[7] + 0x6ed9eba1, 8) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f2(bl, cl, dl) + x[0] + 0x6ed9eba1, 13) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f2(bl, cl, dl) + x[6] + 0x6ed9eba1, 6) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f2(bl, cl, dl) + x[13] + 0x6ed9eba1, 5) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f2(bl, cl, dl) + x[11] + 0x6ed9eba1, 12) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f2(bl, cl, dl) + x[5] + 0x6ed9eba1, 7) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f2(bl, cl, dl) + x[12] + 0x6ed9eba1, 5) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;

    // Round 4 left: f3, K=0x8f1bbcdc
    t = rotl(al + f3(bl, cl, dl) + x[1] + 0x8f1bbcdc, 11) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f3(bl, cl, dl) + x[9] + 0x8f1bbcdc, 12) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f3(bl, cl, dl) + x[11] + 0x8f1bbcdc, 14) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f3(bl, cl, dl) + x[10] + 0x8f1bbcdc, 15) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f3(bl, cl, dl) + x[0] + 0x8f1bbcdc, 14) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f3(bl, cl, dl) + x[8] + 0x8f1bbcdc, 15) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f3(bl, cl, dl) + x[12] + 0x8f1bbcdc, 9) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f3(bl, cl, dl) + x[4] + 0x8f1bbcdc, 8) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f3(bl, cl, dl) + x[13] + 0x8f1bbcdc, 9) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f3(bl, cl, dl) + x[3] + 0x8f1bbcdc, 14) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f3(bl, cl, dl) + x[7] + 0x8f1bbcdc, 5) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f3(bl, cl, dl) + x[15] + 0x8f1bbcdc, 6) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f3(bl, cl, dl) + x[14] + 0x8f1bbcdc, 8) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f3(bl, cl, dl) + x[5] + 0x8f1bbcdc, 6) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f3(bl, cl, dl) + x[6] + 0x8f1bbcdc, 5) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f3(bl, cl, dl) + x[2] + 0x8f1bbcdc, 12) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;

    // Round 5 left: f4, K=0xa953fd4e
    t = rotl(al + f4(bl, cl, dl) + x[4] + 0xa953fd4e, 9) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f4(bl, cl, dl) + x[0] + 0xa953fd4e, 15) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f4(bl, cl, dl) + x[5] + 0xa953fd4e, 5) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f4(bl, cl, dl) + x[9] + 0xa953fd4e, 11) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f4(bl, cl, dl) + x[7] + 0xa953fd4e, 6) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f4(bl, cl, dl) + x[12] + 0xa953fd4e, 8) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f4(bl, cl, dl) + x[2] + 0xa953fd4e, 13) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f4(bl, cl, dl) + x[10] + 0xa953fd4e, 12) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f4(bl, cl, dl) + x[14] + 0xa953fd4e, 5) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f4(bl, cl, dl) + x[1] + 0xa953fd4e, 12) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f4(bl, cl, dl) + x[3] + 0xa953fd4e, 13) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f4(bl, cl, dl) + x[8] + 0xa953fd4e, 14) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f4(bl, cl, dl) + x[11] + 0xa953fd4e, 11) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f4(bl, cl, dl) + x[6] + 0xa953fd4e, 8) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f4(bl, cl, dl) + x[15] + 0xa953fd4e, 5) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
    t = rotl(al + f4(bl, cl, dl) + x[13] + 0xa953fd4e, 6) + el; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;

    // Round 1 right: f4, K'=0x50a28be6
    t = rotl(ar + f4(br, cr, dr) + x[5] + 0x50a28be6, 8) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f4(br, cr, dr) + x[14] + 0x50a28be6, 9) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f4(br, cr, dr) + x[7] + 0x50a28be6, 9) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f4(br, cr, dr) + x[0] + 0x50a28be6, 11) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f4(br, cr, dr) + x[9] + 0x50a28be6, 13) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f4(br, cr, dr) + x[2] + 0x50a28be6, 15) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f4(br, cr, dr) + x[11] + 0x50a28be6, 15) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f4(br, cr, dr) + x[4] + 0x50a28be6, 5) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f4(br, cr, dr) + x[13] + 0x50a28be6, 7) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f4(br, cr, dr) + x[6] + 0x50a28be6, 7) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f4(br, cr, dr) + x[15] + 0x50a28be6, 8) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f4(br, cr, dr) + x[8] + 0x50a28be6, 11) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f4(br, cr, dr) + x[1] + 0x50a28be6, 14) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f4(br, cr, dr) + x[10] + 0x50a28be6, 14) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f4(br, cr, dr) + x[3] + 0x50a28be6, 12) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f4(br, cr, dr) + x[12] + 0x50a28be6, 6) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;

    // Round 2 right: f3, K'=0x5c4dd124
    t = rotl(ar + f3(br, cr, dr) + x[6] + 0x5c4dd124, 9) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f3(br, cr, dr) + x[11] + 0x5c4dd124, 13) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f3(br, cr, dr) + x[3] + 0x5c4dd124, 15) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f3(br, cr, dr) + x[7] + 0x5c4dd124, 7) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f3(br, cr, dr) + x[0] + 0x5c4dd124, 12) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f3(br, cr, dr) + x[13] + 0x5c4dd124, 8) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f3(br, cr, dr) + x[5] + 0x5c4dd124, 9) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f3(br, cr, dr) + x[10] + 0x5c4dd124, 11) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f3(br, cr, dr) + x[14] + 0x5c4dd124, 7) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f3(br, cr, dr) + x[15] + 0x5c4dd124, 7) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f3(br, cr, dr) + x[8] + 0x5c4dd124, 12) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f3(br, cr, dr) + x[12] + 0x5c4dd124, 7) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f3(br, cr, dr) + x[4] + 0x5c4dd124, 6) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f3(br, cr, dr) + x[9] + 0x5c4dd124, 15) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f3(br, cr, dr) + x[1] + 0x5c4dd124, 13) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f3(br, cr, dr) + x[2] + 0x5c4dd124, 11) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;

    // Round 3 right: f2, K'=0x6d703ef3
    t = rotl(ar + f2(br, cr, dr) + x[15] + 0x6d703ef3, 9) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f2(br, cr, dr) + x[5] + 0x6d703ef3, 7) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f2(br, cr, dr) + x[1] + 0x6d703ef3, 15) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f2(br, cr, dr) + x[3] + 0x6d703ef3, 11) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f2(br, cr, dr) + x[7] + 0x6d703ef3, 8) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f2(br, cr, dr) + x[14] + 0x6d703ef3, 6) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f2(br, cr, dr) + x[6] + 0x6d703ef3, 6) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f2(br, cr, dr) + x[9] + 0x6d703ef3, 14) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f2(br, cr, dr) + x[11] + 0x6d703ef3, 12) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f2(br, cr, dr) + x[8] + 0x6d703ef3, 13) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f2(br, cr, dr) + x[12] + 0x6d703ef3, 5) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f2(br, cr, dr) + x[2] + 0x6d703ef3, 14) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f2(br, cr, dr) + x[10] + 0x6d703ef3, 13) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f2(br, cr, dr) + x[0] + 0x6d703ef3, 13) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f2(br, cr, dr) + x[4] + 0x6d703ef3, 7) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f2(br, cr, dr) + x[13] + 0x6d703ef3, 5) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;

    // Round 4 right: f1, K'=0x7a6d76e9
    t = rotl(ar + f1(br, cr, dr) + x[8] + 0x7a6d76e9, 15) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f1(br, cr, dr) + x[6] + 0x7a6d76e9, 5) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f1(br, cr, dr) + x[4] + 0x7a6d76e9, 8) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f1(br, cr, dr) + x[1] + 0x7a6d76e9, 11) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f1(br, cr, dr) + x[3] + 0x7a6d76e9, 14) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f1(br, cr, dr) + x[11] + 0x7a6d76e9, 14) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f1(br, cr, dr) + x[15] + 0x7a6d76e9, 6) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f1(br, cr, dr) + x[0] + 0x7a6d76e9, 14) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f1(br, cr, dr) + x[5] + 0x7a6d76e9, 6) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f1(br, cr, dr) + x[12] + 0x7a6d76e9, 9) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f1(br, cr, dr) + x[2] + 0x7a6d76e9, 12) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f1(br, cr, dr) + x[13] + 0x7a6d76e9, 9) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f1(br, cr, dr) + x[9] + 0x7a6d76e9, 12) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f1(br, cr, dr) + x[7] + 0x7a6d76e9, 5) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f1(br, cr, dr) + x[10] + 0x7a6d76e9, 15) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f1(br, cr, dr) + x[14] + 0x7a6d76e9, 8) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;

    // Round 5 right: f0, K'=0x00000000
    t = rotl(ar + f0(br, cr, dr) + x[12] + 0x00000000, 8) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f0(br, cr, dr) + x[15] + 0x00000000, 5) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f0(br, cr, dr) + x[10] + 0x00000000, 12) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f0(br, cr, dr) + x[4] + 0x00000000, 9) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f0(br, cr, dr) + x[1] + 0x00000000, 12) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f0(br, cr, dr) + x[5] + 0x00000000, 5) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f0(br, cr, dr) + x[8] + 0x00000000, 14) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f0(br, cr, dr) + x[7] + 0x00000000, 6) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f0(br, cr, dr) + x[6] + 0x00000000, 8) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f0(br, cr, dr) + x[2] + 0x00000000, 13) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f0(br, cr, dr) + x[13] + 0x00000000, 6) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f0(br, cr, dr) + x[14] + 0x00000000, 5) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f0(br, cr, dr) + x[0] + 0x00000000, 15) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f0(br, cr, dr) + x[3] + 0x00000000, 13) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f0(br, cr, dr) + x[9] + 0x00000000, 11) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    t = rotl(ar + f0(br, cr, dr) + x[11] + 0x00000000, 11) + er; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;

    t = (h[1] + cl + dr) & 0xffffffff;
    h[1] = (h[2] + dl + er) & 0xffffffff;
    h[2] = (h[3] + el + ar) & 0xffffffff;
    h[3] = (h[4] + al + br) & 0xffffffff;
    h[4] = (h[0] + bl + cr) & 0xffffffff;
    h[0] = t;
}

export function ripemd160(data: Uint8Array): Uint8Array {
    const h = new Uint32Array(5);
    h[0] = INIT0;
    h[1] = INIT1;
    h[2] = INIT2;
    h[3] = INIT3;
    h[4] = INIT4;

    const len = data.length;
    const bitLen = <u64>len << 3;
    const padLength = <i32>((56 - (len + 1) % 64 + 64) % 64);
    const totalLength = len + 1 + padLength + 8;

    const msg = new Uint8Array(totalLength);
    msg.set(data, 0);
    msg[len] = PADDING_BYTE;

    const bitLenLow = <u32>(bitLen & 0xffffffff);
    const bitLenHigh = <u32>(bitLen >>> 32);

    msg[totalLength - 8] = <u8>(bitLenLow & 0xff);
    msg[totalLength - 7] = <u8>((bitLenLow >>> 8) & 0xff);
    msg[totalLength - 6] = <u8>((bitLenLow >>> 16) & 0xff);
    msg[totalLength - 5] = <u8>((bitLenLow >>> 24) & 0xff);
    msg[totalLength - 4] = <u8>(bitLenHigh & 0xff);
    msg[totalLength - 3] = <u8>((bitLenHigh >>> 8) & 0xff);
    msg[totalLength - 2] = <u8>((bitLenHigh >>> 16) & 0xff);
    msg[totalLength - 1] = <u8>((bitLenHigh >>> 24) & 0xff);

    for (let i = 0; i < totalLength; i += <i32>BLOCK_SIZE) {
        compress(msg, i, h);
    }

    const out = new Uint8Array(<i32>HASH_SIZE);
    for (let i = 0; i < 5; i++) {
        const val = h[i];
        const j = i << 2;
        out[j] = <u8>(val & 0xff);
        out[j + 1] = <u8>((val >>> 8) & 0xff);
        out[j + 2] = <u8>((val >>> 16) & 0xff);
        out[j + 3] = <u8>((val >>> 24) & 0xff);
    }

    return out;
}

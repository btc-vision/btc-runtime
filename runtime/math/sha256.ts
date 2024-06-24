type aisize = i32;

function setU8(t: Uint8Array, s: Uint8Array, o: isize = 0): void {
    memory.copy(t.dataStart + o, s.dataStart, s.length);
}

function store64_be(x: Uint8Array, offset: isize, u: u64): void {
    store<u64>(changetype<usize>(x.buffer) + offset, bswap(u));
}

function load32_be(x: Uint8Array, offset: isize): u32 {
    return bswap(load<u32>(changetype<usize>(x.buffer) + offset));
}

function store32_be(x: Uint8Array, offset: isize, u: u32): void {
    store<u32>(changetype<usize>(x.buffer) + offset, bswap(u));
}

class Internal {
    static K: u32[] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    static iv: u8[] = [
        0x6a, 0x09, 0xe6, 0x67, 0xbb, 0x67, 0xae, 0x85, 0x3c, 0x6e, 0xf3, 0x72, 0xa5, 0x4f, 0xf5, 0x3a,
        0x51, 0x0e, 0x52, 0x7f, 0x9b, 0x05, 0x68, 0x8c, 0x1f, 0x83, 0xd9, 0xab, 0x5b, 0xe0, 0xcd, 0x19,
    ];

    @inline
    static Sigma0(x: u32): u32 {
        return rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22);
    }

    @inline
    static Sigma1(x: u32): u32 {
        return rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25);
    }

    @inline
    static sigma0(x: u32): u32 {
        return rotr(x, 7) ^ rotr(x, 18) ^ (x >> 3);
    }

    @inline
    static sigma1(x: u32): u32 {
        return rotr(x, 17) ^ rotr(x, 19) ^ (x >> 10);
    }

    @inline
    static Ch(x: u32, y: u32, z: u32): u32 {
        return z ^ (x & (y ^ z));
    }

    @inline
    static Maj(x: u32, y: u32, z: u32): u32 {
        return (x & (y ^ z)) ^ (y & z);
    }

    static expand(w: StaticArray<u32>): void {
        for (let i = 0; i < 16; i++) {
            unchecked(w[i] += w[(i + 9) & 15] + Internal.sigma1(w[(i + 14) & 15]) + Internal.sigma0(w[(i + 1) & 15]));
        }
    }

    static handle(r: StaticArray<u32>, w: StaticArray<u32>, c: u32[]): void {
        for (let i = 0; i < 16; i++) {
            var x = (r[7 & (7 - i)] + w[i] + c[i]);
            x += unchecked(Internal.Sigma1(r[7 & (4 - i)]));
            x += unchecked(Internal.Ch(r[7 & (4 - i)], r[7 & (5 - i)], r[7 & (6 - i)]));
            unchecked(r[7 & (3 - i)] += x);
            x += unchecked(Internal.Sigma0(r[7 & (0 - i)]));
            x += unchecked(Internal.Maj(r[7 & (0 - i)], r[7 & (1 - i)], r[7 & (2 - i)]));
            unchecked(r[7 & (7 - i)] = x);
        }
    }

    static _hashblocks(st: Uint8Array, m: Uint8Array, n_: isize): isize {
        let z = new StaticArray<u32>(8),
            r = new StaticArray<u32>(8),
            w = new StaticArray<u32>(16);
        for (let i = 0; i < 8; ++i) {
            unchecked(z[i] = r[i] = load32_be(st, i << 2));
        }
        let pos = 0, n = n_;
        while (n >= 64) {
            for (let i = 0; i < 16; ++i) {
                w[i] = load32_be(m, (i << 2) + pos);
            }
            Internal.handle(r, w, Internal.K.slice(0));
            Internal.expand(w);
            Internal.handle(r, w, Internal.K.slice(16));
            Internal.expand(w);
            Internal.handle(r, w, Internal.K.slice(32));
            Internal.expand(w);
            Internal.handle(r, w, Internal.K.slice(48));
            for (let i = 0; i < 8; ++i) {
                let x = unchecked(r[i] + z[i]);
                unchecked(z[i] = x);
                unchecked(r[i] = x);
            }
            pos += 64;
            n -= 64;
        }
        for (let i = 0; i < 8; ++i) {
            store32_be(st, i << 2, unchecked(z[i]));
        }
        return n;
    }

    static _hashInit(): Uint8Array {
        let st = new Uint8Array(32 + 64);

        for (let i = 0; i < 32; ++i) {
            st[i] = Internal.iv[i];
        }
        return st;
    }

    static _hashUpdate(st: Uint8Array, m: Uint8Array, n: isize, r: isize): isize {
        let obuffered = st.subarray(32);
        let buffered = new Uint8Array(64);
        setU8(buffered, obuffered.subarray(0, 64));

        let still_available_in_buffer = <isize>64 - r;
        let copiable_to_buffer = min(n, still_available_in_buffer);
        setU8(buffered, m.subarray(0, <aisize>copiable_to_buffer), r);
        r += copiable_to_buffer;
        n -= copiable_to_buffer;
        let pos: isize = 0;
        if (r === 64) {
            Internal._hashblocks(st, buffered, 64);
            r = 0;
            pos = copiable_to_buffer;
        }
        if (n == 0) {
            setU8(obuffered, buffered);
            return r;
        }
        let left = m.subarray(<aisize>pos);
        r = Internal._hashblocks(st, left, left.length);
        if (r > 0) {
            setU8(obuffered, left.subarray(left.length - <aisize>r));
        }
        return r;
    }

    static _hashFinal(st: Uint8Array, out: Uint8Array, t: isize, r: isize): void {
        let buffered = st.subarray(32);
        let padded = new Uint8Array(128);
        setU8(padded, buffered.subarray(0, <aisize>r));
        padded[<aisize>r] = 0x80;
        if (r < 56) {
            store64_be(padded, 64 - 8, t << 3);
            Internal._hashblocks(st, padded, 64);
        } else {
            store64_be(padded, 128 - 8, t << 3);
            Internal._hashblocks(st, padded, 128);
        }
        for (let i = 0; i < 32; ++i) {
            out[i] = st[i];
        }
    }

    static _hash(out: Uint8Array, m: Uint8Array, n: isize): void {
        let st = Internal._hashInit();
        let r = Internal._hashUpdate(st, m, n, 0);

        Internal._hashFinal(st, out, n, r);
    }

    static _hmac(m: Uint8Array, k: Uint8Array): Uint8Array {
        if (k.length > 64) {
            k = Sha256.hash(k);
        }
        let b = new Uint8Array(64);
        setU8(b, k);
        for (let i = 0; i < b.length; ++i) {
            b[i] ^= 0x36;
        }
        let out = new Uint8Array(32);
        let st = Internal._hashInit();
        let r = Internal._hashUpdate(st, b, b.length, 0);
        r = Internal._hashUpdate(st, m, m.length, r);
        Internal._hashFinal(st, out, b.length + m.length, r);
        for (let i = 0; i < b.length; ++i) {
            b[i] ^= 0x6a;
        }
        st = Internal._hashInit();
        r = Internal._hashUpdate(st, b, b.length, 0);
        r = Internal._hashUpdate(st, out, out.length, r);
        Internal._hashFinal(st, out, b.length + out.length, r);
        return out;
    }
}

/**
 * Hash function output size, in bytes
 */
export const SHA256_HASH_BYTES: isize = 32;

export class Sha256 {
    r: u64 = 0;
    t: u64 = 0;
    st: Uint8Array;

    /**
     * Initialize a multipart hash computation
     * @returns A hash function state
     */
    constructor() {
        let st = Internal._hashInit();
        this.st = st;
    }

    /**
     * Compute a hash for a single-part message
     * @param m Message
     * @returns Hash
     */
    static hash(m: Uint8Array): Uint8Array {
        let h = new Uint8Array(<aisize>SHA256_HASH_BYTES);
        Internal._hash(h, m, m.length);
        return h;
    }

    /**
     * HMAC-SHA-256
     * @param m Message
     * @param k Key
     * @returns `HMAC-SHA-256(m, k)`
     */
    static hmac(m: Uint8Array, k: Uint8Array): Uint8Array {
        return Internal._hmac(m, k);
    }

    /**
     * Absorb data to be hashed
     * @param m (partial) message
     */
    update(m: Uint8Array): void {
        let n = m.length;
        this.t += n;
        this.r = Internal._hashUpdate(this.st, m, n, this.r as isize);
    }

    /**
     * Finalize a hash computation
     * @returns Hash
     */
    final(): Uint8Array {
        let h = new Uint8Array(<aisize>SHA256_HASH_BYTES);
        Internal._hashFinal(this.st, h, this.t as isize, this.r as isize);
        return h;
    }
}

import { u128, u256 } from '@btc-vision/as-bignum/assembly';

export class SafeMath {
    public static ZERO: u256 = u256.fromU32(0);

    public static add(a: u256, b: u256): u256 {
        const c: u256 = u256.add(a, b);
        if (c < a) {
            throw new Error('SafeMath: addition overflow');
        }
        return c;
    }

    public static add128(a: u128, b: u128): u128 {
        const c: u128 = u128.add(a, b);
        if (c < a) {
            throw new Error('SafeMath: addition overflow');
        }
        return c;
    }

    public static add64(a: u64, b: u64): u64 {
        const c: u64 = a + b;

        if (c < a) {
            throw new Error('SafeMath: addition overflow');
        }
        return c;
    }

    public static sub(a: u256, b: u256): u256 {
        if (a < b) {
            throw new Error('SafeMath: subtraction overflow');
        }

        return u256.sub(a, b);
    }

    public static sub128(a: u128, b: u128): u128 {
        if (a < b) {
            throw new Error('SafeMath: subtraction overflow');
        }

        return u128.sub(a, b);
    }

    public static sub64(a: u64, b: u64): u64 {
        if (a < b) {
            throw new Error('SafeMath: subtraction overflow');
        }

        return a - b;
    }

    // Computes (a * b) % modulus with full precision
    public static mulmod(a: u256, b: u256, modulus: u256): u256 {
        if (u256.eq(modulus, u256.Zero)) throw new Error('SafeMath: modulo by zero');

        const mul = SafeMath.mul(a, b);
        return SafeMath.mod(mul, modulus);
    }

    @unsafe
    @operator('%')
    public static mod(a: u256, b: u256): u256 {
        if (u256.eq(b, u256.Zero)) {
            throw new Error('SafeMath: modulo by zero');
        }

        const divResult = SafeMath.div(a, b);
        const product = SafeMath.mul(divResult, b);
        return SafeMath.sub(a, product);
    }

    public static modInverse(k: u256, p: u256): u256 {
        let s = u256.Zero;
        let old_s = u256.One;
        let r = p;
        let old_r = k;

        while (!r.isZero()) {
            const quotient = SafeMath.div(old_r, r);

            // --- Update r ---
            {
                // old_r - (quotient * r)
                const tmp = r;
                r = u256.sub(old_r, u256.mul(quotient, r)); // unchecked subtract
                old_r = tmp;
            }

            // --- Update s ---
            {
                // old_s - (quotient * s)
                const tmp = s;
                s = u256.sub(old_s, u256.mul(quotient, s)); // unchecked subtract
                old_s = tmp;
            }
        }

        // At this point, `old_r` is the gcd(k, p). If gcd != 1 => no inverse
        // (in a prime field p, gcd=1 if k != 0).
        // We could enforce this by checking `old_r == 1` but we'll leave it to the caller.

        // The extended Euclidean algorithm says `old_s` is the inverse (possibly negative),
        // so we reduce mod p
        return SafeMath.mod(old_s, p);
    }

    public static isEven(a: u256): bool {
        return u256.and(a, u256.One) == u256.Zero;
    }

    public static pow(base: u256, exponent: u256): u256 {
        let result: u256 = u256.One;
        while (u256.gt(exponent, u256.Zero)) {
            if (u256.ne(u256.and(exponent, u256.One), u256.Zero)) {
                result = SafeMath.mul(result, base);
            }

            base = SafeMath.mul(base, base);
            exponent = u256.shr(exponent, 1);
        }
        return result;
    }

    public static mul(a: u256, b: u256): u256 {
        if (a === SafeMath.ZERO || b === SafeMath.ZERO) {
            return SafeMath.ZERO;
        }

        const c: u256 = u256.mul(a, b);
        const d: u256 = SafeMath.div(c, a);

        if (u256.ne(d, b)) {
            throw new Error('SafeMath: multiplication overflow');
        }

        return c;
    }

    public static mul128(a: u128, b: u128): u128 {
        if (a === u128.Zero || b === u128.Zero) {
            return u128.Zero;
        }

        const c: u128 = u128.mul(a, b);
        const d: u128 = SafeMath.div128(c, a);

        if (u128.ne(d, b)) {
            throw new Error('SafeMath: multiplication overflow');
        }

        return c;
    }

    public static mul64(a: u64, b: u64): u64 {
        if (a === 0 || b === 0) {
            return 0;
        }

        const c: u64 = a * b;

        if (c / a !== b) {
            throw new Error('SafeMath: multiplication overflow');
        }

        return c;
    }

    public static div64(a: u64, b: u64): u64 {
        if (b === 0) {
            throw new Error('Division by zero');
        }

        if (a === 0) {
            return 0;
        }

        if (a < b) {
            return 0; // Return 0 if a < b
        }

        if (a === b) {
            return 1; // Return 1 if a == b
        }

        return a / b;
    }

    public static div128(a: u128, b: u128): u128 {
        if (b.isZero()) {
            throw new Error('Division by zero');
        }

        if (a.isZero()) {
            return new u128();
        }

        if (u128.lt(a, b)) {
            return new u128(); // Return 0 if a < b
        }

        if (u128.eq(a, b)) {
            return new u128(1); // Return 1 if a == b
        }

        let n = a.clone();
        let d = b.clone();
        let result = new u128();

        const shift = u128.clz(d) - u128.clz(n);
        d = SafeMath.shl128(d, shift); // align d with n by shifting left

        for (let i = shift; i >= 0; i--) {
            if (u128.ge(n, d)) {
                n = u128.sub(n, d);
                result = u128.or(result, SafeMath.shl128(u128.One, i));
            }
            d = u128.shr(d, 1); // restore d to original by shifting right
        }

        return result;
    }

    @unsafe
    @operator('/')
    public static div(a: u256, b: u256): u256 {
        if (b.isZero()) {
            throw new Error('Division by zero');
        }

        if (a.isZero()) {
            return new u256();
        }

        if (u256.lt(a, b)) {
            return new u256(); // Return 0 if a < b
        }

        if (u256.eq(a, b)) {
            return new u256(1); // Return 1 if a == b
        }

        let n = a.clone();
        let d = b.clone();
        let result = new u256();

        const shift = u256.clz(d) - u256.clz(n);
        d = SafeMath.shl(d, shift); // align d with n by shifting left

        for (let i = shift; i >= 0; i--) {
            if (u256.ge(n, d)) {
                n = u256.sub(n, d);
                result = u256.or(result, SafeMath.shl(u256.One, i));
            }
            d = u256.shr(d, 1); // restore d to original by shifting right
        }

        return result;
    }

    public static min64(a: u64, b: u64): u64 {
        return a < b ? a : b;
    }

    public static max64(a: u64, b: u64): u64 {
        return a > b ? a : b;
    }

    public static min128(a: u128, b: u128): u128 {
        return u128.lt(a, b) ? a : b;
    }

    public static max128(a: u128, b: u128): u128 {
        return u128.gt(a, b) ? a : b;
    }

    public static min(a: u256, b: u256): u256 {
        return u256.lt(a, b) ? a : b;
    }

    public static max(a: u256, b: u256): u256 {
        return u256.gt(a, b) ? a : b;
    }

    @unsafe
    public static sqrt(y: u256): u256 {
        if (u256.gt(y, u256.fromU32(3))) {
            let z = y;

            const u246_2 = u256.fromU32(2);

            const d = SafeMath.div(y, u246_2);
            let x = SafeMath.add(d, u256.One);

            while (u256.lt(x, z)) {
                z = x;

                const u = SafeMath.div(y, x);
                const y2 = u256.add(u, x);

                x = SafeMath.div(y2, u246_2);
            }

            return z;
        } else if (!u256.eq(y, u256.Zero)) {
            return u256.One;
        } else {
            return u256.Zero;
        }
    }

    @unsafe
    public static shl(value: u256, shift: i32): u256 {
        // If shift <= 0, no left shift needed (shift=0 => return clone, shift<0 => treat as 0).
        if (shift <= 0) {
            return shift == 0 ? value.clone() : new u256(); // or just return value if shift<0 is invalid
        }

        // If shift >= 256, the result is zero
        if (shift >= 256) {
            return new u256();
        }

        // Now shift is in [1..255]. Masking is optional for clarity:
        shift &= 255;

        const bitsPerSegment = 64;
        const segmentShift = (shift / bitsPerSegment) | 0;
        const bitShift = shift % bitsPerSegment;

        const segments = [value.lo1, value.lo2, value.hi1, value.hi2];
        const result = SafeMath.shlSegment(segments, segmentShift, bitShift, bitsPerSegment, 4);
        return new u256(result[0], result[1], result[2], result[3]);
    }

    public static shl128(value: u128, shift: i32): u128 {
        if (shift <= 0) {
            return shift == 0 ? value.clone() : new u128();
        }

        // Here the total bit width is 128, so shifting >= 128 bits => zero
        if (shift >= 128) {
            return new u128();
        }

        // Mask to 0..127
        shift &= 127;

        const bitsPerSegment = 64;

        const segmentShift = (shift / bitsPerSegment) | 0;
        const bitShift = shift % bitsPerSegment;

        const segments = [value.lo, value.hi];
        const result = SafeMath.shlSegment(segments, segmentShift, bitShift, bitsPerSegment, 2);
        return new u128(result[0], result[1]);
    }

    public static and(a: u256, b: u256): u256 {
        return u256.and(a, b);
    }

    public static or(a: u256, b: u256): u256 {
        return u256.or(a, b);
    }

    public static xor(a: u256, b: u256): u256 {
        return u256.xor(a, b);
    }

    public static shr(a: u256, shift: i32): u256 {
        shift &= 255;
        if (shift == 0) return a;

        const w = shift >>> 6; // how many full 64-bit words to drop
        const b = shift & 63; // how many bits to shift within a word

        // Extract the words
        let lo1 = a.lo1;
        let lo2 = a.lo2;
        let hi1 = a.hi1;
        let hi2 = a.hi2;

        // Shift words down by w words
        // For w = 1, move lo2->lo1, hi1->lo2, hi2->hi1, and hi2 = 0
        // For w = 2, move hi1->lo1, hi2->lo2, and zeros in hi1, hi2
        // For w = 3, move hi2->lo1 and zeros in others
        // For w >= 4, everything is zero.
        if (w >= 4) {
            // Shifting by >= 256 bits zeros out everything
            return u256.Zero;
        } else if (w == 3) {
            lo1 = hi2;
            lo2 = 0;
            hi1 = 0;
            hi2 = 0;
        } else if (w == 2) {
            lo1 = hi1;
            lo2 = hi2;
            hi1 = 0;
            hi2 = 0;
        } else if (w == 1) {
            lo1 = lo2;
            lo2 = hi1;
            hi1 = hi2;
            hi2 = 0;
        }

        // Now apply the bit shift b
        if (b > 0) {
            // Bring down bits from the higher word
            const carryLo2 = hi1 << (64 - b);
            const carryLo1 = lo2 << (64 - b);
            const carryHi1 = hi2 << (64 - b);

            lo1 = (lo1 >>> b) | carryLo1;
            lo2 = (lo2 >>> b) | carryLo2;
            hi1 = (hi1 >>> b) | carryHi1;
            hi2 = hi2 >>> b;
        }

        return new u256(lo1, lo2, hi1, hi2);
    }

    /**
     * Increment a u256 value by 1
     * @param value The value to increment
     * @returns The incremented value
     */
    static inc(value: u256): u256 {
        if (u256.eq(value, u256.Max)) {
            throw new Error('SafeMath: increment overflow');
        }

        return value.preInc();
    }

    /**
     * Decrement a u256 value by 1
     * @param value The value to decrement
     * @returns The decremented value
     */
    public static dec(value: u256): u256 {
        if (u256.eq(value, u256.Zero)) {
            throw new Error('SafeMath: decrement overflow');
        }

        return value.preDec();
    }

    /**
     * Approximates the binary logarithm (log2) of a u256 integer.
     * @param x - The input value for which to calculate log2(x).
     * @returns The approximate log2(x) as u256.
     */
    @unsafe
    public static approximateLog2(x: u256): u256 {
        // Count the position of the highest bit set
        let n: u256 = u256.Zero;
        let value = x;

        while (u256.gt(value, u256.One)) {
            value = u256.shr(value, 1);
            n = SafeMath.add(n, u256.One);
        }

        return n;
    }

    public static bitLength256(x: u256): u32 {
        // If zero => bitlength is 0
        if (u256.eq(x, u256.Zero)) {
            return 0;
        }

        // hi2 != 0 => top 64 bits => bit positions 192..255
        if (x.hi2 != 0) {
            const partial: u32 = SafeMath.bitLength64(x.hi2);
            return 192 + partial;
        }

        // hi1 != 0 => next 64 bits => bit positions 128..191
        if (x.hi1 != 0) {
            const partial: u32 = SafeMath.bitLength64(x.hi1);
            return 128 + partial;
        }

        // lo2 != 0 => next 64 bits => bit positions 64..127
        if (x.lo2 != 0) {
            const partial: u32 = SafeMath.bitLength64(x.lo2);
            return 64 + partial;
        }

        // else in lo1 => bit positions 0..63
        return SafeMath.bitLength64(x.lo1);
    }

    public static approxLog(x: u256): u256 {
        // If x == 0 or x == 1, return 0 (ln(1)=0, ln(0) is undefined but we treat as 0)
        if (x.isZero() || u256.eq(x, u256.One)) {
            return u256.Zero;
        }

        // 1) Find bit length
        const bitLen: u32 = SafeMath.bitLength256(x);
        // if bitLen=0 or 1 => that implies x <=1, but we already handled x=0,1 => just safe-check
        if (bitLen <= 1) {
            return u256.Zero;
        }

        // 2) ln(x) ~ (bitLen - 1) * ln(2)
        // We'll store ln(2) in a scaled integer. e.g., LN2_SCALED = 693147 => ln(2)*1e6
        const LN2_SCALED: u64 = 693147; // approximate ln(2)*1e6
        const log2Count: u64 = (bitLen - 1) as u64; // integer part of log2(x)

        // Multiply in pure integer
        return SafeMath.mul(u256.fromU64(log2Count), u256.fromU64(LN2_SCALED));
    }

    /**
     * Return ln(x) * 1e6 for x>1. If x==0 or 1, returns 0.
     * Uses: ln(x) = (k * ln(2)) + ln(1 + r),
     *   where k = floor(log2(x)) and r = (x - 2^k)/2^k
     */
    @unsafe // UNTESTED.
    public static preciseLog(x: u256): u256 {
        if (x.isZero() || u256.eq(x, u256.One)) {
            return u256.Zero;
        }

        const bitLen = SafeMath.bitLength256(x);
        if (bitLen <= 1) {
            return u256.Zero;
        }

        // integer part of log2(x)
        const k: u32 = bitLen - 1;
        const LN2_SCALED = u256.fromU64(693147); // ln(2)*1e6
        const base: u256 = SafeMath.mul(u256.fromU32(k), LN2_SCALED);

        // 2^k
        const pow2k = SafeMath.shl(u256.One, <i32>k);
        const xPrime = SafeMath.sub(x, pow2k); // leftover

        if (xPrime.isZero()) {
            // x was exactly 2^k => no fractional part
            return base;
        }

        // rScaled = ((x - 2^k)*1e6)/2^k
        const xPrimeTimes1e6 = SafeMath.mul(xPrime, u256.fromU64(1_000_000));
        const rScaled = SafeMath.div(xPrimeTimes1e6, pow2k); // 0..999999

        // approximate ln(1 + r)
        const frac: u64 = SafeMath.polyLn1p3(rScaled.toU64());

        return SafeMath.add(base, u256.fromU64(frac));
    }

    public static pow10(exponent: u8): u256 {
        let result: u256 = u256.One;
        for (let i: u8 = 0; i < exponent; i++) {
            result = SafeMath.mul(result, u256.fromU32(10));
        }
        return result;
    }

    /**
     * polyLn1p3: 3-term polynomial for ln(1 + z), with z in [0,1).
     * rScaled = z * 1e6
     * returns (ln(1+z)) in scale=1e6
     */
    // UNTESTED.
    @unsafe
    public static polyLn1p3(rScaled: u64): u64 {
        // term1 = z
        const term1: u64 = rScaled;

        // term2 => z^2/2
        const z2 = term1 * term1; // up to 1e12
        const z2Div = (z2 / 1_000_000) >>> 1; // divide by scale and by 2

        // term3 => z^3/3
        const z3 = z2 * term1; // up to 1e18
        const z3Div = z3 / (1_000_000 * 1_000_000) / 3; // => scale

        // ln(1+z) ~ z - z^2/2 + z^3/3
        return term1 - z2Div + z3Div;
    }

    private static bitLength64(value: u64): u32 {
        if (value == 0) return 0;

        let count: u32 = 0;
        let temp = value;
        while (temp > 0) {
            temp >>>= 1; // logical shift right
            count++;
        }
        return count;
    }

    private static shlSegment(
        segments: u64[],
        segmentShift: i32,
        bitShift: i32,
        bitsPerSegment: i32,
        fillCount: u8,
    ): u64[] {
        const result = new Array<u64>(fillCount).fill(0);

        for (let i = 0; i < segments.length; i++) {
            if (i + segmentShift < segments.length) {
                result[i + segmentShift] |= segments[i] << bitShift;
            }
            if (bitShift != 0 && i + segmentShift + 1 < segments.length) {
                result[i + segmentShift + 1] |= segments[i] >>> (bitsPerSegment - bitShift);
            }
        }

        return result;
    }
}

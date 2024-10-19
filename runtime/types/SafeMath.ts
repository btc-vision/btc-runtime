import { u256 } from 'as-bignum/assembly';

export class SafeMath {
    public static ZERO: u256 = u256.fromU32(0);

    public static add(a: u256, b: u256): u256 {
        const c: u256 = u256.add(a, b);
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

    // Computes (a * b) % modulus with full precision
    public static mulmod(a: u256, b: u256, modulus: u256): u256 {
        if (u256.eq(modulus, u256.Zero)) throw new Error('SafeMath: modulo by zero');

        const mul = SafeMath.mul(a, b);
        return SafeMath.mod(mul, modulus);
    }

    @inline
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
            const r_copy = r;
            r = SafeMath.sub(old_r, SafeMath.mul(quotient, r));
            old_r = r_copy;

            const s_copy = s;
            s = SafeMath.sub(old_s, SafeMath.mul(quotient, s));
            old_s = s_copy;
        }

        return SafeMath.mod(old_s, p);
    }

    public static isEven(a: u256): bool {
        return u256.and(a, u256.One) == u256.Zero;
    }

    public static pow(base: u256, exponent: u256): u256 {
        let result: u256 = u256.One;
        while (exponent > u256.Zero) {
            if (u256.and(exponent, u256.One)) {
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

    @inline
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

    public static min(a: u256, b: u256): u256 {
        return u256.lt(a, b) ? a : b;
    }

    public static max(a: u256, b: u256): u256 {
        return u256.gt(a, b) ? a : b;
    }

    @inline
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

    @inline
    @unsafe
    public static shl(value: u256, shift: i32): u256 {
        if (shift == 0) {
            return value.clone();
        }

        const totalBits = 256;
        const bitsPerSegment = 64;

        // Normalize shift to be within 0-255 range
        shift &= 255;

        if (shift >= totalBits) {
            return new u256(); // Shift size larger than width results in zero
        }

        // Determine how many full 64-bit segments we are shifting
        const segmentShift = (shift / bitsPerSegment) | 0;
        const bitShift = shift % bitsPerSegment;

        const segments = [value.lo1, value.lo2, value.hi1, value.hi2];

        const result = new Array<u64>(4).fill(0);

        for (let i = 0; i < segments.length; i++) {
            if (i + segmentShift < segments.length) {
                result[i + segmentShift] |= segments[i] << bitShift;
            }
            if (bitShift != 0 && i + segmentShift + 1 < segments.length) {
                result[i + segmentShift + 1] |= segments[i] >>> (bitsPerSegment - bitShift);
            }
        }

        return new u256(result[0], result[1], result[2], result[3]);
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

    public static shr(a: u256, b: u32): u256 {
        return u256.shr(a, b);
    }

    /**
     * Increment a u256 value by 1
     * @param value The value to increment
     * @returns The incremented value
     */
    @inline
    static inc(value: u256): u256 {
        return value.preInc();
    }
}

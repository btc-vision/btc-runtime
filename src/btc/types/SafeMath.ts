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

    @inline @unsafe @operator('/')
    static div(a: u256, b: u256): u256 {
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

        let shift = u256.clz(d) - u256.clz(n);
        d = SafeMath.shl(d, shift); // align d with n by shifting left

        for (let i = shift; i >= 0; i--) {
            if (u256.ge(n, d)) {
                n = u256.sub(n, d);
                result = u256.or(result, SafeMath.shl(new u256(1), i));
            }
            d = u256.shr(d, 1); // restore d to original by shifting right
        }

        return result;
    }

    @inline @unsafe
    static shl(value: u256, shift: i32): u256 {
        if (shift == 0) {
            return value.clone();
        }

        let totalBits = 256;
        let bitsPerSegment = 64;

        // Normalize shift to be within 0-255 range
        shift &= 255;

        if (shift >= totalBits) {
            return new u256(); // Shift size larger than width results in zero
        }

        // Determine how many full 64-bit segments we are shifting
        let segmentShift = shift / bitsPerSegment | 0;
        let bitShift = shift % bitsPerSegment;

        let segments = [
            value.lo1, value.lo2,
            value.hi1, value.hi2,
        ];

        let result = new Array<u64>(4).fill(0);

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

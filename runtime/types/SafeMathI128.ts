import { i128 } from '@btc-vision/as-bignum/assembly';
import { Revert } from './Revert';

export class SafeMathI128 {
    public static readonly ZERO: i128 = i128.fromI32(0);
    public static readonly ONE: i128 = i128.fromI32(1);
    public static readonly NEG_ONE: i128 = i128.fromI32(-1);

    public static readonly MIN: i128 = i128.Min;
    public static readonly MAX: i128 = i128.Max;

    /**
     * Safe addition for i128.
     * Throws if (a + b) overflows or underflows the signed 128-bit range.
     */
    public static add(a: i128, b: i128): i128 {
        const c = i128.add(a, b);

        // Overflow check for 2's complement:
        // If a and b have the same sign, but c differs, overflow occurred.
        // We can detect sign mismatch using ((a ^ c) & (b ^ c)) < 0
        // (i.e., the sign bit is set in that expression).
        if (((a ^ c) & (b ^ c)).isNeg()) {
            throw new Revert('SafeMathI128: addition overflow');
        }

        return c;
    }

    /**
     * Safe subtraction for i128.
     * Throws if (a - b) overflows or underflows the signed 128-bit range.
     */
    public static sub(a: i128, b: i128): i128 {
        const c = i128.sub(a, b);

        // Subtraction is (a + (-b)). We can do a direct check like:
        // If (a ^ b) & (a ^ c) has sign bit set => overflow.
        if (((a ^ b) & (a ^ c)).isNeg()) {
            throw new Revert('SafeMathI128: subtraction overflow');
        }

        return c;
    }

    /*public static mul(a: i128, b: i128): i128 {
        // Quick check: if either is ZERO, product is ZERO => no overflow
        if (a == SafeMathI128.ZERO || b == SafeMathI128.ZERO) {
            return SafeMathI128.ZERO;
        }

        let c = i128.mul(a, b);

        // Check overflow: c / b should be exactly a (if b != 0).
        // Also watch for the i128 edge case: MIN * -1 => possible overflow if not representable.
        // We'll rely on the division check:
        if (b != SafeMathI128.ZERO) {
            let divCheck = i128.div(c, b);
            if (divCheck != a) {
                throw new Revert('SafeMathI128: multiplication overflow');
            }
        }

        return c;
    }*/

    /*public static div(a: i128, b: i128): i128 {
        if (b == SafeMathI128.ZERO) {
            throw new Revert('SafeMathI128: division by zero');
        }

        // Check i128 edge case: MIN / -1 => possible overflow if no corresponding positive.
        if (a == SafeMathI128.MIN && b == SafeMathI128.NEG_ONE) {
            throw new Revert('SafeMathI128: division overflow (MIN / -1)');
        }

        return i128.div(a, b);
    }*/

    /*public static mod(a: i128, b: i128): i128 {
        if (b == SafeMathI128.ZERO) {
            throw new Revert('SafeMathI128: modulo by zero');
        }
        // Similar edge case as division:
        if (a == SafeMathI128.MIN && b == SafeMathI128.NEG_ONE) {
            // Some implementations might treat MIN % -1 == 0,
            // but if the library doesn't, you may handle it similarly to division.
            // We'll assume we throw to be safe:
            throw new Revert('SafeMathI128: modulo overflow (MIN % -1)');
        }

        // Use i128.rem, i128.mod, or the operator as appropriate.
        return i128.rem(a, b);
    }*/

    /**
     * Increment an i128 by 1 with overflow check.
     */
    public static inc(value: i128): i128 {
        if (value == SafeMathI128.MAX) {
            throw new Revert('SafeMathI128: inc overflow');
        }

        return SafeMathI128.add(value, SafeMathI128.ONE);
    }

    /**
     * Decrement an i128 by 1 with underflow check.
     */
    public static dec(value: i128): i128 {
        if (value == SafeMathI128.MIN) {
            throw new Revert('SafeMathI128: dec underflow');
        }

        return SafeMathI128.sub(value, SafeMathI128.ONE);
    }

    /**
     * Return the absolute value of x, throwing if x == MIN (since |MIN| might not be representable).
     */
    public static abs(x: i128): i128 {
        if (x.isNeg()) {
            // If x == MIN, -x can overflow.
            if (x == SafeMathI128.MIN) {
                throw new Revert('SafeMathI128: abs overflow on MIN');
            }
            return x.neg();
        }
        return x;
    }

    /**
     * Return the negation of x, throwing if x == MIN.
     */
    public static neg(x: i128): i128 {
        if (x == SafeMathI128.MIN) {
            throw new Revert('SafeMathI128: neg overflow on MIN');
        }
        return x.neg();
    }

    /**
     * Returns the smaller of two i128s.
     */
    public static min(a: i128, b: i128): i128 {
        return i128.lt(a, b) ? a : b;
    }

    /**
     * Returns the larger of two i128s.
     */
    public static max(a: i128, b: i128): i128 {
        return i128.gt(a, b) ? a : b;
    }
}

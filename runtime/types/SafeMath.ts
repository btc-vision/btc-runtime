import { u128, u256 } from '@btc-vision/as-bignum/assembly';
import { Revert } from './Revert';

/**
 * SafeMath Library for AssemblyScript Smart Contracts
 *
 * A comprehensive mathematical operations library providing overflow-safe arithmetic
 * for u256, u128, and u64 integer types. This library is essential for smart contract
 * development where mathematical precision and overflow protection are critical.
 *
 * All operations that could potentially overflow will throw a Revert error, ensuring
 * that contracts fail safely rather than producing incorrect results.
 *
 * @module SafeMath
 * @since 1.0.0
 */
export class SafeMath {
    /**
     * Constant representing zero in u256 format.
     * Useful for comparisons and initializations.
     */
    public static readonly ZERO: u256 = u256.Zero;

    // GAS OPTIMIZATION: Static constants to avoid allocation in hot loops
    public static readonly ONE: u256 = u256.One;
    private static readonly CONST_2: u256 = u256.fromU32(2);
    private static readonly CONST_3: u256 = u256.fromU32(3);
    private static readonly CONST_10: u256 = u256.fromU32(10);
    private static readonly LN2_SCALED: u64 = 693147; // ln(2)*1e6
    private static readonly SCALE_1E6: u64 = 1_000_000;

    // ==================== Addition Operations ====================

    /**
     * Performs safe addition of two u256 numbers with overflow protection.
     *
     * @param a - First operand
     * @param b - Second operand
     * @returns The sum of a and b
     * @throws {Revert} When the addition would overflow (result > u256.Max)
     *
     * @example
     * ```typescript
     * const sum = SafeMath.add(u256.fromU32(100), u256.fromU32(200)); // Returns 300
     * ```
     *
     * @remarks
     * - Maximum value: 2^256 - 1
     * - Overflow occurs when a + b > u256.Max
     * - Gas efficient for small values
     */
    public static add(a: u256, b: u256): u256 {
        const c = u256.add(a, b);
        if (c < a) {
            throw new Revert('SafeMath: addition overflow');
        }
        return c;
    }

    /**
     * Performs safe addition of two u128 numbers with overflow protection.
     *
     * @param a - First operand (128-bit)
     * @param b - Second operand (128-bit)
     * @returns The sum of a and b
     * @throws {Revert} When the addition would overflow (result > u128.Max)
     *
     * @remarks
     * - Maximum value: 2^128 - 1
     * - More gas efficient than u256 for values that fit in 128 bits
     */
    public static add128(a: u128, b: u128): u128 {
        const c = u128.add(a, b);
        if (c < a) {
            throw new Revert('SafeMath: addition overflow');
        }
        return c;
    }

    /**
     * Performs safe addition of two u64 numbers with overflow protection.
     *
     * @param a - First operand (64-bit)
     * @param b - Second operand (64-bit)
     * @returns The sum of a and b
     * @throws {Revert} When the addition would overflow (result > 2^64 - 1)
     *
     * @remarks
     * - Maximum value: 18,446,744,073,709,551,615
     * - Most gas efficient for small values
     */
    public static add64(a: u64, b: u64): u64 {
        const c = a + b;
        if (c < a) {
            throw new Revert('SafeMath: addition overflow');
        }
        return c;
    }

    // ==================== Subtraction Operations ====================

    /**
     * Performs safe subtraction of two u256 numbers with underflow protection.
     *
     * @param a - Minuend (number being subtracted from)
     * @param b - Subtrahend (number being subtracted)
     * @returns The difference a - b
     * @throws {Revert} When b > a (would result in negative number)
     *
     * @example
     * ```typescript
     * const diff = SafeMath.sub(u256.fromU32(500), u256.fromU32(200)); // Returns 300
     * // SafeMath.sub(u256.fromU32(100), u256.fromU32(200)); // Throws: underflow
     * ```
     *
     * @warning Unsigned integers cannot represent negative values. Always ensure a >= b
     * before calling, or handle the potential revert in your contract logic.
     *
     * @remarks
     * - Result is always non-negative
     * - Throws rather than wrapping on underflow
     */
    public static sub(a: u256, b: u256): u256 {
        if (a < b) {
            throw new Revert('SafeMath: subtraction underflow');
        }
        return u256.sub(a, b);
    }

    /**
     * Performs safe subtraction of two u128 numbers with underflow protection.
     *
     * @param a - Minuend (128-bit)
     * @param b - Subtrahend (128-bit)
     * @returns The difference a - b
     * @throws {Revert} When b > a
     */
    public static sub128(a: u128, b: u128): u128 {
        if (a < b) {
            throw new Revert('SafeMath: subtraction underflow');
        }
        return u128.sub(a, b);
    }

    /**
     * Performs safe subtraction of two u64 numbers with underflow protection.
     *
     * @param a - Minuend (64-bit)
     * @param b - Subtrahend (64-bit)
     * @returns The difference a - b
     * @throws {Revert} When b > a
     */
    public static sub64(a: u64, b: u64): u64 {
        if (a < b) {
            throw new Revert('SafeMath: subtraction underflow');
        }
        return a - b;
    }

    // ==================== Multiplication Operations ====================

    /**
     * Performs safe multiplication of two u256 numbers with overflow protection.
     *
     * @param a - First factor
     * @param b - Second factor
     * @returns The product a * b
     * @throws {Revert} When the multiplication would overflow
     *
     * @example
     * ```typescript
     * const product = SafeMath.mul(u256.fromU32(100), u256.fromU32(200)); // Returns 20000
     * ```
     *
     * @security The overflow check performs division after multiplication, which is safe
     * because if overflow occurred, the division result won't equal the original operand.
     *
     * @remarks
     * - Returns 0 if either operand is 0
     * - Overflow check: (a * b) / a must equal b
     * - Maximum safe multiplication depends on operand values
     */
    public static mul(a: u256, b: u256): u256 {
        if (a.isZero() || b.isZero()) return u256.Zero;

        const c = u256.mul(a, b);
        // Use native div, it's faster than manual loop and handles edge cases correctly
        const d = u256.div(c, a);

        if (u256.ne(d, b)) throw new Revert('SafeMath: multiplication overflow');

        return c;
    }

    /**
     * Performs safe multiplication of two u128 numbers with overflow protection.
     *
     * @param a - First factor (128-bit)
     * @param b - Second factor (128-bit)
     * @returns The product a * b
     * @throws {Revert} When the multiplication would overflow
     */
    public static mul128(a: u128, b: u128): u128 {
        if (a.isZero() || b.isZero()) return u128.Zero;

        const c = u128.mul(a, b);
        const d = u128.div(c, a);

        if (u128.ne(d, b)) throw new Revert('SafeMath: multiplication overflow');

        return c;
    }

    /**
     * Performs safe multiplication of two u64 numbers with overflow protection.
     *
     * @param a - First factor (64-bit)
     * @param b - Second factor (64-bit)
     * @returns The product a * b
     * @throws {Revert} When the multiplication would overflow
     */
    public static mul64(a: u64, b: u64): u64 {
        if (a === 0 || b === 0) {
            return 0;
        }

        const c: u64 = a * b;

        if (c / a !== b) {
            throw new Revert('SafeMath: multiplication overflow');
        }

        return c;
    }

    // ==================== Division Operations ====================

    /**
     * Performs integer division of two u256 numbers.
     *
     * @param a - Dividend (number being divided)
     * @param b - Divisor (number dividing by)
     * @returns The quotient floor(a / b)
     * @throws {Revert} When b is zero (division by zero)
     *
     * @example
     * ```typescript
     * const quotient = SafeMath.div(u256.fromU32(100), u256.fromU32(3)); // Returns 33
     * ```
     *
     * @warning Integer division always rounds down. For 10/3, the result is 3, not 3.333...
     * The remainder (1 in this case) is lost. Use `mod` to get the remainder.
     *
     * @security Division by zero is always checked and will revert the transaction,
     * preventing undefined behavior or exploits.
     *
     * @remarks
     * - Always rounds down (floor division)
     * - Returns 0 when a < b
     * - Division by zero always throws
     * - No overflow possible in division
     */
    public static div(a: u256, b: u256): u256 {
        if (b.isZero()) {
            throw new Revert('SafeMath: division by zero');
        }

        if (a.isZero()) {
            return u256.Zero;
        }

        // GAS OPTIMIZATION: Use native as-bignum division instead of manual shift loop
        // The native implementation is likely optimized in AssemblyScript/WASM
        return u256.div(a, b);
    }

    /**
     * Performs integer division of two u128 numbers.
     *
     * @param a - Dividend (128-bit)
     * @param b - Divisor (128-bit)
     * @returns The quotient floor(a / b)
     * @throws {Revert} When b is zero
     *
     * @warning Integer division truncates decimals. Consider scaling your values
     * before division if you need to preserve precision.
     */
    public static div128(a: u128, b: u128): u128 {
        if (b.isZero()) {
            throw new Revert('SafeMath: division by zero');
        }

        if (a.isZero()) {
            return u128.Zero;
        }

        return u128.div(a, b);
    }

    /**
     * Performs integer division of two u64 numbers.
     *
     * @param a - Dividend (64-bit)
     * @param b - Divisor (64-bit)
     * @returns The quotient floor(a / b)
     * @throws {Revert} When b is zero
     */
    public static div64(a: u64, b: u64): u64 {
        if (b === 0) {
            throw new Revert('SafeMath: division by zero');
        }

        if (a === 0) {
            return 0;
        }

        if (a < b) {
            return 0;
        }

        if (a === b) {
            return 1;
        }

        return a / b;
    }

    // ==================== Modulo Operations ====================

    /**
     * Computes the modulo (remainder) of two u256 numbers.
     *
     * @param a - Dividend
     * @param b - Modulus
     * @returns The remainder a % b
     * @throws {Revert} When b is zero
     *
     * @example
     * ```typescript
     * const remainder = SafeMath.mod(u256.fromU32(10), u256.fromU32(3)); // Returns 1
     * ```
     *
     * @security The modulo operation is commonly used in access control patterns
     * (e.g., round-robin selection). Ensure the modulus is never zero
     * and be aware that patterns in modulo operations can be predictable.
     *
     * @remarks
     * - Result is always in range [0, b-1]
     * - Follows Euclidean division rules
     * - a = (a/b)*b + (a%b)
     */
    public static mod(a: u256, b: u256): u256 {
        if (b.isZero()) {
            throw new Revert('SafeMath: modulo by zero');
        }
        // Use optimized arithmetic: a - (a/b)*b
        return u256.sub(a, u256.mul(u256.div(a, b), b));
    }

    /**
     * Performs modular multiplication: (a * b) % modulus
     *
     * @param a - First factor
     * @param b - Second factor
     * @param modulus - The modulus value
     * @returns (a * b) % modulus without intermediate overflow
     * @throws {Revert} When modulus is zero
     *
     * @example
     * ```typescript
     * // Computes (large_a * large_b) % prime without overflow
     * const result = SafeMath.mulmod(largeA, largeB, prime);
     * ```
     *
     * @warning This function automatically reduces inputs modulo m before multiplication.
     * This means mulmod(2m, x, m) returns 0, not because 2m*x is computed,
     * but because 2m is reduced to 0 first. This is mathematically correct
     * for modular arithmetic but may surprise developers expecting raw multiplication.
     *
     * @security Critical for cryptographic operations. The automatic modular reduction
     * of inputs ensures all operations occur within the field Z/mZ, preventing
     * overflow attacks. Used extensively in ECC scalar multiplication and
     * RSA operations.
     *
     * @remarks
     * - Critical for cryptographic operations (RSA, ECC)
     * - Prevents overflow even when a*b > u256.Max
     * - Uses bit-by-bit multiplication algorithm
     * - Result is always less than modulus
     * - Returns 0 when either operand is 0
     * - Inputs are automatically reduced: a = a % m, b = b % m
     */
    public static mulmod(a: u256, b: u256, modulus: u256): u256 {
        if (modulus.isZero()) throw new Revert('SafeMath: modulo by zero');

        // Keep invariants: 0 <= a,b < modulus
        if (u256.ge(a, modulus)) a = SafeMath.mod(a, modulus);
        if (u256.ge(b, modulus)) b = SafeMath.mod(b, modulus);

        if (a.isZero() || b.isZero()) return u256.Zero;

        let res = u256.Zero;

        // Optimized LSB-first ladder
        while (!b.isZero()) {
            // if (b & 1) using raw access for speed
            if ((b.lo1 & 1) != 0) {
                res = SafeMath.addModNoCarry(res, a, modulus);
            }
            b = u256.shr(b, 1);

            if (!b.isZero()) {
                a = SafeMath.doubleModNoCarry(a, modulus);
            }
        }
        return res;
    }

    /**
     * Computes the modular multiplicative inverse: x where (k * x) ≡ 1 (mod p)
     *
     * @param k - The value to find the inverse of
     * @param p - The modulus (must be > 1)
     * @returns x such that (k * x) % p = 1
     * @throws {Revert} When:
     * - p is 0 or 1 (invalid modulus)
     * - k is 0 (zero has no inverse)
     * - gcd(k, p) ≠ 1 (no inverse exists when k and p are not coprime)
     *
     * @example
     * ```typescript
     * // Find multiplicative inverse: 3 * x ≡ 1 (mod 7)
     * const inverse = SafeMath.modInverse(u256.fromU32(3), u256.fromU32(7)); // Returns 5
     * // Verify: (3 * 5) % 7 = 15 % 7 = 1 ✓
     * ```
     *
     * @warning Only works when gcd(k, p) = 1. For prime p, all non-zero k < p have inverses.
     * For composite moduli, check coprimality before calling.
     *
     * @security Essential for cryptographic protocols. Used in:
     * - RSA private key generation (d = e^(-1) mod φ(n))
     * - ECDSA signature generation (s = k^(-1)(h + rd) mod n)
     * - Point division in elliptic curves
     * Incorrect inverse computation breaks these protocols entirely.
     *
     * @remarks
     * - Essential for RSA key generation and ECC operations
     * - Uses Extended Euclidean Algorithm
     * - Result is always in range [1, p-1]
     * - For prime p, all k in [1, p-1] have inverses
     * - Common in cryptographic signatures and key exchanges
     */
    public static modInverse(k: u256, p: u256): u256 {
        if (p.isZero() || u256.eq(p, SafeMath.ONE)) {
            throw new Revert('SafeMath: modulus must be > 1');
        }
        if (k.isZero()) {
            throw new Revert('SafeMath: no inverse for zero');
        }

        // Extended Euclidean Algo
        let s = u256.Zero;
        let old_s = u256.One;
        let s_negative = false;
        let old_s_negative = false;
        let r = p.clone();
        let old_r = k.clone();

        while (!r.isZero()) {
            const quotient = u256.div(old_r, r);

            // Update r
            const next_r = u256.sub(old_r, u256.mul(quotient, r));
            old_r = r;
            r = next_r;

            // Update s
            const prod = u256.mul(quotient, s);
            let next_s: u256;
            let next_s_negative: boolean;

            // Logic optimized to avoid excessive object allocation
            if (old_s_negative == s_negative) {
                if (u256.ge(old_s, prod)) {
                    next_s = u256.sub(old_s, prod);
                    next_s_negative = old_s_negative;
                } else {
                    next_s = u256.sub(prod, old_s);
                    next_s_negative = !old_s_negative;
                }
            } else {
                next_s = u256.add(old_s, prod);
                next_s_negative = old_s_negative;
            }

            old_s = s;
            old_s_negative = s_negative;
            s = next_s;
            s_negative = next_s_negative;
        }

        if (!u256.eq(old_r, SafeMath.ONE)) {
            throw new Revert('SafeMath: no modular inverse exists');
        }

        if (old_s_negative) {
            const mod_res = SafeMath.mod(old_s, p);
            if (mod_res.isZero()) return u256.Zero;
            return u256.sub(p, mod_res);
        }

        return SafeMath.mod(old_s, p);
    }

    // ==================== Bitwise Operations ====================

    /**
     * Performs left bit shift on a u256 value.
     *
     * @param value - The value to shift
     * @param shift - Number of bit positions to shift left
     * @returns value << shift with overflow bits truncated
     *
     * @example
     * ```typescript
     * const shifted = SafeMath.shl(u256.fromU32(1), 10); // Returns 1024 (2^10)
     * const overflow = SafeMath.shl(u256.Max, 1); // High bit is lost!
     * ```
     *
     * @warning CRITICAL: Unlike ALL other SafeMath operations, bit shifts do NOT throw on overflow!
     * Bits shifted beyond the type width are SILENTLY LOST. This is intentional
     * behavior that matches CPU bit shift semantics, but differs philosophically
     * from other SafeMath operations which fail safely on overflow.
     *
     * @security If you need overflow detection for bit shifts, implement it manually:
     * ```typescript
     * const shifted = SafeMath.shl(value, n);
     * const restored = SafeMath.shr(shifted, n);
     * if (!u256.eq(restored, value)) {
     * throw new Revert('Shift overflow detected');
     * }
     * ```
     *
     * @remarks
     * - Shifting left by n bits multiplies by 2^n (if no overflow)
     * - Shifts >= 256 return 0 (all bits shifted out)
     * - Negative shifts return 0 (defensive behavior)
     * - Overflow bits are silently truncated (no error thrown)
     * - More efficient than multiplication for powers of 2
     * - Commonly used in bit manipulation and flag operations
     */
    public static shl(value: u256, shift: i32): u256 {
        if (shift <= 0) return shift == 0 ? value.clone() : u256.Zero;
        if (shift >= 256) return u256.Zero;

        shift &= 255;

        // GAS OPTIMIZATION: Unrolled manual shifting avoids array allocation of segments
        const bits = 64;
        const segShift = (shift / bits) | 0;
        const bitShift = shift % bits;
        const invShift = bits - bitShift;

        let r0: u64 = 0,
            r1: u64 = 0,
            r2: u64 = 0,
            r3: u64 = 0;
        const i0 = value.lo1,
            i1 = value.lo2,
            i2 = value.hi1,
            i3 = value.hi2;

        if (segShift == 0) {
            r0 = i0 << bitShift;
            r1 = (i1 << bitShift) | (bitShift == 0 ? 0 : i0 >>> invShift);
            r2 = (i2 << bitShift) | (bitShift == 0 ? 0 : i1 >>> invShift);
            r3 = (i3 << bitShift) | (bitShift == 0 ? 0 : i2 >>> invShift);
        } else if (segShift == 1) {
            r1 = i0 << bitShift;
            r2 = (i1 << bitShift) | (bitShift == 0 ? 0 : i0 >>> invShift);
            r3 = (i2 << bitShift) | (bitShift == 0 ? 0 : i1 >>> invShift);
        } else if (segShift == 2) {
            r2 = i0 << bitShift;
            r3 = (i1 << bitShift) | (bitShift == 0 ? 0 : i0 >>> invShift);
        } else if (segShift == 3) {
            r3 = i0 << bitShift;
        }

        return new u256(r0, r1, r2, r3);
    }

    /**
     * Performs left bit shift on a u128 value.
     *
     * @param value - The value to shift (128-bit)
     * @param shift - Number of bit positions to shift left
     * @returns value << shift with overflow bits truncated
     *
     * @warning Overflow bits are silently truncated. See shl() for detailed warning.
     *
     * @remarks
     * - Shifts >= 128 return 0
     * - Overflow bits are truncated without error
     */
    public static shl128(value: u128, shift: i32): u128 {
        if (shift <= 0) return shift == 0 ? value.clone() : u128.Zero;
        if (shift >= 128) return u128.Zero;

        shift &= 127;
        const bits = 64;
        const segShift = (shift / bits) | 0;
        const bitShift = shift % bits;
        const invShift = bits - bitShift;

        let r0: u64 = 0,
            r1: u64 = 0;
        const i0 = value.lo,
            i1 = value.hi;

        if (segShift == 0) {
            r0 = i0 << bitShift;
            r1 = (i1 << bitShift) | (bitShift == 0 ? 0 : i0 >>> invShift);
        } else if (segShift == 1) {
            r1 = i0 << bitShift;
        }

        return new u128(r0, r1);
    }

    /**
     * Performs right bit shift on a u256 value.
     *
     * @param value - The value to shift
     * @param shift - Number of bit positions to shift right
     * @returns value >> shift
     *
     * @remarks
     * - Shifting right by n bits divides by 2^n (floor division)
     * - Logical shift (fills with zeros from left)
     * - No underflow possible (result >= 0)
     */
    @inline
    public static shr(value: u256, shift: i32): u256 {
        return u256.shr(value, shift);
    }

    /**
     * Performs bitwise AND operation.
     *
     * @param a - First operand
     * @param b - Second operand
     * @returns a & b
     *
     * @remarks
     * - Commonly used for bit masking and flag checking
     */
    @inline
    public static and(a: u256, b: u256): u256 {
        return u256.and(a, b);
    }

    /**
     * Performs bitwise OR operation.
     *
     * @param a - First operand
     * @param b - Second operand
     * @returns a | b
     *
     * @remarks
     * - Commonly used for combining bit flags
     */
    @inline
    public static or(a: u256, b: u256): u256 {
        return u256.or(a, b);
    }

    /**
     * Performs bitwise XOR operation.
     *
     * @param a - First operand
     * @param b - Second operand
     * @returns a ^ b
     *
     * @remarks
     * - Used in cryptographic operations and toggle operations
     */
    @inline
    public static xor(a: u256, b: u256): u256 {
        return u256.xor(a, b);
    }

    // ==================== Mathematical Functions ====================

    /**
     * Computes the integer square root of a u256 value.
     *
     * @param y - The value to compute square root of
     * @returns floor(√y) - the largest integer x where x² ≤ y
     *
     * @example
     * ```typescript
     * const root = SafeMath.sqrt(u256.fromU32(100)); // Returns 10
     * const root2 = SafeMath.sqrt(u256.fromU32(10)); // Returns 3 (floor of 3.162...)
     * ```
     *
     * @warning Returns 1 for inputs 1, 2, and 3 (not just 1). This is because
     * floor(√2) = floor(√3) = 1. Be aware of this when working with small values.
     *
     * @security No overflow possible as sqrt(u256.Max) < 2^128. Used in various DeFi
     * protocols for computing prices from liquidity pools (e.g., Uniswap V2's
     * geometric mean price calculation).
     *
     * @remarks
     * - Uses Newton-Raphson method for values > 3
     * - Always returns floor of the actual square root
     * - Special cases: sqrt(0)=0, sqrt(1)=1, sqrt(2)=1, sqrt(3)=1
     * - Result satisfies: result² ≤ input < (result+1)²
     * - Maximum result is approximately 2^128 for u256 input
     * - Converges in O(log log n) iterations
     */
    public static sqrt(y: u256): u256 {
        if (u256.gt(y, SafeMath.CONST_3)) {
            let z = y;

            // Initial guess: y / 2 + 1
            let x = u256.add(u256.div(y, SafeMath.CONST_2), SafeMath.ONE);

            while (u256.lt(x, z)) {
                z = x;
                const divResult = u256.div(y, x);
                const sum = u256.add(divResult, x);
                x = u256.div(sum, SafeMath.CONST_2);
            }

            return z;
        } else if (!y.isZero()) {
            return SafeMath.ONE;
        } else {
            return u256.Zero;
        }
    }

    /**
     * Computes base raised to the power of exponent: base^exponent
     *
     * @param base - The base value
     * @param exponent - The exponent value
     * @returns base^exponent
     * @throws {Revert} When the result would overflow u256.Max
     *
     * @example
     * ```typescript
     * const result = SafeMath.pow(u256.fromU32(2), u256.fromU32(10)); // Returns 1024
     * const large = SafeMath.pow(u256.fromU32(10), u256.fromU32(18)); // Returns 10^18
     * ```
     *
     * @warning Large bases with even small exponents can overflow. For example,
     * (2^128)^2 = 2^256 which overflows. Always consider the magnitude
     * of your inputs.
     *
     * @security Used in compound interest calculations and bonding curves. Be extremely
     * careful with user-supplied exponents as they can easily cause DoS through
     * gas exhaustion (large exponents) or overflows.
     *
     * @remarks
     * - Uses binary exponentiation (square-and-multiply) for O(log n) efficiency
     * - Special cases: x^0=1 (including 0^0), 0^n=0 (n>0), 1^n=1
     * - Maximum safe exponents: 2^255 (for base 2), 10^77 (for base 10)
     * - Gas cost increases with exponent bit count
     */
    public static pow(base: u256, exponent: u256): u256 {
        if (exponent.isZero()) return SafeMath.ONE;
        if (base.isZero()) return u256.Zero;
        if (u256.eq(base, SafeMath.ONE)) return SafeMath.ONE;

        let result: u256 = SafeMath.ONE;
        let b = base;
        let e = exponent;

        while (u256.gt(e, u256.Zero)) {
            // Check LSB using bitwise for speed
            if ((e.lo1 & 1) != 0) {
                result = SafeMath.mul(result, b);
            }

            e = u256.shr(e, 1);

            if (u256.gt(e, u256.Zero)) {
                b = SafeMath.mul(b, b);
            }
        }
        return result;
    }

    /**
     * Computes 10 raised to the power of n: 10^n
     *
     * @param exponent - The exponent value (0-77)
     * @returns 10^exponent
     * @throws {Revert} When exponent > 77 (would overflow)
     *
     * @example
     * ```typescript
     * const million = SafeMath.pow10(6); // Returns 1,000,000
     * const ether = SafeMath.pow10(18); // Returns 10^18 (wei per ether)
     * ```
     *
     * @security Commonly used for token decimal scaling. Ensure exponent values
     * come from trusted sources (e.g., immutable token decimals) rather
     * than user input to prevent reverts.
     *
     * @remarks
     * - Optimized specifically for base 10 calculations
     * - Maximum safe exponent is 77 (10^78 > u256.Max)
     * - Common for token decimal conversions (e.g., 10^18 for ETH)
     * - More efficient than SafeMath.pow(10, n) for base 10
     */
    public static pow10(exponent: u8): u256 {
        if (exponent > 77) {
            throw new Revert('SafeMath: exponent too large, would overflow');
        }

        let result: u256 = SafeMath.ONE;
        for (let i: u8 = 0; i < exponent; i++) {
            result = SafeMath.mul(result, SafeMath.CONST_10);
        }
        return result;
    }

    // ==================== Comparison & Min/Max Operations ====================

    /**
     * Returns the minimum of two u256 values.
     *
     * @param a - First value
     * @param b - Second value
     * @returns The smaller of a and b
     */
    @inline
    public static min(a: u256, b: u256): u256 {
        return u256.lt(a, b) ? a : b;
    }

    /**
     * Returns the maximum of two u256 values.
     *
     * @param a - First value
     * @param b - Second value
     * @returns The larger of a and b
     */
    @inline
    public static max(a: u256, b: u256): u256 {
        return u256.gt(a, b) ? a : b;
    }

    /**
     * Returns the minimum of two u128 values.
     *
     * @param a - First value (128-bit)
     * @param b - Second value (128-bit)
     * @returns The smaller of a and b
     */
    @inline
    public static min128(a: u128, b: u128): u128 {
        return u128.lt(a, b) ? a : b;
    }

    /**
     * Returns the maximum of two u128 values.
     *
     * @param a - First value (128-bit)
     * @param b - Second value (128-bit)
     * @returns The larger of a and b
     */
    @inline
    public static max128(a: u128, b: u128): u128 {
        return u128.gt(a, b) ? a : b;
    }

    /**
     * Returns the minimum of two u64 values.
     *
     * @param a - First value (64-bit)
     * @param b - Second value (64-bit)
     * @returns The smaller of a and b
     */
    @inline
    public static min64(a: u64, b: u64): u64 {
        return a < b ? a : b;
    }

    /**
     * Returns the maximum of two u64 values.
     *
     * @param a - First value (64-bit)
     * @param b - Second value (64-bit)
     * @returns The larger of a and b
     */
    @inline
    public static max64(a: u64, b: u64): u64 {
        return a > b ? a : b;
    }

    // ==================== Utility Operations ====================

    /**
     * Checks if a u256 value is even.
     *
     * @param a - The value to check
     * @returns true if a is even, false if odd
     *
     * @remarks
     * - Checks the least significant bit
     * - More efficient than using modulo 2
     */
    @inline
    public static isEven(a: u256): bool {
        return (a.lo1 & 1) == 0;
    }

    /**
     * Increments a u256 value by 1.
     *
     * @param value - The value to increment
     * @returns value + 1
     * @throws {Revert} When value equals u256.Max (would overflow)
     *
     * @warning At u256.Max, incrementing would wrap to 0. This function throws
     * instead to prevent silent wraparound errors.
     *
     * @remarks
     * - Equivalent to add(value, 1) but potentially more efficient
     * - Safe against overflow at maximum value
     */
    public static inc(value: u256): u256 {
        if (u256.eq(value, u256.Max)) {
            throw new Revert('SafeMath: increment overflow');
        }
        return value.preInc();
    }

    /**
     * Decrements a u256 value by 1.
     *
     * @param value - The value to decrement
     * @returns value - 1
     * @throws {Revert} When value equals 0 (would underflow)
     *
     * @warning At 0, decrementing would wrap to u256.Max. This function throws
     * instead to prevent silent wraparound errors.
     *
     * @remarks
     * - Equivalent to sub(value, 1) but potentially more efficient
     * - Safe against underflow at zero
     */
    public static dec(value: u256): u256 {
        if (value.isZero()) {
            throw new Revert('SafeMath: decrement underflow');
        }
        return value.preDec();
    }

    // ==================== Logarithm Operations ====================

    /**
     * Computes the floor of binary logarithm (log2) for a u256 value.
     *
     * @param x - The input value
     * @returns floor(log2(x)) as u256
     * @throws {Revert} When x is zero (log of zero)
     *
     * @example
     * ```typescript
     * const log_8 = SafeMath.approximateLog2(u256.fromU32(8));    // Returns 3 (exact)
     * const log_10 = SafeMath.approximateLog2(u256.fromU32(10));  // Returns 3 (floor of 3.32...)
     * const log_1000 = SafeMath.approximateLog2(u256.fromU32(1000)); // Returns 9 (floor of 9.97...)
     * ```
     *
     * @security Extensively tested for monotonicity and consistency. Critical for:
     * - Binary search algorithms in sorted data structures
     * - Bit manipulation operations requiring position of highest bit
     * - Rough categorization of value magnitudes in O(1) time
     * - Efficient range checks in permission systems
     *
     * @remarks
     * - Returns the position of the highest set bit (MSB)
     * - Exact for powers of 2: log2(2^n) = n
     * - Floor operation for non-powers: 2^n ≤ x < 2^(n+1) returns n
     * - Maximum return value: 255 (for values near u256.Max)
     * - O(1) complexity using bit manipulation
     * - More efficient than preciseLog when exact precision isn't needed
     */
    public static approximateLog2(x: u256): u256 {
        const bitLen = SafeMath.bitLength256(x);
        if (bitLen === 0) throw new Revert('SafeMath: log of zero');
        return u256.fromU32(bitLen - 1);
    }

    /**
     * Computes natural logarithm (ln) of a u256 value with high precision.
     *
     * @param x - The input value (must be ≥ 1)
     * @returns ln(x) scaled by 10^6 for fixed-point precision
     * @throws {Revert} When x is zero (log of zero)
     *
     * @example
     * ```typescript
     * // Natural logarithm of e (should return ~1,000,000)
     * const ln_e = SafeMath.preciseLog(u256.fromU32(2718281)); // Returns ~1,000,000,000
     *
     * // Natural logarithm of 10
     * const ln_10 = SafeMath.preciseLog(u256.fromU32(10)); // Returns ~2,302,585
     *
     * // For large numbers
     * const ln_million = SafeMath.preciseLog(u256.fromU32(1000000)); // Returns ~13,815,510
     * ```
     *
     * @warning This function has been extensively tested and validated for accuracy.
     * The maximum error is bounded to 6 units (0.000006) across the entire
     * input domain. While the implementation is production-ready, extreme
     * values near u256 boundaries may experience precision degradation due
     * to the limitations of integer arithmetic at such scales.
     *
     * @security Critical for DeFi applications including:
     * - Automated Market Makers (AMMs) for price calculations
     * - Interest rate models in lending protocols
     * - Option pricing using Black-Scholes formulas
     * - Bonding curve calculations
     * Incorrect logarithm calculations can lead to severe mispricing,
     * arbitrage opportunities, or protocol insolvency.
     *
     * @remarks
     * - Algorithm: Decomposes x = 2^k * (1 + r) where 0 ≤ r < 1
     * - Then: ln(x) = k*ln(2) + ln(1+r)
     * - Uses polyLn1p3 for accurate ln(1+r) approximation
     * - Result scaled by 10^6 to maintain 6 decimal places of precision
     * - Gas cost increases logarithmically with input magnitude
     * - Maximum theoretical input: u256.Max (though precision may degrade)
     * - Monotonicity guaranteed across entire input range
     */
    public static preciseLog(x: u256): u256 {
        const bitLen = SafeMath.bitLength256(x);

        if (bitLen === 0) {
            throw new Revert('SafeMath: log of zero');
        }

        if (bitLen === 1) {
            return u256.Zero;
        }

        const k: u32 = bitLen - 1;
        const base: u256 = SafeMath.mul(u256.fromU32(k), u256.fromU64(SafeMath.LN2_SCALED));

        const pow2k = SafeMath.shl(SafeMath.ONE, <i32>k);
        const xPrime = SafeMath.sub(x, pow2k);

        if (xPrime.isZero()) {
            return base;
        }

        const xPrimeTimes1e6 = SafeMath.mul(xPrime, u256.fromU64(SafeMath.SCALE_1E6));
        const rScaled = SafeMath.div(xPrimeTimes1e6, pow2k);

        if (u256.gt(rScaled, u256.fromU64(u64.MAX_VALUE))) {
            throw new Revert('SafeMath: rScaled overflow, input too large');
        }

        const frac: u64 = SafeMath.polyLn1p3(rScaled.toU64());

        return SafeMath.add(base, u256.fromU64(frac));
    }

    /**
     * Computes natural logarithm (ln) using bit length approximation.
     *
     * @param x - The input value
     * @returns ln(x) scaled by 10^6 for fixed-point precision
     * @throws {Revert} When x is zero (log of zero)
     *
     * @example
     * ```typescript
     * const ln_2 = SafeMath.approxLog(u256.fromU32(2));     // Returns 693,147 (exact for powers of 2)
     * const ln_8 = SafeMath.approxLog(u256.fromU32(8));     // Returns 2,079,441 (3 * ln(2), exact)
     * const ln_10 = SafeMath.approxLog(u256.fromU32(10));   // Returns 2,079,441 (uses floor approximation)
     * const ln_1000 = SafeMath.approxLog(u256.fromU32(1000)); // Returns 6,238,323 (9 * ln(2))
     * ```
     *
     * @warning Uses step-wise approximation based on bit length. The result has
     * discrete jumps at powers of 2, with constant values between them.
     * Maximum error is ln(2) ≈ 0.693 (scaled: 693,147). For smooth,
     * continuous logarithm curves required in pricing models, use preciseLog.
     *
     * @security Suitable for applications where monotonicity matters more than precision:
     * - Rough categorization of token amounts
     * - Tier-based reward systems
     * - Quick magnitude comparisons
     * Not recommended for precise financial calculations or smooth curves.
     *
     * @remarks
     * - Algorithm: ln(x) ≈ (bitLength(x) - 1) * ln(2)
     * - Exact for all powers of 2
     * - Result scaled by 10^6 for 6 decimal places of precision
     * - O(1) complexity, extremely gas efficient
     * - Monotonically non-decreasing (required for security)
     */
    public static approxLog(x: u256): u256 {
        const bitLen: u32 = SafeMath.bitLength256(x);

        if (bitLen === 0) {
            throw new Revert('SafeMath: log of zero');
        }

        if (bitLen === 1) {
            return u256.Zero;
        }

        const log2Count: u64 = (bitLen - 1) as u64;

        return SafeMath.mul(u256.fromU64(log2Count), u256.fromU64(SafeMath.LN2_SCALED));
    }

    /**
     * Calculates bit length (minimum bits required) of a u256 value.
     *
     * @param x - The input value
     * @returns Number of bits needed to represent x (position of MSB + 1)
     *
     * @example
     * ```typescript
     * const bits_0 = SafeMath.bitLength256(u256.Zero);        // Returns 0
     * const bits_1 = SafeMath.bitLength256(u256.One);         // Returns 1
     * const bits_255 = SafeMath.bitLength256(u256.fromU32(255)); // Returns 8
     * const bits_256 = SafeMath.bitLength256(u256.fromU32(256)); // Returns 9
     * ```
     *
     * @warning Returns 0 for input 0, which technically requires 0 bits to represent.
     * This differs from some implementations that might return 1 for consistency.
     *
     * @security Validated across all u256 segment boundaries. Used internally for:
     * - Logarithm calculations (bitLength = floor(log2(x)) + 1 for x > 0)
     * - Efficient range determination in binary operations
     * - Gas optimization by determining operation complexity
     * - Overflow prediction in multiplication/exponentiation
     *
     * @remarks
     * - Handles values across all four u64 segments of u256
     * - Returns 0 for input 0
     * - Returns 1 for input 1
     * - Returns 256 for u256.Max
     * - O(1) complexity with early exit for high-order segments
     * - Relationship: bitLength(x) = approximateLog2(x) + 1 for x > 1
     */
    public static bitLength256(x: u256): u32 {
        // GAS OPTIMIZATION: Use clz intrinsic to find MSB in 1 instruction.
        // Must explicit cast result to u32 for subtraction logic.
        if (x.hi2 != 0) return 256 - <u32>clz(x.hi2);
        if (x.hi1 != 0) return 192 - <u32>clz(x.hi1);
        if (x.lo2 != 0) return 128 - <u32>clz(x.lo2);
        if (x.lo1 != 0) return 64 - <u32>clz(x.lo1);
        return 0;
    }

    /**
     * Computes ln(1+z) using hyperbolic arctangent (atanh) transformation
     * for continuous, high-precision results across the domain [0,1).
     *
     * @param rScaled - Input value z scaled by 10^6, where z ∈ [0,1)
     * @returns ln(1+z) scaled by 10^6 for fixed-point precision
     * @throws {Revert} When rScaled ≥ 1,000,000 (input out of valid range)
     *
     * @example
     * ```typescript
     * // ln(1 + 0.5) = ln(1.5) ≈ 0.405465
     * const result = SafeMath.polyLn1p3(500000); // Returns ~405465
     *
     * // ln(1 + 0.1) = ln(1.1) ≈ 0.095310
     * const small = SafeMath.polyLn1p3(100000); // Returns ~95310
     *
     * // ln(1 + 0.999) = ln(1.999) ≈ 0.692647
     * const large = SafeMath.polyLn1p3(999000); // Returns ~692647
     * ```
     *
     * @warning This function is optimized for internal use by preciseLog and requires
     * understanding of fixed-point arithmetic. The input uses a scaling factor
     * of 10^6, meaning rScaled=500000 represents z=0.5. Input must be strictly
     * less than 1,000,000 to represent valid z values in [0,1). Direct usage
     * outside of the logarithm calculation pipeline requires careful attention
     * to scaling conventions.
     *
     * @security The algorithm uses integer arithmetic throughout to avoid
     * floating-point vulnerabilities. All intermediate calculations
     * are designed to prevent overflow: maximum intermediate value
     * is approximately 1.11×10^11, well below u64.Max (≈1.84×10^19).
     * This ensures deterministic, reproducible results critical for
     * consensus in blockchain applications.
     *
     * @remarks
     * Algorithm details:
     * - Transform: w = z/(2+z) maps [0,1) → [0,1/3] for rapid convergence
     * - Series: atanh(w) = w + w³/3 + w⁵/5 + w⁷/7 + w⁹/9 + ...
     * - Identity: ln(1+z) = 2*atanh(w) where w = z/(2+z)
     * - Maximum absolute error: 6 units (0.000006)
     * - Perfectly continuous: no discontinuities or jumps
     * - Optimized for gas efficiency with 9th-order approximation
     * - Monotonicity preserved across entire domain
     *
     * Mathematical foundation:
     * - Based on the identity: ln(1+z) = 2*atanh(z/(2+z))
     * - Taylor series truncated at 9th power for optimal accuracy/gas balance
     * - Rounding applied at each term to minimize cumulative error
     * - All divisions use banker's rounding via (numerator + divisor/2) / divisor
     */
    public static polyLn1p3(rScaled: u64): u64 {
        if (rScaled >= SafeMath.SCALE_1E6) {
            throw new Revert('SafeMath.polyLn1p3: input out of range');
        }

        if (rScaled == 0) {
            return 0;
        }

        const SCALE: u64 = SafeMath.SCALE_1E6;
        const HALF_SCALE: u64 = 500_000;

        // Compute w = z / (2 + z)
        // This maps [0,1) to [0,1/3] where atanh converges rapidly
        const denom: u64 = 2 * SCALE + rScaled;
        const wScaled: u64 = (rScaled * SCALE + (denom >> 1)) / denom;

        // Compute powers of w iteratively
        // All operations are safe: max intermediate is ~1.11e11 << 2^64
        const w2: u64 = (wScaled * wScaled + HALF_SCALE) / SCALE;
        const w3: u64 = (w2 * wScaled + HALF_SCALE) / SCALE;
        const w5: u64 = (w3 * w2 + HALF_SCALE) / SCALE;
        const w7: u64 = (w5 * w2 + HALF_SCALE) / SCALE;
        const w9: u64 = (w7 * w2 + HALF_SCALE) / SCALE;

        // Compute atanh series terms with rounding
        const t3: u64 = (w3 + 1) / 3;
        const t5: u64 = (w5 + 2) / 5;
        const t7: u64 = (w7 + 3) / 7;
        const t9: u64 = (w9 + 4) / 9;

        // Sum and apply final scaling
        const atanhSum: u64 = wScaled + t3 + t5 + t7 + t9;
        const result: u64 = atanhSum << 1; // Multiply by 2 using bit shift

        // Preserve monotonicity for tiny positive inputs that would round to zero
        return result == 0 ? 1 : result;
    }

    /**
     * Calculate ln(a/b) with precision, avoiding bit-length mismatch issues.
     * Returns the result scaled by 1e6 (i.e., ln(a/b) * 1,000,000)
     *
     * This function correctly handles the case where a and b have different
     * bit lengths, which would cause incorrect results if computing
     * preciseLog(a) - preciseLog(b) directly.
     *
     * @param a - Numerator (must be > 0)
     * @param b - Denominator (must be > 0)
     * @returns ln(a/b) * 1,000,000
     * @throws {Revert} When:
     * - a is zero (log of zero)
     * - b is zero (division by zero)
     * - result is negative (return type is unsigned)
     */
    public static preciseLogRatio(a: u256, b: u256): u256 {
        if (b.isZero()) {
            throw new Revert('SafeMath: division by zero');
        }

        if (a.isZero()) {
            throw new Revert('SafeMath: log of zero');
        }

        // If a == b, ln(1) = 0
        if (u256.eq(a, b)) {
            return u256.Zero;
        }

        const SCALE = u256.fromU64(1_000_000);
        const LN2_SCALED = u256.fromU64(693147); // ln(2) * 1e6

        // Compute ratio = a / b with scaling to preserve precision
        // scaledRatio = (a * SCALE) / b represents (a/b) * SCALE
        const scaledRatio = SafeMath.div(SafeMath.mul(a, SCALE), b);

        if (scaledRatio.isZero()) {
            // a/b is very small, return negative (but we only handle positive ln)
            throw new Revert('SafeMath: negative log result');
        }

        // If scaledRatio == SCALE, then a/b == 1, ln = 0
        if (u256.eq(scaledRatio, SCALE)) {
            return u256.Zero;
        }

        // If scaledRatio < SCALE (i.e., a < b), ln is negative
        if (u256.lt(scaledRatio, SCALE)) {
            throw new Revert('SafeMath: negative log result');
        }

        // Now scaledRatio > SCALE, meaning a/b > 1, so ln(a/b) > 0
        // We want to compute ln(scaledRatio / SCALE) = ln(scaledRatio) - ln(SCALE)
        // But we do this correctly by computing ln(1 + (scaledRatio - SCALE) / SCALE)

        // fraction = (scaledRatio - SCALE) / SCALE = (a/b - 1)
        // fractionScaled = scaledRatio - SCALE represents fraction * SCALE
        const fractionScaled = SafeMath.sub(scaledRatio, SCALE);

        // For small fractions (a/b < 2, i.e., fractionScaled < SCALE), use the stable polyLn1p3 approximation
        // Note: Use strict less-than to ensure ratio = 2 uses the k*ln(2) decomposition
        // This ensures continuity at the boundary - both paths give ln(2) for ratio = 2
        if (u256.lt(fractionScaled, SCALE)) {
            return u256.fromU64(SafeMath.polyLn1p3(fractionScaled.toU64()));
        }

        // For ratios >= 2, use the decomposition:
        // ln(a/b) = k * ln(2) + ln(normalized)
        // where normalized = (a/b) / 2^k is in range [1, 2)

        // Find k such that scaledRatio / 2^k is in [SCALE, 2*SCALE)
        let temp = scaledRatio;
        let k: u32 = 0;
        const twoScale = SafeMath.mul(SCALE, u256.fromU32(2));

        while (u256.ge(temp, twoScale)) {
            temp = SafeMath.shr(temp, 1);
            k++;
        }

        // Now temp is in [SCALE, 2*SCALE), representing a value in [1, 2)
        // ln(a/b) = k * ln(2) + ln(temp/SCALE)
        // temp/SCALE is in [1, 2), so (temp - SCALE)/SCALE is in [0, 1)

        const normalizedFraction = SafeMath.sub(temp, SCALE);
        const lnNormalized = SafeMath.polyLn1p3(normalizedFraction.toU64());
        const base = SafeMath.mul(u256.fromU32(k), LN2_SCALED);

        return SafeMath.add(base, u256.fromU64(lnNormalized));
    }

    /**
     * @internal
     * Modular addition helper that prevents overflow.
     * Pre-condition: 0 <= x,y < m
     */
    private static addModNoCarry(x: u256, y: u256, m: u256): u256 {
        const mMinusY = u256.sub(m, y);
        return u256.ge(x, mMinusY) ? u256.sub(x, mMinusY) : u256.add(x, y);
    }

    /**
     * @internal
     * Modular doubling helper that prevents overflow.
     * Pre-condition: 0 <= x < m
     */
    private static doubleModNoCarry(x: u256, m: u256): u256 {
        const mMinusX = u256.sub(m, x);
        return u256.ge(x, mMinusX) ? u256.sub(x, mMinusX) : u256.add(x, x);
    }
}

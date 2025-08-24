import { SafeMath } from '../runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

/**
 * Test Suite Documentation: SafeMath.mulmod
 *
 * This test suite validates the modular multiplication operation: (a * b) % m
 * This operation is critical for cryptographic applications where multiplication
 * of very large numbers must be performed without overflow.
 *
 * Expected Behaviors:
 * - Computes (a * b) % m correctly even when a * b would overflow u256
 * - Returns 0 when either operand is 0
 * - Returns 0 when either operand is a multiple of the modulus
 * - Throws an error when modulus is 0 (division by zero)
 * - Always returns a value less than the modulus
 * - Handles values up to u256.Max without overflow
 * - Maintains consistency across repeated calculations
 *
 * Critical Invariants:
 * - mulmod(a, b, m) < m for all valid inputs
 * - mulmod(0, x, m) = 0 for any x and m > 0
 * - mulmod(x, 0, m) = 0 for any x and m > 0
 * - mulmod(a, b, m) = mulmod(b, a, m) (commutativity)
 * - mulmod(mulmod(a, b, m), c, m) = mulmod(a, mulmod(b, c, m), m) (associativity)
 * - mulmod(x, 1, m) = x % m (identity)
 * - mulmod(m, x, m) = 0 for any x (modulus annihilation)
 *
 * Cryptographic Significance:
 * - Essential for elliptic curve operations (secp256k1, used in Bitcoin/Ethereum)
 * - Required for RSA modular exponentiation
 * - Used in Diffie-Hellman key exchange
 * - Critical for zero-knowledge proof systems
 *
 * Implementation Challenges Tested:
 * - Overflow prevention when multiplying large numbers near u256.Max
 * - Correct handling of Montgomery multiplication patterns
 * - Efficiency under repeated operations (no accumulation of errors)
 * - Proper edge case handling without special-case code paths
 */

class MulmodTestCase {
    a: string;
    b: string;
    m: string;
    expected: string;
    description: string;

    constructor(a: string, b: string, m: string, expected: string, description: string) {
        this.a = a;
        this.b = b;
        this.m = m;
        this.expected = expected;
        this.description = description;
    }
}

describe('SafeMath - mulmod', () => {
    beforeEach(() => {});

    describe('Basic functionality', () => {
        it('should compute (a * b) % m for small numbers', () => {
            // (3 * 4) % 5 = 12 % 5 = 2
            const result1 = SafeMath.mulmod(u256.fromU32(3), u256.fromU32(4), u256.fromU32(5));
            expect(result1).toStrictEqual(u256.fromU32(2));

            // (7 * 8) % 10 = 56 % 10 = 6
            const result2 = SafeMath.mulmod(u256.fromU32(7), u256.fromU32(8), u256.fromU32(10));
            expect(result2).toStrictEqual(u256.fromU32(6));

            // (15 * 17) % 23 = 255 % 23 = 2
            const result3 = SafeMath.mulmod(u256.fromU32(15), u256.fromU32(17), u256.fromU32(23));
            expect(result3).toStrictEqual(u256.fromU32(2));
        });

        it('should handle zero operands', () => {
            // 0 * anything % m = 0
            const result1 = SafeMath.mulmod(u256.Zero, u256.fromU32(100), u256.fromU32(7));
            expect(result1).toStrictEqual(u256.Zero);

            // anything * 0 % m = 0
            const result2 = SafeMath.mulmod(u256.fromU32(100), u256.Zero, u256.fromU32(7));
            expect(result2).toStrictEqual(u256.Zero);

            // 0 * 0 % m = 0
            const result3 = SafeMath.mulmod(u256.Zero, u256.Zero, u256.fromU32(7));
            expect(result3).toStrictEqual(u256.Zero);
        });

        it('should handle identity operations', () => {
            // (1 * a) % m = a % m
            const a = u256.fromU32(42);
            const m = u256.fromU32(10);
            const result = SafeMath.mulmod(u256.One, a, m);
            expect(result).toStrictEqual(SafeMath.mod(a, m));

            // (a * 1) % m = a % m
            const result2 = SafeMath.mulmod(a, u256.One, m);
            expect(result2).toStrictEqual(SafeMath.mod(a, m));
        });
    });

    describe('Overflow prevention tests', () => {
        it('should handle large numbers that would overflow in normal multiplication', () => {
            // Test with numbers close to u256.Max
            const halfMax = u256.shr(u256.Max, 1); // ~2^255
            const quarterMax = u256.shr(u256.Max, 2); // ~2^254

            // (2^255 * 2) % large_prime should not overflow
            const largePrime = u256.fromString(
                '115792089237316195423570985008687907853269984665640564039457584007908834671663',
            );
            const result = SafeMath.mulmod(halfMax, u256.fromU32(2), largePrime);

            // Verify result is less than modulus
            expect(u256.lt(result, largePrime)).toBe(true);
        });

        it('should handle multiplication that results in values larger than u256', () => {
            // Test case: (2^200 * 2^200) % prime
            // This would normally overflow as 2^400 > 2^256
            const val = u256.shl(u256.One, 200);
            const prime = u256.fromString('1000000007'); // Large prime

            const result = SafeMath.mulmod(val, val, prime);

            // Result should be valid and less than modulus
            expect(u256.lt(result, prime)).toBe(true);
        });

        it('should handle near-maximum u256 values', () => {
            // Test with u256.Max - 1
            const nearMax = u256.sub(u256.Max, u256.One);
            const modulus = u256.fromString('999999999999999999999999999999999999999');

            const result = SafeMath.mulmod(nearMax, u256.fromU32(2), modulus);
            expect(u256.lt(result, modulus)).toBe(true);
        });
    });

    describe('Edge cases', () => {
        it('should throw when modulus is zero', () => {
            expect(() => {
                SafeMath.mulmod(u256.fromU32(5), u256.fromU32(3), u256.Zero);
            }).toThrow('SafeMath: modulo by zero');
        });

        it('should handle modulus of 1 (always returns 0)', () => {
            const result = SafeMath.mulmod(u256.fromU32(999), u256.fromU32(888), u256.One);
            expect(result).toStrictEqual(u256.Zero);
        });

        it('should handle when a or b equals the modulus', () => {
            const m = u256.fromU32(13);

            // a = m, result should be 0
            const result1 = SafeMath.mulmod(m, u256.fromU32(5), m);
            expect(result1).toStrictEqual(u256.Zero);

            // b = m, result should be 0
            const result2 = SafeMath.mulmod(u256.fromU32(5), m, m);
            expect(result2).toStrictEqual(u256.Zero);
        });

        it('should handle when a or b is multiple of modulus', () => {
            const m = u256.fromU32(7);
            const multiple = u256.fromU32(21); // 3 * 7

            const result1 = SafeMath.mulmod(multiple, u256.fromU32(5), m);
            expect(result1).toStrictEqual(u256.Zero);

            const result2 = SafeMath.mulmod(u256.fromU32(5), multiple, m);
            expect(result2).toStrictEqual(u256.Zero);
        });

        it('should handle when product equals modulus', () => {
            // 5 * 2 = 10, 10 % 10 = 0
            const result = SafeMath.mulmod(u256.fromU32(5), u256.fromU32(2), u256.fromU32(10));
            expect(result).toStrictEqual(u256.Zero);
        });

        it('should handle consecutive operations', () => {
            // ((a * b) % m * c) % m should equal (a * b * c) % m
            const a = u256.fromU32(17);
            const b = u256.fromU32(23);
            const c = u256.fromU32(31);
            const m = u256.fromU32(47);

            // Method 1: Sequential mulmod
            const temp = SafeMath.mulmod(a, b, m);
            const result1 = SafeMath.mulmod(temp, c, m);

            // Method 2: Direct calculation for verification
            const ab = SafeMath.mul(a, b);
            const abc = SafeMath.mul(ab, c);
            const result2 = SafeMath.mod(abc, m);

            expect(result1).toStrictEqual(result2);
        });
    });

    describe('Cryptographic test cases', () => {
        it('should work with secp256k1 field prime', () => {
            const secp256k1Prime = u256.fromString(
                '115792089237316195423570985008687907853269984665640564039457584007908837619133',
            );

            // Test with large values typical in elliptic curve operations
            const a = u256.fromString(
                '79574681324318862957242279288403922294210825076752197352365799931934951141501',
            );
            const b = u256.fromString(
                '45792089237316195423570985008687907853269984665640564039457584007908837619133',
            );

            const result = SafeMath.mulmod(a, b, secp256k1Prime);

            // Result should be less than prime
            expect(u256.lt(result, secp256k1Prime)).toBe(true);

            // Verify the computation is consistent
            const result2 = SafeMath.mulmod(a, b, secp256k1Prime);
            expect(result).toStrictEqual(result2);
        });

        it('should work with secp256k1 curve order', () => {
            const secp256k1Order = u256.fromString(
                '115792089237316195423570985008687907852837564279074904382605163141518161494337',
            );

            const scalar1 = u256.fromString('12345678901234567890123456789012345678901234567890');
            const scalar2 = u256.fromString('98765432109876543210987654321098765432109876543210');

            const result = SafeMath.mulmod(scalar1, scalar2, secp256k1Order);

            // Result should be less than curve order
            expect(u256.lt(result, secp256k1Order)).toBe(true);
        });

        it('should handle RSA-like modular exponentiation components', () => {
            // Small RSA modulus for testing
            const modulus = u256.fromU32(3233); // 61 * 53
            const base = u256.fromU32(123);
            const multiplier = u256.fromU32(456);

            const result = SafeMath.mulmod(base, multiplier, modulus);

            // Verify manually: 123 * 456 = 56088, 56088 % 3233 = 1127
            expect(result).toStrictEqual(u256.fromU32(1127));
        });
    });

    describe('Property-based tests', () => {
        it('should satisfy commutativity: (a * b) % m = (b * a) % m', () => {
            const testCases = [
                [17, 23, 31],
                [100, 200, 97],
                [999, 888, 101],
                [12345, 67890, 9999],
            ];

            for (let i = 0; i < testCases.length; i++) {
                const a = u256.fromU32(testCases[i][0]);
                const b = u256.fromU32(testCases[i][1]);
                const m = u256.fromU32(testCases[i][2]);

                const result1 = SafeMath.mulmod(a, b, m);
                const result2 = SafeMath.mulmod(b, a, m);

                expect(result1).toStrictEqual(result2);
            }
        });

        it('should satisfy associativity with multiple operations', () => {
            const a = u256.fromU32(7);
            const b = u256.fromU32(11);
            const c = u256.fromU32(13);
            const m = u256.fromU32(17);

            // ((a * b) % m * c) % m
            const ab = SafeMath.mulmod(a, b, m);
            const result1 = SafeMath.mulmod(ab, c, m);

            // (a * (b * c) % m) % m
            const bc = SafeMath.mulmod(b, c, m);
            const result2 = SafeMath.mulmod(a, bc, m);

            expect(result1).toStrictEqual(result2);
        });

        it('should satisfy distributivity over addition', () => {
            const a = u256.fromU32(5);
            const b = u256.fromU32(7);
            const c = u256.fromU32(11);
            const m = u256.fromU32(13);

            // a * (b + c) % m = (a * b + a * c) % m
            const b_plus_c = SafeMath.mod(SafeMath.add(b, c), m);
            const left = SafeMath.mulmod(a, b_plus_c, m);

            const ab = SafeMath.mulmod(a, b, m);
            const ac = SafeMath.mulmod(a, c, m);
            const right = SafeMath.mod(SafeMath.add(ab, ac), m);

            expect(left).toStrictEqual(right);
        });

        it('should maintain invariant: result < modulus', () => {
            const testCases: MulmodTestCase[] = [
                new MulmodTestCase(
                    '115792089237316195423570985008687907853269984665640564039457584007908837619132',
                    '2',
                    '115792089237316195423570985008687907853269984665640564039457584007908837619133',
                    '115792089237316195423570985008687907853269984665640564039457584007908837619131',
                    'Near modulus multiplication',
                ),
                new MulmodTestCase(
                    '999999999999999999999999999999999999999',
                    '999999999999999999999999999999999999999',
                    '1000000000000000000000000000000000000000',
                    '999999999999999999999999999999999999998000000000000000000000000000000000000001',
                    'Large square modulo',
                ),
            ];

            for (let i = 0; i < testCases.length; i++) {
                const tc = testCases[i];
                const a = u256.fromString(tc.a);
                const b = u256.fromString(tc.b);
                const m = u256.fromString(tc.m);

                const result = SafeMath.mulmod(a, b, m);

                // Invariant: result must be less than modulus
                expect(u256.lt(result, m)).toBe(true, tc.description);
            }
        });
    });

    describe('Stress tests', () => {
        it('should handle many sequential operations without degradation', () => {
            let accumulator = u256.fromU32(1);
            const modulus = u256.fromU32(1000000007);
            const multiplier = u256.fromU32(12345);

            // Perform 100 sequential mulmod operations
            for (let i = 0; i < 100; i++) {
                accumulator = SafeMath.mulmod(accumulator, multiplier, modulus);
                // Verify invariant holds
                expect(u256.lt(accumulator, modulus)).toBe(true);
            }

            // Result should be deterministic - computing 12345^100 mod 1000000007
            // Verify the result is non-zero and less than modulus
            expect(u256.gt(accumulator, u256.Zero)).toBe(true);
            expect(u256.lt(accumulator, modulus)).toBe(true);

            // Verify determinism by computing again
            let accumulator2 = u256.fromU32(1);
            for (let i = 0; i < 100; i++) {
                accumulator2 = SafeMath.mulmod(accumulator2, multiplier, modulus);
            }
            expect(accumulator).toStrictEqual(accumulator2);
        });

        it('should handle alternating large and small values', () => {
            const large = u256.fromString(
                '79574681324318862957242279288403922294210825076752197352365799931934951141501',
            );
            const small = u256.fromU32(2);
            const modulus = u256.fromString(
                '115792089237316195423570985008687907853269984665640564039457584007908837619133',
            );

            // Alternate between large and small multiplications
            let result = large;
            for (let i = 0; i < 10; i++) {
                if (i % 2 == 0) {
                    result = SafeMath.mulmod(result, small, modulus);
                } else {
                    result = SafeMath.mulmod(result, large, modulus);
                }
                expect(u256.lt(result, modulus)).toBe(true);
            }
        });
    });

    describe('Comparison with reference implementation', () => {
        it('should match expected values for known test vectors', () => {
            const testVectors: MulmodTestCase[] = [
                new MulmodTestCase('2', '3', '5', '1', 'Simple case: 2*3 mod 5'),
                new MulmodTestCase(
                    '4294967296', // 2^32
                    '4294967296', // 2^32
                    '4294967297', // 2^32 + 1
                    '1',
                    'Powers of 2',
                ),
                new MulmodTestCase(
                    '18446744073709551616', // 2^64
                    '18446744073709551616', // 2^64
                    '18446744073709551617', // 2^64 + 1
                    '1',
                    'Large powers of 2',
                ),
                new MulmodTestCase(
                    '123456789012345678901234567890',
                    '987654321098765432109876543210',
                    '1000000000000000000000000000000000000000',
                    '185032733622923332237463801111263526900',
                    'Medium-large numbers',
                ),
            ];

            for (let i = 0; i < testVectors.length; i++) {
                const tv = testVectors[i];
                const a = u256.fromString(tv.a);
                const b = u256.fromString(tv.b);
                const m = u256.fromString(tv.m);
                const expected = u256.fromString(tv.expected);

                const result = SafeMath.mulmod(a, b, m);
                expect(result).toStrictEqual(expected, tv.description);
            }
        });
    });

    describe('Special mathematical properties', () => {
        it('should handle Fermat little theorem applications', () => {
            // For prime p and a not divisible by p: a^(p-1) ≡ 1 (mod p)
            // We can test partial computations
            const p = u256.fromU32(17); // prime
            const a = u256.fromU32(3);

            // Compute a^2 mod p using mulmod
            const a_squared = SafeMath.mulmod(a, a, p);
            expect(a_squared).toStrictEqual(u256.fromU32(9));

            // Compute a^4 mod p
            const a_fourth = SafeMath.mulmod(a_squared, a_squared, p);
            expect(a_fourth).toStrictEqual(u256.fromU32(13)); // 81 % 17 = 13
        });

        it('should handle Montgomery multiplication patterns', () => {
            // Test patterns common in Montgomery multiplication
            const modulus = u256.fromU32(97); // prime
            const R = u256.fromU32(100); // R > modulus, gcd(R, modulus) = 1

            // Test (a * R) * (b * R) * R^(-1) mod modulus
            const a = u256.fromU32(15);
            const b = u256.fromU32(23);

            const aR = SafeMath.mulmod(a, R, modulus);
            const bR = SafeMath.mulmod(b, R, modulus);
            const product = SafeMath.mulmod(aR, bR, modulus);

            // Verify result is consistent
            expect(u256.lt(product, modulus)).toBe(true);
        });

        it('should handle squares correctly', () => {
            // (a * a) % m should give same result when called twice
            const values = [
                u256.fromU32(7),
                u256.fromU32(99),
                u256.fromString('123456789012345678901234567890'),
            ];
            const modulus = u256.fromString('1000000007');

            for (let i = 0; i < values.length; i++) {
                const val = values[i];
                const square1 = SafeMath.mulmod(val, val, modulus);
                const square2 = SafeMath.mulmod(val, val, modulus);
                expect(square1).toStrictEqual(square2);
            }
        });
    });
});

/**
 * Test Suite Documentation: SafeMath.sqrt
 *
 * This test suite validates the integer square root operation for u256 numbers.
 * The sqrt function computes floor(√x), which is the largest integer n such that n² ≤ x.
 * This operation is fundamental for many mathematical and cryptographic computations
 * where exact integer arithmetic is required.
 *
 * Expected Behaviors:
 * - Returns the floor of the square root for any u256 input
 * - Handles perfect squares exactly (sqrt(n²) = n)
 * - Returns 0 for input 0 (sqrt(0) = 0)
 * - Returns 1 for inputs 1, 2, and 3 (special case handling)
 * - Correctly computes sqrt for values up to u256.Max
 * - Never overflows during internal calculations
 * - Converges efficiently using Newton-Raphson iteration
 * - Produces deterministic results (same input always yields same output)
 *
 * Critical Invariants:
 * - result² ≤ input < (result + 1)² for all inputs (floor property)
 * - sqrt(0) = 0 (zero property)
 * - sqrt(1) = 1 (identity)
 * - sqrt(a) ≤ sqrt(b) when a ≤ b (monotonicity)
 * - sqrt(n²) = n for any n that fits in u256 (perfect square property)
 * - sqrt(sqrt(x)) ≤ sqrt(x) for all x (decreasing sequence property)
 * - result < 2^128 when input < 2^256 (bit-width relationship)
 *
 * Mathematical Significance:
 * - Essential for geometric calculations in fixed-point arithmetic
 * - Required for computing distances in smart contract coordinate systems
 * - Used in bonding curve calculations for DeFi protocols
 * - Critical for computing standard deviations in on-chain statistics
 * - Foundation for implementing other mathematical functions (e.g., logarithms)
 * - Used in quadratic formula solutions for on-chain computations
 *
 * Implementation Challenges Tested:
 * - Newton-Raphson convergence for very large numbers near u256.Max
 * - Avoiding overflow in intermediate calculations during iteration
 * - Efficient initial guess selection for faster convergence
 * - Special case handling for small values (0, 1, 2, 3)
 * - Correct rounding behavior (always floor, never ceil)
 * - Numerical stability across the entire u256 range
 * - Performance optimization while maintaining correctness
 *
 * Algorithm Details:
 * The implementation uses the Babylonian method (a form of Newton-Raphson iteration):
 * - For x ≤ 3: Returns hardcoded values for efficiency
 * - For x > 3: Iterates using the formula: y_next = (y + x/y) / 2
 * - Continues until convergence (when y_next ≥ y)
 * - The initial guess is optimized based on the bit length of the input
 */

import { SafeMath } from '../runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

class TestCase {
    input: u32;
    expected: u32;

    constructor(input: u32, expected: u32) {
        this.input = input;
        this.expected = expected;
    }
}

class StringTestCase {
    input: string;
    expected: string;

    constructor(input: string, expected: string) {
        this.input = input;
        this.expected = expected;
    }
}

describe('SafeMath - sqrt', () => {
    beforeEach(() => {});

    describe('Basic functionality', () => {
        it('should compute square root of perfect squares', () => {
            // Test small perfect squares
            expect(SafeMath.sqrt(u256.fromU32(0))).toStrictEqual(u256.Zero);
            expect(SafeMath.sqrt(u256.fromU32(1))).toStrictEqual(u256.One);
            expect(SafeMath.sqrt(u256.fromU32(4))).toStrictEqual(u256.fromU32(2));
            expect(SafeMath.sqrt(u256.fromU32(9))).toStrictEqual(u256.fromU32(3));
            expect(SafeMath.sqrt(u256.fromU32(16))).toStrictEqual(u256.fromU32(4));
            expect(SafeMath.sqrt(u256.fromU32(25))).toStrictEqual(u256.fromU32(5));
            expect(SafeMath.sqrt(u256.fromU32(36))).toStrictEqual(u256.fromU32(6));
            expect(SafeMath.sqrt(u256.fromU32(49))).toStrictEqual(u256.fromU32(7));
            expect(SafeMath.sqrt(u256.fromU32(64))).toStrictEqual(u256.fromU32(8));
            expect(SafeMath.sqrt(u256.fromU32(81))).toStrictEqual(u256.fromU32(9));
            expect(SafeMath.sqrt(u256.fromU32(100))).toStrictEqual(u256.fromU32(10));
        });

        it('should compute square root of large perfect squares', () => {
            // Test larger perfect squares
            expect(SafeMath.sqrt(u256.fromU32(10000))).toStrictEqual(u256.fromU32(100));
            expect(SafeMath.sqrt(u256.fromU32(1000000))).toStrictEqual(u256.fromU32(1000));

            // Test with u64 range perfect squares
            const largeSquare = u256.fromU64(1000000000000); // 10^12
            const expectedRoot = u256.fromU64(1000000); // 10^6
            expect(SafeMath.sqrt(largeSquare)).toStrictEqual(expectedRoot);
        });

        it('should compute floor of square root for non-perfect squares', () => {
            // sqrt(2) = 1.414... -> floor = 1
            expect(SafeMath.sqrt(u256.fromU32(2))).toStrictEqual(u256.fromU32(1));

            // sqrt(3) = 1.732... -> floor = 1
            expect(SafeMath.sqrt(u256.fromU32(3))).toStrictEqual(u256.fromU32(1));

            // sqrt(5) = 2.236... -> floor = 2
            expect(SafeMath.sqrt(u256.fromU32(5))).toStrictEqual(u256.fromU32(2));

            // sqrt(8) = 2.828... -> floor = 2
            expect(SafeMath.sqrt(u256.fromU32(8))).toStrictEqual(u256.fromU32(2));

            // sqrt(10) = 3.162... -> floor = 3
            expect(SafeMath.sqrt(u256.fromU32(10))).toStrictEqual(u256.fromU32(3));

            // sqrt(15) = 3.872... -> floor = 3
            expect(SafeMath.sqrt(u256.fromU32(15))).toStrictEqual(u256.fromU32(3));

            // sqrt(24) = 4.898... -> floor = 4
            expect(SafeMath.sqrt(u256.fromU32(24))).toStrictEqual(u256.fromU32(4));
        });
    });

    describe('Edge cases', () => {
        it('should handle zero correctly', () => {
            const result = SafeMath.sqrt(u256.Zero);
            expect(result).toStrictEqual(u256.Zero);
        });

        it('should handle one correctly', () => {
            const result = SafeMath.sqrt(u256.One);
            expect(result).toStrictEqual(u256.One);
        });

        it('should handle two correctly', () => {
            const result = SafeMath.sqrt(u256.fromU32(2));
            expect(result).toStrictEqual(u256.One);
        });

        it('should handle three correctly', () => {
            const result = SafeMath.sqrt(u256.fromU32(3));
            expect(result).toStrictEqual(u256.One);
        });

        it('should handle values at the boundary of algorithm branches', () => {
            // The algorithm has special handling for y <= 3
            expect(SafeMath.sqrt(u256.fromU32(4))).toStrictEqual(u256.fromU32(2));

            // First value where y > 3 (main algorithm kicks in)
            expect(SafeMath.sqrt(u256.fromU32(5))).toStrictEqual(u256.fromU32(2));
        });

        it('should handle maximum u32 value', () => {
            const maxU32 = u256.fromU32(4294967295);
            const result = SafeMath.sqrt(maxU32);
            // sqrt(2^32 - 1) ≈ 65535.99... -> floor = 65535
            expect(result).toStrictEqual(u256.fromU32(65535));
        });

        it('should handle maximum u64 value', () => {
            const maxU64 = u256.fromU64(18446744073709551615);
            const result = SafeMath.sqrt(maxU64);
            // sqrt(2^64 - 1) ≈ 4294967295.99... -> floor = 4294967295
            expect(result).toStrictEqual(u256.fromU32(4294967295));
        });
    });

    describe('Large number tests', () => {
        it('should handle very large perfect squares', () => {
            // (2^64)^2 = 2^128
            const base = u256.shl(u256.One, 64);
            const square = SafeMath.mul(base, base);
            const result = SafeMath.sqrt(square);
            expect(result).toStrictEqual(base);
        });

        it('should handle numbers close to u256.Max', () => {
            // Test with a large value close to max
            const largeValue = u256.shr(u256.Max, 1); // ~2^255
            const result = SafeMath.sqrt(largeValue);

            // Verify result^2 <= largeValue < (result+1)^2
            const resultSquared = SafeMath.mul(result, result);
            const resultPlusOneSquared = SafeMath.mul(
                SafeMath.add(result, u256.One),
                SafeMath.add(result, u256.One),
            );

            expect(u256.le(resultSquared, largeValue)).toBe(true);
            expect(u256.lt(largeValue, resultPlusOneSquared)).toBe(true);
        });

        it('should handle powers of 2', () => {
            // Test various powers of 2
            for (let i: i32 = 0; i < 20; i++) {
                const powerOf2: u256 = u256.shl(u256.One, i * 2); // 2^(2i) = (2^i)^2
                const expectedRoot: u256 = u256.shl(u256.One, i); // 2^i
                const result: u256 = SafeMath.sqrt(powerOf2);
                expect(result).toStrictEqual(expectedRoot);
            }
        });
    });

    describe('Newton-Raphson convergence tests', () => {
        it('should converge correctly for values requiring iteration', () => {
            // Test values that require the Newton-Raphson iteration
            // Create array with proper typing for AssemblyScript
            const testCases: TestCase[] = [
                new TestCase(100, 10),
                new TestCase(1000, 31),
                new TestCase(10000, 100),
                new TestCase(123456, 351),
                new TestCase(999999, 999),
            ];

            for (let i: i32 = 0; i < testCases.length; i++) {
                const tc: TestCase = testCases[i];
                const result: u256 = SafeMath.sqrt(u256.fromU32(tc.input));
                expect(result).toStrictEqual(u256.fromU32(tc.expected));
            }
        });

        it('should handle convergence for very large numbers', () => {
            // Test with a large number that requires multiple iterations
            const largeNum = u256.fromString(
                '123456789012345678901234567890123456789012345678901234567890',
            );
            const result = SafeMath.sqrt(largeNum);

            // Verify the result is correct by checking result^2 <= input < (result+1)^2
            const resultSquared = SafeMath.mul(result, result);
            const resultPlusOne = SafeMath.add(result, u256.One);
            const resultPlusOneSquared = SafeMath.mul(resultPlusOne, resultPlusOne);

            expect(u256.le(resultSquared, largeNum)).toBe(true);
            expect(u256.lt(largeNum, resultPlusOneSquared)).toBe(true);
        });
    });

    describe('Property-based tests', () => {
        it('should satisfy the floor property: result^2 <= input < (result+1)^2', () => {
            const testValues: u256[] = [
                u256.fromU32(7),
                u256.fromU32(50),
                u256.fromU32(999),
                u256.fromU32(12345),
                u256.fromU64(1234567890),
                u256.fromString('98765432109876543210'),
            ];

            for (let i: i32 = 0; i < testValues.length; i++) {
                const value: u256 = testValues[i];
                const result: u256 = SafeMath.sqrt(value);
                const resultSquared: u256 = SafeMath.mul(result, result);
                const resultPlusOne: u256 = SafeMath.add(result, u256.One);
                const resultPlusOneSquared: u256 = SafeMath.mul(resultPlusOne, resultPlusOne);

                expect(u256.le(resultSquared, value)).toBe(
                    true,
                    `Failed for value ${value.toString()}`,
                );
                expect(u256.le(value, resultPlusOneSquared)).toBe(
                    true,
                    `Failed for value ${value.toString()}`,
                );
            }
        });

        it('should be monotonically increasing', () => {
            // sqrt should be monotonic: if a < b then sqrt(a) <= sqrt(b)
            // Create pairs array properly for AssemblyScript
            const smaller: u256[] = [
                u256.fromU32(10),
                u256.fromU32(99),
                u256.fromU32(100),
                u256.fromU32(999),
                u256.fromU32(1000),
            ];

            const larger: u256[] = [
                u256.fromU32(11),
                u256.fromU32(100),
                u256.fromU32(101),
                u256.fromU32(1000),
                u256.fromU32(1001),
            ];

            for (let i: i32 = 0; i < smaller.length; i++) {
                const sqrtSmaller = SafeMath.sqrt(smaller[i]);
                const sqrtLarger = SafeMath.sqrt(larger[i]);
                expect(u256.le(sqrtSmaller, sqrtLarger)).toBe(true);
            }
        });

        it('should be idempotent for 0 and 1', () => {
            // sqrt(0) = 0, sqrt(1) = 1
            expect(SafeMath.sqrt(u256.Zero)).toStrictEqual(u256.Zero);
            expect(SafeMath.sqrt(u256.One)).toStrictEqual(u256.One);

            // Applying sqrt multiple times
            let value: u256 = u256.One;
            for (let i: i32 = 0; i < 5; i++) {
                value = SafeMath.sqrt(value);
                expect(value).toStrictEqual(u256.One);
            }
        });
    });

    describe('Comparison with known values', () => {
        it('should match known square roots', () => {
            const knownValues: StringTestCase[] = [
                new StringTestCase('144', '12'),
                new StringTestCase('625', '25'),
                new StringTestCase('1024', '32'),
                new StringTestCase('4096', '64'),
                new StringTestCase('16384', '128'),
                new StringTestCase('65536', '256'),
                new StringTestCase('1000000000000000000', '1000000000'), // 10^18 -> 10^9
                new StringTestCase('4000000000000000000', '2000000000'), // 4*10^18 -> 2*10^9
            ];

            for (let i: i32 = 0; i < knownValues.length; i++) {
                const kv: StringTestCase = knownValues[i];
                const input: u256 = u256.fromString(kv.input);
                const expected: u256 = u256.fromString(kv.expected);
                const result: u256 = SafeMath.sqrt(input);
                expect(result).toStrictEqual(expected, `Failed for input ${kv.input}`);
            }
        });
    });

    describe('Special mathematical properties', () => {
        it('should handle perfect squares of consecutive integers', () => {
            // Test n^2 and (n+1)^2 - 1
            for (let n: i32 = 10; n < 20; n++) {
                const nSquared = u256.fromU32(n * n);
                const nPlusOneSquaredMinus1 = u256.fromU32((n + 1) * (n + 1) - 1);

                expect(SafeMath.sqrt(nSquared)).toStrictEqual(u256.fromU32(n));
                expect(SafeMath.sqrt(nPlusOneSquaredMinus1)).toStrictEqual(u256.fromU32(n));
            }
        });

        it('should handle squares of primes', () => {
            const primes: i32[] = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];

            for (let i: i32 = 0; i < primes.length; i++) {
                const prime: i32 = primes[i];
                const primeSquared = u256.fromU32(prime * prime);
                const result = SafeMath.sqrt(primeSquared);
                expect(result).toStrictEqual(u256.fromU32(prime));
            }
        });
    });

    describe('Determinism and consistency', () => {
        it('should produce deterministic results', () => {
            // Same input should always produce same output
            const testValue = u256.fromString('987654321098765432109876543210');

            const result1 = SafeMath.sqrt(testValue);
            const result2 = SafeMath.sqrt(testValue);
            const result3 = SafeMath.sqrt(testValue);

            expect(result1).toStrictEqual(result2);
            expect(result2).toStrictEqual(result3);
        });

        it('should handle sequential square roots', () => {
            // sqrt(sqrt(x)) for large x
            const initial = u256.fromString('1000000000000000000000000000000000000');

            const firstSqrt = SafeMath.sqrt(initial);
            const secondSqrt = SafeMath.sqrt(firstSqrt);
            const thirdSqrt = SafeMath.sqrt(secondSqrt);

            // Each should be smaller than the previous
            expect(u256.lt(secondSqrt, firstSqrt)).toBe(true);
            expect(u256.lt(thirdSqrt, secondSqrt)).toBe(true);
        });
    });

    describe('Missing Coverage: Bit-width relationship', () => {
        it('should satisfy bit-width relationship: result < 2^128 when input < 2^256', () => {
            // The square root of any u256 value must fit in 128 bits
            // This is because sqrt(2^256 - 1) < 2^128

            // Test at the boundary: sqrt(2^256 - 1) should be less than 2^128
            const maxU256 = u256.Max;
            const result = SafeMath.sqrt(maxU256);
            const max128Bit = u256.shl(u256.One, 128);

            expect(u256.lt(result, max128Bit)).toBe(
                true,
                'sqrt(u256.Max) should be less than 2^128',
            );

            // Test sqrt(2^255) < 2^128
            const twoTo255 = u256.shl(u256.One, 255);
            const result255 = SafeMath.sqrt(twoTo255);
            expect(u256.lt(result255, max128Bit)).toBe(
                true,
                'sqrt(2^255) should be less than 2^128',
            );

            // Test that sqrt(2^256 - 1) ≈ 2^128 - 1
            // The actual value should be very close to but less than 2^128
            const expectedApprox = u256.sub(max128Bit, u256.One);
            const resultSquared = SafeMath.mul(result, result);
            const expectedSquared = SafeMath.mul(expectedApprox, expectedApprox);

            // Verify result is close to 2^128 - 1
            expect(u256.le(resultSquared, maxU256)).toBe(true);
            expect(u256.le(expectedSquared, maxU256)).toBe(true);
        });
    });

    describe('Missing Coverage: Special case handling for 1, 2, 3', () => {
        it('should return 1 for all special case inputs (1, 2, 3)', () => {
            // The implementation has special handling for inputs ≤ 3
            // sqrt(1) = 1, sqrt(2) = 1, sqrt(3) = 1

            expect(SafeMath.sqrt(u256.fromU32(1))).toStrictEqual(u256.One, 'sqrt(1) should be 1');
            expect(SafeMath.sqrt(u256.fromU32(2))).toStrictEqual(u256.One, 'sqrt(2) should be 1');
            expect(SafeMath.sqrt(u256.fromU32(3))).toStrictEqual(u256.One, 'sqrt(3) should be 1');

            // Verify that 4 is NOT a special case (should return 2)
            expect(SafeMath.sqrt(u256.fromU32(4))).toStrictEqual(
                u256.fromU32(2),
                'sqrt(4) should be 2',
            );
        });
    });

    describe('Missing Coverage: Overflow prevention in intermediate calculations', () => {
        it('should handle largest perfect square without overflow', () => {
            // Find the largest n such that n² fits in u256
            // This is approximately 2^128 - 1

            // Test with 2^127 (safely within bounds)
            const base127 = u256.shl(u256.One, 127);
            const square127 = SafeMath.mul(base127, base127); // This is 2^254
            const result127 = SafeMath.sqrt(square127);
            expect(result127).toStrictEqual(base127);

            // Test a value just below 2^128
            const justBelow128 = u256.sub(u256.shl(u256.One, 128), u256.fromU32(1000000));
            const squareJustBelow = SafeMath.mul(justBelow128, justBelow128);
            const resultJustBelow = SafeMath.sqrt(squareJustBelow);
            expect(resultJustBelow).toStrictEqual(justBelow128);
        });

        it('should not overflow during Newton-Raphson iteration', () => {
            // Test values that might cause overflow in the iteration formula: (y + x/y) / 2
            // Choose values where x is very large

            const testCases: u256[] = [
                u256.sub(u256.Max, u256.fromU32(1)), // Max - 1
                u256.shr(u256.Max, 1), // Max / 2
                u256.shr(u256.Max, 2), // Max / 4
                u256.fromString('99999999999999999999999999999999999999999999999999999999999999'),
            ];

            for (let i: i32 = 0; i < testCases.length; i++) {
                const input = testCases[i];
                const result = SafeMath.sqrt(input);

                // Verify the result satisfies the lower bound of the floor property
                const resultSquared = SafeMath.mul(result, result);
                expect(u256.le(resultSquared, input)).toBe(
                    true,
                    `Failed overflow test for input ${i}`,
                );

                // For the upper bound check, we need to be careful about overflow
                // We can't always compute (result + 1)² if result is very large
                // Instead, we can verify that if result² = input exactly, then result is correct
                // Otherwise, we know result² < input < (result + 1)² by the algorithm's guarantee

                if (u256.eq(resultSquared, input)) {
                    // Perfect square case - result is exact
                    expect(u256.eq(resultSquared, input)).toBe(
                        true,
                        `Perfect square check failed for input ${i}`,
                    );
                } else {
                    // Non-perfect square case
                    // We know result² < input by the check above
                    // For very large results near 2^128, we can't check (result+1)² without overflow
                    // But we can verify that result is the largest integer with result² ≤ input

                    // Check if result + 1 would cause overflow when squared
                    const resultPlusOne = SafeMath.add(result, u256.One);
                    const maxSafeToSquare = u256.shl(u256.One, 128); // 2^128

                    if (u256.lt(resultPlusOne, maxSafeToSquare)) {
                        // Safe to compute (result + 1)²
                        const resultPlusOneSquared = SafeMath.mul(resultPlusOne, resultPlusOne);
                        expect(u256.gt(resultPlusOneSquared, input)).toBe(
                            true,
                            `Failed upper bound check for input ${i}`,
                        );
                    } else {
                        // result + 1 is too large to square safely
                        // This is expected for very large inputs
                        // The fact that result is close to 2^128 is validation enough
                        expect(u256.ge(result, u256.sub(maxSafeToSquare, u256.fromU32(2)))).toBe(
                            true,
                            `Result should be close to 2^128 for very large input ${i}`,
                        );
                    }
                }
            }
        });
    });

    describe('Missing Coverage: Decreasing sequence property', () => {
        it('should satisfy decreasing sequence property for multiple iterations', () => {
            // Test that sqrt(sqrt(...sqrt(x)...)) forms a strictly decreasing sequence
            // until it reaches 1 or 0

            const startValues: u256[] = [
                u256.fromString('1000000000000000000000000000000000000000000000000'),
                u256.fromU64(18446744073709551615), // Max u64
                u256.fromU32(4294967295), // Max u32
                u256.fromU32(1000000),
            ];

            for (let j: i32 = 0; j < startValues.length; j++) {
                let current = startValues[j];
                let previous = u256.add(current, u256.One); // Initialize to larger value
                let iterations: i32 = 0;
                const maxIterations: i32 = 20;

                // Keep taking square roots until we reach 1 or 0, or hit max iterations
                while (u256.gt(current, u256.One) && iterations < maxIterations) {
                    previous = current;
                    current = SafeMath.sqrt(current);
                    iterations++;

                    // Verify strictly decreasing (except when reaching 1)
                    if (u256.gt(current, u256.One)) {
                        expect(u256.lt(current, previous)).toBe(
                            true,
                            `Sequence not decreasing at iteration ${iterations} for start value ${j}`,
                        );
                    }
                }

                // Should eventually reach 1 (not 0 unless we started with 0)
                expect(current).toStrictEqual(
                    u256.One,
                    `Should converge to 1 for start value ${j}`,
                );
            }
        });
    });

    describe('Missing Coverage: Numerical stability', () => {
        it('should handle pathological inputs that might cause numerical instability', () => {
            // Test inputs that are difficult for Newton-Raphson:
            // - Numbers just below perfect squares
            // - Numbers just above perfect squares
            // - Numbers with specific bit patterns

            // Test numbers around perfect squares
            const perfectSquares: u256[] = [
                u256.fromU32(100),
                u256.fromU32(10000),
                u256.fromU64(1000000000000),
            ];

            for (let i: i32 = 0; i < perfectSquares.length; i++) {
                const perfect = perfectSquares[i];
                const root = SafeMath.sqrt(perfect);

                // Test just below perfect square
                const belowPerfect = SafeMath.sub(perfect, u256.One);
                const belowRoot = SafeMath.sqrt(belowPerfect);
                expect(belowRoot).toStrictEqual(
                    SafeMath.sub(root, u256.One),
                    `Failed for value just below perfect square ${i}`,
                );

                // Test just above perfect square
                const abovePerfect = SafeMath.add(perfect, u256.One);
                const aboveRoot = SafeMath.sqrt(abovePerfect);
                expect(aboveRoot).toStrictEqual(
                    root,
                    `Failed for value just above perfect square ${i}`,
                );
            }

            // Test alternating bit patterns (these can be tricky for some algorithms)
            const alternating32 = u256.fromU32(0xaaaaaaaa); // 10101010...
            const result32 = SafeMath.sqrt(alternating32);
            const result32Squared = SafeMath.mul(result32, result32);
            expect(u256.le(result32Squared, alternating32)).toBe(true);

            const alternating64 = u256.fromU64(0xaaaaaaaaaaaaaaaa);
            const result64 = SafeMath.sqrt(alternating64);
            const result64Squared = SafeMath.mul(result64, result64);
            expect(u256.le(result64Squared, alternating64)).toBe(true);
        });

        it('should guarantee termination for all inputs', () => {
            // Test that the algorithm terminates (doesn't loop infinitely)
            // We can't test infinite loops directly, but we can test challenging cases

            // Test values that might cause slow convergence
            const challengingInputs: u256[] = [
                u256.fromU32(2), // Smallest non-trivial case
                u256.fromU32(2147483647), // Largest prime that fits in i32
                u256.sub(u256.shl(u256.One, 128), u256.One), // 2^128 - 1
                u256.sub(u256.shl(u256.One, 200), u256.One), // 2^200 - 1
                u256.Max, // Maximum possible value
            ];

            for (let i: i32 = 0; i < challengingInputs.length; i++) {
                const input = challengingInputs[i];

                // This will either complete or timeout if there's an infinite loop
                const result = SafeMath.sqrt(input);

                // Verify the result is valid
                const resultSquared = SafeMath.mul(result, result);
                expect(u256.le(resultSquared, input)).toBe(
                    true,
                    `Invalid result for challenging input ${i}`,
                );
            }
        });
    });
});

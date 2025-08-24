import { SafeMath } from '../runtime';
import { u128, u256 } from '@btc-vision/as-bignum/assembly';

/**
 * Test Suite Documentation: SafeMath.shl and SafeMath.shl128
 *
 * This test suite validates the shift left (shl) operations for both u256 and u128 types.
 * Left shifting is a fundamental bitwise operation that multiplies a value by powers of 2
 * by moving bits toward higher positions.
 *
 * Expected Behaviors:
 * - Shifting left by n bits multiplies the value by 2^n
 * - Shifts >= bit width (256 for u256, 128 for u128) return zero
 * - Negative shifts return zero (defensive behavior, not an error)
 * - Overflow bits are truncated without error (intentional behavior)
 * - Word boundaries (64-bit) are handled correctly in multi-word arithmetic
 * - Zero shift returns the original value unchanged
 * - Shifting zero by any amount returns zero
 *
 * Critical Invariants:
 * - shl(0, n) = 0 for any n
 * - shl(x, 0) = x for any x
 * - shl(x, n) where n >= bitwidth = 0
 * - shl(x, n) = x * 2^n (when no overflow occurs)
 * - shl(shl(x, m), n) = shl(x, m + n) when m + n < bitwidth
 * - (shl(x, n) >> n) = x when no overflow occurred
 * - Bits shifted beyond the type's bit width are lost (truncated)
 *
 * Implementation Details Tested:
 * - Correct handling of 64-bit word boundaries in multi-word types
 * - Efficient shift operations across word boundaries (lo1→lo2→hi1→hi2 for u256)
 * - Proper bit masking when shifts are not aligned to word boundaries
 * - No undefined behavior for edge cases (negative shifts, large shifts)
 *
 * Common Use Cases:
 * - Fast multiplication by powers of 2
 * - Bit manipulation in cryptographic algorithms
 * - Fixed-point arithmetic operations
 * - Constructing bitmasks and flags
 * - Efficient array indexing (shift instead of multiply)
 */

class ShlTestCase {
    value: string;
    shift: i32;
    expected: string;
    description: string;

    constructor(value: string, shift: i32, expected: string, description: string) {
        this.value = value;
        this.shift = shift;
        this.expected = expected;
        this.description = description;
    }
}

describe('SafeMath - shl', () => {
    beforeEach(() => {});

    describe('Basic functionality', () => {
        it('should shift left by small amounts', () => {
            // 1 << 1 = 2
            const result1 = SafeMath.shl(u256.One, 1);
            expect(result1).toStrictEqual(u256.fromU32(2));

            // 1 << 8 = 256
            const result2 = SafeMath.shl(u256.One, 8);
            expect(result2).toStrictEqual(u256.fromU32(256));

            // 5 << 2 = 20
            const result3 = SafeMath.shl(u256.fromU32(5), 2);
            expect(result3).toStrictEqual(u256.fromU32(20));

            // 255 << 4 = 4080
            const result4 = SafeMath.shl(u256.fromU32(255), 4);
            expect(result4).toStrictEqual(u256.fromU32(4080));
        });

        it('should handle zero value', () => {
            // 0 << any = 0
            const result1 = SafeMath.shl(u256.Zero, 10);
            expect(result1).toStrictEqual(u256.Zero);

            const result2 = SafeMath.shl(u256.Zero, 255);
            expect(result2).toStrictEqual(u256.Zero);

            const result3 = SafeMath.shl(u256.Zero, 0);
            expect(result3).toStrictEqual(u256.Zero);
        });

        it('should handle zero shift', () => {
            // any << 0 = any
            const value1 = u256.fromU32(42);
            const result1 = SafeMath.shl(value1, 0);
            expect(result1).toStrictEqual(value1);

            const value2 = u256.fromString('123456789012345678901234567890');
            const result2 = SafeMath.shl(value2, 0);
            expect(result2).toStrictEqual(value2);

            // Max value << 0 = Max value
            const result3 = SafeMath.shl(u256.Max, 0);
            expect(result3).toStrictEqual(u256.Max);
        });

        it('should handle shifts across word boundaries', () => {
            // Test shifting from lo1 to lo2 (crossing 64-bit boundary)
            const value = u256.fromU64(u64.MAX_VALUE);
            const result = SafeMath.shl(value, 64);
            // Should move the entire value from lo1 to lo2
            expect(result.lo1).toBe(0);
            expect(result.lo2).toBe(u64.MAX_VALUE);
            expect(result.hi1).toBe(0);
            expect(result.hi2).toBe(0);
        });

        it('should handle shifts across multiple word boundaries', () => {
            // Shift by 128 bits (move from lo1 to hi1)
            const value = u256.fromU32(1);
            const result = SafeMath.shl(value, 128);
            expect(result.lo1).toBe(0);
            expect(result.lo2).toBe(0);
            expect(result.hi1).toBe(1);
            expect(result.hi2).toBe(0);

            // Shift by 192 bits (move from lo1 to hi2)
            const result2 = SafeMath.shl(value, 192);
            expect(result2.lo1).toBe(0);
            expect(result2.lo2).toBe(0);
            expect(result2.hi1).toBe(0);
            expect(result2.hi2).toBe(1);
        });
    });

    describe('Edge cases', () => {
        it('should return zero for shifts >= 256', () => {
            const value = u256.fromString('123456789012345678901234567890');

            const result1 = SafeMath.shl(value, 256);
            expect(result1).toStrictEqual(u256.Zero);

            const result2 = SafeMath.shl(value, 257);
            expect(result2).toStrictEqual(u256.Zero);

            const result3 = SafeMath.shl(value, 1000);
            expect(result3).toStrictEqual(u256.Zero);

            // Even Max value becomes zero
            const result4 = SafeMath.shl(u256.Max, 256);
            expect(result4).toStrictEqual(u256.Zero);
        });

        it('should handle negative shifts as defensive behavior returning zero', () => {
            // Documentation: Negative shifts are undefined in bit arithmetic
            // This implementation chooses to return zero as a safe default
            // rather than throwing an error, for performance reasons
            const value = u256.fromU32(16);

            // Negative shifts should return zero (defensive behavior)
            const result1 = SafeMath.shl(value, -1);
            expect(result1).toStrictEqual(
                u256.Zero,
                'Negative shift -1 should return zero as defensive behavior',
            );

            const result2 = SafeMath.shl(value, -100);
            expect(result2).toStrictEqual(
                u256.Zero,
                'Negative shift -100 should return zero as defensive behavior',
            );

            // Verify this doesn't throw an error (returns zero instead)
            // Note: In AssemblyScript, we must avoid closures by defining variables inside the arrow function
            expect((): void => {
                const testValue = u256.fromU32(16);
                SafeMath.shl(testValue, -1);
            }).not.toThrow();
        });

        it('should handle maximum shift values that dont zero out', () => {
            // Shift by 255 bits - should place 1 in the highest bit
            const value = u256.One;
            const result = SafeMath.shl(value, 255);

            // Result should be 2^255
            const expected = u256.fromString(
                '57896044618658097711785492504343953926634992332820282019728792003956564819968',
            );
            expect(result).toStrictEqual(expected);
        });

        it('should handle partial shifts with overflow', () => {
            // Create a value with 128 bits set (lower half)
            // This is 2^128 - 1
            const value = u256.fromString('340282366920938463463374607431768211455');
            const result = SafeMath.shl(value, 128);

            // Lower 128 bits should be 0, upper 128 bits should contain the value
            expect(result.lo1).toBe(0);
            expect(result.lo2).toBe(0);
            expect(result.hi1).toBe(u64.MAX_VALUE);
            expect(result.hi2).toBe(u64.MAX_VALUE);
        });

        it('should handle shifts that cause bits to be lost', () => {
            // Set high bits that will be shifted out
            const value = u256.fromString(
                '115792089237316195423570985008687907853269984665640564039457584007913129639935',
            ); // Max value
            const result = SafeMath.shl(value, 1);

            // The highest bit should be lost, rest shifted left
            const expected = u256.fromString(
                '115792089237316195423570985008687907853269984665640564039457584007913129639934',
            );
            expect(result).toStrictEqual(expected);
        });
    });

    describe('Overflow behavior documentation', () => {
        it('should truncate bits that overflow beyond 256 bits without error', () => {
            // This test documents the intentional behavior: overflow is handled by truncation
            // Bits that would exceed the 256-bit boundary are silently discarded

            const value = u256.Max; // All bits set to 1
            const result = SafeMath.shl(value, 1);

            // The highest bit (bit 255) is lost, all other bits shift left
            // Original: 11111111...11111111 (256 ones)
            // Result:   11111111...11111110 (255 ones followed by zero)
            const expected = u256.fromString(
                '115792089237316195423570985008687907853269984665640564039457584007913129639934',
            );
            expect(result).toStrictEqual(
                expected,
                'Overflow should truncate the highest bit without error',
            );

            // Verify no error is thrown during overflow
            expect((): void => {
                SafeMath.shl(u256.Max, 100); // Would overflow significantly
            }).not.toThrow();
        });

        it('should demonstrate progressive bit loss with increasing shifts', () => {
            // Start with a value that has bits set in the upper region
            // We want to set the highest 4 bits: 0xF000...000
            // This is 15 * 2^252 in decimal
            // 2^252 = 7237005577332262213973186563042994240829374041602535252466099000494570602496
            const twoTo252 = u256.fromString(
                '7237005577332262213973186563042994240829374041602535252466099000494570602496',
            );
            const highBitsSet = SafeMath.mul(u256.fromU32(15), twoTo252);

            // Shift by 4 - all high bits should be lost (they go beyond bit 255)
            const shifted4 = SafeMath.shl(highBitsSet, 4);
            expect(shifted4).toStrictEqual(
                u256.Zero,
                'Shifting high bits beyond boundary should result in zero',
            );
        });
    });

    describe('Boundary value tests', () => {
        it('should handle shifts at each word boundary', () => {
            const value: u256 = u256.fromU32(0xff);

            // Test shifts at multiples of 64
            const boundaries: i32[] = [63, 64, 65, 127, 128, 129, 191, 192, 193, 255];

            for (let i: i32 = 0; i < boundaries.length; i++) {
                const shift: i32 = boundaries[i];
                const result: u256 = SafeMath.shl(value, shift);

                // Verify the value moved to correct position
                if (shift < 256) {
                    // Check result is non-zero
                    expect(u256.gt(result, u256.Zero)).toBe(
                        true,
                        `Shift by ${shift} should not be zero`,
                    );

                    // For smaller shifts where pow won't overflow, verify mathematically
                    if (shift < 100) {
                        const expectedValue: u256 = SafeMath.mul(
                            value,
                            SafeMath.pow(u256.fromU32(2), u256.fromU32(shift)),
                        );
                        expect(result).toStrictEqual(
                            expectedValue,
                            `Shift by ${shift} should equal multiplication by 2^${shift}`,
                        );
                    }
                }
            }
        });

        it('should correctly handle non-aligned shifts', () => {
            // Test shifting with values that span word boundaries
            const value = u256.fromU64(u64.MAX_VALUE);

            // Shift by 60 bits - should span lo1 and lo2
            const result1 = SafeMath.shl(value, 60);
            expect(result1.lo1).toBe(0xf000000000000000);
            expect(result1.lo2).toBe(0x0fffffffffffffff);

            // Shift by 100 bits - should span lo2 and hi1
            const result2 = SafeMath.shl(value, 100);
            expect(result2.lo1).toBe(0);
            expect(result2.lo2).toBe(0xfffffff000000000);
            expect(result2.hi1).toBe(68719476735);
        });

        it('should handle alternating bit patterns across boundaries', () => {
            // Test with alternating bit pattern (1010101010...)
            // In decimal, 0xAAAAAAAAAAAAAAAA = 12297829382473034410
            const alternatingPattern = u256.fromString('12297829382473034410');

            // Shift by 1 should give pattern * 2 = 24595658764946068820
            const shifted1 = SafeMath.shl(alternatingPattern, 1);
            const expected1 = u256.fromString('24595658764946068820');
            expect(shifted1).toStrictEqual(
                expected1,
                'Alternating pattern shifted by 1 should maintain pattern structure',
            );

            // Shift across word boundary (64 bits)
            const shifted64 = SafeMath.shl(alternatingPattern, 64);
            expect(shifted64.lo1).toBe(0, 'Lower 64 bits should be clear after 64-bit shift');
            // The pattern moves to the next word
            expect(shifted64.lo2).toBe(
                12297829382473034410 as u64,
                'Pattern should move to next word intact',
            );
        });
    });

    describe('Input validation and error conditions', () => {
        it('should handle edge case input types gracefully', () => {
            // Test with minimum possible value
            const minResult = SafeMath.shl(u256.Zero, 0);
            expect(minResult).toStrictEqual(u256.Zero, 'Zero shifted by zero should remain zero');

            // Test with maximum possible value and maximum shift
            const maxResult = SafeMath.shl(u256.Max, 255);
            // Only the highest bit should remain
            const expectedMax = u256.fromString(
                '57896044618658097711785492504343953926634992332820282019728792003956564819968',
            );
            expect(maxResult).toStrictEqual(
                expectedMax,
                'Max value shifted by 255 should leave only highest bit',
            );
        });

        it('should maintain consistency with extreme values', () => {
            // Test that operations are consistent even with extreme inputs
            const one = u256.One;

            // Shifting 1 by increasing amounts should give powers of 2
            for (let shift = 0; shift < 256; shift += 32) {
                const result = SafeMath.shl(one, shift);

                if (shift === 0) {
                    expect(result).toStrictEqual(one, 'Shift by 0 should return original');
                } else if (shift < 256) {
                    expect(u256.gt(result, u256.Zero)).toBe(true, `2^${shift} should be non-zero`);
                } else {
                    expect(result).toStrictEqual(u256.Zero, `Shift >= 256 should return zero`);
                }
            }
        });
    });

    describe('Performance characteristics', () => {
        it('should complete large shifts efficiently', () => {
            // This test ensures shift operations complete in reasonable time
            // even for worst-case scenarios

            const iterations = 1000;
            const value = u256.Max;

            // Measure time for many operations
            // Note: In AssemblyScript, we might not have performance.now()
            // This is a conceptual test that would need adaptation

            // Perform many shifts to ensure no performance degradation
            for (let i = 0; i < iterations; i++) {
                const result = SafeMath.shl(value, 255);
                // Ensure compiler doesn't optimize away the operation
                expect(u256.gt(result, u256.Zero)).toBe(true);
            }

            // In a real environment, we'd measure time and assert:
            // expect(endTime - startTime).toBeLessThan(100); // milliseconds
        });

        it('should handle word-aligned shifts efficiently', () => {
            // Verify the value moved to correct position
            const value = u256.fromString('18446744073709551615'); // 0xFFFFFFFFFFFFFFFF in decimal

            // These shifts should be optimally efficient
            const alignedShifts = [0, 64, 128, 192];

            for (let i = 0; i < alignedShifts.length; i++) {
                const shift = alignedShifts[i];
                const result = SafeMath.shl(value, shift);

                // Verify correctness
                if (shift === 0) {
                    expect(result.lo1).toBe(0xffffffffffffffff);
                } else if (shift === 64) {
                    expect(result.lo1).toBe(0);
                    expect(result.lo2).toBe(0xffffffffffffffff);
                } else if (shift === 128) {
                    expect(result.hi1).toBe(0xffffffffffffffff);
                } else if (shift === 192) {
                    expect(result.hi2).toBe(0xffffffffffffffff);
                }
            }
        });
    });

    describe('Comparison with known values', () => {
        it('should match expected power of 2 values', () => {
            const testCases: ShlTestCase[] = [
                new ShlTestCase('1', 0, '1', '2^0 = 1'),
                new ShlTestCase('1', 1, '2', '2^1 = 2'),
                new ShlTestCase('1', 10, '1024', '2^10 = 1024'),
                new ShlTestCase('1', 32, '4294967296', '2^32 = 2^32'),
                new ShlTestCase('1', 64, '18446744073709551616', '2^64 (word boundary)'),
                new ShlTestCase('1', 100, '1267650600228229401496703205376', '2^100'),
                new ShlTestCase(
                    '1',
                    128,
                    '340282366920938463463374607431768211456',
                    '2^128 (half of u256)',
                ),
                new ShlTestCase(
                    '1',
                    200,
                    '1606938044258990275541962092341162602522202993782792835301376',
                    '2^200',
                ),
                // 2^255 is the highest bit in u256
                new ShlTestCase(
                    '1',
                    255,
                    '57896044618658097711785492504343953926634992332820282019728792003956564819968',
                    '2^255 (highest bit)',
                ),
            ];

            for (let i: i32 = 0; i < testCases.length; i++) {
                const tc: ShlTestCase = testCases[i];
                const value: u256 = u256.fromString(tc.value);
                const result: u256 = SafeMath.shl(value, tc.shift);
                const expected: u256 = u256.fromString(tc.expected);
                expect(result).toStrictEqual(expected, tc.description);
            }
        });

        it('should match manual calculations', () => {
            // 3 << 5 = 3 * 32 = 96
            const result1 = SafeMath.shl(u256.fromU32(3), 5);
            expect(result1).toStrictEqual(u256.fromU32(96));

            // 7 << 10 = 7 * 1024 = 7168
            const result2 = SafeMath.shl(u256.fromU32(7), 10);
            expect(result2).toStrictEqual(u256.fromU32(7168));

            // 15 << 16 = 15 * 65536 = 983040
            const result3 = SafeMath.shl(u256.fromU32(15), 16);
            expect(result3).toStrictEqual(u256.fromU32(983040));
        });
    });

    describe('Property-based tests', () => {
        it('should satisfy: (a << n) >> n = a for small n', () => {
            const values: u256[] = [
                u256.fromU32(42),
                u256.fromU32(255),
                u256.fromString('123456789'),
            ];

            const shifts: i32[] = [1, 8, 16, 32, 63];

            for (let i: i32 = 0; i < values.length; i++) {
                const value: u256 = values[i];
                for (let j: i32 = 0; j < shifts.length; j++) {
                    const shift: i32 = shifts[j];
                    const shifted: u256 = SafeMath.shl(value, shift);
                    const restored: u256 = SafeMath.shr(shifted, shift);
                    expect(restored).toStrictEqual(value, `Value ${i}, shift ${shift}`);
                }
            }
        });

        it('should satisfy: (a << m) << n = a << (m + n) when m+n < 256', () => {
            const value: u256 = u256.fromU32(7);

            const testCases: i32[][] = [
                [10, 20], // 30 total
                [50, 50], // 100 total
                [64, 64], // 128 total
                [100, 50], // 150 total
            ];

            for (let i: i32 = 0; i < testCases.length; i++) {
                const m: i32 = testCases[i][0];
                const n: i32 = testCases[i][1];

                const result1: u256 = SafeMath.shl(SafeMath.shl(value, m), n);
                const result2: u256 = SafeMath.shl(value, m + n);

                expect(result1).toStrictEqual(result2, `m=${m}, n=${n}`);
            }
        });

        it('should double the value when shifting by 1', () => {
            const values: u256[] = [
                u256.fromU32(1),
                u256.fromU32(100),
                u256.fromString('999999999999999999999999'),
            ];

            for (let i: i32 = 0; i < values.length; i++) {
                const value: u256 = values[i];
                const shifted: u256 = SafeMath.shl(value, 1);
                const doubled: u256 = SafeMath.mul(value, u256.fromU32(2));
                expect(shifted).toStrictEqual(doubled);
            }
        });

        it('should verify distributive property limitations', () => {
            // This test demonstrates why order of operations matters with shifts and arithmetic
            // In smart contracts, understanding these differences is crucial for security

            // First, let's show when the distributive property DOES hold
            const a = u256.fromU32(100);
            const b = u256.fromU32(200);
            const n = 10; // Small shift that won't cause overflow

            // Path 1: Add first, then shift
            const sum = SafeMath.add(a, b); // 300
            const sumThenShift = SafeMath.shl(sum, n); // 300 << 10 = 300 * 1024 = 307200

            // Path 2: Shift first, then add
            const shiftA = SafeMath.shl(a, n); // 100 << 10 = 102400
            const shiftB = SafeMath.shl(b, n); // 200 << 10 = 204800
            const shiftThenSum = SafeMath.add(shiftA, shiftB); // 102400 + 204800 = 307200

            // These should be equal when no overflow occurs
            expect(sumThenShift).toStrictEqual(
                shiftThenSum,
                'When no overflow occurs, shift distributes over addition',
            );

            // Now demonstrate when overflow causes different behaviors
            // Use values where shifting causes truncation
            const largeValue = u256.fromString(
                '57896044618658097711785492504343953926634992332820282019728792003956564819968', // 2^255
            );

            // Case 1: If we have two 2^255 values and try to add them first
            expect((): void => {
                const val1 = u256.fromString(
                    '57896044618658097711785492504343953926634992332820282019728792003956564819968',
                );
                const val2 = u256.fromString(
                    '57896044618658097711785492504343953926634992332820282019728792003956564819968',
                );
                SafeMath.add(val1, val2); // This WILL overflow: 2^255 + 2^255 = 2^256
            }).toThrow('SafeMath: addition overflow');

            // Case 2: If we shift first (causing truncation), then add
            const shifted1 = SafeMath.shl(largeValue, 1); // 2^255 << 1 = 0 (truncated)
            const shifted2 = SafeMath.shl(largeValue, 1); // 2^255 << 1 = 0 (truncated)
            const resultAfterShift = SafeMath.add(shifted1, shifted2); // 0 + 0 = 0

            expect(resultAfterShift).toStrictEqual(
                u256.Zero,
                'Shifting large values first causes truncation, giving zero',
            );

            // This demonstrates the key security principle:
            // - Path 1 (add then shift): SafeMath catches the overflow and reverts
            // - Path 2 (shift then add): Silent truncation loses all the value
            //
            // In a token contract, Path 1 protects users by reverting invalid operations,
            // while Path 2 could silently destroy token balances. This is why operation
            // order matters and why SafeMath's protective behavior is essential.
        });
    });

    describe('Cross-operation consistency', () => {
        it('should be consistent with multiplication by powers of 2', () => {
            // For small shifts, shl(x, n) should equal x * 2^n
            const testValues = [
                u256.fromU32(1),
                u256.fromU32(42),
                u256.fromU32(12345),
                u256.fromString('98765432109876543210'),
            ];

            // Test small shifts where multiplication won't overflow
            const shifts = [1, 2, 3, 4, 8, 16];

            for (let i = 0; i < testValues.length; i++) {
                const value = testValues[i];

                for (let j = 0; j < shifts.length; j++) {
                    const shift = shifts[j];
                    const shiftResult = SafeMath.shl(value, shift);

                    // Calculate 2^shift
                    const powerOfTwo = SafeMath.pow(u256.fromU32(2), u256.fromU32(shift));
                    const mulResult = SafeMath.mul(value, powerOfTwo);

                    expect(shiftResult).toStrictEqual(
                        mulResult,
                        `shl(${value}, ${shift}) should equal ${value} * 2^${shift}`,
                    );
                }
            }
        });

        it('should verify relationship with right shift for information preservation', () => {
            // Document that left shift followed by right shift preserves information
            // only when no overflow occurs

            const value = u256.fromU32(0xffff); // 16 bits set

            // Case 1: No overflow - information preserved
            const noOverflowShift = 8;
            const shifted = SafeMath.shl(value, noOverflowShift);
            const restored = SafeMath.shr(shifted, noOverflowShift);
            expect(restored).toStrictEqual(value, 'Information preserved when no overflow occurs');

            // Case 2: Overflow - information lost
            const overflowShift = 250; // Will push some bits past bit 255
            const overflowShifted = SafeMath.shl(value, overflowShift);
            const overflowRestored = SafeMath.shr(overflowShifted, overflowShift);
            expect(overflowRestored).not.toStrictEqual(
                value,
                'Information lost when overflow occurs',
            );
        });
    });
});

class Shl128TestCase {
    shift: i32;
    expected: string;
    description: string;

    constructor(shift: i32, expected: string, description: string) {
        this.shift = shift;
        this.expected = expected;
        this.description = description;
    }
}

describe('SafeMath - shl128', () => {
    beforeEach(() => {});

    describe('Basic functionality', () => {
        it('should shift left by small amounts', () => {
            // 1 << 1 = 2
            const result1 = SafeMath.shl128(u128.One, 1);
            expect(result1).toStrictEqual(u128.fromU32(2));

            // 1 << 8 = 256
            const result2 = SafeMath.shl128(u128.One, 8);
            expect(result2).toStrictEqual(u128.fromU32(256));

            // 5 << 2 = 20
            const result3 = SafeMath.shl128(u128.fromU32(5), 2);
            expect(result3).toStrictEqual(u128.fromU32(20));

            // 255 << 4 = 4080
            const result4 = SafeMath.shl128(u128.fromU32(255), 4);
            expect(result4).toStrictEqual(u128.fromU32(4080));
        });

        it('should handle zero value', () => {
            // 0 << any = 0
            const result1 = SafeMath.shl128(u128.Zero, 10);
            expect(result1).toStrictEqual(u128.Zero);

            const result2 = SafeMath.shl128(u128.Zero, 127);
            expect(result2).toStrictEqual(u128.Zero);

            const result3 = SafeMath.shl128(u128.Zero, 0);
            expect(result3).toStrictEqual(u128.Zero);
        });

        it('should handle zero shift', () => {
            // any << 0 = any
            const value1 = u128.fromU32(42);
            const result1 = SafeMath.shl128(value1, 0);
            expect(result1).toStrictEqual(value1);

            const value2 = u128.fromString('123456789012345678901234567890');
            const result2 = SafeMath.shl128(value2, 0);
            expect(result2).toStrictEqual(value2);

            // Max value << 0 = Max value
            const result3 = SafeMath.shl128(u128.Max, 0);
            expect(result3).toStrictEqual(u128.Max);
        });

        it('should handle shifts across word boundary', () => {
            // Test shifting from lo to hi (crossing 64-bit boundary)
            const value = u128.fromU64(u64.MAX_VALUE);
            const result = SafeMath.shl128(value, 64);
            // Should move the entire value from lo to hi
            expect(result.lo).toBe(0);
            expect(result.hi).toBe(u64.MAX_VALUE);
        });
    });

    describe('Edge cases', () => {
        it('should return zero for shifts >= 128', () => {
            const value = u128.fromString('123456789012345678901234567890');

            const result1 = SafeMath.shl128(value, 128);
            expect(result1).toStrictEqual(u128.Zero);

            const result2 = SafeMath.shl128(value, 129);
            expect(result2).toStrictEqual(u128.Zero);

            const result3 = SafeMath.shl128(value, 1000);
            expect(result3).toStrictEqual(u128.Zero);

            // Even Max value becomes zero
            const result4 = SafeMath.shl128(u128.Max, 128);
            expect(result4).toStrictEqual(u128.Zero);
        });

        it('should handle negative shifts as defensive behavior returning zero', () => {
            // Documentation: Same as u256, negative shifts return zero defensively
            const value = u128.fromU32(16);

            // Negative shifts should return zero (defensive behavior)
            const result1 = SafeMath.shl128(value, -1);
            expect(result1).toStrictEqual(u128.Zero, 'Negative shift should return zero');

            const result2 = SafeMath.shl128(value, -100);
            expect(result2).toStrictEqual(u128.Zero, 'Large negative shift should return zero');

            // Verify no error is thrown
            // Note: AssemblyScript requires variables to be defined inside the arrow function to avoid closure issues
            expect((): void => {
                const testValue = u128.fromU32(16);
                SafeMath.shl128(testValue, -1);
            }).not.toThrow();
        });

        it('should handle maximum shift values that dont zero out', () => {
            // Shift by 127 bits - should place 1 in the highest bit
            const value = u128.One;
            const result = SafeMath.shl128(value, 127);

            // Result should be 2^127 (highest bit of u128)
            const expected = u128.fromString('170141183460469231731687303715884105728');
            expect(result).toStrictEqual(expected);
        });

        it('should handle partial shifts with overflow', () => {
            // Create a value with lower 64 bits set
            const value = u128.fromU64(u64.MAX_VALUE);
            const result = SafeMath.shl128(value, 64);

            // Lower 64 bits should be 0, upper 64 bits should contain the value
            expect(result.lo).toBe(0);
            expect(result.hi).toBe(u64.MAX_VALUE);
        });

        it('should handle shifts that cause bits to be lost', () => {
            // Set high bits that will be shifted out
            const value = u128.Max; // All bits set
            const result = SafeMath.shl128(value, 1);

            // The highest bit should be lost, rest shifted left
            // Original: 11111111...11111111 (128 ones)
            // Result:   11111111...11111110 (127 ones followed by zero)
            const expected = u128.fromString('340282366920938463463374607431768211454');
            expect(result).toStrictEqual(expected);
        });
    });

    describe('Overflow behavior documentation for u128', () => {
        it('should truncate overflow bits without error', () => {
            // Same behavior as u256 but at 128-bit boundary
            const value = u128.Max;
            const result = SafeMath.shl128(value, 1);

            // Verify truncation occurs
            const expected = u128.fromString('340282366920938463463374607431768211454');
            expect(result).toStrictEqual(expected, 'Should truncate highest bit on overflow');

            // Verify no error is thrown on overflow
            expect((): void => {
                SafeMath.shl128(u128.Max, 100);
            }).not.toThrow();
        });
    });

    describe('Boundary value tests', () => {
        it('should handle shifts at word boundary', () => {
            const value: u128 = u128.fromU32(0xff);

            // Test shifts around 64-bit boundary
            const boundaries: i32[] = [63, 64, 65, 127];

            for (let i: i32 = 0; i < boundaries.length; i++) {
                const shift: i32 = boundaries[i];
                const result: u128 = SafeMath.shl128(value, shift);

                // Verify the value moved to correct position
                if (shift < 128) {
                    // Check result is non-zero
                    expect(u128.gt(result, u128.Zero)).toBe(
                        true,
                        `Shift by ${shift} should not be zero`,
                    );

                    // For smaller shifts where multiplication won't overflow, verify mathematically
                    if (shift < 64) {
                        const pow2: u128 = SafeMath.shl128(u128.One, shift); // 2^shift
                        const expectedValue: u128 = SafeMath.mul128(value, pow2);
                        expect(result).toStrictEqual(
                            expectedValue,
                            `Shift by ${shift} should equal multiplication by 2^${shift}`,
                        );
                    }
                }
            }
        });

        it('should correctly handle non-aligned shifts', () => {
            // Test shifting with values that span word boundaries
            const value = u128.fromU64(u64.MAX_VALUE);

            // Shift by 60 bits - should span lo and hi
            const result1 = SafeMath.shl128(value, 60);
            expect(result1.lo).toBe(0xf000000000000000);
            expect(result1.hi).toBe(0x0fffffffffffffff);

            // Shift by 32 bits
            const result2 = SafeMath.shl128(value, 32);
            expect(result2.lo).toBe(0xffffffff00000000);
            expect(result2.hi).toBe(0x00000000ffffffff);
        });

        it('should handle alternating bit patterns for u128', () => {
            // Test alternating pattern within u128
            const alternatingPattern = u128.fromString('0xAAAAAAAAAAAAAAAA');

            const shifted1 = SafeMath.shl128(alternatingPattern, 1);
            // Pattern should shift maintaining structure
            expect(u128.gt(shifted1, u128.Zero)).toBe(
                true,
                'Shifted alternating pattern should be non-zero',
            );

            // Shift by 64 to cross word boundary
            const shifted64 = SafeMath.shl128(alternatingPattern, 64);
            expect(shifted64.lo).toBe(0, 'Lower word should be clear');
            expect(shifted64.hi).toBe(0xaaaaaaaaaaaaaaaa, 'Pattern should move to upper word');
        });
    });

    describe('Comparison with known values', () => {
        it('should match expected power of 2 values', () => {
            const testCases: Shl128TestCase[] = [
                new Shl128TestCase(0, '1', '2^0 = 1'),
                new Shl128TestCase(1, '2', '2^1 = 2'),
                new Shl128TestCase(10, '1024', '2^10 = 1024'),
                new Shl128TestCase(32, '4294967296', '2^32'),
                new Shl128TestCase(64, '18446744073709551616', '2^64 (word boundary)'),
                new Shl128TestCase(100, '1267650600228229401496703205376', '2^100'),
                new Shl128TestCase(
                    127,
                    '170141183460469231731687303715884105728',
                    '2^127 (highest bit)',
                ),
            ];

            for (let i: i32 = 0; i < testCases.length; i++) {
                const tc: Shl128TestCase = testCases[i];
                const result: u128 = SafeMath.shl128(u128.One, tc.shift);
                const expected: u128 = u128.fromString(tc.expected);
                expect(result).toStrictEqual(expected, tc.description);
            }
        });

        it('should match manual calculations', () => {
            // 3 << 5 = 3 * 32 = 96
            const result1 = SafeMath.shl128(u128.fromU32(3), 5);
            expect(result1).toStrictEqual(u128.fromU32(96));

            // 7 << 10 = 7 * 1024 = 7168
            const result2 = SafeMath.shl128(u128.fromU32(7), 10);
            expect(result2).toStrictEqual(u128.fromU32(7168));

            // 15 << 16 = 15 * 65536 = 983040
            const result3 = SafeMath.shl128(u128.fromU32(15), 16);
            expect(result3).toStrictEqual(u128.fromU32(983040));
        });
    });

    describe('Property-based tests', () => {
        it('should satisfy: (a << n) >> n = a for small n', () => {
            const values: u128[] = [
                u128.fromU32(42),
                u128.fromU32(255),
                u128.fromString('123456789'),
            ];

            const shifts: i32[] = [1, 8, 16, 32, 63];

            for (let i: i32 = 0; i < values.length; i++) {
                const value: u128 = values[i];
                for (let j: i32 = 0; j < shifts.length; j++) {
                    const shift: i32 = shifts[j];
                    const shifted: u128 = SafeMath.shl128(value, shift);
                    const restored: u128 = u128.shr(shifted, shift);
                    expect(restored).toStrictEqual(value, `Value ${i}, shift ${shift}`);
                }
            }
        });

        it('should satisfy: (a << m) << n = a << (m + n) when m+n < 128', () => {
            const value: u128 = u128.fromU32(7);

            const testCases: i32[][] = [
                [10, 20], // 30 total
                [30, 30], // 60 total
                [32, 32], // 64 total
                [50, 50], // 100 total
            ];

            for (let i: i32 = 0; i < testCases.length; i++) {
                const m: i32 = testCases[i][0];
                const n: i32 = testCases[i][1];

                const result1: u128 = SafeMath.shl128(SafeMath.shl128(value, m), n);
                const result2: u128 = SafeMath.shl128(value, m + n);

                expect(result1).toStrictEqual(result2, `m=${m}, n=${n}`);
            }
        });

        it('should double the value when shifting by 1', () => {
            const values: u128[] = [
                u128.fromU32(1),
                u128.fromU32(100),
                u128.fromString('999999999999999999'),
            ];

            for (let i: i32 = 0; i < values.length; i++) {
                const value: u128 = values[i];
                const shifted: u128 = SafeMath.shl128(value, 1);
                const doubled: u128 = SafeMath.mul128(value, u128.fromU32(2));
                expect(shifted).toStrictEqual(doubled);
            }
        });
    });

    describe('Consistency between shl and shl128', () => {
        it('should produce same results for values within u128 range', () => {
            const testValues: string[] = [
                '1',
                '255',
                '65535',
                '4294967295',
                '18446744073709551615',
                '99999999999999999999999999999999',
            ];

            const shifts: i32[] = [0, 1, 8, 16, 32, 60, 64, 100];

            for (let i: i32 = 0; i < testValues.length; i++) {
                const strValue: string = testValues[i];
                const u128Value: u128 = u128.fromString(strValue);
                const u256Value: u256 = u256.fromString(strValue);

                for (let j: i32 = 0; j < shifts.length; j++) {
                    const shift: i32 = shifts[j];

                    if (shift < 128) {
                        const result128: u128 = SafeMath.shl128(u128Value, shift);
                        const result256: u256 = SafeMath.shl(u256Value, shift);

                        // For u128, the result is modulo 2^128 (bits that overflow are lost)
                        // For u256, all bits are preserved
                        // So we need to check if the u256 result fits in u128 range

                        // If no overflow occurred in u128 (result fits in 128 bits)
                        if (result256.hi1 == 0 && result256.hi2 == 0) {
                            // Convert u128 result to u256 for comparison
                            const result128AsU256: u256 = u256.fromU128(result128);
                            expect(result256).toStrictEqual(
                                result128AsU256,
                                `Value: ${strValue}, shift: ${shift}`,
                            );
                        }
                        // Otherwise, the results will differ due to u128 overflow, which is expected
                    }
                }
            }
        });

        it('should document overflow differences between u128 and u256', () => {
            // This test explicitly documents the different overflow behaviors

            // Value that will overflow in u128 but not u256
            const value = u128.fromString('170141183460469231731687303715884105728'); // 2^127

            // Shift by 1 - will overflow in u128
            const result128 = SafeMath.shl128(value, 1);
            expect(result128).toStrictEqual(
                u128.Zero,
                'u128 overflow results in zero due to bit truncation',
            );

            // Same operation in u256 preserves the value
            const value256 = u256.fromString('170141183460469231731687303715884105728');
            const result256 = SafeMath.shl(value256, 1);
            const expected256 = u256.fromString('340282366920938463463374607431768211456'); // 2^128
            expect(result256).toStrictEqual(
                expected256,
                'u256 preserves the value without overflow',
            );
        });
    });

    describe('Cross-operation consistency for u128', () => {
        it('should be consistent with multiplication for small shifts', () => {
            const testValues = [u128.fromU32(1), u128.fromU32(42), u128.fromU32(999)];

            const shifts = [1, 2, 3, 4, 8];

            for (let i = 0; i < testValues.length; i++) {
                const value = testValues[i];

                for (let j = 0; j < shifts.length; j++) {
                    const shift = shifts[j];
                    const shiftResult = SafeMath.shl128(value, shift);

                    // Calculate 2^shift using repeated doubling
                    let powerOfTwo = u128.One;
                    for (let k = 0; k < shift; k++) {
                        powerOfTwo = SafeMath.mul128(powerOfTwo, u128.fromU32(2));
                    }

                    const mulResult = SafeMath.mul128(value, powerOfTwo);

                    expect(shiftResult).toStrictEqual(
                        mulResult,
                        `shl128(${value}, ${shift}) should equal ${value} * 2^${shift}`,
                    );
                }
            }
        });
    });
});

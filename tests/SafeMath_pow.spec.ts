import { SafeMath } from '../runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

/**
 * Test Suite Documentation: SafeMath.pow and SafeMath.pow10
 *
 * This test suite validates the exponentiation operations for arbitrary bases (pow)
 * and the specialized base-10 exponentiation (pow10). These operations are critical
 * for mathematical computations in smart contracts, particularly for token scaling,
 * interest calculations, and scientific notation conversions.
 *
 * Expected Behaviors:
 * - pow(base, exponent) computes base^exponent using binary exponentiation
 * - pow10(n) efficiently computes 10^n as a specialized operation
 * - Any non-zero number raised to power 0 returns 1 (including 0^0 = 1)
 * - Any number raised to power 1 returns itself
 * - 0 raised to any positive power returns 0
 * - 1 raised to any power returns 1
 * - Throws on overflow when result exceeds u256.Max
 * - Uses square-and-multiply algorithm for efficiency (O(log n) multiplications)
 *
 * Critical Invariants:
 * - pow(x, 0) = 1 for any x (including x = 0)
 * - pow(x, 1) = x for any x
 * - pow(0, n) = 0 for n > 0
 * - pow(1, n) = 1 for any n
 * - pow(a, m+n) = pow(a, m) * pow(a, n) (additive property of exponents)
 * - pow(pow(a, m), n) = pow(a, m*n) (multiplicative property of exponents)
 * - pow(a*b, n) = pow(a, n) * pow(b, n) (distributive property)
 * - pow10(n) = pow(10, n) (consistency between specialized and general functions)
 * - Result must not exceed u256.Max (overflow detection required)
 *
 * Implementation Algorithm (Binary Exponentiation):
 * - Processes exponent bits from right to left
 * - Squares the base for each bit position
 * - Multiplies result when bit is set
 * - Achieves O(log n) complexity instead of O(n) for naive multiplication
 *
 * Common Use Cases:
 * - Token decimal scaling (10^18 for ETH wei conversion)
 * - Compound interest calculations
 * - Scientific notation operations
 * - Cryptographic computations (modular exponentiation foundation)
 * - Fixed-point arithmetic operations
 *
 * Overflow Boundaries:
 * - 2^256 causes overflow (max safe: 2^255)
 * - 10^78 causes overflow (max safe: 10^77)
 * - Large bases with small exponents may overflow (e.g., (2^128)^3)
 */

class PowTestCase {
    base: string;
    exponent: string;
    expected: string;
    description: string;

    constructor(base: string, exponent: string, expected: string, description: string) {
        this.base = base;
        this.exponent = exponent;
        this.expected = expected;
        this.description = description;
    }
}

describe('SafeMath - pow', () => {
    beforeEach(() => {});

    describe('Basic functionality', () => {
        it('should compute small powers correctly', () => {
            // 2^3 = 8
            const result1 = SafeMath.pow(u256.fromU32(2), u256.fromU32(3));
            expect(result1).toStrictEqual(u256.fromU32(8));

            // 3^4 = 81
            const result2 = SafeMath.pow(u256.fromU32(3), u256.fromU32(4));
            expect(result2).toStrictEqual(u256.fromU32(81));

            // 5^3 = 125
            const result3 = SafeMath.pow(u256.fromU32(5), u256.fromU32(3));
            expect(result3).toStrictEqual(u256.fromU32(125));

            // 10^5 = 100000
            const result4 = SafeMath.pow(u256.fromU32(10), u256.fromU32(5));
            expect(result4).toStrictEqual(u256.fromU32(100000));
        });

        it('should handle power of zero', () => {
            // Any number^0 = 1
            expect(SafeMath.pow(u256.fromU32(0), u256.Zero)).toStrictEqual(u256.One);
            expect(SafeMath.pow(u256.fromU32(1), u256.Zero)).toStrictEqual(u256.One);
            expect(SafeMath.pow(u256.fromU32(100), u256.Zero)).toStrictEqual(u256.One);
            expect(SafeMath.pow(u256.fromString('999999999999'), u256.Zero)).toStrictEqual(
                u256.One,
            );
        });

        it('should handle power of one', () => {
            // Any number^1 = number
            const testValues = [
                u256.Zero,
                u256.One,
                u256.fromU32(42),
                u256.fromString('123456789012345678901234567890'),
            ];

            for (let i = 0; i < testValues.length; i++) {
                const val = testValues[i];
                const result = SafeMath.pow(val, u256.One);
                expect(result).toStrictEqual(val);
            }
        });

        it('should handle base of zero', () => {
            // 0^n = 0 for n > 0
            expect(SafeMath.pow(u256.Zero, u256.fromU32(1))).toStrictEqual(u256.Zero);
            expect(SafeMath.pow(u256.Zero, u256.fromU32(10))).toStrictEqual(u256.Zero);
            expect(SafeMath.pow(u256.Zero, u256.fromU32(100))).toStrictEqual(u256.Zero);
        });

        it('should handle base of one', () => {
            // 1^n = 1 for any n
            expect(SafeMath.pow(u256.One, u256.Zero)).toStrictEqual(u256.One);
            expect(SafeMath.pow(u256.One, u256.fromU32(1))).toStrictEqual(u256.One);
            expect(SafeMath.pow(u256.One, u256.fromU32(100))).toStrictEqual(u256.One);
            expect(SafeMath.pow(u256.One, u256.fromString('999999999999'))).toStrictEqual(u256.One);
        });

        it('should handle powers of two', () => {
            // Test powers of 2 up to reasonable values
            const two = u256.fromU32(2);

            // 2^8 = 256
            expect(SafeMath.pow(two, u256.fromU32(8))).toStrictEqual(u256.fromU32(256));

            // 2^16 = 65536
            expect(SafeMath.pow(two, u256.fromU32(16))).toStrictEqual(u256.fromU32(65536));

            // 2^32 = 4294967296
            expect(SafeMath.pow(two, u256.fromU32(32))).toStrictEqual(
                u256.fromString('4294967296'),
            );

            // 2^64
            expect(SafeMath.pow(two, u256.fromU32(64))).toStrictEqual(
                u256.fromString('18446744073709551616'),
            );
        });
    });

    describe('Overflow detection', () => {
        it('should throw on overflow for large bases with large exponents', () => {
            expect((): void => {
                // Large base with exponent that would cause overflow
                const largeBase = u256.fromString('340282366920938463463374607431768211456'); // 2^128
                SafeMath.pow(largeBase, u256.fromU32(3)); // Would be 2^384 > 2^256
            }).toThrow('SafeMath: multiplication overflow');
        });

        it('should handle maximum safe powers', () => {
            // Test the largest power of 2 that fits in u256: 2^255
            const two = u256.fromU32(2);
            const result = SafeMath.pow(two, u256.fromU32(255));

            // 2^255 = u256.Max / 2 + 1 (approximately)
            const expected = u256.fromString(
                '57896044618658097711785492504343953926634992332820282019728792003956564819968',
            );
            expect(result).toStrictEqual(expected);

            // 2^256 should overflow
            expect((): void => {
                const two2 = u256.fromU32(2);
                SafeMath.pow(two2, u256.fromU32(256));
            }).toThrow('SafeMath: multiplication overflow');
        });

        it('should detect overflow in intermediate calculations', () => {
            // Base that will overflow after a few multiplications
            const base = u256.fromString('18446744073709551616'); // 2^64

            // 2^64^4 = 2^256 which should overflow
            expect((): void => {
                const base2 = u256.fromString('18446744073709551616'); // 2^64
                SafeMath.pow(base2, u256.fromU32(4));
            }).toThrow('SafeMath: multiplication overflow');

            // But 2^64^3 = 2^192 should work
            const result = SafeMath.pow(base, u256.fromU32(3));
            expect(result).toStrictEqual(
                u256.fromString('6277101735386680763835789423207666416102355444464034512896'),
            );
        });
    });

    describe('Edge cases', () => {
        it('should handle alternating bit patterns', () => {
            // Exponent with alternating bits
            const base = u256.fromU32(3);
            const exponent = u256.fromU32(0b10101); // 21 in binary

            const result = SafeMath.pow(base, exponent);
            // 3^21 = 10460353203
            expect(result).toStrictEqual(u256.fromString('10460353203'));
        });

        it('should handle sparse bit patterns in exponent', () => {
            // Exponent with sparse bits (mostly zeros)
            const base = u256.fromU32(2);
            const exponent = u256.fromU32(0b10000001); // 129

            const result = SafeMath.pow(base, exponent);
            // 2^129
            expect(result).toStrictEqual(
                u256.fromString('680564733841876926926749214863536422912'),
            );
        });

        it('should handle dense bit patterns in exponent', () => {
            // Exponent with dense bits (mostly ones)
            const base = u256.fromU32(2);
            const exponent = u256.fromU32(0b1111111); // 127

            const result = SafeMath.pow(base, exponent);
            // 2^127
            expect(result).toStrictEqual(
                u256.fromString('170141183460469231731687303715884105728'),
            );
        });
    });

    describe('Mathematical properties', () => {
        it('should satisfy power laws: a^(m+n) = a^m * a^n', () => {
            const base = u256.fromU32(3);
            const m = u256.fromU32(5);
            const n = u256.fromU32(7);

            // Compute a^(m+n)
            const sum = SafeMath.add(m, n);
            const result1 = SafeMath.pow(base, sum);

            // Compute a^m * a^n
            const pow_m = SafeMath.pow(base, m);
            const pow_n = SafeMath.pow(base, n);
            const result2 = SafeMath.mul(pow_m, pow_n);

            expect(result1).toStrictEqual(result2);
        });

        it('should satisfy power laws: (a^m)^n = a^(m*n)', () => {
            const base = u256.fromU32(2);
            const m = u256.fromU32(8);
            const n = u256.fromU32(3);

            // Compute (a^m)^n
            const pow_m = SafeMath.pow(base, m);
            const result1 = SafeMath.pow(pow_m, n);

            // Compute a^(m*n)
            const product = SafeMath.mul(m, n);
            const result2 = SafeMath.pow(base, product);

            expect(result1).toStrictEqual(result2);
        });

        it('should satisfy power laws: (a*b)^n = a^n * b^n', () => {
            const a = u256.fromU32(2);
            const b = u256.fromU32(3);
            const n = u256.fromU32(4);

            // Compute (a*b)^n
            const product = SafeMath.mul(a, b);
            const result1 = SafeMath.pow(product, n);

            // Compute a^n * b^n
            const pow_a = SafeMath.pow(a, n);
            const pow_b = SafeMath.pow(b, n);
            const result2 = SafeMath.mul(pow_a, pow_b);

            expect(result1).toStrictEqual(result2);
        });
    });

    describe('Known test vectors', () => {
        it('should match expected values for specific inputs', () => {
            const testVectors: PowTestCase[] = [
                new PowTestCase('2', '10', '1024', 'Power of 2'),
                new PowTestCase('10', '6', '1000000', 'Power of 10'),
                new PowTestCase('3', '20', '3486784401', 'Medium power'),
                new PowTestCase('7', '13', '96889010407', 'Prime base'),
                new PowTestCase('11', '11', '285311670611', 'Same base and exponent'),
                new PowTestCase('256', '4', '4294967296', 'Large base, small exponent'),
                new PowTestCase('123456789', '2', '15241578750190521', 'Large number squared'),
            ];

            for (let i = 0; i < testVectors.length; i++) {
                const tv = testVectors[i];
                const base = u256.fromString(tv.base);
                const exponent = u256.fromString(tv.exponent);
                const expected = u256.fromString(tv.expected);

                const result = SafeMath.pow(base, exponent);
                expect(result).toStrictEqual(expected, tv.description);
            }
        });
    });

    describe('Performance characteristics', () => {
        it('should handle large exponents efficiently', () => {
            // Test with large but sparse exponent (few bits set)
            const base = u256.fromU32(2);
            const largeExponent = u256.fromU32(250); // Within safe range for base 2

            const result = SafeMath.pow(base, largeExponent);
            const expected = u256.fromString(
                '1809251394333065553493296640760748560207343510400633813116524750123642650624',
            );
            expect(result).toStrictEqual(expected);
        });

        it('should handle sequential powers', () => {
            const base = u256.fromU32(3);
            let result = u256.One;

            // Compute 3^10 step by step
            for (let i = 0; i < 10; i++) {
                result = SafeMath.mul(result, base);
            }

            // Compare with direct computation
            const directResult = SafeMath.pow(base, u256.fromU32(10));
            expect(result).toStrictEqual(directResult);
            expect(result).toStrictEqual(u256.fromU32(59049));
        });
    });
});

describe('SafeMath - pow10', () => {
    beforeEach(() => {});

    describe('Basic functionality', () => {
        it('should compute powers of 10 correctly', () => {
            // 10^0 = 1
            expect(SafeMath.pow10(0)).toStrictEqual(u256.One);

            // 10^1 = 10
            expect(SafeMath.pow10(1)).toStrictEqual(u256.fromU32(10));

            // 10^2 = 100
            expect(SafeMath.pow10(2)).toStrictEqual(u256.fromU32(100));

            // 10^3 = 1000
            expect(SafeMath.pow10(3)).toStrictEqual(u256.fromU32(1000));

            // 10^6 = 1000000
            expect(SafeMath.pow10(6)).toStrictEqual(u256.fromU32(1000000));

            // 10^9 = 1000000000
            expect(SafeMath.pow10(9)).toStrictEqual(u256.fromString('1000000000'));
        });

        it('should handle larger exponents', () => {
            // 10^12
            expect(SafeMath.pow10(12)).toStrictEqual(u256.fromString('1000000000000'));

            // 10^18 (common in Ethereum for wei conversion)
            expect(SafeMath.pow10(18)).toStrictEqual(u256.fromString('1000000000000000000'));

            // 10^21
            expect(SafeMath.pow10(21)).toStrictEqual(u256.fromString('1000000000000000000000'));
        });

        it('should handle maximum safe exponent', () => {
            // 10^77 is the largest power of 10 that fits in u256
            // u256.Max ≈ 1.15 * 10^77
            const result = SafeMath.pow10(77);
            const expected = u256.fromString(
                '100000000000000000000000000000000000000000000000000000000000000000000000000000',
            );
            expect(result).toStrictEqual(expected);
        });
    });

    describe('Edge cases', () => {
        it('should return 1 for exponent 0', () => {
            const result = SafeMath.pow10(0);
            expect(result).toStrictEqual(u256.One);
        });

        it('should handle consecutive calls', () => {
            const results: u256[] = [];

            for (let i: u8 = 0; i < 10; i++) {
                results.push(SafeMath.pow10(i));
            }

            // Verify each result
            expect(results[0]).toStrictEqual(u256.fromU32(1));
            expect(results[1]).toStrictEqual(u256.fromU32(10));
            expect(results[2]).toStrictEqual(u256.fromU32(100));
            expect(results[3]).toStrictEqual(u256.fromU32(1000));
            expect(results[4]).toStrictEqual(u256.fromU32(10000));
            expect(results[5]).toStrictEqual(u256.fromU32(100000));
            expect(results[6]).toStrictEqual(u256.fromU32(1000000));
            expect(results[7]).toStrictEqual(u256.fromU32(10000000));
            expect(results[8]).toStrictEqual(u256.fromU32(100000000));
            expect(results[9]).toStrictEqual(u256.fromU32(1000000000));
        });

        it('should handle maximum u8 value', () => {
            // u8 max is 255, but 10^255 would overflow
            // Test that 10^78 would overflow (since 10^77 is max safe)
            expect((): void => {
                SafeMath.pow10(78);
            }).toThrow('SafeMath: multiplication overflow');
        });
    });

    describe('Overflow detection', () => {
        it('should throw on overflow for large exponents', () => {
            // 10^78 and beyond should overflow
            expect((): void => {
                SafeMath.pow10(78);
            }).toThrow('SafeMath: multiplication overflow');

            expect((): void => {
                SafeMath.pow10(100);
            }).toThrow('SafeMath: multiplication overflow');

            expect((): void => {
                SafeMath.pow10(255); // max u8
            }).toThrow('SafeMath: multiplication overflow');
        });
    });

    describe('Consistency with pow', () => {
        it('should match results from general pow function', () => {
            const ten = u256.fromU32(10);

            for (let i: u8 = 0; i < 20; i++) {
                const pow10Result = SafeMath.pow10(i);
                const powResult = SafeMath.pow(ten, u256.fromU32(i));

                expect(pow10Result).toStrictEqual(
                    powResult,
                    `pow10(${i}) should equal pow(10, ${i})`,
                );
            }
        });
    });

    describe('Common use cases', () => {
        it('should handle decimal scaling operations', () => {
            // Common decimal places in finance
            const decimals2 = SafeMath.pow10(2); // cents
            const decimals6 = SafeMath.pow10(6); // micro units
            const decimals8 = SafeMath.pow10(8); // satoshis (Bitcoin)
            const decimals18 = SafeMath.pow10(18); // wei (Ethereum)

            expect(decimals2).toStrictEqual(u256.fromU32(100));
            expect(decimals6).toStrictEqual(u256.fromU32(1000000));
            expect(decimals8).toStrictEqual(u256.fromU32(100000000));
            expect(decimals18).toStrictEqual(u256.fromString('1000000000000000000'));
        });

        it('should handle token decimal conversions', () => {
            // Convert 1.5 tokens with 18 decimals
            const oneAndHalf = u256.fromU32(15);
            const scale = SafeMath.pow10(18);
            const scaled = SafeMath.mul(oneAndHalf, scale);
            const descaled = SafeMath.div(scaled, u256.fromU32(10));

            expect(descaled).toStrictEqual(u256.fromString('1500000000000000000'));
        });
    });

    describe('Mathematical properties', () => {
        it('should satisfy: 10^a * 10^b = 10^(a+b)', () => {
            const a: u8 = 5;
            const b: u8 = 7;

            const pow10_a = SafeMath.pow10(a);
            const pow10_b = SafeMath.pow10(b);
            const product = SafeMath.mul(pow10_a, pow10_b);

            const pow10_sum = SafeMath.pow10(a + b);

            expect(product).toStrictEqual(pow10_sum);
        });

        it('should satisfy: 10^a / 10^b = 10^(a-b) for a > b', () => {
            const a: u8 = 10;
            const b: u8 = 3;

            const pow10_a = SafeMath.pow10(a);
            const pow10_b = SafeMath.pow10(b);
            const quotient = SafeMath.div(pow10_a, pow10_b);

            const pow10_diff = SafeMath.pow10(a - b);

            expect(quotient).toStrictEqual(pow10_diff);
        });

        it('should produce monotonically increasing results', () => {
            let prev = u256.Zero;

            for (let i: u8 = 0; i < 20; i++) {
                const current = SafeMath.pow10(i);
                expect(u256.gt(current, prev)).toBe(true, `10^${i} should be > 10^${i - 1}`);
                prev = current;
            }
        });
    });

    describe('String representation verification', () => {
        it('should produce correct string representations', () => {
            // Verify that pow10 results have correct number of zeros
            for (let i: u8 = 0; i < 20; i++) {
                const result = SafeMath.pow10(i);
                const resultStr = result.toString();

                if (i == 0) {
                    expect(resultStr).toBe('1');
                } else {
                    // Should be '1' followed by i zeros
                    expect(resultStr.length).toBe(i + 1);
                    expect(resultStr.charAt(0)).toBe('1');

                    for (let j = 1; j < resultStr.length; j++) {
                        expect(resultStr.charAt(j)).toBe('0');
                    }
                }
            }
        });
    });
});

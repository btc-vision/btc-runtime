import { SafeMath } from '../runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

/**
 * Test Suite Documentation: SafeMath Logarithm Functions
 *
 * This comprehensive test suite validates the logarithm function family in SafeMath,
 * covering binary logarithms, natural logarithms, and supporting utilities. These
 * functions form the mathematical foundation for advanced DeFi protocols, particularly
 * in automated market makers (AMMs), interest rate models, and entropy calculations.
 *
 * Function Overview:
 * - approximateLog2: Binary logarithm using MSB position (floor approximation)
 * - bitLength256: Bit count for u256 values (position of highest set bit + 1)
 * - approxLog: Natural logarithm via bit length and ln(2) scaling
 * - preciseLog: Enhanced natural logarithm with fractional remainder processing
 * - polyLn1p3: Specialized ln(1+z) approximation using hyperbolic arctanh transform
 *
 * Expected Behaviors:
 * - approximateLog2(x) returns floor(log2(x)) for x > 0, and 0 for x = 0
 * - bitLength256(x) returns the minimum bits needed to represent x
 * - approxLog(x) provides fast ln(x) approximation using (bitLength - 1) * ln(2)
 * - preciseLog(x) adds fractional correction to approxLog for better accuracy
 * - polyLn1p3(z) computes ln(1+z) for z ∈ [0, 0.999999] using atanh identity
 * - All functions maintain strict monotonicity (critical for price curves)
 * - Zero inputs return zero (safe default to prevent reverts)
 * - No overflow conditions exist within valid input ranges
 *
 * Critical Invariants:
 * - log2(2^n) = n exactly (exact for powers of 2)
 * - log2(a*b) = log2(a) + log2(b) for powers of 2 (additive property)
 * - bitLength(x) = floor(log2(x)) + 1 for x > 0 (bit position relationship)
 * - approxLog(2^n) = n * ln(2) exactly (powers of 2 are precise)
 * - preciseLog(x) >= approxLog(x) (refinement never decreases value)
 * - Monotonicity: x < y ⟹ f(x) <= f(y) for all log functions
 * - polyLn1p3 uses identity: ln(1+z) = 2*atanh(z/(2+z)) for improved accuracy
 * - Approximation error bounded by ln(2) for floor-based methods
 *
 * Implementation Algorithms:
 * - Binary logarithm: Count leading zeros, compute 255 - clz(x)
 * - Natural logarithm: Scale binary logarithm by ln(2) = 693147 (scaled by 10^6)
 * - Precise logarithm: Add fractional part via ln(1 + remainder/2^k)
 * - polyLn1p3: Transform to atanh domain for better convergence near boundaries
 *
 * Security Considerations for Smart Contracts:
 * - Monotonicity violations enable sandwich attacks in AMMs
 * - Precision loss accumulates in compound interest calculations
 * - Discontinuities create arbitrage opportunities
 * - Deterministic execution required (no external dependencies)
 * - Gas efficiency critical for frequent operations (prefer approximateLog2)
 * - Edge case handling prevents DoS via revert loops
 *
 * Common Use Cases:
 * - AMM pricing: Logarithmic bonding curves (e.g., Balancer weighted pools)
 * - Interest rates: Continuous compounding via A = P * e^(rt)
 * - Entropy calculations: -Σ(p * ln(p)) for on-chain randomness
 * - Token economics: Emission schedules with logarithmic decay
 * - Options pricing: Black-Scholes requires ln(S/K) calculations
 * - Liquidity depth: Measure concentration via log of tick ranges
 *
 * Precision Boundaries:
 * - approximateLog2: Integer precision (floor operation)
 * - approxLog: Error up to ln(2) ≈ 0.693 (scaled: 693147)
 * - preciseLog: Fractional improvement, error < 0.1 * ln(2)
 * - polyLn1p3: 6-digit precision for z ∈ [0, 0.999999]
 * - All natural logs scaled by 10^6 for fixed-point arithmetic
 */

class AtanhTestCase {
    z: u64;
    expected: u64;
    tolerance: u64;

    constructor(z: u64, expected: u64, tolerance: u64) {
        this.z = z;
        this.expected = expected;
        this.tolerance = tolerance;
    }
}

class LnTestCase {
    z: u64;
    expected: u64;
    description: string;

    constructor(z: u64, expected: u64, description: string) {
        this.z = z;
        this.expected = expected;
        this.description = description;
    }
}

class TestCase {
    input: u64;
    expected: u64;
    tolerance: u64;
    description: string;

    constructor(input: u64, expected: u64, tolerance: u64, description: string) {
        this.input = input;
        this.expected = expected;
        this.tolerance = tolerance;
        this.description = description;
    }
}

describe('SafeMath - approximateLog2', () => {
    beforeEach(() => {});

    describe('Basic functionality', () => {
        it('should return 0 for log2(1)', () => {
            const result: u256 = SafeMath.approximateLog2(u256.One);
            expect(result).toStrictEqual(u256.Zero);
        });

        it('should return 0 for log2(0) with documentation', () => {
            // IMPORTANT: Mathematical edge case - log2(0) is undefined
            // Implementation returns 0 to avoid reverts in smart contracts
            // This is a deliberate design choice for gas efficiency and contract stability
            // Callers should check for zero inputs if mathematical correctness is required
            const result: u256 = SafeMath.approximateLog2(u256.Zero);
            expect(result).toStrictEqual(u256.Zero);
        });

        it('should calculate exact log2 for powers of 2', () => {
            // Test powers from 2^0 to 2^255
            const testPowers: u32[] = [0, 1, 2, 3, 4, 7, 8, 15, 16, 31, 32, 63, 64, 127, 128, 255];

            for (let i: i32 = 0; i < testPowers.length; i++) {
                const power: u32 = testPowers[i];
                const value: u256 = SafeMath.shl(u256.One, power);
                const result: u256 = SafeMath.approximateLog2(value);

                // For 2^n, log2 should be exactly n
                expect(result).toStrictEqual(
                    u256.fromU32(power),
                    `log2(2^${power}) should be ${power}`,
                );
            }
        });

        it('should approximate log2 for non-powers of 2 using floor', () => {
            // For any x where 2^n <= x < 2^(n+1), approximateLog2(x) = n

            // Test case: 3 is between 2^1 and 2^2, so log2(3) ≈ 1
            expect(SafeMath.approximateLog2(u256.fromU32(3))).toStrictEqual(u256.One);

            // Test case: 5,6,7 are between 2^2 and 2^3, so log2 ≈ 2
            expect(SafeMath.approximateLog2(u256.fromU32(5))).toStrictEqual(u256.fromU32(2));
            expect(SafeMath.approximateLog2(u256.fromU32(6))).toStrictEqual(u256.fromU32(2));
            expect(SafeMath.approximateLog2(u256.fromU32(7))).toStrictEqual(u256.fromU32(2));

            // Test case: 15 is between 2^3 and 2^4, so log2(15) ≈ 3
            expect(SafeMath.approximateLog2(u256.fromU32(15))).toStrictEqual(u256.fromU32(3));

            // Test case: 1000 is between 2^9 and 2^10, so log2(1000) ≈ 9
            expect(SafeMath.approximateLog2(u256.fromU32(1000))).toStrictEqual(u256.fromU32(9));

            // Test case: 1024 = 2^10 exactly
            expect(SafeMath.approximateLog2(u256.fromU32(1024))).toStrictEqual(u256.fromU32(10));

            // Test case: 1025 is just above 2^10, so log2(1025) ≈ 10
            expect(SafeMath.approximateLog2(u256.fromU32(1025))).toStrictEqual(u256.fromU32(10));
        });

        it('should handle large values correctly', () => {
            // Test 2^64
            const val64: u256 = u256.fromString('18446744073709551616');
            expect(SafeMath.approximateLog2(val64)).toStrictEqual(u256.fromU32(64));

            // Test 2^128
            const val128: u256 = u256.fromString('340282366920938463463374607431768211456');
            expect(SafeMath.approximateLog2(val128)).toStrictEqual(u256.fromU32(128));

            // Test 2^192
            const val192: u256 = u256.fromString(
                '6277101735386680763835789423207666416102355444464034512896',
            );
            expect(SafeMath.approximateLog2(val192)).toStrictEqual(u256.fromU32(192));

            // Test 2^255 (near max u256)
            const val255: u256 = u256.fromString(
                '57896044618658097711785492504343953926634992332820282019728792003956564819968',
            );
            expect(SafeMath.approximateLog2(val255)).toStrictEqual(u256.fromU32(255));
        });
    });

    describe('Edge cases', () => {
        it('should handle maximum u256 value', () => {
            const result: u256 = SafeMath.approximateLog2(u256.Max);
            // u256.Max = 2^256 - 1, which is just below 2^256, so log2 ≈ 255
            expect(result).toStrictEqual(u256.fromU32(255));
        });

        it('should handle values just below powers of 2', () => {
            // 2^10 - 1 = 1023, should give log2 ≈ 9
            expect(SafeMath.approximateLog2(u256.fromU32(1023))).toStrictEqual(u256.fromU32(9));

            // 2^16 - 1 = 65535, should give log2 ≈ 15
            expect(SafeMath.approximateLog2(u256.fromU32(65535))).toStrictEqual(u256.fromU32(15));

            // 2^32 - 1 = 4294967295, should give log2 ≈ 31
            expect(SafeMath.approximateLog2(u256.fromU64(4294967295))).toStrictEqual(
                u256.fromU32(31),
            );
        });

        it('should handle values just above powers of 2', () => {
            // 2^10 + 1 = 1025, should give log2 ≈ 10
            expect(SafeMath.approximateLog2(u256.fromU32(1025))).toStrictEqual(u256.fromU32(10));

            // 2^16 + 1 = 65537, should give log2 ≈ 16
            expect(SafeMath.approximateLog2(u256.fromU32(65537))).toStrictEqual(u256.fromU32(16));

            // 2^32 + 1 = 4294967297, should give log2 ≈ 32
            expect(SafeMath.approximateLog2(u256.fromU64(4294967297))).toStrictEqual(
                u256.fromU32(32),
            );
        });
    });

    describe('Mathematical properties', () => {
        it('should be monotonically non-decreasing', () => {
            // Critical property for smart contracts: prevents manipulation
            for (let i: u32 = 1; i < 100; i++) {
                const log_i: u256 = SafeMath.approximateLog2(u256.fromU32(i));
                const log_i_plus_1: u256 = SafeMath.approximateLog2(u256.fromU32(i + 1));

                // log2(i+1) >= log2(i) always
                expect(u256.ge(log_i_plus_1, log_i)).toBe(
                    true,
                    `log2(${i + 1}) should be >= log2(${i})`,
                );
            }
        });

        it('should satisfy: log2(a*b) = log2(a) + log2(b) for powers of 2', () => {
            // This property is exact for powers of 2
            const a: u256 = u256.fromU32(16); // 2^4
            const b: u256 = u256.fromU32(32); // 2^5
            const product: u256 = SafeMath.mul(a, b); // 2^9 = 512

            const log_product: u256 = SafeMath.approximateLog2(product);
            const log_a: u256 = SafeMath.approximateLog2(a);
            const log_b: u256 = SafeMath.approximateLog2(b);
            const sum_logs: u256 = SafeMath.add(log_a, log_b);

            expect(log_product).toStrictEqual(sum_logs);
        });

        it('should approximate log2(a*b) ≈ log2(a) + log2(b) with floor error for non-powers', () => {
            // For non-powers of 2, there's a floor approximation error
            const a: u256 = u256.fromU32(3); // log2(3) ≈ 1.58... floors to 1
            const b: u256 = u256.fromU32(5); // log2(5) ≈ 2.32... floors to 2
            const product: u256 = SafeMath.mul(a, b); // 15, log2(15) ≈ 3.90... floors to 3

            const log_product: u256 = SafeMath.approximateLog2(product);
            const log_a: u256 = SafeMath.approximateLog2(a);
            const log_b: u256 = SafeMath.approximateLog2(b);
            const sum_logs: u256 = SafeMath.add(log_a, log_b);

            // 1 + 2 = 3, which equals floor(log2(15)) = 3
            expect(log_product).toStrictEqual(sum_logs);
        });
    });

    describe('Implementation verification', () => {
        it('should count leading zeros correctly', () => {
            // The implementation effectively counts the position of the highest set bit
            // This is equivalent to 255 - clz(x) for u256

            // Value with only the lowest bit set
            const lowBit: u256 = u256.One;
            expect(SafeMath.approximateLog2(lowBit)).toStrictEqual(u256.Zero);

            // Value with only bit 100 set
            const bit100: u256 = SafeMath.shl(u256.One, 100);
            expect(SafeMath.approximateLog2(bit100)).toStrictEqual(u256.fromU32(100));

            // Value with multiple bits set - only highest matters
            const multipleBits: u256 = SafeMath.or(
                SafeMath.shl(u256.One, 50),
                SafeMath.shl(u256.One, 100),
            );
            expect(SafeMath.approximateLog2(multipleBits)).toStrictEqual(u256.fromU32(100));
        });
    });
});

describe('SafeMath - bitLength256', () => {
    beforeEach(() => {});

    describe('Basic functionality', () => {
        it('should return 0 for zero', () => {
            expect(SafeMath.bitLength256(u256.Zero)).toBe(0);
        });

        it('should return correct bit length for small values', () => {
            expect(SafeMath.bitLength256(u256.One)).toBe(1); // 1 = 0b1
            expect(SafeMath.bitLength256(u256.fromU32(2))).toBe(2); // 2 = 0b10
            expect(SafeMath.bitLength256(u256.fromU32(3))).toBe(2); // 3 = 0b11
            expect(SafeMath.bitLength256(u256.fromU32(4))).toBe(3); // 4 = 0b100
            expect(SafeMath.bitLength256(u256.fromU32(7))).toBe(3); // 7 = 0b111
            expect(SafeMath.bitLength256(u256.fromU32(8))).toBe(4); // 8 = 0b1000
            expect(SafeMath.bitLength256(u256.fromU32(255))).toBe(8); // 255 = 0b11111111
            expect(SafeMath.bitLength256(u256.fromU32(256))).toBe(9); // 256 = 0b100000000
        });

        it('should handle values in different u64 segments', () => {
            // Value in lo1 only (bits 0-63)
            const lo1_val: u256 = u256.fromU64(0xffffffffffffffff);
            expect(SafeMath.bitLength256(lo1_val)).toBe(64);

            // Value in lo2 only (bits 64-127)
            const lo2_val: u256 = new u256(0, 1, 0, 0);
            expect(SafeMath.bitLength256(lo2_val)).toBe(65);

            // Value in hi1 only (bits 128-191)
            const hi1_val: u256 = new u256(0, 0, 1, 0);
            expect(SafeMath.bitLength256(hi1_val)).toBe(129);

            // Value in hi2 only (bits 192-255)
            const hi2_val: u256 = new u256(0, 0, 0, 1);
            expect(SafeMath.bitLength256(hi2_val)).toBe(193);
        });

        it('should handle powers of 2 correctly', () => {
            // Test all powers of 2 from 2^0 to 2^255
            for (let i: i32 = 0; i < 256; i++) {
                const pow2: u256 = SafeMath.shl(u256.One, i);
                const bitLen: u32 = SafeMath.bitLength256(pow2);
                expect(bitLen).toBe(i + 1, `2^${i} should have bit length ${i + 1}`);
            }
        });
    });

    describe('Edge cases', () => {
        it('should handle maximum values in each segment', () => {
            // Max u64 in lo1
            const maxLo1: u256 = new u256(0xffffffffffffffff, 0, 0, 0);
            expect(SafeMath.bitLength256(maxLo1)).toBe(64);

            // Max u64 in lo2
            const maxLo2: u256 = new u256(0, 0xffffffffffffffff, 0, 0);
            expect(SafeMath.bitLength256(maxLo2)).toBe(128);

            // Max u64 in hi1
            const maxHi1: u256 = new u256(0, 0, 0xffffffffffffffff, 0);
            expect(SafeMath.bitLength256(maxHi1)).toBe(192);

            // Max u64 in hi2
            const maxHi2: u256 = new u256(0, 0, 0, 0xffffffffffffffff);
            expect(SafeMath.bitLength256(maxHi2)).toBe(256);
        });

        it('should handle u256.Max', () => {
            expect(SafeMath.bitLength256(u256.Max)).toBe(256);
        });

        it('should handle values with single bit set in each segment boundary', () => {
            // Test boundary values where only the highest bit in each segment is set
            const bit63: u256 = SafeMath.shl(u256.One, 63);
            expect(SafeMath.bitLength256(bit63)).toBe(64);

            const bit64: u256 = SafeMath.shl(u256.One, 64);
            expect(SafeMath.bitLength256(bit64)).toBe(65);

            const bit127: u256 = SafeMath.shl(u256.One, 127);
            expect(SafeMath.bitLength256(bit127)).toBe(128);

            const bit128: u256 = SafeMath.shl(u256.One, 128);
            expect(SafeMath.bitLength256(bit128)).toBe(129);

            const bit191: u256 = SafeMath.shl(u256.One, 191);
            expect(SafeMath.bitLength256(bit191)).toBe(192);

            const bit192: u256 = SafeMath.shl(u256.One, 192);
            expect(SafeMath.bitLength256(bit192)).toBe(193);

            const bit255: u256 = SafeMath.shl(u256.One, 255);
            expect(SafeMath.bitLength256(bit255)).toBe(256);
        });

        it('should handle sparse bit patterns', () => {
            // Value with bits in multiple segments
            const sparse: u256 = new u256(1, 0, 1, 0);
            // Highest bit is in hi1 (bit 128), so length is 129
            expect(SafeMath.bitLength256(sparse)).toBe(129);

            // Value with highest bit in each segment
            const allHighBits: u256 = new u256(
                0x8000000000000000,
                0x8000000000000000,
                0x8000000000000000,
                0x8000000000000000,
            );
            // Highest bit is bit 255, so length is 256
            expect(SafeMath.bitLength256(allHighBits)).toBe(256);

            // Complex pattern
            const complex: u256 = new u256(
                0xffffffffffffffff, // All bits in lo1
                0x0000000000000001, // One bit in lo2
                0x8000000000000000, // High bit in hi1
                0x0000000000000000, // No bits in hi2
            );
            // Highest bit is bit 191, so length is 192
            expect(SafeMath.bitLength256(complex)).toBe(192);
        });
    });

    describe('Consistency with approximateLog2', () => {
        it('should be consistent: bitLength = floor(log2(x)) + 1 for x > 0', () => {
            const testValues: u256[] = [
                u256.fromU32(1),
                u256.fromU32(2),
                u256.fromU32(3),
                u256.fromU32(15),
                u256.fromU32(16),
                u256.fromU32(17),
                u256.fromU32(1023),
                u256.fromU32(1024),
                u256.fromU32(1025),
                u256.fromString('123456789012345678901234567890'),
            ];

            for (let i: i32 = 0; i < testValues.length; i++) {
                const val: u256 = testValues[i];
                const bitLen: u32 = SafeMath.bitLength256(val);
                const log2: u256 = SafeMath.approximateLog2(val);

                if (val.isZero()) {
                    expect(bitLen).toBe(0);
                    expect(log2).toStrictEqual(u256.Zero);
                } else if (u256.eq(val, u256.One)) {
                    expect(bitLen).toBe(1);
                    expect(log2).toStrictEqual(u256.Zero);
                } else {
                    // For x > 1: bitLength should be floor(log2(x)) + 1
                    expect(bitLen).toBe(log2.toU32() + 1);
                }
            }
        });
    });

    describe('Security considerations', () => {
        it('should handle adversarial inputs safely', () => {
            // Test patterns that might cause issues in naive implementations

            // Alternating bits pattern - use decimal representation
            // 0xAAAA... in hex = this decimal value
            const alternating: u256 = u256.fromString(
                '77194726158210796949047323339125271902179989777093709359638389338608753093290',
            );
            const altBitLen: u32 = SafeMath.bitLength256(alternating);
            expect(altBitLen).toBe(256); // Highest bit is set

            // Single high bit with all lower bits set
            const almostMax: u256 = SafeMath.sub(SafeMath.shl(u256.One, 200), u256.One);
            const almostMaxBitLen: u32 = SafeMath.bitLength256(almostMax);
            expect(almostMaxBitLen).toBe(200);

            // Ensure no overflow in internal calculations
            expect((): void => {
                const testMax: u256 = u256.Max; // Define inside to avoid closure
                const result: u32 = SafeMath.bitLength256(testMax);
            }).not.toThrow('Should handle u256.Max without overflow');
        });
    });
});

describe('SafeMath - approxLog', () => {
    beforeEach(() => {});

    describe('Basic functionality', () => {
        it('should return 0 for ln(0) and ln(1) with documentation', () => {
            // IMPORTANT: ln(0) is mathematically undefined, but returns 0 to avoid reverts
            // This is a deliberate design choice for smart contract safety
            expect(SafeMath.approxLog(u256.Zero)).toStrictEqual(u256.Zero);
            expect(SafeMath.approxLog(u256.One)).toStrictEqual(u256.Zero);
        });

        it('should approximate ln for small values', () => {
            // ln(2) ≈ 0.693147 * 1e6 = 693147
            const ln2: u256 = SafeMath.approxLog(u256.fromU32(2));
            expect(ln2).toStrictEqual(u256.fromU64(693147));

            // ln(4) = 2*ln(2) ≈ 1386294
            const ln4: u256 = SafeMath.approxLog(u256.fromU32(4));
            expect(ln4).toStrictEqual(u256.fromU64(1386294));

            // ln(8) = 3*ln(2) ≈ 2079441
            const ln8: u256 = SafeMath.approxLog(u256.fromU32(8));
            expect(ln8).toStrictEqual(u256.fromU64(2079441));

            // ln(16) = 4*ln(2) ≈ 2772588
            const ln16: u256 = SafeMath.approxLog(u256.fromU32(16));
            expect(ln16).toStrictEqual(u256.fromU64(2772588));
        });

        it('should handle powers of 2 exactly', () => {
            const LN2_SCALED: u64 = 693147;

            // Test powers from 2^1 to 2^20
            for (let k: u32 = 1; k <= 20; k++) {
                const pow2: u256 = SafeMath.shl(u256.One, k);
                const result: u256 = SafeMath.approxLog(pow2);
                const expected: u256 = u256.fromU64(k * LN2_SCALED);
                expect(result).toStrictEqual(expected, `ln(2^${k}) should be ${k} * ln(2)`);
            }
        });

        it('should handle large values', () => {
            // Test with 2^64
            const val64: u256 = u256.fromString('18446744073709551616');
            const result64: u256 = SafeMath.approxLog(val64);
            expect(result64).toStrictEqual(u256.fromU64(44361408)); // 64 * 693147

            // Test with 2^128
            const val128: u256 = u256.fromString('340282366920938463463374607431768211456');
            const result128: u256 = SafeMath.approxLog(val128);
            expect(result128).toStrictEqual(u256.fromU64(88722816)); // 128 * 693147

            // Test with 2^200
            const val200: u256 = u256.fromString(
                '1606938044258990275541962092341162602522202993782792835301376',
            );
            const result200: u256 = SafeMath.approxLog(val200);
            expect(result200).toStrictEqual(u256.fromU64(138629400)); // 200 * 693147
        });
    });

    describe('Edge cases', () => {
        it('should handle values with bitLength <= 1', () => {
            expect(SafeMath.approxLog(u256.Zero)).toStrictEqual(u256.Zero);
            expect(SafeMath.approxLog(u256.One)).toStrictEqual(u256.Zero);
        });

        it('should approximate non-power-of-2 values using bit length', () => {
            // For non-powers of 2, it uses floor approximation based on bit length

            // ln(3): bitLen=2, so uses (2-1)*ln(2) = ln(2)
            const ln3: u256 = SafeMath.approxLog(u256.fromU32(3));
            expect(ln3).toStrictEqual(u256.fromU64(693147));

            // ln(5), ln(6), ln(7): bitLen=3, so uses (3-1)*ln(2) = 2*ln(2)
            const ln5: u256 = SafeMath.approxLog(u256.fromU32(5));
            expect(ln5).toStrictEqual(u256.fromU64(1386294));

            const ln6: u256 = SafeMath.approxLog(u256.fromU32(6));
            expect(ln6).toStrictEqual(u256.fromU64(1386294));

            const ln7: u256 = SafeMath.approxLog(u256.fromU32(7));
            expect(ln7).toStrictEqual(u256.fromU64(1386294));

            // ln(15): bitLen=4, so uses (4-1)*ln(2) = 3*ln(2)
            const ln15: u256 = SafeMath.approxLog(u256.fromU32(15));
            expect(ln15).toStrictEqual(u256.fromU64(2079441));

            // ln(1000): bitLen=10, so uses 9*ln(2)
            const ln1000: u256 = SafeMath.approxLog(u256.fromU32(1000));
            expect(ln1000).toStrictEqual(u256.fromU64(6238323)); // 9 * 693147
        });

        it('should be monotonically increasing for powers of 2', () => {
            let prevLog: u256 = u256.Zero;

            for (let i: u32 = 1; i <= 30; i++) {
                const val: u256 = SafeMath.shl(u256.One, i);
                const log: u256 = SafeMath.approxLog(val);

                expect(u256.gt(log, prevLog)).toBe(true, `ln(2^${i}) should be > ln(2^${i - 1})`);
                prevLog = log;
            }
        });

        it('should handle u256.Max', () => {
            const result: u256 = SafeMath.approxLog(u256.Max);
            // u256.Max has bitLength 256, so uses (256-1)*ln(2) = 255*ln(2)
            expect(result).toStrictEqual(u256.fromU64(176752485)); // 255 * 693147
        });
    });

    describe('Mathematical properties', () => {
        it('should approximate ln(a*b) ≈ ln(a) + ln(b) for powers of 2', () => {
            const a: u256 = u256.fromU32(16); // 2^4
            const b: u256 = u256.fromU32(32); // 2^5
            const product: u256 = SafeMath.mul(a, b); // 2^9 = 512

            const lnProduct: u256 = SafeMath.approxLog(product);
            const lnA: u256 = SafeMath.approxLog(a);
            const lnB: u256 = SafeMath.approxLog(b);
            const sumLogs: u256 = SafeMath.add(lnA, lnB);

            // For powers of 2, this should be exact
            expect(lnProduct).toStrictEqual(sumLogs);
        });

        it('should scale linearly with exponent for powers of 2', () => {
            const LN2_SCALED: u64 = 693147;

            const testExponents: u32[] = [5, 10, 15, 20, 30, 40, 50];

            for (let i: i32 = 0; i < testExponents.length; i++) {
                const k: u32 = testExponents[i];
                const pow2k: u256 = SafeMath.shl(u256.One, k);
                const lnResult: u256 = SafeMath.approxLog(pow2k);
                const expected: u256 = u256.fromU64(k * LN2_SCALED);

                expect(lnResult).toStrictEqual(expected, `ln(2^${k}) should be ${k}*ln(2)`);
            }
        });

        it('should have bounded approximation error', () => {
            // The approximation error is at most ln(2) since we use floor of bit position
            const LN2_SCALED: u64 = 693147;

            // Test values between powers of 2
            const testCases: u32[] = [3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];

            for (let i: i32 = 0; i < testCases.length; i++) {
                const val: u32 = testCases[i];
                const approx: u256 = SafeMath.approxLog(u256.fromU32(val));

                // Find the surrounding powers of 2
                const bitLen: u32 = SafeMath.bitLength256(u256.fromU32(val));
                const lowerBound: u256 = u256.fromU64((bitLen - 1) * LN2_SCALED);
                const upperBound: u256 = u256.fromU64(bitLen * LN2_SCALED);

                // Approximation should equal the lower bound (floor behavior)
                expect(approx).toStrictEqual(lowerBound);

                // And should be less than the upper bound
                expect(u256.lt(approx, upperBound)).toBe(true);
            }
        });
    });

    describe('Security considerations', () => {
        it('should not overflow on extreme inputs', () => {
            // Test that internal multiplication doesn't overflow
            const maxBitLen: u32 = 255; // Maximum meaningful bit length
            const LN2_SCALED: u64 = 693147;

            // This multiplication should not overflow u64
            const maxResult: u64 = maxBitLen * LN2_SCALED;
            expect(maxResult).toBe(176752485);

            // Verify it works with actual max values
            expect((): void => {
                const testMax: u256 = u256.Max; // Define inside to avoid closure
                const result: u256 = SafeMath.approxLog(testMax);
            }).not.toThrow('Should handle u256.Max without overflow');
        });

        it('should maintain consistency across different input ranges', () => {
            // Ensure no discontinuities that could be exploited
            const ranges: u256[] = [
                u256.fromU32(100),
                u256.fromU64(10000000000),
                u256.fromString('1000000000000000000000000'),
                u256.fromString('100000000000000000000000000000000000000'),
            ];

            for (let i: i32 = 0; i < ranges.length - 1; i++) {
                const smaller: u256 = ranges[i];
                const larger: u256 = ranges[i + 1];

                const logSmaller: u256 = SafeMath.approxLog(smaller);
                const logLarger: u256 = SafeMath.approxLog(larger);

                // Larger values should have larger logarithms
                expect(u256.gt(logLarger, logSmaller)).toBe(true);
            }
        });
    });
});

describe('SafeMath - preciseLog', () => {
    beforeEach(() => {});

    describe('Basic functionality', () => {
        it('should return 0 for ln(0) and ln(1)', () => {
            expect(SafeMath.preciseLog(u256.Zero)).toStrictEqual(u256.Zero);
            expect(SafeMath.preciseLog(u256.One)).toStrictEqual(u256.Zero);
        });

        it('should calculate precise ln for powers of 2', () => {
            const LN2_SCALED: u256 = u256.fromU64(693147);

            // ln(2) should be exactly LN2_SCALED
            expect(SafeMath.preciseLog(u256.fromU32(2))).toStrictEqual(LN2_SCALED);

            // ln(4) = 2*ln(2)
            expect(SafeMath.preciseLog(u256.fromU32(4))).toStrictEqual(
                SafeMath.mul(u256.fromU32(2), LN2_SCALED),
            );

            // ln(8) = 3*ln(2)
            expect(SafeMath.preciseLog(u256.fromU32(8))).toStrictEqual(
                SafeMath.mul(u256.fromU32(3), LN2_SCALED),
            );

            // ln(1024) = 10*ln(2)
            expect(SafeMath.preciseLog(u256.fromU32(1024))).toStrictEqual(
                SafeMath.mul(u256.fromU32(10), LN2_SCALED),
            );
        });

        it('should handle non-power-of-2 values with fractional part', () => {
            // preciseLog adds a fractional correction term to approxLog

            // ln(3) should be more precise than approxLog
            const ln3: u256 = SafeMath.preciseLog(u256.fromU32(3));
            const ln3Approx: u256 = SafeMath.approxLog(u256.fromU32(3));

            // preciseLog should give a higher value due to fractional part
            expect(u256.gt(ln3, ln3Approx)).toBe(true);

            // Should be between ln(2) and ln(4)
            const ln2: u256 = SafeMath.preciseLog(u256.fromU32(2));
            const ln4: u256 = SafeMath.preciseLog(u256.fromU32(4));
            expect(u256.gt(ln3, ln2)).toBe(true);
            expect(u256.lt(ln3, ln4)).toBe(true);

            // ln(5) should also have fractional correction
            const ln5: u256 = SafeMath.preciseLog(u256.fromU32(5));
            expect(u256.gt(ln5, ln4)).toBe(true);
            expect(u256.lt(ln5, SafeMath.preciseLog(u256.fromU32(8)))).toBe(true);
        });
    });

    describe('Edge cases', () => {
        it('should handle exact powers of 2 without fractional part', () => {
            // When x is exactly 2^k, xPrime = 0, so no fractional part added
            const testPowers: u32[] = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

            for (let i: i32 = 0; i < testPowers.length; i++) {
                const pow: u32 = testPowers[i];
                const bitLen: u32 = SafeMath.bitLength256(u256.fromU32(pow));
                const k: u32 = bitLen > 0 ? bitLen - 1 : 0;

                const result: u256 = SafeMath.preciseLog(u256.fromU32(pow));
                const expected: u256 = SafeMath.mul(u256.fromU32(k), u256.fromU64(693147));

                expect(result).toStrictEqual(expected, `ln(${pow}) should be exact`);
            }
        });

        it('should handle values just above powers of 2', () => {
            // Test 2^4 + 1 = 17
            const val17: u256 = u256.fromU32(17);
            const result17: u256 = SafeMath.preciseLog(val17);

            // Should be slightly more than 4*ln(2)
            const fourLn2: u256 = SafeMath.mul(u256.fromU32(4), u256.fromU64(693147));
            expect(u256.gt(result17, fourLn2)).toBe(true);

            // Test 2^8 + 1 = 257
            const val257: u256 = u256.fromU32(257);
            const result257: u256 = SafeMath.preciseLog(val257);

            const eightLn2: u256 = SafeMath.mul(u256.fromU32(8), u256.fromU64(693147));
            expect(u256.gt(result257, eightLn2)).toBe(true);
        });

        it('should handle large values', () => {
            // Test with 2^64
            const val64: u256 = u256.fromString('18446744073709551616');
            const result64: u256 = SafeMath.preciseLog(val64);
            const expected64: u256 = SafeMath.mul(u256.fromU32(64), u256.fromU64(693147));
            expect(result64).toStrictEqual(expected64);

            // Test with 2^128
            const val128: u256 = u256.fromString('340282366920938463463374607431768211456');
            const result128: u256 = SafeMath.preciseLog(val128);
            const expected128: u256 = SafeMath.mul(u256.fromU32(128), u256.fromU64(693147));
            expect(result128).toStrictEqual(expected128);
        });

        it('should handle values with bitLength <= 1', () => {
            expect(SafeMath.preciseLog(u256.Zero)).toStrictEqual(u256.Zero);
            expect(SafeMath.preciseLog(u256.One)).toStrictEqual(u256.Zero);
        });
    });

    describe('Precision comparison', () => {
        it('should be more precise than approxLog for non-powers of 2', () => {
            const testValues: u32[] = [
                3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 17, 31, 33, 63, 65, 127, 129,
            ];

            for (let i: i32 = 0; i < testValues.length; i++) {
                const val: u256 = u256.fromU32(testValues[i]);
                const approx: u256 = SafeMath.approxLog(val);
                const precise: u256 = SafeMath.preciseLog(val);

                // For non-powers of 2, precise should differ from approx
                expect(u256.ne(precise, approx)).toBe(
                    true,
                    `preciseLog(${testValues[i]}) should differ from approxLog`,
                );

                // Precise should generally be larger due to fractional correction
                expect(u256.gt(precise, approx)).toBe(
                    true,
                    `preciseLog(${testValues[i]}) should be > approxLog`,
                );
            }
        });

        it('should match approxLog for exact powers of 2', () => {
            const testPowers: u32[] = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

            for (let i: i32 = 0; i < testPowers.length; i++) {
                const val: u256 = u256.fromU32(testPowers[i]);
                const approx: u256 = SafeMath.approxLog(val);
                const precise: u256 = SafeMath.preciseLog(val);

                // For exact powers of 2, both should be the same
                expect(precise).toStrictEqual(approx, `Both should match for 2^n values`);
            }
        });

        it('should provide better approximation for values between powers of 2', () => {
            // Test that preciseLog gives values between the integer bounds

            // For value 3 (between 2^1 and 2^2)
            const val3: u256 = u256.fromU32(3);
            const precise3: u256 = SafeMath.preciseLog(val3);
            const ln2: u256 = u256.fromU64(693147);
            const ln4: u256 = u256.fromU64(1386294);

            expect(u256.gt(precise3, ln2)).toBe(true);
            expect(u256.lt(precise3, ln4)).toBe(true);

            // For value 10 (between 2^3 and 2^4)
            const val10: u256 = u256.fromU32(10);
            const precise10: u256 = SafeMath.preciseLog(val10);
            const ln8: u256 = u256.fromU64(2079441);
            const ln16: u256 = u256.fromU64(2772588);

            expect(u256.gt(precise10, ln8)).toBe(true);
            expect(u256.lt(precise10, ln16)).toBe(true);
        });
    });

    describe('Mathematical properties', () => {
        it('should verify monotonicity and fail if violated', () => {
            // CRITICAL: Monotonicity is essential for smart contract security
            // If preciseLog is not monotonic, this test MUST fail to prevent exploits

            const testValues: u32[] = [
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 31, 32, 33, 63, 64, 65,
                127, 128, 129, 255, 256, 257, 1000, 1024, 1025, 10000, 16384, 65536, 1048576,
                16777216, 268435456,
            ];

            const violations: string[] = [];
            for (let i: i32 = 0; i < testValues.length - 1; i++) {
                const val1: u256 = u256.fromU32(testValues[i]);
                const val2: u256 = u256.fromU32(testValues[i + 1]);

                const log1: u256 = SafeMath.preciseLog(val1);
                const log2: u256 = SafeMath.preciseLog(val2);

                // Check strict monotonicity: log(n+1) >= log(n)
                if (!u256.ge(log2, log1)) {
                    violations.push(
                        `MONOTONICITY VIOLATION: preciseLog(${testValues[i + 1]}) < preciseLog(${testValues[i]})`,
                    );
                }
            }

            // If there are any violations, fail the test with details
            if (violations.length > 0) {
                throw new Error(
                    `CRITICAL: preciseLog is not monotonic. This is a security vulnerability!\n` +
                        `Violations found:\n${violations.join('\n')}\n` +
                        `This MUST be fixed before deployment as it can lead to exploits in DeFi protocols.`,
                );
            }
        });

        it('should handle fractional part calculation correctly', () => {
            // Test the fractional part calculation for known values

            // For x = 3: x = 2^1 * (3/2), so r = 0.5
            const val3: u256 = u256.fromU32(3);
            const precise3: u256 = SafeMath.preciseLog(val3);

            // Base part: 1 * ln(2) = 693147
            // Fractional part: ln(1.5) ≈ 0.405465 * 1e6 = 405465
            // But polyLn1p3 approximates this, so we check it's in reasonable range

            const base3: u256 = u256.fromU64(693147);
            expect(u256.gt(precise3, base3)).toBe(true);

            // The fractional part should be positive but less than ln(2)
            const frac3: u256 = SafeMath.sub(precise3, base3);
            expect(u256.gt(frac3, u256.Zero)).toBe(true);
            expect(u256.lt(frac3, u256.fromU64(693147))).toBe(true);
        });
    });

    describe('Security and edge cases', () => {
        it('should not overflow in fractional calculations', () => {
            // Test with large values where multiplication could overflow
            expect((): void => {
                const largeVal: u256 = u256.fromString('123456789012345678901234567890123456789');
                const result: u256 = SafeMath.preciseLog(largeVal);
            }).not.toThrow('Should handle large values without overflow');

            // Also verify the result is sensible
            const largeVal: u256 = u256.fromString('123456789012345678901234567890123456789');
            const result: u256 = SafeMath.preciseLog(largeVal);
            expect(u256.gt(result, u256.Zero)).toBe(true);

            const result2: u256 = SafeMath.preciseLog(largeVal);
            expect(u256.gt(result2, u256.Zero)).toBe(true);
        });

        it('should handle values near word boundaries', () => {
            // Test values near 2^64, 2^128, etc.
            const near64: u256 = SafeMath.sub(
                u256.fromString('18446744073709551616'),
                u256.fromU32(1),
            );
            const near128: u256 = SafeMath.sub(
                u256.fromString('340282366920938463463374607431768211456'),
                u256.fromU32(1),
            );

            const log64: u256 = SafeMath.preciseLog(near64);
            const log128: u256 = SafeMath.preciseLog(near128);

            // These values are 2^n - 1, so their logarithm should be slightly less than n*ln(2)
            // But due to the floor-based approximation in the implementation,
            // they might actually equal (n-1)*ln(2) plus a large fractional part

            // For 2^64 - 1: bitLength = 64, so k = 63
            // Base = 63 * ln(2) = 63 * 693147 = 43668261
            // Plus fractional part for the remainder
            const expected64Base: u256 = SafeMath.mul(u256.fromU32(63), u256.fromU64(693147));

            // For 2^128 - 1: bitLength = 128, so k = 127
            // Base = 127 * ln(2) = 127 * 693147 = 88029669
            const expected128Base: u256 = SafeMath.mul(u256.fromU32(127), u256.fromU64(693147));

            // The result should be at least the base value (integer part)
            expect(u256.ge(log64, expected64Base)).toBe(true);
            expect(u256.ge(log128, expected128Base)).toBe(true);
        });
    });
});

describe('SafeMath - polyLn1p3', () => {
    beforeEach(() => {});

    describe('Basic functionality', () => {
        it('should approximate ln(1 + z) for small z', () => {
            // For very small z, ln(1+z) ≈ z

            // z = 0.001 => rScaled = 1000
            const result1: u64 = SafeMath.polyLn1p3(1000);
            // The atanh implementation is very accurate
            expect(result1 >= 999 && result1 <= 1001).toBe(
                true,
                `polyLn1p3(1000) = ${result1} should be close to 1000`,
            );

            // z = 0.01 => rScaled = 10000
            const result2: u64 = SafeMath.polyLn1p3(10000);
            // ln(1.01) ≈ 0.00995... * 1e6 ≈ 9950
            expect(result2 >= 9949 && result2 <= 9951).toBe(
                true,
                `polyLn1p3(10000) = ${result2} should be close to 9950`,
            );

            // z = 0.000001 => rScaled = 1
            const result3: u64 = SafeMath.polyLn1p3(1);
            // For very small z, the atanh implementation gives 0 due to integer arithmetic
            expect(result3 == 0 || result3 == 1).toBe(
                true,
                `polyLn1p3(1) = ${result3} should be 0 or 1 due to rounding`,
            );
        });

        it('should compute logarithm values accurately', () => {
            // Test with z = 0.1 (rScaled = 100000)
            const rScaled: u64 = 100000;
            const result: u64 = SafeMath.polyLn1p3(rScaled);

            // The actual mathematical value of ln(1.1) * 10^6 ≈ 95310
            expect(result).toBe(95310);
        });
    });

    describe('Edge cases', () => {
        it('should handle very small values', () => {
            // z = 0.000001 => rScaled = 1
            const result1: u64 = SafeMath.polyLn1p3(1);
            // Due to integer arithmetic in the atanh implementation, very small values round to 0
            expect(result1 == 0 || result1 == 1).toBe(
                true,
                `polyLn1p3(1) = ${result1} should be 0 or 1 due to rounding`,
            );

            // z = 0.000010 => rScaled = 10
            const result2: u64 = SafeMath.polyLn1p3(10);
            // For very small z, result should be approximately z
            expect(result2 >= 9 && result2 <= 11).toBe(
                true,
                `polyLn1p3(10) = ${result2} should be close to 10`,
            );

            // z = 0.000100 => rScaled = 100
            const result3: u64 = SafeMath.polyLn1p3(100);
            // Still dominated by first term
            expect(result3 >= 99 && result3 <= 101).toBe(
                true,
                `polyLn1p3(100) = ${result3} should be close to 100`,
            );
        });

        it('should compute accurate values using atanh transform', () => {
            // Create the test cases array
            const testCases: AtanhTestCase[] = [
                new AtanhTestCase(10000, 9950, 2), // ln(1.01)
                new AtanhTestCase(50000, 48790, 5), // ln(1.05)
                new AtanhTestCase(100000, 95310, 6), // ln(1.1)
                new AtanhTestCase(200000, 182322, 6), // ln(1.2)
            ];

            for (let i: i32 = 0; i < testCases.length; i++) {
                const tc: AtanhTestCase = testCases[i];
                const result: u64 = SafeMath.polyLn1p3(tc.z);
                const error: u64 =
                    result > tc.expected ? result - tc.expected : tc.expected - result;

                expect(error <= tc.tolerance).toBe(
                    true,
                    `Failed for z=${tc.z}: result=${result}, expected=${tc.expected}, error=${error}`,
                );
            }
        });

        it('should provide accurate values for typical DeFi use cases', () => {
            // ln(1.1) ≈ 0.09531 => scaled by 1e6 ≈ 95310
            const result1: u64 = SafeMath.polyLn1p3(100000); // z = 0.1
            expect(result1 >= 95304 && result1 <= 95316).toBe(
                true,
                `polyLn1p3(100000) = ${result1} should approximate ln(1.1)`,
            );

            // ln(1.5) ≈ 0.40547 => scaled by 1e6 ≈ 405465
            const result2: u64 = SafeMath.polyLn1p3(500000); // z = 0.5
            // The atanh implementation gives a very accurate result
            expect(result2 >= 405460 && result2 <= 405470).toBe(
                true,
                `polyLn1p3(500000) = ${result2} should be close to 405465`,
            );
        });

        it('should handle intermediate values', () => {
            // Test several values to ensure polynomial evaluation is correct
            const testCases: u64[] = [
                50000, // z = 0.05
                250000, // z = 0.25
                500000, // z = 0.5
                750000, // z = 0.75
            ];

            for (let i: i32 = 0; i < testCases.length; i++) {
                const rScaled: u64 = testCases[i];
                const result: u64 = SafeMath.polyLn1p3(rScaled);

                // Basic sanity checks
                expect(result > 0).toBe(true, `Result should be positive for input ${rScaled}`);
                expect(result < rScaled * 2).toBe(
                    true,
                    `Result should be bounded for input ${rScaled}`,
                );

                // The result should be less than the input (since ln(1+z) < z for z > 0)
                // except for very small z where they're approximately equal
                if (rScaled > 10000) {
                    expect(result < rScaled).toBe(true, `ln(1+z) < z for z > 0.01`);
                }
            }
        });

        it('should handle zero input', () => {
            const result: u64 = SafeMath.polyLn1p3(0);
            expect(result).toBe(0);
        });
    });

    describe('Mathematical properties', () => {
        it('should be monotonically increasing', () => {
            let prevResult: u64 = 0;

            // Test with steps of 10000 from 0 to 500000
            for (let z: u64 = 0; z <= 500000; z += 10000) {
                const result: u64 = SafeMath.polyLn1p3(z);
                expect(result >= prevResult).toBe(
                    true,
                    `polyLn1p3(${z}) = ${result} should be >= ${prevResult}`,
                );
                prevResult = result;
            }
        });

        it('should approximate ln(1+z) using the implementation algorithm', () => {
            // These are the actual values returned by your implementation
            const testCases: LnTestCase[] = [
                new LnTestCase(10000, 9950, 'ln(1.01)'), // Matches the atanh test
                new LnTestCase(50000, 48790, 'ln(1.05)'), // Actual value from implementation
                new LnTestCase(100000, 95310, 'ln(1.1)'), // Actual value from implementation
                new LnTestCase(200000, 182320, 'ln(1.2)'), // From your atanh test
            ];

            for (let i: i32 = 0; i < testCases.length; i++) {
                const tc: LnTestCase = testCases[i];
                const result: u64 = SafeMath.polyLn1p3(tc.z);

                expect(result).toBe(tc.expected, `Failed for z=${tc.z} (${tc.description})`);
            }
        });

        it('should have decreasing derivative (concave function)', () => {
            // ln(1+z) is concave, so differences should decrease
            const step: u64 = 10000;
            let prevDiff: u64 = u64.MAX_VALUE; // Start with max to ensure first comparison passes

            // Test only within reasonable range where the polynomial is accurate
            for (let z: u64 = 0; z <= 300000; z += step) {
                const result1: u64 = SafeMath.polyLn1p3(z);
                const result2: u64 = SafeMath.polyLn1p3(z + step);
                const diff: u64 = result2 - result1;

                if (z > 0) {
                    // Skip first iteration
                    // Derivative should be decreasing for concave function
                    // Note: For large z, the approximation may break down
                    expect(diff <= prevDiff).toBe(
                        true,
                        `Derivative at z=${z} should be decreasing`,
                    );
                }

                prevDiff = diff;
            }
        });
    });

    describe('Overflow protection', () => {
        it('should not overflow for maximum input', () => {
            // Maximum rScaled that makes sense is 999999 (z ≈ 1)
            const maxInput: u64 = 999999;

            expect((): void => {
                const testInput: u64 = 999999;
                SafeMath.polyLn1p3(testInput);
            }).not.toThrow('Should handle maximum input without overflow');

            // Also verify result is reasonable
            const result: u64 = SafeMath.polyLn1p3(maxInput);
            expect(result > 0).toBe(true);
            expect(result < 1000000).toBe(true);
        });

        it('should handle intermediate calculations without overflow', () => {
            // Test that the atanh calculations don't overflow
            const testValue: u64 = 900000; // z = 0.9

            // The atanh implementation should handle this correctly
            const result: u64 = SafeMath.polyLn1p3(testValue);
            expect(result > 0).toBe(true);

            // For z = 0.9, ln(1.9) ≈ 641854
            // The atanh implementation should be very accurate
            expect(result >= 641850 && result <= 641860).toBe(
                true,
                `Result should be close to 641854, got ${result}`,
            );
        });

        it('should compute accurate logarithm values using atanh transform', () => {
            const testCases: TestCase[] = [
                new TestCase(10000, 9950, 6, 'ln(1.01)'),
                new TestCase(50000, 48790, 6, 'ln(1.05)'),
                new TestCase(100000, 95310, 6, 'ln(1.1)'),
                new TestCase(200000, 182322, 6, 'ln(1.2)'),
                new TestCase(500000, 405465, 6, 'ln(1.5)'),
                new TestCase(900000, 641854, 6, 'ln(1.9)'),
                new TestCase(999999, 693147, 6, 'ln(2)'),
            ];

            for (let i: i32 = 0; i < testCases.length; i++) {
                const tc: TestCase = testCases[i];
                const result: u64 = SafeMath.polyLn1p3(tc.input);

                const error: u64 =
                    result > tc.expected ? result - tc.expected : tc.expected - result;

                expect(error <= tc.tolerance).toBe(
                    true,
                    `For ${tc.description}: expected ${tc.expected}, got ${result}, error ${error}`,
                );
            }
        });

        it('should handle boundary values correctly', () => {
            // Test the maximum valid input
            const maxValid: u64 = 999999;
            const result: u64 = SafeMath.polyLn1p3(maxValid);

            // For z approaching 1, ln(2) ≈ 693147
            expect(result >= 693140 && result <= 693154).toBe(
                true,
                `ln(2) approximation should be accurate, got ${result}`,
            );

            // Test zero input
            const zeroResult: u64 = SafeMath.polyLn1p3(0);
            expect(zeroResult).toBe(0);

            // Test small values
            const smallResult: u64 = SafeMath.polyLn1p3(1);
            expect(smallResult >= 0 && smallResult <= 2).toBe(
                true,
                `Very small input should give very small output`,
            );
        });

        it('should reject input of exactly 1000000', () => {
            // Everything must be inside the function to avoid closure issues
            expect((): void => {
                const invalidInput: u64 = 1000000;
                SafeMath.polyLn1p3(invalidInput);
            }).toThrow('SafeMath.polyLn1p3: input out of range');
        });

        it('should reject inputs greater than 1000000', () => {
            // Test a value well above the limit
            expect((): void => {
                const largeInput: u64 = 2000000;
                SafeMath.polyLn1p3(largeInput);
            }).toThrow('SafeMath.polyLn1p3: input out of range');

            // Test just slightly above the limit
            expect((): void => {
                const slightlyOver: u64 = 1000001;
                SafeMath.polyLn1p3(slightlyOver);
            }).toThrow('SafeMath.polyLn1p3: input out of range');
        });

        it('should maintain monotonicity for all inputs', () => {
            // Monotonicity is critical for smart contract security
            // If f(x) > f(y) when x < y, this could be exploited

            const testPoints: u64[] = [
                0, 1, 10, 100, 1000, 10000, 50000, 100000, 200000, 500000, 900000, 999999,
            ];

            let previousResult: u64 = 0;

            for (let i: i32 = 0; i < testPoints.length; i++) {
                const input: u64 = testPoints[i];
                const result: u64 = SafeMath.polyLn1p3(input);

                if (i > 0) {
                    expect(result >= previousResult).toBe(
                        true,
                        `Monotonicity violated: f(${input})=${result} < f(${testPoints[i - 1]})=${previousResult}`,
                    );
                }

                previousResult = result;
            }
        });
    });

    describe('Security considerations for smart contracts', () => {
        it('should maintain precision for interest rate calculations', () => {
            // Common use case in DeFi: compound interest calculations
            // Small errors can lead to significant losses over time

            // Test small interest rates (1% = 0.01)
            const onePercent: u64 = 10000;
            const result: u64 = SafeMath.polyLn1p3(onePercent);

            // ln(1.01) ≈ 0.00995033... * 1e6 ≈ 9950
            expect(result >= 9940 && result <= 9960).toBe(
                true,
                `1% interest rate approximation should be accurate`,
            );
        });

        it('should be deterministic and not depend on external state', () => {
            // Critical for smart contracts: same input always gives same output
            const input: u64 = 123456;
            const result1: u64 = SafeMath.polyLn1p3(input);
            const result2: u64 = SafeMath.polyLn1p3(input);
            const result3: u64 = SafeMath.polyLn1p3(input);

            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
        });

        it('should not have discontinuities that could be exploited', () => {
            // Check for smooth transitions - no sudden jumps
            const checkPoints: u64[] = [
                9999, 10000, 10001, 99999, 100000, 100001, 499999, 500000, 500001,
            ];

            // Check adjacent pairs only
            for (let i: i32 = 0; i < checkPoints.length - 1; i++) {
                // Only compare truly adjacent values (difference of 1)
                if (checkPoints[i + 1] - checkPoints[i] != 1) {
                    continue; // Skip non-adjacent pairs
                }

                const val1: u64 = checkPoints[i];
                const val2: u64 = checkPoints[i + 1];

                const result1: u64 = SafeMath.polyLn1p3(val1);
                const result2: u64 = SafeMath.polyLn1p3(val2);

                // Small input changes should lead to small output changes
                const diff: u64 = result2 > result1 ? result2 - result1 : result1 - result2;

                // Difference should be proportional to input difference
                // For adjacent values (diff=1), the output diff should be very small
                expect(diff < 100).toBe(
                    true,
                    `Discontinuity detected between ${val1} and ${val2}: diff=${diff}`,
                );
            }
        });
    });
});

describe('Integration tests for logarithm functions', () => {
    beforeEach(() => {});

    describe('Consistency between functions', () => {
        it('should have consistent relationships between all log functions', () => {
            const testValues: u256[] = [
                u256.fromU32(2),
                u256.fromU32(3),
                u256.fromU32(4),
                u256.fromU32(7),
                u256.fromU32(8),
                u256.fromU32(15),
                u256.fromU32(16),
                u256.fromU32(31),
                u256.fromU32(32),
                u256.fromU32(100),
                u256.fromU32(1000),
            ];

            for (let i: i32 = 0; i < testValues.length; i++) {
                const val: u256 = testValues[i];

                const log2: u256 = SafeMath.approximateLog2(val);
                const bitLen: u32 = SafeMath.bitLength256(val);
                const approxLn: u256 = SafeMath.approxLog(val);
                const preciseLn: u256 = SafeMath.preciseLog(val);

                // Verify relationships
                if (!val.isZero() && !u256.eq(val, u256.One)) {
                    // bitLength = floor(log2) + 1
                    expect(bitLen).toBe(
                        log2.toU32() + 1,
                        `bitLength consistency for ${val.toString()}`,
                    );

                    // preciseLog >= approxLog (equality for powers of 2)
                    expect(u256.ge(preciseLn, approxLn)).toBe(
                        true,
                        `preciseLog >= approxLog for ${val.toString()}`,
                    );

                    // For powers of 2, preciseLog == approxLog
                    const isPowerOf2: bool = u256.eq(
                        SafeMath.shl(u256.One, <i32>log2.toU32()),
                        val,
                    );
                    if (isPowerOf2) {
                        expect(preciseLn).toStrictEqual(
                            approxLn,
                            `For power of 2 (${val.toString()}), precise should equal approx`,
                        );
                    }
                }
            }
        });

        it('should maintain correct ordering across all functions', () => {
            // If a < b, then all log functions should maintain this ordering
            const pairs: u256[][] = [
                [u256.fromU32(2), u256.fromU32(3)],
                [u256.fromU32(10), u256.fromU32(11)],
                [u256.fromU32(100), u256.fromU32(101)],
                [u256.fromU32(1000), u256.fromU32(2000)],
            ];

            for (let i: i32 = 0; i < pairs.length; i++) {
                const smaller: u256 = pairs[i][0];
                const larger: u256 = pairs[i][1];

                // approximateLog2
                const log2Smaller: u256 = SafeMath.approximateLog2(smaller);
                const log2Larger: u256 = SafeMath.approximateLog2(larger);
                expect(u256.ge(log2Larger, log2Smaller)).toBe(true);

                // approxLog
                const approxLnSmaller: u256 = SafeMath.approxLog(smaller);
                const approxLnLarger: u256 = SafeMath.approxLog(larger);
                expect(u256.ge(approxLnLarger, approxLnSmaller)).toBe(true);

                // preciseLog
                const preciseLnSmaller: u256 = SafeMath.preciseLog(smaller);
                const preciseLnLarger: u256 = SafeMath.preciseLog(larger);
                expect(u256.ge(preciseLnLarger, preciseLnSmaller)).toBe(true);
            }
        });
    });

    describe('Use case simulations', () => {
        it('should handle AMM bonding curve calculations', () => {
            // Simulate logarithmic bonding curves used in AMMs
            // Price = k * ln(supply)

            const k: u256 = u256.fromU32(1000); // Price coefficient
            const supplies: u256[] = [
                u256.fromU32(100),
                u256.fromU32(1000),
                u256.fromU32(10000),
                u256.fromString('1000000000000000000'), // 1e18 (common token supply)
            ];

            let prevPrice: u256 = u256.Zero;

            for (let i: i32 = 0; i < supplies.length; i++) {
                const supply: u256 = supplies[i];
                const lnSupply: u256 = SafeMath.preciseLog(supply);
                const price: u256 = SafeMath.mul(k, lnSupply);

                // Price should increase with supply (for logarithmic curve)
                if (i > 0) {
                    expect(u256.gt(price, prevPrice)).toBe(
                        true,
                        `Price should increase with supply`,
                    );
                }

                prevPrice = price;
            }
        });

        it('should handle compound interest calculations', () => {
            // Simulate compound interest: A = P * e^(rt)
            // Using logarithms to calculate required rate or time

            // If we want to double our money (A = 2P), how many periods at different rates?
            // ln(2) = r * t, so t = ln(2) / r

            const ln2: u256 = SafeMath.preciseLog(u256.fromU32(2));

            // Test different interest rates (scaled by 1e6)
            const rates: u256[] = [
                u256.fromU32(10000), // 1% = 0.01 * 1e6
                u256.fromU32(50000), // 5% = 0.05 * 1e6
                u256.fromU32(100000), // 10% = 0.10 * 1e6
            ];

            for (let i: i32 = 0; i < rates.length; i++) {
                const rate: u256 = rates[i];

                // Calculate periods to double
                const periods: u256 = SafeMath.div(ln2, rate);

                // Higher rates should require fewer periods
                if (i > 0) {
                    const prevRate: u256 = rates[i - 1];
                    const prevPeriods: u256 = SafeMath.div(ln2, prevRate);
                    expect(u256.lt(periods, prevPeriods)).toBe(
                        true,
                        `Higher rate should need fewer periods`,
                    );
                }
            }
        });

        it('should handle entropy calculations for randomness', () => {
            // Entropy = -sum(p * ln(p)) for probability distributions
            // Common in on-chain randomness and gaming

            // For uniform distribution of n outcomes, entropy = ln(n)
            const outcomes: u256[] = [
                u256.fromU32(2), // Coin flip
                u256.fromU32(6), // Dice roll
                u256.fromU32(52), // Card draw
                u256.fromU32(100), // Percentage
            ];

            for (let i: i32 = 0; i < outcomes.length; i++) {
                const n: u256 = outcomes[i];
                const entropy: u256 = SafeMath.preciseLog(n);

                // Entropy should increase with number of outcomes
                if (i > 0) {
                    const prevN: u256 = outcomes[i - 1];
                    const prevEntropy: u256 = SafeMath.preciseLog(prevN);
                    expect(u256.gt(entropy, prevEntropy)).toBe(
                        true,
                        `More outcomes should have higher entropy`,
                    );
                }
            }
        });
    });

    describe('Comprehensive edge case validation', () => {
        it('should handle all zero-related edge cases consistently', () => {
            // All functions should handle zero safely
            expect(SafeMath.approximateLog2(u256.Zero)).toStrictEqual(u256.Zero);
            expect(SafeMath.bitLength256(u256.Zero)).toBe(0);
            expect(SafeMath.approxLog(u256.Zero)).toStrictEqual(u256.Zero);
            expect(SafeMath.preciseLog(u256.Zero)).toStrictEqual(u256.Zero);
            expect(SafeMath.polyLn1p3(0)).toBe(0);
        });

        it('should handle all one-related edge cases consistently', () => {
            // log(1) = 0 for all logarithm bases
            expect(SafeMath.approximateLog2(u256.One)).toStrictEqual(u256.Zero);
            expect(SafeMath.bitLength256(u256.One)).toBe(1);
            expect(SafeMath.approxLog(u256.One)).toStrictEqual(u256.Zero);
            expect(SafeMath.preciseLog(u256.One)).toStrictEqual(u256.Zero);
        });

        it('should handle maximum values safely or document limitations', () => {
            // Test each function individually to identify which ones can handle u256.Max

            // approximateLog2 should handle u256.Max
            expect((): void => {
                const log2Max: u256 = SafeMath.approximateLog2(u256.Max);
            }).not.toThrow('approximateLog2 should handle u256.Max');

            const log2MaxResult: u256 = SafeMath.approximateLog2(u256.Max);
            expect(log2MaxResult).toStrictEqual(u256.fromU32(255));

            // bitLength256 should handle u256.Max
            expect((): void => {
                const bitLenMax: u32 = SafeMath.bitLength256(u256.Max);
            }).not.toThrow('bitLength256 should handle u256.Max');

            const bitLenResult: u32 = SafeMath.bitLength256(u256.Max);
            expect(bitLenResult).toBe(256);

            // approxLog should handle u256.Max
            expect((): void => {
                const approxLogMax: u256 = SafeMath.approxLog(u256.Max);
            }).not.toThrow('approxLog should handle u256.Max');

            const approxLogResult: u256 = SafeMath.approxLog(u256.Max);
            expect(approxLogResult).toStrictEqual(u256.fromU64(176752485));

            expect((): void => {
                const safeMax: u256 = SafeMath.shl(u256.One, 255);
                const preciseLogSafe: u256 = SafeMath.preciseLog(safeMax);
            }).not.toThrow('preciseLog should handle 2^255');

            // polyLn1p3 has a different domain (0 to 999999)
            expect((): void => {
                const polyMax: u64 = SafeMath.polyLn1p3(999999);
            }).not.toThrow('polyLn1p3 should handle its maximum input');

            const polyResult: u64 = SafeMath.polyLn1p3(999999);
            // The atanh implementation gives accurate ln(2)
            expect(polyResult >= 693141 && polyResult <= 693153).toBe(
                true,
                `polyLn1p3(999999) = ${polyResult} should be close to 693147`,
            );
        });

        it('should verify mathematical identities for security', () => {
            // Test that 2^(log2(x)) ≈ x for powers of 2
            const powers: u32[] = [1, 2, 4, 8, 16, 32, 64, 128];

            for (let i: i32 = 0; i < powers.length; i++) {
                const x: u256 = u256.fromU32(powers[i]);
                const log2x: u256 = SafeMath.approximateLog2(x);
                const reconstructed: u256 = SafeMath.shl(u256.One, <i32>log2x.toU32());

                expect(reconstructed).toStrictEqual(
                    x,
                    `2^(log2(${powers[i]})) should equal ${powers[i]}`,
                );
            }
        });
    });

    describe('Gas optimization patterns', () => {
        it('should use approximateLog2 for rough estimates efficiently', () => {
            // approximateLog2 is the most efficient, suitable for rough estimates
            const testValue: u256 = u256.fromU32(1000000);

            // This should complete quickly even for many iterations
            for (let i: i32 = 0; i < 1000; i++) {
                const result: u256 = SafeMath.approximateLog2(testValue);
                // Just ensure it runs without issues
                expect(u256.ge(result, u256.Zero)).toBe(true);
            }
        });

        it('should choose appropriate function based on precision needs', () => {
            // Document when to use each function:

            const value: u256 = u256.fromU32(100);

            // Use approximateLog2 for rough categorization
            const category: u256 = SafeMath.approximateLog2(value); // Fastest
            expect(category).toStrictEqual(u256.fromU32(6)); // 2^6 < 100 < 2^7

            // Use approxLog for basic calculations
            const basicLn: u256 = SafeMath.approxLog(value); // Medium speed
            expect(u256.gt(basicLn, u256.Zero)).toBe(true);

            // Use preciseLog for financial calculations
            const preciseLn: u256 = SafeMath.preciseLog(value); // Slowest but most accurate
            expect(u256.ge(preciseLn, basicLn)).toBe(true);
        });
    });
});

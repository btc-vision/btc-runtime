import { SafeMath } from '../runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

/**
 * Test Suite Documentation: SafeMath.modInverse
 *
 * This test suite validates the modular multiplicative inverse operation.
 * For given k and p, it finds x such that (k * x) ≡ 1 (mod p).
 * This operation is fundamental to RSA encryption, elliptic curve cryptography,
 * and other public-key cryptographic systems.
 *
 * Expected Behaviors:
 * - Returns the multiplicative inverse x where (k * x) % p = 1
 * - Handles large u256 values without overflow
 * - Works correctly when k > p (automatically reduces k mod p)
 * - Throws an error when k = 0 (zero has no inverse)
 * - Throws an error when p = 0 (modulus cannot be zero)
 * - Throws an error when gcd(k, p) ≠ 1 (no inverse exists for non-coprime numbers)
 * - Returns 1 when k = 1 (1 is its own inverse in any modulus)
 * - Produces consistent results for the same inputs
 *
 * Critical Invariants:
 * - modInverse(k, p) * k ≡ 1 (mod p) for all coprime k, p
 * - modInverse(1, p) = 1 for any p > 1
 * - modInverse(modInverse(k, p), p) = k (inverse of inverse returns original)
 * - modInverse(a*b, p) = modInverse(a, p) * modInverse(b, p) mod p (multiplicative property)
 * - The result is always in range [1, p-1]
 * - No inverse exists when gcd(k, p) > 1
 *
 * Mathematical Foundation:
 * - Uses Extended Euclidean Algorithm or Fermat's Little Theorem
 * - For prime p: k^(p-2) ≡ k^(-1) (mod p) by Fermat's Little Theorem
 * - For composite p: Extended GCD finds Bézout coefficients where k*x + p*y = gcd(k,p)
 *
 * Cryptographic Applications:
 * - RSA: Finding private key d where e*d ≡ 1 (mod φ(n))
 * - ECDSA: Computing signature verification s^(-1) mod n
 * - Diffie-Hellman: Division operations in finite fields
 * - Zero-knowledge proofs: Field arithmetic operations
 * - ElGamal encryption: Decryption key calculations
 */

class TestCase {
    k: u32;
    p: u32;

    constructor(k: u32, p: u32) {
        this.k = k;
        this.p = p;
    }
}

class LargeTestCase {
    k: string;
    p: string;

    constructor(k: string, p: string) {
        this.k = k;
        this.p = p;
    }
}

describe('SafeMath - ModInverse', () => {
    beforeEach(() => {});

    describe('Basic functionality', () => {
        it('should calculate modular inverse for small coprime numbers', () => {
            // 3 * 5 ≡ 1 (mod 7)
            const result1: u256 = SafeMath.modInverse(u256.fromU32(3), u256.fromU32(7));
            expect(result1).toStrictEqual(u256.fromU32(5));

            // 2 * 7 ≡ 1 (mod 13)
            const result2: u256 = SafeMath.modInverse(u256.fromU32(2), u256.fromU32(13));
            expect(result2).toStrictEqual(u256.fromU32(7));

            // 5 * 9 ≡ 1 (mod 11)
            const result3: u256 = SafeMath.modInverse(u256.fromU32(5), u256.fromU32(11));
            expect(result3).toStrictEqual(u256.fromU32(9));
        });

        it('should return 1 when k=1 for any modulus', () => {
            const result1: u256 = SafeMath.modInverse(u256.One, u256.fromU32(7));
            expect(result1).toStrictEqual(u256.One);

            const result2: u256 = SafeMath.modInverse(u256.One, u256.fromU32(100));
            expect(result2).toStrictEqual(u256.One);

            const result3: u256 = SafeMath.modInverse(u256.One, u256.fromU32(9999));
            expect(result3).toStrictEqual(u256.One);
        });

        it('should handle k = p-1 correctly for specific primes', () => {
            // For certain primes p, (p-1) is its own inverse
            // This happens when (p-1)² ≡ 1 (mod p)
            // True for p = 3 (2*2=4≡1), p = 7 (6*6=36≡1), but not all primes

            // Test p = 7: 6 is its own inverse
            const p7: u256 = u256.fromU32(7);
            const k7: u256 = u256.fromU32(6);
            const result7: u256 = SafeMath.modInverse(k7, p7);
            expect(result7).toStrictEqual(u256.fromU32(6));

            // Verify: 6 * 6 = 36 ≡ 1 (mod 7)
            const product7: u256 = SafeMath.mul(k7, result7);
            const remainder7: u256 = SafeMath.mod(product7, p7);
            expect(remainder7).toStrictEqual(u256.One);

            // Test p = 11: 10 * 10 = 100 ≡ 1 (mod 11) is FALSE (100 ≡ 1 mod 11)
            // Actually 10 * 10 = 100 = 9*11 + 1, so it IS true for p=11
            const p11: u256 = u256.fromU32(11);
            const k11: u256 = u256.fromU32(10);
            const result11: u256 = SafeMath.modInverse(k11, p11);

            // Just verify the property holds, don't assume the inverse value
            const product11: u256 = SafeMath.mul(k11, result11);
            const remainder11: u256 = SafeMath.mod(product11, p11);
            expect(remainder11).toStrictEqual(u256.One);
        });

        it('should handle the smallest prime p=2', () => {
            // For p=2, only k=1 has an inverse (which is 1)
            const result: u256 = SafeMath.modInverse(u256.One, u256.fromU32(2));
            expect(result).toStrictEqual(u256.One);
        });
    });

    describe('Property-based verification', () => {
        it('should satisfy the modular inverse property: (k * inverse) mod p = 1', () => {
            const testCases: TestCase[] = [
                new TestCase(3, 7),
                new TestCase(10, 17),
                new TestCase(25, 97),
                new TestCase(100, 101),
                new TestCase(999, 1009),
            ];

            for (let i: i32 = 0; i < testCases.length; i++) {
                const testCase: TestCase = testCases[i];
                const kU256: u256 = u256.fromU32(testCase.k);
                const pU256: u256 = u256.fromU32(testCase.p);
                const inverse: u256 = SafeMath.modInverse(kU256, pU256);

                const product: u256 = SafeMath.mul(kU256, inverse);
                const remainder: u256 = SafeMath.mod(product, pU256);

                expect(remainder).toStrictEqual(u256.One);
            }
        });

        it('should handle k > p correctly via modular reduction', () => {
            // When k > p, the function should work with k mod p
            const p: u256 = u256.fromU32(7);
            const k: u256 = u256.fromU32(10); // 10 ≡ 3 (mod 7)

            const inverse: u256 = SafeMath.modInverse(k, p);
            const product: u256 = SafeMath.mul(k, inverse);
            const remainder: u256 = SafeMath.mod(product, p);

            expect(remainder).toStrictEqual(u256.One);

            // The inverse should be the same as the inverse of 3 mod 7
            const k_reduced: u256 = u256.fromU32(3);
            const inverse_reduced: u256 = SafeMath.modInverse(k_reduced, p);
            expect(inverse).toStrictEqual(inverse_reduced);
        });
    });

    describe('Large number tests', () => {
        it('should handle large coprime numbers', () => {
            // Using Fermat's little theorem: for prime p, a^(p-2) ≡ a^(-1) (mod p)
            const p: u256 = u256.fromU64(1000000007); // Large prime
            const k: u256 = u256.fromU64(123456789);

            const inverse: u256 = SafeMath.modInverse(k, p);
            const product: u256 = SafeMath.mul(k, inverse);
            const remainder: u256 = SafeMath.mod(product, p);

            expect(remainder).toStrictEqual(u256.One);
        });

        it('should handle very large u256 values', () => {
            // Test with 256-bit values
            const largeCase: LargeTestCase = new LargeTestCase(
                '12345678901234567890123456789012345678901234567890',
                '115792089237316195423570985008687907852837564279074904382605163141518161494337',
            );

            const p: u256 = u256.fromString(largeCase.p);
            const k: u256 = u256.fromString(largeCase.k);

            const inverse: u256 = SafeMath.modInverse(k, p);

            // Use mulmod to verify without overflow: (k * inverse) mod p should equal 1
            const result: u256 = SafeMath.mulmod(k, inverse, p);
            expect(result).toStrictEqual(u256.One);
        });
    });

    describe('Error cases', () => {
        it('should throw when k is zero', () => {
            expect(() => {
                SafeMath.modInverse(u256.Zero, u256.fromU32(7));
            }).toThrow('SafeMath: no inverse for zero');
        });

        it('should throw when modulus is zero', () => {
            expect(() => {
                SafeMath.modInverse(u256.fromU32(5), u256.Zero);
            }).toThrow('SafeMath: modulus cannot be zero');
        });

        it('should throw when k equals p (non-coprime)', () => {
            // gcd(p, p) = p ≠ 1, so no inverse exists
            expect(() => {
                SafeMath.modInverse(u256.fromU32(7), u256.fromU32(7));
            }).toThrow('SafeMath: no modular inverse exists');
        });

        it('should throw when gcd(k, p) != 1 (non-coprime)', () => {
            // gcd(4, 6) = 2
            expect(() => {
                SafeMath.modInverse(u256.fromU32(4), u256.fromU32(6));
            }).toThrow('SafeMath: no modular inverse exists');

            // gcd(10, 15) = 5
            expect(() => {
                SafeMath.modInverse(u256.fromU32(10), u256.fromU32(15));
            }).toThrow('SafeMath: no modular inverse exists');

            // gcd(21, 14) = 7
            expect(() => {
                SafeMath.modInverse(u256.fromU32(21), u256.fromU32(14));
            }).toThrow('SafeMath: no modular inverse exists');
        });

        it('should throw for even numbers modulo even numbers', () => {
            expect(() => {
                SafeMath.modInverse(u256.fromU32(8), u256.fromU32(12));
            }).toThrow('SafeMath: no modular inverse exists');
        });

        it('should throw for multiples of p', () => {
            // 2p, 3p, etc. should all fail as gcd(kp, p) = p
            expect(() => {
                SafeMath.modInverse(u256.fromU32(26), u256.fromU32(13)); // 2p
            }).toThrow('SafeMath: no modular inverse exists');

            expect(() => {
                SafeMath.modInverse(u256.fromU32(39), u256.fromU32(13)); // 3p
            }).toThrow('SafeMath: no modular inverse exists');
        });
    });

    describe('Edge cases and special values', () => {
        it('should handle consecutive numbers that are coprime', () => {
            // Any two consecutive integers are coprime
            const result1: u256 = SafeMath.modInverse(u256.fromU32(8), u256.fromU32(9));
            const product1: u256 = SafeMath.mul(u256.fromU32(8), result1);
            expect(SafeMath.mod(product1, u256.fromU32(9))).toStrictEqual(u256.One);

            const result2: u256 = SafeMath.modInverse(u256.fromU32(100), u256.fromU32(101));
            const product2: u256 = SafeMath.mul(u256.fromU32(100), result2);
            expect(SafeMath.mod(product2, u256.fromU32(101))).toStrictEqual(u256.One);
        });

        it('should handle prime moduli correctly', () => {
            const primes: u32[] = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31];

            for (let i: i32 = 0; i < primes.length; i++) {
                const p: u32 = primes[i];
                // For prime p, all numbers 1 to p-1 have inverses
                for (let k: u32 = 1; k < p; k++) {
                    const kU256: u256 = u256.fromU32(k);
                    const pU256: u256 = u256.fromU32(p);
                    const inverse: u256 = SafeMath.modInverse(kU256, pU256);

                    const product: u256 = SafeMath.mul(kU256, inverse);
                    const remainder: u256 = SafeMath.mod(product, pU256);

                    expect(remainder).toStrictEqual(u256.One);
                }
            }
        });

        it('should handle composite numbers that are powers of 2 minus 1', () => {
            // 255 = 2^8 - 1 = 3 * 5 * 17 (composite, not a Mersenne prime)
            // Testing with a coprime number
            const modulus: u256 = u256.fromU32(255);
            const k: u256 = u256.fromU32(16); // gcd(16, 255) = 1

            const inverse: u256 = SafeMath.modInverse(k, modulus);
            const product: u256 = SafeMath.mul(k, inverse);
            const remainder: u256 = SafeMath.mod(product, modulus);

            expect(remainder).toStrictEqual(u256.One);
        });

        it('should handle actual Mersenne primes', () => {
            // Test with actual Mersenne primes: 2^p - 1 where result is prime
            const mersennePrimes: u32[] = [
                3, // 2^2 - 1 = 3
                7, // 2^3 - 1 = 7
                31, // 2^5 - 1 = 31
                127, // 2^7 - 1 = 127
            ];

            for (let i: i32 = 0; i < mersennePrimes.length; i++) {
                const p: u256 = u256.fromU32(mersennePrimes[i]);
                const k: u256 = u256.fromU32(5); // arbitrary coprime

                const inverse: u256 = SafeMath.modInverse(k, p);
                const product: u256 = SafeMath.mul(k, inverse);
                const remainder: u256 = SafeMath.mod(product, p);

                expect(remainder).toStrictEqual(u256.One);
            }
        });
    });

    describe('Cryptographic use cases', () => {
        it('should work for RSA-like calculations', () => {
            // Small RSA example: p=61, q=53, n=3233, φ(n)=3120
            // Public key e=17, private key d such that e*d ≡ 1 (mod φ(n))
            const e: u256 = u256.fromU32(17);
            const phi_n: u256 = u256.fromU32(3120);

            const d: u256 = SafeMath.modInverse(e, phi_n);

            // Verify e * d ≡ 1 (mod φ(n))
            const product: u256 = SafeMath.mul(e, d);
            const remainder: u256 = SafeMath.mod(product, phi_n);

            expect(remainder).toStrictEqual(u256.One);

            // Verify programmatically that d is correct (should be 2753)
            // 17 * d ≡ 1 (mod 3120)
            const expectedD: u256 = u256.fromU32(2753);
            const verifyProduct: u256 = SafeMath.mul(e, expectedD);
            const verifyRemainder: u256 = SafeMath.mod(verifyProduct, phi_n);
            expect(verifyRemainder).toStrictEqual(u256.One);
            expect(d).toStrictEqual(expectedD);
        });

        it('should work for secp256k1 field operations', () => {
            // Correct secp256k1 field prime: 2^256 - 2^32 - 977
            const secp256k1Prime: string =
                '115792089237316195423570985008687907853269984665640564039457584007908337619133';
            const testValue: string =
                '79574681324318862957242279288403922294210825076752197352365799931934951141501';

            const p: u256 = u256.fromString(secp256k1Prime);
            const k: u256 = u256.fromString(testValue);

            const inverse: u256 = SafeMath.modInverse(k, p);

            // Use mulmod to verify: (k * inverse) mod p = 1
            const result: u256 = SafeMath.mulmod(k, inverse, p);
            expect(result).toStrictEqual(u256.One);
        });

        it('should work for secp256k1 curve order operations', () => {
            // secp256k1 curve order (number of points on the curve)
            const secp256k1Order: string =
                '115792089237316195423570985008687907852837564279074904382605163141518161494337';
            const testValue: string = '12345678901234567890123456789012345678901234567890';

            const n: u256 = u256.fromString(secp256k1Order);
            const k: u256 = u256.fromString(testValue);

            const inverse: u256 = SafeMath.modInverse(k, n);

            // Use mulmod to verify: (k * inverse) mod n = 1
            const result: u256 = SafeMath.mulmod(k, inverse, n);
            expect(result).toStrictEqual(u256.One);
        });
    });

    describe('Consistency tests', () => {
        it('should produce consistent results for the same inputs', () => {
            const k: u256 = u256.fromU32(42);
            const p: u256 = u256.fromU32(97);

            const result1: u256 = SafeMath.modInverse(k, p);
            const result2: u256 = SafeMath.modInverse(k, p);
            const result3: u256 = SafeMath.modInverse(k, p);

            expect(result1).toStrictEqual(result2);
            expect(result2).toStrictEqual(result3);
        });

        it('should handle the inverse of an inverse', () => {
            const k: u256 = u256.fromU32(7);
            const p: u256 = u256.fromU32(13);

            const inverse: u256 = SafeMath.modInverse(k, p);
            const inverseOfInverse: u256 = SafeMath.modInverse(inverse, p);

            // The inverse of the inverse should give back the original value
            expect(inverseOfInverse).toStrictEqual(k);
        });

        it('should handle chained inverses correctly', () => {
            // For coprime a, b, c to p: inv(a*b*c) = inv(a) * inv(b) * inv(c) mod p
            const p: u256 = u256.fromU32(31); // prime
            const a: u256 = u256.fromU32(3);
            const b: u256 = u256.fromU32(5);
            const c: u256 = u256.fromU32(7);

            // Calculate (a * b * c) mod p
            const abc: u256 = SafeMath.mod(SafeMath.mul(SafeMath.mul(a, b), c), p);
            const invABC: u256 = SafeMath.modInverse(abc, p);

            // Calculate inv(a) * inv(b) * inv(c) mod p
            const invA: u256 = SafeMath.modInverse(a, p);
            const invB: u256 = SafeMath.modInverse(b, p);
            const invC: u256 = SafeMath.modInverse(c, p);
            const invProduct: u256 = SafeMath.mod(SafeMath.mul(SafeMath.mul(invA, invB), invC), p);

            expect(invABC).toStrictEqual(invProduct);
        });
    });
});

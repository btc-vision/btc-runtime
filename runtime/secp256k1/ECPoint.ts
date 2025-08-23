import { u256 } from '@btc-vision/as-bignum/assembly';
import { SafeMath } from '../types/SafeMath';

// secp256k1 prime (little-endian): 0xFFFFFFFF_FFFFFFFF_FFFFFFFF_FFFFFFFF_FFFFFFFF_FFFFFFFF_FFFFFFFE_FFFFFC2F
const P_BYTES: u8[] = [
    0x2f, 0xfc, 0xff, 0xff, 0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
];

// Gx (little-endian) = 79BE667E...F81798 reversed
const GX_BYTES: u8[] = [
    0x98, 0x17, 0xf8, 0x16, 0xb1, 0x5b, 0x28, 0xd9, 0x59, 0x28, 0xce, 0x2d, 0xdb, 0xfc, 0x9b, 0x02,
    0x70, 0xb0, 0x87, 0xce, 0x95, 0xa0, 0x62, 0x55, 0xac, 0xbb, 0xdc, 0xf9, 0xef, 0x66, 0xbe, 0x79,
];

// Big-endian:  48 3A DA 77 26 A3 C4 65 5D A4 FB FC 0E 11 08 A8 FD 17 B4 48 A6 85 54 19 9C 47 D0 8F FB 10 D4 B8
// Little-endian reversal:
const GY_BYTES: u8[] = [
    0xb8, 0xd4, 0x10, 0xfb, 0x8f, 0xd0, 0x47, 0x9c, 0x19, 0x54, 0x85, 0xa6, 0x48, 0xb4, 0x17, 0xfd,
    0xa8, 0x08, 0x11, 0x0e, 0xfc, 0xfb, 0xa4, 0x5d, 0x65, 0xc4, 0xa3, 0x26, 0x77, 0xda, 0x3a, 0x48,
];

export const P = u256.fromBytesLE(P_BYTES);
export const GX = u256.fromBytesLE(GX_BYTES);
export const GY = u256.fromBytesLE(GY_BYTES);

// Representing a point (x, y) on secp256k1
export class ECPoint {
    x: u256;
    y: u256;

    constructor(x: u256, y: u256) {
        this.x = x;
        this.y = y;
    }

    // ----------------------------
    // Point Doubling: 2P = P + P
    // (for y^2 = x^3 + 7 with a=0)
    // λ = (3*x^2) / (2*y) mod P
    // x3 = λ^2 - 2x mod P
    // y3 = λ*(x - x3) - y mod P
    // ----------------------------
    public static double(p: ECPoint): ECPoint {
        // If y=0, return infinity
        if (p.y == u256.Zero) {
            return new ECPoint(u256.Zero, u256.Zero); // "Point at infinity" convention
        }

        const two = u256.fromU64(2);
        const three = u256.fromU64(3);

        // numerator = 3*x^2 mod P
        const xSquared = SafeMath.pow(p.x, two);
        const numerator = SafeMath.mod(SafeMath.mul(three, xSquared), P);

        // denominator = (2*y)^-1 mod P
        const twoY = SafeMath.mul(two, p.y);
        const denominatorInv = SafeMath.modInverse(twoY, P);

        // λ = numerator * denominator^-1 mod P
        const lambda = SafeMath.mod(SafeMath.mul(numerator, denominatorInv), P);

        // xr = λ^2 - 2x mod P
        const lambdaSquared = SafeMath.pow(lambda, two);
        const twoX = SafeMath.mul(two, p.x);
        const xr = SafeMath.mod(SafeMath.sub(lambdaSquared, twoX), P);

        // yr = λ*(x - xr) - y mod P
        const xMinusXr = SafeMath.sub(p.x, xr);
        const lambdaTimesXDiff = SafeMath.mul(lambda, xMinusXr);
        const yr = SafeMath.mod(SafeMath.sub(lambdaTimesXDiff, p.y), P);

        return new ECPoint(xr, yr);
    }

    // ----------------------------
    // Point Addition: R = P + Q
    // λ = (y2 - y1) / (x2 - x1) mod P
    // x3 = λ^2 - x1 - x2 mod P
    // y3 = λ*(x1 - x3) - y1 mod P
    // ----------------------------
    public static add(p: ECPoint, q: ECPoint): ECPoint {
        // 1) Check for infinity cases
        const isPInfinity = p.x.isZero() && p.y.isZero();
        const isQInfinity = q.x.isZero() && q.y.isZero();

        if (isPInfinity) return q; // ∞ + Q = Q
        if (isQInfinity) return p; // P + ∞ = P

        // 2) Check if P == Q => doubling
        if (p.x == q.x && p.y == q.y) {
            return ECPoint.double(p);
        }

        // 3) Check if P == -Q => return infinity
        // (x1 == x2, but y1 != y2 => P + Q = ∞)
        if (p.x == q.x && p.y != q.y) {
            return new ECPoint(u256.Zero, u256.Zero);
        }

        const numerator = SafeMath.sub(q.y, p.y);
        const denominator = SafeMath.sub(q.x, p.x);
        const denominatorInv = SafeMath.modInverse(denominator, P);
        const lambda = SafeMath.mod(SafeMath.mul(numerator, denominatorInv), P);

        // x3 = λ^2 - (x1 + x2) mod P
        const lambdaSq = SafeMath.pow(lambda, u256.fromU64(2));
        let xr = SafeMath.sub(lambdaSq, SafeMath.add(p.x, q.x));
        xr = SafeMath.mod(xr, P);

        // y3 = λ*(x1 - x3) - y1 mod P
        const xDiff = SafeMath.sub(p.x, xr);
        let yr = SafeMath.mul(lambda, xDiff);
        yr = SafeMath.sub(yr, p.y);
        yr = SafeMath.mod(yr, P);

        return new ECPoint(xr, yr);
    }

    // ----------------------------
    // Scalar Multiplication: k*P
    // Double-and-add approach
    // ----------------------------
    public static scalarMultiply(p: ECPoint, k: u256): ECPoint {
        let result = new ECPoint(u256.Zero, u256.Zero); // ∞
        let addend = p;
        const two = u256.fromU64(2);

        // While k != 0
        while (!k.isZero()) {
            // If k is odd => add
            if (!SafeMath.isEven(k)) {
                result = ECPoint.add(result, addend);
            }
            // Double the point
            addend = ECPoint.double(addend);
            // "Divide" k by 2 => shift right by 1
            k = SafeMath.div(k, two);
        }
        return result;
    }
}

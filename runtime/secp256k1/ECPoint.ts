import { u256 } from '@btc-vision/as-bignum/assembly';
import { SafeMath } from '../types/SafeMath';

// secp256k1 curve parameters (using little-endian byte arrays)
const P_BYTES: u8[] = [
    0x2f, 0xfc, 0xff, 0xff, 0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
]; // P in little-endian

const GX_BYTES: u8[] = [
    0x98, 0x17, 0xf8, 0x16, 0xb1, 0x5b, 0x28, 0xd9, 0x59, 0x28, 0xce, 0x2d, 0xdb, 0xfc, 0x9b, 0x02,
    0x70, 0xb0, 0x87, 0xce, 0x95, 0xa0, 0x62, 0x55, 0xac, 0xbb, 0xdc, 0xf9, 0xef, 0x66, 0xbe, 0x79,
]; // Gx in little-endian

const GY_BYTES: u8[] = [
    0xb8, 0xd4, 0x10, 0xfb, 0xff, 0x08, 0x7d, 0xc4, 0x19, 0x54, 0x85, 0xa6, 0x48, 0x44, 0x17, 0xfd,
    0xa8, 0x08, 0xe1, 0x0e, 0xfc, 0x4b, 0xa4, 0x5d, 0x65, 0xc4, 0xa3, 0xa6, 0x77, 0xda, 0x3a, 0x48,
]; // Gy in little-endian

// Converting byte arrays to u256 using fromBytesLe (little-endian)
const P = u256.fromBytesLE(P_BYTES);
const GX = u256.fromBytesLE(GX_BYTES);
const GY = u256.fromBytesLE(GY_BYTES);

// Define a point on the elliptic curve
class ECPoint {
    x: u256;
    y: u256;

    constructor(x: u256, y: u256) {
        this.x = x;
        this.y = y;
    }

    // Point doubling: P + P = 2P
    static double(p: ECPoint): ECPoint {
        if (p.y == u256.Zero) {
            return new ECPoint(u256.Zero, u256.Zero); // Point at infinity
        }

        const two = u256.fromU64(2);
        const three = u256.fromU64(3);

        // lambda = (3 * p.x^2) / (2 * p.y) mod P
        const numerator = SafeMath.mod(SafeMath.mul(three, SafeMath.pow(p.x, two)), P);
        const denominator = SafeMath.modInverse(SafeMath.mul(two, p.y), P);
        const lambda = SafeMath.mod(SafeMath.mul(numerator, denominator), P);

        // xr = lambda^2 - 2 * p.x mod P
        const xr = SafeMath.mod(SafeMath.sub(SafeMath.pow(lambda, two), SafeMath.mul(two, p.x)), P);

        // yr = lambda * (p.x - xr) - p.y mod P
        const yr = SafeMath.mod(SafeMath.sub(SafeMath.mul(lambda, SafeMath.sub(p.x, xr)), p.y), P);

        return new ECPoint(xr, yr);
    }

    // Point addition: P + Q = R
    static add(p: ECPoint, q: ECPoint): ECPoint {
        if (p.x == q.x && p.y == q.y) {
            return this.double(p); // If P == Q, perform doubling
        }

        const lambda = SafeMath.mod(
            SafeMath.mul(SafeMath.sub(q.y, p.y), SafeMath.modInverse(SafeMath.sub(q.x, p.x), P)),
            P,
        );
        const xr = SafeMath.mod(
            SafeMath.sub(SafeMath.pow(lambda, u256.fromU64(2)), SafeMath.add(p.x, q.x)),
            P,
        );
        const yr = SafeMath.mod(SafeMath.sub(SafeMath.mul(lambda, SafeMath.sub(p.x, xr)), p.y), P);

        return new ECPoint(xr, yr);
    }

    // Scalar multiplication: k * P
    static scalarMultiply(p: ECPoint, k: u256): ECPoint {
        let result = new ECPoint(u256.Zero, u256.Zero); // Point at infinity
        let addend = p;

        while (!k.isZero()) {
            if (!SafeMath.isEven(k)) {
                result = this.add(result, addend);
            }
            addend = this.double(addend);
            k = SafeMath.div(k, u256.fromU64(2)); // Right shift by 1
        }

        return result;
    }
}

// Generate a valid elliptic curve point (public key) from a hash
export function generatePublicKeyFromHash(scalar: u256): u8[] {
    // Convert hash to u256 scalar
    //const scalar = u256.fromBytes(hash);

    // Define the generator point on secp256k1 curve
    const G = new ECPoint(GX, GY);

    // Perform scalar multiplication to get public key point
    const publicKeyPoint = ECPoint.scalarMultiply(G, scalar);

    // Convert the point to bytes (compressed format)
    return pointToBytes(publicKeyPoint);
}

// Convert elliptic curve point to compressed byte array
function pointToBytes(point: ECPoint): u8[] {
    const prefix: u8 = SafeMath.isEven(point.y) ? 0x02 : 0x03; // Compressed format prefix
    const xBytes = point.x.toUint8Array(); // Convert X coordinate to bytes

    const result = new Array<u8>(33); // 1 byte prefix + 32 bytes X coordinate
    result[0] = prefix;
    for (let i = 0; i < 32; i++) {
        result[i + 1] = xBytes[i];
    }

    return result;
}

import { i128, u128, u256 } from '@btc-vision/as-bignum/assembly';

export class i256 {

    @inline static get Zero(): i256 { return new i256(); }
    @inline static get One():  i256 { return new i256(1); }
    @inline static get Min():  i256 { return new i256(0, 0, 0, 0x8000000000000000); }
    @inline static get Max():  i256 { return new i256(-1, -1, -1, 0x7FFFFFFFFFFFFFFF); }

    @inline
    static fromI256(value: i256): i256 {
        return new i256(value.lo1, value.lo2, value.hi1, value.hi2);
    }

    @inline
    static fromU256(value: u256): i256 {
        return new i256(<i64>value.lo1, <i64>value.lo2, <i64>value.hi1, <i64>value.hi2);
    }

    @inline
    static fromI128(value: i128): i256 {
        var signExt = value.hi >> 63;
        return new i256(<i64>value.lo, value.hi, signExt, signExt);
    }

    @inline
    static fromU128(value: u128): i256 {
        return new i256(<i64>value.lo, <i64>value.hi, 0, 0);
    }

    @inline
    static fromI64(value: i64): i256 {
        var signExt = value >> 63;
        return new i256(value, signExt, signExt, signExt);
    }

    @inline
    static fromU64(value: u64): i256 {
        return new i256(<i64>value, 0, 0, 0);
    }

    @inline
    static fromI32(value: i32): i256 {
        var signExt = value >> 31;
        var signExt64 = <i64>signExt;
        return new i256(<i64>value, signExt64, signExt64, signExt64);
    }

    @inline
    static fromU32(value: u32): i256 {
        return new i256(<i64>value, 0, 0, 0);
    }

    @inline
    static fromF64(value: f64): i256 {
        var signExt = reinterpret<i64>(value) >> 63;
        return new i256(<i64>value, signExt, signExt, signExt);
    }

    @inline
    static fromF32(value: f32): i256 {
        var signExt = reinterpret<i32>(value) >> 31;
        var signExt64 = <i64>signExt;
        return new i256(<i64>value, signExt64, signExt64, signExt64);
    }

    @inline
    static fromBits(
        l0: i32, l1: i32, l2: i32, l3: i32,
        h0: i32, h1: i32, h2: i32, h3: i32,
    ): i256 {
        return new i256(
            <i64>l0 | ((<i64>l1) << 32),
            <i64>l2 | ((<i64>l3) << 32),
            <i64>h0 | ((<i64>h1) << 32),
            <i64>h2 | ((<i64>h3) << 32),
        );
    }

    @inline
    static fromBytes<T>(array: T, bigEndian: bool = false): i256 {
        if (array instanceof u8[]) {
            return bigEndian
                ? i256.fromBytesBE(<u8[]>array)
                : i256.fromBytesLE(<u8[]>array);
        } else if (array instanceof Uint8Array) {
            return bigEndian
                ? i256.fromUint8ArrayBE(<Uint8Array>array)
                : i256.fromUint8ArrayLE(<Uint8Array>array);
        } else {
            throw new TypeError("Unsupported generic type");
        }
    }

    @inline
    static fromBytesLE(array: u8[]): i256 {
        assert(array.length && (array.length & 31) == 0);
        var buffer = array.dataStart;
        return new i256(
            load<i64>(buffer, 0 * sizeof<i64>()),
            load<i64>(buffer, 1 * sizeof<i64>()),
            load<i64>(buffer, 2 * sizeof<i64>()),
            load<i64>(buffer, 3 * sizeof<i64>()),
        );
    }

    @inline
    static fromBytesBE(array: u8[]): i256 {
        assert(array.length && (array.length & 31) == 0);
        var buffer = array.dataStart;
        return new i256(
            bswap<i64>(load<i64>(buffer, 3 * sizeof<i64>())),
            bswap<i64>(load<i64>(buffer, 2 * sizeof<i64>())),
            bswap<i64>(load<i64>(buffer, 1 * sizeof<i64>())),
            bswap<i64>(load<i64>(buffer, 0 * sizeof<i64>())),
        );
    }

    @inline
    static fromUint8ArrayLE(array: Uint8Array): i256 {
        assert(array.length && (array.length & 31) == 0);
        var buffer = array.dataStart;
        return new i256(
            load<i64>(buffer, 0 * sizeof<i64>()),
            load<i64>(buffer, 1 * sizeof<i64>()),
            load<i64>(buffer, 2 * sizeof<i64>()),
            load<i64>(buffer, 3 * sizeof<i64>()),
        );
    }

    @inline
    static fromUint8ArrayBE(array: Uint8Array): i256 {
        assert(array.length && (array.length & 31) == 0);
        var buffer = array.dataStart;
        return new i256(
            bswap<i64>(load<i64>(buffer, 3 * sizeof<i64>())),
            bswap<i64>(load<i64>(buffer, 2 * sizeof<i64>())),
            bswap<i64>(load<i64>(buffer, 1 * sizeof<i64>())),
            bswap<i64>(load<i64>(buffer, 0 * sizeof<i64>())),
        );
    }

    @inline
    static from<T>(value: T): i256 {
        if (value instanceof bool) return i256.fromU64(<u64>value);
        else if (value instanceof i8) return i256.fromI64(<i64>value);
        else if (value instanceof u8) return i256.fromU64(<u64>value);
        else if (value instanceof i16) return i256.fromI64(<i64>value);
        else if (value instanceof u16) return i256.fromU64(<u64>value);
        else if (value instanceof i32) return i256.fromI32(<i32>value);
        else if (value instanceof u32) return i256.fromU32(<u32>value);
        else if (value instanceof i64) return i256.fromI64(<i64>value);
        else if (value instanceof u64) return i256.fromU64(<u64>value);
        else if (value instanceof f32) return i256.fromF64(<f64>value);
        else if (value instanceof f64) return i256.fromF64(<f64>value);
        else if (value instanceof i128) return i256.fromI128(<i128>value);
        else if (value instanceof u128) return i256.fromU128(<u128>value);
        else if (value instanceof i256) return i256.fromI256(<i256>value);
        else if (value instanceof u256) return i256.fromU256(<u256>value);
        else if (value instanceof u8[]) return i256.fromBytes(<u8[]>value);
        else if (value instanceof Uint8Array) return i256.fromBytes(<Uint8Array>value);
        else throw new TypeError("Unsupported generic type");
    }

    constructor(
        public lo1: i64 = 0,
        public lo2: i64 = 0,
        public hi1: i64 = 0,
        public hi2: i64 = 0,
    ) {}

    @inline
    set(value: i256): this {
        this.lo1 = value.lo1;
        this.lo2 = value.lo2;
        this.hi1 = value.hi1;
        this.hi2 = value.hi2;
        return this;
    }

    @inline
    isNeg(): bool {
        return <bool>(this.hi2 >>> 63);
    }

    @inline
    isZero(): bool {
        return !(this.lo1 | this.lo2 | this.hi1 | this.hi2);
    }

    @inline @operator.prefix('!')
    static isEmpty(value: i256): bool {
        return value.isZero();
    }

    @operator.prefix('~')
    not(): i256 {
        return new i256(~this.lo1, ~this.lo2, ~this.hi1, ~this.hi2);
    }

    @operator.prefix('+')
    pos(): i256 {
        return this;
    }

    @operator.prefix('-')
    neg(): i256 {
        var lo1 = ~this.lo1;
        var lo2 = ~this.lo2;
        var hi1 = ~this.hi1;
        var hi2 = ~this.hi2;

        var lo1p = lo1 + 1;
        var carry = lo1p == 0 ? 1 : 0;

        var lo2p = lo2 + carry;
        carry = (lo2p == 0 && carry == 1) ? 1 : 0;

        var hi1p = hi1 + carry;
        carry = (hi1p == 0 && carry == 1) ? 1 : 0;

        var hi2p = hi2 + carry;

        return new i256(lo1p, lo2p, hi1p, hi2p);
    }

    @operator('+')
    static add(a: i256, b: i256): i256 {
        var lo1 = a.lo1 + b.lo1;
        var carry = lo1 < a.lo1 ? 1 : 0;

        var lo2 = a.lo2 + b.lo2 + carry;
        carry = (lo2 < a.lo2 || (carry == 1 && lo2 == a.lo2)) ? 1 : 0;

        var hi1 = a.hi1 + b.hi1 + carry;
        carry = (hi1 < a.hi1 || (carry == 1 && hi1 == a.hi1)) ? 1 : 0;

        var hi2 = a.hi2 + b.hi2 + carry;

        return new i256(lo1, lo2, hi1, hi2);
    }

    @operator('-')
    static sub(a: i256, b: i256): i256 {
        var lo1 = a.lo1 - b.lo1;
        var borrow = a.lo1 < b.lo1 ? 1 : 0;

        var lo2 = a.lo2 - b.lo2 - borrow;
        borrow = a.lo2 < b.lo2 + borrow ? 1 : 0;

        var hi1 = a.hi1 - b.hi1 - borrow;
        borrow = hi1 < b.hi1 + borrow ? 1 : 0;

        var hi2 = a.hi2 - b.hi2 - borrow;

        return new i256(lo1, lo2, hi1, hi2);
    }

    @inline @operator('|')
    static or(a: i256, b: i256): i256 {
        return new i256(a.lo1 | b.lo1, a.lo2 | b.lo2, a.hi1 | b.hi1, a.hi2 | b.hi2);
    }

    @inline @operator('^')
    static xor(a: i256, b: i256): i256 {
        return new i256(a.lo1 ^ b.lo1, a.lo2 ^ b.lo2, a.hi1 ^ b.hi1, a.hi2 ^ b.hi2);
    }

    @inline @operator('&')
    static and(a: i256, b: i256): i256 {
        return new i256(a.lo1 & b.lo1, a.lo2 & b.lo2, a.hi1 & b.hi1, a.hi2 & b.hi2);
    }

    @operator('<')
    static lt(a: i256, b: i256): bool {
        if (a.hi2 == b.hi2) {
            if (a.hi1 == b.hi1) {
                if (a.lo2 == b.lo2) {
                    return a.lo1 < b.lo1;
                } else {
                    return a.lo2 < b.lo2;
                }
            } else {
                return a.hi1 < b.hi1;
            }
        } else {
            return a.hi2 < b.hi2;
        }
    }

    @inline @operator('>')
    static gt(a: i256, b: i256): bool {
        return b < a;
    }

    @inline @operator('==')
    static eq(a: i256, b: i256): bool {
        return a.lo1 == b.lo1 && a.lo2 == b.lo2 && a.hi1 == b.hi1 && a.hi2 == b.hi2;
    }

    @inline @operator('!=')
    static ne(a: i256, b: i256): bool {
        return !i256.eq(a, b);
    }

    @inline @operator('<=')
    static le(a: i256, b: i256): bool {
        return !i256.gt(a, b);
    }

    @inline @operator('>=')
    static ge(a: i256, b: i256): bool {
        return !i256.lt(a, b);
    }

    @operator('<<')
    static shl(value: i256, shift: i32): i256 {
        shift &= 255;
        if (shift == 0) return value;
        if (shift >= 256) return new i256();
        var lo1 = value.lo1;
        var lo2 = value.lo2;
        var hi1 = value.hi1;
        var hi2 = value.hi2;
        if (shift >= 192) {
            let s = shift - 192;
            return new i256(0, 0, 0, lo1 << s);
        } else if (shift >= 128) {
            let s = shift - 128;
            return new i256(0, 0, lo1 << s, (lo2 << s) | (lo1 >>> (64 - s)));
        } else if (shift >= 64) {
            let s = shift - 64;
            return new i256(0, (lo1 << s), (lo2 << s) | (lo1 >>> (64 - s)), (hi1 << s) | (lo2 >>> (64 - s)));
        } else {
            let s = shift;
            return new i256(
                lo1 << s,
                (lo2 << s) | (lo1 >>> (64 - s)),
                (hi1 << s) | (lo2 >>> (64 - s)),
                (hi2 << s) | (hi1 >>> (64 - s)),
            );
        }
    }

    @operator('>>')
    static shr(value: i256, shift: i32): i256 {
        shift &= 255;
        if (shift == 0) return value;
        if (shift >= 256) {
            let sign = value.isNeg() ? -1 : 0;
            return new i256(sign, sign, sign, sign);
        }
        var lo1 = value.lo1;
        var lo2 = value.lo2;
        var hi1 = value.hi1;
        var hi2 = value.hi2;
        if (shift >= 192) {
            let s = shift - 192;
            let sign = value.isNeg() ? -1 : 0;
            return new i256((hi2 >> s) | (sign << (64 - s)), sign, sign, sign);
        } else if (shift >= 128) {
            let s = shift - 128;
            return new i256((hi1 >> s) | (hi2 << (64 - s)), (hi2 >> s) | (hi2 >> 63) << (64 - s), hi2 >> 63, hi2 >> 63);
        } else if (shift >= 64) {
            let s = shift - 64;
            return new i256(
                (lo2 >> s) | (hi1 << (64 - s)),
                (hi1 >> s) | (hi2 << (64 - s)),
                (hi2 >> s) | (hi2 >> 63) << (64 - s),
                hi2 >> 63,
            );
        } else {
            let s = shift;
            return new i256(
                (lo1 >> s) | (lo2 << (64 - s)),
                (lo2 >> s) | (hi1 << (64 - s)),
                (hi1 >> s) | (hi2 << (64 - s)),
                (hi2 >> s) | (hi2 >> 63) << (64 - s),
            );
        }
    }

    @operator('>>>')
    static shr_u(value: i256, shift: i32): i256 {
        shift &= 255;
        if (shift == 0) return value;
        if (shift >= 256) return new i256();
        var lo1 = value.lo1;
        var lo2 = value.lo2;
        var hi1 = value.hi1;
        var hi2 = value.hi2;
        if (shift >= 192) {
            let s = shift - 192;
            return new i256((hi2 >>> s), 0, 0, 0);
        } else if (shift >= 128) {
            let s = shift - 128;
            return new i256((hi1 >>> s) | (hi2 << (64 - s)), (hi2 >>> s), 0, 0);
        } else if (shift >= 64) {
            let s = shift - 64;
            return new i256(
                (lo2 >>> s) | (hi1 << (64 - s)),
                (hi1 >>> s) | (hi2 << (64 - s)),
                (hi2 >>> s),
                0,
            );
        } else {
            let s = shift;
            return new i256(
                (lo1 >>> s) | (lo2 << (64 - s)),
                (lo2 >>> s) | (hi1 << (64 - s)),
                (hi1 >>> s) | (hi2 << (64 - s)),
                hi2 >>> s,
            );
        }
    }

    clone(): i256 {
        return new i256(this.lo1, this.lo2, this.hi1, this.hi2);
    }

    // Helper methods to write the internal representation to a buffer
    @inline
    private toArrayBufferLE(buffer: usize): void {
        store<i64>(buffer, this.lo1, 0 * sizeof<i64>());
        store<i64>(buffer, this.lo2, 1 * sizeof<i64>());
        store<i64>(buffer, this.hi1, 2 * sizeof<i64>());
        store<i64>(buffer, this.hi2, 3 * sizeof<i64>());
    }

    @inline
    private toArrayBufferBE(buffer: usize): void {
        store<i64>(buffer, bswap<i64>(this.hi2), 0 * sizeof<i64>());
        store<i64>(buffer, bswap<i64>(this.hi1), 1 * sizeof<i64>());
        store<i64>(buffer, bswap<i64>(this.lo2), 2 * sizeof<i64>());
        store<i64>(buffer, bswap<i64>(this.lo1), 3 * sizeof<i64>());
    }

    @inline
    private toArrayBuffer(buffer: usize, bigEndian: bool = false): void {
        if (bigEndian) {
            this.toArrayBufferBE(buffer);
        } else {
            this.toArrayBufferLE(buffer);
        }
    }

    /**
     * Convert to Uint8Array
     * @param bigEndian Little or Big Endian? Default: false
     * @returns Uint8Array
     */
    @inline
    toUint8Array(bigEndian: bool = false): Uint8Array {
        var result = new Uint8Array(32);
        this.toArrayBuffer(result.dataStart, bigEndian);
        return result;
    }

    /**
     * Convert to byte array
     * @param bigEndian Little or Big Endian? Default: false
     * @returns Array of bytes
     */
    @inline
    toBytes(bigEndian: bool = false): u8[] {
        var result = new Array<u8>(32);
        this.toArrayBuffer(result.dataStart, bigEndian);
        return result;
    }

    /**
     * Convert to StaticArray of bytes
     * @param bigEndian Little or Big Endian? Default: false
     * @returns StaticArray<u8>
     */
    @inline
    toStaticBytes(bigEndian: bool = false): StaticArray<u8> {
        var result = new StaticArray<u8>(32);
        this.toArrayBuffer(changetype<usize>(result), bigEndian);
        return result;
    }

    // Other conversion methods can be added as needed, following similar patterns.

    /**
     * Generic type conversion
     */
    @inline
    as<T>(): T {
        var dummy!: T;
        if (dummy instanceof bool) return <T>this.toBool();
        else if (dummy instanceof i8) return <T>this.toI64();
        else if (dummy instanceof u8) return <T>this.toU64();
        else if (dummy instanceof i16) return <T>this.toI64();
        else if (dummy instanceof u16) return <T>this.toU64();
        else if (dummy instanceof i32) return <T>this.toI64();
        else if (dummy instanceof u32) return <T>this.toU64();
        else if (dummy instanceof i64) return <T>this.toI64();
        else if (dummy instanceof u64) return <T>this.toU64();
        else if (dummy instanceof i128) return <T>this.toI128();
        else if (dummy instanceof u128) return <T>this.toU128();
        else if (dummy instanceof i256) return <T>this;
        else if (dummy instanceof u256) return <T>this.toU256();
        else if (dummy instanceof u8[]) return <T>this.toBytes();
        else if (dummy instanceof Uint8Array) return <T>this.toUint8Array();
        else if (dummy instanceof StaticArray<u8>) return <T>this.toStaticBytes();
        else if (dummy instanceof String) return <T>this.toString();
        else throw new TypeError('Unsupported generic type');
    }

    @inline
    toBool(): bool {
        return this.lo1 != 0 || this.lo2 != 0 || this.hi1 != 0 || this.hi2 != 0;
    }

    @inline
    toI64(): i64 {
        return this.lo1;
    }

    @inline
    toU64(): u64 {
        return <u64>this.lo1;
    }

    @inline
    toI32(): i32 {
        return <i32>this.lo1;
    }

    @inline
    toU32(): u32 {
        return <u32>this.lo1;
    }

    @inline
    toI128(): i128 {
        return new i128(<u64>this.lo1, this.lo2);
    }

    @inline
    toU128(): u128 {
        return new u128(<u64>this.lo1, <u64>this.lo2);
    }

    @inline
    toU256(): u256 {
        return new u256(<u64>this.lo1, <u64>this.lo2, <u64>this.hi1, <u64>this.hi2);
    }

    @inline
    public toString(radix: i32 = 10): string {
        assert(radix == 10 || radix == 16, 'radix argument must be 10 or 16');
        if (this.isZero()) return '0';

        const isNegative = this.isNeg();
        const value = isNegative ? this.neg() : this.clone();
        let result = '';

        if (radix == 16) {
            const HEX_CHARS = '0123456789abcdef';
            let shift: i32 = 252 - (i256.clz(value) & ~3);
            let started = false;
            while (shift >= 0) {
                let digit = (<u8>((value.shr_u(shift)).lo1 & 0xF));
                if (digit != 0 || started) {
                    // @ts-ignore
                    result += HEX_CHARS.charAt(digit);
                    started = true;
                }
                shift -= 4;
            }
            if (isNegative) {
                result = '-' + result;
            }
            return result;
        } else {
            // Radix 10 conversion requires division, which needs to be implemented.
            // Placeholder implementation (throws an error).
            throw new Error('Radix 10 conversion is not implemented yet.');
        }
    }

    shr_u(value: i32): i256 {
        return i256.shr_u(this, value);
    }

    @inline
    static clz(value: i256): i32 {
        // For signed integers, leading zeros are counted from the sign bit.
        // If the value is negative, we take its two's complement to get the magnitude.
        if (value.isNeg()) {
            value = value.neg();
        }
        if (value.hi2 != 0) {
            return clz<u64>(value.hi2);
        } else if (value.hi1 != 0) {
            return clz<u64>(value.hi1) + 64;
        } else if (value.lo2 != 0) {
            return clz<u64>(value.lo2) + 128;
        } else {
            return clz<u64>(value.lo1) + 192;
        }
    }

}

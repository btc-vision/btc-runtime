import { i128, u128 } from '@btc-vision/as-bignum/assembly';
import { __carry, __uadd64, __umulh64 } from 'as-bignum/assembly/globals';

@lazy const HEX_CHARS = '0123456789abcdef';


/**
 * Multiplies two 160-bit unsigned integers and returns the lower 160 bits.
 * @param a_lo1 Lower 64 bits of the first operand.
 * @param a_lo2 Middle 64 bits of the first operand.
 * @param a_hi Upper 32 bits of the first operand.
 * @param b_lo1 Lower 64 bits of the second operand.
 * @param b_lo2 Middle 64 bits of the second operand.
 * @param b_hi Upper 32 bits of the second operand.
 * @returns The lower 160 bits of the product as a u160 instance.
 */
@global
export function __mul160(
    a_lo1: u64,
    a_lo2: u64,
    a_hi: u32,
    b_lo1: u64,
    b_lo2: u64,
    b_hi: u32
): u160 {
    // Step 1: Multiply lower parts
    let c0 = a_lo1 * b_lo1;
    let c0_hi = __umulh64(a_lo1, b_lo1);

    // Step 2: Multiply cross terms
    let c1 = a_lo1 * b_lo2;
    let c2 = a_lo2 * b_lo1;

    // Step 3: Add cross terms and carry
    let lo2 = __uadd64(c1, c2);
    let carry1 = __carry;

    lo2 = __uadd64(lo2, c0_hi);
    let carry2 = __carry;

    // Step 4: Multiply high parts
    let c3 = a_lo1 * <u64>b_hi;
    let c4 = <u64>a_hi * b_lo1;

    // Step 5: Add high parts and carry
    let hi = <u32>(c3 + c4 + carry1 + carry2);

    return new u160(c0, lo2, hi);
}

/**
 * Performs division and modulus on two 160-bit unsigned integers.
 * @param dividend The dividend as a u160 instance.
 * @param divisor The divisor as a u160 instance.
 * @returns An object containing the quotient and remainder as u160 instances.
 */
@global
export function __udivmod160(dividend: u160, divisor: u160): { quotient: u160, remainder: u160 } {
    if (divisor.isZero()) {
        throw new RangeError("Division by zero");
    }

    if (dividend.lt(divisor)) {
        return { quotient: u160.Zero, remainder: dividend };
    }

    if (divisor.isZero()) {
        throw new RangeError("Division by zero");
    }

    let quotient = u160.Zero;
    let remainder = u160.Zero;
    let temp = dividend.clone();

    // Determine the number of bits in dividend and divisor
    let dividend_bits = 160 - __clz160(temp.lo1, temp.lo2, temp.hi);
    let divisor_bits = 160 - __clz160(divisor.lo1, divisor.lo2, divisor.hi);

    let shift = dividend_bits - divisor_bits;

    // Align divisor with dividend
    let shifted_divisor = divisor << shift;

    for (let i = shift; i >= 0; i--) {
        if (temp >= shifted_divisor) {
            temp = temp - shifted_divisor;
            quotient = quotient | (u160.One << i);
        }
        shifted_divisor = shifted_divisor >> 1;
    }

    remainder = temp;

    return { quotient, remainder };
}

/**
 * Counts the leading zeros in a 160-bit unsigned integer.
 * @param lo1 Lower 64 bits.
 * @param lo2 Middle 64 bits.
 * @param hi Upper 32 bits.
 * @returns The number of leading zeros.
 */
@inline
export function __clz160(lo1: u64, lo2: u64, hi: u32): i32 {
    if (hi != 0) {
        return clz(<u64>hi) - 32;
    } else if (lo2 != 0) {
        return 32 + clz(lo2);
    } else {
        return 96 + clz(lo1);
    }
}

/**
 * Counts the trailing zeros in a 160-bit unsigned integer.
 * @param lo1 Lower 64 bits.
 * @param lo2 Middle 64 bits.
 * @param hi Upper 32 bits.
 * @returns The number of trailing zeros.
 */
@inline
export function __ctz160(lo1: u64, lo2: u64, hi: u32): i32 {
    if (lo1 != 0) {
        return ctz(lo1);
    } else if (lo2 != 0) {
        return 64 + ctz(lo2);
    } else {
        return 128 + ctz(<u32>hi);
    }
}

/**
 * Converts a 160-bit unsigned integer to its decimal string representation.
 * @param value The u160 instance to convert.
 * @returns The decimal string representation of the u160 instance.
 */
@inline
export function u160toDecimalString(value: u160): string {
    if (value.isZero()) return "0";

    let result = "";
    let temp = value.clone();

    while (!temp.isZero()) {
        let { quotient, remainder } = __udivmod160(temp, u160.fromU64(10));
        let digit = <u8>remainder.lo1; // Assuming remainder < 10
        result = digit.toString() + result;
        temp = quotient;
    }

    return result;
}

export class u160 {

    @inline static get Zero(): u160 { return new u160(); }
    @inline static get One():  u160 { return new u160(1, 0, 0); }
    @inline static get Min():  u160 { return new u160(); }
    @inline static get Max():  u160 { return new u160(<u64>0xFFFFFFFFFFFFFFFF, <u64>0xFFFFFFFFFFFFFFFF, <u32>0xFFFFFFFF); }

    // TODO: fromString

    @inline
    static fromU160(value: u160): u160 {
        return new u160(value.lo1, value.lo2, value.hi);
    }

    @inline
    static fromU128(value: u128): u160 {
        return new u160(value.lo, value.hi, 0);
    }

    @inline
    static fromU64(value: u64): u160 {
        return new u160(value, 0, 0);
    }

    @inline
    static fromI64(value: i64): u160 {
        let mask = <u64>(value >> 63);
        return new u160(<u64>value, mask, <u32>mask);
    }

    @inline
    static fromU32(value: u32): u160 {
        return new u160(<u64>value, 0, 0);
    }

    @inline
    static fromI32(value: i32): u160 {
        let mask = <u64>(value >> 31);
        return new u160(<u64>value, mask, <u32>mask);
    }

    @inline
    static fromBits(
        lo1: u64, lo2: u64, hi: u32
    ): u160 {
        return new u160(lo1, lo2, hi);
    }

    @inline
    static fromBytes<T>(array: T, bigEndian: bool = false): u160 {
        if (array instanceof u8[]) {
            return bigEndian
                ? u160.fromBytesBE(<u8[]>array)
                : u160.fromBytesLE(<u8[]>array);
        } else if (array instanceof Uint8Array) {
            return bigEndian
                ? u160.fromUint8ArrayBE(<Uint8Array>array)
                : u160.fromUint8ArrayLE(<Uint8Array>array);
        } else {
            throw new TypeError("Unsupported generic type");
        }
    }

    @inline
    static fromBytesLE(array: u8[]): u160 {
        assert(array.length == 20, "Invalid byte array length for u160");
        let lo1 = load<u64>(changetype<usize>(array) + 0);
        let lo2 = load<u64>(changetype<usize>(array) + 8);
        let hi = load<u32>(changetype<usize>(array) + 16);
        return new u160(lo1, lo2, hi);
    }

    @inline
    static fromBytesBE(array: u8[]): u160 {
        assert(array.length == 20, "Invalid byte array length for u160");
        let lo1 = bswap(load<u64>(changetype<usize>(array) + 12));
        let lo2 = bswap(load<u64>(changetype<usize>(array) + 4));
        let hi = bswap(load<u32>(changetype<usize>(array) + 0));
        return new u160(lo1, lo2, hi);
    }

    @inline
    static fromUint8ArrayLE(array: Uint8Array): u160 {
        assert(array.length == 20, "Invalid Uint8Array length for u160");
        let lo1 = load<u64>(array.dataStart + 0);
        let lo2 = load<u64>(array.dataStart + 8);
        let hi = load<u32>(array.dataStart + 16);
        return new u160(lo1, lo2, hi);
    }

    @inline
    static fromUint8ArrayBE(array: Uint8Array): u160 {
        assert(array.length == 20, "Invalid Uint8Array length for u160");
        let lo1 = bswap(load<u64>(array.dataStart + 12));
        let lo2 = bswap(load<u64>(array.dataStart + 4));
        let hi = bswap(load<u32>(array.dataStart + 0));
        return new u160(lo1, lo2, hi);
    }

    @operator('<<')
    static shl(a: u160, shift: u32): u160 {
        shift &= 159;
        if (shift == 0) return a;

        let lo1 = a.lo1;
        let lo2 = a.lo2;
        let hi = a.hi;

        if (shift < 64) {
            lo2 = (lo2 << shift) | (lo1 >> (64 - shift));
            hi = (hi << shift) | (<u32>(lo2 >> (64 - shift)));
            lo1 = lo1 << shift;
        } else if (shift < 128) {
            lo1 = 0;
            lo2 = a.lo1 << (shift - 64);
            hi = (a.lo2 << (shift - 64)) | (<u32>(a.hi << (shift - 64)));
        } else {
            lo1 = 0;
            lo2 = 0;
            hi = a.lo1 << (shift - 128);
        }

        return new u160(lo1, lo2, hi);
    }

    // TODO: Improve conversion from floating points
    @inline
    static fromF64(value: f64): u160 {
        let mask = <u64>(reinterpret<i64>(value) >> 63);
        return new u160(<u64>value, mask, <u32>mask);
    }

    @inline
    static fromF32(value: f32): u160 {
        let mask = <u64>(reinterpret<i32>(value) >> 31);
        return new u160(<u64>value, mask, <u32>mask);
    }

    /**
     * Create 160-bit unsigned integer from generic type T
     * @param  value
     * @returns 160-bit unsigned integer
     */
    @inline
    static from<T>(value: T): u160 {
        if (value instanceof bool) return u160.fromU64(<u64>value);
        else if (value instanceof i8) return u160.fromI64(<i64>value);
        else if (value instanceof u8) return u160.fromU64(<u64>value);
        else if (value instanceof i16) return u160.fromI64(<i64>value);
        else if (value instanceof u16) return u160.fromU64(<u64>value);
        else if (value instanceof i32) return u160.fromI32(<i32>value);
        else if (value instanceof u32) return u160.fromU32(<u32>value);
        else if (value instanceof i64) return u160.fromI64(<i64>value);
        else if (value instanceof u64) return u160.fromU64(<u64>value);
        else if (value instanceof f32) return u160.fromF32(<f32>value);
        else if (value instanceof f64) return u160.fromF64(<f64>value);
        else if (value instanceof u128) return u160.fromU128(<u128>value);
        else if (value instanceof u160) return u160.fromU160(<u160>value);
        else if (value instanceof u8[]) return u160.fromBytes(<u8[]>value);
        else if (value instanceof Uint8Array) return u160.fromBytes(<Uint8Array>value);
        else throw new TypeError("Unsupported generic type");
    }

    // TODO
    // static fromString(str: string): u160

    constructor(
        public lo1: u64 = 0,
        public lo2: u64 = 0,
        public hi: u32 = 0,
    ) {}

    @inline
    set(value: u160): this {
        this.lo1 = value.lo1;
        this.lo2 = value.lo2;
        this.hi = value.hi;
        return this;
    }

    @inline
    setU128(value: u128): this {
        this.lo1 = value.lo;
        this.lo2 = value.hi;
        this.hi = 0;
        return this;
    }

    @inline
    setI64(value: i64): this {
        let mask: u64 = <u64>(value >> 63);
        this.lo1 = <u64>value;
        this.lo2 = mask;
        this.hi = <u32>mask;
        return this;
    }

    @inline
    setU64(value: u64): this {
        this.lo1 = value;
        this.lo2 = 0;
        this.hi = 0;
        return this;
    }

    @inline
    setI32(value: i32): this {
        let mask: u64 = <u64>(value >> 31);
        this.lo1 = <u64>value;
        this.lo2 = mask;
        this.hi = <u32>mask;
        return this;
    }

    @inline
    setU32(value: u32): this {
        this.lo1 = <u64>value;
        this.lo2 = 0;
        this.hi = 0;
        return this;
    }

    @inline
    isZero(): bool {
        return !(this.lo1 | this.lo2 | this.hi);
    }

    @inline @operator.prefix('!')
    static isEmpty(value: u160): bool {
        return value.isZero();
    }

    @inline @operator.prefix('~')
    not(): u160 {
        return new u160(~this.lo1, ~this.lo2, ~this.hi);
    }

    @inline @operator.prefix('+')
    pos(): u160 {
        return this;
    }

    @operator.prefix('-')
    neg(): u160 {
        let lo1 = ~this.lo1;
        let lo2 = ~this.lo2;
        let hi = ~this.hi;

        let lo1p = lo1 + 1;
        let carry1 = lo1p < lo1 ? 1 : 0;

        let lo2p = this.lo2 == 0xFFFFFFFFFFFFFFFF ? 0 : this.lo2 + carry1;
        let carry2 = (lo2p < this.lo2) ? 1 : 0;

        let hi_p = this.hi + carry2;

        return new u160(lo1p, lo2p, hi_p);
    }

    @operator.prefix('++')
    preInc(): this {
        let lo1p = this.lo1 + 1;
        let carry1 = lo1p < this.lo1 ? 1 : 0;

        let lo2p = this.lo2 + carry1;
        let carry2 = lo2p < this.lo2 ? 1 : 0;

        let hi_p = this.hi + <u32>carry2;

        this.lo1 = lo1p;
        this.lo2 = lo2p;
        this.hi = hi_p;

        return this;
    }

    @operator.prefix('--')
    preDec(): this {
        let lo1p = this.lo1 - 1;
        let borrow1 = this.lo1 == 0 ? 1 : 0;

        let lo2p = this.lo2 - <u64>borrow1;
        let borrow2 = this.lo2 < <u64>borrow1 ? 1 : 0;

        let hi_p = this.hi - <u32>borrow2;

        this.lo1 = lo1p;
        this.lo2 = lo2p;
        this.hi = hi_p;

        return this;
    }

    @inline @operator.postfix('++')
    postInc(): u160 {
        let original = this.clone();
        this.preInc();
        return original;
    }

    @inline @operator.postfix('--')
    postDec(): u160 {
        let original = this.clone();
        this.preDec();
        return original;
    }

    @operator('+')
    static add(a: u160, b: u160): u160 {
        let lo1 = a.lo1 + b.lo1;
        let carry1 = lo1 < a.lo1 ? 1 : 0;

        let lo2 = a.lo2 + b.lo2 + <u64>carry1;
        let carry2 = lo2 < a.lo2 || (carry1 == 1 && lo2 == a.lo2) ? 1 : 0;

        let hi = a.hi + b.hi + <u32>carry2;
        return new u160(lo1, lo2, hi);
    }

    @operator('-')
    static sub(a: u160, b: u160): u160 {
        let lo1 = a.lo1 - b.lo1;
        let borrow1 = a.lo1 < b.lo1 ? 1 : 0;

        let lo2 = a.lo2 - b.lo2 - <u64>borrow1;
        let borrow2 = a.lo2 < b.lo2 + <u64>borrow1 ? 1 : 0;

        let hi = a.hi - b.hi - <u32>borrow2;
        return new u160(lo1, lo2, hi);
    }

    @inline @operator('|')
    static or(a: u160, b: u160): u160 {
        return new u160(a.lo1 | b.lo1, a.lo2 | b.lo2, a.hi | b.hi);
    }

    @inline @operator('^')
    static xor(a: u160, b: u160): u160 {
        return new u160(a.lo1 ^ b.lo1, a.lo2 ^ b.lo2, a.hi ^ b.hi);
    }

    @inline @operator('&')
    static and(a: u160, b: u160): u160 {
        return new u160(a.lo1 & b.lo1, a.lo2 & b.lo2, a.hi & b.hi);
    }

    @operator('>>')
    static shr(value: u160, shift: i32): u160 {
        shift &= 159;
        if (shift == 0) return value;

        let off = <u64>shift;
        if (shift < 64) {
            let lo1 = value.lo1 >> off;
            let lo2 = (value.lo2 >> off) | (value.lo1 << (64 - off));
            let hi = (value.hi >> off) | (<u32>((value.lo2 << (32 - off)) & 0xFFFFFFFF)) as u32;
            return new u160(lo1, lo2, hi);
        } else if (shift < 128) {
            let lo1 = 0;
            let lo2 = value.lo1 >> (shift - 64);
            let hi = (value.lo2 >> (shift - 64)) | (<u32>(value.hi << (64 - (shift - 64))) & 0xFFFFFFFF);
            return new u160(lo1, lo2, hi);
        } else {
            let lo1 = 0;
            let lo2 = 0;
            let hi = value.lo1 >> (shift - 128);
            return new u160(lo1, lo2, hi as u32);
        }
    }

    @inline @operator('>>>')
    static shr_u(value: u160, shift: i32): u160 {
        return u160.shr(value, shift);
    }

    @inline @operator('==')
    static eq(a: u160, b: u160): bool {
        return (
            a.lo1 == b.lo1 &&
            a.lo2 == b.lo2 &&
            a.hi == b.hi
        );
    }

    @inline @operator('!=')
    static ne(a: u160, b: u160): bool {
        return !u160.eq(a, b);
    }

    @operator('<')
    static lt(a: u160, b: u160): bool {
        if (a.hi == b.hi) {
            if (a.lo2 == b.lo2) {
                return a.lo1 < b.lo1;
            }
            return a.lo2 < b.lo2;
        }
        return a.hi < b.hi;
    }

    @inline @operator('>')
    static gt(a: u160, b: u160): bool {
        return u160.lt(b, a);
    }

    @inline @operator('<=')
    static le(a: u160, b: u160): bool {
        return !u160.gt(a, b);
    }

    @inline @operator('>=')
    static ge(a: u160, b: u160): bool {
        return !u160.lt(a, b);
    }

    // mul: u160 x u160 = u160
    @inline @operator('*')
    static mul(a: u160, b: u160): u160 {
        return __mul160(a.lo1, a.lo2, a.hi, b.lo1, b.lo2, b.hi);
    }

    @inline
    static popcnt(value: u160): i32 {
        let count = popcnt(value.lo1) + popcnt(value.lo2) + popcnt(value.hi);
        return <i32>count;
    }

    @inline
    static clz(value: u160): i32 {
        if (value.hi) return <i32>(clz(value.hi) + 0);
        if (value.lo2) return <i32>(clz(value.lo2) + 32);
        if (value.lo1) return <i32>(clz(value.lo1) + 96);
        return <i32>(clz(0) + 160); // All bits are zero
    }

    @inline
    static ctz(value: u160): i32 {
        if (value.lo1) return <i32>(ctz(value.lo1) + 0);
        if (value.lo2) return <i32>(ctz(value.lo2) + 64);
        if (value.hi) return <i32>(ctz(value.hi) + 128);
        return <i32>(ctz(0) + 160); // All bits are zero
    }

    /**
     * Convert to 128-bit signed integer
     * @return 160-bit signed integer
     */
    @inline
    toI128(): i128 {
        return new i128(
            this.lo1,
            this.lo2,
        );
    }

    /**
     * Convert to 128-bit unsigned integer
     * @return 128-bit unsigned integer
     */
    @inline
    toU128(): u128 {
        return new u128(this.lo1, this.lo2);
    }

    /**
     * Convert to 160-bit unsigned integer
     * @returns 160-bit unsigned integer
     */
    @inline
    toU160(): this {
        return this;
    }

    /**
     * Convert to 64-bit signed integer
     * @return 64-bit signed integer
     */
    @inline
    toI64(): i64 {
        return <i64>(this.lo1 | (<u64>this.hi << 64));
    }

    /**
     * Convert to 64-bit unsigned integer
     * @return 64-bit unsigned integer
     */
    @inline
    toU64(): u64 {
        return this.lo1;
    }

    /**
     * Convert to 32-bit signed integer
     * @return 32-bit signed integer
     */
    @inline
    toI32(): i32 {
        return <i32>this.lo1;
    }

    /**
     * Convert to 32-bit unsigned integer
     * @return 32-bit unsigned integer
     */
    @inline
    toU32(): u32 {
        return this.hi;
    }

    /**
     * Convert to 1-bit boolean
     * @return 1-bit boolean
     */
    @inline
    toBool(): bool {
        return <bool>(this.lo1 | this.lo2 | this.hi);
    }

    @inline
    private toArrayBufferLE(buffer: usize): void {
        store<u64>(buffer, this.lo1, 0 * sizeof<u64>());
        store<u64>(buffer, this.lo2, 1 * sizeof<u64>());
        store<u32>(buffer, this.hi, 2 * sizeof<u64>());
    }

    @inline
    private toArrayBufferBE(buffer: usize): void {
        store<u32>(buffer, bswap(this.hi), 0 * sizeof<u64>());
        store<u64>(buffer, bswap(this.lo2), 1 * sizeof<u64>());
        store<u64>(buffer, bswap(this.lo1), 3 * sizeof<u64>());
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
     * Convert to generic type `T`. Useful inside other generics methods
     * @param  T  is <bool | i8 | u8 | i16 | u16 | i32 | u32 | i64 | u64 | f32 | f64 | i128 | u128 | u160 | u8[] | Uint8Array | `StaticArray<u8>` | string>
     * @returns   type of `T`
     */
    @inline
    as<T>(): T {
        let dummy!: T;
        if (dummy instanceof bool) return <T>this.toBool();
        else if (dummy instanceof i8) return <T>this.toI64();
        else if (dummy instanceof u8) return <T>this.toU64();
        else if (dummy instanceof i16) return <T>this.toI64();
        else if (dummy instanceof u16) return <T>this.toU64();
        else if (dummy instanceof i32) return <T>this.toI32();
        else if (dummy instanceof u32) return <T>this.toU32();
        else if (dummy instanceof i64) return <T>this.toI64();
        else if (dummy instanceof u64) return <T>this.toU64();
        else if (dummy instanceof i128) return <T>this.toI128();
        else if (dummy instanceof u128) return <T>this.toU128();
        else if (dummy instanceof u160) return <T>this.toU160();
        else if (dummy instanceof u8[]) return <T>this.toBytes();
        else if (dummy instanceof Uint8Array) return <T>this.toUint8Array();
        else if (dummy instanceof StaticArray<u8>) return <T>this.toStaticBytes();
        else if (dummy instanceof String) return <T>this.toString();
        else throw new TypeError('Unsupported generic type');
    }

    /**
     * Convert to byte array
     * @param bigEndian Little or Big Endian? Default: false
     * @returns  Array of bytes
     */
    @inline
    toBytes(bigEndian: bool = false): u8[] {
        let result = new Array<u8>(20);
        this.toArrayBuffer(result.dataStart, bigEndian);
        return result;
    }

    /**
     * Convert to byte static array
     * @param bigEndian Little or Big Endian? Default: false
     * @returns  StaticArray of bytes
     */
    @inline
    toStaticBytes(bigEndian: bool = false): StaticArray<u8> {
        let result = new StaticArray<u8>(20);
        this.toArrayBuffer(changetype<usize>(result), bigEndian);
        return result;
    }

    /**
     * Convert to Uint8Array
     * @param bigEndian Little or Big Endian? Default: false
     * @returns  Uint8Array
     */
    @inline
    toUint8Array(bigEndian: bool = false): Uint8Array {
        let result = new Uint8Array(20);
        this.toArrayBuffer(result.dataStart, bigEndian);
        return result;
    }

    clone(): u160 {
        return new u160(this.lo1, this.lo2, this.hi);
    }

    toString(radix: i32 = 10): string {
        assert(radix == 10 || radix == 16, 'radix argument must be either 10 or 16');
        if (this.isZero()) return '0';

        let result = '';
        if (radix == 16) {
            let shift: i32 = 156 - (u160.clz(this) & ~3);
            while (shift >= 0) {
                let nibble = (<u32>((this >> shift).lo1) & 0xF);
                result += HEX_CHARS.charAt(nibble);
                shift -= 4;
            }
            return result;
        }
        return u160toDecimalString(this);
    }
}

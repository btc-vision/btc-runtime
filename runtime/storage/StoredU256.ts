import { u256 } from '@btc-vision/as-bignum/assembly';
import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { SafeMath } from '../types/SafeMath';

@final
export class StoredU256 {
    private readonly pointerBuffer: Uint8Array;

    constructor(
        public pointer: u16,
        public subPointer: Uint8Array,
    ) {
        this.pointerBuffer = encodePointer(pointer, subPointer, true, 'StoredU256');
    }

    private _value: u256 = u256.Zero;

    public get value(): u256 {
        this.ensureValue();

        return this._value;
    }

    public set value(value: u256) {
        this._value = value;

        Blockchain.setStorageAt(this.pointerBuffer, this.__value);
    }

    public get toBytes(): Uint8Array {
        return this._value.toUint8Array(true);
    }

    private get __value(): Uint8Array {
        return this._value.toUint8Array(true);
    }

    @inline
    public toString(): string {
        return this._value.toString();
    }

    @inline
    @operator('+')
    public add(value: u256): this {
        this.ensureValue();

        this._value = SafeMath.add(this._value, value);
        Blockchain.setStorageAt(this.pointerBuffer, this.__value);

        return this;
    }

    @inline
    public addNoCommit(value: u256): this {
        this._value = SafeMath.add(this._value, value);

        return this;
    }

    @inline
    public subNoCommit(value: u256): this {
        this._value = SafeMath.sub(this._value, value);

        return this;
    }

    @inline
    public commit(): this {
        Blockchain.setStorageAt(this.pointerBuffer, this.__value);

        return this;
    }

    @inline
    @operator('-')
    public sub(value: u256): this {
        this.ensureValue();

        this._value = SafeMath.sub(this._value, value);
        Blockchain.setStorageAt(this.pointerBuffer, this.__value);

        return this;
    }

    @inline
    @operator('*')
    public mul(value: u256): this {
        this.ensureValue();

        this._value = SafeMath.mul(this._value, value);
        Blockchain.setStorageAt(this.pointerBuffer, this.__value);

        return this;
    }

    @inline
    @operator('==')
    public eq(value: u256): boolean {
        this.ensureValue();

        return this._value === value;
    }

    @inline
    @operator('!=')
    public ne(value: u256): boolean {
        this.ensureValue();

        return this._value !== value;
    }

    @inline
    @operator('<')
    public lt(value: u256): boolean {
        this.ensureValue();

        return this._value < value;
    }

    @inline
    @operator('>')
    public gt(value: u256): boolean {
        this.ensureValue();

        return this._value > value;
    }

    @inline
    @operator('<=')
    public le(value: u256): boolean {
        this.ensureValue();

        return this._value <= value;
    }

    @inline
    @operator('>=')
    public ge(value: u256): boolean {
        this.ensureValue();

        return this._value >= value;
    }

    @inline
    @operator('>>')
    public shr(value: i32): this {
        this.ensureValue();

        this._value = u256.shr(this._value, value);
        Blockchain.setStorageAt(this.pointerBuffer, this.__value);

        return this;
    }

    @inline
    @operator('&')
    public and(value: u256): this {
        this.ensureValue();

        this._value = u256.and(this._value, value);
        Blockchain.setStorageAt(this.pointerBuffer, this.__value);

        return this;
    }

    @inline
    @operator('|')
    public or(value: u256): this {
        this.ensureValue();

        this._value = u256.or(this._value, value);
        Blockchain.setStorageAt(this.pointerBuffer, this.__value);

        return this;
    }

    @inline
    @operator('^')
    public xor(value: u256): this {
        this.ensureValue();

        this._value = u256.xor(this._value, value);
        Blockchain.setStorageAt(this.pointerBuffer, this.__value);

        return this;
    }

    @inline
    @operator('**')
    public pow(exponent: u256): this {
        this.ensureValue();

        this._value = SafeMath.pow(this._value, exponent);
        Blockchain.setStorageAt(this.pointerBuffer, this.__value);

        return this;
    }

    @inline
    @operator('%')
    public mod(value: u256): this {
        this.ensureValue();

        this._value = SafeMath.mod(this._value, value);
        Blockchain.setStorageAt(this.pointerBuffer, this.__value);

        return this;
    }

    @inline
    @operator.postfix('++')
    public inc(): this {
        this.ensureValue();

        this._value = SafeMath.add(this._value, u256.One);
        Blockchain.setStorageAt(this.pointerBuffer, this.__value);

        return this;
    }

    @inline
    @operator.postfix('--')
    public dec(): this {
        this.ensureValue();

        this._value = SafeMath.sub(this._value, u256.One);
        Blockchain.setStorageAt(this.pointerBuffer, this.__value);

        return this;
    }

    @inline
    public set(value: u256): this {
        this._value = value;

        Blockchain.setStorageAt(this.pointerBuffer, this.__value);

        return this;
    }

    @inline
    public toUint8Array(): Uint8Array {
        return this._value.toUint8Array(true);
    }

    private ensureValue(): void {
        const value = Blockchain.getStorageAt(this.pointerBuffer);
        this._value = u256.fromUint8ArrayBE(value);
    }
}

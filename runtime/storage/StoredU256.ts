import { u256 } from 'as-bignum/assembly';
import { SafeMath } from '../types/SafeMath';
import { Address } from '../types/Address';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { Blockchain } from '../env';

@final
export class StoredU256 {
    constructor(public address: Address, public pointer: u16, public subPointer: MemorySlotPointer, private defaultValue: u256) {
        this._value = Blockchain.getStorageAt(this.address, this.pointer, this.subPointer, this.defaultValue);
    }

    private _value: u256 = u256.Zero;

    @inline
    public get value(): u256 {
        this.ensureValue();

        return this._value;
    }

    @inline @operator('+')
    public add(value: u256): this {
        this.ensureValue();

        this._value = SafeMath.add(this._value, value);
        Blockchain.setStorageAt(this.address, this.pointer, this.subPointer, this._value, this.defaultValue);

        return this;
    }

    @inline @operator('-')
    public sub(value: u256): this {
        this.ensureValue();

        this._value = SafeMath.sub(this._value, value);
        Blockchain.setStorageAt(this.address, this.pointer, this.subPointer, this._value, this.defaultValue);

        return this;
    }

    @inline @operator('*')
    public mul(value: u256): this {
        this.ensureValue();

        this._value = SafeMath.mul(this._value, value);
        Blockchain.setStorageAt(this.address, this.pointer, this.subPointer, this._value, this.defaultValue);

        return this;
    }

    @inline @operator('==')
    public eq(value: u256): boolean {
        this.ensureValue();

        return this._value === value;
    }

    @inline @operator('!=')
    public ne(value: u256): boolean {
        this.ensureValue();

        return this._value !== value;
    }

    @inline @operator('<')
    public lt(value: u256): boolean {
        this.ensureValue();

        return this._value < value;
    }

    @inline @operator('>')
    public gt(value: u256): boolean {
        this.ensureValue();

        return this._value > value;
    }

    @inline @operator('<=')
    public le(value: u256): boolean {
        this.ensureValue();

        return this._value <= value;
    }

    @inline @operator('>=')
    public ge(value: u256): boolean {
        this.ensureValue();

        return this._value >= value;
    }

    @inline @operator('>>')
    public shr(value: i32): this {
        this.ensureValue();

        this._value = u256.shr(this._value, value);
        Blockchain.setStorageAt(this.address, this.pointer, this.subPointer, this._value, this.defaultValue);

        return this;
    }

    @inline @operator('&')
    public and(value: u256): this {
        this.ensureValue();

        this._value = u256.and(this._value, value);
        Blockchain.setStorageAt(this.address, this.pointer, this.subPointer, this._value, this.defaultValue);

        return this;
    }

    @inline @operator('|')
    public or(value: u256): this {
        this.ensureValue();

        this._value = u256.or(this._value, value);
        Blockchain.setStorageAt(this.address, this.pointer, this.subPointer, this._value, this.defaultValue);

        return this;
    }

    @inline @operator('^')
    public xor(value: u256): this {
        this.ensureValue();

        this._value = u256.xor(this._value, value);
        Blockchain.setStorageAt(this.address, this.pointer, this.subPointer, this._value, this.defaultValue);

        return this;
    }

    @inline @operator('**')
    public pow(value: u256): this {
        this.ensureValue();

        // code pow from scratch
        let result: u256 = u256.One;

        while (value > u256.Zero) {
            if (u256.and(value, u256.One)) {
                result = SafeMath.mul(result, this._value);
            }

            this._value = SafeMath.mul(this._value, this._value);
            value = u256.shr(value, 1);
        }

        Blockchain.setStorageAt(this.address, this.pointer, this.subPointer, this._value, this.defaultValue);

        return this;
    }

    @inline @operator('%')
    public mod(value: u256): this {
        this.ensureValue();

        // code mod from scratch
        let result: u256 = u256.Zero;
        let base: u256 = this._value;
        let exp: u256 = value;

        while (exp > u256.Zero) {
            if (u256.and(exp, u256.One)) {
                result = SafeMath.add(result, base);
            }

            base = SafeMath.add(base, base);
            exp = u256.shr(exp, 1);
        }

        this._value = result;
        Blockchain.setStorageAt(this.address, this.pointer, this.subPointer, this._value, this.defaultValue);

        return this;
    }

    @inline @operator.postfix('++')
    public inc(): this {
        this.ensureValue();

        this._value = SafeMath.add(this._value, u256.One);
        Blockchain.setStorageAt(this.address, this.pointer, this.subPointer, this._value, this.defaultValue);

        return this;
    }

    @inline @operator.postfix('--')
    public dec(): this {
        this.ensureValue();

        this._value = SafeMath.sub(this._value, u256.One);
        Blockchain.setStorageAt(this.address, this.pointer, this.subPointer, this._value, this.defaultValue);

        return this;
    }

    @inline
    public set(value: u256): this {
        this._value = value;

        Blockchain.setStorageAt(this.address, this.pointer, this.subPointer, this._value, this.defaultValue);

        return this;
    }

    @inline
    public toUint8Array(): Uint8Array {
        return this._value.toUint8Array(true);
    }

    private ensureValue(): void {
        this._value = Blockchain.getStorageAt(this.address, this.pointer, this.subPointer, this.defaultValue);
    }
}

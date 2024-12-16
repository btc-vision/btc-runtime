import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { Address } from '../types/Address';

@final
export class StoredAddress {
    private readonly addressPointer: u256;
    private readonly defaultValue: u256;

    constructor(public pointer: u16, defaultValue: Address) {
        const writer = new BytesWriter(32);

        this.defaultValue = u256.fromBytes(defaultValue);
        this.addressPointer = encodePointer(pointer, writer.getBuffer());
    }

    private _value: Address = new Address();

    @inline
    public get value(): Address {
        this.ensureValue();

        return this._value;
    }

    @inline
    public set value(value: Address) {
        if (value === this.value) {
            return;
        }

        this._value = value;

        Blockchain.setStorageAt(this.addressPointer, u256.fromBytes(this._value));
    }

    private ensureValue(): void {
        const value = Blockchain.getStorageAt(this.addressPointer, this.defaultValue);
        this._value.set(value.toBytes());
    }
}

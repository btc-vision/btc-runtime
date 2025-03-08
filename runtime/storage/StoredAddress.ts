import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { Address } from '../types/Address';
import { EMPTY_BUFFER } from '../math/bytes';

/**
 * Default is Address.dead();
 */
@final
export class StoredAddress {
    private readonly addressPointer: Uint8Array;

    constructor(public pointer: u16) {
        this.addressPointer = encodePointer(pointer, EMPTY_BUFFER);
    }

    private _value: Address = Address.dead();

    public get value(): Address {
        this.ensureValue();

        return this._value;
    }

    public set value(value: Address) {
        if (value === this.value) {
            return;
        }

        this._value = value;

        Blockchain.setStorageAt(this.addressPointer, this._value);
    }

    private ensureValue(): void {
        const value = Blockchain.getStorageAt(this.addressPointer, Address.dead());
        this._value.set(value);
    }
}

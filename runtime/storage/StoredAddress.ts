import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { Address } from '../types/Address';
import { EMPTY_POINTER } from '../math/bytes';
import { eqUint } from '../generic/MapUint8Array';

/**
 * Default is Address.dead();
 */
@final
export class StoredAddress {
    private readonly addressPointer: Uint8Array;

    constructor(public pointer: u16) {
        this.addressPointer = encodePointer(pointer, EMPTY_POINTER, true, 'StoredAddress');
    }

    private _value: Address = Address.zero();

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

    public isDead(): bool {
        return eqUint(Address.zero(), this.value);
    }

    private ensureValue(): void {
        const value = Blockchain.getStorageAt(this.addressPointer);
        this._value.set(value);
    }
}

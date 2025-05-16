import { DEFAULT_MAX_LENGTH, StoredPackedArray } from './StoredPackedArray';
import { bigEndianAdd } from '../../math/bytes';
import { Address } from '../../types/Address';

/**
 * StoredAddressArray
 *
 * Array of addresses.
 */
@final
export class StoredAddressArray extends StoredPackedArray<Address> {
    public constructor(pointer: u16, subPointer: Uint8Array, maxLength: u32 = DEFAULT_MAX_LENGTH) {
        super(pointer, subPointer, Address.zero(), maxLength);
    }

    protected getSlotCapacity(): u32 {
        return 1; // 1 x u256 => 32 bytes
    }

    protected zeroValue(): Address {
        return Address.zero();
    }

    protected eq(a: Address, b: Address): bool {
        return a == b;
    }

    protected packSlot(values: Address[]): Uint8Array {
        return values[0];
    }

    protected unpackSlot(slotData: Uint8Array): Address[] {
        return [Address.fromUint8Array(slotData)];
    }

    protected calculateStoragePointer(slotIndex: u64): Uint8Array {
        return bigEndianAdd(this.basePointer, slotIndex);
    }
}

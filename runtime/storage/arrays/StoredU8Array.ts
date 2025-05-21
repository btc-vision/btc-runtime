import { DEFAULT_MAX_LENGTH, StoredPackedArray } from './StoredPackedArray';
import { bigEndianAdd } from '../../math/bytes';

/**
 * StoredU8Array
 *  - 32 items of type `u8` fit in one 32-byte slot.
 */
@final
export class StoredU8Array extends StoredPackedArray<u8> {
    public constructor(pointer: u16, subPointer: Uint8Array, maxLength: u32 = DEFAULT_MAX_LENGTH) {
        super(pointer, subPointer, 0, maxLength);
    }

    protected getSlotCapacity(): u32 {
        return 32; // 32 bytes => 32 x u8
    }

    protected zeroValue(): u8 {
        return 0;
    }

    protected eq(a: u8, b: u8): bool {
        return a == b;
    }

    protected packSlot(values: u8[]): Uint8Array {
        // values.length == 32
        const out = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            out[i] = values[i];
        }
        return out;
    }

    protected unpackSlot(slotData: Uint8Array): u8[] {
        // slotData.length == 32
        const out = new Array<u8>(32);
        for (let i = 0; i < 32; i++) {
            out[i] = slotData[i];
        }
        return out;
    }

    protected calculateStoragePointer(slotIndex: u64): Uint8Array {
        // basePointer + (slotIndex+1) in big-endian
        return bigEndianAdd(this.basePointer, slotIndex);
    }
}

import { DEFAULT_MAX_LENGTH, StoredPackedArray } from './StoredPackedArray';
import { bigEndianAdd } from '../../math/bytes';

/**
 * StoredU32Array
 *  - 8 items of type `u32` fit in one 32-byte slot.
 */
@final
export class StoredU32Array extends StoredPackedArray<u32> {
    public constructor(pointer: u16, subPointer: Uint8Array, maxLength: u32 = DEFAULT_MAX_LENGTH) {
        super(pointer, subPointer, 0, maxLength);
    }

    protected getSlotCapacity(): u32 {
        return 8; // 8 x u32 => 32 bytes
    }

    protected zeroValue(): u32 {
        return 0;
    }

    protected eq(a: u32, b: u32): bool {
        return a == b;
    }

    protected packSlot(values: u32[]): Uint8Array {
        const out = new Uint8Array(32);
        let offset = 0;
        for (let i = 0; i < 8; i++) {
            const v = values[i];
            out[offset] = <u8>((v >> 24) & 0xff);
            out[offset + 1] = <u8>((v >> 16) & 0xff);
            out[offset + 2] = <u8>((v >> 8) & 0xff);
            out[offset + 3] = <u8>(v & 0xff);
            offset += 4;
        }
        return out;
    }

    protected unpackSlot(slotData: Uint8Array): u32[] {
        const out = new Array<u32>(8);
        let offset = 0;
        for (let i = 0; i < 8; i++) {
            const b0 = slotData[offset];
            const b1 = slotData[offset + 1];
            const b2 = slotData[offset + 2];
            const b3 = slotData[offset + 3];
            out[i] = (((<u32>b0) << 24) | ((<u32>b1) << 16) | ((<u32>b2) << 8) | b3) as u32;
            offset += 4;
        }
        return out;
    }

    protected calculateStoragePointer(slotIndex: u64): Uint8Array {
        return bigEndianAdd(this.basePointer, slotIndex);
    }
}

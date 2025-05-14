import { DEFAULT_MAX_LENGTH, StoredPackedArray } from './StoredPackedArray';
import { bigEndianAdd } from '../../math/bytes';

/**
 * StoredU64Array
 *  - 4 items of type `u64` fit in one 32-byte slot.
 */
@final
export class StoredU64Array extends StoredPackedArray<u64> {
    public constructor(pointer: u16, subPointer: Uint8Array, maxLength: u32 = DEFAULT_MAX_LENGTH) {
        super(pointer, subPointer, 0, maxLength);
    }

    protected getSlotCapacity(): u32 {
        return 4; // 4 x u64 => 32 bytes
    }

    protected zeroValue(): u64 {
        return 0;
    }

    protected eq(a: u64, b: u64): bool {
        return a == b;
    }

    protected packSlot(values: u64[]): Uint8Array {
        const out = new Uint8Array(32);
        let offset = 0;
        for (let i = 0; i < 4; i++) {
            const v = values[i];
            out[offset] = <u8>((v >> 56) & 0xff);
            out[offset + 1] = <u8>((v >> 48) & 0xff);
            out[offset + 2] = <u8>((v >> 40) & 0xff);
            out[offset + 3] = <u8>((v >> 32) & 0xff);
            out[offset + 4] = <u8>((v >> 24) & 0xff);
            out[offset + 5] = <u8>((v >> 16) & 0xff);
            out[offset + 6] = <u8>((v >> 8) & 0xff);
            out[offset + 7] = <u8>(v & 0xff);
            offset += 8;
        }
        return out;
    }

    protected unpackSlot(slotData: Uint8Array): u64[] {
        const out = new Array<u64>(4);
        let offset = 0;
        for (let i = 0; i < 4; i++) {
            const b0 = <u64>slotData[offset];
            const b1 = <u64>slotData[offset + 1];
            const b2 = <u64>slotData[offset + 2];
            const b3 = <u64>slotData[offset + 3];
            const b4 = <u64>slotData[offset + 4];
            const b5 = <u64>slotData[offset + 5];
            const b6 = <u64>slotData[offset + 6];
            const b7 = <u64>slotData[offset + 7];
            out[i] =
                (b0 << 56) |
                (b1 << 48) |
                (b2 << 40) |
                (b3 << 32) |
                (b4 << 24) |
                (b5 << 16) |
                (b6 << 8) |
                b7;
            offset += 8;
        }
        return out;
    }

    protected calculateStoragePointer(slotIndex: u64): Uint8Array {
        return bigEndianAdd(this.basePointer, slotIndex);
    }
}

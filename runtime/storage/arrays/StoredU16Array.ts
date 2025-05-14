import { DEFAULT_MAX_LENGTH, StoredPackedArray } from './StoredPackedArray';
import { bigEndianAdd } from '../../math/bytes';

/**
 * Each 32-byte slot can store 16 u16 values (2 bytes each).
 */
@final
export class StoredU16Array extends StoredPackedArray<u16> {
    public constructor(pointer: u16, subPointer: Uint8Array, maxLength: u32 = DEFAULT_MAX_LENGTH) {
        super(pointer, subPointer, 0, maxLength);
    }

    protected getSlotCapacity(): u32 {
        return 16; // 16 x u16 = 32 bytes
    }

    protected zeroValue(): u16 {
        return 0;
    }

    protected eq(a: u16, b: u16): bool {
        return a == b;
    }

    /**
     * Pack an array of 16 u16s into a 32-byte buffer.
     */
    protected packSlot(values: u16[]): Uint8Array {
        const out = new Uint8Array(32);
        let offset = 0;
        for (let i = 0; i < 16; i++) {
            const v = values[i];
            out[offset] = <u8>((v >> 8) & 0xff); // high byte
            out[offset + 1] = <u8>(v & 0xff); // low byte
            offset += 2;
        }
        return out;
    }

    /**
     * Unpack a 32-byte buffer into an array of 16 u16.
     */
    protected unpackSlot(slotData: Uint8Array): u16[] {
        const out = new Array<u16>(16);
        let offset = 0;
        for (let i = 0; i < 16; i++) {
            const hi = slotData[offset];
            const lo = slotData[offset + 1];
            out[i] = ((hi << 8) | lo) as u16;
            offset += 2;
        }
        return out;
    }

    protected calculateStoragePointer(slotIndex: u64): Uint8Array {
        return bigEndianAdd(this.basePointer, slotIndex);
    }
}

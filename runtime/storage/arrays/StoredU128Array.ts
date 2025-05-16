import { DEFAULT_MAX_LENGTH, StoredPackedArray } from './StoredPackedArray';
import { u128 } from '@btc-vision/as-bignum/assembly';
import { bigEndianAdd } from '../../math/bytes';

/**
 * StoredU128Array
 *  - 2 items of type `u128` fit in one 32-byte slot.
 *    (Each u128 is 16 bytes.)
 */
@final
export class StoredU128Array extends StoredPackedArray<u128> {
    public constructor(pointer: u16, subPointer: Uint8Array, maxLength: u32 = DEFAULT_MAX_LENGTH) {
        super(pointer, subPointer, u128.Zero, maxLength);
    }

    protected getSlotCapacity(): u32 {
        return 2; // 2 x u128 => 32 bytes
    }

    protected zeroValue(): u128 {
        return u128.Zero; // from the as-bignum library
    }

    protected eq(a: u128, b: u128): bool {
        return a == b;
    }

    protected packSlot(values: u128[]): Uint8Array {
        const out = new Uint8Array(32);
        const firstBytes = values[0].toBytes(true);
        const secondBytes = values[1].toBytes(true);
        for (let i = 0; i < 16; i++) {
            out[i] = firstBytes[i];
        }

        for (let i = 0; i < 16; i++) {
            out[16 + i] = secondBytes[i];
        }

        return out;
    }

    protected unpackSlot(slotData: Uint8Array): u128[] {
        // slotData.length == 32
        const first = new Uint8Array(16);
        const second = new Uint8Array(16);
        for (let i = 0; i < 16; i++) {
            first[i] = slotData[i];
        }

        for (let i = 16; i < 32; i++) {
            second[i - 16] = slotData[i];
        }

        const val0 = u128.fromUint8ArrayBE(first);
        const val1 = u128.fromUint8ArrayBE(second);

        return [val0, val1];
    }

    protected calculateStoragePointer(slotIndex: u64): Uint8Array {
        return bigEndianAdd(this.basePointer, slotIndex);
    }
}

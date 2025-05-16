import { DEFAULT_MAX_LENGTH, StoredPackedArray } from './StoredPackedArray';
import { u256 } from '@btc-vision/as-bignum/assembly';
import { bigEndianAdd } from '../../math/bytes';

/**
 * StoredU256Array
 *  - 1 item of type `u256` fits in one 32-byte slot.
 */
@final
export class StoredU256Array extends StoredPackedArray<u256> {
    public constructor(pointer: u16, subPointer: Uint8Array, maxLength: u32 = DEFAULT_MAX_LENGTH) {
        super(pointer, subPointer, u256.Zero, maxLength);
    }

    protected getSlotCapacity(): u32 {
        return 1; // 1 x u256 => 32 bytes
    }

    protected zeroValue(): u256 {
        return u256.Zero;
    }

    protected eq(a: u256, b: u256): bool {
        return a == b;
    }

    protected packSlot(values: u256[]): Uint8Array {
        return values[0].toUint8Array(true);
    }

    protected unpackSlot(slotData: Uint8Array): u256[] {
        const val = u256.fromBytes(slotData, true);
        return [val];
    }

    protected calculateStoragePointer(slotIndex: u64): Uint8Array {
        return bigEndianAdd(this.basePointer, slotIndex);
    }
}

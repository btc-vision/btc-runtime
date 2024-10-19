import { StorageSlot } from './StorageSlot';
import { StorageBacked } from './StorageBacked';

export class StorageStruct<T extends StorageBacked> {
    public inner: T;
    public slot: StorageSlot;

    constructor(slot: StorageSlot, inner: T) {
        this.slot = slot;
        this.inner = inner;
    }

    public static load<T extends StorageBacked>(slot: StorageSlot): StorageStruct<T> {
        return new StorageStruct<T>(slot, instantiate<T>(slot.getList()));
    }

    public save(): void {
        const packed = this.inner.serialize();
        for (let i = 0; i < packed.length; i++) {
            this.slot.selectIndex(i).set(packed[i]);
        }
    }
}

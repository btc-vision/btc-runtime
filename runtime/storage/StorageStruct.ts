import { StorageSlot } from "./StorageSlot";

export class StorageStruct<T> {
  public inner: T;
  public slot: StorageSlot;
  constructor(slot: StorageSlot, inner: T) {
    this.slot = slot;
    this.inner = inner;
  }
  save(): void {
    const packed = this.inner.serialize();
    for (let i = 0; i < packed.length; i++) {
      this.slot.selectIndex(i).set(packed[i]);
    }
  }
  static load<T>(slot: StorageSlot): StorageStruct<T> {
    return new StorageStruct<T>(slot, instantiate<T>(slot.getList()));
  }
}

import { u256 } from 'as-bignum/assembly';
import { StorageSlot } from './StorageSlot';

export class StorageValue<T> {
    public value: u256;
    public slot: StorageSlot;

    constructor(slot: StorageSlot) {
        this.slot = slot;
        this.value = u256.Zero;
    }

    public static at<T>(slot: StorageSlot): StorageValue<T> {
        return new StorageValue<T>(slot);
    }

    public save(): this {
        this.slot.set(u256.from(this.value));
        return this;
    }

    public set(v: T): this {
        this.value = u256.from(v);
        this.save();
        return this;
    }

    public load(): this {
        this.value = this.slot.get();
        return this;
    }

    public unwrap(): T {
        return load<T>(changetype<usize>(this.value.toUint8Array().buffer));
    }
}

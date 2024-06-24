import { Address } from '../types/Address';
import { MemorySlotData } from './MemorySlot';
import { u256 } from 'as-bignum/assembly';
import { KeyMerger } from './KeyMerger';
import { Map } from '../generic/Map';

@final
export class MultiAddressMemoryMap<K extends string, K2 extends string, V extends MemorySlotData<u256>> extends Map<K, KeyMerger<K, K2, V>> {
    public pointer: u16;

    private readonly memoryAllocatorAddress: Address;

    constructor(pointer: u16, self: Address, private readonly defaultValue: V) {
        super();

        this.pointer = pointer;
        this.memoryAllocatorAddress = self;
    }

    public get(key: K): KeyMerger<K, K2, V> {
        this.createKeyMerger(key);

        return super.get(key);
    }

    public setUpperKey(key: K, key2: K2, value: V): this {
        this.createKeyMerger(key);

        const subMap = super.get(key);
        if (subMap) {
            subMap.set(key2, value);
        }

        return this;
    }

    public set(key: K, value: KeyMerger<K, K2, V>): this {
        this.createKeyMerger(key);

        return <this><unknown>super.set(key, value);
    }

    public has(key: K): bool {
        return super.has(key);
    }

    public delete(key: K): bool {
        return super.delete(key);
    }

    public clear(): void {
        super.clear();
    }

    private createKeyMerger(key: K): void {
        if (!super.has(key)) {
            super.set(key, new KeyMerger<K, K2, V>(key, this.pointer, this.memoryAllocatorAddress, this.defaultValue));
        }
    }
}

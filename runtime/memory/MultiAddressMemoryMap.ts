import { MemorySlotData } from './MemorySlot';
import { u256 } from 'as-bignum/assembly';
import { Uint8ArrayMerger } from './Uint8ArrayMerger';
import { Address } from '../types/Address';

@final
export class MultiAddressMemoryMap<V extends MemorySlotData<u256>> extends Map<
    Address,
    Uint8ArrayMerger<V>
> {
    public pointer: u16;

    constructor(
        pointer: u16,
        private readonly defaultValue: V,
    ) {
        super();

        this.pointer = pointer;
    }

    public get(key: Address): Uint8ArrayMerger<V> {
        this.createKeyMerger(key);

        return super.get(key);
    }

    public setUpperKey(key: Address, key2: Address, value: V): this {
        this.createKeyMerger(key);

        const subMap = super.get(key);
        if (subMap) {
            subMap.set(key2, value);
        }

        return this;
    }

    public set(key: Address, value: Uint8ArrayMerger<V>): this {
        this.createKeyMerger(key);

        return <this>super.set(key, value);
    }

    public has(key: Address): bool {
        return super.has(key);
    }

    public delete(key: Address): bool {
        return super.delete(key);
    }

    public clear(): void {
        super.clear();
    }

    private createKeyMerger(key: Address): void {
        if (!super.has(key)) {
            super.set(key, new Uint8ArrayMerger<V>(key, this.pointer, this.defaultValue));
        }
    }
}

import { MemorySlotData } from './MemorySlot';
import { u256 } from 'as-bignum/assembly';
import { KeyMerger } from './KeyMerger';

@final
export class MultiStringMemoryMap<
    K extends string,
    K2 extends string,
    V extends MemorySlotData<u256>,
> extends Map<K, KeyMerger<K, K2, V>> {
    public pointer: u16;

    constructor(
        pointer: u16,
        private readonly defaultValue: V,
    ) {
        super();

        this.pointer = pointer;
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

        return <this>super.set(key, value);
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
            super.set(key, new KeyMerger<K, K2, V>(key, this.pointer, this.defaultValue));
        }
    }
}

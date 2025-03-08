import { KeyMerger } from './KeyMerger';

@final
export class MultiStringMemoryMap<
    K extends string,
    K2 extends string,
    V extends Uint8Array,
> extends Map<K, KeyMerger<K, K2, V>> {
    public pointer: u16;

    constructor(
        pointer: u16,
    ) {
        super();

        this.pointer = pointer;
    }

    @inline
    public get(key: K): KeyMerger<K, K2, V> {
        this.createKeyMerger(key);

        return super.get(key);
    }

    @inline
    public setUpperKey(key: K, key2: K2, value: V): this {
        this.createKeyMerger(key);

        const subMap = super.get(key);
        if (subMap) {
            subMap.set(key2, value);
        }

        return this;
    }

    @inline
    public set(key: K, value: KeyMerger<K, K2, V>): this {
        this.createKeyMerger(key);

        return <this>super.set(key, value);
    }

    @inline
    public has(key: K): bool {
        return super.has(key);
    }

    @inline
    public delete(key: K): bool {
        return super.delete(key);
    }

    @inline
    public clear(): void {
        super.clear();
    }

    private createKeyMerger(key: K): void {
        if (!super.has(key)) {
            super.set(key, new KeyMerger<K, K2, V>(key, this.pointer));
        }
    }
}

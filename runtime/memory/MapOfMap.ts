import { Address } from '../types/Address';
import { Nested } from './Nested';
import { Map } from '../generic/Map';

@final
export class MapOfMap<T> extends Map<Address, Nested<T>> {
    public pointer: u16;

    constructor(pointer: u16) {
        super();

        this.pointer = pointer;
    }

    @inline
    public get(key: Address): Nested<T> {
        this.createKeyMerger(key);

        return super.get(key);
    }

    @inline
    public set(key: Address, value: Nested<T>): this {
        this.createKeyMerger(key);

        return <this>super.set(key, value);
    }

    @inline
    public has(key: Address): bool {
        return super.has(key);
    }

    @inline
    public delete(key: Address): bool {
        return super.delete(key);
    }

    @inline
    public clear(): void {
        super.clear();
    }

    @inline
    private createKeyMerger(key: Address): void {
        if (!super.has(key)) {
            super.set(key, new Nested<T>(key, this.pointer));
        }
    }
}

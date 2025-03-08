import { Uint8ArrayMerger } from './Uint8ArrayMerger';
import { Address } from '../types/Address';

@final
export class MultiAddressMemoryMap extends Map<
    Address,
    Uint8ArrayMerger
> {
    public pointer: u16;

    constructor(
        pointer: u16,
        private readonly defaultValue: Uint8Array,
    ) {
        super();

        this.pointer = pointer;
    }

    @inline
    public get(key: Address): Uint8ArrayMerger {
        this.createKeyMerger(key);

        return super.get(key);
    }

    @inline
    public set(key: Address, value: Uint8ArrayMerger): this {
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
            super.set(key, new Uint8ArrayMerger(key, this.pointer, this.defaultValue));
        }
    }
}

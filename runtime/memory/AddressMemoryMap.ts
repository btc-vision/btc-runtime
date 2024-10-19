import { MemorySlotPointer } from './MemorySlotPointer';
import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { MemorySlotData } from './MemorySlot';
import { u256 } from 'as-bignum/assembly';
import { BytesWriter } from '../buffer/BytesWriter';
import { Address } from '../types/Address';

@final
export class AddressMemoryMap<V extends MemorySlotData<u256>> {
    public pointer: u16;

    constructor(
        pointer: u16,
        private readonly defaultValue: V,
    ) {
        this.pointer = pointer;
    }

    public set(key: Address, value: V): this {
        const keyHash: MemorySlotPointer = this.encodePointer(key);
        Blockchain.setStorageAt(keyHash, value);

        return this;
    }

    public get(key: Address): MemorySlotData<u256> {
        const keyHash: MemorySlotPointer = this.encodePointer(key);

        return Blockchain.getStorageAt(keyHash, this.defaultValue);
    }

    public has(key: Address): bool {
        const keyHash: MemorySlotPointer = this.encodePointer(key);

        return Blockchain.hasStorageAt(keyHash);
    }

    @unsafe
    public delete(key: Address): bool {
        this.set(key, this.defaultValue);

        return true;
    }

    @unsafe
    public clear(): void {
        throw new Error('Method not implemented.');
    }

    private encodePointer(key: Address): MemorySlotPointer {
        const writer = new BytesWriter(key.length + 2);
        writer.writeU16(this.pointer);
        writer.writeBytes(key);

        return encodePointer(writer.getBuffer());
    }
}

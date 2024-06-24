import { MemorySlotPointer } from './MemorySlotPointer';
import { Blockchain } from '../env';
import { Address } from '../types/Address';
import { encodePointer } from '../math/abi';
import { MemorySlotData } from './MemorySlot';
import { u256 } from 'as-bignum/assembly';

@final
export class AddressMemoryMap<K extends string, V extends MemorySlotData<u256>> {
    public pointer: u16;

    private readonly memoryAllocatorAddress: Address;

    constructor(pointer: u16, self: Address, private readonly defaultValue: V) {
        this.pointer = pointer;
        this.memoryAllocatorAddress = self;
    }

    public set(key: K, value: V): this {
        const keyHash: MemorySlotPointer = encodePointer(key);
        Blockchain.setStorageAt(this.memoryAllocatorAddress, this.pointer, keyHash, value, this.defaultValue);

        return this;
    }

    public get(key: K): MemorySlotData<u256> {
        return Blockchain.getStorageAt(this.memoryAllocatorAddress, this.pointer, encodePointer(key), this.defaultValue);
    }

    public has(key: K): bool {
        return Blockchain.hasStorageAt(this.memoryAllocatorAddress, this.pointer, encodePointer(key));
    }

    @unsafe
    public delete(key: K): bool {
        this.set(key, this.defaultValue);

        return true;
    }

    @unsafe
    public clear(): void {
        throw new Error('Method not implemented.');
    }
}

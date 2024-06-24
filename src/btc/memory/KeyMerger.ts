import { MemorySlotData } from './MemorySlot';
import { u256 } from 'as-bignum/assembly';
import { Blockchain } from '../env';
import { Address } from '../types/Address';
import { MemorySlotPointer } from './MemorySlotPointer';
import { encodePointer } from '../math/abi';

@final
export class KeyMerger<K extends string, K2 extends string, V extends MemorySlotData<u256>> {
    public parentKey: K;

    public pointer: u16;
    private readonly memoryAllocatorAddress: Address;

    constructor(parent: K, pointer: u16, self: Address, private readonly defaultValue: V) {
        this.pointer = pointer;
        this.memoryAllocatorAddress = self;

        this.parentKey = parent;
    }

    public set(key2: K2, value: V): this {
        const mergedKey: string = `${this.parentKey}${key2}`;
        const keyHash: MemorySlotPointer = encodePointer(mergedKey);

        Blockchain.setStorageAt(this.memoryAllocatorAddress, this.pointer, keyHash, value, this.defaultValue);

        return this;
    }

    public get(key: K): MemorySlotData<u256> {
        const mergedKey: string = `${this.parentKey}${key}`;

        return Blockchain.getStorageAt(this.memoryAllocatorAddress, this.pointer, encodePointer(mergedKey), this.defaultValue);
    }

    public has(key: K): bool {
        const mergedKey: string = `${this.parentKey}${key}`;

        return Blockchain.hasStorageAt(this.memoryAllocatorAddress, this.pointer, encodePointer(mergedKey));
    }

    @unsafe
    public delete(_key: K): bool {
        throw new Error('Method not implemented.');
    }

    @unsafe
    public clear(): void {
        throw new Error('Clear method not implemented.');
    }
}

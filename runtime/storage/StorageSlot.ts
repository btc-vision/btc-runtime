import { u256 } from 'as-bignum/assembly';
import { BlockchainEnvironment } from '../env/BlockchainEnvironment';
import { Sha256 } from '../math/sha256';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { Box } from '../utils/box';
import { concat, fromArrayBuffer, toArrayBuffer } from './utils/utils';

export function toBuffer<T>(v: T): ArrayBuffer {
    const result = new ArrayBuffer(sizeof<T>());
    store<T>(changetype<usize>(result), v);
    return result;
}

export class StorageSlot {
    public pointer: u16;
    public subPointer: MemorySlotPointer;
    static wrap(v: ArrayBuffer): StorageSlot {
        return new StorageSlot(0, fromArrayBuffer(Sha256.hash(Uint8Array.wrap(v))));
    }
    static for(keyword: string): StorageSlot {
        return StorageSlot.wrap(String.UTF8.encode(keyword));
    }
    constructor(pointer: u16, subPointer: MemorySlotPointer) {
        this.pointer = pointer;
        this.subPointer = subPointer;
    }
    static at(pointer: u16): StorageSlot {
        return new StorageSlot(pointer, u256.Zero);
    }
    select(v: ArrayBuffer): StorageSlot {
        return new StorageSlot(
            this.pointer,
            fromArrayBuffer(
                Sha256.hash(
                    Uint8Array.wrap(
                        concat(toArrayBuffer(this.subPointer), Sha256.hash(Uint8Array.wrap(v))),
                    ),
                ),
            ),
        );
    }
    keyword(key: string): StorageSlot {
        return this.select(String.UTF8.encode(key));
    }
    get(): u256 {
        return changetype<BlockchainEnvironment>(0).getStorageAt(this.pointerHash, u256.Zero);
    }
    set(v: u256): void {
        changetype<BlockchainEnvironment>(0).setStorageAt(this.pointerHash, v);
    }
    lengthKey(): StorageSlot {
        return this.keyword('/length');
    }
    length(): u32 {
        return this.lengthKey().get().toU32();
    }
    getList(): Array<u256> {
        const result = new Array<u256>(<i32>this.length());
        for (let i: i32 = 0; i < result.length; i++) {
            result[i] = this.selectIndex(i).get();
        }
        return result;
    }
    extend(): StorageSlot {
        const lengthKey = this.lengthKey();
        const length = lengthKey.get().toU32();
        lengthKey.set(u256.from(length + 1));
        return this.selectIndex(length);
    }
    selectIndex(index: u32): StorageSlot {
        return this.keyword('/' + index.toString(10));
    }
    nullify(): void {
        this.set(u256.Zero);
    }
    append(v: u256): void {
        this.extend().set(v);
    }
    get pointerHash(): u256 {
        return fromArrayBuffer(
            Sha256.hash(
                Uint8Array.wrap(
                    Box.concat([
                        Box.from(toBuffer(this.pointer)),
                        Box.from(toArrayBuffer(this.subPointer)),
                    ]),
                ),
            ),
        );
    }
}

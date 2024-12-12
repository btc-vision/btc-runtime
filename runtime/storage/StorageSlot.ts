import { u256 } from '@btc-vision/as-bignum/assembly';
import { BlockchainEnvironment } from '../env/BlockchainEnvironment';
import { Sha256 } from '../math/sha256';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { Box, concat, fromArrayBuffer, toArrayBuffer } from '../utils';

export function toBuffer<T>(v: T): ArrayBuffer {
    const result = new ArrayBuffer(sizeof<T>());
    store<T>(changetype<usize>(result), v);
    return result;
}

export class StorageSlot {
    public pointer: u16;
    public subPointer: MemorySlotPointer;

    constructor(pointer: u16, subPointer: MemorySlotPointer) {
        this.pointer = pointer;
        this.subPointer = subPointer;
    }

    public get pointerHash(): u256 {
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

    public static wrap(v: ArrayBuffer): StorageSlot {
        return new StorageSlot(0, fromArrayBuffer(Sha256.hash(Uint8Array.wrap(v))));
    }

    public static for(keyword: string): StorageSlot {
        return StorageSlot.wrap(String.UTF8.encode(keyword));
    }

    public static at(pointer: u16): StorageSlot {
        return new StorageSlot(pointer, u256.Zero);
    }

    public select(v: ArrayBuffer): StorageSlot {
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

    public keyword(key: string): StorageSlot {
        return this.select(String.UTF8.encode(key));
    }

    public get(): u256 {
        return changetype<BlockchainEnvironment>(0).getStorageAt(this.pointerHash, u256.Zero);
    }

    public set(v: u256): void {
        changetype<BlockchainEnvironment>(0).setStorageAt(this.pointerHash, v);
    }

    public lengthKey(): StorageSlot {
        return this.keyword('/length');
    }

    public length(): u32 {
        return this.lengthKey().get().toU32();
    }

    public getList(): Array<u256> {
        const result = new Array<u256>(<i32>this.length());
        for (let i: i32 = 0; i < result.length; i++) {
            result[i] = this.selectIndex(i).get();
        }
        return result;
    }

    public extend(): StorageSlot {
        const lengthKey = this.lengthKey();
        const length = lengthKey.get().toU32();
        lengthKey.set(u256.from(length + 1));
        return this.selectIndex(length);
    }

    public selectIndex(index: u32): StorageSlot {
        return this.keyword('/' + index.toString(10));
    }

    public nullify(): void {
        this.set(u256.Zero);
    }

    public append(v: u256): void {
        this.extend().set(v);
    }
}

// SO IN TYPESCRIPT, WE CAN NOT USE TWO METHOD WITH THE SAME NAME. SO NOT ADDING THE TYPE TO THE HASH IS A DESIGN CHOICE.
import { bytes32, bytes4 } from './bytes';
import { Sha256 } from './sha256';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { u256 } from 'as-bignum/assembly';

export type Selector = u32;

export function encodeSelector(name: string): Selector {
    const typed = Uint8Array.wrap(String.UTF8.encode(name));
    const hash = Sha256.hash(typed);

    return bytes4(hash);
}

export function encodePointer(str: string): MemorySlotPointer {
    const typed = Uint8Array.wrap(String.UTF8.encode(str));
    const hash = Sha256.hash(typed);

    return bytes32(hash);
}

export function encodePointerHash(pointer: u16, sub: u256): MemorySlotPointer {
    const finalBuffer: Uint8Array = new Uint8Array(34);
    const mergedKey: u8[] = [
        u8(pointer & u16(0xFF)),
        u8((pointer >> u16(8)) & u16(0xFF)),
    ];

    for (let i: i32 = 0; i < mergedKey.length; i++) {
        finalBuffer[i] = mergedKey[i];
    }

    const subKey = sub.toUint8Array();
    for (let i: i32 = 0; i < subKey.length; i++) {
        finalBuffer[mergedKey.length + i] = subKey[i];
    }

    return bytes32(Sha256.hash(finalBuffer));
}

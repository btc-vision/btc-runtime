import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesReader } from '../buffer/BytesReader';
import { BytesWriter } from '../buffer/BytesWriter';
import { U256_BYTE_LENGTH } from '../utils';

const fakeStorage = new Map<u256, u256>();

export function loadPointer1(data: Uint8Array): Uint8Array
{
    const reader: BytesReader = new BytesReader(data);

    const pointer: u256 = reader.readU256();

    if(fakeStorage.has(pointer)) {
        const writer = new BytesWriter(U256_BYTE_LENGTH);
        writer.writeU256(fakeStorage.get(pointer));

        return writer.getBuffer();
    } else
    {
        const writer = new BytesWriter(U256_BYTE_LENGTH);
        writer.writeU256(u256.Zero);

        return writer.getBuffer();
    }
}

export function storePointer1(data: Uint8Array): Uint8Array{
    const reader: BytesReader = new BytesReader(data);
    const pointerHash: u256 = reader.readU256();
    const value: u256 = reader.readU256();

    fakeStorage.set(pointerHash, value);

    return data;
}
import { NetEvent } from '../NetEvent';
import { Address } from '../../types/Address';
import { u256 } from '@btc-vision/as-bignum/assembly';
import { ADDRESS_BYTE_LENGTH, U256_BYTE_LENGTH, U32_BYTE_LENGTH } from '../../utils';
import { BytesWriter } from '../../buffer/BytesWriter';
import { Revert } from '../../types/Revert';

@final
export class TransferredBatchEvent extends NetEvent {
    constructor(operator: Address, from: Address, to: Address, ids: u256[], values: u256[]) {
        // Check max array size to avoid exceeding event data limit
        // 3 addresses (32*3) + 2 lengths (4*2) = 104 bytes overhead
        // Each id+value pair = 64 bytes
        // Max pairs = (352 - 104) / 64 = 3.875, so max 3 items
        if (ids.length > 3) {
            throw new Revert('TransferBatch event exceeds max data size');
        }

        const size =
            ADDRESS_BYTE_LENGTH * 3 + U32_BYTE_LENGTH * 2 + ids.length * U256_BYTE_LENGTH * 2;
        const writer = new BytesWriter(size);
        writer.writeAddress(operator);
        writer.writeAddress(from);
        writer.writeAddress(to);
        writer.writeU32(u32(ids.length));
        for (let i = 0; i < ids.length; i++) {
            writer.writeU256(ids[i]);
        }
        writer.writeU32(u32(values.length));
        for (let i = 0; i < values.length; i++) {
            writer.writeU256(values[i]);
        }
        super('TransferredBatch', writer);
    }
}

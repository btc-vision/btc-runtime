import { NetEvent } from '../NetEvent';
import { Address } from '../../types/Address';
import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../../buffer/BytesWriter';
import { ADDRESS_BYTE_LENGTH, U256_BYTE_LENGTH } from '../../utils';

@final
export class TransferredSingleEvent extends NetEvent {
    constructor(operator: Address, from: Address, to: Address, id: u256, value: u256) {
        const writer = new BytesWriter(ADDRESS_BYTE_LENGTH * 3 + U256_BYTE_LENGTH * 2);
        writer.writeAddress(operator);
        writer.writeAddress(from);
        writer.writeAddress(to);
        writer.writeU256(id);
        writer.writeU256(value);
        super('TransferredSingle', writer);
    }
}

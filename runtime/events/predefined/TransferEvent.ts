import { u256 } from 'as-bignum/assembly';
import { NetEvent } from '../NetEvent';
import { Address, ADDRESS_BYTE_LENGTH } from '../../types/Address';
import { BytesWriter } from '../../buffer/BytesWriter';

@final
export class TransferEvent extends NetEvent {
    constructor(from: Address, to: Address, amount: u256) {
        const data: BytesWriter = new BytesWriter(ADDRESS_BYTE_LENGTH * 2 + 32);
        data.writeAddress(from);
        data.writeAddress(to);
        data.writeU256(amount);

        super('Transfer', data);
    }
}

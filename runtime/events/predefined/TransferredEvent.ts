import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../../buffer/BytesWriter';
import { Address } from '../../types/Address';
import { ADDRESS_BYTE_LENGTH, U256_BYTE_LENGTH } from '../../utils';
import { NetEvent } from '../NetEvent';

@final
export class TransferredEvent extends NetEvent {
    constructor(operator: Address, from: Address, to: Address, amount: u256) {
        const data: BytesWriter = new BytesWriter(ADDRESS_BYTE_LENGTH * 3 + U256_BYTE_LENGTH);
        data.writeAddress(operator);
        data.writeAddress(from);
        data.writeAddress(to);
        data.writeU256(amount);

        super('Transferred', data);
    }
}

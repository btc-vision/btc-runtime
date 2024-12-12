import { u256 } from '@btc-vision/as-bignum/assembly';
import { NetEvent } from '../NetEvent';
import { BytesWriter } from '../../buffer/BytesWriter';
import { Address, ADDRESS_BYTE_LENGTH } from '../../types/Address';

@final
export class MintEvent extends NetEvent {
    constructor(address: Address, amount: u256) {
        const data: BytesWriter = new BytesWriter(32 + ADDRESS_BYTE_LENGTH);

        data.writeAddress(address);
        data.writeU256(amount);

        super('Mint', data);
    }
}

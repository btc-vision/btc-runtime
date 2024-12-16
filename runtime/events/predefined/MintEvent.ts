import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../../buffer/BytesWriter';
import { Address } from '../../types/Address';
import { ADDRESS_BYTE_LENGTH, UINT256_BYTE_LENGTH } from '../../utils/lengths';
import { NetEvent } from '../NetEvent';

@final
export class MintEvent extends NetEvent {
    constructor(address: Address, amount: u256) {
        const data: BytesWriter = new BytesWriter(ADDRESS_BYTE_LENGTH + UINT256_BYTE_LENGTH);

        data.writeAddress(address);
        data.writeU256(amount);

        super('Mint', data);
    }
}

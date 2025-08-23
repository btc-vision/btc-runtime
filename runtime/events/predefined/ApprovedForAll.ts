import { NetEvent } from '../NetEvent';
import { BytesWriter } from '../../buffer/BytesWriter';
import { Address } from '../../types/Address';
import { ADDRESS_BYTE_LENGTH } from '../../utils';

@final
export class ApprovedForAllEvent extends NetEvent {
    constructor(account: Address, operator: Address, approved: boolean) {
        const writer = new BytesWriter(ADDRESS_BYTE_LENGTH * 2 + 1);
        writer.writeAddress(account);
        writer.writeAddress(operator);
        writer.writeBoolean(approved);

        super('ApprovedForAll', writer);
    }
}

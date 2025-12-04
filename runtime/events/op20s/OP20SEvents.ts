import { u256 } from '@btc-vision/as-bignum/assembly';
import { NetEvent } from '../NetEvent';
import { BytesWriter } from '../../buffer/BytesWriter';
import { ADDRESS_BYTE_LENGTH, U256_BYTE_LENGTH, U64_BYTE_LENGTH } from '../../utils';
import { Address } from '../../types/Address';

@final
export class PegRateUpdatedEvent extends NetEvent {
    constructor(oldRate: u256, newRate: u256, updatedAt: u64) {
        const data: BytesWriter = new BytesWriter(U256_BYTE_LENGTH * 2 + U64_BYTE_LENGTH);
        data.writeU256(oldRate);
        data.writeU256(newRate);
        data.writeU64(updatedAt);

        super('PegRateUpdated', data);
    }
}

@final
export class PegAuthorityTransferStartedEvent extends NetEvent {
    constructor(currentAuthority: Address, pendingAuthority: Address) {
        const data: BytesWriter = new BytesWriter(ADDRESS_BYTE_LENGTH * 2);
        data.writeAddress(currentAuthority);
        data.writeAddress(pendingAuthority);

        super('PegAuthorityTransferStarted', data);
    }
}

@final
export class PegAuthorityTransferredEvent extends NetEvent {
    constructor(previousAuthority: Address, newAuthority: Address) {
        const data: BytesWriter = new BytesWriter(ADDRESS_BYTE_LENGTH * 2);
        data.writeAddress(previousAuthority);
        data.writeAddress(newAuthority);

        super('PegAuthorityTransferred', data);
    }
}

@final
export class PegAuthorityRenouncedEvent extends NetEvent {
    constructor(previousAuthority: Address) {
        const data: BytesWriter = new BytesWriter(ADDRESS_BYTE_LENGTH);
        data.writeAddress(previousAuthority);

        super('PegAuthorityRenounced', data);
    }
}

@final
export class MaxStalenessUpdatedEvent extends NetEvent {
    constructor(oldStaleness: u64, newStaleness: u64) {
        const data: BytesWriter = new BytesWriter(U64_BYTE_LENGTH * 2);
        data.writeU64(oldStaleness);
        data.writeU64(newStaleness);

        super('MaxStalenessUpdated', data);
    }
}

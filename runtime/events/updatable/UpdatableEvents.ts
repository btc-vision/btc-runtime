import { NetEvent } from '../NetEvent';
import { BytesWriter } from '../../buffer/BytesWriter';
import { Address } from '../../types/Address';
import { ADDRESS_BYTE_LENGTH } from '../../utils';

/**
 * Event emitted when an update is submitted for timelock.
 */
export class UpdateSubmittedEvent extends NetEvent {
    constructor(sourceAddress: Address, submitBlock: u64, effectiveBlock: u64) {
        const data = new BytesWriter(ADDRESS_BYTE_LENGTH + 16);
        data.writeAddress(sourceAddress);
        data.writeU64(submitBlock);
        data.writeU64(effectiveBlock);
        super('UpdateSubmitted', data);
    }
}

/**
 * Event emitted when an update is applied.
 */
export class UpdateAppliedEvent extends NetEvent {
    constructor(sourceAddress: Address, appliedAtBlock: u64) {
        const data = new BytesWriter(ADDRESS_BYTE_LENGTH + 8);
        data.writeAddress(sourceAddress);
        data.writeU64(appliedAtBlock);
        super('UpdateApplied', data);
    }
}

/**
 * Event emitted when a pending update is cancelled.
 */
export class UpdateCancelledEvent extends NetEvent {
    constructor(sourceAddress: Address, cancelledAtBlock: u64) {
        const data = new BytesWriter(ADDRESS_BYTE_LENGTH + 8);
        data.writeAddress(sourceAddress);
        data.writeU64(cancelledAtBlock);
        super('UpdateCancelled', data);
    }
}

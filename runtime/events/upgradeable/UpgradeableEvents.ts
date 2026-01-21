import { NetEvent } from '../NetEvent';
import { BytesWriter } from '../../buffer/BytesWriter';
import { Address } from '../../types/Address';
import { ADDRESS_BYTE_LENGTH } from '../../utils';

/**
 * Event emitted when an upgrade is submitted for timelock.
 */
export class UpgradeSubmittedEvent extends NetEvent {
    constructor(sourceAddress: Address, submitBlock: u64, effectiveBlock: u64) {
        const data = new BytesWriter(ADDRESS_BYTE_LENGTH + 16);
        data.writeAddress(sourceAddress);
        data.writeU64(submitBlock);
        data.writeU64(effectiveBlock);
        super('UpgradeSubmitted', data);
    }
}

/**
 * Event emitted when an upgrade is applied.
 */
export class UpgradeAppliedEvent extends NetEvent {
    constructor(sourceAddress: Address, appliedAtBlock: u64) {
        const data = new BytesWriter(ADDRESS_BYTE_LENGTH + 8);
        data.writeAddress(sourceAddress);
        data.writeU64(appliedAtBlock);
        super('UpgradeApplied', data);
    }
}

/**
 * Event emitted when a pending upgrade is cancelled.
 */
export class UpgradeCancelledEvent extends NetEvent {
    constructor(sourceAddress: Address, cancelledAtBlock: u64) {
        const data = new BytesWriter(ADDRESS_BYTE_LENGTH + 8);
        data.writeAddress(sourceAddress);
        data.writeU64(cancelledAtBlock);
        super('UpgradeCancelled', data);
    }
}

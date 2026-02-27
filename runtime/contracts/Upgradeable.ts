import { u256 } from '@btc-vision/as-bignum/assembly';
import { Blockchain } from '../env';
import { OP_NET } from './OP_NET';
import { StoredAddress } from '../storage/StoredAddress';
import { StoredU256 } from '../storage/StoredU256';
import { Address } from '../types/Address';
import { Revert } from '../types/Revert';
import { BytesWriter } from '../buffer/BytesWriter';
import { EMPTY_POINTER } from '../math/bytes';
import {
    UpdateAppliedEvent,
    UpdateCancelledEvent,
    UpdateSubmittedEvent,
} from '../events/upgradeable/UpgradeableEvents';

const pendingUpdateAddressPointer: u16 = Blockchain.nextPointer;
const pendingUpdateBlockPointer: u16 = Blockchain.nextPointer;

/**
 * Upgradeable - Base contract for upgradeable contracts with timelock protection.
 *
 * This contract provides a secure update mechanism with a configurable delay period.
 * The pattern prevents instant malicious updates by requiring:
 * 1. submitUpdate() - Submit the source contract address, starts the timelock
 * 2. Wait for the delay period to pass
 * 3. applyUpdate() - Apply the update after the delay
 *
 * Users can monitor for UpdateSubmitted events and exit if they distrust pending changes.
 *
 * @example
 * ```typescript
 * @final
 * export class MyUpgradeableContract extends Upgradeable {
 *     // Set a 24-hour delay (144 blocks at 10 min/block)
 *     protected readonly updateDelay: u64 = 144;
 *
 *     public override execute(method: Selector, calldata: Calldata): BytesWriter {
 *         switch (method) {
 *             case encodeSelector('submitUpdate'):
 *                 return this.submitUpdate(calldata.readAddress());
 *             case encodeSelector('applyUpdate'):
 *                 const sourceAddress = calldata.readAddress();
 *                 const updateCalldata = calldata.readBytesWithLength();
 *                 return this.applyUpdate(sourceAddress, updateCalldata);
 *             case encodeSelector('cancelUpdate'):
 *                 return this.cancelUpdate();
 *             default:
 *                 return super.execute(method, calldata);
 *         }
 *     }
 * }
 * ```
 */
export class Upgradeable extends OP_NET {
    /**
     * The pending update source address.
     * Zero address means no pending update.
     */
    protected readonly _pendingUpdateAddress: StoredAddress;

    /**
     * The block number when the update was submitted.
     * Stored as u256, used as u64.
     */
    protected readonly _pendingUpdateBlock: StoredU256;

    /**
     * The number of blocks to wait before an update can be applied.
     * Override this in derived contracts to set the delay.
     *
     * Common values:
     * - 6 blocks = ~1 hour
     * - 144 blocks = ~24 hours
     * - 1008 blocks = ~1 week
     */
    protected readonly updateDelay: u64 = 144; // ~24 hours default

    protected constructor() {
        super();
        this._pendingUpdateAddress = new StoredAddress(pendingUpdateAddressPointer);
        this._pendingUpdateBlock = new StoredU256(pendingUpdateBlockPointer, EMPTY_POINTER);
    }

    /**
     * Returns the pending update source address.
     * Returns zero address if no update is pending.
     */
    public get pendingUpdateAddress(): Address {
        return this._pendingUpdateAddress.value;
    }

    /**
     * Returns the block number when the pending update was submitted.
     * Returns 0 if no update is pending.
     */
    public get pendingUpdateBlock(): u64 {
        return this._pendingUpdateBlock.value.lo1;
    }

    /**
     * Returns the block number when the pending update can be applied.
     * Returns 0 if no update is pending.
     */
    public get updateEffectiveBlock(): u64 {
        const submitBlock = this.pendingUpdateBlock;
        if (submitBlock === 0) return 0;
        return submitBlock + this.updateDelay;
    }

    /**
     * Returns true if there is a pending update.
     */
    public get hasPendingUpdate(): bool {
        return this.pendingUpdateBlock !== 0;
    }

    /**
     * Returns true if the pending update can be applied (delay has passed).
     */
    public get canApplyUpdate(): bool {
        if (!this.hasPendingUpdate) return false;
        return Blockchain.block.number >= this.updateEffectiveBlock;
    }

    /**
     * Submits an update for timelock.
     *
     * The source address must be a deployed contract containing the new bytecode.
     * After submission, the update can only be applied after updateDelay blocks.
     *
     * Emits UpdateSubmitted event.
     *
     * @param sourceAddress - The source contract address containing new bytecode
     * @returns Empty response
     * @throws If caller is not deployer
     * @throws If source is not a deployed contract
     * @throws If an update is already pending
     */
    protected submitUpdate(sourceAddress: Address): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);

        // Check no pending update
        if (this.hasPendingUpdate) {
            throw new Revert('Update already pending. Cancel first.');
        }

        // Validate source is a deployed contract
        if (!Blockchain.isContract(sourceAddress)) {
            throw new Revert('Source must be a deployed contract');
        }

        // Store pending update
        const currentBlock = Blockchain.block.number;
        this._pendingUpdateAddress.value = sourceAddress;
        this._pendingUpdateBlock.value = u256.fromU64(currentBlock);

        // Emit event
        const effectiveBlock = currentBlock + this.updateDelay;
        Blockchain.emit(new UpdateSubmittedEvent(sourceAddress, currentBlock, effectiveBlock));

        return new BytesWriter(0);
    }

    /**
     * Applies a pending update after the timelock period has passed.
     *
     * The provided address must match the pending update address as an
     * additional security measure against front-running attacks.
     *
     * Emits UpdateApplied event before the update (new bytecode takes effect next block).
     *
     * @param sourceAddress - The source contract address (must match pending)
     * @param calldata - The calldata to pass to onUpdate method of the new contract
     * @returns Empty response
     * @throws If caller is not deployer
     * @throws If no update is pending
     * @throws If delay has not passed
     * @throws If provided address does not match pending
     */
    protected applyUpdate(sourceAddress: Address, calldata: BytesWriter): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);

        // Check pending update exists
        if (!this.hasPendingUpdate) {
            throw new Revert('No pending update');
        }

        // Check delay has passed
        if (!this.canApplyUpdate) {
            throw new Revert('Update delay not elapsed');
        }

        // Verify address matches pending
        if (!sourceAddress.equals(this._pendingUpdateAddress.value)) {
            throw new Revert('Address does not match pending update');
        }

        // Clear pending state before update
        this._pendingUpdateAddress.value = Address.zero();
        this._pendingUpdateBlock.value = u256.Zero;

        // Emit event
        Blockchain.emit(new UpdateAppliedEvent(sourceAddress, Blockchain.block.number));

        // Perform update - new bytecode takes effect next block
        Blockchain.updateContractFromExisting(sourceAddress, calldata);

        return new BytesWriter(0);
    }

    /**
     * Cancels a pending update.
     *
     * Can only be called by the deployer. Clears the pending update state.
     *
     * Emits UpdateCancelled event.
     *
     * @returns Empty response
     * @throws If caller is not deployer
     * @throws If no update is pending
     */
    protected cancelUpdate(): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);

        // Check pending update exists
        if (!this.hasPendingUpdate) {
            throw new Revert('No pending update');
        }

        const pendingAddress = this._pendingUpdateAddress.value;

        // Clear pending state
        this._pendingUpdateAddress.value = Address.zero();
        this._pendingUpdateBlock.value = u256.Zero;

        // Emit event
        Blockchain.emit(new UpdateCancelledEvent(pendingAddress, Blockchain.block.number));

        return new BytesWriter(0);
    }
}

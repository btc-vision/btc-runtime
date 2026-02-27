import { u256 } from '@btc-vision/as-bignum/assembly';
import { Blockchain } from '../env';
import { Plugin } from './Plugin';
import { StoredAddress } from '../storage/StoredAddress';
import { StoredU256 } from '../storage/StoredU256';
import { Address } from '../types/Address';
import { Revert } from '../types/Revert';
import { BytesWriter } from '../buffer/BytesWriter';
import { encodeSelector, Selector } from '../math/abi';
import { ADDRESS_BYTE_LENGTH } from '../utils';
import { Calldata } from '../types';
import { EMPTY_POINTER } from '../math/bytes';
import {
    UpdateAppliedEvent,
    UpdateCancelledEvent,
    UpdateSubmittedEvent,
} from '../events/upgradeable/UpgradeableEvents';

/**
 * UpgradeablePlugin - Plugin for upgradeable contracts with timelock protection.
 *
 * This plugin provides a secure update mechanism with a configurable delay period.
 * Unlike extending the Upgradeable base class, this plugin can be added to any contract.
 *
 * The pattern prevents instant malicious updates by requiring:
 * 1. submitUpdate() - Submit the source contract address, starts the timelock
 * 2. Wait for the delay period to pass
 * 3. applyUpdate() - Apply the update after the delay
 *
 * @example
 * ```typescript
 * @final
 * export class MyContract extends OP_NET {
 *     public constructor() {
 *         super();
 *         // 144 blocks = ~24 hours
 *         this.registerPlugin(new UpgradeablePlugin(144));
 *     }
 *
 *     // No need to modify execute() - the plugin handles update methods automatically!
 * }
 * ```
 */
export class UpgradeablePlugin extends Plugin {
    private readonly _pendingUpdateAddress: StoredAddress;
    private readonly _pendingUpdateBlock: StoredU256;
    private readonly _updateDelay: u64;

    /**
     * Creates a new UpgradeablePlugin.
     *
     * @param updateDelay - Number of blocks to wait before update can be applied.
     *                       Default: 144 blocks (~24 hours)
     *                       Common values:
     *                       - 6 blocks = ~1 hour
     *                       - 144 blocks = ~24 hours
     *                       - 1008 blocks = ~1 week
     * @param addressPointer - Storage pointer for pending update address
     * @param blockPointer - Storage pointer for pending update block
     */
    public constructor(
        updateDelay: u64 = 144,
        addressPointer: u16 = Blockchain.nextPointer,
        blockPointer: u16 = Blockchain.nextPointer,
    ) {
        super();
        this._updateDelay = updateDelay;
        this._pendingUpdateAddress = new StoredAddress(addressPointer);
        this._pendingUpdateBlock = new StoredU256(blockPointer, EMPTY_POINTER);
    }

    // Method selectors
    public static get SUBMIT_UPDATE_SELECTOR(): Selector {
        return encodeSelector('submitUpdate(address)');
    }

    public static get APPLY_UPDATE_SELECTOR(): Selector {
        return encodeSelector('applyUpdate(address,bytes)');
    }

    public static get CANCEL_UPDATE_SELECTOR(): Selector {
        return encodeSelector('cancelUpdate()');
    }

    public static get PENDING_UPDATE_SELECTOR(): Selector {
        return encodeSelector('pendingUpdate()');
    }

    public static get UPDATE_DELAY_SELECTOR(): Selector {
        return encodeSelector('updateDelay()');
    }

    /**
     * Returns the pending update source address.
     */
    public get pendingUpdateAddress(): Address {
        return this._pendingUpdateAddress.value;
    }

    /**
     * Returns the block number when the pending update was submitted.
     */
    public get pendingUpdateBlock(): u64 {
        return this._pendingUpdateBlock.value.lo1;
    }

    /**
     * Returns the configured update delay in blocks.
     */
    public get updateDelay(): u64 {
        return this._updateDelay;
    }

    /**
     * Returns the block number when the pending update can be applied.
     */
    public get updateEffectiveBlock(): u64 {
        const submitBlock = this.pendingUpdateBlock;
        if (submitBlock === 0) return 0;
        return submitBlock + this._updateDelay;
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
     * Attempts to execute an update-related method.
     * Returns the response if the method was handled, or null if not.
     *
     * @param method - The method selector
     * @param calldata - The calldata
     * @returns BytesWriter response if handled, null otherwise
     */
    public override execute(method: Selector, calldata: Calldata): BytesWriter | null {
        switch (method) {
            case UpgradeablePlugin.SUBMIT_UPDATE_SELECTOR:
                return this.submitUpdate(calldata);
            case UpgradeablePlugin.APPLY_UPDATE_SELECTOR:
                return this.applyUpdate(calldata);
            case UpgradeablePlugin.CANCEL_UPDATE_SELECTOR:
                return this.cancelUpdate();
            case UpgradeablePlugin.PENDING_UPDATE_SELECTOR:
                return this.getPendingUpdate();
            case UpgradeablePlugin.UPDATE_DELAY_SELECTOR:
                return this.getUpdateDelay();
            default:
                return null;
        }
    }

    /**
     * Submits an update for timelock.
     */
    private submitUpdate(calldata: Calldata): BytesWriter {
        this.onlyDeployer();

        if (this.hasPendingUpdate) {
            throw new Revert('Update already pending. Cancel first.');
        }

        const sourceAddress = calldata.readAddress();

        if (!Blockchain.isContract(sourceAddress)) {
            throw new Revert('Source must be a deployed contract');
        }

        const currentBlock = Blockchain.block.number;
        this._pendingUpdateAddress.value = sourceAddress;
        this._pendingUpdateBlock.value = u256.fromU64(currentBlock);

        const effectiveBlock = currentBlock + this._updateDelay;
        Blockchain.emit(new UpdateSubmittedEvent(sourceAddress, currentBlock, effectiveBlock));

        return new BytesWriter(0);
    }

    /**
     * Applies a pending update after the timelock period has passed.
     * Any remaining calldata after the source address is passed to onUpdate.
     */
    private applyUpdate(calldata: Calldata): BytesWriter {
        this.onlyDeployer();

        if (!this.hasPendingUpdate) {
            throw new Revert('No pending update');
        }

        if (!this.canApplyUpdate) {
            throw new Revert('Update delay not elapsed');
        }

        const sourceAddress = calldata.readAddress();
        const pendingAddress = this._pendingUpdateAddress.value;

        if (!sourceAddress.equals(pendingAddress)) {
            throw new Revert('Address does not match pending update');
        }

        // Clear pending state before update
        this._pendingUpdateAddress.value = Address.zero();
        this._pendingUpdateBlock.value = u256.Zero;

        Blockchain.emit(new UpdateAppliedEvent(sourceAddress, Blockchain.block.number));

        const updateCalldata = calldata.readBytesWithLength();

        const writer = new BytesWriter(updateCalldata.byteLength)
        writer.writeBytes(updateCalldata);

        // Perform update - new bytecode takes effect next block
        Blockchain.updateContractFromExisting(sourceAddress, writer);

        return new BytesWriter(0);
    }

    /**
     * Cancels a pending update.
     */
    private cancelUpdate(): BytesWriter {
        this.onlyDeployer();

        if (!this.hasPendingUpdate) {
            throw new Revert('No pending update');
        }

        const pendingAddress = this._pendingUpdateAddress.value;

        this._pendingUpdateAddress.value = Address.zero();
        this._pendingUpdateBlock.value = u256.Zero;

        Blockchain.emit(new UpdateCancelledEvent(pendingAddress, Blockchain.block.number));

        return new BytesWriter(0);
    }

    /**
     * Returns the pending update info.
     */
    private getPendingUpdate(): BytesWriter {
        const response = new BytesWriter(ADDRESS_BYTE_LENGTH + 16);
        response.writeAddress(this._pendingUpdateAddress.value);
        response.writeU64(this.pendingUpdateBlock);
        response.writeU64(this.updateEffectiveBlock);
        return response;
    }

    /**
     * Returns the update delay.
     */
    private getUpdateDelay(): BytesWriter {
        const response = new BytesWriter(8);
        response.writeU64(this._updateDelay);
        return response;
    }

    /**
     * Validates that the caller is the contract deployer.
     */
    private onlyDeployer(): void {
        if (Blockchain.contractDeployer !== Blockchain.tx.sender) {
            throw new Revert('Only deployer can call this method');
        }
    }
}

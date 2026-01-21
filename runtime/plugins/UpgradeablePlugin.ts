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
    UpgradeAppliedEvent,
    UpgradeCancelledEvent,
    UpgradeSubmittedEvent,
} from '../events/upgradeable/UpgradeableEvents';

/**
 * UpgradeablePlugin - Plugin for upgradeable contracts with timelock protection.
 *
 * This plugin provides a secure upgrade mechanism with a configurable delay period.
 * Unlike extending the Upgradeable base class, this plugin can be added to any contract.
 *
 * The pattern prevents instant malicious upgrades by requiring:
 * 1. submitUpgrade() - Submit the source contract address, starts the timelock
 * 2. Wait for the delay period to pass
 * 3. applyUpgrade() - Apply the upgrade after the delay
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
 *     // No need to modify execute() - the plugin handles upgrade methods automatically!
 * }
 * ```
 */
export class UpgradeablePlugin extends Plugin {
    private readonly _pendingUpgradeAddress: StoredAddress;
    private readonly _pendingUpgradeBlock: StoredU256;
    private readonly _upgradeDelay: u64;

    /**
     * Creates a new UpgradeablePlugin.
     *
     * @param upgradeDelay - Number of blocks to wait before upgrade can be applied.
     *                       Default: 144 blocks (~24 hours)
     *                       Common values:
     *                       - 6 blocks = ~1 hour
     *                       - 144 blocks = ~24 hours
     *                       - 1008 blocks = ~1 week
     * @param addressPointer - Storage pointer for pending upgrade address
     * @param blockPointer - Storage pointer for pending upgrade block
     */
    public constructor(
        upgradeDelay: u64 = 144,
        addressPointer: u16 = Blockchain.nextPointer,
        blockPointer: u16 = Blockchain.nextPointer,
    ) {
        super();
        this._upgradeDelay = upgradeDelay;
        this._pendingUpgradeAddress = new StoredAddress(addressPointer);
        this._pendingUpgradeBlock = new StoredU256(blockPointer, EMPTY_POINTER);
    }

    // Method selectors
    public static get SUBMIT_UPGRADE_SELECTOR(): Selector {
        return encodeSelector('submitUpgrade(address)');
    }

    public static get APPLY_UPGRADE_SELECTOR(): Selector {
        return encodeSelector('applyUpgrade(address)');
    }

    public static get CANCEL_UPGRADE_SELECTOR(): Selector {
        return encodeSelector('cancelUpgrade()');
    }

    public static get PENDING_UPGRADE_SELECTOR(): Selector {
        return encodeSelector('pendingUpgrade()');
    }

    public static get UPGRADE_DELAY_SELECTOR(): Selector {
        return encodeSelector('upgradeDelay()');
    }

    /**
     * Returns the pending upgrade source address.
     */
    public get pendingUpgradeAddress(): Address {
        return this._pendingUpgradeAddress.value;
    }

    /**
     * Returns the block number when the pending upgrade was submitted.
     */
    public get pendingUpgradeBlock(): u64 {
        return this._pendingUpgradeBlock.value.lo1;
    }

    /**
     * Returns the configured upgrade delay in blocks.
     */
    public get upgradeDelay(): u64 {
        return this._upgradeDelay;
    }

    /**
     * Returns the block number when the pending upgrade can be applied.
     */
    public get upgradeEffectiveBlock(): u64 {
        const submitBlock = this.pendingUpgradeBlock;
        if (submitBlock === 0) return 0;
        return submitBlock + this._upgradeDelay;
    }

    /**
     * Returns true if there is a pending upgrade.
     */
    public get hasPendingUpgrade(): bool {
        return this.pendingUpgradeBlock !== 0;
    }

    /**
     * Returns true if the pending upgrade can be applied (delay has passed).
     */
    public get canApplyUpgrade(): bool {
        if (!this.hasPendingUpgrade) return false;
        return Blockchain.block.number >= this.upgradeEffectiveBlock;
    }

    /**
     * Attempts to execute an upgrade-related method.
     * Returns the response if the method was handled, or null if not.
     *
     * @param method - The method selector
     * @param calldata - The calldata
     * @returns BytesWriter response if handled, null otherwise
     */
    public override execute(method: Selector, calldata: Calldata): BytesWriter | null {
        switch (method) {
            case UpgradeablePlugin.SUBMIT_UPGRADE_SELECTOR:
                return this.submitUpgrade(calldata);
            case UpgradeablePlugin.APPLY_UPGRADE_SELECTOR:
                return this.applyUpgrade(calldata);
            case UpgradeablePlugin.CANCEL_UPGRADE_SELECTOR:
                return this.cancelUpgrade();
            case UpgradeablePlugin.PENDING_UPGRADE_SELECTOR:
                return this.getPendingUpgrade();
            case UpgradeablePlugin.UPGRADE_DELAY_SELECTOR:
                return this.getUpgradeDelay();
            default:
                return null;
        }
    }

    /**
     * Submits an upgrade for timelock.
     */
    private submitUpgrade(calldata: Calldata): BytesWriter {
        this.onlyDeployer();

        if (this.hasPendingUpgrade) {
            throw new Revert('Upgrade already pending. Cancel first.');
        }

        const sourceAddress = calldata.readAddress();

        if (!Blockchain.isContract(sourceAddress)) {
            throw new Revert('Source must be a deployed contract');
        }

        const currentBlock = Blockchain.block.number;
        this._pendingUpgradeAddress.value = sourceAddress;
        this._pendingUpgradeBlock.value = u256.fromU64(currentBlock);

        const effectiveBlock = currentBlock + this._upgradeDelay;
        Blockchain.emit(new UpgradeSubmittedEvent(sourceAddress, currentBlock, effectiveBlock));

        return new BytesWriter(0);
    }

    /**
     * Applies a pending upgrade after the timelock period has passed.
     * Any remaining calldata after the source address is passed to onUpdate.
     */
    private applyUpgrade(calldata: Calldata): BytesWriter {
        this.onlyDeployer();

        if (!this.hasPendingUpgrade) {
            throw new Revert('No pending upgrade');
        }

        if (!this.canApplyUpgrade) {
            throw new Revert('Upgrade delay not elapsed');
        }

        const sourceAddress = calldata.readAddress();
        const pendingAddress = this._pendingUpgradeAddress.value;

        if (!sourceAddress.equals(pendingAddress)) {
            throw new Revert('Address does not match pending upgrade');
        }

        // Clear pending state before upgrade
        this._pendingUpgradeAddress.value = Address.zero();
        this._pendingUpgradeBlock.value = u256.Zero;

        Blockchain.emit(new UpgradeAppliedEvent(sourceAddress, Blockchain.block.number));

        // Extract remaining calldata for onUpdate
        const remainingLength = calldata.byteLength - calldata.getOffset();
        const updateCalldata = new BytesWriter(remainingLength);
        if (remainingLength > 0) {
            const remainingBytes = calldata.readBytes(remainingLength);
            updateCalldata.writeBytes(remainingBytes);
        }

        // Perform upgrade - new bytecode takes effect next block
        Blockchain.updateContractFromExisting(sourceAddress, updateCalldata);

        return new BytesWriter(0);
    }

    /**
     * Cancels a pending upgrade.
     */
    private cancelUpgrade(): BytesWriter {
        this.onlyDeployer();

        if (!this.hasPendingUpgrade) {
            throw new Revert('No pending upgrade');
        }

        const pendingAddress = this._pendingUpgradeAddress.value;

        this._pendingUpgradeAddress.value = Address.zero();
        this._pendingUpgradeBlock.value = u256.Zero;

        Blockchain.emit(new UpgradeCancelledEvent(pendingAddress, Blockchain.block.number));

        return new BytesWriter(0);
    }

    /**
     * Returns the pending upgrade info.
     */
    private getPendingUpgrade(): BytesWriter {
        const response = new BytesWriter(ADDRESS_BYTE_LENGTH + 16);
        response.writeAddress(this._pendingUpgradeAddress.value);
        response.writeU64(this.pendingUpgradeBlock);
        response.writeU64(this.upgradeEffectiveBlock);
        return response;
    }

    /**
     * Returns the upgrade delay.
     */
    private getUpgradeDelay(): BytesWriter {
        const response = new BytesWriter(8);
        response.writeU64(this._upgradeDelay);
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

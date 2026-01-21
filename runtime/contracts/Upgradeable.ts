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
    UpgradeAppliedEvent,
    UpgradeCancelledEvent,
    UpgradeSubmittedEvent,
} from '../events/upgradeable/UpgradeableEvents';

const pendingUpgradeAddressPointer: u16 = Blockchain.nextPointer;
const pendingUpgradeBlockPointer: u16 = Blockchain.nextPointer;

/**
 * Upgradeable - Base contract for upgradeable contracts with timelock protection.
 *
 * This contract provides a secure upgrade mechanism with a configurable delay period.
 * The pattern prevents instant malicious upgrades by requiring:
 * 1. submitUpgrade() - Submit the source contract address, starts the timelock
 * 2. Wait for the delay period to pass
 * 3. applyUpgrade() - Apply the upgrade after the delay
 *
 * Users can monitor for UpgradeSubmitted events and exit if they distrust pending changes.
 *
 * @example
 * ```typescript
 * @final
 * export class MyUpgradeableContract extends Upgradeable {
 *     // Set a 24-hour delay (144 blocks at 10 min/block)
 *     protected readonly upgradeDelay: u64 = 144;
 *
 *     public override execute(method: Selector, calldata: Calldata): BytesWriter {
 *         switch (method) {
 *             case encodeSelector('submitUpgrade'):
 *                 return this.submitUpgrade(calldata.readAddress());
 *             case encodeSelector('applyUpgrade'):
 *                 const sourceAddress = calldata.readAddress();
 *                 const updateCalldata = new BytesWriter(calldata.byteLength - ADDRESS_BYTE_LENGTH);
 *                 // Copy remaining calldata for onUpdate
 *                 return this.applyUpgrade(sourceAddress, updateCalldata);
 *             case encodeSelector('cancelUpgrade'):
 *                 return this.cancelUpgrade();
 *             default:
 *                 return super.execute(method, calldata);
 *         }
 *     }
 * }
 * ```
 */
export class Upgradeable extends OP_NET {
    /**
     * The pending upgrade source address.
     * Zero address means no pending upgrade.
     */
    protected readonly _pendingUpgradeAddress: StoredAddress;

    /**
     * The block number when the upgrade was submitted.
     * Stored as u256, used as u64.
     */
    protected readonly _pendingUpgradeBlock: StoredU256;

    /**
     * The number of blocks to wait before an upgrade can be applied.
     * Override this in derived contracts to set the delay.
     *
     * Common values:
     * - 6 blocks = ~1 hour
     * - 144 blocks = ~24 hours
     * - 1008 blocks = ~1 week
     */
    protected readonly upgradeDelay: u64 = 144; // ~24 hours default

    protected constructor() {
        super();
        this._pendingUpgradeAddress = new StoredAddress(pendingUpgradeAddressPointer);
        this._pendingUpgradeBlock = new StoredU256(pendingUpgradeBlockPointer, EMPTY_POINTER);
    }

    /**
     * Returns the pending upgrade source address.
     * Returns zero address if no upgrade is pending.
     */
    public get pendingUpgradeAddress(): Address {
        return this._pendingUpgradeAddress.value;
    }

    /**
     * Returns the block number when the pending upgrade was submitted.
     * Returns 0 if no upgrade is pending.
     */
    public get pendingUpgradeBlock(): u64 {
        return this._pendingUpgradeBlock.value.lo1;
    }

    /**
     * Returns the block number when the pending upgrade can be applied.
     * Returns 0 if no upgrade is pending.
     */
    public get upgradeEffectiveBlock(): u64 {
        const submitBlock = this.pendingUpgradeBlock;
        if (submitBlock === 0) return 0;
        return submitBlock + this.upgradeDelay;
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
     * Submits an upgrade for timelock.
     *
     * The source address must be a deployed contract containing the new bytecode.
     * After submission, the upgrade can only be applied after upgradeDelay blocks.
     *
     * Emits UpgradeSubmitted event.
     *
     * @param sourceAddress - The source contract address containing new bytecode
     * @returns Empty response
     * @throws If caller is not deployer
     * @throws If source is not a deployed contract
     * @throws If an upgrade is already pending
     */
    protected submitUpgrade(sourceAddress: Address): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);

        // Check no pending upgrade
        if (this.hasPendingUpgrade) {
            throw new Revert('Upgrade already pending. Cancel first.');
        }

        // Validate source is a deployed contract
        if (!Blockchain.isContract(sourceAddress)) {
            throw new Revert('Source must be a deployed contract');
        }

        // Store pending upgrade
        const currentBlock = Blockchain.block.number;
        this._pendingUpgradeAddress.value = sourceAddress;
        this._pendingUpgradeBlock.value = u256.fromU64(currentBlock);

        // Emit event
        const effectiveBlock = currentBlock + this.upgradeDelay;
        Blockchain.emit(new UpgradeSubmittedEvent(sourceAddress, currentBlock, effectiveBlock));

        return new BytesWriter(0);
    }

    /**
     * Applies a pending upgrade after the timelock period has passed.
     *
     * The provided address must match the pending upgrade address as an
     * additional security measure against front-running attacks.
     *
     * Emits UpgradeApplied event before the upgrade (new bytecode takes effect next block).
     *
     * @param sourceAddress - The source contract address (must match pending)
     * @param calldata - The calldata to pass to onUpdate method of the new contract
     * @returns Empty response
     * @throws If caller is not deployer
     * @throws If no upgrade is pending
     * @throws If delay has not passed
     * @throws If provided address does not match pending
     */
    protected applyUpgrade(sourceAddress: Address, calldata: BytesWriter): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);

        // Check pending upgrade exists
        if (!this.hasPendingUpgrade) {
            throw new Revert('No pending upgrade');
        }

        // Check delay has passed
        if (!this.canApplyUpgrade) {
            throw new Revert('Upgrade delay not elapsed');
        }

        // Verify address matches pending
        if (!sourceAddress.equals(this._pendingUpgradeAddress.value)) {
            throw new Revert('Address does not match pending upgrade');
        }

        // Clear pending state before upgrade
        this._pendingUpgradeAddress.value = Address.zero();
        this._pendingUpgradeBlock.value = u256.Zero;

        // Emit event
        Blockchain.emit(new UpgradeAppliedEvent(sourceAddress, Blockchain.block.number));

        // Perform upgrade - new bytecode takes effect next block
        Blockchain.updateContractFromExisting(sourceAddress, calldata);

        return new BytesWriter(0);
    }

    /**
     * Cancels a pending upgrade.
     *
     * Can only be called by the deployer. Clears the pending upgrade state.
     *
     * Emits UpgradeCancelled event.
     *
     * @returns Empty response
     * @throws If caller is not deployer
     * @throws If no upgrade is pending
     */
    protected cancelUpgrade(): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);

        // Check pending upgrade exists
        if (!this.hasPendingUpgrade) {
            throw new Revert('No pending upgrade');
        }

        const pendingAddress = this._pendingUpgradeAddress.value;

        // Clear pending state
        this._pendingUpgradeAddress.value = Address.zero();
        this._pendingUpgradeBlock.value = u256.Zero;

        // Emit event
        Blockchain.emit(new UpgradeCancelledEvent(pendingAddress, Blockchain.block.number));

        return new BytesWriter(0);
    }
}

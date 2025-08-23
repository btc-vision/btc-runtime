import { Blockchain } from '../env';
import { OP_NET } from './OP_NET';
import { StoredBoolean } from '../storage/StoredBoolean';
import { StoredU256 } from '../storage/StoredU256';
import { Selector } from '../math/abi';
import { Calldata } from '../types';
import { Revert } from '../types/Revert';
import { u256 } from '@btc-vision/as-bignum/assembly';
import { SafeMath } from '../types/SafeMath';
import {
    ON_OP1155_BATCH_RECEIVED_MAGIC,
    ON_OP1155_RECEIVED_MAGIC,
    ON_OP20_RECEIVED_SELECTOR,
    ON_OP721_RECEIVED_SELECTOR,
} from '../constants/Exports';
import { EMPTY_POINTER } from '../math/bytes';

const statusPointer: u16 = Blockchain.nextPointer;
const depthPointer: u16 = Blockchain.nextPointer;

/**
 * @enum ReentrancyLevel
 * @description
 * Defines the level of reentrancy protection.
 *
 * STANDARD: Strict single entry, no reentrancy allowed.
 * CALLBACK: Allows one level of reentrancy for callbacks (e.g., token transfers).
 */
export enum ReentrancyLevel {
    STANDARD = 0,
    CALLBACK = 1,
}

export class ReentrancyGuard extends OP_NET {
    protected readonly _locked: StoredBoolean;
    protected readonly _reentrancyDepth: StoredU256;

    // Override this in derived contracts to set protection level
    protected readonly reentrancyLevel: ReentrancyLevel = ReentrancyLevel.STANDARD;

    protected constructor() {
        super();
        this._locked = new StoredBoolean(statusPointer, false);
        this._reentrancyDepth = new StoredU256(depthPointer, EMPTY_POINTER);
    }

    public override onExecutionCompleted(selector: Selector, calldata: Calldata): void {
        super.onExecutionCompleted(selector, calldata);

        if (this.isSelectorExcluded(selector)) {
            return;
        }

        this.nonReentrantAfter();
    }

    public override onExecutionStarted(selector: Selector, calldata: Calldata): void {
        super.onExecutionStarted(selector, calldata);

        if (this.isSelectorExcluded(selector)) {
            return;
        }

        this.nonReentrantBefore();
    }

    public nonReentrantBefore(): void {
        if (this.reentrancyLevel === ReentrancyLevel.STANDARD) {
            // Standard behavior - strict single entry
            if (this._locked.value) {
                this.reentrancyGuardReentrantCall();
            }
            this._locked.value = true;
        } else if (this.reentrancyLevel === ReentrancyLevel.CALLBACK) {
            // Allow one level of reentrancy for callbacks
            const currentDepth = this._reentrancyDepth.value;

            // Maximum depth of 2 (original call + one callback reentry)
            if (currentDepth >= u256.One) {
                throw new Revert('ReentrancyGuard: Max depth exceeded');
            }

            this._reentrancyDepth.value = SafeMath.add(currentDepth, u256.One);

            // Use locked flag for first entry
            if (currentDepth.isZero()) {
                this._locked.value = true;
            }
        }
    }

    public nonReentrantAfter(): void {
        if (this.reentrancyLevel === ReentrancyLevel.STANDARD) {
            // Standard behavior
            this._locked.value = false;
        } else if (this.reentrancyLevel === ReentrancyLevel.CALLBACK) {
            // Decrement depth
            const currentDepth = this._reentrancyDepth.value;
            if (currentDepth.isZero()) {
                throw new Revert('ReentrancyGuard: Depth underflow');
            }

            const newDepth = SafeMath.sub(currentDepth, u256.One);
            this._reentrancyDepth.value = newDepth;

            // Clear locked flag when fully exited
            if (newDepth.isZero()) {
                this._locked.value = false;
            }
        }
    }

    public reentrancyGuardEntered(): boolean {
        return this._locked.value === true;
    }

    public getCurrentDepth(): u256 {
        return this._reentrancyDepth.value;
    }

    /**
     * @dev Unauthorized reentrant call.
     */
    protected reentrancyGuardReentrantCall(): void {
        throw new Revert('ReentrancyGuard: LOCKED');
    }

    protected isSelectorExcluded(selector: Selector): boolean {
        return (
            selector === ON_OP20_RECEIVED_SELECTOR ||
            selector === ON_OP721_RECEIVED_SELECTOR ||
            selector === ON_OP1155_RECEIVED_MAGIC ||
            selector === ON_OP1155_BATCH_RECEIVED_MAGIC
        );
    }
}

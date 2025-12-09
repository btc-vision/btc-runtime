import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { Calldata } from '../types';
import { Address } from '../types/Address';
import { Revert } from '../types/Revert';
import { StoredU256 } from '../storage/StoredU256';
import { EMPTY_POINTER } from '../math/bytes';
import { OP20 } from './OP20';
import { Selector } from '../math/abi';
import { AddressMemoryMap } from '../memory/AddressMemoryMap';
import {
    MaxStalenessUpdatedEvent,
    PegAuthorityRenouncedEvent,
    PegAuthorityTransferredEvent,
    PegAuthorityTransferStartedEvent,
    PegRateUpdatedEvent,
} from '../events/op20s/OP20SEvents';

// Selectors: sha256 first 4 bytes
export const PEG_RATE_SELECTOR: u32 = 0x4d1f6caf;
export const PEG_AUTHORITY_SELECTOR: u32 = 0xd767a583;
export const PEG_UPDATED_AT_SELECTOR: u32 = 0x1e99d1a1;
export const MAX_STALENESS_SELECTOR: u32 = 0x0b17a602;
export const IS_STALE_SELECTOR: u32 = 0x147c08ef;

const pegRatePointer: u16 = Blockchain.nextPointer;
const pegAuthorityPointer: u16 = Blockchain.nextPointer;
const pegUpdatedAtPointer: u16 = Blockchain.nextPointer;
const maxStalenessPointer: u16 = Blockchain.nextPointer;
const pendingAuthorityPointer: u16 = Blockchain.nextPointer;

export abstract class OP20S extends OP20 {
    protected readonly _pegRate: StoredU256;
    protected readonly _pegAuthorityMap: AddressMemoryMap;
    protected readonly _pegUpdatedAt: StoredU256;
    protected readonly _maxStaleness: StoredU256;
    protected readonly _pendingAuthorityMap: AddressMemoryMap;

    public constructor() {
        super();
        this._pegRate = new StoredU256(pegRatePointer, EMPTY_POINTER);
        this._pegAuthorityMap = new AddressMemoryMap(pegAuthorityPointer);
        this._pegUpdatedAt = new StoredU256(pegUpdatedAtPointer, EMPTY_POINTER);
        this._maxStaleness = new StoredU256(maxStalenessPointer, EMPTY_POINTER);
        this._pendingAuthorityMap = new AddressMemoryMap(pendingAuthorityPointer);
    }

    @method()
    @returns({ name: 'rate', type: ABIDataTypes.UINT256 })
    public pegRate(_: Calldata): BytesWriter {
        const w = new BytesWriter(32);
        w.writeU256(this._pegRate.value);
        return w;
    }

    @method()
    @returns({ name: 'authority', type: ABIDataTypes.ADDRESS })
    public pegAuthority(_: Calldata): BytesWriter {
        const w = new BytesWriter(32);
        w.writeAddress(this._getPegAuthority());
        return w;
    }

    @method()
    @returns({ name: 'updatedAt', type: ABIDataTypes.UINT64 })
    public pegUpdatedAt(_: Calldata): BytesWriter {
        const w = new BytesWriter(8);
        w.writeU64(this._pegUpdatedAt.value.toU64());
        return w;
    }

    @method()
    @returns({ name: 'staleness', type: ABIDataTypes.UINT64 })
    public maxStaleness(_: Calldata): BytesWriter {
        const w = new BytesWriter(8);
        w.writeU64(this._maxStaleness.value.toU64());
        return w;
    }

    @method()
    @returns({ name: 'stale', type: ABIDataTypes.BOOL })
    public isStale(_: Calldata): BytesWriter {
        const w = new BytesWriter(1);
        w.writeBoolean(this._isStale());
        return w;
    }

    @method({ name: 'newRate', type: ABIDataTypes.UINT256 })
    @emit('PegRateUpdated')
    public updatePegRate(calldata: Calldata): BytesWriter {
        this._onlyPegAuthority();

        const newRate = calldata.readU256();
        if (newRate.isZero()) {
            throw new Revert('Invalid peg rate');
        }

        const oldRate = this._pegRate.value;
        const blockNumber = Blockchain.block.number;

        this._pegRate.value = newRate;
        this._pegUpdatedAt.value = u256.fromU64(blockNumber);

        this.emitEvent(new PegRateUpdatedEvent(oldRate, newRate, blockNumber));

        return new BytesWriter(0);
    }

    @method({ name: 'newStaleness', type: ABIDataTypes.UINT64 })
    @emit('MaxStalenessUpdated')
    public updateMaxStaleness(calldata: Calldata): BytesWriter {
        this._onlyPegAuthority();

        const newStaleness = calldata.readU64();
        if (newStaleness == 0) {
            throw new Revert('Invalid max staleness');
        }

        const oldStaleness = this._maxStaleness.value.toU64();
        this._maxStaleness.value = u256.fromU64(newStaleness);

        this.emitEvent(new MaxStalenessUpdatedEvent(oldStaleness, newStaleness));

        return new BytesWriter(0);
    }

    @method({ name: 'newAuthority', type: ABIDataTypes.ADDRESS })
    @emit('PegAuthorityTransferStarted')
    public transferPegAuthority(calldata: Calldata): BytesWriter {
        this._onlyPegAuthority();

        const newAuthority = calldata.readAddress();
        if (newAuthority.equals(Address.zero())) {
            throw new Revert('Invalid new authority');
        }

        const currentAuthority = this._getPegAuthority();
        this._setPendingAuthority(newAuthority);

        this.emitEvent(new PegAuthorityTransferStartedEvent(currentAuthority, newAuthority));

        return new BytesWriter(0);
    }

    @method()
    @emit('PegAuthorityTransferred')
    public acceptPegAuthority(_: Calldata): BytesWriter {
        const pending = this._getPendingAuthority();
        if (pending.equals(Address.zero())) {
            throw new Revert('No pending authority');
        }
        if (!Blockchain.tx.sender.equals(pending)) {
            throw new Revert('Not pending authority');
        }

        const previousAuthority = this._getPegAuthority();
        this._setPegAuthority(pending);
        this._setPendingAuthority(Address.zero());

        this.emitEvent(new PegAuthorityTransferredEvent(previousAuthority, pending));

        return new BytesWriter(0);
    }

    @method()
    @emit('PegAuthorityRenounced')
    public renouncePegAuthority(_: Calldata): BytesWriter {
        this._onlyPegAuthority();

        const previousAuthority = this._getPegAuthority();
        this._setPegAuthority(Address.zero());
        this._setPendingAuthority(Address.zero());

        this.emitEvent(new PegAuthorityRenouncedEvent(previousAuthority));

        return new BytesWriter(0);
    }

    protected initializePeg(pegAuthority: Address, initialPegRate: u256, maxStaleness: u64): void {
        if (pegAuthority.equals(Address.zero())) {
            throw new Revert('Invalid peg authority');
        }
        if (initialPegRate.isZero()) {
            throw new Revert('Invalid initial peg rate');
        }
        if (maxStaleness == 0) {
            throw new Revert('Invalid max staleness');
        }

        this._setPegAuthority(pegAuthority);
        this._pegRate.value = initialPegRate;
        this._pegUpdatedAt.value = u256.fromU64(Blockchain.block.number);
        this._maxStaleness.value = u256.fromU64(maxStaleness);

        this.emitEvent(new PegRateUpdatedEvent(u256.Zero, initialPegRate, Blockchain.block.number));
    }

    protected _isStale(): boolean {
        const currentBlock = Blockchain.block.number;
        const updatedAt = this._pegUpdatedAt.value.toU64();
        const maxStale = this._maxStaleness.value.toU64();

        return currentBlock > updatedAt + maxStale;
    }

    protected _requireFreshPeg(): void {
        if (this._isStale()) {
            throw new Revert('Peg rate stale');
        }
    }

    protected _onlyPegAuthority(): void {
        if (!Blockchain.tx.sender.equals(this._getPegAuthority())) {
            throw new Revert('Not peg authority');
        }
    }

    protected _getPegAuthority(): Address {
        const stored = this._pegAuthorityMap.get(Address.zero());
        if (stored.isZero()) return Address.zero();
        return this._u256ToAddress(stored);
    }

    protected _setPegAuthority(addr: Address): void {
        this._pegAuthorityMap.set(Address.zero(), this._addressToU256(addr));
    }

    protected _getPendingAuthority(): Address {
        const stored = this._pendingAuthorityMap.get(Address.zero());
        if (stored.isZero()) return Address.zero();
        return this._u256ToAddress(stored);
    }

    protected _setPendingAuthority(addr: Address): void {
        this._pendingAuthorityMap.set(Address.zero(), this._addressToU256(addr));
    }

    protected _addressToU256(addr: Address): u256 {
        return u256.fromUint8ArrayBE(addr);
    }

    protected _u256ToAddress(val: u256): Address {
        if (val.isZero()) return Address.zero();
        const bytes = val.toUint8Array(true);
        return Address.fromUint8Array(bytes);
    }

    protected override isSelectorExcluded(selector: Selector): boolean {
        if (
            selector == PEG_RATE_SELECTOR ||
            selector == PEG_AUTHORITY_SELECTOR ||
            selector == PEG_UPDATED_AT_SELECTOR ||
            selector == MAX_STALENESS_SELECTOR ||
            selector == IS_STALE_SELECTOR
        ) {
            return true;
        }
        return super.isSelectorExcluded(selector);
    }
}

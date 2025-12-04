import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { Calldata } from '../types';
import { Address } from '../types/Address';
import { Revert } from '../types/Revert';
import { StoredU256 } from '../storage/StoredU256';
import { StoredAddress } from '../storage/StoredAddress';
import { EMPTY_POINTER } from '../math/bytes';
import { OP20 } from './OP20';
import { IOP20S } from './interfaces/IOP20S';
import { OP20InitParameters } from './interfaces/OP20InitParameters';
import { ADDRESS_BYTE_LENGTH, U256_BYTE_LENGTH, U64_BYTE_LENGTH } from '../utils';
import { Selector } from '../math/abi';

const pegRatePointer: u16 = Blockchain.nextPointer;
const pegAuthorityPointer: u16 = Blockchain.nextPointer;
const pegUpdatedAtPointer: u16 = Blockchain.nextPointer;
const maxStalenessPointer: u16 = Blockchain.nextPointer;
const pendingAuthorityPointer: u16 = Blockchain.nextPointer;

// "pegRate()"
export const PEG_RATE_SELECTOR: u32 = 0x4d1f6caf;

// "pegAuthority()"
export const PEG_AUTHORITY_SELECTOR: u32 = 0xd767a583;

// "pegUpdatedAt()"
export const PEG_UPDATED_AT_SELECTOR: u32 = 0x1e99d1a1;

// "maxStaleness()"
export const MAX_STALENESS_SELECTOR: u32 = 0x0b17a602;

// "isStale()"
export const IS_STALE_SELECTOR: u32 = 0x147c08ef;

export interface OP20SInitParameters extends OP20InitParameters {
    pegAuthority: Address;
    initialPegRate: u256;
    maxStaleness: u64;
}

export abstract class OP20S extends OP20 implements IOP20S {
    protected readonly _pegRate: StoredU256;
    protected readonly _pegAuthority: StoredAddress;
    protected readonly _pegUpdatedAt: StoredU256;
    protected readonly _maxStaleness: StoredU256;
    protected readonly _pendingAuthority: StoredAddress;

    public constructor() {
        super();
        this._pegRate = new StoredU256(pegRatePointer, EMPTY_POINTER);
        this._pegAuthority = new StoredAddress(pegAuthorityPointer);
        this._pegUpdatedAt = new StoredU256(pegUpdatedAtPointer, EMPTY_POINTER);
        this._maxStaleness = new StoredU256(maxStalenessPointer, EMPTY_POINTER);
        this._pendingAuthority = new StoredAddress(pendingAuthorityPointer);
    }

    public override instantiate(
        params: OP20SInitParameters,
        skipDeployerVerification: boolean = false,
    ): void {
        super.instantiate(params, skipDeployerVerification);

        if (params.pegAuthority === Address.zero()) {
            throw new Revert('Invalid peg authority');
        }
        if (params.initialPegRate.isZero()) {
            throw new Revert('Invalid initial peg rate');
        }
        if (params.maxStaleness === 0) {
            throw new Revert('Invalid max staleness');
        }

        this._pegAuthority.value = params.pegAuthority;
        this._pegRate.value = params.initialPegRate;
        this._pegUpdatedAt.value = u256.fromU64(Blockchain.block.number);
        this._maxStaleness.value = u256.fromU64(params.maxStaleness);
    }

    @method()
    @returns({ name: 'rate', type: ABIDataTypes.UINT256 })
    public pegRate(_: Calldata): BytesWriter {
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(this._pegRate.value);
        return w;
    }

    @method()
    @returns({ name: 'authority', type: ABIDataTypes.ADDRESS })
    public pegAuthority(_: Calldata): BytesWriter {
        const w = new BytesWriter(ADDRESS_BYTE_LENGTH);
        w.writeAddress(this._pegAuthority.value);
        return w;
    }

    @method()
    @returns({ name: 'updatedAt', type: ABIDataTypes.UINT64 })
    public pegUpdatedAt(_: Calldata): BytesWriter {
        const w = new BytesWriter(U64_BYTE_LENGTH);
        w.writeU64(this._pegUpdatedAt.value.toU64());
        return w;
    }

    @method()
    @returns({ name: 'staleness', type: ABIDataTypes.UINT64 })
    public maxStaleness(_: Calldata): BytesWriter {
        const w = new BytesWriter(U64_BYTE_LENGTH);
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
    public updatePegRate(calldata: Calldata): BytesWriter {
        this.onlyPegAuthority();

        const newRate = calldata.readU256();
        if (newRate.isZero()) {
            throw new Revert('Invalid peg rate');
        }

        this._pegRate.value = newRate;
        this._pegUpdatedAt.value = u256.fromU64(Blockchain.block.number);

        return new BytesWriter(0);
    }

    @method({ name: 'newStaleness', type: ABIDataTypes.UINT64 })
    public updateMaxStaleness(calldata: Calldata): BytesWriter {
        this.onlyPegAuthority();

        const newStaleness = calldata.readU64();
        if (newStaleness === 0) {
            throw new Revert('Invalid max staleness');
        }

        this._maxStaleness.value = u256.fromU64(newStaleness);

        return new BytesWriter(0);
    }

    @method({ name: 'newAuthority', type: ABIDataTypes.ADDRESS })
    public transferPegAuthority(calldata: Calldata): BytesWriter {
        this.onlyPegAuthority();

        const newAuthority = calldata.readAddress();
        if (newAuthority === Address.zero()) {
            throw new Revert('Invalid new authority');
        }

        this._pendingAuthority.value = newAuthority;

        return new BytesWriter(0);
    }

    @method()
    public acceptPegAuthority(_: Calldata): BytesWriter {
        const pending = this._pendingAuthority.value;
        if (pending === Address.zero()) {
            throw new Revert('No pending authority');
        }
        if (!Blockchain.tx.sender.equals(pending)) {
            throw new Revert('Not pending authority');
        }

        this._pegAuthority.value = pending;
        this._pendingAuthority.value = Address.zero();

        return new BytesWriter(0);
    }

    @method()
    public renouncePegAuthority(_: Calldata): BytesWriter {
        this.onlyPegAuthority();

        this._pegAuthority.value = Address.zero();
        this._pendingAuthority.value = Address.zero();

        return new BytesWriter(0);
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

    protected onlyPegAuthority(): void {
        if (!Blockchain.tx.sender.equals(this._pegAuthority.value)) {
            throw new Revert('Not peg authority');
        }
    }

    protected override isSelectorExcluded(selector: Selector): boolean {
        if (
            selector === PEG_RATE_SELECTOR ||
            selector === PEG_AUTHORITY_SELECTOR ||
            selector === PEG_UPDATED_AT_SELECTOR ||
            selector === MAX_STALENESS_SELECTOR ||
            selector === IS_STALE_SELECTOR
        ) {
            return true;
        }
        return super.isSelectorExcluded(selector);
    }
}

import { u256 } from '@btc-vision/as-bignum/assembly';

import { BytesWriter } from '../buffer/BytesWriter';
import {
    ALLOWANCE_DECREASE_TYPE_HASH,
    ALLOWANCE_INCREASE_TYPE_HASH,
    ALLOWANCE_SELECTOR,
    BALANCE_OF_SELECTOR,
    DECIMALS_SELECTOR,
    DOMAIN_SEPARATOR_SELECTOR,
    ICON_SELECTOR,
    MAXIMUM_SUPPLY_SELECTOR,
    METADATA_SELECTOR,
    NAME_SELECTOR,
    NONCE_OF_SELECTOR,
    ON_OP20_RECEIVED_SELECTOR,
    OP712_DOMAIN_TYPE_HASH,
    OP712_VERSION_HASH,
    SYMBOL_SELECTOR,
    TOTAL_SUPPLY_SELECTOR,
} from '../constants/Exports';
import { Blockchain } from '../env';
import { sha256, sha256String } from '../env/global';
import { ApprovedEvent, BurnedEvent, MintedEvent, TransferredEvent } from '../events/predefined';
import { Selector } from '../math/abi';
import { EMPTY_POINTER } from '../math/bytes';
import { AddressMemoryMap } from '../memory/AddressMemoryMap';
import { MapOfMap } from '../memory/MapOfMap';
import { StoredString } from '../storage/StoredString';
import { StoredU256 } from '../storage/StoredU256';
import { Calldata } from '../types';
import { Address } from '../types/Address';
import { Revert } from '../types/Revert';
import { SafeMath } from '../types/SafeMath';
import {
    ADDRESS_BYTE_LENGTH,
    SELECTOR_BYTE_LENGTH,
    U256_BYTE_LENGTH,
    U32_BYTE_LENGTH,
    U64_BYTE_LENGTH,
    U8_BYTE_LENGTH,
} from '../utils';
import { IOP20 } from './interfaces/IOP20';
import { OP20InitParameters } from './interfaces/OP20InitParameters';
import { ReentrancyGuard, ReentrancyLevel } from './ReentrancyGuard';
import { ExtendedAddress } from '../types/ExtendedAddress';

const namePointer: u16 = Blockchain.nextPointer;
const symbolPointer: u16 = Blockchain.nextPointer;
const iconPointer: u16 = Blockchain.nextPointer;
const decimalsPointer: u16 = Blockchain.nextPointer;
const totalSupplyPointer: u16 = Blockchain.nextPointer;
const maxSupplyPointer: u16 = Blockchain.nextPointer;
const balanceOfMapPointer: u16 = Blockchain.nextPointer;
const allowanceMapPointer: u16 = Blockchain.nextPointer;
const nonceMapPointer: u16 = Blockchain.nextPointer;

/**
 * OP20 Token Standard Implementation for OPNet.
 *
 * This abstract class implements the OP20 token standard, providing a complete
 * fungible token implementation with advanced features including:
 * - EIP-712 style typed data signatures for gasless approvals
 * - Safe transfer callbacks for receiver contracts
 * - Reentrancy protection for security
 * - Quantum-resistant signature support (Schnorr now, ML-DSA future)
 * - Unlimited approval optimization (u256.Max)
 *
 * @remarks
 * OP20 is OPNet's equivalent of ERC20, adapted for Bitcoin's UTXO model with
 * additional security features. All storage uses persistent pointers for
 * cross-transaction state management. The contract includes built-in protection
 * against common attack vectors including reentrancy and integer overflow.
 *
 * Inheriting contracts must implement deployment verification logic and can
 * extend with additional features like minting permissions, pausability, etc.
 *
 * @example
 * ```typescript
 * class MyToken extends OP20 {
 *   constructor() {
 *     super();
 *     const params: OP20InitParameters = {
 *       name: "My Token",
 *       symbol: "MTK",
 *       decimals: 18,
 *       maxSupply: u256.fromU64(1000000000000000000000000), // 1M tokens
 *       icon: "https://example.com/icon.png"
 *     };
 *     this.instantiate(params);
 *   }
 * }
 * ```
 */
export abstract class OP20 extends ReentrancyGuard implements IOP20 {
    /**
     * Total supply of tokens currently in circulation.
     * Intentionally public for inherited classes to implement custom minting/burning logic.
     */
    public _totalSupply: StoredU256;

    /**
     * Reentrancy protection level for this contract.
     * Set to CALLBACK to allow single-depth callbacks for safeTransfer operations.
     */
    protected override readonly reentrancyLevel: ReentrancyLevel = ReentrancyLevel.CALLBACK;

    /**
     * Nested mapping of owner -> spender -> allowance amount.
     * Tracks approval amounts for transferFrom operations.
     */
    protected readonly allowanceMap: MapOfMap<u256>;

    /**
     * Mapping of address -> balance.
     * Stores token balances for all holders.
     */
    protected readonly balanceOfMap: AddressMemoryMap;

    /** Maximum supply that can ever be minted. */
    protected readonly _maxSupply: StoredU256;

    /** Number of decimal places for token display. */
    protected readonly _decimals: StoredU256;

    /** Human-readable token name. */
    protected readonly _name: StoredString;

    /** Token icon URL for display in wallets/explorers. */
    protected readonly _icon: StoredString;

    /** Token ticker symbol. */
    protected readonly _symbol: StoredString;

    /**
     * Mapping of address -> nonce for EIP-712 signatures.
     * Prevents signature replay attacks.
     */
    protected readonly _nonceMap: AddressMemoryMap;

    /**
     * Initializes the OP20 token with storage pointers.
     * Sets up all persistent storage mappings and variables.
     */
    public constructor() {
        super();

        this.allowanceMap = new MapOfMap<u256>(allowanceMapPointer);
        this.balanceOfMap = new AddressMemoryMap(balanceOfMapPointer);
        this._nonceMap = new AddressMemoryMap(nonceMapPointer);

        this._totalSupply = new StoredU256(totalSupplyPointer, EMPTY_POINTER);
        this._maxSupply = new StoredU256(maxSupplyPointer, EMPTY_POINTER);
        this._decimals = new StoredU256(decimalsPointer, EMPTY_POINTER);
        this._name = new StoredString(namePointer);
        this._symbol = new StoredString(symbolPointer);
        this._icon = new StoredString(iconPointer);
    }

    /**
     * Initializes token parameters. Can only be called once.
     *
     * @param params - Token initialization parameters
     * @param skipDeployerVerification - If true, skips deployer check (use with caution)
     *
     * @throws {Revert} If already initialized
     * @throws {Revert} If decimals > 32
     * @throws {Revert} If caller is not deployer (unless skipped)
     *
     * @remarks
     * This method sets immutable token parameters and should be called in the
     * constructor of inheriting contracts. The maximum of 32 decimals is enforced
     * to prevent precision issues with u256 arithmetic.
     */
    public instantiate(
        params: OP20InitParameters,
        skipDeployerVerification: boolean = false,
    ): void {
        if (!this._maxSupply.value.isZero()) throw new Revert('Already initialized');
        if (!skipDeployerVerification) this.onlyDeployer(Blockchain.tx.sender);
        if (params.decimals > 32) throw new Revert('Decimals > 32');

        this._maxSupply.value = params.maxSupply;
        this._decimals.value = u256.fromU32(u32(params.decimals));
        this._name.value = params.name;
        this._symbol.value = params.symbol;
        this._icon.value = params.icon;
    }

    /**
     * Returns the token name.
     *
     * @returns Token name as string
     */
    @method()
    @returns({ name: 'name', type: ABIDataTypes.STRING })
    public name(_: Calldata): BytesWriter {
        const w = new BytesWriter(String.UTF8.byteLength(this._name.value) + 4);
        w.writeStringWithLength(this._name.value);
        return w;
    }

    /**
     * Returns the token symbol.
     *
     * @returns Token symbol as string
     */
    @method()
    @returns({ name: 'symbol', type: ABIDataTypes.STRING })
    public symbol(_: Calldata): BytesWriter {
        const w = new BytesWriter(String.UTF8.byteLength(this._symbol.value) + 4);
        w.writeStringWithLength(this._symbol.value);
        return w;
    }

    /**
     * Returns the token icon URL.
     *
     * @returns Icon URL as string
     */
    @method()
    @returns({ name: 'icon', type: ABIDataTypes.STRING })
    public icon(_: Calldata): BytesWriter {
        const w = new BytesWriter(String.UTF8.byteLength(this._icon.value) + 4);
        w.writeStringWithLength(this._icon.value);
        return w;
    }

    /**
     * Returns the number of decimals used for display.
     *
     * @returns Number of decimals (0-32)
     */
    @method()
    @returns({ name: 'decimals', type: ABIDataTypes.UINT8 })
    public decimals(_: Calldata): BytesWriter {
        const w = new BytesWriter(1);
        w.writeU8(<u8>this._decimals.value.toU32());
        return w;
    }

    /**
     * Returns the total supply of tokens in circulation.
     *
     * @returns Current total supply as u256
     */
    @method()
    @returns({ name: 'totalSupply', type: ABIDataTypes.UINT256 })
    public totalSupply(_: Calldata): BytesWriter {
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(this._totalSupply.value);
        return w;
    }

    /**
     * Returns the maximum supply that can ever exist.
     *
     * @returns Maximum supply cap as u256
     */
    @method()
    @returns({ name: 'maximumSupply', type: ABIDataTypes.UINT256 })
    public maximumSupply(_: Calldata): BytesWriter {
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(this._maxSupply.value);
        return w;
    }

    /**
     * Returns the EIP-712 domain separator for signature verification.
     *
     * @returns 32-byte domain separator hash
     *
     * @remarks
     * The domain separator includes chain ID, protocol ID, and contract address
     * to prevent cross-chain and cross-contract signature replay attacks.
     */
    @method()
    @returns({ name: 'domainSeparator', type: ABIDataTypes.BYTES32 })
    public domainSeparator(_: Calldata): BytesWriter {
        const w = new BytesWriter(32);
        w.writeBytes(this._buildDomainSeparator());
        return w;
    }

    /**
     * Returns the token balance of an address.
     *
     * @param calldata - Contains the address to query
     * @returns Balance as u256
     */
    @method({ name: 'owner', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'balance', type: ABIDataTypes.UINT256 })
    public balanceOf(calldata: Calldata): BytesWriter {
        const bal = this._balanceOf(calldata.readAddress());
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(bal);
        return w;
    }

    /**
     * Returns the current nonce for an address (for signature verification).
     *
     * @param calldata - Contains the address to query
     * @returns Current nonce as u256
     */
    @method({ name: 'owner', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'nonce', type: ABIDataTypes.UINT256 })
    public nonceOf(calldata: Calldata): BytesWriter {
        const current = this._nonceMap.get(calldata.readAddress());
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(current);
        return w;
    }

    /**
     * Returns the amount an address is allowed to spend on behalf of another.
     *
     * @param calldata - Contains owner and spender addresses
     * @returns Remaining allowance as u256
     */
    @method(
        { name: 'owner', type: ABIDataTypes.ADDRESS },
        { name: 'spender', type: ABIDataTypes.ADDRESS },
    )
    @returns({ name: 'remaining', type: ABIDataTypes.UINT256 })
    public allowance(calldata: Calldata): BytesWriter {
        const w = new BytesWriter(U256_BYTE_LENGTH);
        const rem = this._allowance(calldata.readAddress(), calldata.readAddress());
        w.writeU256(rem);
        return w;
    }

    /**
     * Transfers tokens from sender to recipient.
     *
     * @param calldata - Contains recipient address and amount
     * @emits Transferred event
     *
     * @throws {Revert} If sender has insufficient balance
     * @throws {Revert} If recipient is zero address
     */
    @method(
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @emit('Transferred')
    public transfer(calldata: Calldata): BytesWriter {
        this._transfer(Blockchain.tx.sender, calldata.readAddress(), calldata.readU256());
        return new BytesWriter(0);
    }

    /**
     * Transfers tokens on behalf of another address using allowance.
     *
     * @param calldata - Contains from address, to address, and amount
     * @emits Transferred event
     *
     * @throws {Revert} If insufficient allowance
     * @throws {Revert} If from has insufficient balance
     */
    @method(
        { name: 'from', type: ABIDataTypes.ADDRESS },
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @emit('Transferred')
    public transferFrom(calldata: Calldata): BytesWriter {
        const from = calldata.readAddress();
        const to = calldata.readAddress();
        const amount = calldata.readU256();

        this._spendAllowance(from, Blockchain.tx.sender, amount);
        this._transfer(from, to, amount);

        return new BytesWriter(0);
    }

    /**
     * Safely transfers tokens and calls onOP20Received on recipient if it's a contract.
     *
     * @param calldata - Contains recipient, amount, and optional data
     * @emits Transferred event
     *
     * @throws {Revert} If recipient contract rejects the transfer
     * @remarks
     * Prevents tokens from being permanently locked in contracts that can't handle them.
     */
    @method(
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
        { name: 'data', type: ABIDataTypes.BYTES },
    )
    @emit('Transferred')
    public safeTransfer(calldata: Calldata): BytesWriter {
        this._safeTransfer(
            Blockchain.tx.sender,
            calldata.readAddress(),
            calldata.readU256(),
            calldata.readBytesWithLength(),
        );
        return new BytesWriter(0);
    }

    /**
     * Safely transfers tokens on behalf of another address with callback.
     *
     * @param calldata - Contains from, to, amount, and optional data
     * @emits Transferred event
     *
     * @throws {Revert} If insufficient allowance or balance
     * @throws {Revert} If recipient contract rejects
     */
    @method(
        { name: 'from', type: ABIDataTypes.ADDRESS },
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
        { name: 'data', type: ABIDataTypes.BYTES },
    )
    @emit('Transferred')
    public safeTransferFrom(calldata: Calldata): BytesWriter {
        const from = calldata.readAddress();
        const to = calldata.readAddress();
        const amount = calldata.readU256();
        const data = calldata.readBytesWithLength();

        this._spendAllowance(from, Blockchain.tx.sender, amount);
        this._safeTransfer(from, to, amount, data);

        return new BytesWriter(0);
    }

    /**
     * Increases the allowance granted to a spender.
     *
     * @param calldata - Contains spender address and amount to increase
     * @emits Approved event
     *
     * @remarks
     * Preferred over setting allowance directly to avoid race conditions.
     * If overflow would occur, sets to u256.Max (unlimited).
     */
    @method(
        { name: 'spender', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @emit('Approved')
    public increaseAllowance(calldata: Calldata): BytesWriter {
        const owner: Address = Blockchain.tx.sender;
        const spender: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();

        this._increaseAllowance(owner, spender, amount);
        return new BytesWriter(0);
    }

    /**
     * Decreases the allowance granted to a spender.
     *
     * @param calldata - Contains spender address and amount to decrease
     * @emits Approved event
     *
     * @remarks
     * If decrease would cause underflow, sets allowance to zero.
     */
    @method(
        { name: 'spender', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @emit('Approved')
    public decreaseAllowance(calldata: Calldata): BytesWriter {
        const owner: Address = Blockchain.tx.sender;
        const spender: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();

        this._decreaseAllowance(owner, spender, amount);
        return new BytesWriter(0);
    }

    /**
     * Increases allowance using an EIP-712 typed signature (gasless approval).
     *
     * @param calldata - Contains owner, spender, amount, deadline, and signature
     * @emits Approved event
     *
     * @throws {Revert} If signature is invalid or expired
     *
     * @remarks
     * Enables gasless approvals where a third party can submit the transaction.
     * Uses Schnorr signatures now, will support ML-DSA after quantum transition.
     */
    @method(
        { name: 'owner', type: ABIDataTypes.BYTES32 },
        { name: 'ownerTweakedPublicKey', type: ABIDataTypes.BYTES32 },
        { name: 'spender', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
        { name: 'deadline', type: ABIDataTypes.UINT64 },
        { name: 'signature', type: ABIDataTypes.BYTES },
    )
    @emit('Approved')
    public increaseAllowanceBySignature(calldata: Calldata): BytesWriter {
        const ownerAddress = calldata.readBytesArray(ADDRESS_BYTE_LENGTH);
        const ownerTweakedPublicKey = calldata.readBytesArray(ADDRESS_BYTE_LENGTH);

        const owner = new ExtendedAddress(ownerTweakedPublicKey, ownerAddress);

        const spender: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();
        const deadline: u64 = calldata.readU64();
        const signature = calldata.readBytesWithLength();

        this._increaseAllowanceBySignature(owner, spender, amount, deadline, signature);
        return new BytesWriter(0);
    }

    /**
     * Decreases allowance using an EIP-712 typed signature.
     *
     * @param calldata - Contains owner, spender, amount, deadline, and signature
     * @emits Approved event
     *
     * @throws {Revert} If signature is invalid or expired
     */
    @method(
        { name: 'owner', type: ABIDataTypes.BYTES32 },
        { name: 'ownerTweakedPublicKey', type: ABIDataTypes.BYTES32 },
        { name: 'spender', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
        { name: 'deadline', type: ABIDataTypes.UINT64 },
        { name: 'signature', type: ABIDataTypes.BYTES },
    )
    @emit('Approved')
    public decreaseAllowanceBySignature(calldata: Calldata): BytesWriter {
        const ownerAddress = calldata.readBytesArray(ADDRESS_BYTE_LENGTH);
        const ownerTweakedPublicKey = calldata.readBytesArray(ADDRESS_BYTE_LENGTH);

        const owner = new ExtendedAddress(ownerTweakedPublicKey, ownerAddress);

        const spender: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();
        const deadline: u64 = calldata.readU64();
        const signature = calldata.readBytesWithLength();

        this._decreaseAllowanceBySignature(owner, spender, amount, deadline, signature);
        return new BytesWriter(0);
    }

    /**
     * Burns tokens from the sender's balance.
     *
     * @param calldata - Contains amount to burn
     * @emits Burned event
     *
     * @throws {Revert} If sender has insufficient balance
     *
     * @remarks
     * Permanently removes tokens from circulation, decreasing total supply.
     */
    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @emit('Burned')
    public burn(calldata: Calldata): BytesWriter {
        this._burn(Blockchain.tx.sender, calldata.readU256());
        return new BytesWriter(0);
    }

    /**
     * Returns all token metadata in a single call.
     *
     * @returns Combined metadata including name, symbol, icon, decimals, totalSupply, and domain separator
     *
     * @remarks
     * Optimization for wallets/explorers to fetch all token info in one call.
     */
    @method()
    @returns(
        { name: 'name', type: ABIDataTypes.STRING },
        { name: 'symbol', type: ABIDataTypes.STRING },
        { name: 'icon', type: ABIDataTypes.STRING },
        { name: 'decimals', type: ABIDataTypes.UINT8 },
        { name: 'totalSupply', type: ABIDataTypes.UINT256 },
        { name: 'domainSeparator', type: ABIDataTypes.BYTES32 },
    )
    public metadata(_: Calldata): BytesWriter {
        const name = this._name.value;
        const symbol = this._symbol.value;
        const icon = this._icon.value;
        const domainSeparator = this._buildDomainSeparator();

        const nameLength = String.UTF8.byteLength(name);
        const symbolLength = String.UTF8.byteLength(symbol);
        const iconLength = String.UTF8.byteLength(icon);

        const totalSize =
            U32_BYTE_LENGTH * 4 +
            U256_BYTE_LENGTH * 2 +
            nameLength +
            symbolLength +
            iconLength +
            domainSeparator.length +
            U8_BYTE_LENGTH;

        const w = new BytesWriter(totalSize);
        w.writeStringWithLength(name);
        w.writeStringWithLength(symbol);
        w.writeStringWithLength(icon);
        w.writeU8(<u8>this._decimals.value.toU32());
        w.writeU256(this._totalSupply.value);
        w.writeBytesWithLength(domainSeparator);

        return w;
    }

    /**
     * Internal: Gets balance of an address.
     * @protected
     */
    protected _balanceOf(owner: Address): u256 {
        if (!this.balanceOfMap.has(owner)) return u256.Zero;
        return this.balanceOfMap.get(owner);
    }

    /**
     * Internal: Gets allowance between owner and spender.
     * @protected
     */
    protected _allowance(owner: Address, spender: Address): u256 {
        const senderMap = this.allowanceMap.get(owner);
        return senderMap.get(spender);
    }

    /**
     * Internal: Executes token transfer logic.
     * @protected
     */
    protected _transfer(from: Address, to: Address, amount: u256): void {
        if (from === Address.zero()) {
            throw new Revert('Invalid sender');
        }

        if (to === Address.zero()) {
            throw new Revert('Invalid receiver');
        }

        const balance: u256 = this.balanceOfMap.get(from);
        if (balance < amount) {
            throw new Revert('Insufficient balance');
        }

        this.balanceOfMap.set(from, SafeMath.sub(balance, amount));

        const toBal: u256 = this.balanceOfMap.get(to);
        this.balanceOfMap.set(to, SafeMath.add(toBal, amount));

        this.createTransferredEvent(Blockchain.tx.sender, from, to, amount);
    }

    /**
     * Internal: Safe transfer with receiver callback.
     * @protected
     */
    protected _safeTransfer(from: Address, to: Address, amount: u256, data: Uint8Array): void {
        this._transfer(from, to, amount);

        if (Blockchain.isContract(to)) {
            // In CALLBACK mode, the guard allows depth up to 1
            // In STANDARD mode, the guard blocks all reentrancy
            this._callOnOP20Received(from, to, amount, data);
        }
    }

    /**
     * Internal: Spends allowance for transferFrom.
     * @protected
     */
    protected _spendAllowance(owner: Address, spender: Address, amount: u256): void {
        if (owner.equals(spender)) return;

        const ownerMap = this.allowanceMap.get(owner);
        const allowed: u256 = ownerMap.get(spender);

        if (allowed === u256.Max) return;

        if (allowed < amount) {
            throw new Revert('Insufficient allowance');
        }

        ownerMap.set(spender, SafeMath.sub(allowed, amount));
        this.allowanceMap.set(owner, ownerMap);
    }

    /**
     * Internal: Calls onOP20Received on receiver contract.
     * @protected
     */
    protected _callOnOP20Received(
        from: Address,
        to: Address,
        amount: u256,
        data: Uint8Array,
    ): void {
        const operator = Blockchain.tx.sender;
        const calldata = new BytesWriter(
            SELECTOR_BYTE_LENGTH +
                ADDRESS_BYTE_LENGTH * 2 +
                U256_BYTE_LENGTH +
                U32_BYTE_LENGTH +
                data.length,
        );
        calldata.writeSelector(ON_OP20_RECEIVED_SELECTOR);
        calldata.writeAddress(operator);
        calldata.writeAddress(from);
        calldata.writeU256(amount);
        calldata.writeBytesWithLength(data);

        const response = Blockchain.call(to, calldata);
        if (response.data.byteLength < SELECTOR_BYTE_LENGTH) {
            throw new Revert('Transfer rejected by recipient');
        }

        const retVal = response.data.readSelector();
        if (retVal !== ON_OP20_RECEIVED_SELECTOR) {
            throw new Revert('Transfer rejected by recipient');
        }
    }

    /**
     * Internal: Processes signature-based allowance increase.
     * @protected
     */
    protected _increaseAllowanceBySignature(
        owner: ExtendedAddress,
        spender: Address,
        amount: u256,
        deadline: u64,
        signature: Uint8Array,
    ): void {
        this._verifySignature(
            ALLOWANCE_INCREASE_TYPE_HASH,
            owner,
            spender,
            amount,
            deadline,
            signature,
        );
        this._increaseAllowance(owner, spender, amount);
    }

    /**
     * Checks if a selector should bypass reentrancy guards.
     * @protected
     */
    protected override isSelectorExcluded(selector: Selector): boolean {
        if (
            selector === BALANCE_OF_SELECTOR ||
            selector === ALLOWANCE_SELECTOR ||
            selector === TOTAL_SUPPLY_SELECTOR ||
            selector === NAME_SELECTOR ||
            selector === SYMBOL_SELECTOR ||
            selector === DECIMALS_SELECTOR ||
            selector === NONCE_OF_SELECTOR ||
            selector === DOMAIN_SEPARATOR_SELECTOR ||
            selector === METADATA_SELECTOR ||
            selector === MAXIMUM_SUPPLY_SELECTOR ||
            selector === ICON_SELECTOR
        ) {
            return true;
        }

        return super.isSelectorExcluded(selector);
    }

    /**
     * Internal: Processes signature-based allowance decrease.
     * @protected
     */
    protected _decreaseAllowanceBySignature(
        owner: ExtendedAddress,
        spender: Address,
        amount: u256,
        deadline: u64,
        signature: Uint8Array,
    ): void {
        this._verifySignature(
            ALLOWANCE_DECREASE_TYPE_HASH,
            owner,
            spender,
            amount,
            deadline,
            signature,
        );
        this._decreaseAllowance(owner, spender, amount);
    }

    /**
     * Internal: Verifies EIP-712 typed signatures.
     * @protected
     */
    protected _verifySignature(
        typeHash: u8[],
        owner: ExtendedAddress,
        spender: Address,
        amount: u256,
        deadline: u64,
        signature: Uint8Array,
    ): void {
        if (signature.length !== 64) {
            throw new Revert('Invalid signature length');
        }
        if (Blockchain.block.number > deadline) {
            throw new Revert('Signature expired');
        }

        const nonce = this._nonceMap.get(owner);

        const structWriter = new BytesWriter(
            32 + ADDRESS_BYTE_LENGTH * 2 + U256_BYTE_LENGTH * 2 + U64_BYTE_LENGTH,
        );
        structWriter.writeBytesU8Array(typeHash);
        structWriter.writeAddress(owner);
        structWriter.writeAddress(spender);
        structWriter.writeU256(amount);
        structWriter.writeU256(nonce);
        structWriter.writeU64(deadline);

        const structHash = sha256(structWriter.getBuffer());

        const messageWriter = new BytesWriter(2 + 32 + 32);
        messageWriter.writeU16(0x1901);
        messageWriter.writeBytes(this._buildDomainSeparator());
        messageWriter.writeBytes(structHash);

        const hash = sha256(messageWriter.getBuffer());

        if (!Blockchain.verifySignature(owner, signature, hash)) {
            throw new Revert('Invalid signature');
        }

        this._nonceMap.set(owner, SafeMath.add(nonce, u256.One));
    }

    /**
     * Internal: Builds EIP-712 domain separator.
     * @protected
     */
    protected override _buildDomainSeparator(): Uint8Array {
        const writer = new BytesWriter(32 * 5 + ADDRESS_BYTE_LENGTH);
        writer.writeBytesU8Array(OP712_DOMAIN_TYPE_HASH);
        writer.writeBytes(sha256String(this._name.value));
        writer.writeBytesU8Array(OP712_VERSION_HASH);
        writer.writeBytes(Blockchain.chainId);
        writer.writeBytes(Blockchain.protocolId);
        writer.writeAddress(this.address);

        return sha256(writer.getBuffer());
    }

    /**
     * Internal: Increases allowance with overflow protection.
     * @protected
     */
    protected _increaseAllowance(owner: Address, spender: Address, amount: u256): void {
        if (owner === Address.zero()) {
            throw new Revert('Invalid approver');
        }
        if (spender === Address.zero()) {
            throw new Revert('Invalid spender');
        }

        const senderMap = this.allowanceMap.get(owner);
        const previousAllowance = senderMap.get(spender);
        let newAllowance: u256 = u256.add(previousAllowance, amount);

        // If it overflows, set to max
        if (newAllowance < previousAllowance) {
            newAllowance = u256.Max;
        }
        senderMap.set(spender, newAllowance);

        this.createApprovedEvent(owner, spender, newAllowance);
    }

    /**
     * Internal: Decreases allowance with underflow protection.
     * @protected
     */
    protected _decreaseAllowance(owner: Address, spender: Address, amount: u256): void {
        if (owner === Address.zero()) {
            throw new Revert('Invalid approver');
        }
        if (spender === Address.zero()) {
            throw new Revert('Invalid spender');
        }

        const senderMap = this.allowanceMap.get(owner);
        const previousAllowance = senderMap.get(spender);
        let newAllowance: u256;
        // If it underflows, set to zero
        if (amount > previousAllowance) {
            newAllowance = u256.Zero;
        } else {
            newAllowance = SafeMath.sub(previousAllowance, amount);
        }
        senderMap.set(spender, newAllowance);

        this.createApprovedEvent(owner, spender, newAllowance);
    }

    /**
     * Internal: Mints new tokens to an address.
     * @protected
     *
     * @throws {Revert} If exceeds max supply
     */
    protected _mint(to: Address, amount: u256): void {
        if (to === Address.zero()) {
            throw new Revert('Invalid receiver');
        }

        const toBal: u256 = this.balanceOfMap.get(to);
        this.balanceOfMap.set(to, SafeMath.add(toBal, amount));

        // @ts-expect-error AssemblyScript valid
        this._totalSupply += amount;

        if (this._totalSupply.value > this._maxSupply.value) {
            throw new Revert('Max supply reached');
        }

        this.createMintedEvent(to, amount);
    }

    /**
     * Internal: Burns tokens from an address.
     * @protected
     */
    protected _burn(from: Address, amount: u256): void {
        if (from === Address.zero()) {
            throw new Revert('Invalid sender');
        }

        const balance: u256 = this.balanceOfMap.get(from);
        const newBalance: u256 = SafeMath.sub(balance, amount);
        this.balanceOfMap.set(from, newBalance);

        // @ts-expect-error AssemblyScript valid
        this._totalSupply -= amount;

        this.createBurnedEvent(from, amount);
    }

    /** Event creation helpers */
    protected createBurnedEvent(from: Address, amount: u256): void {
        this.emitEvent(new BurnedEvent(from, amount));
    }

    protected createApprovedEvent(owner: Address, spender: Address, amount: u256): void {
        this.emitEvent(new ApprovedEvent(owner, spender, amount));
    }

    protected createMintedEvent(to: Address, amount: u256): void {
        this.emitEvent(new MintedEvent(to, amount));
    }

    protected createTransferredEvent(
        operator: Address,
        from: Address,
        to: Address,
        amount: u256,
    ): void {
        this.emitEvent(new TransferredEvent(operator, from, to, amount));
    }
}

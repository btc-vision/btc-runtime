import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { sha256, sha256String } from '../env/global';
import { encodePointerUnknownLength } from '../math/abi';
import { EMPTY_POINTER } from '../math/bytes';
import { MapOfMap } from '../memory/MapOfMap';
import { AddressMemoryMap } from '../memory/AddressMemoryMap';
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
} from '../utils';

import { IOP1155 } from './interfaces/IOP1155';
import { OP1155InitParameters } from './interfaces/OP1155InitParameters';
import {
    ApprovedForAllEvent,
    TransferredBatchEvent,
    TransferredSingleEvent,
    URIEvent,
} from '../events/predefined';
import {
    INTERFACE_ID_ERC165,
    INTERFACE_ID_OP1155,
    INTERFACE_ID_OP1155_METADATA_URI,
    ON_OP1155_BATCH_RECEIVED_MAGIC,
    ON_OP1155_RECEIVED_MAGIC,
    OP1155_BATCH_TRANSFER_TYPE_HASH,
    OP1155_TRANSFER_TYPE_HASH,
    OP712_DOMAIN_TYPE_HASH,
    OP712_VERSION_HASH,
} from '../constants/Exports';
import { ReentrancyGuard } from './ReentrancyGuard';

// Storage pointers
const namePointer: u16 = Blockchain.nextPointer;
const symbolPointer: u16 = Blockchain.nextPointer;
const baseUriPointer: u16 = Blockchain.nextPointer;
const balanceMapPointer: u16 = Blockchain.nextPointer;
const operatorApprovalMapPointer: u16 = Blockchain.nextPointer;
const totalSupplyMapPointer: u16 = Blockchain.nextPointer;
const nonceMapPointer: u16 = Blockchain.nextPointer;
const initializedPointer: u16 = Blockchain.nextPointer;

export abstract class OP1155 extends ReentrancyGuard implements IOP1155 {
    // Nested mapping: account -> (id -> balance)
    protected readonly balances: MapOfMap<u256>;

    // Nested mapping: account -> (operator -> approved)
    protected readonly operatorApprovals: MapOfMap<boolean>;

    // Nonce mapping for signatures
    protected readonly _nonceMap: AddressMemoryMap;

    // Metadata
    protected readonly _name: StoredString;
    protected readonly _symbol: StoredString;
    protected readonly _baseUri: StoredString;
    protected readonly _initialized: StoredU256;

    public constructor() {
        super();

        this.balances = new MapOfMap<u256>(balanceMapPointer);
        this.operatorApprovals = new MapOfMap<boolean>(operatorApprovalMapPointer);
        this._nonceMap = new AddressMemoryMap(nonceMapPointer);

        this._name = new StoredString(namePointer, 0);
        this._symbol = new StoredString(symbolPointer, 1);
        this._baseUri = new StoredString(baseUriPointer, 0);
        this._initialized = new StoredU256(initializedPointer, EMPTY_POINTER);
    }

    public get name(): string {
        const nameValue = this._name.value;
        if (!nameValue || nameValue.length === 0) throw new Revert('Name not set');
        return nameValue;
    }

    public get symbol(): string {
        const symbolValue = this._symbol.value;
        if (!symbolValue || symbolValue.length === 0) throw new Revert('Symbol not set');
        return symbolValue;
    }

    public instantiate(
        params: OP1155InitParameters,
        skipDeployerVerification: boolean = false,
    ): void {
        if (!this._initialized.value.isZero()) throw new Revert('Already initialized');
        if (!skipDeployerVerification) this.onlyDeployer(Blockchain.tx.sender);

        if (params.name.length == 0) throw new Revert('Name cannot be empty');
        if (params.symbol.length == 0) throw new Revert('Symbol cannot be empty');

        if (params.baseUri.length > 0 && !params.baseUri.includes('{id}')) {
            throw new Revert('Base URI must contain {id} placeholder or be empty');
        }

        this._name.value = params.name;
        this._symbol.value = params.symbol;
        this._baseUri.value = params.baseUri;
        this._initialized.value = u256.One;
    }

    @method('name')
    @returns({ name: 'name', type: ABIDataTypes.STRING })
    public fn_name(_: Calldata): BytesWriter {
        const w = new BytesWriter(String.UTF8.byteLength(this.name) + 4);
        w.writeStringWithLength(this.name);
        return w;
    }

    @method('symbol')
    @returns({ name: 'symbol', type: ABIDataTypes.STRING })
    public fn_symbol(_: Calldata): BytesWriter {
        const w = new BytesWriter(String.UTF8.byteLength(this.symbol) + 4);
        w.writeStringWithLength(this.symbol);
        return w;
    }

    @method({ name: 'interfaceId', type: ABIDataTypes.BYTES4 })
    @returns({ name: 'supported', type: ABIDataTypes.BOOL })
    public supportsInterface(calldata: Calldata): BytesWriter {
        const interfaceId = calldata.readU32();

        let supported = false;
        if (
            interfaceId === INTERFACE_ID_ERC165 ||
            interfaceId === INTERFACE_ID_OP1155 ||
            interfaceId === INTERFACE_ID_OP1155_METADATA_URI
        ) {
            supported = true;
        }

        const w = new BytesWriter(1);
        w.writeBoolean(supported);
        return w;
    }

    @method(
        { name: 'account', type: ABIDataTypes.ADDRESS },
        { name: 'id', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'balance', type: ABIDataTypes.UINT256 })
    public balanceOf(calldata: Calldata): BytesWriter {
        const account = calldata.readAddress();
        const id = calldata.readU256();

        if (account.equals(Address.zero())) {
            throw new Revert('Balance query for zero address');
        }

        const balance = this._balanceOf(account, id);
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(balance);
        return w;
    }

    @method(
        { name: 'accounts', type: ABIDataTypes.ARRAY_OF_ADDRESSES },
        { name: 'ids', type: ABIDataTypes.ARRAY_OF_UINT256 },
    )
    @returns({ name: 'balances', type: ABIDataTypes.ARRAY_OF_UINT256 })
    public balanceOfBatch(calldata: Calldata): BytesWriter {
        const accountsLength = calldata.readU32();
        if (accountsLength === 0) {
            throw new Revert('Empty arrays');
        }

        const accounts: Address[] = [];
        for (let i: u32 = 0; i < accountsLength; i++) {
            accounts.push(calldata.readAddress());
        }

        const idsLength = calldata.readU32();
        const ids: u256[] = [];
        for (let i: u32 = 0; i < idsLength; i++) {
            ids.push(calldata.readU256());
        }

        if (accounts.length != ids.length) {
            throw new Revert('Array length mismatch');
        }

        const w = new BytesWriter(U32_BYTE_LENGTH + accounts.length * U256_BYTE_LENGTH);
        w.writeU32(u32(accounts.length));

        for (let i: i32 = 0; i < accounts.length; i++) {
            if (accounts[i].equals(Address.zero())) {
                throw new Revert('Balance query for zero address');
            }
            w.writeU256(this._balanceOf(accounts[i], ids[i]));
        }

        return w;
    }

    @method(
        { name: 'from', type: ABIDataTypes.ADDRESS },
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'id', type: ABIDataTypes.UINT256 },
        { name: 'amount', type: ABIDataTypes.UINT256 },
        { name: 'data', type: ABIDataTypes.BYTES },
    )
    @emit('TransferredSingle')
    public safeTransferFrom(calldata: Calldata): BytesWriter {
        const from = calldata.readAddress();
        const to = calldata.readAddress();
        const id = calldata.readU256();
        const amount = calldata.readU256();
        const data = calldata.readBytesWithLength();

        const operator = Blockchain.tx.sender;

        // Check approval
        if (!from.equals(operator) && !this._isApprovedForAll(from, operator)) {
            throw new Revert('Caller is not owner nor approved');
        }

        this._safeTransferFrom(operator, from, to, id, amount, data);

        return new BytesWriter(0);
    }

    @method(
        { name: 'from', type: ABIDataTypes.ADDRESS },
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'ids', type: ABIDataTypes.ARRAY_OF_UINT256 },
        { name: 'amounts', type: ABIDataTypes.ARRAY_OF_UINT256 },
        { name: 'data', type: ABIDataTypes.BYTES },
    )
    @emit('TransferredBatch')
    public safeBatchTransferFrom(calldata: Calldata): BytesWriter {
        const from = calldata.readAddress();
        const to = calldata.readAddress();

        const idsLength = calldata.readU32();
        if (idsLength === 0) {
            throw new Revert('Empty arrays');
        }

        const ids: u256[] = [];
        for (let i: u32 = 0; i < idsLength; i++) {
            ids.push(calldata.readU256());
        }

        const amountsLength = calldata.readU32();
        const amounts: u256[] = [];
        for (let i: u32 = 0; i < amountsLength; i++) {
            amounts.push(calldata.readU256());
        }

        const data = calldata.readBytesWithLength();

        const operator = Blockchain.tx.sender;

        // Check approval
        if (!from.equals(operator) && !this._isApprovedForAll(from, operator)) {
            throw new Revert('Caller is not owner nor approved');
        }

        this._safeBatchTransferFrom(operator, from, to, ids, amounts, data);

        return new BytesWriter(0);
    }

    @method(
        { name: 'operator', type: ABIDataTypes.ADDRESS },
        { name: 'approved', type: ABIDataTypes.BOOL },
    )
    @emit('ApprovedForAll')
    public setApprovalForAll(calldata: Calldata): BytesWriter {
        const operator = calldata.readAddress();
        const approved = calldata.readBoolean();

        this._setApprovalForAll(Blockchain.tx.sender, operator, approved);

        return new BytesWriter(0);
    }

    @method(
        { name: 'account', type: ABIDataTypes.ADDRESS },
        { name: 'operator', type: ABIDataTypes.ADDRESS },
    )
    @returns({ name: 'approved', type: ABIDataTypes.BOOL })
    public isApprovedForAll(calldata: Calldata): BytesWriter {
        const account = calldata.readAddress();
        const operator = calldata.readAddress();

        const approved: boolean = this._isApprovedForAll(account, operator);
        const w = new BytesWriter(1);
        w.writeBoolean(approved);
        return w;
    }

    @method({ name: 'id', type: ABIDataTypes.UINT256 })
    @returns({ name: 'uri', type: ABIDataTypes.STRING })
    public uri(calldata: Calldata): BytesWriter {
        const id = calldata.readU256();
        const tokenURI = this._uri(id);

        const w = new BytesWriter(String.UTF8.byteLength(tokenURI) + 4);
        w.writeStringWithLength(tokenURI);
        return w;
    }

    @method({ name: 'id', type: ABIDataTypes.UINT256 })
    @returns({ name: 'totalSupply', type: ABIDataTypes.UINT256 })
    public totalSupply(calldata: Calldata): BytesWriter {
        const id = calldata.readU256();
        const supply = this._totalSupply(id);

        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(supply);
        return w;
    }

    @method({ name: 'id', type: ABIDataTypes.UINT256 })
    @returns({ name: 'exists', type: ABIDataTypes.BOOL })
    public exists(calldata: Calldata): BytesWriter {
        const id = calldata.readU256();
        const exists = this._exists(id);

        const w = new BytesWriter(1);
        w.writeBoolean(exists);
        return w;
    }

    @method(
        { name: 'account', type: ABIDataTypes.ADDRESS },
        { name: 'id', type: ABIDataTypes.UINT256 },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @emit('TransferredSingle')
    public burn(calldata: Calldata): BytesWriter {
        const account = calldata.readAddress();
        const id = calldata.readU256();
        const amount = calldata.readU256();

        // Check if sender is authorized
        if (
            !account.equals(Blockchain.tx.sender) &&
            !this._isApprovedForAll(account, Blockchain.tx.sender)
        ) {
            throw new Revert('Not authorized to burn');
        }

        this._burn(account, id, amount);
        return new BytesWriter(0);
    }

    @method(
        { name: 'account', type: ABIDataTypes.ADDRESS },
        { name: 'ids', type: ABIDataTypes.ARRAY_OF_UINT256 },
        { name: 'amounts', type: ABIDataTypes.ARRAY_OF_UINT256 },
    )
    @emit('TransferredBatch')
    public burnBatch(calldata: Calldata): BytesWriter {
        const account = calldata.readAddress();

        const idsLength = calldata.readU32();
        const ids: u256[] = [];
        for (let i: u32 = 0; i < idsLength; i++) {
            ids.push(calldata.readU256());
        }

        const amountsLength = calldata.readU32();
        const amounts: u256[] = [];
        for (let i: u32 = 0; i < amountsLength; i++) {
            amounts.push(calldata.readU256());
        }

        // Check if sender is authorized
        if (
            !account.equals(Blockchain.tx.sender) &&
            !this._isApprovedForAll(account, Blockchain.tx.sender)
        ) {
            throw new Revert('Not authorized to burn');
        }

        this._burnBatch(account, ids, amounts);
        return new BytesWriter(0);
    }

    @method(
        { name: 'from', type: ABIDataTypes.ADDRESS },
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'id', type: ABIDataTypes.UINT256 },
        { name: 'amount', type: ABIDataTypes.UINT256 },
        { name: 'deadline', type: ABIDataTypes.UINT64 },
        { name: 'signature', type: ABIDataTypes.BYTES },
    )
    @emit('TransferredSingle')
    public transferBySignature(calldata: Calldata): BytesWriter {
        const from = calldata.readAddress();
        const to = calldata.readAddress();
        const id = calldata.readU256();
        const amount = calldata.readU256();
        const deadline = calldata.readU64();
        const signature = calldata.readBytesWithLength();

        this._verifyTransferSignature(from, to, id, amount, deadline, signature);
        this._safeTransferFrom(from, from, to, id, amount, new Uint8Array(0));

        return new BytesWriter(0);
    }

    @method(
        { name: 'from', type: ABIDataTypes.ADDRESS },
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'ids', type: ABIDataTypes.ARRAY_OF_UINT256 },
        { name: 'amounts', type: ABIDataTypes.ARRAY_OF_UINT256 },
        { name: 'deadline', type: ABIDataTypes.UINT64 },
        { name: 'signature', type: ABIDataTypes.BYTES },
    )
    @emit('TransferredBatch')
    public batchTransferBySignature(calldata: Calldata): BytesWriter {
        const from = calldata.readAddress();
        const to = calldata.readAddress();

        const idsLength = calldata.readU32();
        const ids: u256[] = [];
        for (let i: u32 = 0; i < idsLength; i++) {
            ids.push(calldata.readU256());
        }

        const amountsLength = calldata.readU32();
        const amounts: u256[] = [];
        for (let i: u32 = 0; i < amountsLength; i++) {
            amounts.push(calldata.readU256());
        }

        const deadline = calldata.readU64();
        const signature = calldata.readBytesWithLength();

        this._verifyBatchTransferSignature(from, to, ids, amounts, deadline, signature);
        this._safeBatchTransferFrom(from, from, to, ids, amounts, new Uint8Array(0));

        return new BytesWriter(0);
    }

    @method()
    @returns({ name: 'domainSeparator', type: ABIDataTypes.BYTES32 })
    public domainSeparator(_: Calldata): BytesWriter {
        const w = new BytesWriter(32);
        w.writeBytes(this._buildDomainSeparator());
        return w;
    }

    @method({ name: 'owner', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'nonce', type: ABIDataTypes.UINT256 })
    public nonceOf(calldata: Calldata): BytesWriter {
        const current = this._nonceMap.get(calldata.readAddress());
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(current);
        return w;
    }

    // Internal functions
    protected _balanceOf(account: Address, id: u256): u256 {
        const accountBalances = this.balances.get(account);
        const idKey = id.toUint8Array(true);
        const balance = accountBalances.get(idKey);
        return balance ? balance : u256.Zero;
    }

    protected _isApprovedForAll(account: Address, operator: Address): boolean {
        const accountApprovals = this.operatorApprovals.get(account);
        return accountApprovals.get(operator);
    }

    protected _exists(id: u256): boolean {
        return this._totalSupply(id) > u256.Zero;
    }

    protected _setApprovalForAll(owner: Address, operator: Address, approved: boolean): void {
        if (owner.equals(operator)) {
            throw new Revert('Setting approval status for self');
        }

        const ownerApprovals = this.operatorApprovals.get(owner);
        ownerApprovals.set(operator, approved);

        this.emitEvent(new ApprovedForAllEvent(owner, operator, approved));
    }

    protected _safeTransferFrom(
        operator: Address,
        from: Address,
        to: Address,
        id: u256,
        amount: u256,
        data: Uint8Array,
    ): void {
        if (amount.isZero()) {
            throw new Revert('Transfer amount must be greater than zero');
        }

        if (to.equals(Address.zero())) {
            throw new Revert('Transfer to zero address');
        }

        this._beforeTokenTransfer(operator, from, to, [id], [amount], data);

        const idKey = id.toUint8Array(true);

        // Update from balance
        const fromBalances = this.balances.get(from);
        const fromBalance = fromBalances.get(idKey);

        if (!fromBalance || fromBalance < amount) {
            throw new Revert('Insufficient balance for transfer');
        }

        fromBalances.set(idKey, SafeMath.sub(fromBalance, amount));

        // Update to balance
        const toBalances = this.balances.get(to);
        const toBalance = toBalances.get(idKey);
        const newToBalance = toBalance ? SafeMath.add(toBalance, amount) : amount;
        toBalances.set(idKey, newToBalance);

        // Call receiver hook if contract
        this._doSafeTransferAcceptanceCheck(operator, from, to, id, amount, data);

        this.emitEvent(new TransferredSingleEvent(operator, from, to, id, amount));

        this._afterTokenTransfer(operator, from, to, [id], [amount], data);
    }

    protected _safeBatchTransferFrom(
        operator: Address,
        from: Address,
        to: Address,
        ids: u256[],
        amounts: u256[],
        data: Uint8Array,
    ): void {
        if (ids.length != amounts.length) {
            throw new Revert('Array length mismatch');
        }

        if (to.equals(Address.zero())) {
            throw new Revert('Transfer to zero address');
        }

        this._beforeTokenTransfer(operator, from, to, ids, amounts, data);

        const fromBalances = this.balances.get(from);
        const toBalances = this.balances.get(to);

        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const amount = amounts[i];
            if (amount.isZero()) {
                throw new Revert('Transfer amount must be greater than zero');
            }

            const idKey = id.toUint8Array(true);

            const fromBalance = fromBalances.get(idKey);
            if (!fromBalance || fromBalance < amount) {
                throw new Revert('Insufficient balance for transfer');
            }

            fromBalances.set(idKey, SafeMath.sub(fromBalance, amount));

            const toBalance = toBalances.get(idKey);
            const newToBalance = toBalance ? SafeMath.add(toBalance, amount) : amount;
            toBalances.set(idKey, newToBalance);
        }

        const maxBatchSize: i32 = 3;
        for (let i: i32 = 0; i < ids.length; i += maxBatchSize) {
            const endIndex = min(i + maxBatchSize, ids.length);
            const batchIds = ids.slice(i, endIndex);
            const batchAmounts = amounts.slice(i, endIndex);
            this.emitEvent(new TransferredBatchEvent(operator, from, to, batchIds, batchAmounts));
        }

        this._afterTokenTransfer(operator, from, to, ids, amounts, data);

        // Call receiver hook if contract
        this._doSafeBatchTransferAcceptanceCheck(operator, from, to, ids, amounts, data);
    }

    protected _mint(to: Address, id: u256, amount: u256, data: Uint8Array): void {
        if (to.equals(Address.zero())) {
            throw new Revert('Mint to zero address');
        }

        if (amount.isZero()) {
            throw new Revert('Transfer amount must be greater than zero');
        }

        const operator = Blockchain.tx.sender;

        this._beforeTokenTransfer(operator, Address.zero(), to, [id], [amount], data);

        const idKey = id.toUint8Array(true);

        // Update balance
        const toBalances = this.balances.get(to);
        const toBalance = toBalances.get(idKey);
        const newBalance = toBalance ? SafeMath.add(toBalance, amount) : amount;
        toBalances.set(idKey, newBalance);

        // Update total supply
        const currentSupply = this._totalSupply(id);
        this._setTotalSupply(id, SafeMath.add(currentSupply, amount));

        this.emitEvent(new TransferredSingleEvent(operator, Address.zero(), to, id, amount));

        this._afterTokenTransfer(operator, Address.zero(), to, [id], [amount], data);

        // Call receiver hook if contract
        this._doSafeTransferAcceptanceCheck(operator, Address.zero(), to, id, amount, data);
    }

    protected _mintBatch(to: Address, ids: u256[], amounts: u256[], data: Uint8Array): void {
        if (to.equals(Address.zero())) {
            throw new Revert('Mint to zero address');
        }

        if (ids.length != amounts.length) {
            throw new Revert('Array length mismatch');
        }

        const operator = Blockchain.tx.sender;

        this._beforeTokenTransfer(operator, Address.zero(), to, ids, amounts, data);

        const toBalances = this.balances.get(to);

        for (let i: i32 = 0; i < ids.length; i++) {
            const id = ids[i];
            const amount = amounts[i];
            if (amount.isZero()) {
                throw new Revert('Transfer amount must be greater than zero');
            }

            const idKey = id.toUint8Array(true);

            const toBalance = toBalances.get(idKey);
            const newBalance = toBalance ? SafeMath.add(toBalance, amount) : amount;
            toBalances.set(idKey, newBalance);

            // Update total supply
            const currentSupply = this._totalSupply(id);
            this._setTotalSupply(id, SafeMath.add(currentSupply, amount));
        }

        // Emit events in batches of 3 due to event size limit
        const maxBatchSize = 3;
        for (let i: i32 = 0; i < ids.length; i += maxBatchSize) {
            const endIndex = min(i + maxBatchSize, ids.length);
            const batchIds = ids.slice(i, endIndex);
            const batchAmounts = amounts.slice(i, endIndex);
            this.emitEvent(
                new TransferredBatchEvent(operator, Address.zero(), to, batchIds, batchAmounts),
            );
        }

        this._afterTokenTransfer(operator, Address.zero(), to, ids, amounts, data);

        // Call receiver hook if contract
        this._doSafeBatchTransferAcceptanceCheck(operator, Address.zero(), to, ids, amounts, data);
    }

    protected _burn(from: Address, id: u256, amount: u256): void {
        if (from.equals(Address.zero())) {
            throw new Revert('Burn from zero address');
        }

        if (amount.isZero()) {
            throw new Revert('Transfer amount must be greater than zero');
        }

        const operator = Blockchain.tx.sender;

        this._beforeTokenTransfer(
            operator,
            from,
            Address.zero(),
            [id],
            [amount],
            new Uint8Array(0),
        );

        const idKey = id.toUint8Array(true);

        const fromBalances = this.balances.get(from);
        const fromBalance = fromBalances.get(idKey);

        if (!fromBalance || fromBalance < amount) {
            throw new Revert('Burn amount exceeds balance');
        }

        fromBalances.set(idKey, SafeMath.sub(fromBalance, amount));

        // Update total supply
        const currentSupply = this._totalSupply(id);
        this._setTotalSupply(id, SafeMath.sub(currentSupply, amount));

        this.emitEvent(new TransferredSingleEvent(operator, from, Address.zero(), id, amount));

        this._afterTokenTransfer(operator, from, Address.zero(), [id], [amount], new Uint8Array(0));
    }

    protected _burnBatch(from: Address, ids: u256[], amounts: u256[]): void {
        if (from.equals(Address.zero())) {
            throw new Revert('Burn from zero address');
        }

        if (ids.length != amounts.length) {
            throw new Revert('Array length mismatch');
        }

        const operator = Blockchain.tx.sender;

        this._beforeTokenTransfer(operator, from, Address.zero(), ids, amounts, new Uint8Array(0));

        const fromBalances = this.balances.get(from);

        for (let i: i32 = 0; i < ids.length; i++) {
            const id = ids[i];
            const amount = amounts[i];
            if (amount.isZero()) {
                throw new Revert('Transfer amount must be greater than zero');
            }

            const idKey = id.toUint8Array(true);

            const fromBalance = fromBalances.get(idKey);
            if (!fromBalance || fromBalance < amount) {
                throw new Revert('Burn amount exceeds balance');
            }

            fromBalances.set(idKey, SafeMath.sub(fromBalance, amount));

            // Update total supply
            const currentSupply = this._totalSupply(id);
            this._setTotalSupply(id, SafeMath.sub(currentSupply, amount));
        }

        const maxBatchSize: i32 = 3;
        for (let i: i32 = 0; i < ids.length; i += maxBatchSize) {
            const endIndex = min(i + maxBatchSize, ids.length);
            const batchIds = ids.slice(i, endIndex);
            const batchAmounts = amounts.slice(i, endIndex);
            this.emitEvent(
                new TransferredBatchEvent(operator, from, Address.zero(), batchIds, batchAmounts),
            );
        }

        this._afterTokenTransfer(operator, from, Address.zero(), ids, amounts, new Uint8Array(0));
    }

    protected _setURI(newuri: string): void {
        this._baseUri.value = newuri;

        this.emitEvent(new URIEvent(newuri, u256.Zero));
    }

    protected _uri(id: u256): string {
        const baseUri = this._baseUri.value;
        if (!baseUri || baseUri.length === 0) {
            return '';
        }

        // Replace {id} with actual token ID in hex format
        const idHex = this._toHexString(id);
        return baseUri.replace('{id}', idHex);
    }

    protected _totalSupply(id: u256): u256 {
        const key = this._getTokenStorageKey(totalSupplyMapPointer, id);
        const supplyBytes = Blockchain.getStorageAt(key);
        if (supplyBytes.length === 0) return u256.Zero;
        return u256.fromUint8ArrayBE(supplyBytes);
    }

    protected _setTotalSupply(id: u256, supply: u256): void {
        const key = this._getTokenStorageKey(totalSupplyMapPointer, id);
        Blockchain.setStorageAt(key, supply.toUint8Array(true));
    }

    // Signature verification
    protected _verifyTransferSignature(
        from: Address,
        to: Address,
        id: u256,
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

        const nonce = this._nonceMap.get(from);

        const structWriter = new BytesWriter(
            32 + ADDRESS_BYTE_LENGTH * 2 + U256_BYTE_LENGTH * 3 + U64_BYTE_LENGTH,
        );
        structWriter.writeBytesU8Array(OP1155_TRANSFER_TYPE_HASH);
        structWriter.writeAddress(from);
        structWriter.writeAddress(to);
        structWriter.writeU256(id);
        structWriter.writeU256(amount);
        structWriter.writeU256(nonce);
        structWriter.writeU64(deadline);

        const structHash = sha256(structWriter.getBuffer());

        const messageWriter = new BytesWriter(2 + 32 + 32);
        messageWriter.writeU16(0x1901);
        messageWriter.writeBytes(this._buildDomainSeparator());
        messageWriter.writeBytes(structHash);

        const hash = sha256(messageWriter.getBuffer());

        if (!Blockchain.verifySchnorrSignature(from, signature, hash)) {
            throw new Revert('Invalid signature');
        }

        this._nonceMap.set(from, SafeMath.add(nonce, u256.One));
    }

    protected _verifyBatchTransferSignature(
        from: Address,
        to: Address,
        ids: u256[],
        amounts: u256[],
        deadline: u64,
        signature: Uint8Array,
    ): void {
        if (signature.length !== 64) {
            throw new Revert('Invalid signature length');
        }

        if (Blockchain.block.number > deadline) {
            throw new Revert('Signature expired');
        }

        const nonce = this._nonceMap.get(from);

        // Calculate arrays hash
        const idsWriter = new BytesWriter(ids.length * U256_BYTE_LENGTH);
        for (let i: i32 = 0; i < ids.length; i++) {
            idsWriter.writeU256(ids[i]);
        }

        const idsHash = sha256(idsWriter.getBuffer());
        const amountsWriter = new BytesWriter(amounts.length * U256_BYTE_LENGTH);

        for (let i: i32 = 0; i < amounts.length; i++) {
            amountsWriter.writeU256(amounts[i]);
        }

        const amountsHash = sha256(amountsWriter.getBuffer());
        const structWriter = new BytesWriter(
            32 * 4 + ADDRESS_BYTE_LENGTH * 2 + U256_BYTE_LENGTH + U64_BYTE_LENGTH,
        );

        structWriter.writeBytesU8Array(OP1155_BATCH_TRANSFER_TYPE_HASH);
        structWriter.writeAddress(from);
        structWriter.writeAddress(to);
        structWriter.writeBytes(idsHash);
        structWriter.writeBytes(amountsHash);
        structWriter.writeU256(nonce);
        structWriter.writeU64(deadline);

        const structHash = sha256(structWriter.getBuffer());
        const messageWriter = new BytesWriter(2 + 32 + 32);
        messageWriter.writeU16(0x1901);
        messageWriter.writeBytes(this._buildDomainSeparator());
        messageWriter.writeBytes(structHash);

        const hash = sha256(messageWriter.getBuffer());
        if (!Blockchain.verifySchnorrSignature(from, signature, hash)) {
            throw new Revert('Invalid signature');
        }

        this._nonceMap.set(from, SafeMath.add(nonce, u256.One));
    }

    protected _buildDomainSeparator(): Uint8Array {
        const writer = new BytesWriter(32 * 5 + ADDRESS_BYTE_LENGTH);
        writer.writeBytesU8Array(OP712_DOMAIN_TYPE_HASH);
        writer.writeBytes(sha256String(this.name));
        writer.writeBytesU8Array(OP712_VERSION_HASH);
        writer.writeBytes(Blockchain.chainId);
        writer.writeBytes(Blockchain.protocolId);
        writer.writeAddress(this.address);

        return sha256(writer.getBuffer());
    }

    // Hooks for extensions
    protected _beforeTokenTransfer(
        operator: Address,
        from: Address,
        to: Address,
        ids: u256[],
        amounts: u256[],
        data: Uint8Array,
    ): void {
        // Hook that can be overridden by extensions
    }

    protected _afterTokenTransfer(
        operator: Address,
        from: Address,
        to: Address,
        ids: u256[],
        amounts: u256[],
        data: Uint8Array,
    ): void {
        // Hook that can be overridden by extensions
    }

    // Helper to get storage key for token-specific data
    private _getTokenStorageKey(pointer: u16, id: u256): Uint8Array {
        const idBytes = id.toUint8Array(true);
        return encodePointerUnknownLength(pointer, idBytes);
    }

    // Helper to convert u256 to hex string
    private _toHexString(value: u256): string {
        const bytes = value.toUint8Array(true);
        let hex: string = '';

        // Convert each byte to hex
        for (let i: i32 = 0; i < bytes.length; i++) {
            const byte = bytes[i];
            const hi = byte >> 4;
            const lo = byte & 0x0f;
            hex += hi < 10 ? String.fromCharCode(48 + hi) : String.fromCharCode(87 + hi);
            hex += lo < 10 ? String.fromCharCode(48 + lo) : String.fromCharCode(87 + lo);
        }

        // Remove leading zeros, but keep at least one character
        let startIndex = 0;
        while (startIndex < hex.length - 1 && hex.charCodeAt(startIndex) === 48) {
            startIndex++;
        }

        return startIndex > 0 ? hex.substring(startIndex) : hex;
    }

    private _doSafeTransferAcceptanceCheck(
        operator: Address,
        from: Address,
        to: Address,
        id: u256,
        amount: u256,
        data: Uint8Array,
    ): void {
        if (Blockchain.isContract(to)) {
            const calldata = new BytesWriter(
                SELECTOR_BYTE_LENGTH +
                    ADDRESS_BYTE_LENGTH * 2 +
                    U256_BYTE_LENGTH * 2 +
                    U32_BYTE_LENGTH +
                    data.length,
            );
            calldata.writeSelector(ON_OP1155_RECEIVED_MAGIC);
            calldata.writeAddress(operator);
            calldata.writeAddress(from);
            calldata.writeU256(id);
            calldata.writeU256(amount);
            calldata.writeBytesWithLength(data);

            const response = Blockchain.call(to, calldata);
            if (response.data.byteLength < SELECTOR_BYTE_LENGTH) {
                throw new Revert('Transfer to non-OP1155Receiver implementer');
            }

            const retVal = response.data.readSelector();
            if (retVal !== ON_OP1155_RECEIVED_MAGIC) {
                throw new Revert('OP1155Receiver rejected tokens');
            }
        }
    }

    private _doSafeBatchTransferAcceptanceCheck(
        operator: Address,
        from: Address,
        to: Address,
        ids: u256[],
        amounts: u256[],
        data: Uint8Array,
    ): void {
        if (Blockchain.isContract(to)) {
            const calldata = new BytesWriter(
                SELECTOR_BYTE_LENGTH +
                    ADDRESS_BYTE_LENGTH * 2 +
                    U32_BYTE_LENGTH * 2 +
                    ids.length * U256_BYTE_LENGTH +
                    amounts.length * U256_BYTE_LENGTH +
                    U32_BYTE_LENGTH +
                    data.length,
            );
            calldata.writeSelector(ON_OP1155_BATCH_RECEIVED_MAGIC);
            calldata.writeAddress(operator);
            calldata.writeAddress(from);
            calldata.writeU32(u32(ids.length));
            for (let i: i32 = 0; i < ids.length; i++) {
                calldata.writeU256(ids[i]);
            }
            calldata.writeU32(u32(amounts.length));
            for (let i: i32 = 0; i < amounts.length; i++) {
                calldata.writeU256(amounts[i]);
            }
            calldata.writeBytesWithLength(data);

            const response = Blockchain.call(to, calldata);
            if (response.data.byteLength < SELECTOR_BYTE_LENGTH) {
                throw new Revert('Transfer to non-OP1155Receiver implementer');
            }

            const retVal = response.data.readSelector();
            if (retVal !== ON_OP1155_BATCH_RECEIVED_MAGIC) {
                throw new Revert('OP1155Receiver rejected tokens');
            }
        }
    }
}

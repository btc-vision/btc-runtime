import { u256 } from '@btc-vision/as-bignum/assembly';

import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { sha256, sha256String } from '../env/global';
import { ApprovedEvent, BurnedEvent, MintedEvent, TransferredEvent } from '../events/predefined';
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
import { ReentrancyGuard, ReentrancyLevel } from './ReentrancyGuard';
import { Selector } from '../math/abi';

const nonceMapPointer: u16 = Blockchain.nextPointer;
const maxSupplyPointer: u16 = Blockchain.nextPointer;
const decimalsPointer: u16 = Blockchain.nextPointer;
const stringPointer: u16 = Blockchain.nextPointer;
const totalSupplyPointer: u16 = Blockchain.nextPointer;
const allowanceMapPointer: u16 = Blockchain.nextPointer;

const balanceOfMapPointer: u16 = Blockchain.nextPointer;

export abstract class OP20 extends ReentrancyGuard implements IOP20 {
    protected readonly reentrancyLevel: ReentrancyLevel = ReentrancyLevel.CALLBACK;

    protected readonly allowanceMap: MapOfMap<u256>;
    protected readonly balanceOfMap: AddressMemoryMap;

    protected readonly _maxSupply: StoredU256;
    protected readonly _decimals: StoredU256;
    protected readonly _name: StoredString;
    protected readonly _icon: StoredString;
    protected readonly _symbol: StoredString;
    protected readonly _nonceMap: AddressMemoryMap;

    public constructor() {
        super();

        this.allowanceMap = new MapOfMap<u256>(allowanceMapPointer);
        this.balanceOfMap = new AddressMemoryMap(balanceOfMapPointer);
        this._nonceMap = new AddressMemoryMap(nonceMapPointer);

        this._totalSupply = new StoredU256(totalSupplyPointer, EMPTY_POINTER);
        this._maxSupply = new StoredU256(maxSupplyPointer, EMPTY_POINTER);
        this._decimals = new StoredU256(decimalsPointer, EMPTY_POINTER);
        this._name = new StoredString(stringPointer, 0);
        this._symbol = new StoredString(stringPointer, 1);
        this._icon = new StoredString(stringPointer, 2);
    }

    /** Intentionally public for inherited classes */
    public _totalSupply: StoredU256;

    public get totalSupply(): u256 {
        return this._totalSupply.value;
    }

    public get name(): string {
        if (!this._name) throw new Revert('Name not set');
        return this._name.value;
    }

    public get symbol(): string {
        if (!this._symbol) throw new Revert('Symbol not set');
        return this._symbol.value;
    }

    public get icon(): string {
        if (!this._icon) throw new Revert('Icon not set');
        return this._icon.value;
    }

    public get decimals(): u8 {
        if (!this._decimals) throw new Revert('Decimals not set');
        return u8(this._decimals.value.toU32());
    }

    public get maxSupply(): u256 {
        if (!this._maxSupply) throw new Revert('Max supply not set');
        return this._maxSupply.value;
    }

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

    @method('icon')
    @returns({ name: 'icon', type: ABIDataTypes.STRING })
    public fn_icon(_: Calldata): BytesWriter {
        const w = new BytesWriter(String.UTF8.byteLength(this.icon) + 4);
        w.writeStringWithLength(this.icon);
        return w;
    }

    @method('decimals')
    @returns({ name: 'decimals', type: ABIDataTypes.UINT8 })
    public fn_decimals(_: Calldata): BytesWriter {
        const w = new BytesWriter(1);
        w.writeU8(this.decimals);
        return w;
    }

    @method('totalSupply')
    @returns({ name: 'totalSupply', type: ABIDataTypes.UINT256 })
    public fn_totalSupply(_: Calldata): BytesWriter {
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(this.totalSupply);
        return w;
    }

    @method('maximumSupply')
    @returns({ name: 'maximumSupply', type: ABIDataTypes.UINT256 })
    public fn_maximumSupply(_: Calldata): BytesWriter {
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(this.maxSupply);
        return w;
    }

    @method()
    @returns({ name: 'domainSeparator', type: ABIDataTypes.BYTES32 })
    public domainSeparator(_: Calldata): BytesWriter {
        const w = new BytesWriter(32);
        w.writeBytes(this._buildDomainSeparator());
        return w;
    }

    @method({ name: 'owner', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'balance', type: ABIDataTypes.UINT256 })
    public balanceOf(calldata: Calldata): BytesWriter {
        const bal = this._balanceOf(calldata.readAddress());
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(bal);
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

    @method(
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
        { name: 'data', type: ABIDataTypes.BYTES },
    )
    @emit('Transferred')
    public safeTransfer(calldata: Calldata): BytesWriter {
        this._transfer(
            Blockchain.tx.sender,
            calldata.readAddress(),
            calldata.readU256(),
            calldata.readBytesWithLength(),
        );
        return new BytesWriter(0);
    }

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
        this._transfer(from, to, amount, data);

        return new BytesWriter(0);
    }

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

    @method(
        { name: 'owner', type: ABIDataTypes.ADDRESS },
        { name: 'spender', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
        { name: 'deadline', type: ABIDataTypes.UINT64 },
        { name: 'signature', type: ABIDataTypes.BYTES },
    )
    @emit('Approved')
    public increaseAllowanceBySignature(calldata: Calldata): BytesWriter {
        const owner: Address = calldata.readAddress();
        const spender: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();
        const deadline: u64 = calldata.readU64();
        const signature = calldata.readBytesWithLength();

        this._increaseAllowanceBySignature(owner, spender, amount, deadline, signature);
        return new BytesWriter(0);
    }

    @method(
        { name: 'owner', type: ABIDataTypes.ADDRESS },
        { name: 'spender', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
        { name: 'deadline', type: ABIDataTypes.UINT64 },
        { name: 'signature', type: ABIDataTypes.BYTES },
    )
    @emit('Approved')
    public decreaseAllowanceBySignature(calldata: Calldata): BytesWriter {
        const owner: Address = calldata.readAddress();
        const spender: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();
        const deadline: u64 = calldata.readU64();
        const signature = calldata.readBytesWithLength();

        this._decreaseAllowanceBySignature(owner, spender, amount, deadline, signature);
        return new BytesWriter(0);
    }

    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @emit('Burned')
    public burn(calldata: Calldata): BytesWriter {
        this._burn(Blockchain.tx.sender, calldata.readU256());
        return new BytesWriter(0);
    }

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
        const name = this.name;
        const symbol = this.symbol;
        const icon = this.icon;
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
        w.writeU8(this.decimals);
        w.writeU256(this.totalSupply);
        w.writeBytesWithLength(domainSeparator);

        return w;
    }

    protected _balanceOf(owner: Address): u256 {
        if (!this.balanceOfMap.has(owner)) return u256.Zero;
        return this.balanceOfMap.get(owner);
    }

    protected _allowance(owner: Address, spender: Address): u256 {
        const senderMap = this.allowanceMap.get(owner);
        return senderMap.get(spender);
    }

    protected _transfer(from: Address, to: Address, amount: u256, data: Uint8Array): void {
        if (from === Address.zero() || from === Address.dead()) {
            throw new Revert('Invalid sender');
        }

        if (to === Address.zero() || to === Address.dead()) {
            throw new Revert('Invalid receiver');
        }

        const balance: u256 = this.balanceOfMap.get(from);
        if (balance < amount) {
            throw new Revert('Insufficient balance');
        }

        this.balanceOfMap.set(from, SafeMath.sub(balance, amount));

        const toBal: u256 = this.balanceOfMap.get(to);
        this.balanceOfMap.set(to, SafeMath.add(toBal, amount));

        if (Blockchain.isContract(to)) {
            // In CALLBACK mode, the guard allows depth up to 1
            // In STANDARD mode, the guard blocks all reentrancy
            this._callOnOP20Received(from, to, amount, data);
        }

        this.createTransferredEvent(Blockchain.tx.sender, from, to, amount);
    }

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

    protected _increaseAllowanceBySignature(
        owner: Address,
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

    protected isSelectorExcluded(selector: Selector): boolean {
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

    protected _decreaseAllowanceBySignature(
        owner: Address,
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

    protected _verifySignature(
        typeHash: u8[],
        owner: Address,
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

        if (!Blockchain.verifySchnorrSignature(owner, signature, hash)) {
            throw new Revert('Invalid signature');
        }

        this._nonceMap.set(owner, SafeMath.add(nonce, u256.One));
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

    protected _increaseAllowance(owner: Address, spender: Address, amount: u256): void {
        if (owner === Address.zero() || owner === Address.dead()) {
            throw new Revert('Invalid approver');
        }
        if (spender === Address.zero() || spender === Address.dead()) {
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

    protected _decreaseAllowance(owner: Address, spender: Address, amount: u256): void {
        if (owner === Address.zero() || owner === Address.dead()) {
            throw new Revert('Invalid approver');
        }
        if (spender === Address.zero() || spender === Address.dead()) {
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

    protected _mint(to: Address, amount: u256): void {
        if (to === Address.zero() || to === Address.dead()) {
            throw new Revert('Invalid receiver');
        }

        const toBal: u256 = this.balanceOfMap.get(to);
        this.balanceOfMap.set(to, SafeMath.add(toBal, amount));

        // @ts-expect-error AssemblyScript valid
        this._totalSupply += amount;

        if (this._totalSupply.value > this.maxSupply) {
            throw new Revert('Max supply reached');
        }

        this.createMintedEvent(to, amount);
    }

    protected _burn(from: Address, amount: u256): void {
        if (from === Address.zero() || from === Address.dead()) {
            throw new Revert('Invalid sender');
        }

        const balance: u256 = this.balanceOfMap.get(from);
        const newBalance: u256 = SafeMath.sub(balance, amount);
        this.balanceOfMap.set(from, newBalance);

        // @ts-expect-error AssemblyScript valid
        this._totalSupply -= amount;

        this.createBurnedEvent(from, amount);
    }

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

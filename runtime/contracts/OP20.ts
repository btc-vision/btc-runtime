import { u256 } from '@btc-vision/as-bignum/assembly';

import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { ApproveEvent, BurnEvent, MintEvent, TransferEvent } from '../events/predefined';
import { StoredString } from '../storage/StoredString';
import { StoredU256 } from '../storage/StoredU256';
import { Address } from '../types/Address';
import { Revert } from '../types/Revert';
import { SafeMath } from '../types/SafeMath';
import { sha256, sha256String } from '../env/global';
import { EMPTY_POINTER } from '../math/bytes';
import { AddressMemoryMap } from '../memory/AddressMemoryMap';
import { MapOfMap } from '../memory/MapOfMap';
import { Calldata } from '../types';
import { ADDRESS_BYTE_LENGTH, SELECTOR_BYTE_LENGTH, U256_BYTE_LENGTH, U64_BYTE_LENGTH } from '../utils';
import { IOP20 } from './interfaces/IOP20';
import { OP20InitParameters } from './interfaces/OP20InitParameters';
import { OP_NET } from './OP_NET';

// onOP20Received(address,address,uint256,bytes)
const ON_OP_20_RECEIVED_SELECTOR: u32 = 0xd83e7dbc;

// sha256("OP712Domain(string name,string version,bytes32 chainId,bytes32 protocolId,address verifyingContract)")
const OP712_DOMAIN_TYPE_HASH: u8[] = [0xfe, 0xe8, 0x22, 0x92, 0x35, 0x1d, 0x1a, 0x8b, 0xab, 0x21, 0xc4, 0xef, 0xdd, 0x15, 0x7e, 0x31, 0x68, 0xe8, 0xf6, 0x32, 0x3a, 0xd0, 0x4c, 0xba, 0x12, 0xf7, 0x7c, 0x0b, 0xdc, 0x46, 0x22, 0x58];

// sha256("1")
const OP712_VERSION_HASH: u8[] = [0x6b, 0x86, 0xb2, 0x73, 0xff, 0x34, 0xfc, 0xe1, 0x9d, 0x6b, 0x80, 0x4e, 0xff, 0x5a, 0x3f, 0x57, 0x47, 0xad, 0xa4, 0xea, 0xa2, 0x2f, 0x1d, 0x49, 0xc0, 0x1e, 0x52, 0xdd, 0xb7, 0x87, 0x5b, 0x4b];

// sha256("OP20AllowanceIncrease(address owner,address spender,uint256 amount,uint256 nonce,uint64 deadline)")
const ALLOWANCE_INCREASE_TYPE_HASH: u8[] = [0x7e, 0x88, 0x02, 0xf1, 0xfd, 0x23, 0xe1, 0x0e, 0x0d, 0xde, 0x3f, 0x00, 0xc0, 0xaa, 0x48, 0x15, 0xd8, 0x85, 0xec, 0xd9, 0xcd, 0xa0, 0xdf, 0x56, 0xff, 0xa2, 0x5e, 0xcc, 0x70, 0x2d, 0x45, 0x8e];

// sha256("OP20AllowanceDecrease(address owner,address spender,uint256 amount,uint256 nonce,uint64 deadline)")
const ALLOWANCE_DECREASE_TYPE_HASH: u8[] = [0x70, 0x87, 0x99, 0x34, 0x92, 0x1c, 0x2f, 0x48, 0x17, 0x78, 0x87, 0x89, 0x77, 0xd5, 0xb4, 0x5e, 0x2a, 0x59, 0xda, 0x1d, 0x28, 0x22, 0x41, 0xc9, 0x3f, 0xf1, 0xba, 0x6a, 0xf0, 0x98, 0xfc, 0xd0];

const nonceMapPointer: u16 = Blockchain.nextPointer;
const maxSupplyPointer: u16 = Blockchain.nextPointer;
const decimalsPointer: u16 = Blockchain.nextPointer;
const stringPointer: u16 = Blockchain.nextPointer;
const totalSupplyPointer: u16 = Blockchain.nextPointer;
const allowanceMapPointer: u16 = Blockchain.nextPointer;

const balanceOfMapPointer: u16 = Blockchain.nextPointer;

export abstract class OP20 extends OP_NET implements IOP20 {
    protected readonly allowanceMap: MapOfMap<u256>;
    protected readonly balanceOfMap: AddressMemoryMap;

    protected readonly _maxSupply: StoredU256;
    protected readonly _decimals: StoredU256;
    protected readonly _name: StoredString;
    protected readonly _symbol: StoredString;
    protected readonly _nonceMap: AddressMemoryMap;

    /** Intentionally public for inherited classes */
    public _totalSupply: StoredU256;

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
    }

    public get name(): string {
        if (!this._name) throw new Revert('Name not set');
        return this._name.value;
    }

    public get symbol(): string {
        if (!this._symbol) throw new Revert('Symbol not set');
        return this._symbol.value;
    }

    public get decimals(): u8 {
        if (!this._decimals) throw new Revert('Decimals not set');
        return u8(this._decimals.value.toU32());
    }

    public get totalSupply(): u256 {
        return this._totalSupply.value;
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
    @emit('Transfer')
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
    @emit('Transfer')
    public safeTransferFrom(calldata: Calldata): BytesWriter {
        const from = calldata.readAddress();
        const to = calldata.readAddress();
        const amount = calldata.readU256();
        const data = calldata.readBytesWithLength();
        const spender = Blockchain.tx.sender;

        this._spendAllowance(from, spender, amount);
        this._transfer(from, to, amount, data);

        return new BytesWriter(0);
    }

    @method(
        { name: 'spender', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @emit('Approve')
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
    @emit('Approve')
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
    @emit('Approve')
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
    @emit('Approve')
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
    @emit('Burn')
    public burn(calldata: Calldata): BytesWriter {
        this._burn(Blockchain.tx.sender, calldata.readU256());
        return new BytesWriter(0);
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
        if (from === Blockchain.DEAD_ADDRESS) {
            throw new Revert('Invalid sender');
        }
        if (to === Blockchain.DEAD_ADDRESS) {
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
            this._callOnOP20Received(from, to, amount, data);
        }

        this.createTransferEvent(from, to, amount);
    }

    protected _spendAllowance(owner: Address, spender: Address, amount: u256): void {
        const ownerMap = this.allowanceMap.get(owner);
        const allowed: u256 = ownerMap.get(spender);

        if (allowed < u256.Max) {
            if (allowed < amount) {
                throw new Revert('Insufficient allowance');
            }

            ownerMap.set(spender, SafeMath.sub(allowed, amount));
            this.allowanceMap.set(owner, ownerMap);
        }
    }

    protected _callOnOP20Received(from: Address, to: Address, amount: u256, data: Uint8Array): void {
        const operator = Blockchain.tx.sender;
        const calldata = new BytesWriter(data.length);
        calldata.writeSelector(ON_OP_20_RECEIVED_SELECTOR);
        calldata.writeAddress(operator);
        calldata.writeAddress(from);
        calldata.writeU256(amount);
        calldata.writeBytes(data);

        const response = Blockchain.call(to, calldata);

        if (response.byteLength < SELECTOR_BYTE_LENGTH) {
            throw new Revert('Transfer rejected by recipient');
        }

        const retval = response.readSelector();

        if (retval !== ON_OP_20_RECEIVED_SELECTOR) {
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
        this._verifySignature(ALLOWANCE_INCREASE_TYPE_HASH, owner, spender, amount, deadline, signature);
        this._increaseAllowance(owner, spender, amount);
    }

    protected _decreaseAllowanceBySignature(
        owner: Address,
        spender: Address,
        amount: u256,
        deadline: u64,
        signature: Uint8Array,
    ): void {
        this._verifySignature(ALLOWANCE_DECREASE_TYPE_HASH, owner, spender, amount, deadline, signature);
        this._decreaseAllowance(owner, spender, amount);
    }

    protected _verifySignature(typeHash: u8[], owner: Address, spender: Address, amount: u256, deadline: u64, signature: Uint8Array): void {
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
        if (owner === Blockchain.DEAD_ADDRESS) {
            throw new Revert('Invalid approver');
        }
        if (spender === Blockchain.DEAD_ADDRESS) {
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

        this.createApproveEvent(owner, spender, newAllowance);
    }

    protected _decreaseAllowance(owner: Address, spender: Address, amount: u256): void {
        if (owner === Blockchain.DEAD_ADDRESS) {
            throw new Revert('Invalid approver');
        }
        if (spender === Blockchain.DEAD_ADDRESS) {
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

        this.createApproveEvent(owner, spender, newAllowance);
    }

    protected _mint(to: Address, amount: u256): void {
        if (to === Blockchain.DEAD_ADDRESS) {
            throw new Revert('Invalid receiver');
        }

        const toBal: u256 = this.balanceOfMap.get(to);
        this.balanceOfMap.set(to, SafeMath.add(toBal, amount));

        // @ts-expect-error AssemblyScript valid
        this._totalSupply += amount;

        if (this._totalSupply.value > this.maxSupply) {
            throw new Revert('Max supply reached');
        }

        this.createMintEvent(to, amount);
    }

    protected _burn(from: Address, amount: u256): void {
        if (from === Blockchain.DEAD_ADDRESS) {
            throw new Revert('Invalid sender');
        }

        const balance: u256 = this.balanceOfMap.get(from);
        const newBalance: u256 = SafeMath.sub(balance, amount);
        this.balanceOfMap.set(from, newBalance);

        // @ts-expect-error AssemblyScript valid
        this._totalSupply -= amount;

        this.createBurnEvent(amount);
    }

    protected createBurnEvent(amount: u256): void {
        this.emitEvent(new BurnEvent(amount));
    }

    protected createApproveEvent(owner: Address, spender: Address, amount: u256): void {
        this.emitEvent(new ApproveEvent(owner, spender, amount));
    }

    protected createMintEvent(recipient: Address, amount: u256): void {
        this.emitEvent(new MintEvent(recipient, amount));
    }

    protected createTransferEvent(from: Address, to: Address, amount: u256): void {
        this.emitEvent(new TransferEvent(from, to, amount));
    }
}

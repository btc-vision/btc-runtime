import { u256 } from '@btc-vision/as-bignum/assembly';

import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { ApproveEvent, BurnEvent, MintEvent, TransferEvent } from '../events/predefined';
import { StoredString } from '../storage/StoredString';
import { StoredU256 } from '../storage/StoredU256';
import { Address } from '../types/Address';
import { Revert } from '../types/Revert';
import { SafeMath } from '../types/SafeMath';
import { sha256 } from '../env/global';
import { EMPTY_POINTER } from '../math/bytes';
import { AddressMemoryMap } from '../memory/AddressMemoryMap';
import { MapOfMap } from '../memory/MapOfMap';
import { Calldata } from '../types';
import { ADDRESS_BYTE_LENGTH, U256_BYTE_LENGTH } from '../utils';
import { IOP_20 } from './interfaces/IOP_20';
import { OP20InitParameters } from './interfaces/OP20InitParameters';
import { OP_NET } from './OP_NET';

const nonceMapPointer: u16 = Blockchain.nextPointer;
const maxSupplyPointer: u16 = Blockchain.nextPointer;
const decimalsPointer: u16 = Blockchain.nextPointer;
const stringPointer: u16 = Blockchain.nextPointer;
const totalSupplyPointer: u16 = Blockchain.nextPointer;
const allowanceMapPointer: u16 = Blockchain.nextPointer;
const balanceOfMapPointer: u16 = Blockchain.nextPointer;

export abstract class DeployableOP_20 extends OP_NET implements IOP_20 {
    protected readonly allowanceMap: MapOfMap<u256>;
    protected readonly balanceOfMap: AddressMemoryMap;

    protected readonly _maxSupply: StoredU256;
    protected readonly _decimals: StoredU256;
    protected readonly _name: StoredString;
    protected readonly _symbol: StoredString;
    protected readonly _nonceMap: AddressMemoryMap;

    public constructor(params: OP20InitParameters | null = null) {
        super();

        this.allowanceMap = new MapOfMap<u256>(allowanceMapPointer);
        this.balanceOfMap = new AddressMemoryMap(balanceOfMapPointer);
        this._nonceMap = new AddressMemoryMap(nonceMapPointer);

        this._totalSupply = new StoredU256(totalSupplyPointer, EMPTY_POINTER);
        this._maxSupply = new StoredU256(maxSupplyPointer, EMPTY_POINTER);
        this._decimals = new StoredU256(decimalsPointer, EMPTY_POINTER);
        this._name = new StoredString(stringPointer, 0);
        this._symbol = new StoredString(stringPointer, 1);

        if (params && this._maxSupply.value.isZero()) {
            this.instantiate(params, true);
        }
    }

    /** Intentionally public for inherited classes */
    public _totalSupply: StoredU256;

    public get totalSupply(): u256 {
        return this._totalSupply.value;
    }

    public get maxSupply(): u256 {
        if (!this._maxSupply) throw new Revert('Max supply not set');
        return this._maxSupply.value;
    }

    public get decimals(): u8 {
        if (!this._decimals) throw new Revert('Decimals not set');
        return u8(this._decimals.value.toU32());
    }

    public get name(): string {
        if (!this._name) throw new Revert('Name not set');
        return this._name.value;
    }

    public get symbol(): string {
        if (!this._symbol) throw new Revert('Symbol not set');
        return this._symbol.value;
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

    @method('decimals')
    @returns({ name: 'decimals', type: ABIDataTypes.UINT8 })
    public fn_decimals(_: Calldata): BytesWriter {
        const w = new BytesWriter(1);
        w.writeU8(this.decimals);
        return w;
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
        { name: 'spender', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @emit('Approve')
    public increaseAllowance(calldata: Calldata): BytesWriter {
        this._increaseAllowance(Blockchain.tx.sender, calldata.readAddress(), calldata.readU256());
        return new BytesWriter(0);
    }

    @method(
        { name: 'spender', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @emit('Approve')
    public decreaseAllowance(calldata: Calldata): BytesWriter {
        this._decreaseAllowance(Blockchain.tx.sender, calldata.readAddress(), calldata.readU256());
        return new BytesWriter(0);
    }

    @method(
        { name: 'spender', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
        { name: 'nonce', type: ABIDataTypes.UINT256 },
        { name: 'sig', type: ABIDataTypes.BYTES },
    )
    @emit('Approve')
    public approveFrom(calldata: Calldata): BytesWriter {
        if (Blockchain.tx.origin == Blockchain.tx.sender) {
            throw new Revert('Direct owner approval – use approve()');
        }

        const owner: Address = Blockchain.tx.origin;
        const spender: Address = calldata.readAddress();
        const value: u256 = calldata.readU256();
        const nonce: u256 = calldata.readU256();
        const sig = calldata.readBytesWithLength();
        if (sig.length !== 64) throw new Revert('Invalid signature length');

        this._approveFrom(owner, spender, value, nonce, sig);
        return new BytesWriter(0);
    }

    @method({ name: 'owner', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'nonce', type: ABIDataTypes.UINT256 })
    public nonceOf(calldata: Calldata): BytesWriter {
        const current = this._nonceMap.get(calldata.readAddress());
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(current);
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

    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @emit('Burn')
    public burn(calldata: Calldata): BytesWriter {
        this._burn(calldata.readU256());
        return new BytesWriter(0);
    }

    @method(
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
        { name: 'data', type: ABIDataTypes.BYTES },
    )
    @emit('Transfer')
    public safeTransfer(calldata: Calldata): BytesWriter {
        this._transfer(calldata.readAddress(), calldata.readU256(), calldata.readBytesWithLength());
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
        this._transferFrom(
            calldata.readAddress(),
            calldata.readAddress(),
            calldata.readU256(),
            calldata.readBytesWithLength(),
        );
        return new BytesWriter(0);
    }

    protected _allowance(owner: Address, spender: Address): u256 {
        const senderMap = this.allowanceMap.get(owner);
        return senderMap.get(spender);
    }

    protected _approveFrom(
        owner: Address,
        spender: Address,
        value: u256,
        nonce: u256,
        signature: Uint8Array,
    ): void {
        if (owner === Blockchain.DEAD_ADDRESS) throw new Revert('Address can not be dead');
        if (spender === Blockchain.DEAD_ADDRESS) throw new Revert('Spender can not be dead');

        const storedNonce = this._nonceMap.get(owner);
        if (!u256.eq(storedNonce, nonce)) throw new Revert('Invalid nonce');

        const writer = new BytesWriter(
            ADDRESS_BYTE_LENGTH * 3 + U256_BYTE_LENGTH + U256_BYTE_LENGTH,
        );
        writer.writeAddress(owner);
        writer.writeAddress(spender);
        writer.writeU256(value);
        writer.writeU256(nonce);
        writer.writeAddress(this.address);

        const hash = sha256(writer.getBuffer());
        if (!Blockchain.verifySchnorrSignature(owner, signature, hash)) {
            throw new Revert('Invalid signature');
        }

        this._nonceMap.set(owner, SafeMath.add(storedNonce, u256.One));

        const senderMap = this.allowanceMap.get(owner);
        senderMap.set(spender, value);

        this.createApproveEvent(owner, spender, value);
    }

    protected _increaseAllowance(owner: Address, spender: Address, value: u256): void {
        if (owner === Blockchain.DEAD_ADDRESS) throw new Revert('Address can not be dead');
        if (spender === Blockchain.DEAD_ADDRESS) throw new Revert('Spender can not be dead');

        const senderMap = this.allowanceMap.get(owner);
        const previousAllowance = senderMap.get(spender);
        const newAllowance: u256 = SafeMath.add(previousAllowance, value);
        senderMap.set(spender, newAllowance);

        this.createApproveEvent(owner, spender, value);
    }

    protected _decreaseAllowance(owner: Address, spender: Address, value: u256): void {
        if (owner === Blockchain.DEAD_ADDRESS) throw new Revert('Address can not be dead');
        if (spender === Blockchain.DEAD_ADDRESS) throw new Revert('Spender can not be dead');

        const senderMap = this.allowanceMap.get(owner);
        const previousAllowance = senderMap.get(spender);
        const newAllowance: u256 = SafeMath.sub(previousAllowance, value);
        senderMap.set(spender, newAllowance);

        this.createApproveEvent(owner, spender, value);
    }

    protected _balanceOf(owner: Address): u256 {
        if (!this.balanceOfMap.has(owner)) return u256.Zero;
        return this.balanceOfMap.get(owner);
    }

    protected _burn(value: u256, onlyDeployer: boolean = true): void {
        if (u256.eq(value, u256.Zero)) throw new Revert('No tokens');

        if (onlyDeployer) this.onlyDeployer(Blockchain.tx.sender);
        if (this._totalSupply.value < value) throw new Revert('Insufficient supply');
        if (!this.balanceOfMap.has(Blockchain.tx.sender)) throw new Revert('No balance');

        const balance: u256 = this.balanceOfMap.get(Blockchain.tx.sender);
        if (balance < value) throw new Revert('Insufficient balance');

        const newBalance: u256 = SafeMath.sub(balance, value);
        this.balanceOfMap.set(Blockchain.tx.sender, newBalance);

        // @ts-expect-error AssemblyScript valid
        this._totalSupply -= value;

        this.createBurnEvent(value);
    }

    protected _mint(to: Address, value: u256, onlyDeployer: boolean = true): void {
        if (onlyDeployer) this.onlyDeployer(Blockchain.tx.sender);

        if (!this.balanceOfMap.has(to)) {
            this.balanceOfMap.set(to, value);
        } else {
            const toBal: u256 = this.balanceOfMap.get(to);
            this.balanceOfMap.set(to, SafeMath.add(toBal, value));
        }

        // @ts-expect-error AssemblyScript valid
        this._totalSupply += value;

        if (this._totalSupply.value > this.maxSupply) throw new Revert('Max supply reached');
        this.createMintEvent(to, value);
    }

    protected _transfer(to: Address, value: u256, data: Uint8Array): void {
        const sender = Blockchain.tx.sender;
        if (this.isSelf(sender)) throw new Revert('Cannot transfer from self');
        if (u256.eq(value, u256.Zero)) throw new Revert('Cannot transfer 0');

        const balance: u256 = this.balanceOfMap.get(sender);
        if (balance < value) throw new Revert('Insufficient balance');

        this.balanceOfMap.set(sender, SafeMath.sub(balance, value));

        const toBal: u256 = this.balanceOfMap.get(to);
        this.balanceOfMap.set(to, SafeMath.add(toBal, value));

        this.createTransferEvent(sender, to, value);

        if (Blockchain.isContract(to)) {
            const calldata = new BytesWriter(data.length);
            calldata.writeBytes(data);
            Blockchain.call(to, calldata);
        }
    }

    @unsafe
    protected _unsafeTransferFrom(from: Address, to: Address, value: u256, data: Uint8Array): void {
        const balance: u256 = this.balanceOfMap.get(from);
        if (balance < value) {
            throw new Revert(`TransferFrom insufficient balance`);
        }

        this.balanceOfMap.set(from, SafeMath.sub(balance, value));

        if (!this.balanceOfMap.has(to)) {
            this.balanceOfMap.set(to, value);
        } else {
            const toBal: u256 = this.balanceOfMap.get(to);
            this.balanceOfMap.set(to, SafeMath.add(toBal, value));
        }

        this.createTransferEvent(from, to, value);

        if (Blockchain.isContract(to)) {
            const calldata = new BytesWriter(data.length);
            calldata.writeBytes(data);
            Blockchain.call(to, calldata);
        }
    }

    protected _transferFrom(from: Address, to: Address, value: u256, data: Uint8Array): void {
        if (from === Blockchain.DEAD_ADDRESS) throw new Revert('Cannot transfer from dead address');

        this._spendAllowance(from, Blockchain.tx.sender, value);
        this._unsafeTransferFrom(from, to, value, data);
    }

    protected _spendAllowance(owner: Address, spender: Address, value: u256): void {
        const ownerMap = this.allowanceMap.get(owner);
        const allowed: u256 = ownerMap.get(spender);

        if (allowed < value) {
            throw new Revert('Insufficient allowance');
        }

        ownerMap.set(spender, SafeMath.sub(allowed, value));
        this.allowanceMap.set(owner, ownerMap);
    }

    protected createBurnEvent(value: u256): void {
        this.emitEvent(new BurnEvent(value));
    }

    protected createApproveEvent(owner: Address, spender: Address, value: u256): void {
        this.emitEvent(new ApproveEvent(owner, spender, value));
    }

    protected createMintEvent(recipient: Address, value: u256): void {
        this.emitEvent(new MintEvent(recipient, value));
    }

    protected createTransferEvent(from: Address, to: Address, value: u256): void {
        this.emitEvent(new TransferEvent(from, to, value));
    }
}

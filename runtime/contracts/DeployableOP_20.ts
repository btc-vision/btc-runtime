import { IOP_20 } from './interfaces/IOP_20';
import { u256 } from 'as-bignum/assembly';
import { Address } from '../types/Address';
import { BytesWriter } from '../buffer/BytesWriter';
import { Calldata } from '../universal/ABIRegistry';
import { OP_NET } from './OP_NET';
import { AddressMemoryMap } from '../memory/AddressMemoryMap';
import { Revert } from '../types/Revert';
import { SafeMath } from '../types/SafeMath';
import { Blockchain } from '../env';
import { MemorySlotData } from '../memory/MemorySlot';
import { encodeSelector, Selector } from '../math/abi';
import { MultiAddressMemoryMap } from '../memory/MultiAddressMemoryMap';
import { StoredU256 } from '../storage/StoredU256';
import { ApproveEvent, BurnEvent, MintEvent, TransferEvent } from '../events/predefined';
import { StoredString } from '../storage/StoredString';
import { OP20InitParameters } from './interfaces/OP20InitParameters';

const maxSupplyPointer: u16 = Blockchain.nextPointer;
const decimalsPointer: u16 = Blockchain.nextPointer;
const namePointer: u16 = Blockchain.nextPointer;
const symbolPointer: u16 = Blockchain.nextPointer;
const totalSupplyPointer: u16 = Blockchain.nextPointer;
const allowanceMapPointer: u16 = Blockchain.nextPointer;
const balanceOfMapPointer: u16 = Blockchain.nextPointer;

export abstract class DeployableOP_20 extends OP_NET implements IOP_20 {
    protected readonly allowanceMap: MultiAddressMemoryMap<Address, Address, MemorySlotData<u256>>;
    protected readonly balanceOfMap: AddressMemoryMap<Address, MemorySlotData<u256>>;

    protected readonly _maxSupply: StoredU256;
    protected readonly _decimals: StoredU256;
    protected readonly _name: StoredString;
    protected readonly _symbol: StoredString;

    protected constructor(params?: OP20InitParameters) {
        super();

        this.allowanceMap = new MultiAddressMemoryMap<Address, Address, MemorySlotData<u256>>(
            allowanceMapPointer,
            u256.Zero,
        );

        this.balanceOfMap = new AddressMemoryMap<Address, MemorySlotData<u256>>(
            balanceOfMapPointer,
            u256.Zero,
        );

        this._totalSupply = new StoredU256(totalSupplyPointer, u256.Zero, u256.Zero);

        this._maxSupply = new StoredU256(maxSupplyPointer, u256.Zero, u256.Zero);
        this._decimals = new StoredU256(decimalsPointer, u256.Zero, u256.Zero);

        this._name = new StoredString(namePointer, '');
        this._symbol = new StoredString(symbolPointer, '');

        if (params && this._maxSupply.value.isZero()) {
            this.instantiate(params, true);
        }
    }

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

    public instantiate(params: OP20InitParameters, skipOwnerVerification: boolean = false): void {
        if (!skipOwnerVerification) this.onlyOwner(Blockchain.from());

        if (!this._maxSupply.value.isZero()) {
            throw new Revert('Already initialized');
        }

        if (params.decimals > 32) {
            throw new Revert('Decimals can not be more than 32');
        }

        this._maxSupply.value = params.maxSupply;
        this._decimals.value = u256.fromU32(u32(params.decimals));
        this._name.value = params.name;
        this._symbol.value = params.symbol;
    }

    /** METHODS */
    public allowance(callData: Calldata): BytesWriter {
        const response = new BytesWriter();

        const resp = this._allowance(callData.readAddress(), callData.readAddress());
        response.writeU256(resp);

        return response;
    }

    public approve(callData: Calldata): BytesWriter {
        const response = new BytesWriter();

        const spender: Address = callData.readAddress();
        const value = callData.readU256();

        const resp = this._approve(spender, value);
        response.writeBoolean(resp);

        this.createApproveEvent(Blockchain.from(), spender, value);

        return response;
    }

    public balanceOf(callData: Calldata): BytesWriter {
        const response = new BytesWriter();
        const address: Address = callData.readAddress();
        const resp = this._balanceOf(address);

        response.writeU256(resp);

        return response;
    }

    public burn(callData: Calldata): BytesWriter {
        const response = new BytesWriter();
        const resp = this._burn(callData.readU256());
        response.writeBoolean(resp);

        return response;
    }

    public mint(callData: Calldata): BytesWriter {
        const response = new BytesWriter();
        const resp = this._mint(callData.readAddress(), callData.readU256());

        response.writeBoolean(resp);

        return response;
    }

    public transfer(callData: Calldata): BytesWriter {
        const response = new BytesWriter();
        const resp = this._transfer(callData.readAddress(), callData.readU256());

        response.writeBoolean(resp);

        return response;
    }

    public transferFrom(callData: Calldata): BytesWriter {
        const response = new BytesWriter();
        const resp = this._transferFrom(
            callData.readAddress(),
            callData.readAddress(),
            callData.readU256(),
        );

        response.writeBoolean(resp);

        return response;
    }

    public callMethod(method: Selector, calldata: Calldata): BytesWriter {
        switch (method) {
            case encodeSelector('allowance'):
                return this.allowance(calldata);
            case encodeSelector('approve'):
                return this.approve(calldata);
            case encodeSelector('balanceOf'):
                return this.balanceOf(calldata);
            case encodeSelector('burn'):
                return this.burn(calldata);
            case encodeSelector('mint'):
                return this.mint(calldata);
            case encodeSelector('transfer'):
                return this.transfer(calldata);
            case encodeSelector('transferFrom'):
                return this.transferFrom(calldata);
            default:
                return super.callMethod(method, calldata);
        }
    }

    public callView(method: Selector): BytesWriter {
        const response = new BytesWriter();

        switch (method) {
            case encodeSelector('decimals'):
                response.writeU8(this.decimals);
                break;
            case encodeSelector('name'):
                response.writeStringWithLength(this.name);
                break;
            case encodeSelector('symbol'):
                response.writeStringWithLength(this.symbol);
                break;
            case encodeSelector('totalSupply'):
                response.writeU256(this.totalSupply);
                break;
            case encodeSelector('maximumSupply'):
                response.writeU256(this.maxSupply);
                break;
            default:
                return super.callView(method);
        }

        return response;
    }

    /** REDEFINED METHODS */
    protected _allowance(owner: Address, spender: Address): u256 {
        const senderMap = this.allowanceMap.get(owner);

        return senderMap.get(spender);
    }

    protected _approve(spender: Address, value: u256): boolean {
        const callee = Blockchain.from();

        const senderMap = this.allowanceMap.get(callee);
        senderMap.set(spender, value);

        return true;
    }

    protected _balanceOf(owner: Address): u256 {
        const hasAddress = this.balanceOfMap.has(owner);
        if (!hasAddress) return u256.Zero;

        return this.balanceOfMap.get(owner);
    }

    protected _burn(value: u256, onlyOwner: boolean = true): boolean {
        if (u256.eq(value, u256.Zero)) {
            throw new Revert(`No tokens`);
        }

        const callee = Blockchain.from();
        const caller = Blockchain.sender();

        if (onlyOwner) this.onlyOwner(callee); // only indexers can burn tokens

        if (this._totalSupply.value < value) throw new Revert(`Insufficient total supply.`);
        if (!this.balanceOfMap.has(caller)) throw new Revert('Empty');

        const balance: u256 = this.balanceOfMap.get(caller);
        if (balance < value) throw new Revert(`Insufficient balance`);

        const newBalance: u256 = SafeMath.sub(balance, value);
        this.balanceOfMap.set(caller, newBalance);

        // @ts-ignore
        this._totalSupply -= value;

        this.createBurnEvent(value);
        return true;
    }

    protected _mint(to: Address, value: u256, onlyOwner: boolean = true): boolean {
        const callee = Blockchain.from();

        if (onlyOwner) this.onlyOwner(callee);

        if (!this.balanceOfMap.has(to)) {
            this.balanceOfMap.set(to, value);
        } else {
            const toBalance: u256 = this.balanceOfMap.get(to);
            const newToBalance: u256 = SafeMath.add(toBalance, value);

            this.balanceOfMap.set(to, newToBalance);
        }

        // @ts-ignore
        this._totalSupply += value;

        if (this._totalSupply.value > this.maxSupply) throw new Revert('Max supply reached');

        this.createMintEvent(to, value);
        return true;
    }

    protected _transfer(to: string, value: u256): boolean {
        const caller = Blockchain.from();

        if (!this.balanceOfMap.has(caller)) throw new Revert();
        if (this.isSelf(caller)) throw new Revert('Can not transfer from self account');

        if (caller === to) {
            throw new Revert(`Cannot transfer to self`);
        }

        if (u256.eq(value, u256.Zero)) {
            throw new Revert(`Cannot transfer 0 tokens`);
        }

        const balance: u256 = this.balanceOfMap.get(caller);
        if (balance < value) throw new Revert(`Insufficient balance`);

        const newBalance: u256 = SafeMath.sub(balance, value);
        this.balanceOfMap.set(caller, newBalance);

        const toBalance: u256 = this.balanceOfMap.get(to);
        const newToBalance: u256 = SafeMath.add(toBalance, value);

        this.balanceOfMap.set(to, newToBalance);

        this.createTransferEvent(caller, to, value);

        return true;
    }

    @unsafe
    protected _unsafeTransferFrom(from: Address, to: Address, value: u256): boolean {
        const balance: u256 = this.balanceOfMap.get(from);
        if (balance < value)
            throw new Revert(
                `TransferFrom insufficient balance of ${from} is ${balance} and value is ${value}`,
            );

        const newBalance: u256 = SafeMath.sub(balance, value);

        this.balanceOfMap.set(from, newBalance);

        if (!this.balanceOfMap.has(to)) {
            this.balanceOfMap.set(to, value);
        } else {
            const toBalance: u256 = this.balanceOfMap.get(to);
            const newToBalance: u256 = SafeMath.add(toBalance, value);

            this.balanceOfMap.set(to, newToBalance);
        }

        this.createTransferEvent(from, to, value);

        return true;
    }

    protected _transferFrom(from: Address, to: Address, value: u256): boolean {
        const spender = Blockchain.from();
        if (Blockchain.sender() !== from) {
            throw new Revert('Not caller.');
        }

        if (this.isSelf(spender)) throw new Revert('Can not transfer from self account');

        const fromAllowanceMap = this.allowanceMap.get(from);
        const allowed: u256 = fromAllowanceMap.get(spender);
        if (allowed < value) throw new Revert(`Insufficient allowance ${allowed} < ${value}`);

        const newAllowance: u256 = SafeMath.sub(allowed, value);
        fromAllowanceMap.set(spender, newAllowance);

        this.allowanceMap.set(from, fromAllowanceMap);

        this._unsafeTransferFrom(from, to, value);

        return true;
    }

    protected createBurnEvent(value: u256): void {
        const burnEvent = new BurnEvent(value);

        this.emitEvent(burnEvent);
    }

    protected createApproveEvent(owner: Address, spender: Address, value: u256): void {
        const approveEvent = new ApproveEvent(owner, spender, value);

        this.emitEvent(approveEvent);
    }

    protected createMintEvent(owner: Address, value: u256): void {
        const mintEvent = new MintEvent(owner, value);

        this.emitEvent(mintEvent);
    }

    protected createTransferEvent(from: Address, to: Address, value: u256): void {
        const transferEvent = new TransferEvent(from, to, value);

        this.emitEvent(transferEvent);
    }
}

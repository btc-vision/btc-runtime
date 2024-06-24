import { IOP_0 } from './interfaces/IOP_0';
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
import { MintEvent } from '../../contract/events/MintEvent';
import { TransferEvent } from '../../contract/events/TransferEvent';
import { BurnEvent } from '../../contract/events/BurnEvent';
import { ApproveEvent } from '../../contract/events/ApproveEvent';

const allowanceSelector = encodeSelector('allowance');
const approveSelector = encodeSelector('approve');
const balanceOfSelector = encodeSelector('balanceOf');
const burnSelector = encodeSelector('burn');
const mintSelector = encodeSelector('mint');
const transferSelector = encodeSelector('transfer');
const transferFromSelector = encodeSelector('transferFrom');

export abstract class OP_20 extends OP_NET implements IOP_0 {
    public readonly decimals: u8 = 8;

    public readonly name: string = `OP_20`;
    public readonly symbol: string = `OP`;

    protected readonly allowanceMap: MultiAddressMemoryMap<Address, Address, MemorySlotData<u256>>;
    protected readonly balanceOfMap: AddressMemoryMap<Address, MemorySlotData<u256>>;

    protected constructor(
        public readonly maxSupply: u256,
    ) {
        super();

        this.allowanceMap = new MultiAddressMemoryMap<Address, Address, MemorySlotData<u256>>(
            Blockchain.nextPointer,
            Blockchain.contractAddress,
            u256.Zero,
        );
        this.balanceOfMap = new AddressMemoryMap<Address, MemorySlotData<u256>>(Blockchain.nextPointer, Blockchain.contractAddress, u256.Zero);

        const supplyPointer = Blockchain.nextPointer;
        const supply: u256 = Blockchain.getStorageAt(Blockchain.contractAddress, supplyPointer, u256.Zero, u256.Zero);
        this._totalSupply = new StoredU256(Blockchain.contractAddress, supplyPointer, u256.Zero, supply);
    }

    public _totalSupply: StoredU256;

    public get totalSupply(): u256 {
        return this._totalSupply.value;
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

        this.createApproveEvent(Blockchain.callee(), spender, value);

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
            case allowanceSelector:
                return this.allowance(calldata);
            case approveSelector:
                return this.approve(calldata);
            case balanceOfSelector:
                return this.balanceOf(calldata);
            case burnSelector:
                return this.burn(calldata);
            case mintSelector:
                return this.mint(calldata);
            case transferSelector:
                return this.transfer(calldata);
            case transferFromSelector:
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
                response.writeString(this.name);
                break;
            case encodeSelector('symbol'):
                response.writeString(this.symbol);
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
    protected _allowance(owner: string, spender: string): u256 {
        const senderMap = this.allowanceMap.get(owner);
        if (!senderMap.has(spender)) throw new Revert();

        return senderMap.get(spender);
    }

    protected _approve(spender: string, value: u256): boolean {
        const callee = Blockchain.callee();

        const senderMap = this.allowanceMap.get(callee);
        senderMap.set(spender, value);

        return true;
    }

    protected _balanceOf(owner: Address): u256 {
        const hasAddress = this.balanceOfMap.has(owner);
        if (!hasAddress) return u256.Zero;

        return this.balanceOfMap.get(owner);
    }

    protected _burn(value: u256): boolean {
        if (u256.eq(value, u256.Zero)) {
            throw new Revert(`No tokens`);
        }
        
        const callee = Blockchain.callee();
        const caller = Blockchain.caller();

        this.onlyOwner(callee); // only indexers can burn tokens

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

    protected _mint(to: Address, value: u256): boolean {
        const callee = Blockchain.callee();
        const caller = Blockchain.caller();

        this.onlyOwner(callee);

        if (caller !== callee) throw new Revert(`callee != caller`);
        if (callee !== this.owner) throw new Revert('Only indexers can mint tokens');

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
        const caller = Blockchain.callee();

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

        if (!this.balanceOfMap.has(to)) {
            this.balanceOfMap.set(to, value);
        } else {
            const toBalance: u256 = this.balanceOfMap.get(to);
            const newToBalance: u256 = SafeMath.add(toBalance, value);

            this.balanceOfMap.set(to, newToBalance);
        }

        this.createTransferEvent(caller, to, value);

        return true;
    }

    @unsafe
    protected _unsafeTransferFrom(from: Address, to: Address, value: u256): boolean {
        const balance: u256 = this.balanceOfMap.get(from);
        if (balance < value) throw new Revert(`TransferFrom insufficient balance of ${from} is ${balance} and value is ${value}`);

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
        if (!this.allowanceMap.has(from)) throw new Revert();

        const spender = Blockchain.callee();
        if (Blockchain.caller() !== from) {
            throw new Revert('Not caller.');
        }

        const fromAllowanceMap = this.allowanceMap.get(from);
        const allowed: u256 = fromAllowanceMap.get(spender);
        if (allowed < value) throw new Revert(`Insufficient allowance`);

        if (this.isSelf(spender)) throw new Revert('Can not transfer from self account');

        const senderMap = this.allowanceMap.get(from);
        if (!senderMap.has(spender)) throw new Revert();

        const allowance: u256 = senderMap.get(spender);
        if (allowance < value) throw new Revert(`Insufficient allowance`);

        const newAllowance: u256 = SafeMath.sub(allowance, value);
        senderMap.set(spender, newAllowance);

        this._unsafeTransferFrom(from, to, value);

        return true;
    }

    protected createBurnEvent(value: u256): void {
        const burnEvent = new BurnEvent(value);

        this.emitEvent(burnEvent);
    }

    private createApproveEvent(owner: Address, spender: Address, value: u256): void {
        const approveEvent = new ApproveEvent(owner, spender, value);

        this.emitEvent(approveEvent);
    }

    private createMintEvent(owner: Address, value: u256): void {
        const mintEvent = new MintEvent(owner, value);

        this.emitEvent(mintEvent);
    }

    private createTransferEvent(from: Address, to: Address, value: u256): void {
        const transferEvent = new TransferEvent(from, to, value);

        this.emitEvent(transferEvent);
    }
}

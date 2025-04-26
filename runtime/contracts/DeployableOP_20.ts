import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { ApproveEvent, BurnEvent, MintEvent, TransferEvent } from '../events/predefined';
import { encodeSelector, Selector } from '../math/abi';
import { StoredString } from '../storage/StoredString';
import { StoredU256 } from '../storage/StoredU256';
import { Address } from '../types/Address';
import { Revert } from '../types/Revert';
import { SafeMath } from '../types/SafeMath';

import { sha256 } from '../env/global';
import { EMPTY_POINTER } from '../math/bytes';
import { AddressMemoryMap } from '../memory/AddressMemoryMap';
import { MapOfMap } from '../memory/MapOfMap';
import { ApproveStr, TransferFromStr, TransferStr } from '../shared-libraries/TransferHelper';
import { Calldata } from '../types';
import { ADDRESS_BYTE_LENGTH, BOOLEAN_BYTE_LENGTH, U256_BYTE_LENGTH } from '../utils';
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

        // Initialize main storage structures
        this.allowanceMap = new MapOfMap(allowanceMapPointer);
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
        if (!this._maxSupply.value.isZero()) {
            throw new Revert('Already initialized');
        }

        if (!skipDeployerVerification) this.onlyDeployer(Blockchain.tx.sender);

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
        const response = new BytesWriter(U256_BYTE_LENGTH);
        const resp = this._allowance(callData.readAddress(), callData.readAddress());
        response.writeU256(resp);
        return response;
    }

    public approve(callData: Calldata): BytesWriter {
        const owner = Blockchain.tx.sender;
        const spender: Address = callData.readAddress();
        const value = callData.readU256();

        const resp = this._approve(owner, spender, value);

        const response = new BytesWriter(BOOLEAN_BYTE_LENGTH);
        response.writeBoolean(resp);
        return response;
    }

    public approveFrom(callData: Calldata): BytesWriter {
        // If the transaction is initiated directly by the owner, there is no need for an off-chain signature.
        if (Blockchain.tx.origin == Blockchain.tx.sender) {
            throw new Revert(
                'Direct owner approval detected. Use approve function instead of approveFrom.',
            );
        }

        const response = new BytesWriter(BOOLEAN_BYTE_LENGTH);

        const owner: Address = Blockchain.tx.origin;
        const spender: Address = callData.readAddress();
        const value: u256 = callData.readU256();
        const nonce: u256 = callData.readU256();

        const signature = callData.readBytesWithLength();
        if (signature.length !== 64) {
            throw new Revert('Invalid signature length');
        }

        const resp = this._approveFrom(owner, spender, value, nonce, signature);
        response.writeBoolean(resp);

        return response;
    }

    /**
     * Returns the current nonce for a given owner.
     */
    public nonceOf(callData: Calldata): BytesWriter {
        const owner = callData.readAddress();
        const currentNonce = this._nonceMap.get(owner);

        const response = new BytesWriter(32);
        response.writeU256(currentNonce);

        return response;
    }

    public balanceOf(callData: Calldata): BytesWriter {
        const response = new BytesWriter(U256_BYTE_LENGTH);
        const address: Address = callData.readAddress();

        const resp = this._balanceOf(address);
        response.writeU256(resp);

        return response;
    }

    public burn(callData: Calldata): BytesWriter {
        const response = new BytesWriter(BOOLEAN_BYTE_LENGTH);
        const resp = this._burn(callData.readU256());
        response.writeBoolean(resp);

        return response;
    }

    public transfer(callData: Calldata): BytesWriter {
        const response = new BytesWriter(BOOLEAN_BYTE_LENGTH);
        const resp = this._transfer(callData.readAddress(), callData.readU256());
        response.writeBoolean(resp);

        return response;
    }

    public transferFrom(callData: Calldata): BytesWriter {
        const response = new BytesWriter(BOOLEAN_BYTE_LENGTH);
        const resp = this._transferFrom(
            callData.readAddress(),
            callData.readAddress(),
            callData.readU256(),
        );

        response.writeBoolean(resp);
        return response;
    }

    public execute(method: Selector, calldata: Calldata): BytesWriter {
        let response: BytesWriter;

        switch (method) {
            case encodeSelector('decimals'):
                response = new BytesWriter(BOOLEAN_BYTE_LENGTH);
                response.writeU8(this.decimals);
                break;
            case encodeSelector('name'):
                response = new BytesWriter(this.name.length + 2);
                response.writeStringWithLength(this.name);
                break;
            case encodeSelector('symbol'):
                response = new BytesWriter(this.symbol.length + 2);
                response.writeStringWithLength(this.symbol);
                break;
            case encodeSelector('totalSupply'):
                response = new BytesWriter(U256_BYTE_LENGTH);
                response.writeU256(this.totalSupply);
                break;
            case encodeSelector('maximumSupply'):
                response = new BytesWriter(U256_BYTE_LENGTH);
                response.writeU256(this.maxSupply);
                break;
            case encodeSelector('allowance(address,address)'):
                return this.allowance(calldata);
            case encodeSelector(ApproveStr):
                return this.approve(calldata);
            case encodeSelector('approveFrom(address,uint256,uint256,bytes)'):
                return this.approveFrom(calldata);
            case encodeSelector('balanceOf(address)'):
                return this.balanceOf(calldata);
            case encodeSelector('burn(uint256)'):
                return this.burn(calldata);
            case encodeSelector(TransferStr):
                return this.transfer(calldata);
            case encodeSelector(TransferFromStr):
                return this.transferFrom(calldata);

            case encodeSelector('nonceOf(address)'):
                return this.nonceOf(calldata);

            default:
                return super.execute(method, calldata);
        }

        return response;
    }

    /** REDEFINED METHODS */
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
    ): boolean {
        if (owner === Blockchain.DEAD_ADDRESS) {
            throw new Revert('Address can not be dead address');
        }

        if (spender === Blockchain.DEAD_ADDRESS) {
            throw new Revert('Spender cannot be dead address');
        }

        // Ensure the nonce matches what we have stored on-chain
        const storedNonce = this._nonceMap.get(owner);
        if (!u256.eq(storedNonce, nonce)) {
            throw new Revert('Invalid nonce (possible replay or out-of-sync)');
        }

        // Build the hash to match exactly what the user signed, including the nonce
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
            throw new Revert('ApproveFrom: Invalid signature');
        }

        // If valid, increment the nonce so this signature can't be reused
        this._nonceMap.set(owner, SafeMath.add(storedNonce, u256.One));

        // Update allowance
        const senderMap = this.allowanceMap.get(owner);
        senderMap.set(spender, value);

        // Emit event
        this.createApproveEvent(owner, spender, value);
        return true;
    }

    protected _approve(owner: Address, spender: Address, value: u256): boolean {
        if (owner === Blockchain.DEAD_ADDRESS) {
            throw new Revert('Address can not be dead address');
        }

        if (spender === Blockchain.DEAD_ADDRESS) {
            throw new Revert('Spender cannot be dead address');
        }

        const senderMap = this.allowanceMap.get(owner);
        senderMap.set(spender, value);

        this.createApproveEvent(owner, spender, value);
        return true;
    }

    protected _balanceOf(owner: Address): u256 {
        if (!this.balanceOfMap.has(owner)) return u256.Zero;

        return this.balanceOfMap.get(owner);
    }

    protected _burn(value: u256, onlyDeployer: boolean = true): boolean {
        if (u256.eq(value, u256.Zero)) {
            throw new Revert(`No tokens`);
        }

        if (onlyDeployer) this.onlyDeployer(Blockchain.tx.sender);
        if (this._totalSupply.value < value) throw new Revert(`Insufficient total supply.`);
        if (!this.balanceOfMap.has(Blockchain.tx.sender)) throw new Revert('No balance');

        const balance: u256 = this.balanceOfMap.get(Blockchain.tx.sender);
        if (balance < value) throw new Revert(`Insufficient balance`);

        const newBalance: u256 = SafeMath.sub(balance, value);
        this.balanceOfMap.set(Blockchain.tx.sender, newBalance);

        // @ts-expect-error This is valid AssemblyScript but can trip TS
        this._totalSupply -= value;

        this.createBurnEvent(value);
        return true;
    }

    protected _mint(to: Address, value: u256, onlyDeployer: boolean = true): boolean {
        if (onlyDeployer) this.onlyDeployer(Blockchain.tx.sender);

        if (!this.balanceOfMap.has(to)) {
            this.balanceOfMap.set(to, value);
        } else {
            const toBalance: u256 = this.balanceOfMap.get(to);
            const newToBalance: u256 = SafeMath.add(toBalance, value);
            this.balanceOfMap.set(to, newToBalance);
        }

        // @ts-expect-error This is valid AssemblyScript but can trip TS
        this._totalSupply += value;

        if (this._totalSupply.value > this.maxSupply) throw new Revert('Max supply reached');
        this.createMintEvent(to, value);
        return true;
    }

    protected _transfer(to: Address, value: u256): boolean {
        const sender = Blockchain.tx.sender;
        if (this.isSelf(sender)) throw new Revert('Can not transfer from self account');
        if (u256.eq(value, u256.Zero)) {
            throw new Revert(`Cannot transfer 0 tokens`);
        }

        const balance: u256 = this.balanceOfMap.get(sender);
        if (balance < value) throw new Revert(`Insufficient balance`);

        const newBalance: u256 = SafeMath.sub(balance, value);
        this.balanceOfMap.set(sender, newBalance);

        const toBalance: u256 = this.balanceOfMap.get(to);
        const newToBalance: u256 = SafeMath.add(toBalance, value);
        this.balanceOfMap.set(to, newToBalance);

        this.createTransferEvent(sender, to, value);
        return true;
    }

    @unsafe
    protected _unsafeTransferFrom(from: Address, to: Address, value: u256): boolean {
        const balance: u256 = this.balanceOfMap.get(from);
        if (balance < value) {
            throw new Revert(
                `TransferFrom insufficient balance of ${from.toHex()} is ${balance} and value is ${value}`,
            );
        }

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
        if (from === Blockchain.DEAD_ADDRESS) {
            throw new Revert('Cannot transfer to or from dead address');
        }

        this._spendAllowance(from, Blockchain.tx.sender, value);
        this._unsafeTransferFrom(from, to, value);

        return true;
    }

    protected _spendAllowance(owner: Address, spender: Address, value: u256): void {
        const ownerAllowanceMap = this.allowanceMap.get(owner);
        const allowed: u256 = ownerAllowanceMap.get(spender);

        if (allowed < value) {
            throw new Revert(
                `Insufficient allowance ${allowed} < ${value}. Spender: ${spender} - Owner: ${owner}`,
            );
        }

        const newAllowance: u256 = SafeMath.sub(allowed, value);
        ownerAllowanceMap.set(spender, newAllowance);

        this.allowanceMap.set(owner, ownerAllowanceMap);
    }

    protected createBurnEvent(value: u256): void {
        const burnEvent = new BurnEvent(value);
        this.emitEvent(burnEvent);
    }

    protected createApproveEvent(owner: Address, spender: Address, value: u256): void {
        const approveEvent = new ApproveEvent(owner, spender, value);
        this.emitEvent(approveEvent);
    }

    protected createMintEvent(recipient: Address, value: u256): void {
        const mintEvent = new MintEvent(recipient, value);
        this.emitEvent(mintEvent);
    }

    protected createTransferEvent(from: Address, to: Address, value: u256): void {
        const transferEvent = new TransferEvent(from, to, value);
        this.emitEvent(transferEvent);
    }
}

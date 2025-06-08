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
import { ADDRESS_BYTE_LENGTH, U256_BYTE_LENGTH, U64_BYTE_LENGTH } from '../utils';
import { IOP_20 } from './interfaces/IOP_20';
import { OP20InitParameters } from './interfaces/OP20InitParameters';
import { OP_NET } from './OP_NET';

// onOP20Received(address,address,uint256,bytes)
const ON_OP_20_RECEIVED_SELECTOR: u32 = 0xd83e7dbc;

// sha256("OP712Domain(string name,string version,uint64 chainId,address verifyingContract)")
const DOMAIN_TYPE_HASH: number[] = [0xe6, 0x0e, 0xd6, 0xa2, 0xd1, 0x1c, 0x66, 0x73, 0x59, 0x0e, 0xfe, 0x77, 0x21, 0x29, 0x9d, 0xe1, 0x6a, 0x36, 0x05, 0xd4, 0x39, 0x28, 0x18, 0x09, 0x3f, 0x8d, 0xdc, 0xef, 0xd1, 0x61, 0x27, 0x04];

// sha256("OP20AllowanceIncrease(address owner,address spender,uint256 amount,uint256 nonce,uint64 deadline)")
const ALLOWANCE_INCREASE_TYPE_HASH: number[] = [0x7e, 0x88, 0x02, 0xf1, 0xfd, 0x23, 0xe1, 0x0e, 0x0d, 0xde, 0x3f, 0x00, 0xc0, 0xaa, 0x48, 0x15, 0xd8, 0x85, 0xec, 0xd9, 0xcd, 0xa0, 0xdf, 0x56, 0xff, 0xa2, 0x5e, 0xcc, 0x70, 0x2d, 0x45, 0x8e];

// sha256("OP20AllowanceDecrease(address owner,address spender,uint256 amount,uint256 nonce,uint64 deadline)")
const ALLOWANCE_DECREASE_TYPE_HASH: number[] = [0x70, 0x87, 0x99, 0x34, 0x92, 0x1c, 0x2f, 0x48, 0x17, 0x78, 0x87, 0x89, 0x77, 0xd5, 0xb4, 0x5e, 0x2a, 0x59, 0xda, 0x1d, 0x28, 0x22, 0x41, 0xc9, 0x3f, 0xf1, 0xba, 0x6a, 0xf0, 0x98, 0xfc, 0xd0];

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

    /** Intentionally public for inherited classes */
    public _totalSupply: StoredU256;

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

    @method({ name: 'owner', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'balance', type: ABIDataTypes.UINT256 })
    public balanceOf(calldata: Calldata): BytesWriter {
        const bal = this._balanceOf(calldata.readAddress());
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(bal);
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

    @method({ name: 'owner', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'nonce', type: ABIDataTypes.UINT256 })
    public nonceOf(calldata: Calldata): BytesWriter {
        const current = this._nonceMap.get(calldata.readAddress());
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(current);
        return w;
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

    @method(
        { name: 'spender', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @emit('Approve')
    public increaseAllowance(calldata: Calldata): BytesWriter {
        const owner: Address = Blockchain.tx.sender;
        const spender: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();

        if (owner === Blockchain.DEAD_ADDRESS) throw new Revert('Address can not be dead');
        if (spender === Blockchain.DEAD_ADDRESS) throw new Revert('Spender can not be dead');

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

        if (owner === Blockchain.DEAD_ADDRESS) throw new Revert('Address can not be dead');
        if (spender === Blockchain.DEAD_ADDRESS) throw new Revert('Spender can not be dead');

        this._decreaseAllowance(owner, spender, amount);
        return new BytesWriter(0);
    }

    @method(
        { name: 'spender', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
        { name: 'deadline', type: ABIDataTypes.UINT64 },
        { name: 'signature', type: ABIDataTypes.BYTES },
    )
    @emit('Approve')
    public increaseAllowanceBySignature(calldata: Calldata): BytesWriter {
        const owner: Address = Blockchain.tx.origin;
        const spender: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();
        const deadline: u64 = calldata.readU64();
        const signature = calldata.readBytesWithLength();

        if (owner === Blockchain.DEAD_ADDRESS) throw new Revert('Address can not be dead');
        if (spender === Blockchain.DEAD_ADDRESS) throw new Revert('Spender can not be dead');
        if (signature.length !== 64) throw new Revert('Invalid signature length');

        this._increaseAllowanceBySignature(owner, spender, amount, deadline, signature);
        return new BytesWriter(0);
    }

    @method(
        { name: 'spender', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
        { name: 'deadline', type: ABIDataTypes.UINT64 },
        { name: 'signature', type: ABIDataTypes.BYTES },
    )
    @emit('Approve')
    public decreaseAllowanceBySignature(calldata: Calldata): BytesWriter {
        const owner: Address = Blockchain.tx.origin;
        const spender: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();
        const deadline: u64 = calldata.readU64();
        const signature = calldata.readBytesWithLength();

        if (owner === Blockchain.DEAD_ADDRESS) throw new Revert('Address can not be dead');
        if (spender === Blockchain.DEAD_ADDRESS) throw new Revert('Spender can not be dead');
        if (signature.length !== 64) throw new Revert('Invalid signature length');

        this._decreaseAllowanceBySignature(owner, spender, amount, deadline, signature);
        return new BytesWriter(0);
    }

    @method({ name: 'amount', type: ABIDataTypes.UINT256 })
    @emit('Burn')
    public burn(calldata: Calldata): BytesWriter {
        this._burn(calldata.readU256());
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

    protected _transfer(to: Address, amount: u256, data: Uint8Array): void {
        const sender = Blockchain.tx.sender;
        if (this.isSelf(sender)) throw new Revert('Cannot transfer from self');
        if (u256.eq(amount, u256.Zero)) throw new Revert('Cannot transfer 0');

        const balance: u256 = this.balanceOfMap.get(sender);
        if (balance < amount) throw new Revert('Insufficient balance');

        this.balanceOfMap.set(sender, SafeMath.sub(balance, amount));

        const toBal: u256 = this.balanceOfMap.get(to);
        this.balanceOfMap.set(to, SafeMath.add(toBal, amount));

        this.createTransferEvent(sender, to, amount);

        if (Blockchain.isContract(to)) {
            this._callOnOP20Received(sender, sender, amount, data);
        }
    }

    protected _transferFrom(from: Address, to: Address, amount: u256, data: Uint8Array): void {
        if (from === Blockchain.DEAD_ADDRESS) throw new Revert('Cannot transfer from dead address');

        this._spendAllowance(from, Blockchain.tx.sender, amount);
        this._unsafeTransferFrom(from, to, amount, data);
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

    @unsafe
    protected _unsafeTransferFrom(from: Address, to: Address, amount: u256, data: Uint8Array): void {
        const balance: u256 = this.balanceOfMap.get(from);
        if (balance < amount) {
            throw new Revert(`TransferFrom insufficient balance`);
        }

        this.balanceOfMap.set(from, SafeMath.sub(balance, amount));

        if (!this.balanceOfMap.has(to)) {
            this.balanceOfMap.set(to, amount);
        } else {
            const toBal: u256 = this.balanceOfMap.get(to);
            this.balanceOfMap.set(to, SafeMath.add(toBal, amount));
        }

        this.createTransferEvent(from, to, amount);

        if (Blockchain.isContract(to)) {
            const sender = Blockchain.tx.sender;
            this._callOnOP20Received(sender, from, amount, data);
        }
    }

    protected _callOnOP20Received(operator: Address, from: Address, amount: u256, data: Uint8Array) {
        const calldata = new BytesWriter(data.length);
        calldata.writeSelector(ON_OP_20_RECEIVED_SELECTOR);
        calldata.writeAddress(from);
        calldata.writeAddress(from);
        calldata.writeU256(amount);
        calldata.writeBytes(data);

        const response = Blockchain.call(operator, calldata);

        const retval = response.readU32();

        if (retval !== ON_OP_20_RECEIVED_SELECTOR) {
            throw new Revert('Invalid response from recipient');
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

    protected _verifySignature(typeHash: u8[], owner: Address, spender: Address, amount: u256, deadline: u64, signature: Uint8Array) {
        if (Blockchain.block.number > deadline) {
            throw new Revert('Signature expired');
        }

        const nonce = this._nonceMap.get(owner);

        const structWriter = new BytesWriter(
            32 + ADDRESS_BYTE_LENGTH * 2 + U256_BYTE_LENGTH + U256_BYTE_LENGTH + U64_BYTE_LENGTH,
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
        const writer = new BytesWriter(32 * 5);
        writer.writeBytesU8Array(DOMAIN_TYPE_HASH);
        writer.writeBytes(sha256(this.stringToBytes(this.name)));
        writer.writeBytes(sha256(this.stringToBytes('1')));
        writer.writeBytesU8Array(
            // Bitcoin mainnet chain ID
            [0x00, 0x00, 0x00, 0x00, 0x00, 0x19, 0xd6, 0x68, 0x9c, 0x08, 0x5a, 0xe1, 0x65, 0x83, 0x1e, 0x93, 0x4f, 0xf7, 0x63, 0xae, 0x46, 0xa2, 0xa6, 0xc1, 0x72, 0xb3, 0xf1, 0xb6, 0x0a, 0x8c, 0xe2, 0x6f],
        );
        writer.writeAddress(this.address);

        return sha256(writer.getBuffer());
    }

    protected _increaseAllowance(owner: Address, spender: Address, amount: u256): void {
        const senderMap = this.allowanceMap.get(owner);
        const previousAllowance = senderMap.get(spender);
        let newAllowance: u256 = u256.add(previousAllowance, amount);
        // If it overflows, set to max
        if (newAllowance < previousAllowance) {
            newAllowance = u256.Max;
        }
        senderMap.set(spender, newAllowance);

        this.createApproveEvent(owner, spender, amount);
    }

    protected _decreaseAllowance(owner: Address, spender: Address, amount: u256): void {
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

        this.createApproveEvent(owner, spender, amount);
    }

    protected _mint(to: Address, amount: u256, onlyDeployer: boolean = true): void {
        if (onlyDeployer) this.onlyDeployer(Blockchain.tx.sender);

        if (!this.balanceOfMap.has(to)) {
            this.balanceOfMap.set(to, amount);
        } else {
            const toBal: u256 = this.balanceOfMap.get(to);
            this.balanceOfMap.set(to, SafeMath.add(toBal, amount));
        }

        // @ts-expect-error AssemblyScript valid
        this._totalSupply += amount;

        if (this._totalSupply.value > this.maxSupply) throw new Revert('Max supply reached');
        this.createMintEvent(to, amount);
    }

    protected _burn(amount: u256, onlyDeployer: boolean = true): void {
        if (u256.eq(amount, u256.Zero)) throw new Revert('No tokens');

        if (onlyDeployer) this.onlyDeployer(Blockchain.tx.sender);
        if (this._totalSupply.value < amount) throw new Revert('Insufficient supply');
        if (!this.balanceOfMap.has(Blockchain.tx.sender)) throw new Revert('No balance');

        const balance: u256 = this.balanceOfMap.get(Blockchain.tx.sender);
        if (balance < amount) throw new Revert('Insufficient balance');

        const newBalance: u256 = SafeMath.sub(balance, amount);
        this.balanceOfMap.set(Blockchain.tx.sender, newBalance);

        // @ts-expect-error AssemblyScript valid
        this._totalSupply -= amount;

        this.createBurnEvent(amount);
    }

    protected stringToBytes(str: string): Uint8Array {
        const bytes = String.UTF8.encode(str);
        return Uint8Array.wrap(bytes);
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

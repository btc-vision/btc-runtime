import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesReader } from '../buffer/BytesReader';
import { BytesWriter } from '../buffer/BytesWriter';
import { OP_NET } from '../contracts/OP_NET';
import { NetEvent } from '../events/NetEvent';
import { MapU256 } from '../generic/MapU256';
import { Potential } from '../lang/Definitions';
import { MemorySlotData } from '../memory/MemorySlot';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { PointerStorage } from '../types';
import { Address } from '../types/Address';
import { ADDRESS_BYTE_LENGTH } from '../utils';
import { Block } from './classes/Block';
import { Transaction } from './classes/Transaction';
import {
    callContract,
    deployFromAddress,
    emit,
    encodeAddress,
    getCallResult,
    loadPointer,
    log,
    storePointer,
    validateBitcoinAddress,
    verifySchnorrSignature,
} from './global';

export * from '../env/global';

export function runtimeError(msg: string): Error {
    return new Error(`RuntimeException: ${msg}`);
}

@final
export class BlockchainEnvironment {
    private static readonly MAX_U16: u16 = 65535;

    public readonly DEAD_ADDRESS: Address = Address.dead();

    private storage: PointerStorage = new MapU256();
    private _selfContract: Potential<OP_NET> = null;

    private _block: Potential<Block> = null;

    @inline
    public get block(): Block {
        if (!this._block) {
            throw this.error('Block is required');
        }

        return this._block as Block;
    }

    private _tx: Potential<Transaction> = null;

    @inline
    public get tx(): Transaction {
        if (!this._tx) {
            throw this.error('Transaction is required');
        }

        return this._tx as Transaction;
    }

    private _contract: Potential<() => OP_NET> = null;

    public get contract(): OP_NET {
        this.createContractIfNotExists();

        return this._selfContract as OP_NET;
    }

    public set contract(contract: () => OP_NET) {
        this._contract = contract;
    }

    private _nextPointer: u16 = 0;

    public get nextPointer(): u16 {
        if (this._nextPointer === BlockchainEnvironment.MAX_U16) {
            throw this.error(`Out of storage pointer.`);
        }

        this._nextPointer += 1;

        return this._nextPointer;
    }

    public _contractDeployer: Potential<Address> = null;

    public get contractDeployer(): Address {
        if (!this._contractDeployer) {
            throw this.error('Deployer is required');
        }

        return this._contractDeployer as Address;
    }

    public _contractAddress: Potential<Address> = null;

    public get contractAddress(): Address {
        if (!this._contractAddress) {
            throw this.error('Contract address is required');
        }

        return this._contractAddress as Address;
    }

    public setEnvironment(data: Uint8Array): void {
        const reader: BytesReader = new BytesReader(data);

        this._tx = new Transaction(
            reader.readAddress(),
            reader.readAddress(),
            reader.readBytes(32),
        );

        const currentBlock = reader.readU256();

        this._contractDeployer = reader.readAddress();
        this._contractAddress = reader.readAddress();

        const medianTimestamp = reader.readU64();
        const safeRnd64 = reader.readU64();

        this._block = new Block(currentBlock, medianTimestamp, safeRnd64);

        this.createContractIfNotExists();
    }

    public call(destinationContract: Address, calldata: BytesWriter): BytesReader {
        if (destinationContract === this.contractAddress) {
            throw this.error('Cannot call self');
        }

        if (!destinationContract) {
            throw this.error('Destination contract is required');
        }

        let resultLengthBuffer = new ArrayBuffer(32);
        callContract(destinationContract.buffer, calldata.getBuffer().buffer, calldata.bufferLength(), resultLengthBuffer);
        let reader = new BytesReader(Uint8Array.wrap(resultLengthBuffer));
        let resultLength = reader.readU32(false);
        let resultBuffer = new ArrayBuffer(resultLength);
        getCallResult(0, resultLength, resultBuffer);

        return new BytesReader(Uint8Array.wrap(resultBuffer));
    }

    public log(data: string): void {
        const writer = new BytesWriter(data.length + 2);
        writer.writeStringWithLength(data);

        const buffer = writer.getBuffer();
        log(buffer);
    }

    public emit(event: NetEvent): void {
        const data = event.getEventData();
        const writer = new BytesWriter(event.eventType.length + 6 + data.byteLength);

        writer.writeStringWithLength(event.eventType);
        writer.writeBytesWithLength(data);

        emit(writer.getBuffer().buffer, writer.bufferLength());
    }

    public validateBitcoinAddress(address: string): bool {
        const writer = new BytesWriter(address.length);
        writer.writeString(address);

        let result = validateBitcoinAddress(writer.getBuffer().buffer, address.length);

        return result === 1;
    }

    public encodeVirtualAddress(virtualAddress: u8[]): Address {
        const writer: BytesWriter = new BytesWriter(virtualAddress.length + 4);
        writer.writeU32(virtualAddress.length);
        writer.writeBytesU8Array(virtualAddress);

        const buffer: Uint8Array = writer.getBuffer();
        const cb: Potential<Uint8Array> = encodeAddress(buffer);
        if (!cb) throw this.error('Failed to encode virtual address');

        const reader: BytesReader = new BytesReader(cb as Uint8Array);
        return reader.readAddress();
    }

    /*public deployContract(hash: u256, bytecode: Uint8Array): DeployContractResponse {
        const writer = new BytesWriter(U256_BYTE_LENGTH + bytecode.length);
        writer.writeU256(hash);
        writer.writeBytes(bytecode);

        const cb: Potential<Uint8Array> = deploy(writer.getBuffer());
        if (!cb) throw this.error('Failed to deploy contract');

        const reader: BytesReader = new BytesReader(cb as Uint8Array);
        const virtualAddress: u256 = reader.readU256();
        const contractAddress: Address = reader.readAddress();

        return new DeployContractResponse(virtualAddress, contractAddress);
    }*/

    public deployContractFromExisting(
        existingAddress: Address,
        salt: u256,
    ): Address {
        const resultAddressBuffer = new ArrayBuffer(ADDRESS_BYTE_LENGTH);

        const status = deployFromAddress(
            existingAddress.buffer,
            salt.toUint8Array(true).buffer,
            resultAddressBuffer,
        );

        if (status !== 0) {
            throw this.error('Failed to deploy contract');
        }

        const contractAddressReader = new BytesReader(Uint8Array.wrap(resultAddressBuffer));
        return contractAddressReader.readAddress();
    }

    // TODO: Change MemorySlotData type to a Uint8Array instead of a u256.
    public getStorageAt(
        pointerHash: MemorySlotPointer,
        defaultValue: MemorySlotData<u256>,
    ): MemorySlotData<u256> {
        this.ensureStorageAtPointer(pointerHash, defaultValue);

        if (this.storage.has(pointerHash)) {
            return this.storage.get(pointerHash);
        }

        return defaultValue;
    }

    /*public getNextPointerGreaterThan(
        targetPointer: MemorySlotPointer,
        valueAtLeast: u256,
        lte: boolean = true,
    ): MemorySlotData<u256> {
        const writer = new BytesWriter(U256_BYTE_LENGTH * 2 + BOOLEAN_BYTE_LENGTH);
        writer.writeU256(targetPointer);
        writer.writeU256(valueAtLeast);
        writer.writeBoolean(lte);

        const result: Uint8Array = nextPointerGreaterThan(writer.getBuffer());
        const reader: BytesReader = new BytesReader(result);

        return reader.readU256();
    }*/

    public verifySchnorrSignature(
        publicKey: Address,
        signature: Uint8Array,
        hash: Uint8Array,
    ): boolean {
        const result: u32 = verifySchnorrSignature(publicKey.buffer, signature.buffer, hash.buffer);
        return result === 1;
    }

    // TODO: Change MemorySlotData type to a Uint8Array instead of a u256.
    public hasStorageAt(pointerHash: MemorySlotPointer): bool {
        // We mark zero as the default value for the storage, if something is 0, the storage slot get deleted or is non-existent
        const val: u256 = this.getStorageAt(pointerHash, u256.Zero);

        return u256.ne(val, u256.Zero);
    }

    public setStorageAt(pointerHash: MemorySlotPointer, value: MemorySlotData<u256>): void {
        this._internalSetStorageAt(pointerHash, value);
    }

    private createContractIfNotExists(): void {
        if (!this._contract) {
            throw this.error('Contract is required');
        }

        if (!this._selfContract) {
            this._selfContract = this._contract();
        }
    }

    private error(msg: string): Error {
        return runtimeError(msg);
    }

    private _internalSetStorageAt(pointerHash: u256, value: MemorySlotData<u256>): void {
        this.storage.set(pointerHash, value);

        storePointer(pointerHash.toUint8Array(true).buffer, value.toUint8Array(true).buffer);
    }

    private hasPointerStorageHash(pointer: MemorySlotPointer): bool {
        if (this.storage.has(pointer)) {
            return true;
        }

        // we attempt to load the requested pointer.
        let resultBuffer = new ArrayBuffer(32);
        loadPointer(pointer.toUint8Array(true).buffer, resultBuffer);

        const value: u256 = u256.fromUint8ArrayBE(Uint8Array.wrap(resultBuffer));
        this.storage.set(pointer, value); // cache the value

        return !u256.eq(value, u256.Zero);
    }

    private ensureStorageAtPointer(
        pointerHash: MemorySlotPointer,
        defaultValue: MemorySlotData<u256>,
    ): void {
        if (this.hasPointerStorageHash(pointerHash)) {
            return;
        }

        if (u256.eq(defaultValue, u256.Zero)) {
            return;
        }

        this._internalSetStorageAt(pointerHash, defaultValue);
    }
}

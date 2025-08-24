import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesReader } from '../buffer/BytesReader';
import { BytesWriter } from '../buffer/BytesWriter';
import { OP_NET } from '../contracts/OP_NET';
import { NetEvent } from '../events/NetEvent';
import { Potential } from '../lang/Definitions';
import { Address } from '../types/Address';
import { ADDRESS_BYTE_LENGTH } from '../utils';
import { Block } from './classes/Block';
import { Transaction } from './classes/Transaction';
import {
    callContract,
    deployFromAddress,
    emit,
    env_exit,
    getAccountType,
    getBlockHash,
    getCallResult,
    loadPointer,
    log,
    sha256,
    storePointer,
    tLoadPointer,
    tStorePointer,
    validateBitcoinAddress,
    verifySchnorrSignature,
} from './global';
import { eqUint, MapUint8Array } from '../generic/MapUint8Array';
import { EMPTY_BUFFER } from '../math/bytes';
import { Plugin } from '../plugins/Plugin';
import { Calldata } from '../types';
import { Revert } from '../types/Revert';
import { Selector } from '../math/abi';
import { Network, Networks } from '../script/Networks';

export * from '../env/global';

/**
 * CallResult encapsulates the outcome of a cross-contract call.
 * Contains both a success flag and the response data, enabling try-catch patterns.
 */
@final
export class CallResult {
    constructor(
        public readonly success: boolean,
        public readonly data: BytesReader,
    ) {}
}

/**
 * BlockchainEnvironment - Core Runtime Environment for OP_NET Smart Contracts
 *
 * Provides the interface between smart contracts and the blockchain runtime,
 * managing storage, cross-contract calls, cryptographic operations, and execution context.
 *
 * @module BlockchainEnvironment
 */
@final
export class BlockchainEnvironment {
    /**
     * Standard dead address for burn operations.
     * Assets sent here are permanently unrecoverable.
     */
    public readonly DEAD_ADDRESS: Address = Address.dead();

    private storage: MapUint8Array = new MapUint8Array();
    private transientStorage: MapUint8Array = new MapUint8Array();
    private _selfContract: Potential<OP_NET> = null;
    private _plugins: Plugin[] = [];
    private _network: Networks = Networks.Unknown;

    /**
     * Returns the current blockchain network identifier.
     *
     * @returns The network enum value (Mainnet, Testnet, etc.)
     * @throws {Revert} When network is not initialized
     *
     * @remarks
     * Determines address validation rules and network-specific constants.
     */
    @inline
    public get network(): Networks {
        if (this._network === Networks.Unknown) {
            throw new Revert('Network is required');
        }
        return this._network as Networks;
    }

    private _block: Potential<Block> = null;

    /**
     * Provides access to current block information.
     *
     * @returns Block object containing hash, number, and median time
     * @throws {Revert} When block context is not initialized
     *
     * @warning Block timestamps can vary ±900 seconds. Use median time for reliability.
     *          Never use block properties for randomness generation.
     *
     * @example
     * ```typescript
     * const currentBlock = Blockchain.block;
     * const blockNumber = currentBlock.number;
     * const blockTime = currentBlock.medianTime;
     * ```
     */
    @inline
    public get block(): Block {
        if (!this._block) {
            throw new Revert('Block is required');
        }
        return this._block as Block;
    }

    private _tx: Potential<Transaction> = null;

    /**
     * Provides access to current transaction information.
     *
     * @returns Transaction object with caller, origin, and tx identifiers
     * @throws {Revert} When transaction context is not initialized
     *
     * @warning tx.caller = immediate calling contract (changes in call chain)
     *          tx.origin = original transaction initiator (stays constant)
     *          Using tx.origin for authentication is usually wrong.
     *
     * @example
     * ```typescript
     * const tx = Blockchain.tx;
     * const directCaller = tx.caller;    // Who called this function
     * const txInitiator = tx.origin;     // Who started the transaction
     * ```
     */
    @inline
    public get tx(): Transaction {
        if (!this._tx) {
            throw new Revert('Transaction is required');
        }
        return this._tx as Transaction;
    }

    private _contract: Potential<() => OP_NET> = null;

    /**
     * Returns the current contract instance.
     *
     * @returns The initialized OP_NET contract
     */
    public get contract(): OP_NET {
        return this._selfContract as OP_NET;
    }

    /**
     * Sets the contract factory function for lazy initialization.
     *
     * @param contract - Factory function that creates the contract instance
     */
    public set contract(contract: () => OP_NET) {
        this._contract = contract;
        this.createContractIfNotExists();
    }

    private _nextPointer: u16 = 0;

    /**
     * Generates the next available storage pointer.
     *
     * @returns Unique pointer value for storage allocation
     * @throws {Revert} When pointer space is exhausted (after 65,535 allocations)
     *
     * @warning Limited to 65,535 storage slots per contract.
     *          Use mappings for dynamic data to avoid exhaustion.
     *
     * @example
     * ```typescript
     * const ptr = Blockchain.nextPointer; // Gets next unique pointer
     * ```
     */
    public get nextPointer(): u16 {
        if (this._nextPointer === u16.MAX_VALUE) {
            throw new Revert(`Out of storage pointer.`);
        }
        this._nextPointer += 1;
        return this._nextPointer;
    }

    public _contractDeployer: Potential<Address> = null;

    /**
     * Returns the address that deployed this contract.
     *
     * @returns Deployer's address
     * @throws {Revert} When deployer is not set
     *
     * @remarks
     * Immutable after deployment. Often used for admin privileges.
     */
    public get contractDeployer(): Address {
        if (!this._contractDeployer) {
            throw new Revert('Deployer is required');
        }
        return this._contractDeployer as Address;
    }

    public _contractAddress: Potential<Address> = null;

    /**
     * Returns this contract's own address.
     *
     * @returns Current contract address
     * @throws {Revert} When address is not initialized
     *
     * @example
     * ```typescript
     * const selfAddress = Blockchain.contractAddress;
     * if (caller.equals(selfAddress)) {
     *     // Recursive call detected
     * }
     * ```
     */
    public get contractAddress(): Address {
        if (!this._contractAddress) {
            throw new Revert('Contract address is required');
        }
        return this._contractAddress as Address;
    }

    public _chainId: Potential<Uint8Array> = null;

    /**
     * Returns the blockchain's unique chain identifier.
     *
     * @returns 32-byte chain ID
     * @throws {Revert} When chain ID is not set
     *
     * @remarks
     * Used for replay protection and cross-chain message verification.
     */
    public get chainId(): Uint8Array {
        if (!this._chainId) {
            throw new Revert('Chain id is required');
        }
        return this._chainId as Uint8Array;
    }

    public _protocolId: Potential<Uint8Array> = null;

    /**
     * Returns the protocol version identifier.
     *
     * @returns 32-byte protocol ID
     * @throws {Revert} When protocol ID is not set
     */
    public get protocolId(): Uint8Array {
        if (!this._protocolId) {
            throw new Revert('Protocol id is required');
        }
        return this._protocolId as Uint8Array;
    }

    /**
     * Registers a plugin to extend contract functionality.
     *
     * @param plugin - Plugin instance to register
     *
     * @remarks
     * Plugins execute in registration order and have full access to contract state.
     */
    public registerPlugin(plugin: Plugin): void {
        this._plugins.push(plugin);
    }

    /**
     * Handles contract deployment initialization.
     *
     * @param calldata - Deployment parameters
     *
     * @remarks
     * Called once during deployment. State changes here are permanent.
     */
    public onDeployment(calldata: Calldata): void {
        for (let i: i32 = 0; i < this._plugins.length; i++) {
            const plugin = this._plugins[i];
            plugin.onDeployment(calldata);
        }
        this.contract.onDeployment(calldata);
    }

    /**
     * Pre-execution hook called before method execution.
     *
     * @param selector - Method selector being called
     * @param calldata - Method parameters
     *
     * @remarks
     * Used for access control, reentrancy guards, and validation.
     */
    public onExecutionStarted(selector: Selector, calldata: Calldata): void {
        for (let i: i32 = 0; i < this._plugins.length; i++) {
            const plugin = this._plugins[i];
            plugin.onExecutionStarted(selector, calldata);
        }
        this.contract.onExecutionStarted(selector, calldata);
    }

    /**
     * Post-execution hook called after successful method execution.
     *
     * @param selector - Method selector that was called
     * @param calldata - Method parameters that were passed
     *
     * @remarks
     * Only called on successful execution. Used for cleanup and events.
     */
    public onExecutionCompleted(selector: Selector, calldata: Calldata): void {
        for (let i: i32 = 0; i < this._plugins.length; i++) {
            const plugin = this._plugins[i];
            plugin.onExecutionCompleted(selector, calldata);
        }
        this.contract.onExecutionCompleted(selector, calldata);
    }

    /**
     * Initializes the blockchain environment with runtime parameters.
     *
     * @param data - Encoded environment data from the runtime
     *
     * @remarks
     * Called automatically by the runtime to set up execution context.
     */
    public setEnvironmentVariables(data: Uint8Array): void {
        const reader: BytesReader = new BytesReader(data);

        const blockHash = reader.readBytes(32);
        const blockNumber = reader.readU64();
        const blockMedianTime = reader.readU64();
        const txId = reader.readBytes(32);
        const txHash = reader.readBytes(32);
        const contractAddress = reader.readAddress();
        const contractDeployer = reader.readAddress();
        const caller = reader.readAddress();
        const origin = reader.readAddress();
        const chainId = reader.readBytes(32);
        const protocolId = reader.readBytes(32);

        this._tx = new Transaction(caller, origin, txId, txHash);
        this._contractDeployer = contractDeployer;
        this._contractAddress = contractAddress;
        this._chainId = chainId;
        this._protocolId = protocolId;
        this._network = Network.fromChainId(this.chainId);
        this._block = new Block(blockHash, blockNumber, blockMedianTime);

        this.createContractIfNotExists();
    }

    /**
     * Executes a call to another contract with configurable failure handling.
     *
     * @param destinationContract - Target contract address
     * @param calldata - Encoded function call data
     * @param stopExecutionOnFailure - Whether to revert on call failure (default: true)
     * @returns CallResult with success flag and response data
     *
     * @example
     * ```typescript
     * // Traditional call - reverts on failure
     * const result = Blockchain.call(tokenAddress, calldata);
     * const balance = result.data.readU256();
     *
     * // Try-catch pattern - handles failure gracefully
     * const result = Blockchain.call(unknownContract, calldata, false);
     * if (result.success) {
     *     const data = result.data;
     *     // Process successful response
     * } else {
     *     // Handle failure without reverting
     *     this.handleCallFailure();
     * }
     * ```
     *
     * @warning Follow checks-effects-interactions pattern to prevent reentrancy:
     *          1. Check conditions
     *          2. Update state
     *          3. Make external call
     *
     * @remarks
     * The stopExecutionOnFailure parameter enables try-catch style error handling.
     * When false, failed calls return success=false instead of reverting.
     */
    public call(
        destinationContract: Address,
        calldata: BytesWriter,
        stopExecutionOnFailure: boolean = true,
    ): CallResult {
        if (!destinationContract) {
            throw new Revert('Destination contract is required');
        }

        const resultLengthBuffer = new ArrayBuffer(32);
        const status = callContract(
            destinationContract.buffer,
            calldata.getBuffer().buffer,
            calldata.bufferLength(),
            resultLengthBuffer,
        );

        const reader = new BytesReader(Uint8Array.wrap(resultLengthBuffer));
        const resultLength = reader.readU32(true);
        const resultBuffer = new ArrayBuffer(resultLength);
        getCallResult(0, resultLength, resultBuffer);

        if (status !== 0 && stopExecutionOnFailure) {
            env_exit(status, resultBuffer, resultLength);
        }

        return new CallResult(status === 0, new BytesReader(Uint8Array.wrap(resultBuffer)));
    }

    /**
     * Emits a log message for debugging.
     *
     * @param data - String message to log
     *
     * @warning ONLY AVAILABLE IN UNIT TESTING FRAMEWORK.
     *          NOT available in production or testnet environments.
     *          Will fail if called outside of testing context.
     *
     * @example
     * ```typescript
     * // Only in unit tests:
     * Blockchain.log("Debug: Transfer initiated");
     * Blockchain.log(`Amount: ${amount.toString()}`);
     * ```
     */
    public log(data: string): void {
        const writer = new BytesWriter(String.UTF8.byteLength(data));
        writer.writeString(data);

        const buffer = writer.getBuffer();
        log(buffer.buffer, buffer.length);
    }

    /**
     * Emits a structured event for off-chain monitoring.
     *
     * @param event - NetEvent instance containing event data
     *
     * @remarks
     * Events are the primary mechanism for dApps to track state changes.
     * Events are not accessible within contracts.
     *
     * @example
     * ```typescript
     * class TransferredEvent extends NetEvent {
     *     constructor(operator: Address, from: Address, to: Address, amount: u256) {
     *         const data: BytesWriter = new BytesWriter(ADDRESS_BYTE_LENGTH * 3 + U256_BYTE_LENGTH);
     *         data.writeAddress(operator);
     *         data.writeAddress(from);
     *         data.writeAddress(to);
     *         data.writeU256(amount);
     *         super('Transferred', data);
     *     }
     * }
     * Blockchain.emit(new TransferredEvent(operator, sender, recipient, value));
     * ```
     */
    public emit(event: NetEvent): void {
        const data = event.getEventData();
        const writer = new BytesWriter(
            String.UTF8.byteLength(event.eventType) + 8 + data.byteLength,
        );

        writer.writeStringWithLength(event.eventType);
        writer.writeBytesWithLength(data);

        emit(writer.getBuffer().buffer, writer.bufferLength());
    }

    /**
     * Validates a Bitcoin address format for the current network.
     *
     * @param address - Bitcoin address string to validate
     * @returns true if valid for current network, false otherwise
     *
     * @warning Validation rules are network-specific:
     *          - Mainnet: bc1, 1, 3 prefixes
     *          - Testnet: tb1, m, n, 2 prefixes
     *
     * @example
     * ```typescript
     * if (!Blockchain.validateBitcoinAddress(userAddress)) {
     *     throw new Revert("Invalid Bitcoin address");
     * }
     * ```
     */
    public validateBitcoinAddress(address: string): bool {
        const writer = new BytesWriter(String.UTF8.byteLength(address));
        writer.writeString(address);

        const result = validateBitcoinAddress(writer.getBuffer().buffer, address.length);
        return result === 1;
    }

    /**
     * Deploys a new contract using an existing contract as template.
     *
     * @param existingAddress - Template contract address
     * @param salt - Unique salt for deterministic addressing
     * @param calldata - Constructor parameters
     * @returns Address of newly deployed contract
     * @throws {Revert} When deployment fails
     *
     * @warning CREATE2 style deployment:
     *          Same salt + template = same address.
     *          Salt collision will cause deployment to fail.
     *
     * @example
     * ```typescript
     * const salt = u256.fromBytes(sha256("unique-id"));
     * const newToken = Blockchain.deployContractFromExisting(
     *     templateAddress,
     *     salt,
     *     constructorData
     * );
     * ```
     */
    public deployContractFromExisting(
        existingAddress: Address,
        salt: u256,
        calldata: BytesWriter,
    ): Address {
        const resultAddressBuffer = new ArrayBuffer(ADDRESS_BYTE_LENGTH);
        const callDataBuffer = calldata.getBuffer().buffer;

        const status = deployFromAddress(
            existingAddress.buffer,
            salt.toUint8Array(true).buffer,
            callDataBuffer,
            callDataBuffer.byteLength,
            resultAddressBuffer,
        );

        if (status !== 0) {
            throw new Revert('Failed to deploy contract');
        }

        const contractAddressReader = new BytesReader(Uint8Array.wrap(resultAddressBuffer));
        return contractAddressReader.readAddress();
    }

    /**
     * Reads a value from persistent storage.
     *
     * @param pointerHash - 32-byte storage key
     * @returns 32-byte stored value (zeros if unset)
     *
     * @warning Cannot distinguish between unset and explicitly set to zero.
     *          Use hasStorageAt() to check existence.
     *
     * @example
     * ```typescript
     * const key = sha256("balance:" + address);
     * const balance = Blockchain.getStorageAt(key);
     * ```
     */
    public getStorageAt(pointerHash: Uint8Array): Uint8Array {
        this.hasPointerStorageHash(pointerHash);

        if (this.storage.has(pointerHash)) {
            return this.storage.get(pointerHash);
        }

        return new Uint8Array(32);
    }

    /**
     * Reads a value from transient storage (cleared after transaction).
     *
     * @param pointerHash - 32-byte storage key
     * @returns 32-byte stored value (zeros if unset)
     *
     * @warning NOT CURRENTLY ENABLED IN PRODUCTION.
     *          Transient storage functionality is experimental and only available in testing.
     *          Will fail if called in production or testnet environments.
     *          Storage is cleared after each transaction when enabled.
     *
     * @example
     * ```typescript
     * // Reentrancy guard pattern (when enabled)
     * const GUARD_KEY = sha256("reentrancy");
     * if (Blockchain.hasTransientStorageAt(GUARD_KEY)) {
     *     throw new Revert("Reentrancy detected");
     * }
     * Blockchain.setTransientStorageAt(GUARD_KEY, u256.One.toBytes());
     * ```
     */
    public getTransientStorageAt(pointerHash: Uint8Array): Uint8Array {
        if (this.hasPointerTransientStorageHash(pointerHash)) {
            return this.transientStorage.get(pointerHash);
        }

        return new Uint8Array(32);
    }

    /**
     * Computes SHA-256 hash of input data.
     *
     * @param buffer - Data to hash
     * @returns 32-byte hash result
     *
     * @example
     * ```typescript
     * const hash = Blockchain.sha256(data);
     * const storageKey = Blockchain.sha256(concat("user:", address));
     * ```
     */
    public sha256(buffer: Uint8Array): Uint8Array {
        return sha256(buffer);
    }

    /**
     * Computes double SHA-256 (Bitcoin's hash256).
     *
     * @param buffer - Data to hash
     * @returns 32-byte double hash result
     *
     * @remarks
     * Standard Bitcoin hash function used for transaction IDs and block hashes.
     *
     * @example
     * ```typescript
     * const txHash = Blockchain.hash256(transactionData);
     * ```
     */
    public hash256(buffer: Uint8Array): Uint8Array {
        return sha256(sha256(buffer));
    }

    /**
     * Verifies a Schnorr signature (Bitcoin Taproot).
     *
     * @param publicKey - 32-byte public key
     * @param signature - 64-byte Schnorr signature
     * @param hash - 32-byte message hash
     * @returns true if signature is valid
     *
     * @warning Schnorr signatures differ from ECDSA:
     *          - Linear aggregation properties
     *          - Used in Taproot (post-2021)
     *
     * @example
     * ```typescript
     * const isValid = Blockchain.verifySchnorrSignature(
     *     signer,
     *     signature,
     *     messageHash
     * );
     * if (!isValid) throw new Revert("Invalid signature");
     * ```
     */
    public verifySchnorrSignature(
        publicKey: Address,
        signature: Uint8Array,
        hash: Uint8Array,
    ): boolean {
        const result: u32 = verifySchnorrSignature(publicKey.buffer, signature.buffer, hash.buffer);
        return result === 1;
    }

    /**
     * Checks if an address is a contract (not an EOA).
     *
     * @param address - Address to check
     * @returns true if contract, false if EOA or uninitialized
     *
     * @warning Cannot distinguish between EOA with no transactions
     *          and uninitialized address.
     *
     * @example
     * ```typescript
     * if (!Blockchain.isContract(targetAddress)) {
     *     throw new Revert("Must be a contract");
     * }
     * ```
     */
    public isContract(address: Address): boolean {
        return getAccountType(address.buffer) !== 0;
    }

    /**
     * Checks if persistent storage slot has a non-zero value.
     *
     * @param pointerHash - 32-byte storage key
     * @returns true if slot contains non-zero value
     *
     * @warning Cannot distinguish between never written and explicitly set to zero.
     *
     * @example
     * ```typescript
     * const EXISTS_KEY = sha256("user:exists:" + address);
     * if (!Blockchain.hasStorageAt(EXISTS_KEY)) {
     *     // First time user
     * }
     * ```
     */
    public hasStorageAt(pointerHash: Uint8Array): bool {
        const val: Uint8Array = this.getStorageAt(pointerHash);
        return !eqUint(val, EMPTY_BUFFER);
    }

    /**
     * Checks if transient storage slot has a non-zero value.
     *
     * @param pointerHash - 32-byte storage key
     * @returns true if slot contains non-zero value
     *
     * @warning NOT CURRENTLY ENABLED IN PRODUCTION.
     *          Transient storage functionality is experimental and only available in testing.
     *          Will fail if called in production or testnet environments.
     *
     * @remarks
     * Only reliable within single transaction context when enabled.
     */
    public hasTransientStorageAt(pointerHash: Uint8Array): bool {
        const val: Uint8Array = this.getTransientStorageAt(pointerHash);
        return !eqUint(val, EMPTY_BUFFER);
    }

    /**
     * Writes a value to persistent storage.
     *
     * @param pointerHash - 32-byte storage key
     * @param value - Value to store (will be padded/truncated to 32 bytes)
     *
     * @warning Storage writes cost significant gas (~20,000).
     *          Batch related updates when possible.
     *
     * @example
     * ```typescript
     * const key = sha256("balance:" + address);
     * Blockchain.setStorageAt(key, balance.toBytes());
     * ```
     */
    public setStorageAt(pointerHash: Uint8Array, value: Uint8Array): void {
        this._internalSetStorageAt(pointerHash, value);
    }

    /**
     * Writes a value to transient storage.
     *
     * @param pointerHash - 32-byte storage key
     * @param value - 32-byte value to store
     * @throws {Revert} If key or value is not exactly 32 bytes
     *
     * @warning NOT CURRENTLY ENABLED IN PRODUCTION.
     *          Transient storage functionality is experimental and only available in testing.
     *          Will fail if called in production or testnet environments.
     *          Value must be exactly 32 bytes (no auto-padding).
     *          Storage is cleared after transaction completes when enabled.
     *
     * @example
     * ```typescript
     * // Reentrancy lock (when enabled)
     * Blockchain.setTransientStorageAt(LOCK_KEY, u256.One.toBytes());
     * // Lock automatically clears after transaction
     * ```
     */
    public setTransientStorageAt(pointerHash: Uint8Array, value: Uint8Array): void {
        this._internalSetTransientStorageAt(pointerHash, value);
    }

    /**
     * Gets the account type identifier for an address.
     *
     * @param address - Address to query
     * @returns Account type code (0 = EOA/uninitialized, >0 = contract type)
     *
     * @remarks
     * Different contract types may have different codes.
     */
    public getAccountType(address: Address): u32 {
        return getAccountType(address.buffer);
    }

    /**
     * Retrieves a historical block hash.
     *
     * @param blockNumber - Block number to query
     * @returns 32-byte block hash
     *
     * @warning Only recent blocks available (~256 blocks).
     *          Older blocks return zero hash.
     *          Do not use for randomness generation.
     *
     * @example
     * ```typescript
     * const oldBlock = Blockchain.block.number - 10;
     * const hash = Blockchain.getBlockHash(oldBlock);
     * ```
     */
    public getBlockHash(blockNumber: u64): Uint8Array {
        const hash = new ArrayBuffer(32);
        getBlockHash(blockNumber, hash);
        return Uint8Array.wrap(hash);
    }

    private createContractIfNotExists(): void {
        if (!this._contract) {
            throw new Revert('Contract is required');
        }

        if (!this._selfContract) {
            this._selfContract = this._contract();
        }
    }

    private _internalSetStorageAt(pointerHash: Uint8Array, value: Uint8Array): void {
        if (pointerHash.buffer.byteLength !== 32) {
            throw new Revert('Pointer must be 32 bytes long');
        }

        let finalValue: Uint8Array = value;
        if (value.buffer.byteLength !== 32) {
            // Auto-pad values shorter than 32 bytes
            finalValue = new Uint8Array(32);
            for (let i = 0; i < value.buffer.byteLength && i < 32; i++) {
                finalValue[i] = value[i];
            }
        }

        this.storage.set(pointerHash, finalValue);
        storePointer(pointerHash.buffer, finalValue.buffer);
    }

    private _internalSetTransientStorageAt(pointerHash: Uint8Array, value: Uint8Array): void {
        this.transientStorage.set(pointerHash, value);

        if (pointerHash.buffer.byteLength !== 32 || value.buffer.byteLength !== 32) {
            throw new Revert('Transient pointer and value must be 32 bytes long');
        }

        tStorePointer(pointerHash.buffer, value.buffer);
    }

    private hasPointerStorageHash(pointer: Uint8Array): bool {
        if (pointer.buffer.byteLength !== 32) {
            throw new Revert('Pointer must be 32 bytes long');
        }

        if (this.storage.has(pointer)) {
            return true;
        }

        const resultBuffer = new ArrayBuffer(32);
        loadPointer(pointer.buffer, resultBuffer);

        const value: Uint8Array = Uint8Array.wrap(resultBuffer);
        this.storage.set(pointer, value); // Cache for future reads

        return !eqUint(value, EMPTY_BUFFER);
    }

    private hasPointerTransientStorageHash(pointer: Uint8Array): bool {
        if (pointer.buffer.byteLength !== 32) {
            throw new Revert('Transient pointer must be 32 bytes long');
        }

        if (this.transientStorage.has(pointer)) {
            return true;
        }

        const resultBuffer = new ArrayBuffer(32);
        tLoadPointer(pointer.buffer, resultBuffer);

        const value: Uint8Array = Uint8Array.wrap(resultBuffer);
        this.transientStorage.set(pointer, value); // Cache for future reads

        return !eqUint(value, EMPTY_BUFFER);
    }
}

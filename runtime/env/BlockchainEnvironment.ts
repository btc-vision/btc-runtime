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
    updateFromAddress,
    validateBitcoinAddress,
    verifySignature,
} from './global';
import { eqUint, MapUint8Array } from '../generic/MapUint8Array';
import { EMPTY_BUFFER } from '../math/bytes';
import { Calldata } from '../types';
import { Revert } from '../types/Revert';
import { Selector } from '../math/abi';
import { Network, Networks } from '../script/Networks';
import { ExtendedAddress } from '../types/ExtendedAddress';
import { ECDSAKeyFormat, ECDSASubType, SignaturesMethods } from './consensus/Signatures';
import { MLDSAMetadata, MLDSASecurityLevel } from './consensus/MLDSAMetadata';

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

const SCRATCH_SIZE: i32 = 256;
const SCRATCH_BUF: ArrayBuffer = new ArrayBuffer(SCRATCH_SIZE);
const SCRATCH_VIEW: Uint8Array = Uint8Array.wrap(SCRATCH_BUF);

const FOUR_BYTES_UINT8ARRAY_MEMORY_CACHE = new Uint8Array(4);

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
    public readonly DEAD_ADDRESS: ExtendedAddress = ExtendedAddress.dead();

    private storage: MapUint8Array = new MapUint8Array();
    private transientStorage: MapUint8Array = new MapUint8Array();
    private _selfContract: Potential<OP_NET> = null;
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
     * Handles contract deployment initialization.
     *
     * @param calldata - Deployment parameters
     *
     * @remarks
     * Called once during deployment. Delegates to the contract's onDeployment
     * which handles plugin notification.
     */
    public onDeployment(calldata: Calldata): void {
        this.contract.onDeployment(calldata);
    }

    /**
     * Handles contract bytecode update.
     *
     * @param calldata - Update parameters passed to updateContractFromExisting
     *
     * @remarks
     * Called when the contract's bytecode is updated. Delegates to the contract's
     * onUpdate which handles plugin notification and migration logic.
     */
    public onUpdate(calldata: Calldata): void {
        this.contract.onUpdate(calldata);
    }

    /**
     * Pre-execution hook called before method execution.
     *
     * @param selector - Method selector being called
     * @param calldata - Method parameters
     *
     * @remarks
     * Delegates to the contract's onExecutionStarted which handles plugin notification.
     */
    public onExecutionStarted(selector: Selector, calldata: Calldata): void {
        this.contract.onExecutionStarted(selector, calldata);
    }

    /**
     * Post-execution hook called after successful method execution.
     *
     * @param selector - Method selector that was called
     * @param calldata - Method parameters that were passed
     *
     * @remarks
     * Delegates to the contract's onExecutionCompleted which handles plugin notification.
     */
    public onExecutionCompleted(selector: Selector, calldata: Calldata): void {
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
        // BytesReader is unavoidable for parsing complex external struct
        const reader: BytesReader = new BytesReader(data);

        const blockHash = reader.readBytes(32);
        const blockNumber = reader.readU64();
        const blockMedianTime = reader.readU64();
        const txId = reader.readBytes(32);
        const txHash = reader.readBytes(32);
        const contractAddress = reader.readAddress();
        const contractDeployer = reader.readAddress();
        const caller = reader.readAddress();
        const origin = reader.readBytesArray(32);
        const chainId = reader.readBytes(32);
        const protocolId = reader.readBytes(32);
        const tweakedPublicKey = reader.readBytesArray(ADDRESS_BYTE_LENGTH);
        const consensusFlags = reader.readU64();

        const originAddress = new ExtendedAddress(tweakedPublicKey, origin);

        this._tx = new Transaction(caller, originAddress, txId, txHash, consensusFlags);
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

        // This creates the underlying ArrayBuffer AND gives us a 'dataStart' pointer for free.
        const status = callContract(
            destinationContract.buffer,
            calldata.getBuffer().buffer,
            calldata.bufferLength(),
            FOUR_BYTES_UINT8ARRAY_MEMORY_CACHE.buffer, // Pass the underlying ArrayBuffer to the host
        );

        // OPTIMIZATION: Read raw memory directly using load<u32>
        // We use .dataStart to get the raw pointer to the payload.
        const resultLength = bswap<u32>(load<u32>(FOUR_BYTES_UINT8ARRAY_MEMORY_CACHE.dataStart));

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
        const eventType = event.eventType;
        const typeLen = String.UTF8.byteLength(eventType);

        // Structure: [4 bytes type len] + [type bytes] + [4 bytes data len] + [data bytes]
        const totalLen = 8 + typeLen + data.length;

        const writer = new Uint8Array(totalLen);
        const ptr = writer.dataStart;

        // Write type length (BE)
        store<u32>(ptr, bswap<u32>(typeLen));

        // Write type string
        String.UTF8.encodeUnsafe(changetype<usize>(eventType), eventType.length, ptr + 4);

        // Write data length (BE)
        const offset = 4 + typeLen;
        store<u32>(ptr + offset, bswap<u32>(data.length));

        // Write data bytes (Safe memory copy)
        memory.copy(ptr + offset + 4, data.dataStart, data.length);

        emit(writer.buffer, totalLen);
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
        const len = String.UTF8.byteLength(address);

        if (len <= SCRATCH_SIZE) {
            String.UTF8.encodeUnsafe(
                changetype<usize>(address),
                address.length,
                SCRATCH_VIEW.dataStart,
            );

            return validateBitcoinAddress(SCRATCH_BUF, len) === 1;
        } else {
            const writer = new BytesWriter(len);
            writer.writeString(address);
            return validateBitcoinAddress(writer.getBuffer().buffer, len) === 1;
        }
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
     * Updates this contract's bytecode from an existing deployed contract.
     *
     * This method triggers a bytecode replacement where the calling contract's execution
     * logic is replaced with the bytecode from the source contract. The new bytecode
     * takes effect at the next block.
     *
     * @param sourceAddress - Address of the contract containing the new bytecode
     * @param [calldata] - Optional parameters passed to the new bytecode's onUpdate method
     * @throws {Revert} When the source address is invalid or the update fails
     *
     * @warning This is a privileged operation with significant implications:
     *          - Storage layout compatibility is entirely the developer's responsibility
     *          - The contract address and all storage slots persist unchanged
     *          - Only the execution logic changes
     *          - The source contract must be an already-deployed contract
     *
     * @remarks
     * Contracts should implement their own permission checks and optional timelock
     * patterns before calling this method. A recommended pattern is:
     *
     * 1. `submitUpdate(address)` - Logs source address and block number, validates
     *    that the address is an existing deployed contract
     * 2. `applyUpdate(address)` - Can only be called after a configured delay,
     *    verifies address matches the submitted one, then calls this method
     *
     * This pattern gives users time to assess pending changes and exit if needed.
     *
     * @example
     * ```typescript
     * // Simple immediate update (not recommended for production)
     * public upgrade(calldata: Calldata): BytesWriter {
     *     this.onlyDeployer(Blockchain.tx.sender);
     *     const newBytecodeAddress = calldata.readAddress();
     *     Blockchain.updateContractFromExisting(newBytecodeAddress);
     *     return new BytesWriter(0);
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Timelock pattern (recommended)
     * private pendingUpdatePointer: u16 = Blockchain.nextPointer;
     * private pendingUpdate: StoredAddress = new StoredAddress(this.pendingUpdatePointer);
     *
     * private pendingUpdateBlockPointer: u16 = Blockchain.nextPointer;
     * private pendingUpdateBlock: StoredU64 = new StoredU64(this.pendingUpdateBlockPointer);
     *
     * private readonly UPDATE_DELAY: u64 = 144; // ~1 day in blocks
     *
     * public submitUpdate(calldata: Calldata): BytesWriter {
     *     this.onlyDeployer(Blockchain.tx.sender);
     *     const sourceAddress = calldata.readAddress();
     *
     *     // Validate source is an existing contract
     *     if (!Blockchain.isContract(sourceAddress)) {
     *         throw new Revert('Source must be a deployed contract');
     *     }
     *
     *     this.pendingUpdate.value = sourceAddress;
     *     this.pendingUpdateBlock.value = Blockchain.block.number;
     *     return new BytesWriter(0);
     * }
     *
     * public applyUpdate(calldata: Calldata): BytesWriter {
     *     this.onlyDeployer(Blockchain.tx.sender);
     *     const sourceAddress = calldata.readAddress();
     *
     *     // Verify address matches pending update
     *     if (!sourceAddress.equals(this.pendingUpdate.value)) {
     *         throw new Revert('Address does not match pending update');
     *     }
     *
     *     // Verify delay has passed
     *     const submitBlock = this.pendingUpdateBlock.value;
     *     if (Blockchain.block.number < submitBlock + this.UPDATE_DELAY) {
     *         throw new Revert('Update delay not elapsed');
     *     }
     *
     *     Blockchain.updateContractFromExisting(sourceAddress);
     *     return new BytesWriter(0);
     * }
     * ```
     */
    public updateContractFromExisting(
        sourceAddress: Address,
        calldata: BytesWriter | null = null,
    ): void {
        if (!sourceAddress) {
            throw new Revert('Source address is required');
        }

        if (!this.isContract(sourceAddress)) {
            throw new Revert('Source address must be a deployed contract');
        }

        const callDataBuffer = calldata ? calldata.getBuffer().buffer : new ArrayBuffer(0);

        const status = updateFromAddress(
            sourceAddress.buffer,
            callDataBuffer,
            callDataBuffer.byteLength,
        );

        if (status !== 0) {
            throw new Revert('Failed to update contract bytecode');
        }
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
     * ```
     */
    @inline
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
    @inline
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
     * @deprecated Use Blockchain.verifySignature() instead for automatic consensus migration.
     *            verifySignature() supports both Schnorr and ML-DSA signatures with proper
     *            consensus flag handling for quantum resistance transitions.
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
        publicKey: ExtendedAddress,
        signature: Uint8Array,
        hash: Uint8Array,
    ): boolean {
        WARNING(
            'verifySchnorrSignature is deprecated. Use verifySignature() for consensus-aware signature verification and quantum resistance support.',
        );

        return this.internalVerifySchnorr(publicKey, signature, hash);
    }

    /**
     * Verifies an ML-DSA signature (quantum-resistant).
     *
     * @param level - Security level (MLDSASecurityLevel.Level2: ML-DSA-44, MLDSASecurityLevel.Level3: ML-DSA-65, MLDSASecurityLevel.Level5: ML-DSA-87)
     * @param publicKey - ML-DSA public key (1312/1952/2592 bytes based on level)
     * @param signature - ML-DSA signature (2420/3309/4627 bytes based on level)
     * @param hash - 32-byte message hash
     * @returns true if signature is valid
     *
     * @warning ML-DSA provides quantum resistance:
     *          - NIST standardized lattice-based signatures
     *          - Larger keys/signatures than classical algorithms
     *          - Security levels: 2 (ML-DSA-44), 3 (ML-DSA-65), 5 (ML-DSA-87)
     *
     * @throws {Revert} If public key length doesn't match level
     * @throws {Revert} If signature length doesn't match level
     * @throws {Revert} If hash is not 32 bytes
     *
     * @example
     * ```typescript
     * // ML-DSA-44 (security level 2)
     * const isValid = Blockchain.verifyMLDSASignature(
     *     MLDSASecurityLevel.Level2, // level 0 = ML-DSA-44
     *     mldsaPublicKey, // 1312 bytes
     *     mldsaSignature, // 2420 bytes
     *     messageHash // 32 bytes
     * );
     * if (!isValid) throw new Revert("Invalid ML-DSA signature");
     * ```
     *
     * @example
     * ```typescript
     * // ML-DSA-87 (highest security level 5)
     * const isValid = Blockchain.verifyMLDSASignature(
     *     MLDSASecurityLevel.Level5, // level 2 = ML-DSA-87
     *     mldsaPublicKey, // 2592 bytes
     *     mldsaSignature, // 4627 bytes
     *     messageHash // 32 bytes
     * );
     * ```
     */
    public verifyMLDSASignature(
        level: MLDSASecurityLevel,
        publicKey: Uint8Array,
        signature: Uint8Array,
        hash: Uint8Array,
    ): boolean {
        const publicKeyLength = MLDSAMetadata.fromLevel(level);
        if (publicKey.length !== (publicKeyLength as i32)) {
            throw new Revert(`Invalid ML-DSA public key length.`);
        }

        if (signature.length !== MLDSAMetadata.signatureLen(publicKeyLength)) {
            throw new Revert(`Invalid ML-DSA signature length.`);
        }

        if (hash.length !== 32) {
            throw new Revert(`Invalid hash length.`);
        }

        const bufferLen = 2 + publicKey.length;
        const writer = new Uint8Array(bufferLen);
        const ptr = writer.dataStart;

        // Single bytes - Endianness irrelevant
        store<u8>(ptr, <u8>SignaturesMethods.MLDSA);
        store<u8>(ptr + 1, <u8>level);

        // Byte array copy
        memory.copy(ptr + 2, publicKey.dataStart, publicKey.length);

        const result: u32 = verifySignature(writer.buffer, signature.buffer, hash.buffer);

        return result === 1;
    }

    /**
     * Verifies a signature based on current consensus rules.
     *
     * This method automatically selects the appropriate signature verification algorithm
     * based on the current consensus state:
     *
     * - When `unsafeSignaturesAllowed()` returns `true`: Uses Schnorr signatures (quantum-vulnerable)
     * - When `unsafeSignaturesAllowed()` returns `false`: Uses ML-DSA signatures (quantum-resistant)
     *
     * The `unsafeSignaturesAllowed()` flag indicates whether the network is still accepting
     * legacy Schnorr signatures. This flag will be `true` during the transition period to
     * maintain backwards compatibility with existing infrastructure. Once the network completes
     * its quantum-resistant upgrade, this flag will permanently become `false`, enforcing
     * ML-DSA signatures exclusively.
     *
     * @param address - The address containing the public key(s) to verify against.
     *                  For Schnorr, uses the taproot tweaked public key.
     *                  For ML-DSA, uses the ML-DSA public key component.
     * @param signature - The signature bytes to verify. Format depends on algorithm:
     *                    - Schnorr: 64-byte signature
     *                    - ML-DSA-44 (Level 2): 2420 bytes
     *                    - ML-DSA-65 (Level 3): 3309 bytes
     *                    - ML-DSA-87 (Level 5): 4627 bytes
     * @param hash - The 32-byte message hash that was signed. Usually a SHA256 hash
     *               of the transaction data or message being verified.
     *
     * @param signatureType - Optional parameter to explicitly specify the signature type for verification.
     *
     * @returns `true` if the signature is valid for the given address and hash,
     *          `false` if verification fails or if the signature format is invalid
     *
     * @throws May throw if the signature or hash have invalid lengths for the selected
     *         algorithm, though implementations should generally return false instead
     *
     * @remarks
     * The consensus rules determine which signature scheme is active:
     * - Pre-quantum era: Schnorr signatures (Bitcoin taproot compatible)
     * - Post-quantum era: ML-DSA Level 2 (NIST standardized, 128-bit quantum security)
     *
     *  ML-DSA Level 2 (ML-DSA-44) corresponds to NIST security category 2, providing security
     *  equivalent to AES-128 against both classical and quantum attacks. Its security is based on
     *  the hardness of underlying lattice problems and is designed to resist attacks from quantum
     *  computers, including both Shor's algorithm (which breaks RSA/ECC) and Grover's algorithm
     *  (which reduces symmetric key security). The security levels (2, 3, 5) correspond to the
     *  number of quantum gates required for Grover's algorithm to break them, equivalent to
     *  AES-128, AES-192, and AES-256 respectively.
     *
     * @example
     * ```typescript
     * const isValid = contract.verifySignature(
     *     senderAddress,
     *     signatureBytes,
     *     transactionHash
     * );
     * if (!isValid) {
     *     throw new Error("Invalid signature");
     * }
     * ```
     */
    public verifySignature(
        address: ExtendedAddress,
        signature: Uint8Array,
        hash: Uint8Array,
        signatureType: SignaturesMethods = SignaturesMethods.Schnorr,
    ): boolean {
        if (
            this.tx.consensus.unsafeSignaturesAllowed() &&
            signatureType !== SignaturesMethods.MLDSA
        ) {
            if (signatureType === SignaturesMethods.Schnorr) {
                return this.internalVerifySchnorr(address, signature, hash);
            } else if (signatureType === SignaturesMethods.ECDSA) {
                throw new Revert(
                    'ECDSA verification is not supported by verifySignature(). Use verifyECDSASignature() or verifyBitcoinECDSASignature() instead.',
                );
            }
        } else {
            return this.verifyMLDSASignature(
                MLDSASecurityLevel.Level2,
                address.mldsaPublicKey,
                signature,
                hash,
            );
        }

        throw new Revert(
            'Invalid signature type or signatures schema not allowed under current consensus rules',
        );
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
    @inline
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
    @inline
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
    @inline
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

    /**
     * Verifies an ECDSA signature using the Ethereum ecrecover model (secp256k1).
     *
     * Recovers the signer public key from (hash, r, s, v) and compares against
     * the provided public key material. Signature must be 65 bytes in Ethereum
     * wire format: r (32) || s (32) || v (1).
     *
     * Accepted public key formats:
     *   33 bytes  -> compressed SEC1 (0x02/0x03 prefix)
     *   64 bytes  -> raw uncompressed (x || y, no prefix)
     *   65 bytes  -> uncompressed SEC1 (0x04 prefix) or hybrid SEC1 (0x06/0x07 prefix)
     *
     * @param publicKey - The public key to verify against
     * @param signature - 65-byte ECDSA signature: r (32) || s (32) || v (1)
     * @param hash - 32-byte message hash (typically keccak256 of EIP-191/EIP-712 payload)
     * @returns true if ecrecover(hash, v, r, s) produces a key matching publicKey
     *
     * @throws {Revert} If signature is not exactly 65 bytes
     * @throws {Revert} If hash is not exactly 32 bytes
     * @throws {Revert} If publicKey length/prefix is invalid
     *
     * @deprecated Use Blockchain.verifySignature() for consensus-aware verification.
     */
    public verifyECDSASignature(
        publicKey: Uint8Array,
        signature: Uint8Array,
        hash: Uint8Array,
    ): boolean {
        if (!this.tx.consensus.unsafeSignaturesAllowed()) {
            throw new Revert(
                'ECDSA signatures are not allowed under current consensus rules. Use verifySignature() for consensus-aware verification.',
            );
        }

        WARNING(
            'verifyECDSASignature is deprecated. Use verifySignature() for consensus-aware signature verification and quantum resistance support.',
        );

        return this.internalVerifyECDSA(publicKey, signature, hash, ECDSASubType.Ethereum);
    }

    /**
     * Verifies an ECDSA signature using the Bitcoin direct verification model (secp256k1).
     *
     * Verifies the signature directly against the provided public key without
     * key recovery. The host enforces BIP-0062 low-S normalization to reject
     * signature malleability. Signature must be 64 bytes compact: r (32) || s (32).
     *
     * Accepted public key formats:
     *   33 bytes  -> compressed SEC1 (0x02/0x03 prefix)
     *   64 bytes  -> raw uncompressed (x || y, no prefix)
     *   65 bytes  -> uncompressed SEC1 (0x04 prefix) or hybrid SEC1 (0x06/0x07 prefix)
     *
     * @param publicKey - The public key to verify against
     * @param signature - 64-byte compact ECDSA signature: r (32) || s (32)
     * @param hash - 32-byte message hash (typically SHA-256 double hash for Bitcoin)
     * @returns true if the signature is valid for the given key and hash
     *
     * @throws {Revert} If signature is not exactly 64 bytes
     * @throws {Revert} If hash is not exactly 32 bytes
     * @throws {Revert} If publicKey length/prefix is invalid
     *
     * @deprecated Use Blockchain.verifySignature() for consensus-aware verification.
     */
    public verifyBitcoinECDSASignature(
        publicKey: Uint8Array,
        signature: Uint8Array,
        hash: Uint8Array,
    ): boolean {
        if (!this.tx.consensus.unsafeSignaturesAllowed()) {
            throw new Revert(
                'ECDSA signatures are not allowed under current consensus rules. Use verifySignature() for consensus-aware verification.',
            );
        }

        WARNING(
            'verifyBitcoinECDSASignature is deprecated. Use verifySignature() for consensus-aware signature verification and quantum resistance support.',
        );

        return this.internalVerifyECDSA(publicKey, signature, hash, ECDSASubType.Bitcoin);
    }

    /**
     * Internal ECDSA verification that dispatches to the host with the correct
     * sub-type byte so the host knows which verification model to use.
     *
     * Host buffer layout: [type(1), subtype(1), format(1), ...pubkey_material]
     *   type    = SignaturesMethods.ECDSA (0x00)
     *   subtype = ECDSASubType.Ethereum (0x00) or ECDSASubType.Bitcoin (0x01)
     *   format  = ECDSAKeyFormat tag describing the public key encoding
     *   pubkey  = raw SEC1 bytes (33, 64, or 65 bytes depending on format)
     */
    private internalVerifyECDSA(
        pubKey: Uint8Array,
        signature: Uint8Array,
        hash: Uint8Array,
        subType: ECDSASubType,
    ): boolean {
        if (subType === ECDSASubType.Ethereum) {
            if (signature.length !== 65)
                throw new Revert(
                    'Invalid ECDSA signature length. Ethereum format requires exactly 65 bytes (r32 || s32 || v1).',
                );
        } else if (subType === ECDSASubType.Bitcoin) {
            if (signature.length !== 64)
                throw new Revert(
                    'Invalid ECDSA signature length. Bitcoin format requires exactly 64 bytes (r32 || s32).',
                );
        } else {
            throw new Revert('Unsupported ECDSA sub-type.');
        }

        if (hash.length !== 32) throw new Revert('Invalid hash length.');

        this.validateSecp256k1PublicKey(pubKey);

        const keyLen: i32 = pubKey.length;

        let formatTag: ECDSAKeyFormat;
        if (keyLen === 33) {
            formatTag = ECDSAKeyFormat.Compressed;
        } else if (keyLen === 64) {
            formatTag = ECDSAKeyFormat.Raw;
        } else if (pubKey[0] === 0x06 || pubKey[0] === 0x07) {
            formatTag = ECDSAKeyFormat.Hybrid;
        } else {
            formatTag = ECDSAKeyFormat.Uncompressed;
        }

        const bufferLen: i32 = 3 + keyLen;
        const buffer = new Uint8Array(bufferLen);
        const ptr = buffer.dataStart;

        store<u8>(ptr, <u8>SignaturesMethods.ECDSA);
        store<u8>(ptr + 1, <u8>subType);
        store<u8>(ptr + 2, <u8>formatTag);
        memory.copy(ptr + 3, pubKey.dataStart, keyLen);

        return verifySignature(buffer.buffer, signature.buffer, hash.buffer) === 1;
    }

    /**
     * Validates that a byte array is a well-formed secp256k1 public key.
     *
     * Accepted formats:
     *   33 bytes with 0x02 or 0x03 prefix  -> compressed SEC1
     *   64 bytes (any first byte)           -> raw uncompressed (x || y, no prefix)
     *   65 bytes with 0x04 prefix           -> uncompressed SEC1
     *   65 bytes with 0x06 or 0x07 prefix   -> hybrid SEC1
     *
     * @param key - The raw public key bytes to validate
     * @throws {Revert} If the key length or prefix is not a recognized format
     */
    private validateSecp256k1PublicKey(key: Uint8Array): void {
        const keyLen: i32 = key.length;

        if (keyLen === 33) {
            const prefix: u8 = key[0];
            if (prefix !== 0x02 && prefix !== 0x03) {
                throw new Revert('Invalid compressed public key prefix. Expected 0x02 or 0x03.');
            }
        } else if (keyLen === 64) {
            // Raw uncompressed: 32-byte X || 32-byte Y, no prefix byte.
            // No prefix validation needed since the first byte is part of the X coordinate.
        } else if (keyLen === 65) {
            const prefix: u8 = key[0];
            if (prefix !== 0x04 && prefix !== 0x06 && prefix !== 0x07) {
                throw new Revert(
                    'Invalid uncompressed public key prefix. Expected 0x04, 0x06, or 0x07.',
                );
            }
        } else {
            throw new Revert(
                'Invalid ECDSA public key length. Accepted: 33 (compressed), 64 (raw), or 65 (uncompressed/hybrid).',
            );
        }
    }

    private internalVerifySchnorr(
        publicKey: ExtendedAddress,
        signature: Uint8Array,
        hash: Uint8Array,
    ): boolean {
        if (signature.length !== 64) throw new Revert(`Invalid signature length.`);
        if (hash.length !== 32) throw new Revert(`Invalid hash length.`);

        // 1 byte prefix + 32 bytes address
        const totalLen = 1 + ADDRESS_BYTE_LENGTH;
        const buffer = new Uint8Array(totalLen);
        const ptr = buffer.dataStart;

        store<u8>(ptr, <u8>SignaturesMethods.Schnorr);

        memory.copy(ptr + 1, publicKey.tweakedPublicKey.dataStart, ADDRESS_BYTE_LENGTH);

        return verifySignature(buffer.buffer, signature.buffer, hash.buffer) === 1;
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
        if (pointerHash.length !== 32) {
            throw new Revert('Pointer must be 32 bytes long');
        }

        let finalValue: Uint8Array = value;
        if (value.length !== 32) {
            // Optimization: Pad manually using memory.copy to avoid loop
            finalValue = new Uint8Array(32);
            const len = value.length < 32 ? value.length : 32;
            memory.copy(finalValue.dataStart, value.dataStart, len);
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

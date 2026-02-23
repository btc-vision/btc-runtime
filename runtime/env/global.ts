/* eslint-disable */

import { MLDSAMetadata, MLDSASecurityLevel } from './consensus/MLDSAMetadata';
import { ADDRESS_BYTE_LENGTH } from '../utils';

/**
 * Retrieves environment variables.
 * @param {u32} offset - The offset in memory where the environment variables start.
 * @param {u32} length - The length of the environment variables.
 * @param {ArrayBuffer} result - The buffer to store the retrieved environment variables.
 */
@external('env', 'environment')
export declare function getEnvironmentVariables(offset: u32, length: u32, result: ArrayBuffer): void;

/**
 * Retrieves calldata.
 * @param {u32} offset - The offset in memory where the calldata starts.
 * @param {u32} length - The length of the calldata.
 * @param {ArrayBuffer} result - The buffer to store the retrieved calldata.
 */
@external('env', 'calldata')
export declare function getCalldata(offset: u32, length: u32, result: ArrayBuffer): void;

/**
 * Loads a pointer from storage.
 * @param {ArrayBuffer} key - The key to identify the pointer.
 * @param {ArrayBuffer} result - The buffer to store the loaded pointer.
 */
@external('env', 'load')
export declare function loadPointer(key: ArrayBuffer, result: ArrayBuffer): void;

/**
 * Stores a pointer in storage.
 * @param {ArrayBuffer} key - The key to identify the pointer.
 * @param {ArrayBuffer} value - The value of the pointer to store.
 */
@external('env', 'store')
export declare function storePointer(key: ArrayBuffer, value: ArrayBuffer): void;

/**
 * Loads a temporary pointer.
 * @param {ArrayBuffer} key - The key to identify the pointer.
 * @param {ArrayBuffer} result - The buffer to store the loaded pointer.
 */
@external('env', 'tload')
export declare function tLoadPointer(key: ArrayBuffer, result: ArrayBuffer): void;

/**
 * Stores a temporary pointer.
 * @param {ArrayBuffer} key - The key to identify the pointer.
 * @param {ArrayBuffer} value - The value of the pointer to store.
 */
@external('env', 'tstore')
export declare function tStorePointer(key: ArrayBuffer, value: ArrayBuffer): void;

/**
 * Deploys a contract from a specific address.
 * @param {ArrayBuffer} originAddress - The address from which the contract is deployed.
 * @param {ArrayBuffer} salt - The salt used for deployment.
 * @param {ArrayBuffer} calldata - The calldata for the contract.
 * @param {u32} calldataLength - The length of the calldata.
 * @param {ArrayBuffer} resultAddress - The buffer to store the resulting contract address.
 * @returns {u32} - Status code of the deployment.
 */
@external('env', 'deployFromAddress')
export declare function deployFromAddress(originAddress: ArrayBuffer, salt: ArrayBuffer, calldata: ArrayBuffer, calldataLength: u32, resultAddress: ArrayBuffer): u32;

/**
 * Updates the calling contract's bytecode from an existing contract.
 *
 * This VM opcode enables bytecode replacement where a contract can replace its own
 * execution logic by referencing another deployed contract containing the new WASM bytecode.
 * The new bytecode takes effect at the next block.
 *
 * @param {ArrayBuffer} sourceAddress - The address of the contract containing the new bytecode.
 * @param {ArrayBuffer} calldata - The calldata for the update (passed to onUpdate if implemented).
 * @param {u32} calldataLength - The length of the calldata.
 * @returns {u32} - Status code (0 = success, non-zero = failure).
 *
 * @remarks
 * - The source contract must be an already-deployed contract
 * - Storage layout compatibility is the developer's responsibility
 * - The contract address and all storage slots persist unchanged
 * - Only the execution logic changes
 *
 * @warning This is a privileged operation. Contracts should implement their own
 *          permission checks and optional timelock patterns before calling this.
 */
@external('env', 'updateFromAddress')
export declare function updateFromAddress(sourceAddress: ArrayBuffer, calldata: ArrayBuffer, calldataLength: u32): u32;

/**
 * Calls a contract.
 * @param {ArrayBuffer} address - The address of the contract to call.
 * @param {ArrayBuffer} calldata - The calldata for the contract call.
 * @param {u32} calldataLength - The length of the calldata.
 * @param {ArrayBuffer} resultLength - The buffer to store the length of the result.
 * @returns {u32} - Status code of the call.
 */
@external('env', 'call')
export declare function callContract(address: ArrayBuffer, calldata: ArrayBuffer, calldataLength: u32, resultLength: ArrayBuffer): u32;

/**
 * Retrieves the result of a contract call.
 * @param {u32} offset - The offset in memory where the result starts.
 * @param {u32} length - The length of the result.
 * @param {ArrayBuffer} result - The buffer to store the retrieved result.
 */
@external('env', 'callResult')
export declare function getCallResult(offset: u32, length: u32, result: ArrayBuffer): void;

/**
 * Logs data for debugging purposes.
 * @param {ArrayBuffer} data - The data to log.
 * @param {u32} dataLength - The length of the data.
 */
@external('debug', 'log')
export declare function log(data: ArrayBuffer, dataLength: u32): void;

/**
 * Emits an event.
 * @param {ArrayBuffer} data - The data to emit.
 * @param {u32} dataLength - The length of the data.
 */
@external('env', 'emit')
export declare function emit(data: ArrayBuffer, dataLength: u32): void;

/**
 * Computes the SHA-256 hash of the given data.
 * @param {ArrayBuffer} data - The data to hash.
 * @param {u32} dataLength - The length of the data.
 * @param {ArrayBuffer} result - The buffer to store the hash result.
 */
@external('env', 'sha256')
export declare function _sha256(data: ArrayBuffer, dataLength: u32, result: ArrayBuffer): void;

/**
 * Computes the SHA-256 hash of the given data.
 * @param {Uint8Array} data - The data to hash.
 * @returns {Uint8Array} - The SHA-256 hash.
 */
export function sha256(data: Uint8Array): Uint8Array {
    const resultBuffer = new ArrayBuffer(32);
    _sha256(data.buffer, data.length, resultBuffer);
    return Uint8Array.wrap(resultBuffer);
}

/**
 * Computes the SHA-256 hash of a string.
 * @param {string} data - The string to hash.
 * @returns {Uint8Array} - The SHA-256 hash.
 */
export function sha256String(data: string): Uint8Array {
    return sha256(stringToBytes(data));
}

/**
 * Computes the HASH160 (RIPEMD-160 of SHA-256) of the given data.
 * @param {Uint8Array} data - The data to hash.
 * @returns {Uint8Array} - The HASH160 result.
 */
export function hash160(data: Uint8Array): Uint8Array {
    return ripemd160(sha256(data));
}

/**
 * Computes the double SHA-256 hash of the given data.
 * @param {Uint8Array} data - The data to hash.
 * @returns {Uint8Array} - The double SHA-256 hash.
 */
export function hash256(data: Uint8Array): Uint8Array {
    return sha256(sha256(data));
}

/**
 * Converts a string to a byte array.
 * @param {string} str - The string to convert.
 * @returns {Uint8Array} - The byte array.
 */
function stringToBytes(str: string): Uint8Array {
    const bytes = String.UTF8.encode(str);
    return Uint8Array.wrap(bytes);
}

/**
 * Computes the RIPEMD-160 hash of the given data.
 * @param {ArrayBuffer} data - The data to hash.
 * @param {u32} dataLength - The length of the data.
 * @param {ArrayBuffer} result - The buffer to store the hash result.
 */
@external('env', 'ripemd160')
export declare function _ripemd160(data: ArrayBuffer, dataLength: u32, result: ArrayBuffer): void;

/**
 * Computes the RIPEMD-160 hash of the given data.
 * @param {Uint8Array} data - The data to hash.
 * @returns {Uint8Array} - The RIPEMD-160 hash.
 */
export function ripemd160(data: Uint8Array): Uint8Array {
    const resultBuffer = new ArrayBuffer(20);
    _ripemd160(data.buffer, data.length, resultBuffer);
    return Uint8Array.wrap(resultBuffer);
}

/**
 * Validates a Bitcoin address.
 * @param {ArrayBuffer} address - The Bitcoin address to validate.
 * @param {u32} addressLength - The length of the address.
 * @returns {u32} - 1 if valid, 0 otherwise.
 */
@external('env', 'validateBitcoinAddress')
export declare function validateBitcoinAddress(address: ArrayBuffer, addressLength: u32): u32;

/**
 * Retrieves the inputs of a transaction.
 * @param {ArrayBuffer} result - The buffer to store the inputs.
 */
@external('env', 'inputs')
export declare function inputs(result: ArrayBuffer): void;

/**
 * Retrieves the size of the inputs of a transaction.
 * @returns {u32} - The size of the inputs.
 */
@external('env', 'inputsSize')
export declare function getInputsSize(): u32;

/**
 * Retrieves the outputs of a transaction.
 * @param {ArrayBuffer} result - The buffer to store the outputs.
 */
@external('env', 'outputs')
export declare function outputs(result: ArrayBuffer): void;

/**
 * Retrieves the size of the outputs of a transaction.
 * @returns {u32} - The size of the outputs.
 */
@external('env', 'outputsSize')
export declare function getOutputsSize(): u32;

/**
 * Verifies a cryptographic signature using either Schnorr or ML-DSA algorithms.
 *
 * The signature algorithm is determined by the public key format:
 * - First byte indicates the signature type:
 *   - 0x00: ECDSA signature
 *   - 0x01: Schnorr signature (33 bytes total - type byte + 32-byte x-only public key)
 *   - 0x02: ML-DSA signature (variable length based on security level)
 *
 * For Schnorr signatures:
 * - Public key format: [0x01] + [32-byte x-only public key] (33 bytes total)
 * - Signature: 64 bytes
 * - Message: 32 bytes (typically a hash)
 * - Note: Schnorr signatures are only allowed when UNSAFE_QUANTUM_SIGNATURES_ALLOWED consensus flag is set
 *
 * For ML-DSA signatures (quantum-resistant):
 * - Public key format: [0x02] + [level byte] + [public key data]
 *   - Level 0x00: ML-DSA-44 (1313 bytes total - 1 header byte + 1312 key bytes)
 *   - Level 0x01: ML-DSA-65 (1955 bytes total - 1 header byte + 1952 key bytes)
 *   - Level 0x02: ML-DSA-87 (2593 bytes total - 1 header byte + 2592 key bytes)
 * - Signature lengths:
 *   - ML-DSA-44: 2420 bytes
 *   - ML-DSA-65: 3309 bytes
 *   - ML-DSA-87: 4627 bytes
 * - Message: 32 bytes (typically a hash)
 *
 * @example
 * ```typescript
 * // Schnorr signature verification
 * const writer = new BytesWriter(33);
 * writer.writeU8(0x01); // Schnorr type
 * writer.writeBytes(xOnlyPublicKey); // 32-byte x-only public key
 *
 * const publicKey = writer.getBuffer().buffer;
 * const signature = schnorrSig.buffer; // 64-byte signature
 * const message = messageHash.buffer; // 32-byte hash
 *
 * const isValid = verifySignature(publicKey, signature, message);
 * ```
 *
 * @example
 * ```typescript
 * // ML-DSA-44 signature verification
 * const writer = new BytesWriter(1314);
 * writer.writeU8(0x02); // ML-DSA type
 * writer.writeU8(0x00); // ML-DSA-44 level
 * writer.writeBytes(mldsaPublicKey); // 1312-byte public key
 *
 * const publicKey = writer.getBuffer().buffer;
 * const signature = mldsaSig.buffer; // 2420-byte signature
 * const message = messageHash.buffer; // 32-byte hash
 *
 * const isValid = verifySignature(publicKey, signature, message);
 * ```
 *
 * @example
 * ```typescript
 * // Reading signature verification result
 * const reader = new BytesReader(resultBytes);
 * const isValid = reader.readU32() === 1;
 * ```
 *
 * @param publicKey - The public key with type prefix (see format above)
 * @param signature - The signature to verify (size depends on algorithm)
 * @param message - The 32-byte message hash that was signed
 * @returns 1 if signature is valid, 0 if invalid or verification fails
 */
@external('env', 'verifySignature')
export declare function verifySignature(publicKey: ArrayBuffer, signature: ArrayBuffer, message: ArrayBuffer): u32;

/**
 * Retrieves the hash of a specific block.
 * @param {u64} block_number - The block number.
 * @param {ArrayBuffer} result - The buffer to store the block hash.
 */
@external('env', 'blockHash')
export declare function getBlockHash(block_number: u64, result: ArrayBuffer): void;

/**
 * Retrieves the account type of a given address.
 * @param {ArrayBuffer} address - The address to check.
 * @returns {u32} - The account type.
 */
@external('env', 'accountType')
export declare function getAccountType(address: ArrayBuffer): u32;

/**
 * Exits the environment with a status code and optional data.
 * @param {u32} status - The exit status code.
 * @param {ArrayBuffer} data - The data to return on exit.
 * @param {u32} dataLength - The length of the data.
 */
@external('env', 'exit')
export declare function env_exit(status: u32, data: ArrayBuffer, dataLength: u32): void;

@external('env', 'loadMLDSA')
declare function loadMLDSA(key: ArrayBuffer, result: ArrayBuffer): void;

/**
 * Loads an ML-DSA public key by its identifier.
 *
 * @param address - ML-DSA public key identifier
 * @param level - ML-DSA security level
 *
 * @warning Cannot be called during contract initialization (start function)
 * @warning Consumes LOAD_MLDSA_PUBLIC_KEY_GAS_COST gas units
 *
 * @example
 * ```typescript
 * const keyId = new ArrayBuffer(32);
 * const publicKey = new ArrayBuffer(1314); // For ML-DSA-44
 * loadMLDSAPublicKey(keyId, publicKey);
 * ```
 */
export function loadMLDSAPublicKey(address: Uint8Array, level: MLDSASecurityLevel): Uint8Array {
    const length = MLDSAMetadata.fromLevel(level) as i32;

    // Prepare Input: [Level (1 byte) + Address (32 bytes)]
    // Allocation is cheap for small fixed sizes.
    const inputBuffer = new Uint8Array(1 + ADDRESS_BYTE_LENGTH);
    const inputPtr = inputBuffer.dataStart;

    store<u8>(inputPtr, level as u8);

    // Copy address bytes directly
    memory.copy(inputPtr + 1, address.dataStart, ADDRESS_BYTE_LENGTH);

    // Prepare Output: [Exists (1 byte) + Key (length bytes)]
    const resultBuffer = new Uint8Array(1 + length);

    // Host Call
    loadMLDSA(inputBuffer.buffer, resultBuffer.buffer);

    // Check Exists (Byte 0) via direct load
    if (load<u8>(resultBuffer.dataStart) === 0) {
        throw new Error('ML-DSA public key not found');
    }

    // Return Key
    // slice(1) creates a new buffer with just the key.

    // Note: using .subarray(1) would be O(1) (view) vs .slice(1) which is O(N) (copy).
    // slice is safer if you need a standalone buffer, but subarray is faster for gas.
    // Sticking to slice to match original behavior (fresh buffer).
    return resultBuffer.slice(1);
}

export * from './Atomic';

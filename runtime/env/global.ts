/* eslint-disable */

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
 * Verifies a Schnorr signature.
 * @param {ArrayBuffer} publicKey - The public key used for verification.
 * @param {ArrayBuffer} signature - The signature to verify.
 * @param {ArrayBuffer} message - The message that was signed.
 * @returns {u32} - 1 if valid, 0 otherwise.
 */
@external('env', 'verifySchnorrSignature')
export declare function verifySchnorrSignature(publicKey: ArrayBuffer, signature: ArrayBuffer, message: ArrayBuffer): u32;

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

export * from './Atomic';

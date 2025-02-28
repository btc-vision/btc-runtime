// @ts-ignore
@external('env', 'calldata')
export declare function getCalldata(offset: u32, length: u32, result: ArrayBuffer): void;

// @ts-ignore
@external('env', 'load')
export declare function loadPointer(key: ArrayBuffer, result: ArrayBuffer): void;

// @ts-ignore
@external('env', 'nextPointerGreaterThan')
export declare function nextPointerGreaterThan(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'store')
export declare function storePointer(key: ArrayBuffer, value: ArrayBuffer): void;

// @ts-ignore
@external('env', 'deployFromAddress')
export declare function deployFromAddress(originAddress: ArrayBuffer, salt: ArrayBuffer, resultAddress: ArrayBuffer): u32;

// @ts-ignore
@external('env', 'call')
export declare function callContract(address: ArrayBuffer, calldata: ArrayBuffer, calldataLength: u32, resultLength: ArrayBuffer): void;

// @ts-ignore
@external('env', 'callResult')
export declare function getCallResult(offset: u32, length: u32, result: ArrayBuffer): void;

// @ts-ignore
@external('debug', 'log')
export declare function log(data: Uint8Array): void;

// @ts-ignore
@external('env', 'emit')
export declare function emit(data: ArrayBuffer, dataLength: u32): void;

// @ts-ignore
@external('env', 'encodeAddress')
export declare function encodeAddress(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'sha256')
export declare function _sha256(data: ArrayBuffer, dataLength: u32, result: ArrayBuffer): void;

export function sha256(data: Uint8Array): Uint8Array {
    const resultBuffer = new ArrayBuffer(32);
    _sha256(data.buffer, data.length, resultBuffer);
    return Uint8Array.wrap(resultBuffer);
}

// @ts-ignore
@external('env', 'ripemd160')
export declare function _ripemd160(data: ArrayBuffer, dataLength: u32, result: ArrayBuffer): void;

export function ripemd160(data: Uint8Array): Uint8Array {
    const resultBuffer = new ArrayBuffer(20);
    _ripemd160(data.buffer, data.length, resultBuffer);

    return Uint8Array.wrap(resultBuffer);
}

// @ts-ignore
@external('env', 'validateBitcoinAddress')
export declare function validateBitcoinAddress(address: ArrayBuffer, addressLength: u32): u32;

// @ts-ignore
@external('env', 'inputs')
export declare function inputs(result: ArrayBuffer): void;

// @ts-ignore
@external('env', 'inputsSize')
export declare function getInputsSize(): u32;

// @ts-ignore
@external('env', 'outputs')
export declare function outputs(result: ArrayBuffer): void;

// @ts-ignore
@external('env', 'outputsSize')
export declare function getOutputsSize(): u32;

// @ts-ignore
@external('env', 'verifySchnorrSignature')
export declare function verifySchnorrSignature(publicKey: ArrayBuffer, signature: ArrayBuffer, message: ArrayBuffer): u32;

// @ts-ignore
@external('env', 'exit')
export declare function env_exit(status: u32, data: ArrayBuffer, dataLength: u32): void;

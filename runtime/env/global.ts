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
@external('env', 'deploy')
export declare function deploy(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'deployFromAddress')
export declare function deployFromAddress(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'call')
export declare function callContract(address: ArrayBuffer, calldata: ArrayBuffer, calldataLength: u32, resultLength: ArrayBuffer): void;

// @ts-ignore
@external('env', 'callResult')
export declare function getCallResult(offset: u32, length: u32, result: ArrayBuffer): void;

// @ts-ignore
@external('env', 'log')
export declare function log(data: Uint8Array): void;

// @ts-ignore
@external('env', 'emit')
export declare function emit(data: Uint8Array): void;

// @ts-ignore
@external('env', 'encodeAddress')
export declare function encodeAddress(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'sha256')
export declare function sha256(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'ripemd160')
export declare function ripemd160(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'validateBitcoinAddress')
export declare function validateBitcoinAddress(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'inputs')
export declare function inputs(): Uint8Array;

// @ts-ignore
@external('env', 'outputs')
export declare function outputs(): Uint8Array;

// @ts-ignore
@external('env', 'verifySchnorrSignature')
export declare function verifySchnorrSignature(data: Uint8Array): Uint8Array;

import { Sha256 } from '../SHA256/sha256';
import { ripemd160f } from '../SHA256/ripemd160f';
import { Blockchain } from './index';

// @ts-ignore
@external('env', 'load')
export declare function loadPointer(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'nextPointerGreaterThan')
export declare function nextPointerGreaterThan(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'store')
export declare function storePointer(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'deploy')
export declare function deploy(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'deployFromAddress')
export declare function deployFromAddress(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'call')
export declare function callContract(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'emit')
export declare function emit(data: Uint8Array): void;

// @ts-ignore
@external('env', 'encodeAddress')
export declare function encodeAddress(data: Uint8Array): Uint8Array;

// @ts-ignore
export function sha256(data: Uint8Array): Uint8Array {
    return Sha256.hash(data);
}

// @ts-ignore
export function ripemd160(data: Uint8Array): Uint8Array {
    return ripemd160f(data);
}

// @ts-ignore
@external('env', 'validateBitcoinAddress')
export declare function validateBitcoinAddress(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'inputs')
export declare function inputs(): Uint8Array;

// @ts-ignore
//@external('env', 'outputs')
export function outputs(): Uint8Array {
    return Blockchain.mockedTransactionOutput();
}

// @ts-ignore
@external('env', 'verifySchnorrSignature')
export declare function verifySchnorrSignature(data: Uint8Array): Uint8Array;

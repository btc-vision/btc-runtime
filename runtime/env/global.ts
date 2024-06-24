import { u256 } from 'as-bignum/assembly/integer/u256';

// @ts-ignore
@external('env', 'load')
export declare function load(data: Uint8Array): u256;

// @ts-ignore
@external('env', 'store')
export declare function store(data: Uint8Array): void;

// @ts-ignore
@external('env', 'deploy')
export declare function deploy(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'deployFromAddress')
export declare function deployFromAddress(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'call')
export declare function call(calldata: Uint8Array): Uint8Array;

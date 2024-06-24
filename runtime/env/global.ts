import { u256 } from "as-bignum/assembly/integer/u256";
import { Address } from "../types/Address";

// @ts-ignore
@external('env', 'load')
export declare function load(pointer: u256): u256;

// @ts-ignore
@external('env', 'store')
export declare function store(pointer: u256, value: u256): void;

// @ts-ignore
@external('env', 'deploy')
export declare function deploy(bytecode: Uint8Array): Address;

// @ts-ignore
@external('env', 'call')
export declare function call(callee: Address, calldata: Uint8Array): Uint8Array;

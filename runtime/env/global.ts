import { Sha256 } from '../SHA256/sha256';
import { ripemd160f } from '../SHA256/ripemd160f';
import { Blockchain } from './index';

export function sha256(data: Uint8Array): Uint8Array {
    return Sha256.hash(data);
}

export function ripemd160(data: Uint8Array): Uint8Array {
    return ripemd160f(data);
}

export function inputs(): Uint8Array {
    return Blockchain.mockedTransactionInputs();
}

export function outputs(): Uint8Array {
    return Blockchain.mockedTransactionOutput();
}

export * from './Atomic';

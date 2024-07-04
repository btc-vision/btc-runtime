import { sha256 } from '../env/global';

export class Sha256 {
    static hash(buffer: Uint8Array): Uint8Array {
        return sha256(buffer);
    }

    static hash256(buffer: Uint8Array): Uint8Array {
        const hash = sha256(buffer);
        return sha256(hash);
    }
}

import { Potential } from '../lang/Definitions';
import { bech32m as _bech32m, toWords } from '../utils/b32';

export const ADDRESS_BYTE_LENGTH: i32 = 32;

@final
export class Address extends Uint8Array {
    private readonly prefix: ArrayBuffer;

    public constructor() {
        super(ADDRESS_BYTE_LENGTH);

        this.prefix = String.UTF8.encode('bc');
    }

    public toBech32m(): string {
        return String.UTF8.decode(_bech32m(this.prefix, toWords(this.buffer)));
    }
}

export declare type PotentialAddress = Potential<Address>;

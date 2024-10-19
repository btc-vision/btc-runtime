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

    @inline
    public toBech32m(): string {
        return String.UTF8.decode(_bech32m(this.prefix, toWords(this.buffer)));
    }

    @inline
    @operator('==')
    public equals(a: Address): bool {
        if (a.length != this.length) {
            return false;
        }

        for (let i = 0; i < this.length; i++) {
            if (this[i] != a[i]) {
                return false;
            }
        }

        return true;
    }

    @inline
    @operator('!=')
    public notEquals(a: Address): bool {
        return !this.equals(a);
    }
}

export declare type PotentialAddress = Potential<Address>;

import { ICodec } from '../interfaces/ICodec';
import { Address } from '../../types/Address';

class _AddressCodec implements ICodec<Address> {
    public encode(value: Address): Uint8Array {
        return value;
    }

    public decode(buffer: Uint8Array): Address {
        if (buffer.length == 0) {
            return Address.zero();
        }

        return Address.fromUint8Array(buffer);
    }
}

export const idOfAddressCodec = idof<_AddressCodec>();
export const AddressCodec = new _AddressCodec();
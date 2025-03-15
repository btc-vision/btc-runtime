import { ICodec } from '../interfaces/ICodec';
import { VariableBytesCodec } from './VariableBytesCodec';

class IStringCodec implements ICodec<string> {
    public encode(value: string): Uint8Array {
        // Convert string -> UTF8 bytes
        const utf8 = String.UTF8.encode(value, false);

        // Pass to variable-bytes
        return VariableBytesCodec.encode(Uint8Array.wrap(utf8));
    }

    public decode(buffer: Uint8Array): string {
        const raw = VariableBytesCodec.decode(buffer);
        if (raw.length == 0) {
            return '';
        }

        return String.UTF8.decode(raw.buffer, false);
    }
}

export const idOfStringCodec = idof<IStringCodec>();
export const StringCodec = new IStringCodec();
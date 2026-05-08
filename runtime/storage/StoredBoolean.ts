import { Blockchain } from '../env';
import { EMPTY_POINTER, GET_EMPTY_BUFFER } from '../math/bytes';
import { encodePointer } from '../math/abi';

@final
export class StoredBoolean {
    private readonly pointerBuffer: Uint8Array;
    private readonly defaultValue: bool;
    private _loaded: bool;

    constructor(
        public pointer: u16,
        defaultValue: bool,
    ) {
        this.pointerBuffer = encodePointer(pointer, EMPTY_POINTER, true, 'StoredBoolean');
        this.defaultValue = defaultValue;
        this._value = GET_EMPTY_BUFFER();
        this._loaded = false;
    }

    private _value: Uint8Array;

    @inline
    public get value(): bool {
        this.ensureValue();

        return this._value[0] === 1;
    }

    public set value(value: bool) {
        this._value[0] = value ? 1 : 0;
        this._value[1] = 1; // mark as initialized
        this._loaded = true;

        Blockchain.setStorageAt(this.pointerBuffer, this._value);
    }

    @inline
    public toUint8Array(): Uint8Array {
        this.ensureValue();

        return this._value;
    }

    private ensureValue(): void {
        if (this._loaded) {
            return;
        }

        const stored = Blockchain.getStorageAt(this.pointerBuffer);
        if (stored[1] === 0) {
            this._value[0] = this.defaultValue ? 1 : 0;
            this._value[1] = 1;

            Blockchain.setStorageAt(this.pointerBuffer, this._value);
        } else {
            this._value = stored;
        }

        this._loaded = true;
    }
}

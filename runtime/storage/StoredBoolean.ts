import { Blockchain } from '../env';
import { GET_EMPTY_BUFFER } from '../math/bytes';
import { Revert } from '../types/Revert';

@final
export class StoredBoolean {
    private readonly pointerBuffer: Uint8Array = new Uint8Array(32);

    constructor(
        public pointer: u16,
        defaultValue: bool,
    ) {
        this.pointerBuffer[0] = pointer & 255;
        this.pointerBuffer[1] = (pointer << 8) & 255;

        if (defaultValue) {
            this._value[0] = 1;
        }
    }

    private _value: Uint8Array = GET_EMPTY_BUFFER();

    @inline
    public get value(): bool {
        this.ensureValue();

        return this._value[0] === 1;
    }

    @inline
    public set value(value: bool) {
        this._value[0] = value ? 1 : 0;

        Blockchain.setStorageAt(this.pointerBuffer, this._value);
    }

    @inline
    public toUint8Array(): Uint8Array {
        if (!this._value) {
            throw new Revert(`Not defined.`);
        }

        return this._value;
    }

    private ensureValue(): void {
        this._value = Blockchain.getStorageAt(
            this.pointerBuffer,
            this._value,
        );

    }
}

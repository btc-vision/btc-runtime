import { Blockchain } from '../env';
import { EMPTY_POINTER, GET_EMPTY_BUFFER } from '../math/bytes';
import { Revert } from '../types/Revert';
import { encodePointer } from '../math/abi';

@final
export class StoredBoolean {
    private readonly pointerBuffer: Uint8Array;

    constructor(
        public pointer: u16,
        defaultValue: bool,
    ) {
        this.pointerBuffer = encodePointer(pointer, EMPTY_POINTER, true, 'StoredBoolean');

        const value = GET_EMPTY_BUFFER();
        if (defaultValue) {
            value[0] = 1;
        }

        this._value = value;
    }

    private _value: Uint8Array;

    @inline
    public get value(): bool {
        this.ensureValue();

        return this._value[0] === 1;
    }

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
        this._value = Blockchain.getStorageAt(this.pointerBuffer);
    }
}

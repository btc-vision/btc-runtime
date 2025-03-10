import { Revert } from '../types/Revert';
import { IMap } from './Map';

export function eqUint(data: Uint8Array, data2: Uint8Array): bool {
    if (data.length !== data2.length) return false;

    for (let i = 0; i < data.length; i++) {
        if (data[i] !== data2[i]) return false;
    }

    return true;
}

@final
export class MapUint8Array implements IMap<Uint8Array, Uint8Array> {
    protected _keys: Uint8Array[] = [];
    protected _values: Uint8Array[] = [];

    public get size(): i32 {
        return this._keys.length;
    }

    public keys(): Uint8Array[] {
        return this._keys;
    }

    public values(): Uint8Array[] {
        return this._values;
    }

    public set(key: Uint8Array, value: Uint8Array): this {
        const index: i32 = this.indexOf(key);
        if (index === -1) {
            this._keys.push(key);
            this._values.push(value);
        } else {
            this._values[index] = value;
        }

        return this;
    }

    public indexOf(pointerHash: Uint8Array): i32 {
        for (let i: i32 = 0; i < this._keys.length; i++) {
            const key = this._keys[i];

            if (eqUint(key, pointerHash)) {
                return i;
            }
        }

        return -1;
    }

    public has(key: Uint8Array): bool {
        return this.indexOf(key) !== -1;
    }

    public get(key: Uint8Array): Uint8Array {
        const index: i32 = this.indexOf(key);
        if (index === -1) {
            throw new Revert('Key not found in map (uint8array)');
        }
        return this._values[index];
    }

    public delete(key: Uint8Array): bool {
        const index: i32 = this.indexOf(key);
        if (index === -1) {
            return false;
        }

        this._keys.splice(index, 1);
        this._values.splice(index, 1);

        return true;
    }

    public clear(): void {
        this._keys = [];
        this._values = [];
    }

    public toString(): string {
        const str: string = ``;

        for (let i: i32 = 0; i < this._keys.length; i++) {
            str.concat(`[${this._keys[i].toString()}] => [${this._values[i].toString()}]`);
        }

        return str;
    }
}

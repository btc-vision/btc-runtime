import { Revert } from '../types/Revert';
import { Map } from './Map';

export function eqUint(data: Uint8Array, data2: Uint8Array): bool {
    if (data.length !== data2.length) return false;

    for (let i = 0; i < data.length; i++) {
        if (data[i] !== data2[i]) return false;
    }

    return true;
}

export class MapUint8Array extends Map<Uint8Array, Uint8Array> {
    public set(key: Uint8Array, value: Uint8Array): void {
        const index: i32 = this._keys.indexOf(key);
        if (index == -1) {
            this._keys.push(key);
            this._values.push(value);
        } else {
            this._values[index] = value;
        }
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
        for (let i: i32 = 0; i < this._keys.length; i++) {
            if (eqUint(this._keys[i], key)) {
                return true;
            }
        }

        return false;
    }

    public get(key: Uint8Array): Uint8Array {
        const index: i32 = this.indexOf(key);
        if (index == -1) {
            throw new Revert('Key not found in map (u256)');
        }
        return this._values[index];
    }

    public delete(key: Uint8Array): bool {
        const index: i32 = this.indexOf(key);
        if (index == -1) {
            return false;
        }

        this._keys.splice(index, 1);
        this._values.splice(index, 1);

        return true;
    }
}

import { Revert } from '../types/Revert';
import { u256 } from '@btc-vision/as-bignum/assembly';
import { Map } from './Map';

export class MapU256 extends Map<u256, u256> {
    public set(key: u256, value: u256): this {
        const index: i32 = this.indexOf(key);
        if (index === -1) {
            this._keys.push(key);
            this._values.push(value);
        } else {
            this._values[index] = value;
        }

        return this;
    }

    public indexOf(pointerHash: u256): i32 {
        for (let i: i32 = 0; i < this._keys.length; i++) {
            const key = this._keys[i];

            if (u256.eq(key, pointerHash)) {
                return i;
            }
        }

        return -1;
    }

    public has(key: u256): bool {
        for (let i: i32 = 0; i < this._keys.length; i++) {
            if (u256.eq(this._keys[i], key)) {
                return true;
            }
        }

        return false;
    }

    public get(key: u256): u256 {
        const index: i32 = this.indexOf(key);
        if (index === -1) {
            throw new Revert('Key not found in map (u256)');
        }
        return this._values[index];
    }

    public delete(key: u256): bool {
        const index: i32 = this.indexOf(key);
        if (index === -1) {
            return false;
        }

        this._keys.splice(index, 1);
        this._values.splice(index, 1);

        return true;
    }
}

import { Revert } from '../types/Revert';

export interface IMap<K, V> {
    readonly size: i32;

    has(key: K): bool;

    set(key: K, value: V): this;

    get(key: K): V;

    delete(key: K): bool;

    clear(): void;

    keys(): K[]; // preliminary
    values(): V[]; // preliminary
    toString(): string;
}

export class Map<K, V> implements IMap<K, V> {
    protected _keys: K[] = [];
    protected _values: V[] = [];

    public get size(): i32 {
        return this._keys.length;
    }

    public keys(): K[] {
        return this._keys;
    }

    public values(): V[] {
        return this._values;
    }

    public set(key: K, value: V): this {
        const index: i32 = this.indexOf(key);
        if (index == -1) {
            this._keys.push(key);
            this._values.push(value);
        } else {
            this._values[index] = value;
        }

        return this;
    }

    public indexOf(key: K): i32 {
        for (let i: i32 = 0; i < this._keys.length; i++) {
            if (this._keys[i] == key) {
                return i;
            }
        }

        return -1;
    }

    public get(key: K): V {
        const index: i32 = this.indexOf(key);
        if (index == -1) {
            throw new Revert('Key not found in map (Map)');
        }
        return this._values[index];
    }

    public has(key: K): bool {
        return this.indexOf(key) != -1;
    }

    public delete(key: K): bool {
        const index: i32 = this.indexOf(key);
        if (index == -1) {
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
            str.concat(`[${this._keys[i]}] => [${this._values[i]}]`);
        }

        return str;
    }
}

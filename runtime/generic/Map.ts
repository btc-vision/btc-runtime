import { Revert } from '../types/Revert';

export interface IMap<K, V> {
    readonly size: i32;
    has(key: K): bool;
    set(key: K, value: V): this;
    get(key: K): V;
    delete(key: K): bool;
    clear(): void;
    keys(): K[];
    values(): V[];
    toString(): string;
}

export class Map<K, V> implements IMap<K, V> {
    protected _keys: K[] = [];
    protected _values: V[] = [];

    // OPTIMIZATION: Cache the last found index.
    // This makes has() -> get() sequences O(1) for the second call.
    protected _lastIndex: i32 = -1;

    @inline
    public get size(): i32 {
        return this._keys.length;
    }

    @inline
    public keys(): K[] {
        return this._keys;
    }

    @inline
    public values(): V[] {
        return this._values;
    }

    public set(key: K, value: V): this {
        // Fast Cache Check
        if (this._lastIndex != -1) {
            if (unchecked(this._keys[this._lastIndex]) == key) {
                unchecked((this._values[this._lastIndex] = value));
                return this;
            }
        }

        // Full Scan
        const index = this.indexOf(key);

        if (index == -1) {
            this._keys.push(key);
            this._values.push(value);
            // Update cache to new item
            this._lastIndex = this._keys.length - 1;
        } else {
            unchecked((this._values[index] = value));
            // Update cache to found item (indexOf updates it too, but explicit here for safety)
            this._lastIndex = index;
        }

        return this;
    }

    /**
     * Optimized Linear Scan.
     * Iterates backwards (LIFO assumption: recent items are hotter).
     */
    public indexOf(key: K): i32 {
        const len = this._keys.length;

        // Optimization: Check cache first
        if (this._lastIndex != -1 && this._lastIndex < len) {
            if (unchecked(this._keys[this._lastIndex]) == key) {
                return this._lastIndex;
            }
        }

        // Reverse loop is often slightly faster for finding recent items
        for (let i = len - 1; i >= 0; i--) {
            if (unchecked(this._keys[i] == key)) {
                this._lastIndex = i; // Update cache
                return i;
            }
        }

        return -1;
    }

    public get(key: K): V {
        const index = this.indexOf(key);
        if (index == -1) {
            throw new Revert('Key not found in map (Map)');
        }
        return unchecked(this._values[index]);
    }

    @inline
    public has(key: K): bool {
        return this.indexOf(key) != -1;
    }

    /**
     * Optimized Delete (Swap and Pop).
     * O(1) complexity instead of O(N) splice.
     */
    public delete(key: K): bool {
        const index = this.indexOf(key);
        if (index == -1) {
            return false;
        }

        const lastIndex = this._keys.length - 1;

        // If the element to delete is not the last one, swap it with the last one
        if (index != lastIndex) {
            unchecked((this._keys[index] = this._keys[lastIndex]));
            unchecked((this._values[index] = this._values[lastIndex]));

            // Fix cache if we moved the cached item
            if (this._lastIndex == lastIndex) {
                this._lastIndex = index;
            } else if (this._lastIndex == index) {
                this._lastIndex = -1;
            }
        } else {
            // We are deleting the tail
            if (this._lastIndex == lastIndex) this._lastIndex = -1;
        }

        this._keys.pop();
        this._values.pop();

        return true;
    }

    @inline
    public clear(): void {
        this._keys = [];
        this._values = [];
        this._lastIndex = -1;
    }

    public toString(): string {
        // Warning: String concatenation in loops is O(N^2). Use sparingly.
        let str = '';
        const len = this._keys.length;
        for (let i = 0; i < len; i++) {
            str += `[${unchecked(this._keys[i])}] => [${unchecked(this._values[i])}]`;
        }
        return str;
    }
}

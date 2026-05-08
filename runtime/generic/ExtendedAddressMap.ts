import { ExtendedAddress } from '../types/ExtendedAddress';
import { Revert } from '../types/Revert';
import { IMap } from './Map';

/**
 * A map implementation using ExtendedAddress (64 bytes) as keys.
 * Uses hyper-optimized search with prefix filtering for performance.
 */
@final
export class ExtendedAddressMap<V> implements IMap<ExtendedAddress, V> {
    protected _keys: ExtendedAddress[] = [];
    protected _values: V[] = [];

    // CACHE: Stores the index of the last successful lookup to make repeated access O(1)
    private _lastIndex: i32 = -1;

    @inline
    public get size(): i32 {
        return this._keys.length;
    }

    @inline
    public keys(): ExtendedAddress[] {
        return this._keys;
    }

    @inline
    public values(): V[] {
        return this._values;
    }

    public set(key: ExtendedAddress, value: V): this {
        const index = this.indexOf(key);

        if (index === -1) {
            this._keys.push(key);
            this._values.push(value);
            this._lastIndex = this._keys.length - 1;
        } else {
            unchecked((this._values[index] = value));
            this._lastIndex = index;
        }

        return this;
    }

    /**
     * HYPER-OPTIMIZED SEARCH
     * Compares both the ML-DSA key hash (inherited) and tweakedPublicKey.
     */
    public indexOf(searchKey: ExtendedAddress): i32 {
        if (this.isLastIndex(searchKey)) {
            return this._lastIndex;
        }

        const len = this._keys.length;
        if (len === 0) return -1;

        const searchMldsaData = searchKey.dataStart;
        const searchTweakedData = searchKey.tweakedPublicKey.dataStart;

        // Loop Backwards (finding most recently added items first)
        for (let i = len - 1; i >= 0; i--) {
            const key = unchecked(this._keys[i]);

            // Quick prefix check on ML-DSA key hash (first 8 bytes)
            if (load<u64>(key.dataStart) !== load<u64>(searchMldsaData)) continue;

            // Quick prefix check on tweaked public key (first 8 bytes)
            if (load<u64>(key.tweakedPublicKey.dataStart) !== load<u64>(searchTweakedData))
                continue;

            // Full comparison of ML-DSA key hash (32 bytes)
            if (memory.compare(key.dataStart, searchMldsaData, 32) !== 0) continue;

            // Full comparison of tweaked public key (32 bytes)
            if (memory.compare(key.tweakedPublicKey.dataStart, searchTweakedData, 32) === 0) {
                this._lastIndex = i;
                return i;
            }
        }

        return -1;
    }

    @inline
    public has(key: ExtendedAddress): bool {
        return this.indexOf(key) !== -1;
    }

    public get(key: ExtendedAddress): V {
        const index = this.indexOf(key);
        if (index === -1) {
            throw new Revert('Key not found in map');
        }
        return unchecked(this._values[index]);
    }

    public delete(key: ExtendedAddress): bool {
        const index = this.indexOf(key);
        if (index === -1) return false;

        this._keys.splice(index, 1);
        this._values.splice(index, 1);

        this._lastIndex = -1;

        return true;
    }

    @inline
    public clear(): void {
        this._keys = [];
        this._values = [];
        this._lastIndex = -1;
    }

    public toString(): string {
        return `ExtendedAddressMap(size=${this._keys.length})`;
    }

    private isLastIndex(key: ExtendedAddress): bool {
        if (this._lastIndex !== -1) {
            const cachedKey = unchecked(this._keys[this._lastIndex]);

            // Check ML-DSA key hash equality
            if (memory.compare(cachedKey.dataStart, key.dataStart, 32) !== 0) {
                return false;
            }

            // Check tweaked public key equality
            if (
                memory.compare(
                    cachedKey.tweakedPublicKey.dataStart,
                    key.tweakedPublicKey.dataStart,
                    32,
                ) === 0
            ) {
                return true;
            }
        }

        return false;
    }
}

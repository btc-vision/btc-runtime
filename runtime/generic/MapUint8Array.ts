import { Revert } from '../types/Revert';
import { IMap } from './Map';

/**
 * Optimized equality check using WASM intrinsic memory comparison.
 */
@inline
export function eqUint(data: Uint8Array, data2: Uint8Array): bool {
    if (data.length !== data2.length) return false;
    return memory.compare(data.dataStart, data2.dataStart, data.length) === 0;
}

@final
export class MapUint8Array implements IMap<Uint8Array, Uint8Array> {
    protected _keys: Uint8Array[] = [];
    protected _values: Uint8Array[] = [];

    // CACHE: Stores the index of the last successful lookup to make repeated access O(1)
    private _lastIndex: i32 = -1;

    @inline
    public get size(): i32 {
        return this._keys.length;
    }

    @inline
    public keys(): Uint8Array[] {
        return this._keys;
    }

    @inline
    public values(): Uint8Array[] {
        return this._values;
    }

    public set(key: Uint8Array, value: Uint8Array): this {
        let index = this.indexOf(key);

        if (index === -1) {
            this._keys.push(key);
            this._values.push(value);
            this._lastIndex = this._keys.length - 1;
        } else {
            unchecked((this._values[index] = value));
            // Cache is already pointing to this index (from indexOf)
            this._lastIndex = index;
        }

        return this;
    }

    /**
     * HYPER-OPTIMIZED SEARCH
     * Scans for Data Equality (not object equality).
     * Uses a "Prefix Filter" to skip expensive memory comparisons.
     */
    public indexOf(pointerHash: Uint8Array): i32 {
        if (this.isLastIndex(pointerHash)) {
            return this._lastIndex;
        }

        const len = this._keys.length;
        if (len === 0) return -1;

        const ptrLen = pointerHash.length;
        const ptrData = pointerHash.dataStart;

        // OPTIMIZATION: Prefix Filter
        // If keys are long enough (hashes/addresses), we compare the first 8 bytes as a simple integer.
        // This is 1 CPU cycle vs ~30+ cycles for a function call loop.
        if (ptrLen >= 8) {
            // Read the first 8 bytes of the SEARCH NEEDLE
            const searchHeader = load<u64>(ptrData);

            // Loop Backwards (finding most recently added items first is usually better for contracts)
            for (let i = len - 1; i >= 0; i--) {
                const key = unchecked(this._keys[i]);

                // Cheap Length Check
                if (key.length !== ptrLen) continue;

                // Cheap Integer Check (The Prefix Filter)
                // This reads the CONTENT of the key, not the object pointer.
                // If the first 8 bytes of data don't match, we skip the expensive check.
                if (load<u64>(key.dataStart) !== searchHeader) continue;

                // Expensive Full Check
                // Only runs if length AND first 8 bytes match.
                if (memory.compare(key.dataStart, ptrData, ptrLen) === 0) {
                    this._lastIndex = i;
                    return i;
                }
            }
        } else {
            // Fallback for small keys (< 8 bytes)
            for (let i = len - 1; i >= 0; i--) {
                const key = unchecked(this._keys[i]);
                if (key.length !== ptrLen) continue;

                if (memory.compare(key.dataStart, ptrData, ptrLen) === 0) {
                    this._lastIndex = i;
                    return i;
                }
            }
        }

        return -1;
    }

    @inline
    public has(key: Uint8Array): bool {
        return this.indexOf(key) !== -1;
    }

    public get(key: Uint8Array): Uint8Array {
        const index = this.indexOf(key);
        if (index === -1) {
            throw new Revert('Key not found in map (uint8array)');
        }
        return unchecked(this._values[index]);
    }

    public delete(key: Uint8Array): bool {
        const index = this.indexOf(key);
        if (index === -1) return false;

        const lastIndex = this._keys.length - 1;

        // Swap and Pop (O(1) delete)
        if (index !== lastIndex) {
            // Move last element to the deleted position
            unchecked((this._keys[index] = this._keys[lastIndex]));
            unchecked((this._values[index] = this._values[lastIndex]));

            // Update cache based on what was affected
            if (this._lastIndex === lastIndex) {
                // Cache pointed to last element, which moved to 'index'
                this._lastIndex = index;
            } else if (this._lastIndex === index) {
                // Cache pointed to deleted element, invalidate it
                this._lastIndex = -1;
            }
            // Note: If cache points to any other index, it remains valid
            // because swap-and-pop only modifies positions 'index' and 'lastIndex'
        } else {
            // Deleting the last element (no swap needed)
            if (this._lastIndex === lastIndex) {
                this._lastIndex = -1;
            }
            // If cache points to any earlier index, it remains valid
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
        return `Map(size=${this._keys.length})`;
    }

    private isLastIndex(key: Uint8Array): bool {
        if (this._lastIndex !== -1) {
            const cachedKey = unchecked(this._keys[this._lastIndex]);
            // Check length first, then full content equality
            if (cachedKey.length === key.length) {
                if (memory.compare(cachedKey.dataStart, key.dataStart, key.length) === 0) {
                    return true;
                }
            }
        }

        return false;
    }
}

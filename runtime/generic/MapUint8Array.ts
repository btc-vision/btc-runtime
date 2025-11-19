import { Revert } from '../types/Revert';
import { IMap } from './Map';

/**
 * Optimized equality check using WASM intrinsic memory comparison.
 * Orders of magnitude faster than looping in AssemblyScript.
 */
@inline
export function eqUint(data: Uint8Array, data2: Uint8Array): bool {
    if (data.length !== data2.length) return false;
    // CRITICAL: Use .dataStart to compare actual bytes, NOT object headers (.buffer)
    return memory.compare(data.dataStart, data2.dataStart, data.length) === 0;
}

@final
export class MapUint8Array implements IMap<Uint8Array, Uint8Array> {
    protected _keys: Uint8Array[] = [];
    protected _values: Uint8Array[] = [];

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
        const index = this.indexOf(key);

        if (index === -1) {
            this._keys.push(key);
            this._values.push(value);
        } else {
            // Safe unchecked access since we know index exists
            unchecked(this._values[index] = value);
        }

        return this;
    }

    /**
     * Optimized linear scan.
     * Inlines the equality check to avoid function call overhead in hot loops.
     */
    public indexOf(pointerHash: Uint8Array): i32 {
        const len = this._keys.length;
        const ptrLen = pointerHash.length;
        // Get raw data pointer once to avoid property access in loop
        const ptrData = pointerHash.dataStart;

        for (let i: i32 = 0; i < len; i++) {
            const key = unchecked(this._keys[i]);

            // Fast fail on length mismatch
            if (key.length !== ptrLen) continue;

            // Intrinsic memory compare on data payload
            if (memory.compare(key.dataStart, ptrData, ptrLen) === 0) {
                return i;
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

    /**
     * O(1) Delete strategy (Swap and Pop).
     * Instead of splicing (shifting all elements), we move the last element
     * into the gap and pop the end. Map order is not preserved, but gas is saved.
     */
    public delete(key: Uint8Array): bool {
        const index = this.indexOf(key);
        if (index === -1) {
            return false;
        }

        const lastIndex = this._keys.length - 1;

        // If the element to delete is not the last one, swap it with the last one
        if (index !== lastIndex) {
            unchecked(this._keys[index] = this._keys[lastIndex]);
            unchecked(this._values[index] = this._values[lastIndex]);
        }

        // Pop the last element (which is now either the target or a duplicate)
        this._keys.pop();
        this._values.pop();

        return true;
    }

    @inline
    public clear(): void {
        // Reassigning empty arrays is cheaper than looping pop
        this._keys = [];
        this._values = [];
    }

    public toString(): string {
        return `Map(size=${this._keys.length})`;
    }
}


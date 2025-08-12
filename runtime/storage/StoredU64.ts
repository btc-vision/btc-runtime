import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { BytesReader } from '../buffer/BytesReader';

/**
 * @class StoredU64
 * @description Manages up to four u64 values within a single u256 storage slot.
 */
@final
export class StoredU64 {
    private readonly bufferPointer: Uint8Array;

    // Internal cache for four u64 values: [lo1, lo2, hi1, hi2]
    private _values: u64[] = [0, 0, 0, 0];

    // Flag to indicate if values are loaded from storage
    private isLoaded: bool = false;

    // Flag to indicate if any value has been changed
    private isChanged: bool = false;

    /**
     * @constructor
     * @param {u16} pointer - The primary pointer identifier.
     * @param {Uint8Array} subPointer - The sub-pointer for memory slot addressing.
     */
    constructor(
        public pointer: u16,
        public subPointer: Uint8Array,
    ) {
        this.bufferPointer = encodePointer(pointer, subPointer, true, 'StoredU64');
    }

    /**
     * @method get
     * @description Retrieves the u64 value at the specified offset.
     * @param {u8} index - The index (0 to 3) of the u64 value to retrieve.
     * @returns {u64} - The u64 value at the specified index.
     */
    @inline
    public get(index: u8): u64 {
        assert(index < 4, 'Index out of bounds for StoredU64 (0-3)');
        this.ensureValues();
        return this._values[index];
    }

    /**
     * @method set
     * @description Sets the u64 value at the specified offset.
     * @param {u8} index - The index (0 to 3) of the u64 value to set.
     * @param {u64} value - The u64 value to assign.
     */
    @inline
    public set(index: u8, value: u64): void {
        assert(index < 4, 'Index out of bounds for StoredU64 (0-3)');
        this.ensureValues();
        if (this._values[index] != value) {
            this._values[index] = value;
            this.isChanged = true;
        }
    }

    /**
     * @method save
     * @description Persists the cached u64 values to storage if any have been modified.
     */
    public save(): void {
        if (this.isChanged) {
            const packed = this.packValues();
            Blockchain.setStorageAt(this.bufferPointer, packed);
            this.isChanged = false;
        }
    }

    /**
     * @method setMultiple
     * @description Sets multiple u64 values at once.
     * @param {[u64, u64, u64, u64]} values - An array of four u64 values to set.
     */
    @inline
    public setMultiple(values: u64[]): void {
        this.ensureValues();
        let changed = false;
        for (let i: u8 = 0; i < 4; i++) {
            if (this._values[i] != values[i]) {
                this._values[i] = values[i];
                changed = true;
            }
        }
        if (changed) {
            this.isChanged = true;
        }
    }

    /**
     * @method getAll
     * @description Retrieves all four u64 values as a tuple.
     * @returns {[u64, u64, u64, u64]} - A tuple containing all four u64 values.
     */
    @inline
    public getAll(): u64[] {
        this.ensureValues();
        return this._values;
    }

    /**
     * @method toString
     * @description Returns a string representation of all four u64 values.
     * @returns {string} - A string in the format "[value0, value1, value2, value3]".
     */
    @inline
    public toString(): string {
        this.ensureValues();
        return `[${this._values[0].toString()}, ${this._values[1].toString()}, ${this._values[2].toString()}, ${this._values[3].toString()}]`;
    }

    /**
     * @method reset
     * @description Resets the cached values to default and marks as changed.
     */
    @inline
    public reset(): void {
        this._values = [0, 0, 0, 0];
        this.isChanged = true;
    }

    /**
     * @private
     * @method ensureValues
     * @description Loads and unpacks the u256 value from storage into four u64 cache variables.
     */
    private ensureValues(): void {
        if (!this.isLoaded) {
            const storedU256: Uint8Array = Blockchain.getStorageAt(this.bufferPointer);

            const reader = new BytesReader(storedU256);

            this._values[0] = reader.readU64();
            this._values[1] = reader.readU64();
            this._values[2] = reader.readU64();
            this._values[3] = reader.readU64();

            this.isLoaded = true;
        }
    }

    /**
     * @private
     * @method packValues
     * @description Packs the four cached u64 values into a single u256 for storage.
     * @returns {u256} - The packed u256 value.
     */
    private packValues(): Uint8Array {
        const writer = new BytesWriter(32);

        writer.writeU64(this._values[0]);
        writer.writeU64(this._values[1]);
        writer.writeU64(this._values[2]);
        writer.writeU64(this._values[3]);

        return writer.getBuffer();
    }
}

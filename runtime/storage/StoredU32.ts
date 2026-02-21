import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { BytesReader } from '../buffer/BytesReader';

/**
 * @class StoredU32
 * @description Manages up to height u32 values within a single u256 storage slot.
 */
@final
export class StoredU32 {
    private readonly bufferPointer: Uint8Array;

    // Internal cache for four u32 values
    private _values: u32[] = [0, 0, 0, 0, 0, 0, 0, 0];

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
        this.bufferPointer = encodePointer(pointer, subPointer, true, 'StoredU32');
    }

    /**
     * @method get
     * @description Retrieves the u32 value at the specified offset.
     * @param {u8} index - The index (0 to 7) of the u32 value to retrieve.
     * @returns {u32} - The u32 value at the specified index.
     */
    @inline
    public get(index: u8): u32 {
        assert(index < 8, 'Index out of bounds for StoredU32 (0-7)');
        this.ensureValues();
        return this._values[index];
    }

    /**
     * @method set
     * @description Sets the u32 value at the specified offset.
     * @param {u8} index - The index (0 to 7) of the u32 value to set.
     * @param {u32} value - The u32 value to assign.
     */
    @inline
    public set(index: u8, value: u32): void {
        assert(index < 8, 'Index out of bounds for StoredU32 (0-7)');
        this.ensureValues();
        if (this._values[index] != value) {
            this._values[index] = value;
            this.isChanged = true;
        }
    }

    /**
     * @method save
     * @description Persists the cached u32 values to storage if any have been modified.
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
     * @description Sets multiple u32 values at once.
     * @param {[u32, u32, u32, u32,u32, u32, u32, u32]} values - An array of four u32 values to set.
     */
    @inline
    public setMultiple(values: u32[]): void {
        this.ensureValues();
        let changed = false;
        for (let i: u8 = 0; i < 8; i++) {
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
     * @description Retrieves all height u32 values as a tuple.
     * @returns {[u32, u32, u32, u32,u32, u32, u32, u32]} - A tuple containing all four u32 values.
     */
    @inline
    public getAll(): u32[] {
        this.ensureValues();
        return this._values;
    }

    /**
     * @method toString
     * @description Returns a string representation of all height u32 values.
     * @returns {string} - A string in the format "[value0, value1, value2, value3, value4, value5, value6, value7]".
     */
    @inline
    public toString(): string {
        this.ensureValues();
        return `[${this._values[0].toString()}, ${this._values[1].toString()}, ${this._values[2].toString()}, ${this._values[3].toString()}, ${this._values[4].toString()}, ${this._values[5].toString()}, ${this._values[6].toString()}, ${this._values[7].toString()}]`;
    }

    /**
     * @method reset
     * @description Resets the cached values to default and marks as changed.
     */
    @inline
    public reset(): void {
        this._values = [0, 0, 0, 0, 0, 0, 0, 0];
        this.isChanged = true;
    }

    /**
     * @private
     * @method ensureValues
     * @description Loads and unpacks the u256 value from storage into height u32 cache variables.
     */
    private ensureValues(): void {
        if (!this.isLoaded) {
            const storedU256: Uint8Array = Blockchain.getStorageAt(this.bufferPointer);

            const reader = new BytesReader(storedU256);

            this._values[0] = reader.readU32();
            this._values[1] = reader.readU32();
            this._values[2] = reader.readU32();
            this._values[3] = reader.readU32();
            this._values[4] = reader.readU32();
            this._values[5] = reader.readU32();
            this._values[6] = reader.readU32();
            this._values[7] = reader.readU32();

            this.isLoaded = true;
        }
    }

    /**
     * @private
     * @method packValues
     * @description Packs the height cached u32 values into a single u256 for storage.
     * @returns {u256} - The packed u256 value.
     */
    private packValues(): Uint8Array {
        const writer = new BytesWriter(32);

        writer.writeU32(this._values[0]);
        writer.writeU32(this._values[1]);
        writer.writeU32(this._values[2]);
        writer.writeU32(this._values[3]);
        writer.writeU32(this._values[4]);
        writer.writeU32(this._values[5]);
        writer.writeU32(this._values[6]);
        writer.writeU32(this._values[7]);

        return writer.getBuffer();
    }
}

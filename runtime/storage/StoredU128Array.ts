import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { BytesWriter } from '../buffer/BytesWriter';
import { u128, u256 } from 'as-bignum/assembly';
import { SafeMath } from '../types/SafeMath';

/**
 * @class StoredU128Array
 * @description Manages an array of u128 values across multiple u256 storage slots. Each u256 slot holds two u128 values.
 */
@final
export class StoredU128Array {
    private readonly baseU256Pointer: u256;

    // Internal cache for multiple storage slots, each holding two u128 values
    private _values: Array<u128[]> = []; // Each element is an array of two u128s
    private _isLoaded: Array<bool> = []; // Indicates if the corresponding slot is loaded
    private _isChanged: Array<bool> = []; // Indicates if the corresponding slot has been modified

    /**
     * @constructor
     * @param {u16} pointer - The primary pointer identifier.
     * @param {MemorySlotPointer} subPointer - The sub-pointer for memory slot addressing.
     * @param {u256} defaultValue - The default u256 value if storage is uninitialized.
     */
    constructor(
        public pointer: u16,
        public subPointer: MemorySlotPointer,
        private defaultValue: u256,
    ) {
        // Initialize the base u256 pointer using the primary pointer and subPointer
        const writer = new BytesWriter(32);
        writer.writeU256(subPointer);
        this.baseU256Pointer = encodePointer(pointer, writer.getBuffer());
    }

    /**
     * @method get
     * @description Retrieves the u128 value at the specified global index.
     * @param {u32} index - The global index (0 to ∞) of the u128 value to retrieve.
     * @returns {u128} - The u128 value at the specified index.
     */
    @inline
    public get(index: u32): u128 {
        const slotIndex: u32 = index / 2; // Each slot holds two u128s
        const subIndex: u8 = <u8>(index % 2); // 0 or 1
        this.ensureValues(slotIndex);
        return this._values[slotIndex][subIndex];
    }

    /**
     * @method set
     * @description Sets the u128 value at the specified global index.
     * @param {u32} index - The global index (0 to ∞) of the u128 value to set.
     * @param {u128} value - The u128 value to assign.
     */
    @inline
    public set(index: u32, value: u128): void {
        const slotIndex: u32 = index / 2;
        const subIndex: u8 = <u8>(index % 2);
        this.ensureValues(slotIndex);

        if (!u128.eq(this._values[slotIndex][subIndex], value)) {
            this._values[slotIndex][subIndex] = value;
            this._isChanged[slotIndex] = true;
        }
    }

    /**
     * @method save
     * @description Persists all cached u128 values to their respective storage slots if any have been modified.
     */
    public save(): void {
        const max: u32 = this._values.length;

        for (let slotIndex: u32 = 0; slotIndex < max; slotIndex++) {
            if (this._isChanged[slotIndex]) {
                const packed = this.packValues(slotIndex);
                const storagePointer = this.calculateStoragePointer(slotIndex);
                Blockchain.setStorageAt(storagePointer, packed);
                this._isChanged[slotIndex] = false;
            }
        }
    }

    /**
     * @method delete
     * @description Deletes all storage slots by setting them to zero.
     */
    public delete(): void {
        const max: u32 = this._values.length;
        for (let slotIndex: u32 = 0; slotIndex < max; slotIndex++) {
            const storagePointer = this.calculateStoragePointer(slotIndex);
            Blockchain.setStorageAt(storagePointer, u256.Zero);
        }
        // Clear internal caches
        this._values = [];
        this._isLoaded = [];
        this._isChanged = [];
    }

    /**
     * @method setMultiple
     * @description Sets multiple u128 values starting from a specific global index.
     * @param {u32} startIndex - The starting global index.
     * @param {u128[]} values - An array of u128 values to set.
     */
    @inline
    public setMultiple(startIndex: u32, values: u128[]): void {
        for (let i: u32 = 0; i < values.length; i++) {
            this.set(startIndex + i, values[i]);
        }
    }

    /**
     * @method getAll
     * @description Retrieves a range of u128 values starting from a specific global index.
     * @param {u32} startIndex - The starting global index.
     * @param {u32} count - The number of u128 values to retrieve.
     * @returns {u128[]} - An array containing the retrieved u128 values.
     */
    @inline
    public getAll(startIndex: u32, count: u32): u128[] {
        const result: u128[] = new Array<u128>(count);
        for (let i: u32 = 0; i < count; i++) {
            result[i] = this.get(startIndex + i);
        }
        return result;
    }

    /**
     * @method toString
     * @description Returns a string representation of all cached u128 values.
     * @returns {string} - A string in the format "[value0, value1, ..., valueN]".
     */
    @inline
    public toString(): string {
        let str = '[';
        for (let slotIndex: u32 = 0; slotIndex < this._values.length; slotIndex++) {
            for (let subIndex: u8 = 0; subIndex < 2; subIndex++) {
                const value = this._values[slotIndex][subIndex];
                str += value.toString();
                if (!(slotIndex === this._values.length - 1 && subIndex === 1)) {
                    str += ', ';
                }
            }
        }
        str += ']';
        return str;
    }

    /**
     * @method toBytes
     * @description Returns the packed u256 values as a byte array.
     * @returns {u8[]} - The packed u256 values in byte form.
     */
    @inline
    public toBytes(): u8[] {
        const bytes: u8[] = new Array<u8>();
        for (let slotIndex: u32 = 0; slotIndex < this._values.length; slotIndex++) {
            const packed = this.packValues(slotIndex);
            const slotBytes = packed.toBytes();
            for (let i: u32 = 0; i < slotBytes.length; i++) {
                bytes.push(slotBytes[i]);
            }
        }
        return bytes;
    }

    /**
     * @method reset
     * @description Resets all cached u128 values to zero and marks them as changed.
     */
    @inline
    public reset(): void {
        for (let slotIndex: u32 = 0; slotIndex < this._values.length; slotIndex++) {
            for (let subIndex: u8 = 0; subIndex < 2; subIndex++) {
                this._values[slotIndex][subIndex] = u128.Zero;
            }
            this._isChanged[slotIndex] = true;
        }
    }

    /**
     * @private
     * @method ensureValues
     * @description Loads and unpacks the u256 value from the specified storage slot into two u128 cache variables.
     * @param {u32} slotIndex - The index of the storage slot.
     */
    private ensureValues(slotIndex: u32): void {
        // Initialize arrays if necessary
        while (slotIndex >= <u32>this._isLoaded.length) {
            this._isLoaded.push(false);
            this._isChanged.push(false);
            const newSlotValues: u128[] = new Array<u128>(2);
            newSlotValues[0] = u128.Zero;
            newSlotValues[1] = u128.Zero;
            this._values.push(newSlotValues);
        }

        if (!this._isLoaded[slotIndex]) {
            const storagePointer = this.calculateStoragePointer(slotIndex);
            const storedU256: u256 = Blockchain.getStorageAt(storagePointer, this.defaultValue);
            this._values[slotIndex] = this.unpackU256(storedU256);
            this._isLoaded[slotIndex] = true;
        }
    }

    /**
     * @private
     * @method packValues
     * @description Packs the two cached u128 values into a single u256 for storage.
     * @param {u32} slotIndex - The index of the storage slot.
     * @returns {u256} - The packed u256 value.
     */
    private packValues(slotIndex: u32): u256 {
        const values = this._values[slotIndex];
        const packed = new u256();

        // Each u256 has lo1, lo2, hi1, hi2 as u64s
        // Each u128 consists of two u64s
        // Assign values accordingly:
        // values[0] -> lo1 (first u64), lo2 (second u64)
        // values[1] -> hi1 (third u64), hi2 (fourth u64)

        // Assign first u128
        packed.lo1 = values[0].lo;
        packed.lo2 = values[0].hi;

        // Assign second u128
        packed.hi1 = values[1].lo;
        packed.hi2 = values[1].hi;

        return packed;
    }

    /**
     * @private
     * @method unpackU256
     * @description Unpacks a u256 value into an array of two u128s.
     * @param {u256} storedU256 - The u256 value to unpack.
     * @returns {u128[]} - An array of two u128 values.
     */
    private unpackU256(storedU256: u256): u128[] {
        const values: u128[] = new Array<u128>(2);

        // Unpack first u128 from lo1 and lo2
        values[0] = new u128(storedU256.lo1, storedU256.lo2);

        // Unpack second u128 from hi1 and hi2
        values[1] = new u128(storedU256.hi1, storedU256.hi2);

        return values;
    }

    /**
     * @private
     * @method calculateStoragePointer
     * @description Calculates the storage pointer for a given slot index by incrementing the subpointer.
     * @param {u32} slotIndex - The index of the storage slot.
     * @returns {u256} - The calculated storage pointer.
     */
    private calculateStoragePointer(slotIndex: u32): u256 {
        // Clone the base subpointer and increment it by slotIndex
        const modifiedSubPointer = this.baseU256Pointer.clone();
        SafeMath.add(modifiedSubPointer, u256.fromU32(slotIndex));

        return modifiedSubPointer;
    }
}

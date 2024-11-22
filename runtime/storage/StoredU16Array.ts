import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { BytesWriter } from '../buffer/BytesWriter';
import { u256 } from 'as-bignum/assembly';
import { SafeMath } from '../types/SafeMath';

/**
 * @class StoredU16Array
 * @description Manages up to sixteen u16 values within a single u256 storage slot. Automatically handles multiple storage slots by incrementing the subpointer when indices exceed the current slot's capacity.
 */
@final
export class StoredU16Array {
    private readonly baseU256Pointer: u256;

    // Internal cache for multiple storage slots, each holding sixteen u16 values
    private _values: Array<u16[]> = []; // Each element is an array of sixteen u16s
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
     * @description Retrieves the u16 value at the specified global index.
     * @param {u32} index - The global index (0 to ∞) of the u16 value to retrieve.
     * @returns {u16} - The u16 value at the specified index.
     */
    @inline
    public get(index: u32): u16 {
        const slotIndex: u32 = index / 16;
        const subIndex: u8 = <u8>(index % 16);
        this.ensureValues(slotIndex);
        return this._values[slotIndex][subIndex];
    }

    /**
     * @method set
     * @description Sets the u16 value at the specified global index.
     * @param {u32} index - The global index (0 to ∞) of the u16 value to set.
     * @param {u16} value - The u16 value to assign.
     */
    @inline
    public set(index: u32, value: u16): void {
        const slotIndex: u32 = index / 16;
        const subIndex: u8 = <u8>(index % 16);
        this.ensureValues(slotIndex);

        if (this._values[slotIndex][subIndex] != value) {
            this._values[slotIndex][subIndex] = value;

            this._isChanged[slotIndex] = true;
        }
    }

    /**
     * @method save
     * @description Persists all cached u16 values to their respective storage slots if any have been modified.
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
     * @description Delete the pointer
     */
    public delete(): void {
        Blockchain.setStorageAt(this.baseU256Pointer, u256.Zero);
    }

    /**
     * @method setMultiple
     * @description Sets multiple u16 values starting from a specific global index.
     * @param {u32} startIndex - The starting global index.
     * @param {u16[]} values - An array of u16 values to set.
     */
    @inline
    public setMultiple(startIndex: u32, values: u16[]): void {
        for (let i: u32 = 0; i < values.length; i++) {
            this.set(startIndex + i, values[i]);
        }
    }

    /**
     * @method getAll
     * @description Retrieves a range of u16 values starting from a specific global index.
     * @param {u32} startIndex - The starting global index.
     * @param {u32} count - The number of u16 values to retrieve.
     * @returns {u16[]} - An array containing the retrieved u16 values.
     */
    @inline
    public getAll(startIndex: u32, count: u32): u16[] {
        const result: u16[] = new Array<u16>(count);
        for (let i: u32 = 0; i < count; i++) {
            result[i] = this.get(startIndex + i);
        }
        return result;
    }

    /**
     * @method toString
     * @description Returns a string representation of all cached u16 values.
     * @returns {string} - A string in the format "[value0, value1, ..., valueN]".
     */
    @inline
    public toString(): string {
        let str = '[';
        for (let slotIndex: u32 = 0; slotIndex < this._values.length; slotIndex++) {
            for (let subIndex: u8 = 0; subIndex < 16; subIndex++) {
                const value = this._values[slotIndex][subIndex];
                str += value.toString();
                if (!(slotIndex === this._values.length - 1 && subIndex === 15)) {
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
     * @description Resets all cached u16 values to zero and marks them as changed.
     */
    @inline
    public reset(): void {
        for (let slotIndex: u32 = 0; slotIndex < this._values.length; slotIndex++) {
            for (let subIndex: u8 = 0; subIndex < 16; subIndex++) {
                this._values[slotIndex][subIndex] = 0;
            }
            this._isChanged[slotIndex] = true;
        }
    }

    /**
     * @private
     * @method ensureValues
     * @description Loads and unpacks the u256 value from the specified storage slot into a sixteen u16 cache.
     * @param {u32} slotIndex - The index of the storage slot.
     */
    private ensureValues(slotIndex: u32): void {
        // Initialize arrays if necessary
        while (slotIndex >= <u32>this._isLoaded.length) {
            this._isLoaded.push(false);
            this._isChanged.push(false);
            const newSlotValues: u16[] = new Array<u16>(16);
            //for (let i: u8 = 0; i < 16; i++) {
            //    newSlotValues[i] = 0;
            //}
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
     * @description Packs the sixteen cached u16 values into a single u256 for storage.
     * @param {u32} slotIndex - The index of the storage slot.
     * @returns {u256} - The packed u256 value.
     */
    private packValues(slotIndex: u32): u256 {
        const values = this._values[slotIndex];
        const packed = new u256();

        // Each u256 has lo1, lo2, hi1, hi2 as u64s
        // Each u64 can hold four u16s
        // Assign values accordingly
        for (let i: u8 = 0; i < 16; i++) {
            const value = <u64>values[i];
            const shift = 16 * (i % 4);

            if (i < 4) {
                packed.lo1 = packed.lo1 | (value << shift);
            } else if (i < 8) {
                packed.lo2 = packed.lo2 | (value << shift);
            } else if (i < 12) {
                packed.hi1 = packed.hi1 | (value << shift);
            } else {
                packed.hi2 = packed.hi2 | (value << shift);
            }
        }

        return packed;
    }

    /**
     * @private
     * @method unpackU256
     * @description Unpacks a u256 value into an array of sixteen u16s.
     * @param {u256} storedU256 - The u256 value to unpack.
     * @returns {u16[]} - An array of sixteen u16 values.
     */
    private unpackU256(storedU256: u256): u16[] {
        const values: u16[] = new Array<u16>(16);

        // Unpack lo1 (first four u16s)
        for (let i: u8 = 0; i < 4; i++) {
            values[i] = <u16>((storedU256.lo1 >> (16 * i)) & 0xffff);
        }

        // Unpack lo2 (next four u16s)
        for (let i: u8 = 0; i < 4; i++) {
            values[4 + i] = <u16>((storedU256.lo2 >> (16 * i)) & 0xffff);
        }

        // Unpack hi1 (next four u16s)
        for (let i: u8 = 0; i < 4; i++) {
            values[8 + i] = <u16>((storedU256.hi1 >> (16 * i)) & 0xffff);
        }

        // Unpack hi2 (last four u16s)
        for (let i: u8 = 0; i < 4; i++) {
            values[12 + i] = <u16>((storedU256.hi2 >> (16 * i)) & 0xffff);
        }

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
        const modifiedSubPointer = this.baseU256Pointer.clone();

        return SafeMath.add(modifiedSubPointer, u256.fromU32(slotIndex));
    }
}

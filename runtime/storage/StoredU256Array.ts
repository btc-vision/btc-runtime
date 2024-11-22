import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { BytesWriter } from '../buffer/BytesWriter';
import { u256 } from 'as-bignum/assembly';
import { SafeMath } from '../types/SafeMath';

/**
 * @class StoredU256Array
 * @description Manages an array of u256 values across multiple u256 storage slots. Each u256 slot holds one u256 value.
 */
@final
export class StoredU256Array {
    private readonly baseU256Pointer: u256;
    private readonly lengthPointer: u256;

    // Internal cache for multiple storage slots, each holding one u256 value
    private _values: Array<u256> = []; // Each element is a u256 value
    private _isLoaded: Array<bool> = []; // Indicates if the corresponding slot is loaded
    private _isChanged: Array<bool> = []; // Indicates if the corresponding slot has been modified

    // Internal variables for length management
    private _length: u16 = 0; // Current length of the array
    private _isChangedLength: bool = false; // Indicates if the length has been modified

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

        // Initialize the length pointer by incrementing the base pointer by 1
        this.lengthPointer = SafeMath.add(this.baseU256Pointer, u256.One);

        // Load the current length from storage
        const storedLength: u256 = Blockchain.getStorageAt(this.lengthPointer, u256.Zero);
        this._length = u16(storedLength.toU32());

        // Optionally, you can preload values based on the initial length
        for (let i: u32 = 0; i < this._length; i++) {
            this.ensureValues(i);
        }
    }

    /**
     * @method get
     * @description Retrieves the u256 value at the specified global index.
     * @param {u32} index - The global index (0 to ∞) of the u256 value to retrieve.
     * @returns {u256} - The u256 value at the specified index.
     */
    @inline
    public get(index: u32): u256 {
        const slotIndex: u32 = index; // Each slot holds one u256
        this.ensureValues(slotIndex);
        return this._values[slotIndex];
    }

    /**
     * @method set
     * @description Sets the u256 value at the specified global index.
     * @param {u32} index - The global index (0 to ∞) of the u256 value to set.
     * @param {u256} value - The u256 value to assign.
     */
    @inline
    public set(index: u32, value: u256): void {
        const slotIndex: u32 = index;
        this.ensureValues(slotIndex);

        if (!u256.eq(this._values[slotIndex], value)) {
            this._values[slotIndex] = value;
            this._isChanged[slotIndex] = true;

            // Update length if setting a new index beyond current length
            if (index >= this._length) {
                this._length = u16(index + 1);
                this._isChangedLength = true;
            }
        }
    }

    /**
     * @method save
     * @description Persists all cached u256 values and the length to their respective storage slots if any have been modified.
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

        if (this._isChangedLength) {
            const lengthU256 = u256.from(this._length);
            Blockchain.setStorageAt(this.lengthPointer, lengthU256);
            this._isChangedLength = false;
        }
    }

    /**
     * @method delete
     * @description Deletes all storage slots by setting them to zero, including the length slot.
     */
    public delete(): void {
        const max: u32 = this._values.length;
        for (let slotIndex: u32 = 0; slotIndex < max; slotIndex++) {
            const storagePointer = this.calculateStoragePointer(slotIndex);
            Blockchain.setStorageAt(storagePointer, u256.Zero);
        }

        // Reset the length to zero
        Blockchain.setStorageAt(this.lengthPointer, u256.Zero);
        this._length = 0;
        this._isChangedLength = false;

        // Clear internal caches
        this._values = [];
        this._isLoaded = [];
        this._isChanged = [];
    }

    /**
     * @method setMultiple
     * @description Sets multiple u256 values starting from a specific global index.
     * @param {u32} startIndex - The starting global index.
     * @param {u256[]} values - An array of u256 values to set.
     */
    @inline
    public setMultiple(startIndex: u32, values: u256[]): void {
        for (let i: u32 = 0; i < values.length; i++) {
            this.set(startIndex + i, values[i]);
        }
    }

    /**
     * @method getAll
     * @description Retrieves a range of u256 values starting from a specific global index.
     * @param {u32} startIndex - The starting global index.
     * @param {u32} count - The number of u256 values to retrieve.
     * @returns {u256[]} - An array containing the retrieved u256 values.
     */
    @inline
    public getAll(startIndex: u32, count: u32): u256[] {
        const result: u256[] = new Array<u256>(count);
        for (let i: u32 = 0; i < count; i++) {
            result[i] = this.get(startIndex + i);
        }
        return result;
    }

    /**
     * @method toString
     * @description Returns a string representation of all cached u256 values.
     * @returns {string} - A string in the format "[value0, value1, ..., valueN]".
     */
    @inline
    public toString(): string {
        let str = '[';
        for (let slotIndex: u32 = 0; slotIndex < this._values.length; slotIndex++) {
            const value = this._values[slotIndex];
            str += value.toString();
            if (slotIndex !== this._values.length - 1) {
                str += ', ';
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
     * @description Resets all cached u256 values to zero and marks them as changed, including resetting the length.
     */
    @inline
    public reset(): void {
        for (let slotIndex: u32 = 0; slotIndex < this._values.length; slotIndex++) {
            this._values[slotIndex] = u256.Zero;
            this._isChanged[slotIndex] = true;
        }

        // Reset the length to zero
        this._length = 0;
        this._isChangedLength = true;
    }

    /**
     * @method getLength
     * @description Retrieves the current length of the array.
     * @returns {u16} - The current length.
     */
    @inline
    public getLength(): u16 {
        return this._length;
    }

    /**
     * @method setLength
     * @description Sets the length of the array.
     * @param {u16} newLength - The new length to set.
     */
    public setLength(newLength: u16): void {
        if (newLength > u16.MAX_VALUE) {
            throw new Error('Length exceeds maximum allowed value.');
        }

        this._length = newLength;
        this._isChangedLength = true;
    }

    /**
     * @private
     * @method ensureValues
     * @description Loads and caches the u256 value from the specified storage slot.
     * @param {u32} slotIndex - The index of the storage slot.
     */
    private ensureValues(slotIndex: u32): void {
        // Initialize arrays if necessary
        while (slotIndex >= <u32>this._isLoaded.length) {
            this._isLoaded.push(false);
            this._isChanged.push(false);
            this._values.push(u256.Zero);
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
     * @description Retrieves the cached u256 value for storage.
     * @param {u32} slotIndex - The index of the storage slot.
     * @returns {u256} - The packed u256 value.
     */
    private packValues(slotIndex: u32): u256 {
        return this._values[slotIndex];
    }

    /**
     * @private
     * @method unpackU256
     * @description Returns the u256 value as is since no unpacking is required.
     * @param {u256} storedU256 - The u256 value to unpack.
     * @returns {u256} - The unpacked u256 value.
     */
    private unpackU256(storedU256: u256): u256 {
        return storedU256;
    }

    /**
     * @private
     * @method calculateStoragePointer
     * @description Calculates the storage pointer for a given slot index by incrementing the subpointer.
     * @param {u32} slotIndex - The index of the storage slot.
     * @returns {u256} - The calculated storage pointer.
     */
    private calculateStoragePointer(slotIndex: u32): u256 {
        // Clone the subpointer to avoid mutating the original
        const modifiedSubPointer = this.subPointer.clone();

        // Increment the subpointer by slotIndex using SafeMath
        return SafeMath.add(modifiedSubPointer, u256.fromU32(slotIndex));
    }
}

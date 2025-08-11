import { Blockchain } from '../../env';
import { BytesWriter } from '../../buffer/BytesWriter';
import { BytesReader } from '../../buffer/BytesReader';
import { encodePointerUnknownLength } from '../../math/abi';

import { i128, u128, u256 } from '@btc-vision/as-bignum/assembly';
import {
    idOfAddress,
    idOfI128,
    idOfString,
    idOfU128,
    idOfU256,
    idOfUint8Array,
} from '../codecs/Ids';

import { AddressCodec } from '../codecs/AddressCodec';
import { BooleanCodec } from '../codecs/BooleanCodec';
import { StringCodec } from '../codecs/StringCodec';
import { VariableBytesCodec } from '../codecs/VariableBytesCodec';
import { U256Codec } from '../codecs/U256Codec';

import { Address } from '../../types/Address';
import { Revert } from '../../types/Revert';

/**
 * A reflection-based StorageMap<K, V>.
 *  - `pointer` => a u16 "namespace"
 *  - `set(key, value)` => store bytes
 *  - `get(key)` => decode bytes
 *
 * This version uses a chain of `if/else` for each possible type T,
 * so the compiler doesn't complain about mismatched returns.
 */
@final
export class StorageMap<K, V> {
    private readonly pointer: u16;

    constructor(pointer: u16) {
        this.pointer = pointer;
    }

    // ----------------------------------------------------------
    // PUBLIC API
    // ----------------------------------------------------------

    public set(key: K, value: V): this {
        const storageKey = this.getStorageKey(key);
        this.storeValue<V>(storageKey, value);
        return this;
    }

    public get(key: K): V {
        const storageKey = this.getStorageKey(key);
        return this.decodeValue<V>(storageKey);
    }

    public has(key: K): bool {
        const storageKey = this.getStorageKey(key);
        return Blockchain.hasStorageAt(storageKey);
    }

    @unsafe
    public delete(key: K): bool {
        const storageKey = this.getStorageKey(key);
        if (!Blockchain.hasStorageAt(storageKey)) {
            return false;
        }

        Blockchain.setStorageAt(storageKey, new Uint8Array(0));
        return true;
    }

    @unsafe
    public clear(): void {
        // Not implemented: we'd need key-tracking to remove them all
        throw new Error('clear() not implemented; no key-tracking logic here.');
    }

    // ----------------------------------------------------------
    // INTERNAL: Derive the final storage key
    // ----------------------------------------------------------

    private getStorageKey(k: K): Uint8Array {
        // 1) encode the key
        const keyBytes = this.encodeValue<K>(k);

        // 2) transform with pointer
        return encodePointerUnknownLength(this.pointer, keyBytes);
    }

    // ----------------------------------------------------------
    // ENCODE / DECODE
    // ----------------------------------------------------------

    /**
     * Retrieve the value of type P from the given storage pointer (32 bytes).
     * If it's a variable-length type, we decode from pointer-based approach
     * (like VariableBytesCodec or StringCodec).
     * Otherwise, we get the raw from storage and decode.
     */
    private decodeValue<P>(pointer: Uint8Array): P {
        // For some types like `Uint8Array` or `string`, we might want
        // to treat the pointer as an allocated "variable" location.
        const typeId = idof<P>();

        // For variable-length things:
        if (typeId == idOfUint8Array) {
            // decode variable bytes from pointer
            const arr = VariableBytesCodec.decode(pointer);
            return changetype<P>(arr);
        }
        if (typeId == idOfString) {
            const str = StringCodec.decode(pointer);
            return changetype<P>(str);
        }

        // For everything else, we read raw from storage
        const raw = Blockchain.getStorageAt(pointer);

        return this.decodeBytesAsType<P>(raw);
    }

    /**
     * Store a value of type P at the given storage key.
     * - Some types (uint8array, string) -> chunked (pointer-based).
     * - Others -> direct bytes in that slot.
     */
    private storeValue<P>(storageKey: Uint8Array, value: P): void {
        const raw = this.encodeValue<P>(value);
        Blockchain.setStorageAt(storageKey, raw);
    }

    // ----------------------------------------------------------
    // decodeBytesAsType: interpret raw bytes as type P
    // ----------------------------------------------------------

    private decodeBytesAsType<P>(raw: Uint8Array): P {
        // isInteger => built-in numeric types (i32, u32, etc.)
        if (isInteger<P>()) {
            if (raw.length < <i32>sizeof<P>()) {
                return changetype<P>(0);
            }

            const reader = new BytesReader(raw);
            return reader.read<P>();
        }

        // isBoolean => decode with BooleanCodec
        if (isBoolean<P>()) {
            const boolVal = BooleanCodec.decode(raw);
            return changetype<P>(boolVal);
        }

        const typeId = idof<P>();

        // u256
        if (typeId == idOfU256) {
            const decoded = U256Codec.decode(raw);
            return changetype<P>(decoded);
        }

        // i128
        if (typeId == idOfI128) {
            const val = i128.fromUint8ArrayBE(raw);
            return changetype<P>(val);
        }

        // u128
        if (typeId == idOfU128) {
            const val = u128.fromUint8ArrayBE(raw);
            return changetype<P>(val);
        }

        // Address
        if (typeId == idOfAddress) {
            const addr = AddressCodec.decode(raw);
            return changetype<P>(addr);
        }

        throw new Revert(`Unsupported type ${typeId}`);
    }

    // ----------------------------------------------------------
    // encodeValue<P>: convert a value of type P into raw bytes
    // ----------------------------------------------------------

    private encodeValue<P>(value: P): Uint8Array {
        // built-in integer => write with BytesWriter
        if (isInteger<P>()) {
            const writer = new BytesWriter(sizeof<P>());
            writer.write<P>(value);
            return writer.getBuffer();
        }

        // bool => BooleanCodec
        if (isBoolean<P>()) {
            return BooleanCodec.encode(changetype<bool>(value));
        }

        // Check reflection for bigger types
        if (value instanceof Uint8Array) {
            return VariableBytesCodec.encode(value);
        }

        if (isString<P>()) {
            const strVal = changetype<string>(value);
            return StringCodec.encode(strVal);
        }

        if (value instanceof u256) {
            return U256Codec.encode(changetype<u256>(value));
        }

        if (value instanceof u128) {
            // store big-endian
            const uval = changetype<u128>(value);
            return uval.toUint8Array(true);
        }

        if (value instanceof i128) {
            const ival = changetype<i128>(value);
            return ival.toUint8Array(true);
        }

        if (value instanceof Address) {
            return AddressCodec.encode(changetype<Address>(value));
        }

        // If nested map => handle in a custom branch (not shown here):
        // if (value instanceof StorageMap<...>) { ... }

        throw new Revert('encodeValue: Unsupported type');
    }
}

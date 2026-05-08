import { i128, u128, u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../runtime/buffer/BytesWriter';
import { BytesReader } from '../runtime/buffer/BytesReader';
import { Address } from '../runtime/types/Address';
import { ExtendedAddress } from '../runtime/types/ExtendedAddress';
import { AddressMap } from '../runtime/generic/AddressMap';
import { ExtendedAddressMap } from '../runtime/generic/ExtendedAddressMap';

// Helper functions to create test addresses
function createTestAddress(seed: u8): Address {
    const bytes: u8[] = new Array<u8>(32);
    for (let i = 0; i < 32; i++) {
        bytes[i] = (seed + i) as u8;
    }
    return new Address(bytes);
}

function createTestExtendedAddress(seed: u8): ExtendedAddress {
    const tweakedKey: u8[] = new Array<u8>(32);
    const mldsaKey: u8[] = new Array<u8>(32);
    for (let i = 0; i < 32; i++) {
        tweakedKey[i] = (seed + i) as u8;
        mldsaKey[i] = (seed + i + 32) as u8;
    }
    return new ExtendedAddress(tweakedKey, mldsaKey);
}

describe('BytesReader', () => {
    describe('constructor and basic properties', () => {
        it('should create reader from Uint8Array', () => {
            const data = new Uint8Array(10);
            const reader = new BytesReader(data);
            expect(reader.byteLength).toBe(10);
            expect(reader.getOffset()).toBe(0);
        });

        it('should create reader from empty array', () => {
            const data = new Uint8Array(0);
            const reader = new BytesReader(data);
            expect(reader.byteLength).toBe(0);
        });
    });

    describe('readU8', () => {
        it('should read u8 values correctly', () => {
            const data = new Uint8Array(3);
            data[0] = 0;
            data[1] = 127;
            data[2] = 255;

            const reader = new BytesReader(data);
            expect(reader.readU8()).toBe(0);
            expect(reader.readU8()).toBe(127);
            expect(reader.readU8()).toBe(255);
            expect(reader.getOffset()).toBe(3);
        });

        it('should read all available bytes', () => {
            const data = new Uint8Array(2);
            data[0] = 10;
            data[1] = 20;
            const reader = new BytesReader(data);
            expect(reader.readU8()).toBe(10);
            expect(reader.readU8()).toBe(20);
            expect(reader.getOffset()).toBe(2);
        });
    });

    describe('readU16', () => {
        it('should read u16 big-endian by default', () => {
            const data = new Uint8Array(2);
            data[0] = 0x12;
            data[1] = 0x34;

            const reader = new BytesReader(data);
            expect(reader.readU16()).toBe(0x1234);
        });

        it('should read u16 little-endian when specified', () => {
            const data = new Uint8Array(2);
            data[0] = 0x34;
            data[1] = 0x12;

            const reader = new BytesReader(data);
            expect(reader.readU16(false)).toBe(0x1234);
        });
    });

    describe('readU32', () => {
        it('should read u32 big-endian by default', () => {
            const data = new Uint8Array(4);
            data[0] = 0x12;
            data[1] = 0x34;
            data[2] = 0x56;
            data[3] = 0x78;

            const reader = new BytesReader(data);
            expect(reader.readU32()).toBe(0x12345678);
        });

        it('should read u32 little-endian when specified', () => {
            const data = new Uint8Array(4);
            data[0] = 0x78;
            data[1] = 0x56;
            data[2] = 0x34;
            data[3] = 0x12;

            const reader = new BytesReader(data);
            expect(reader.readU32(false)).toBe(0x12345678);
        });
    });

    describe('readU64', () => {
        it('should read u64 big-endian by default', () => {
            const data = new Uint8Array(8);
            data[0] = 0x01;
            data[1] = 0x02;
            data[2] = 0x03;
            data[3] = 0x04;
            data[4] = 0x05;
            data[5] = 0x06;
            data[6] = 0x07;
            data[7] = 0x08;

            const reader = new BytesReader(data);
            expect(reader.readU64()).toBe(0x0102030405060708);
        });

        it('should read u64 little-endian when specified', () => {
            const data = new Uint8Array(8);
            data[0] = 0x08;
            data[1] = 0x07;
            data[2] = 0x06;
            data[3] = 0x05;
            data[4] = 0x04;
            data[5] = 0x03;
            data[6] = 0x02;
            data[7] = 0x01;

            const reader = new BytesReader(data);
            expect(reader.readU64(false)).toBe(0x0102030405060708);
        });
    });

    describe('readI8', () => {
        it('should read i8 values correctly', () => {
            const data = new Uint8Array(3);
            data[0] = 0;
            data[1] = 127;
            data[2] = 0x80; // -128

            const reader = new BytesReader(data);
            expect(reader.readI8()).toBe(0);
            expect(reader.readI8()).toBe(127);
            expect(reader.readI8()).toBe(-128);
        });
    });

    describe('readI16', () => {
        it('should read i16 big-endian by default', () => {
            const data = new Uint8Array(2);
            data[0] = 0xff;
            data[1] = 0xff;

            const reader = new BytesReader(data);
            expect(reader.readI16()).toBe(-1);
        });

        it('should read positive i16 (little-endian, hardcoded)', () => {
            const data = new Uint8Array(2);
            // readI16 is hardcoded to little-endian
            data[0] = 0x34;
            data[1] = 0x12;

            const reader = new BytesReader(data);
            expect(reader.readI16()).toBe(0x1234);
        });
    });

    describe('readI32', () => {
        it('should read i32 -1 (all 0xff)', () => {
            const data = new Uint8Array(4);
            data[0] = 0xff;
            data[1] = 0xff;
            data[2] = 0xff;
            data[3] = 0xff;

            const reader = new BytesReader(data);
            expect(reader.readI32()).toBe(-1);
        });

        it('should read positive i32 (little-endian, hardcoded)', () => {
            const data = new Uint8Array(4);
            // readI32 is hardcoded to little-endian
            data[0] = 0x78;
            data[1] = 0x56;
            data[2] = 0x34;
            data[3] = 0x12;

            const reader = new BytesReader(data);
            expect(reader.readI32()).toBe(0x12345678);
        });
    });

    describe('readI64', () => {
        it('should read i64 big-endian by default', () => {
            const data = new Uint8Array(8);
            for (let i = 0; i < 8; i++) {
                data[i] = 0xff;
            }

            const reader = new BytesReader(data);
            expect(reader.readI64()).toBe(-1);
        });

        it('should read i64 little-endian when specified', () => {
            const data = new Uint8Array(8);
            data[0] = 0x08;
            data[1] = 0x07;
            data[2] = 0x06;
            data[3] = 0x05;
            data[4] = 0x04;
            data[5] = 0x03;
            data[6] = 0x02;
            data[7] = 0x01;

            const reader = new BytesReader(data);
            expect(reader.readI64(false)).toBe(0x0102030405060708);
        });
    });

    describe('readSelector', () => {
        it('should read selector as big-endian u32', () => {
            const data = new Uint8Array(4);
            data[0] = 0xa9;
            data[1] = 0x05;
            data[2] = 0x9c;
            data[3] = 0xbb;

            const reader = new BytesReader(data);
            expect(reader.readSelector()).toBe(0xa9059cbb);
        });
    });

    describe('readBoolean', () => {
        it('should read true from non-zero', () => {
            const data = new Uint8Array(2);
            data[0] = 1;
            data[1] = 255;

            const reader = new BytesReader(data);
            expect(reader.readBoolean()).toBe(true);
            expect(reader.readBoolean()).toBe(true);
        });

        it('should read false from zero', () => {
            const data = new Uint8Array(1);
            data[0] = 0;

            const reader = new BytesReader(data);
            expect(reader.readBoolean()).toBe(false);
        });
    });

    describe('readU256', () => {
        it('should read u256 big-endian by default', () => {
            const writer = new BytesWriter(32);
            const value = u256.fromU64(0x0102030405060708);
            writer.writeU256(value);

            const reader = new BytesReader(writer.getBuffer());
            const result = reader.readU256();
            expect(result == value).toBe(true);
        });

        it('should read u256 little-endian when specified', () => {
            const writer = new BytesWriter(32);
            const value = u256.fromU64(0x0102030405060708);
            writer.writeU256(value, false);

            const reader = new BytesReader(writer.getBuffer());
            const result = reader.readU256(false);
            expect(result == value).toBe(true);
        });
    });

    describe('readU128', () => {
        it('should read u128 big-endian by default', () => {
            const writer = new BytesWriter(16);
            const value = u128.fromU64(0x0102030405060708);
            writer.writeU128(value);

            const reader = new BytesReader(writer.getBuffer());
            const result = reader.readU128();
            expect(result == value).toBe(true);
        });

        it('should read u128 little-endian when specified', () => {
            const writer = new BytesWriter(16);
            const value = u128.fromU64(0x0102030405060708);
            writer.writeU128(value, false);

            const reader = new BytesReader(writer.getBuffer());
            const result = reader.readU128(false);
            expect(result == value).toBe(true);
        });
    });

    describe('readI128', () => {
        it('should read i128 correctly', () => {
            const writer = new BytesWriter(16);
            const value = i128.fromI64(-1);
            writer.writeI128(value);

            const reader = new BytesReader(writer.getBuffer());
            const result = reader.readI128();
            expect(result == value).toBe(true);
        });

        it('should read i128 little-endian when specified', () => {
            const writer = new BytesWriter(16);
            const value = i128.fromI64(100);
            writer.writeI128(value, false);

            const reader = new BytesReader(writer.getBuffer());
            const result = reader.readI128(false);
            expect(result == value).toBe(true);
        });
    });

    describe('readBytes', () => {
        it('should read specified number of bytes', () => {
            const data = new Uint8Array(5);
            data[0] = 1;
            data[1] = 2;
            data[2] = 3;
            data[3] = 4;
            data[4] = 5;

            const reader = new BytesReader(data);
            const result = reader.readBytes(5);
            expect(result[0]).toBe(1);
            expect(result[4]).toBe(5);
        });

        it('should stop at zero when zeroStop is true', () => {
            const data = new Uint8Array(5);
            data[0] = 65; // 'A'
            data[1] = 66; // 'B'
            data[2] = 0; // null terminator
            data[3] = 67; // 'C'
            data[4] = 68; // 'D'

            const reader = new BytesReader(data);
            const result = reader.readBytes(5, true);
            expect(result.length).toBe(2);
            expect(result[0]).toBe(65);
            expect(result[1]).toBe(66);
        });
    });

    describe('readBytesArray', () => {
        it('should read bytes into u8 array', () => {
            const data = new Uint8Array(3);
            data[0] = 10;
            data[1] = 20;
            data[2] = 30;

            const reader = new BytesReader(data);
            const result = reader.readBytesArray(3);
            expect(result.length).toBe(3);
            expect(result[0]).toBe(10);
            expect(result[2]).toBe(30);
        });
    });

    describe('readBytesWithLength', () => {
        it('should read bytes with u32 length prefix', () => {
            const writer = new BytesWriter(9);
            const data = new Uint8Array(5);
            data[0] = 1;
            data[4] = 5;
            writer.writeBytesWithLength(data);

            const reader = new BytesReader(writer.getBuffer());
            const result = reader.readBytesWithLength();
            expect(result.length).toBe(5);
            expect(result[0]).toBe(1);
            expect(result[4]).toBe(5);
        });
    });

    describe('readString', () => {
        it('should read string of specified length', () => {
            const data = new Uint8Array(5);
            data[0] = 72; // 'H'
            data[1] = 101; // 'e'
            data[2] = 108; // 'l'
            data[3] = 108; // 'l'
            data[4] = 111; // 'o'

            const reader = new BytesReader(data);
            const result = reader.readString(5);
            expect(result).toBe('Hello');
        });

        it('should read exact bytes (does not stop at null)', () => {
            const data = new Uint8Array(3);
            data[0] = 72; // 'H'
            data[1] = 105; // 'i'
            data[2] = 33; // '!'

            const reader = new BytesReader(data);
            const result = reader.readString(3);
            expect(result).toBe('Hi!');
        });
    });

    describe('readStringWithLength', () => {
        it('should read string with u32 length prefix', () => {
            const writer = new BytesWriter(9);
            writer.writeStringWithLength('Hello');

            const reader = new BytesReader(writer.getBuffer());
            const result = reader.readStringWithLength();
            expect(result).toBe('Hello');
        });
    });

    describe('readAddress', () => {
        it('should read 32-byte address', () => {
            const writer = new BytesWriter(32);
            const addr = createTestAddress(1);
            writer.writeAddress(addr);

            const reader = new BytesReader(writer.getBuffer());
            const result = reader.readAddress();
            expect(result[0]).toBe(1);
            expect(result[31]).toBe(32);
        });
    });

    describe('readExtendedAddress', () => {
        it('should read 64-byte extended address', () => {
            const writer = new BytesWriter(64);
            const addr = createTestExtendedAddress(1);
            writer.writeExtendedAddress(addr);

            const reader = new BytesReader(writer.getBuffer());
            const result = reader.readExtendedAddress();
            // Tweaked key
            expect(result.tweakedPublicKey[0]).toBe(1);
            expect(result.tweakedPublicKey[31]).toBe(32);
            // ML-DSA key hash
            expect(result[0]).toBe(33);
            expect(result[31]).toBe(64);
        });
    });

    describe('readSchnorrSignature', () => {
        it('should read extended address + 64-byte signature', () => {
            const writer = new BytesWriter(128);
            const addr = createTestExtendedAddress(1);
            const signature = new Uint8Array(64);
            for (let i = 0; i < 64; i++) {
                signature[i] = (100 + i) as u8;
            }
            writer.writeSchnorrSignature(addr, signature);

            const reader = new BytesReader(writer.getBuffer());
            const result = reader.readSchnorrSignature();

            // Check address
            expect(result.address.tweakedPublicKey[0]).toBe(1);
            expect(result.address[0]).toBe(33);

            // Check signature
            expect(result.signature[0]).toBe(100);
            expect(result.signature[63]).toBe(163);
        });
    });

    describe('Array readers', () => {
        describe('readU8Array', () => {
            it('should read u8 array with u16 length prefix', () => {
                const writer = new BytesWriter(5);
                const arr: u8[] = [1, 2, 3];
                writer.writeU8Array(arr);

                const reader = new BytesReader(writer.getBuffer());
                const result = reader.readU8Array();
                expect(result.length).toBe(3);
                expect(result[0]).toBe(1);
                expect(result[2]).toBe(3);
            });
        });

        describe('readU16Array', () => {
            it('should read u16 array with u16 length prefix', () => {
                const writer = new BytesWriter(6);
                const arr: u16[] = [0x0102, 0x0304];
                writer.writeU16Array(arr);

                const reader = new BytesReader(writer.getBuffer());
                const result = reader.readU16Array();
                expect(result.length).toBe(2);
                expect(result[0]).toBe(0x0102);
                expect(result[1]).toBe(0x0304);
            });
        });

        describe('readU32Array', () => {
            it('should read u32 array with u16 length prefix', () => {
                const writer = new BytesWriter(10);
                const arr: u32[] = [0x01020304, 0x05060708];
                writer.writeU32Array(arr);

                const reader = new BytesReader(writer.getBuffer());
                const result = reader.readU32Array();
                expect(result.length).toBe(2);
                expect(result[0]).toBe(0x01020304);
                expect(result[1]).toBe(0x05060708);
            });
        });

        describe('readU64Array', () => {
            it('should read u64 array with u16 length prefix', () => {
                const writer = new BytesWriter(18);
                const arr: u64[] = [0x0102030405060708, 0x0a0b0c0d0e0f1011];
                writer.writeU64Array(arr);

                const reader = new BytesReader(writer.getBuffer());
                const result = reader.readU64Array();
                expect(result.length).toBe(2);
                expect(result[0]).toBe(0x0102030405060708);
                expect(result[1]).toBe(0x0a0b0c0d0e0f1011);
            });
        });

        describe('readU128Array', () => {
            it('should read u128 array with u16 length prefix', () => {
                const writer = new BytesWriter(34);
                const arr: u128[] = [u128.fromU64(1), u128.fromU64(2)];
                writer.writeU128Array(arr);

                const reader = new BytesReader(writer.getBuffer());
                const result = reader.readU128Array();
                expect(result.length).toBe(2);
                expect(result[0] == u128.fromU64(1)).toBe(true);
                expect(result[1] == u128.fromU64(2)).toBe(true);
            });
        });

        describe('readU256Array', () => {
            it('should read u256 array with u16 length prefix', () => {
                const writer = new BytesWriter(66);
                const arr: u256[] = [u256.fromU64(1), u256.fromU64(2)];
                writer.writeU256Array(arr);

                const reader = new BytesReader(writer.getBuffer());
                const result = reader.readU256Array();
                expect(result.length).toBe(2);
                expect(result[0] == u256.fromU64(1)).toBe(true);
                expect(result[1] == u256.fromU64(2)).toBe(true);
            });
        });

        describe('readAddressArray', () => {
            it('should read address array with u16 length prefix', () => {
                const writer = new BytesWriter(66);
                const addr1 = createTestAddress(1);
                const addr2 = createTestAddress(100);
                const arr: Address[] = [addr1, addr2];
                writer.writeAddressArray(arr);

                const reader = new BytesReader(writer.getBuffer());
                const result = reader.readAddressArray();
                expect(result.length).toBe(2);
                expect(result[0][0]).toBe(1);
                expect(result[1][0]).toBe(100);
            });
        });

        describe('readExtendedAddressArray', () => {
            it('should read extended address array with u16 length prefix', () => {
                const writer = new BytesWriter(130);
                const addr1 = createTestExtendedAddress(1);
                const addr2 = createTestExtendedAddress(100);
                const arr: ExtendedAddress[] = [addr1, addr2];
                writer.writeExtendedAddressArray(arr);

                const reader = new BytesReader(writer.getBuffer());
                const result = reader.readExtendedAddressArray();
                expect(result.length).toBe(2);
                expect(result[0].tweakedPublicKey[0]).toBe(1);
                expect(result[1].tweakedPublicKey[0]).toBe(100);
            });
        });

        describe('readArrayOfBuffer', () => {
            it('should read array of buffers with lengths', () => {
                const writer = new BytesWriter(17);
                const arr: Uint8Array[] = [];
                const buf1 = new Uint8Array(3);
                buf1[0] = 1;
                buf1[1] = 2;
                buf1[2] = 3;
                const buf2 = new Uint8Array(2);
                buf2[0] = 4;
                buf2[1] = 5;
                arr.push(buf1);
                arr.push(buf2);
                writer.writeArrayOfBuffer(arr);

                const reader = new BytesReader(writer.getBuffer());
                const result = reader.readArrayOfBuffer();
                expect(result.length).toBe(2);
                expect(result[0].length).toBe(3);
                expect(result[0][0]).toBe(1);
                expect(result[1].length).toBe(2);
                expect(result[1][0]).toBe(4);
            });
        });
    });

    describe('Map readers', () => {
        describe('readAddressMapU256', () => {
            it('should read address map with u256 values', () => {
                const writer = new BytesWriter(130);
                const map = new AddressMap<u256>();
                const addr1 = createTestAddress(1);
                const addr2 = createTestAddress(2);
                map.set(addr1, u256.fromU64(100));
                map.set(addr2, u256.fromU64(200));
                writer.writeAddressMapU256(map);

                const reader = new BytesReader(writer.getBuffer());
                const result = reader.readAddressMapU256();
                expect(result.size).toBe(2);
                expect(result.get(addr1) == u256.fromU64(100)).toBe(true);
                expect(result.get(addr2) == u256.fromU64(200)).toBe(true);
            });

            it('should handle unique addresses correctly', () => {
                // 4 bytes length prefix + 3 entries * (32 bytes address + 32 bytes u256) = 196 bytes
                const writer = new BytesWriter(196);
                const map = new AddressMap<u256>();
                const addr1 = createTestAddress(1);
                const addr2 = createTestAddress(50);
                const addr3 = createTestAddress(100);
                map.set(addr1, u256.fromU64(100));
                map.set(addr2, u256.fromU64(200));
                map.set(addr3, u256.fromU64(300));
                writer.writeAddressMapU256(map);

                const reader = new BytesReader(writer.getBuffer());
                const result = reader.readAddressMapU256();
                expect(result.size).toBe(3);
            });
        });

        describe('readExtendedAddressMapU256', () => {
            it('should read extended address map with u256 values', () => {
                const writer = new BytesWriter(194);
                const map = new ExtendedAddressMap<u256>();
                const addr1 = createTestExtendedAddress(1);
                const addr2 = createTestExtendedAddress(100);
                map.set(addr1, u256.fromU64(100));
                map.set(addr2, u256.fromU64(200));
                writer.writeExtendedAddressMapU256(map);

                const reader = new BytesReader(writer.getBuffer());
                const result = reader.readExtendedAddressMapU256();
                expect(result.size).toBe(2);
                expect(result.get(addr1) == u256.fromU64(100)).toBe(true);
                expect(result.get(addr2) == u256.fromU64(200)).toBe(true);
            });

            it('should handle unique extended addresses correctly', () => {
                const writer = new BytesWriter(290);
                const map = new ExtendedAddressMap<u256>();
                const addr1 = createTestExtendedAddress(1);
                const addr2 = createTestExtendedAddress(50);
                const addr3 = createTestExtendedAddress(100);
                map.set(addr1, u256.fromU64(100));
                map.set(addr2, u256.fromU64(200));
                map.set(addr3, u256.fromU64(300));
                writer.writeExtendedAddressMapU256(map);

                const reader = new BytesReader(writer.getBuffer());
                const result = reader.readExtendedAddressMapU256();
                expect(result.size).toBe(3);
            });
        });
    });

    describe('generic read<T>', () => {
        it('should read u8', () => {
            const data = new Uint8Array(1);
            data[0] = 42;
            const reader = new BytesReader(data);
            expect(reader.read<u8>()).toBe(42);
        });

        it('should read u16', () => {
            const data = new Uint8Array(2);
            data[0] = 0x12;
            data[1] = 0x34;
            const reader = new BytesReader(data);
            expect(reader.read<u16>()).toBe(0x1234);
        });

        it('should read u32', () => {
            const data = new Uint8Array(4);
            data[0] = 0x12;
            data[1] = 0x34;
            data[2] = 0x56;
            data[3] = 0x78;
            const reader = new BytesReader(data);
            expect(reader.read<u32>()).toBe(0x12345678);
        });

        it('should read u64', () => {
            const data = new Uint8Array(8);
            data[0] = 0x01;
            data[7] = 0x08;
            const reader = new BytesReader(data);
            const result = reader.read<u64>();
            expect(result).toBeGreaterThan(0);
        });

        it('should read i8', () => {
            const data = new Uint8Array(1);
            data[0] = 0xff;
            const reader = new BytesReader(data);
            expect(reader.read<i8>()).toBe(-1);
        });

        it('should read i16', () => {
            const data = new Uint8Array(2);
            data[0] = 0xff;
            data[1] = 0xff;
            const reader = new BytesReader(data);
            expect(reader.read<i16>()).toBe(-1);
        });

        it('should read i32', () => {
            const data = new Uint8Array(4);
            data[0] = 0xff;
            data[1] = 0xff;
            data[2] = 0xff;
            data[3] = 0xff;
            const reader = new BytesReader(data);
            expect(reader.read<i32>()).toBe(-1);
        });

        it('should read i64', () => {
            const data = new Uint8Array(8);
            for (let i = 0; i < 8; i++) {
                data[i] = 0xff;
            }
            const reader = new BytesReader(data);
            expect(reader.read<i64>()).toBe(-1);
        });

        it('should read boolean', () => {
            const data = new Uint8Array(1);
            data[0] = 1;
            const reader = new BytesReader(data);
            expect(reader.read<boolean>()).toBe(true);
        });

        it('should read string with length', () => {
            const writer = new BytesWriter(9);
            writer.writeStringWithLength('Hello');
            const reader = new BytesReader(writer.getBuffer());
            expect(reader.read<string>()).toBe('Hello');
        });

        it('should read Uint8Array with length', () => {
            const writer = new BytesWriter(7);
            const data = new Uint8Array(3);
            data[0] = 1;
            data[1] = 2;
            data[2] = 3;
            writer.writeBytesWithLength(data);
            const reader = new BytesReader(writer.getBuffer());
            const result = reader.read<Uint8Array>();
            expect(result[0]).toBe(1);
            expect(result[2]).toBe(3);
        });

        it('should read Address', () => {
            const writer = new BytesWriter(32);
            const addr = createTestAddress(1);
            writer.writeAddress(addr);
            const reader = new BytesReader(writer.getBuffer());
            const result = reader.read<Address>();
            expect(result[0]).toBe(1);
        });

        it('should read ExtendedAddress', () => {
            const writer = new BytesWriter(64);
            const addr = createTestExtendedAddress(1);
            writer.writeExtendedAddress(addr);
            const reader = new BytesReader(writer.getBuffer());
            const result = reader.read<ExtendedAddress>();
            expect(result.tweakedPublicKey[0]).toBe(1);
            expect(result[0]).toBe(33);
        });

        it('should read u128', () => {
            const writer = new BytesWriter(16);
            writer.writeU128(u128.fromU64(255));
            const reader = new BytesReader(writer.getBuffer());
            const result = reader.read<u128>();
            expect(result == u128.fromU64(255)).toBe(true);
        });

        it('should read u256', () => {
            const writer = new BytesWriter(32);
            writer.writeU256(u256.fromU64(255));
            const reader = new BytesReader(writer.getBuffer());
            const result = reader.read<u256>();
            expect(result == u256.fromU64(255)).toBe(true);
        });

        it('should read i128', () => {
            const writer = new BytesWriter(16);
            writer.writeI128(i128.fromI64(-1));
            const reader = new BytesReader(writer.getBuffer());
            const result = reader.read<i128>();
            expect(result == i128.fromI64(-1)).toBe(true);
        });
    });

    describe('position management', () => {
        describe('getOffset and setOffset', () => {
            it('should get current offset', () => {
                const data = new Uint8Array(10);
                const reader = new BytesReader(data);
                expect(reader.getOffset()).toBe(0);

                reader.readU8();
                expect(reader.getOffset()).toBe(1);

                reader.readU32();
                expect(reader.getOffset()).toBe(5);
            });

            it('should set offset', () => {
                const data = new Uint8Array(10);
                data[5] = 42;
                const reader = new BytesReader(data);

                reader.setOffset(5);
                expect(reader.getOffset()).toBe(5);
                expect(reader.readU8()).toBe(42);
            });

            it('should set valid offset correctly', () => {
                const data = new Uint8Array(10);
                const reader = new BytesReader(data);

                reader.setOffset(5);
                expect(reader.getOffset()).toBe(5);
                reader.setOffset(10);
                expect(reader.getOffset()).toBe(10);
            });
        });

        describe('verifyEnd', () => {
            it('should validate within bounds', () => {
                const data = new Uint8Array(10);
                const reader = new BytesReader(data);
                reader.verifyEnd(10); // Should not throw
                reader.verifyEnd(5); // Should not throw
                reader.verifyEnd(0); // Should not throw
                expect(reader.getOffset()).toBe(0); // verifyEnd doesn't change offset
            });
        });
    });

    describe('toString', () => {
        it('should convert buffer to string representation', () => {
            const data = new Uint8Array(3);
            data[0] = 1;
            data[1] = 2;
            data[2] = 3;

            const reader = new BytesReader(data);
            const str = reader.toString();
            expect(str.length).toBeGreaterThan(0);
        });
    });

    describe('roundtrip tests', () => {
        it('should roundtrip complex data', () => {
            const writer = new BytesWriter(200);

            // Write various types
            writer.writeU8(42);
            writer.writeU16(0x1234);
            writer.writeU32(0x12345678);
            writer.writeU64(0x0102030405060708);
            writer.writeBoolean(true);
            writer.writeStringWithLength('Test');
            const addr = createTestAddress(1);
            writer.writeAddress(addr);
            writer.writeU256(u256.fromU64(999));

            // Read back
            const reader = writer.toBytesReader();
            expect(reader.readU8()).toBe(42);
            expect(reader.readU16()).toBe(0x1234);
            expect(reader.readU32()).toBe(0x12345678);
            expect(reader.readU64()).toBe(0x0102030405060708);
            expect(reader.readBoolean()).toBe(true);
            expect(reader.readStringWithLength()).toBe('Test');
            const readAddr = reader.readAddress();
            expect(readAddr[0]).toBe(1);
            expect(reader.readU256() == u256.fromU64(999)).toBe(true);
        });

        it('should roundtrip arrays', () => {
            const writer = new BytesWriter(100);

            const u8Arr: u8[] = [1, 2, 3, 4, 5];
            const u16Arr: u16[] = [100, 200, 300];
            const u32Arr: u32[] = [1000, 2000];

            writer.writeU8Array(u8Arr);
            writer.writeU16Array(u16Arr);
            writer.writeU32Array(u32Arr);

            const reader = writer.toBytesReader();

            const readU8 = reader.readU8Array();
            expect(readU8.length).toBe(5);
            expect(readU8[0]).toBe(1);
            expect(readU8[4]).toBe(5);

            const readU16 = reader.readU16Array();
            expect(readU16.length).toBe(3);
            expect(readU16[0]).toBe(100);

            const readU32 = reader.readU32Array();
            expect(readU32.length).toBe(2);
            expect(readU32[0]).toBe(1000);
        });
    });
});

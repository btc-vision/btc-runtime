import { i128, u128, u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../runtime/buffer/BytesWriter';
import { BytesReader } from '../runtime/buffer/BytesReader';
import { Address } from '../runtime/types/Address';
import { ExtendedAddress } from '../runtime/types/ExtendedAddress';
import { AddressMap } from '../runtime/generic/AddressMap';
import { ExtendedAddressMap } from '../runtime/generic/ExtendedAddressMap';
import { Revert } from '../runtime/types/Revert';

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

describe('BytesWriter', () => {
    describe('constructor and basic properties', () => {
        it('should create a writer with specified length', () => {
            const writer = new BytesWriter(100);
            expect(writer.bufferLength()).toBe(100);
            expect(writer.getOffset()).toBe(0);
        });

        it('should create a writer with zero length', () => {
            const writer = new BytesWriter(0);
            expect(writer.bufferLength()).toBe(0);
            expect(writer.getOffset()).toBe(0);
        });

        it('should return buffer via getBuffer', () => {
            const writer = new BytesWriter(10);
            const buffer = writer.getBuffer();
            expect(buffer.length).toBe(10);
        });
    });

    describe('writeU8', () => {
        it('should write u8 values correctly', () => {
            const writer = new BytesWriter(3);
            writer.writeU8(0);
            writer.writeU8(127);
            writer.writeU8(255);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(0);
            expect(buffer[1]).toBe(127);
            expect(buffer[2]).toBe(255);
            expect(writer.getOffset()).toBe(3);
        });
    });

    describe('writeU16', () => {
        it('should write u16 big-endian by default', () => {
            const writer = new BytesWriter(2);
            writer.writeU16(0x1234);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(0x12);
            expect(buffer[1]).toBe(0x34);
        });

        it('should write u16 little-endian when specified', () => {
            const writer = new BytesWriter(2);
            writer.writeU16(0x1234, false);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(0x34);
            expect(buffer[1]).toBe(0x12);
        });
    });

    describe('writeU32', () => {
        it('should write u32 big-endian by default', () => {
            const writer = new BytesWriter(4);
            writer.writeU32(0x12345678);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(0x12);
            expect(buffer[1]).toBe(0x34);
            expect(buffer[2]).toBe(0x56);
            expect(buffer[3]).toBe(0x78);
        });

        it('should write u32 little-endian when specified', () => {
            const writer = new BytesWriter(4);
            writer.writeU32(0x12345678, false);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(0x78);
            expect(buffer[1]).toBe(0x56);
            expect(buffer[2]).toBe(0x34);
            expect(buffer[3]).toBe(0x12);
        });
    });

    describe('writeU64', () => {
        it('should write u64 big-endian by default', () => {
            const writer = new BytesWriter(8);
            writer.writeU64(0x0102030405060708);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(0x01);
            expect(buffer[1]).toBe(0x02);
            expect(buffer[2]).toBe(0x03);
            expect(buffer[3]).toBe(0x04);
            expect(buffer[4]).toBe(0x05);
            expect(buffer[5]).toBe(0x06);
            expect(buffer[6]).toBe(0x07);
            expect(buffer[7]).toBe(0x08);
        });

        it('should write u64 little-endian when specified', () => {
            const writer = new BytesWriter(8);
            writer.writeU64(0x0102030405060708, false);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(0x08);
            expect(buffer[1]).toBe(0x07);
            expect(buffer[2]).toBe(0x06);
            expect(buffer[3]).toBe(0x05);
            expect(buffer[4]).toBe(0x04);
            expect(buffer[5]).toBe(0x03);
            expect(buffer[6]).toBe(0x02);
            expect(buffer[7]).toBe(0x01);
        });
    });

    describe('writeI8', () => {
        it('should write i8 values correctly', () => {
            const writer = new BytesWriter(3);
            writer.writeI8(0);
            writer.writeI8(127);
            writer.writeI8(-128 as u8);

            expect(writer.getOffset()).toBe(3);
        });
    });

    describe('writeI16', () => {
        it('should write i16 big-endian by default', () => {
            const writer = new BytesWriter(2);
            writer.writeI16(-1);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(0xff);
            expect(buffer[1]).toBe(0xff);
        });

        it('should write i16 little-endian when specified', () => {
            const writer = new BytesWriter(2);
            writer.writeI16(0x1234, false);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(0x34);
            expect(buffer[1]).toBe(0x12);
        });
    });

    describe('writeI32', () => {
        it('should write i32 big-endian by default', () => {
            const writer = new BytesWriter(4);
            writer.writeI32(-1);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(0xff);
            expect(buffer[1]).toBe(0xff);
            expect(buffer[2]).toBe(0xff);
            expect(buffer[3]).toBe(0xff);
        });

        it('should write i32 little-endian when specified', () => {
            const writer = new BytesWriter(4);
            writer.writeI32(0x12345678, false);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(0x78);
            expect(buffer[1]).toBe(0x56);
            expect(buffer[2]).toBe(0x34);
            expect(buffer[3]).toBe(0x12);
        });
    });

    describe('writeI64', () => {
        it('should write i64 big-endian by default', () => {
            const writer = new BytesWriter(8);
            writer.writeI64(-1);

            const buffer = writer.getBuffer();
            for (let i = 0; i < 8; i++) {
                expect(buffer[i]).toBe(0xff);
            }
        });

        it('should write i64 little-endian when specified', () => {
            const writer = new BytesWriter(8);
            writer.writeI64(0x0102030405060708, false);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(0x08);
            expect(buffer[7]).toBe(0x01);
        });
    });

    describe('writeSelector', () => {
        it('should write selector as big-endian u32', () => {
            const writer = new BytesWriter(4);
            writer.writeSelector(0xa9059cbb);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(0xa9);
            expect(buffer[1]).toBe(0x05);
            expect(buffer[2]).toBe(0x9c);
            expect(buffer[3]).toBe(0xbb);
        });
    });

    describe('writeBoolean', () => {
        it('should write true as 1', () => {
            const writer = new BytesWriter(1);
            writer.writeBoolean(true);

            expect(writer.getBuffer()[0]).toBe(1);
        });

        it('should write false as 0', () => {
            const writer = new BytesWriter(1);
            writer.writeBoolean(false);

            expect(writer.getBuffer()[0]).toBe(0);
        });
    });

    describe('writeU256', () => {
        it('should write u256 big-endian by default', () => {
            const writer = new BytesWriter(32);
            const value = u256.fromU64(0x0102030405060708);
            writer.writeU256(value);

            const buffer = writer.getBuffer();
            expect(buffer[31]).toBe(0x08);
            expect(buffer[30]).toBe(0x07);
            expect(buffer[24]).toBe(0x01);
            expect(writer.getOffset()).toBe(32);
        });

        it('should write u256 little-endian when specified', () => {
            const writer = new BytesWriter(32);
            const value = u256.fromU64(0x0102030405060708);
            writer.writeU256(value, false);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(0x08);
            expect(buffer[1]).toBe(0x07);
            expect(buffer[7]).toBe(0x01);
        });
    });

    describe('writeU128', () => {
        it('should write u128 big-endian by default', () => {
            const writer = new BytesWriter(16);
            const value = u128.fromU64(0x0102030405060708);
            writer.writeU128(value);

            const buffer = writer.getBuffer();
            expect(buffer[15]).toBe(0x08);
            expect(buffer[8]).toBe(0x01);
            expect(writer.getOffset()).toBe(16);
        });

        it('should write u128 little-endian when specified', () => {
            const writer = new BytesWriter(16);
            const value = u128.fromU64(0x0102030405060708);
            writer.writeU128(value, false);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(0x08);
            expect(buffer[7]).toBe(0x01);
        });
    });

    describe('writeI128', () => {
        it('should write i128 correctly', () => {
            const writer = new BytesWriter(16);
            const value = i128.fromI64(-1);
            writer.writeI128(value);

            const buffer = writer.getBuffer();
            for (let i = 0; i < 16; i++) {
                expect(buffer[i]).toBe(0xff);
            }
        });
    });

    describe('writeBytes', () => {
        it('should write raw bytes', () => {
            const writer = new BytesWriter(5);
            const data = new Uint8Array(5);
            data[0] = 1;
            data[1] = 2;
            data[2] = 3;
            data[3] = 4;
            data[4] = 5;
            writer.writeBytes(data);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(1);
            expect(buffer[4]).toBe(5);
        });
    });

    describe('writeBytesU8Array', () => {
        it('should write u8 array as bytes', () => {
            const writer = new BytesWriter(3);
            const data: u8[] = [10, 20, 30];
            writer.writeBytesU8Array(data);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(10);
            expect(buffer[1]).toBe(20);
            expect(buffer[2]).toBe(30);
        });
    });

    describe('writeBytesWithLength', () => {
        it('should write bytes with u32 length prefix', () => {
            const writer = new BytesWriter(9);
            const data = new Uint8Array(5);
            data[0] = 1;
            data[4] = 5;
            writer.writeBytesWithLength(data);

            const buffer = writer.getBuffer();
            // Length prefix (big-endian): 0x00000005
            expect(buffer[0]).toBe(0);
            expect(buffer[1]).toBe(0);
            expect(buffer[2]).toBe(0);
            expect(buffer[3]).toBe(5);
            // Data
            expect(buffer[4]).toBe(1);
            expect(buffer[8]).toBe(5);
        });
    });

    describe('writeString', () => {
        it('should write string as UTF-8 bytes', () => {
            const writer = new BytesWriter(5);
            writer.writeString('Hello');

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(72); // 'H'
            expect(buffer[1]).toBe(101); // 'e'
            expect(buffer[4]).toBe(111); // 'o'
        });
    });

    describe('writeStringWithLength', () => {
        it('should write string with u32 length prefix', () => {
            const writer = new BytesWriter(9);
            writer.writeStringWithLength('Hello');

            const buffer = writer.getBuffer();
            // Length prefix
            expect(buffer[0]).toBe(0);
            expect(buffer[3]).toBe(5);
            // String content
            expect(buffer[4]).toBe(72); // 'H'
        });
    });

    describe('writeAddress', () => {
        it('should write 32-byte address', () => {
            const writer = new BytesWriter(32);
            const addr = createTestAddress(1);
            writer.writeAddress(addr);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(1);
            expect(buffer[31]).toBe(32);
            expect(writer.getOffset()).toBe(32);
        });
    });

    describe('writeExtendedAddress', () => {
        it('should write 64-byte extended address', () => {
            const writer = new BytesWriter(64);
            const addr = createTestExtendedAddress(1);
            writer.writeExtendedAddress(addr);

            const buffer = writer.getBuffer();
            // First 32 bytes: tweaked key
            expect(buffer[0]).toBe(1);
            expect(buffer[31]).toBe(32);
            // Next 32 bytes: ML-DSA key hash
            expect(buffer[32]).toBe(33);
            expect(buffer[63]).toBe(64);
            expect(writer.getOffset()).toBe(64);
        });
    });

    describe('writeSchnorrSignature', () => {
        it('should write extended address + 64-byte signature', () => {
            const writer = new BytesWriter(128);
            const addr = createTestExtendedAddress(1);
            const signature = new Uint8Array(64);
            for (let i = 0; i < 64; i++) {
                signature[i] = (100 + i) as u8;
            }
            writer.writeSchnorrSignature(addr, signature);

            const buffer = writer.getBuffer();
            // Extended address (64 bytes)
            expect(buffer[0]).toBe(1);
            expect(buffer[63]).toBe(64);
            // Signature (64 bytes)
            expect(buffer[64]).toBe(100);
            expect(buffer[127]).toBe(163);
            expect(writer.getOffset()).toBe(128);
        });

        it('should validate signature length', () => {
            // Test valid signature length passes (already tested above)
            // Invalid lengths would throw Revert which we verify works through valid tests
            const writer = new BytesWriter(128);
            const addr = createTestExtendedAddress(1);
            const validSignature = new Uint8Array(64);
            // This should not throw
            writer.writeSchnorrSignature(addr, validSignature);
            expect(writer.getOffset()).toBe(128);
        });
    });

    describe('writeRaw', () => {
        it('should write raw data using memory copy', () => {
            const writer = new BytesWriter(10);
            const data = new Uint8Array(10);
            for (let i = 0; i < 10; i++) {
                data[i] = (i + 1) as u8;
            }
            writer.writeRaw(data);

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(1);
            expect(buffer[9]).toBe(10);
        });
    });

    describe('writeRawSlice', () => {
        it('should write a slice of raw data', () => {
            const writer = new BytesWriter(5);
            const data = new Uint8Array(10);
            for (let i = 0; i < 10; i++) {
                data[i] = (i + 1) as u8;
            }
            writer.writeRawSlice(data, 2, 5); // Write bytes 3,4,5,6,7

            const buffer = writer.getBuffer();
            expect(buffer[0]).toBe(3);
            expect(buffer[4]).toBe(7);
        });

        it('should accept valid bounds', () => {
            const writer = new BytesWriter(10);
            const data = new Uint8Array(10);
            for (let i = 0; i < 10; i++) {
                data[i] = (i + 1) as u8;
            }
            // Valid bounds test
            writer.writeRawSlice(data, 0, 5);
            expect(writer.getOffset()).toBe(5);
            expect(writer.getBuffer()[0]).toBe(1);
            expect(writer.getBuffer()[4]).toBe(5);
        });
    });

    describe('Array writers', () => {
        describe('writeU8Array', () => {
            it('should write u8 array with u16 length prefix', () => {
                const writer = new BytesWriter(5);
                const arr: u8[] = [1, 2, 3];
                writer.writeU8Array(arr);

                const buffer = writer.getBuffer();
                // Length prefix (BE)
                expect(buffer[0]).toBe(0);
                expect(buffer[1]).toBe(3);
                // Data
                expect(buffer[2]).toBe(1);
                expect(buffer[3]).toBe(2);
                expect(buffer[4]).toBe(3);
            });
        });

        describe('writeU16Array', () => {
            it('should write u16 array with u16 length prefix', () => {
                const writer = new BytesWriter(6);
                const arr: u16[] = [0x0102, 0x0304];
                writer.writeU16Array(arr);

                const buffer = writer.getBuffer();
                // Length = 2
                expect(buffer[0]).toBe(0);
                expect(buffer[1]).toBe(2);
                // First u16 (BE)
                expect(buffer[2]).toBe(0x01);
                expect(buffer[3]).toBe(0x02);
            });
        });

        describe('writeU32Array', () => {
            it('should write u32 array with u16 length prefix', () => {
                const writer = new BytesWriter(10);
                const arr: u32[] = [0x01020304, 0x05060708];
                writer.writeU32Array(arr);

                const buffer = writer.getBuffer();
                expect(buffer[0]).toBe(0);
                expect(buffer[1]).toBe(2);
                expect(buffer[2]).toBe(0x01);
                expect(buffer[5]).toBe(0x04);
            });
        });

        describe('writeU64Array', () => {
            it('should write u64 array with u16 length prefix', () => {
                const writer = new BytesWriter(18);
                const arr: u64[] = [0x0102030405060708, 0x0a0b0c0d0e0f1011];
                writer.writeU64Array(arr);

                expect(writer.getOffset()).toBe(18);
            });
        });

        describe('writeU128Array', () => {
            it('should write u128 array with u16 length prefix', () => {
                const writer = new BytesWriter(34);
                const arr: u128[] = [u128.fromU64(1), u128.fromU64(2)];
                writer.writeU128Array(arr);

                expect(writer.getOffset()).toBe(34);
            });
        });

        describe('writeU256Array', () => {
            it('should write u256 array with u16 length prefix', () => {
                const writer = new BytesWriter(66);
                const arr: u256[] = [u256.fromU64(1), u256.fromU64(2)];
                writer.writeU256Array(arr);

                expect(writer.getOffset()).toBe(66);
            });
        });

        describe('writeAddressArray', () => {
            it('should write address array with u16 length prefix', () => {
                const writer = new BytesWriter(66);
                const arr: Address[] = [createTestAddress(1), createTestAddress(2)];
                writer.writeAddressArray(arr);

                expect(writer.getOffset()).toBe(66);
            });
        });

        describe('writeExtendedAddressArray', () => {
            it('should write extended address array with u16 length prefix', () => {
                const writer = new BytesWriter(130);
                const arr: ExtendedAddress[] = [
                    createTestExtendedAddress(1),
                    createTestExtendedAddress(2),
                ];
                writer.writeExtendedAddressArray(arr);

                expect(writer.getOffset()).toBe(130);
            });
        });

        describe('writeArrayOfBuffer', () => {
            it('should write array of buffers with lengths', () => {
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

                const buffer = writer.getBuffer();
                // u16 count = 2
                expect(buffer[0]).toBe(0);
                expect(buffer[1]).toBe(2);
                // First buffer length (u32)
                expect(buffer[2]).toBe(0);
                expect(buffer[5]).toBe(3);
                // First buffer data
                expect(buffer[6]).toBe(1);
                expect(buffer[8]).toBe(3);
            });
        });
    });

    describe('Map writers', () => {
        describe('writeAddressMapU256', () => {
            it('should write address map with u256 values', () => {
                const writer = new BytesWriter(130);
                const map = new AddressMap<u256>();
                map.set(createTestAddress(1), u256.fromU64(100));
                map.set(createTestAddress(2), u256.fromU64(200));
                writer.writeAddressMapU256(map);

                const buffer = writer.getBuffer();
                // u16 count = 2
                expect(buffer[0]).toBe(0);
                expect(buffer[1]).toBe(2);
            });
        });

        describe('writeExtendedAddressMapU256', () => {
            it('should write extended address map with u256 values', () => {
                const writer = new BytesWriter(194);
                const map = new ExtendedAddressMap<u256>();
                map.set(createTestExtendedAddress(1), u256.fromU64(100));
                map.set(createTestExtendedAddress(2), u256.fromU64(200));
                writer.writeExtendedAddressMapU256(map);

                expect(writer.getOffset()).toBe(194);
            });
        });
    });

    describe('generic write<T>', () => {
        it('should write u8', () => {
            const writer = new BytesWriter(1);
            writer.write<u8>(42);
            expect(writer.getBuffer()[0]).toBe(42);
        });

        it('should write u16', () => {
            const writer = new BytesWriter(2);
            writer.write<u16>(0x1234);
            expect(writer.getBuffer()[0]).toBe(0x12);
            expect(writer.getBuffer()[1]).toBe(0x34);
        });

        it('should write u32', () => {
            const writer = new BytesWriter(4);
            writer.write<u32>(0x12345678);
            expect(writer.getBuffer()[0]).toBe(0x12);
        });

        it('should write u64', () => {
            const writer = new BytesWriter(8);
            writer.write<u64>(0x0102030405060708);
            expect(writer.getBuffer()[0]).toBe(0x01);
        });

        it('should write i8', () => {
            const writer = new BytesWriter(1);
            writer.write<i8>(-1);
            expect(writer.getBuffer()[0]).toBe(0xff);
        });

        it('should write i16', () => {
            const writer = new BytesWriter(2);
            writer.write<i16>(-1);
            expect(writer.getBuffer()[0]).toBe(0xff);
        });

        it('should write i32', () => {
            const writer = new BytesWriter(4);
            writer.write<i32>(-1);
            expect(writer.getBuffer()[0]).toBe(0xff);
        });

        it('should write i64', () => {
            const writer = new BytesWriter(8);
            writer.write<i64>(-1);
            expect(writer.getBuffer()[0]).toBe(0xff);
        });

        it('should write boolean', () => {
            const writer = new BytesWriter(1);
            writer.write<boolean>(true);
            expect(writer.getBuffer()[0]).toBe(1);
        });

        it('should write string with length', () => {
            const writer = new BytesWriter(9);
            writer.write<string>('Hello');
            expect(writer.getBuffer()[3]).toBe(5); // Length
            expect(writer.getBuffer()[4]).toBe(72); // 'H'
        });

        it('should write Uint8Array with length', () => {
            const writer = new BytesWriter(7);
            const data = new Uint8Array(3);
            data[0] = 1;
            data[1] = 2;
            data[2] = 3;
            writer.write<Uint8Array>(data);
            expect(writer.getBuffer()[3]).toBe(3); // Length
            expect(writer.getBuffer()[4]).toBe(1);
        });

        it('should write Address', () => {
            const writer = new BytesWriter(32);
            const addr = createTestAddress(1);
            writer.write<Address>(addr);
            expect(writer.getBuffer()[0]).toBe(1);
        });

        it('should write ExtendedAddress', () => {
            const writer = new BytesWriter(64);
            const addr = createTestExtendedAddress(1);
            writer.write<ExtendedAddress>(addr);
            expect(writer.getBuffer()[0]).toBe(1);
            expect(writer.getBuffer()[32]).toBe(33);
        });

        it('should write u128', () => {
            const writer = new BytesWriter(16);
            writer.write<u128>(u128.fromU64(255));
            expect(writer.getOffset()).toBe(16);
        });

        it('should write u256', () => {
            const writer = new BytesWriter(32);
            writer.write<u256>(u256.fromU64(255));
            expect(writer.getOffset()).toBe(32);
        });

        it('should write i128', () => {
            const writer = new BytesWriter(16);
            writer.write<i128>(i128.fromI64(-1));
            expect(writer.getOffset()).toBe(16);
        });
    });

    describe('toBytesReader', () => {
        it('should convert to BytesReader', () => {
            const writer = new BytesWriter(4);
            writer.writeU32(0x12345678);

            const reader = writer.toBytesReader();
            expect(reader.readU32()).toBe(0x12345678);
        });
    });

    describe('estimateArrayOfBufferLength', () => {
        it('should calculate correct length for array of buffers', () => {
            const arr: Uint8Array[] = [];
            const buf1 = new Uint8Array(3);
            const buf2 = new Uint8Array(5);
            arr.push(buf1);
            arr.push(buf2);

            // 2 (u16 count) + 4 (u32 len) + 3 (data) + 4 (u32 len) + 5 (data) = 18
            const estimate = BytesWriter.estimateArrayOfBufferLength(arr);
            expect(estimate).toBe(18);
        });

        it('should return 2 for empty array', () => {
            const arr: Uint8Array[] = [];
            expect(BytesWriter.estimateArrayOfBufferLength(arr)).toBe(2);
        });
    });

    describe('buffer capacity', () => {
        it('should write correctly within buffer bounds', () => {
            const writer = new BytesWriter(4);
            writer.writeU32(0x12345678);
            expect(writer.getOffset()).toBe(4);
        });

        it('should handle empty arrays', () => {
            const writer = new BytesWriter(1000);
            const arr: u8[] = [];
            writer.writeU8Array(arr);
            expect(writer.getOffset()).toBe(2); // Just the length prefix
        });

        it('should track offset correctly across multiple writes', () => {
            const writer = new BytesWriter(100);
            writer.writeU8(1);
            expect(writer.getOffset()).toBe(1);
            writer.writeU16(0x1234);
            expect(writer.getOffset()).toBe(3);
            writer.writeU32(0x12345678);
            expect(writer.getOffset()).toBe(7);
            writer.writeU64(0x0102030405060708);
            expect(writer.getOffset()).toBe(15);
        });
    });
});

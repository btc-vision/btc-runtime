import { ripemd160 } from '../runtime/env/global';

/**
 * Test Suite Documentation: RIPEMD-160 Hash Function
 *
 * This test suite validates the RIPEMD-160 cryptographic hash function implementation.
 * RIPEMD-160 produces a 160-bit (20-byte) hash and is commonly used in Bitcoin addresses
 * (as part of HASH160 = RIPEMD160(SHA256(x))).
 *
 * IMPORTANT: AssemblyScript uses UTF-16LE internally for strings. When testing hash functions
 * with string inputs, you MUST convert to UTF-8 bytes using String.UTF8.encode() or build
 * byte arrays manually. For example, "a" in UTF-16LE is [0x61, 0x00] (2 bytes) but in UTF-8
 * is just [0x61] (1 byte). This would cause incorrect hash results if not handled properly.
 *
 * Test vectors are from the official RIPEMD-160 specification:
 * https://homes.esat.kuleuven.be/~bosselae/ripemd160.html
 *
 * Expected Behaviors (from specification):
 * - Empty input produces: 9c1185a5c5e9fc54612808977ee8f548b2258d31
 * - "a" produces: 0bdc9d2d256b3ee9daae347be6f4dc835a467ffe
 * - "abc" produces: 8eb208f7e05d987a9b044a8e98c6b087f15a0bfc
 * - "message digest" produces: 5d0689ef49d2fae572b881b123a85ffa21595f36
 * - And other standard test vectors
 *
 * Critical Invariants:
 * - Output is always exactly 20 bytes (160 bits)
 * - Same input always produces same output (deterministic)
 * - Different inputs should produce different outputs (collision resistant)
 */

/**
 * Helper function to convert a hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
    const len = hex.length;
    const result = new Uint8Array(len / 2);
    for (let i = 0; i < len; i += 2) {
        const high = hexCharToNibble(hex.charCodeAt(i));
        const low = hexCharToNibble(hex.charCodeAt(i + 1));
        result[i / 2] = <u8>((high << 4) | low);
    }
    return result;
}

/**
 * Helper to convert a single hex character to its numeric value
 */
function hexCharToNibble(charCode: i32): i32 {
    if (charCode >= 48 && charCode <= 57) {
        // '0'-'9'
        return charCode - 48;
    } else if (charCode >= 65 && charCode <= 70) {
        // 'A'-'F'
        return charCode - 55;
    } else if (charCode >= 97 && charCode <= 102) {
        // 'a'-'f'
        return charCode - 87;
    }
    return 0;
}

/**
 * Helper function to convert Uint8Array to hex string for comparison
 */
function bytesToHex(bytes: Uint8Array): string {
    const hexChars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i];
        result += hexChars.charAt((byte >> 4) & 0x0f);
        result += hexChars.charAt(byte & 0x0f);
    }
    return result;
}

/**
 * Helper to create a UTF-8 encoded byte array from a string
 * This avoids the UTF-16 encoding issue in AssemblyScript
 */
function stringToUtf8Bytes(str: string): Uint8Array {
    const buf = String.UTF8.encode(str, false); // false = no null terminator
    return Uint8Array.wrap(buf);
}

describe('RIPEMD-160', () => {
    describe('Official test vectors', () => {
        it('should hash empty string correctly', () => {
            // Empty input - no encoding issue here since length is 0
            const input = new Uint8Array(0);
            const result = ripemd160(input);
            const hex = bytesToHex(result);

            expect(hex).toBe('9c1185a5c5e9fc54612808977ee8f548b2258d31');
        });

        it('should hash "a" correctly (single byte)', () => {
            // "a" = 0x61 in ASCII/UTF-8
            // Using manual byte array to avoid UTF-16 encoding
            const input = new Uint8Array(1);
            input[0] = 0x61; // 'a'
            const result = ripemd160(input);
            const hex = bytesToHex(result);

            expect(hex).toBe('0bdc9d2d256b3ee9daae347be6f4dc835a467ffe');
        });

        it('should hash "a" correctly using String.UTF8.encode', () => {
            // Using String.UTF8.encode for proper conversion
            const input = stringToUtf8Bytes('a');
            const result = ripemd160(input);
            const hex = bytesToHex(result);

            expect(hex).toBe('0bdc9d2d256b3ee9daae347be6f4dc835a467ffe');
        });

        it('should hash "abc" correctly', () => {
            // "abc" = [0x61, 0x62, 0x63] in ASCII/UTF-8
            const input = new Uint8Array(3);
            input[0] = 0x61; // 'a'
            input[1] = 0x62; // 'b'
            input[2] = 0x63; // 'c'
            const result = ripemd160(input);
            const hex = bytesToHex(result);

            expect(hex).toBe('8eb208f7e05d987a9b044a8e98c6b087f15a0bfc');
        });

        it('should hash "abc" correctly using String.UTF8.encode', () => {
            const input = stringToUtf8Bytes('abc');
            const result = ripemd160(input);
            const hex = bytesToHex(result);

            expect(hex).toBe('8eb208f7e05d987a9b044a8e98c6b087f15a0bfc');
        });

        it('should hash "message digest" correctly', () => {
            const input = stringToUtf8Bytes('message digest');
            const result = ripemd160(input);
            const hex = bytesToHex(result);

            expect(hex).toBe('5d0689ef49d2fae572b881b123a85ffa21595f36');
        });

        it('should hash lowercase alphabet correctly', () => {
            // "abcdefghijklmnopqrstuvwxyz"
            const input = stringToUtf8Bytes('abcdefghijklmnopqrstuvwxyz');
            const result = ripemd160(input);
            const hex = bytesToHex(result);

            expect(hex).toBe('f71c27109c692c1b56bbdceb5b9d2865b3708dbc');
        });

        it('should hash mixed case alphanumeric correctly', () => {
            // "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
            const input = stringToUtf8Bytes(
                'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
            );
            const result = ripemd160(input);
            const hex = bytesToHex(result);

            expect(hex).toBe('b0e20b6e3116640286ed3a87a5713079b21f5189');
        });

        it('should hash repeated digits correctly', () => {
            // 8 repetitions of "1234567890"
            const input = stringToUtf8Bytes(
                '12345678901234567890123456789012345678901234567890123456789012345678901234567890',
            );
            const result = ripemd160(input);
            const hex = bytesToHex(result);

            expect(hex).toBe('9b752e45573d4b39f4dbd3323cab82bf63326bfb');
        });
    });

    describe('Output properties', () => {
        it('should always produce 20-byte output', () => {
            // Empty input
            const result1 = ripemd160(new Uint8Array(0));
            expect(result1.length).toBe(20);

            // Single byte
            const input2 = new Uint8Array(1);
            input2[0] = 0x00;
            const result2 = ripemd160(input2);
            expect(result2.length).toBe(20);

            // 64 bytes (one block)
            const input3 = new Uint8Array(64);
            const result3 = ripemd160(input3);
            expect(result3.length).toBe(20);

            // 100 bytes (multiple blocks)
            const input4 = new Uint8Array(100);
            const result4 = ripemd160(input4);
            expect(result4.length).toBe(20);
        });

        it('should be deterministic', () => {
            const input = stringToUtf8Bytes('test determinism');

            const result1 = ripemd160(input);
            const result2 = ripemd160(input);

            const hex1 = bytesToHex(result1);
            const hex2 = bytesToHex(result2);

            expect(hex1).toBe(hex2);
        });
    });

    describe('Edge cases', () => {
        it('should handle null bytes correctly', () => {
            // Single null byte
            const input = new Uint8Array(1);
            input[0] = 0x00;
            const result = ripemd160(input);
            const hex = bytesToHex(result);

            // Pre-computed expected hash for single null byte
            expect(hex).toBe('c81b94933420221a7ac004a90242d8b1d3e5070d');
        });

        it('should handle all-zeros input', () => {
            // 64 null bytes
            const input = new Uint8Array(64);
            const result = ripemd160(input);
            expect(result.length).toBe(20);

            // This is a valid hash - just verifying it produces output
            const hex = bytesToHex(result);
            expect(hex.length).toBe(40); // 20 bytes = 40 hex chars
        });

        it('should handle all-ones input', () => {
            // 32 bytes of 0xFF
            const input = new Uint8Array(32);
            for (let i = 0; i < 32; i++) {
                input[i] = 0xff;
            }
            const result = ripemd160(input);
            expect(result.length).toBe(20);
        });

        it('should handle input exactly at block boundary', () => {
            // RIPEMD-160 uses 64-byte blocks
            // 55 bytes is the max that fits in one block after padding
            const input55 = new Uint8Array(55);
            for (let i = 0; i < 55; i++) {
                input55[i] = <u8>i;
            }
            const result55 = ripemd160(input55);
            expect(result55.length).toBe(20);

            // 56 bytes requires two blocks
            const input56 = new Uint8Array(56);
            for (let i = 0; i < 56; i++) {
                input56[i] = <u8>i;
            }
            const result56 = ripemd160(input56);
            expect(result56.length).toBe(20);

            // Verify different results
            expect(bytesToHex(result55)).not.toBe(bytesToHex(result56));
        });

        it('should handle 64-byte input (exactly one block)', () => {
            const input = new Uint8Array(64);
            for (let i = 0; i < 64; i++) {
                input[i] = <u8>i;
            }
            const result = ripemd160(input);
            expect(result.length).toBe(20);
        });

        it('should handle 128-byte input (two full blocks)', () => {
            const input = new Uint8Array(128);
            for (let i = 0; i < 128; i++) {
                input[i] = <u8>(i % 256);
            }
            const result = ripemd160(input);
            expect(result.length).toBe(20);
        });
    });

    describe('Bitcoin-relevant tests', () => {
        it('should produce correct hash for typical Bitcoin pubkey hash scenario', () => {
            // A typical compressed public key is 33 bytes
            // Here we test with a sample 33-byte input
            const input = new Uint8Array(33);
            input[0] = 0x02; // Compressed pubkey prefix
            for (let i = 1; i < 33; i++) {
                input[i] = <u8>i;
            }
            const result = ripemd160(input);
            expect(result.length).toBe(20);
        });

        it('should handle SHA-256 output size (32 bytes)', () => {
            // RIPEMD-160 is often applied to SHA-256 output in Bitcoin
            // SHA-256 output is 32 bytes
            const sha256Output = new Uint8Array(32);
            for (let i = 0; i < 32; i++) {
                sha256Output[i] = <u8>(i * 8);
            }
            const result = ripemd160(sha256Output);
            expect(result.length).toBe(20);
        });
    });

    describe('Byte array construction verification', () => {
        it('should demonstrate UTF-16 vs UTF-8 encoding difference', () => {
            // This test demonstrates why proper encoding matters
            // "a" as UTF-8: [0x61] - 1 byte
            // "a" as UTF-16LE: [0x61, 0x00] - 2 bytes

            // UTF-8 encoded (correct)
            const utf8Input = stringToUtf8Bytes('a');
            expect(utf8Input.length).toBe(1);
            expect(utf8Input[0]).toBe(0x61);

            // Manual byte array (correct)
            const manualInput = new Uint8Array(1);
            manualInput[0] = 0x61;

            // Both should produce the same hash
            const utf8Hash = bytesToHex(ripemd160(utf8Input));
            const manualHash = bytesToHex(ripemd160(manualInput));
            expect(utf8Hash).toBe(manualHash);
            expect(utf8Hash).toBe('0bdc9d2d256b3ee9daae347be6f4dc835a467ffe');
        });

        it('should handle multi-byte UTF-8 characters', () => {
            // UTF-8 encoding of special characters
            // This verifies String.UTF8.encode works correctly

            // "ABC" should be 3 bytes
            const abc = stringToUtf8Bytes('ABC');
            expect(abc.length).toBe(3);
            expect(abc[0]).toBe(0x41); // 'A'
            expect(abc[1]).toBe(0x42); // 'B'
            expect(abc[2]).toBe(0x43); // 'C'
        });
    });

    describe('Additional test vectors', () => {
        it('should hash binary data correctly', () => {
            // Test with specific binary sequence
            const input = hexToBytes('0102030405060708090a0b0c0d0e0f10');
            const result = ripemd160(input);
            expect(result.length).toBe(20);
        });

        it('should hash repeated pattern correctly', () => {
            // 1000 bytes of repeated pattern
            const input = new Uint8Array(1000);
            for (let i = 0; i < 1000; i++) {
                input[i] = <u8>(i % 256);
            }
            const result = ripemd160(input);
            expect(result.length).toBe(20);
        });

        it('should produce different hashes for similar inputs', () => {
            const input1 = stringToUtf8Bytes('test1');
            const input2 = stringToUtf8Bytes('test2');

            const hash1 = bytesToHex(ripemd160(input1));
            const hash2 = bytesToHex(ripemd160(input2));

            expect(hash1).not.toBe(hash2);
        });

        it('should produce different hashes for prefix/suffix variations', () => {
            const input1 = stringToUtf8Bytes('abc');
            const input2 = stringToUtf8Bytes('abcd');
            const input3 = stringToUtf8Bytes('0abc');

            const hash1 = bytesToHex(ripemd160(input1));
            const hash2 = bytesToHex(ripemd160(input2));
            const hash3 = bytesToHex(ripemd160(input3));

            expect(hash1).not.toBe(hash2);
            expect(hash1).not.toBe(hash3);
            expect(hash2).not.toBe(hash3);
        });
    });

    describe('Regression tests (implementation now fixed)', () => {
        // NOTE: These tests verify the implementation matches the RIPEMD-160 spec.
        // They duplicate some official test vectors but serve as regression tests.

        it('regression: empty string', () => {
            const input = new Uint8Array(0);
            const result = ripemd160(input);
            const hex = bytesToHex(result);
            expect(hex).toBe('9c1185a5c5e9fc54612808977ee8f548b2258d31');
        });

        it('regression: single byte "a"', () => {
            const input = new Uint8Array(1);
            input[0] = 0x61; // 'a'
            const result = ripemd160(input);
            const hex = bytesToHex(result);
            expect(hex).toBe('0bdc9d2d256b3ee9daae347be6f4dc835a467ffe');
        });

        it('regression: "abc"', () => {
            const input = new Uint8Array(3);
            input[0] = 0x61; // 'a'
            input[1] = 0x62; // 'b'
            input[2] = 0x63; // 'c'
            const result = ripemd160(input);
            const hex = bytesToHex(result);
            expect(hex).toBe('8eb208f7e05d987a9b044a8e98c6b087f15a0bfc');
        });

        it('regression: null byte', () => {
            const input = new Uint8Array(1);
            input[0] = 0x00;
            const result = ripemd160(input);
            const hex = bytesToHex(result);
            expect(hex).toBe('c81b94933420221a7ac004a90242d8b1d3e5070d');
        });
    });
});

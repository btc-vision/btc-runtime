/**
 * Keccak-256 as-pect Test Suite (AssemblyScript)
 *
 * All expected values verified against tiny-keccak v2.0.2 (Rust)
 * https://github.com/debris/tiny-keccak
 *
 * Converted from the TypeScript test suite to pure AssemblyScript as-pect tests.
 */
import { functionSelector, keccak256, keccak256Concat, rot64Hi, rot64Lo, } from '../runtime/hashing/keccak256';

/** Convert a Uint8Array to lowercase hex string for assertion comparisons. */
function toHex(b: Uint8Array): string {
    const hexChars = '0123456789abcdef';
    let result = '';
    for (let i: i32 = 0; i < b.length; i++) {
        const byte = b[i];
        result += hexChars.charAt((byte >>> 4) & 0x0f);
        result += hexChars.charAt(byte & 0x0f);
    }
    return result;
}

/** Build a sequential byte array where each byte equals i & 0xff. */
function mkSeq(n: i32): Uint8Array {
    const a = new Uint8Array(n);
    for (let i: i32 = 0; i < n; i++) {
        a[i] = <u8>(i & 0xff);
    }
    return a;
}

/** Encode a string to UTF-8 bytes via AssemblyScript's String.UTF8.encode. */
function encodeUTF8(s: string): Uint8Array {
    return Uint8Array.wrap(String.UTF8.encode(s));
}

describe('Known Test Vectors (tiny-keccak reference)', () => {
    it('should hash empty string', () => {
        const result = toHex(keccak256(new Uint8Array(0)));
        expect(result).toBe('c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
    });

    it('should hash "hello"', () => {
        const result = toHex(keccak256(encodeUTF8('hello')));
        expect(result).toBe('1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8');
    });

    it('should hash "abc"', () => {
        const result = toHex(keccak256(encodeUTF8('abc')));
        expect(result).toBe('4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
    });

    it('should hash "a"', () => {
        const result = toHex(keccak256(encodeUTF8('a')));
        expect(result).toBe('3ac225168df54212a25c1c01fd35bebfea408fdac2e31ddd6f80a4bbf9a5f1cb');
    });

    it('should hash "testing"', () => {
        const result = toHex(keccak256(encodeUTF8('testing')));
        expect(result).toBe('5f16f4c7f149ac4f9510d9cf8cf384038ad348b3bcdc01915f95de12df9d1b02');
    });

    it('should hash "keccak256"', () => {
        const result = toHex(keccak256(encodeUTF8('keccak256')));
        expect(result).toBe('b7845733ba102a68c6eb21c3cd2feafafd1130de581d7e73be60b76d775b6704');
    });

    it('should hash "OP_NET"', () => {
        const result = toHex(keccak256(encodeUTF8('OP_NET')));
        expect(result).toBe('38c45d151852c6dd61f0cb02555faf0724fa9c0caddaaf94ad0cca53ce2f17b0');
    });

    it('should hash "world"', () => {
        const result = toHex(keccak256(encodeUTF8('world')));
        expect(result).toBe('8452c9b9140222b08593a26daa782707297be9f7b3e8281d7b4974769f19afd0');
    });

    it('should hash "The quick brown fox jumps over the lazy dog"', () => {
        const result = toHex(keccak256(encodeUTF8('The quick brown fox jumps over the lazy dog')));
        expect(result).toBe('4d741b6f1eb29cb2a9b9911c82f56fa8d73b04959d3d9d222895df6c0b28aa15');
    });
});

describe('Ethereum Function Selectors', () => {
    it('should compute transfer(address,uint256) -> 0xa9059cbb', () => {
        const hash = toHex(keccak256(encodeUTF8('transfer(address,uint256)')));
        expect(hash.substring(0, 8)).toBe('a9059cbb');
    });

    it('should compute balanceOf(address) -> 0x70a08231', () => {
        const hash = toHex(keccak256(encodeUTF8('balanceOf(address)')));
        expect(hash.substring(0, 8)).toBe('70a08231');
    });

    it('should compute approve(address,uint256) -> 0x095ea7b3', () => {
        const hash = toHex(keccak256(encodeUTF8('approve(address,uint256)')));
        expect(hash.substring(0, 8)).toBe('095ea7b3');
    });

    it('should compute totalSupply() -> 0x18160ddd', () => {
        const hash = toHex(keccak256(encodeUTF8('totalSupply()')));
        expect(hash.substring(0, 8)).toBe('18160ddd');
    });
});

describe('functionSelector() helper', () => {
    it('should return 4-byte selector for transfer(address,uint256)', () => {
        const sel = functionSelector('transfer(address,uint256)');
        expect(sel.length).toBe(4);
        expect(toHex(sel)).toBe('a9059cbb');
    });

    it('should return 4-byte selector for balanceOf(address)', () => {
        expect(toHex(functionSelector('balanceOf(address)'))).toBe('70a08231');
    });

    it('should return 4-byte selector for approve(address,uint256)', () => {
        expect(toHex(functionSelector('approve(address,uint256)'))).toBe('095ea7b3');
    });

    it('should return 4-byte selector for totalSupply()', () => {
        expect(toHex(functionSelector('totalSupply()'))).toBe('18160ddd');
    });
});

describe('Block Boundary Tests', () => {
    it('should hash exactly 1 block (136 bytes)', () => {
        expect(toHex(keccak256(mkSeq(136)))).toBe(
            '7ce759f1ab7f9ce437719970c26b0a66ff11fe3e38e17df89cf5d29c7d7f807e',
        );
    });

    it('should hash 1 block + 1 byte (137 bytes)', () => {
        expect(toHex(keccak256(mkSeq(137)))).toBe(
            'ac73d4fae68b8453f764007c1a20ce95994187861f0c3227a3a8e99a73a3b1db',
        );
    });

    it('should hash exactly 2 blocks (272 bytes)', () => {
        expect(toHex(keccak256(mkSeq(272)))).toBe(
            'fdf2ec49e749960d3c8521a0219af8d03e30e2b3bf19bd16150ee0eaf133d66e',
        );
    });

    it('should hash 200 bytes (1 full block + 64 byte remainder)', () => {
        expect(toHex(keccak256(mkSeq(200)))).toBe(
            'bfb0aa97863e797943cf7c33bb7e880bb4543f3d2703c0923c6901c2af57b890',
        );
    });

    it('should hash 1000 bytes (7 full blocks + 48 byte remainder)', () => {
        expect(toHex(keccak256(mkSeq(1000)))).toBe(
            'aca79e4146e30eb1c733f6d6060d72471c36ea4e01ebf45d7f4916249c2bbd82',
        );
    });
});

describe('Edge Case Byte Patterns', () => {
    it('should hash 32 zero bytes', () => {
        expect(toHex(keccak256(new Uint8Array(32)))).toBe(
            '290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563',
        );
    });

    it('should hash 64 zero bytes', () => {
        expect(toHex(keccak256(new Uint8Array(64)))).toBe(
            'ad3228b676f7d3cd4284a5443f17f1962b36e491b30a40b2405849e597ba5fb5',
        );
    });

    it('should hash 32 bytes of 0xFF', () => {
        const data = new Uint8Array(32);
        for (let i: i32 = 0; i < 32; i++) data[i] = 0xff;
        expect(toHex(keccak256(data))).toBe(
            'a9c584056064687e149968cbab758a3376d22aedc6a55823d1b3ecbee81b8fb9',
        );
    });

    it('should hash single byte 0x00', () => {
        const data = new Uint8Array(1);
        data[0] = 0x00;
        expect(toHex(keccak256(data))).toBe(
            'bc36789e7a1e281436464229828f817d6612f7b477d66591ff96a9e064bcc98a',
        );
    });

    it('should hash single byte 0xFF', () => {
        const data = new Uint8Array(1);
        data[0] = 0xff;
        expect(toHex(keccak256(data))).toBe(
            '8b1a944cf13a9a1c08facb2c9e98623ef3254d2ddb48113885c3e8e97fec8db9',
        );
    });

    it('should hash single byte 0x80 (padding-adjacent)', () => {
        const data = new Uint8Array(1);
        data[0] = 0x80;
        expect(toHex(keccak256(data))).toBe(
            '56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421',
        );
    });
});

describe('Memory Safety', () => {
    it('should produce identical output across 1000 repeated calls', () => {
        const input = encodeUTF8('hello');
        const expected = '1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8';
        for (let i: i32 = 0; i < 1000; i++) {
            const h = toHex(keccak256(input));
            expect(h).toBe(expected);
        }
    });

    it('should avoid cross-contamination across 500 alternating inputs', () => {
        const inA = encodeUTF8('hello');
        const inB = encodeUTF8('world');
        const expA = '1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8';
        const expB = '8452c9b9140222b08593a26daa782707297be9f7b3e8281d7b4974769f19afd0';
        for (let i: i32 = 0; i < 500; i++) {
            expect(toHex(keccak256(inA))).toBe(expA);
            expect(toHex(keccak256(inB))).toBe(expB);
        }
    });

    it('should produce deterministic results for a 1000-deep hash chain', () => {
        let c1 = keccak256(encodeUTF8('seed'));
        for (let i: i32 = 0; i < 1000; i++) c1 = keccak256(c1);

        let c2 = keccak256(encodeUTF8('seed'));
        for (let i: i32 = 0; i < 1000; i++) c2 = keccak256(c2);

        expect(toHex(c1)).toBe(toHex(c2));
    });

    it('should be consistent on double-hash for sizes 0 through 300', () => {
        for (let size: i32 = 0; size <= 300; size++) {
            const data = new Uint8Array(size);
            for (let i: i32 = 0; i < size; i++) {
                data[i] = <u8>((i * 7 + size) & 0xff);
            }
            expect(toHex(keccak256(data))).toBe(toHex(keccak256(data)));
        }
    });

    it('should not corrupt output when input is mutated after hashing', () => {
        const data = new Uint8Array(5);
        data[0] = 1;
        data[1] = 2;
        data[2] = 3;
        data[3] = 4;
        data[4] = 5;
        const h1 = toHex(keccak256(data));

        data[0] = 99;

        const pristine = new Uint8Array(5);
        pristine[0] = 1;
        pristine[1] = 2;
        pristine[2] = 3;
        pristine[3] = 4;
        pristine[4] = 5;
        const h2 = toHex(keccak256(pristine));

        expect(h1).toBe(h2);
    });
});

describe('Keccak vs SHA-3 Verification', () => {
    it('should NOT produce the SHA-3-256 empty-string output', () => {
        const sha3Empty = 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a';
        const keccakEmpty = toHex(keccak256(new Uint8Array(0)));
        expect(keccakEmpty).not.toBe(sha3Empty);
        expect(keccakEmpty).toBe(
            'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
        );
    });
});

describe('keccak256Concat', () => {
    it('should produce the same result as manually concatenating then hashing', () => {
        const a = encodeUTF8('hello');
        const b = encodeUTF8('world');
        const combined = new Uint8Array(a.length + b.length);
        combined.set(a, 0);
        combined.set(b, a.length);

        expect(toHex(keccak256Concat(a, b))).toBe(toHex(keccak256(combined)));
    });

    it('should handle empty first argument', () => {
        const empty = new Uint8Array(0);
        const data = encodeUTF8('hello');
        expect(toHex(keccak256Concat(empty, data))).toBe(toHex(keccak256(data)));
    });

    it('should handle empty second argument', () => {
        const data = encodeUTF8('hello');
        const empty = new Uint8Array(0);
        expect(toHex(keccak256Concat(data, empty))).toBe(toHex(keccak256(data)));
    });

    it('should handle both arguments empty', () => {
        const empty = new Uint8Array(0);
        expect(toHex(keccak256Concat(empty, empty))).toBe(toHex(keccak256(new Uint8Array(0))));
    });
});

describe('rot64Lo direct branch coverage', () => {
    // Use a recognizable 64-bit value split into lo=0xDEADBEEF, hi=0xCAFEBABE.
    // The full 64-bit word is 0xCAFEBABE_DEADBEEF in big-endian notation.
    const lo: u32 = 0xdeadbeef;
    const hi: u32 = 0xcafebabe;

    it('should return lo unchanged when n == 0', () => {
        expect(rot64Lo(lo, hi, 0)).toBe(lo);
    });

    it('should return hi when n == 32', () => {
        expect(rot64Lo(lo, hi, 32)).toBe(hi);
    });

    it('should rotate correctly when n < 32 (n == 1)', () => {
        // (lo << 1) | (hi >>> 31)
        const expected: u32 = (lo << 1) | (hi >>> 31);
        expect(rot64Lo(lo, hi, 1)).toBe(expected);
    });

    it('should rotate correctly when n < 32 (n == 16)', () => {
        const expected: u32 = (lo << 16) | (hi >>> 16);
        expect(rot64Lo(lo, hi, 16)).toBe(expected);
    });

    it('should rotate correctly when n > 32 (n == 33)', () => {
        // (hi << (n-32)) | (lo >>> (64-n))
        const expected: u32 = (hi << 1) | (lo >>> 31);
        expect(rot64Lo(lo, hi, 33)).toBe(expected);
    });

    it('should rotate correctly when n > 32 (n == 48)', () => {
        const expected: u32 = (hi << 16) | (lo >>> 16);
        expect(rot64Lo(lo, hi, 48)).toBe(expected);
    });

    it('should rotate correctly at n == 63', () => {
        const expected: u32 = (hi << 31) | (lo >>> 1);
        expect(rot64Lo(lo, hi, 63)).toBe(expected);
    });
});

describe('rot64Hi direct branch coverage', () => {
    const lo: u32 = 0xdeadbeef;
    const hi: u32 = 0xcafebabe;

    it('should return hi unchanged when n == 0', () => {
        expect(rot64Hi(lo, hi, 0)).toBe(hi);
    });

    it('should return lo when n == 32', () => {
        expect(rot64Hi(lo, hi, 32)).toBe(lo);
    });

    it('should rotate correctly when n < 32 (n == 1)', () => {
        // (hi << 1) | (lo >>> 31)
        const expected: u32 = (hi << 1) | (lo >>> 31);
        expect(rot64Hi(lo, hi, 1)).toBe(expected);
    });

    it('should rotate correctly when n < 32 (n == 16)', () => {
        const expected: u32 = (hi << 16) | (lo >>> 16);
        expect(rot64Hi(lo, hi, 16)).toBe(expected);
    });

    it('should rotate correctly when n > 32 (n == 33)', () => {
        // (lo << (n-32)) | (hi >>> (64-n))
        const expected: u32 = (lo << 1) | (hi >>> 31);
        expect(rot64Hi(lo, hi, 33)).toBe(expected);
    });

    it('should rotate correctly when n > 32 (n == 48)', () => {
        const expected: u32 = (lo << 16) | (hi >>> 16);
        expect(rot64Hi(lo, hi, 48)).toBe(expected);
    });

    it('should rotate correctly at n == 63', () => {
        const expected: u32 = (lo << 31) | (hi >>> 1);
        expect(rot64Hi(lo, hi, 63)).toBe(expected);
    });
});

describe('rot64 roundtrip identity', () => {
    it('should satisfy rot64(rot64(x, n), 64-n) == x for all n in 0..63', () => {
        const lo: u32 = 0x12345678;
        const hi: u32 = 0x9abcdef0;
        for (let n: i32 = 0; n < 64; n++) {
            const midLo = rot64Lo(lo, hi, n);
            const midHi = rot64Hi(lo, hi, n);
            const backLo = rot64Lo(midLo, midHi, (64 - n) % 64);
            const backHi = rot64Hi(midLo, midHi, (64 - n) % 64);
            expect(backLo).toBe(lo);
            expect(backHi).toBe(hi);
        }
    });
});

export function cyrb53(str: string, seed: i32 = 0): i64 {
    let h1: i32 = 0xdeadbeef ^ seed;
    let h2: i32 = 0x41c6ce57 ^ seed;
    for (let i: i32 = 0; i < str.length; i++) {
        let ch: i32 = str.charCodeAt(i);
        h1 = (h1 ^ ch) * 2654435761;
        h2 = (h2 ^ ch) * 1597334677;
    }
    
    h1 = ((h1 ^ (h1 >>> 16)) * 2246822507) ^ ((h2 ^ (h2 >>> 13)) * 3266489909);
    h2 = ((h2 ^ (h2 >>> 16)) * 2246822507) ^ ((h1 ^ (h1 >>> 13)) * 3266489909);

    return 4294967296.0 * i64((2097151 & h2) >>> 0) + i64(h1 >>> 0);
}

export function imul64(a: u64, b: u64): u64 {
    const aLow: u64 = a & 0xFFFFFFFF;
    const aHigh: u64 = a >> 32;
    const bLow: u64 = b & 0xFFFFFFFF;
    const bHigh: u64 = b >> 32;

    const low: u64 = aLow * bLow;
    const middle1: u64 = (aHigh * bLow) << 32;
    const middle2: u64 = (aLow * bHigh) << 32;
    const high: u64 = (aHigh * bHigh) << 64;

    return low + middle1 + middle2 + high;
}

export function cyrb53a(str: u8[], seed: i32 = 0): u64 {
    let h1: u64 = u64(0xdeadbeef ^ seed);
    let h2: u64 = u64(0x41c6ce57 ^ seed);

    for (let i: i32 = 0; i < str.length; i++) {
        let ch: u64 = u64(str[i]);
        h1 = imul64(h1 ^ ch, 0x85ebca77);
        h2 = imul64(h2 ^ ch, 0xc2b2ae3d);
    }

    h1 ^= imul64(h1 ^ (h2 >> 15), 0x735a2d97);
    h2 ^= imul64(h2 ^ (h1 >> 15), 0xcaf649a9);
    h1 ^= h2 >> 16;
    h2 ^= h1 >> 16;

    return (2097152 * (h2 & 0xFFFFFFFFFFFFFFFF) + (h1 >> 11)) & 0xFFFFFFFFFFFFFFFF;
}

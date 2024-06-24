let random_state0_64: u64;
let random_state1_64: u64;
let random_state0_32: u32;
let random_state1_32: u32;
let random_seeded = false;

function murmurHash3(h: u64): u64 { // Force all bits of a hash block to avalanche
    h ^= h >> 33;                     // see: https://github.com/aappleby/smhasher
    h *= 0xFF51AFD7ED558CCD;
    h ^= h >> 33;
    h *= 0xC4CEB9FE1A85EC53;
    h ^= h >> 33;
    return h;
}

function splitMix32(h: u32): u32 {
    h += 0x6D2B79F5;
    h = (h ^ (h >> 15)) * (h | 1);
    h ^= h + (h ^ (h >> 7)) * (h | 61);
    return h ^ (h >> 14);
}

function seedRandom(value: i64): void {
    // Instead zero seed use golden ratio:
    // phi = (1 + sqrt(5)) / 2
    // trunc(2^64 / phi) = 0x9e3779b97f4a7c15
    if (value == 0) value = 0x9e3779b97f4a7c15;
    random_state0_64 = murmurHash3(value);
    random_state1_64 = murmurHash3(~random_state0_64);
    random_state0_32 = splitMix32(<u32>value);
    random_state1_32 = splitMix32(random_state0_32);
    random_seeded = true;
}

export function randomU64(): u64 { // see: v8/src/base/utils/random-number-generator.cc
    if (!random_seeded) seedRandom(reinterpret<i64>(0)); // TODO: for now, the seed is always 0.
    let s1 = random_state0_64;
    let s0 = random_state1_64;
    random_state0_64 = s0;
    s1 ^= s1 << 23;
    s1 ^= s1 >> 17;
    s1 ^= s0;
    s1 ^= s0 >> 26;
    random_state1_64 = s1;
    return s0;
}

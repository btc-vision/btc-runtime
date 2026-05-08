let _cachedDeadAddress: usize = 0;
let _cachedZeroAddress: usize = 0;

export function getCachedDeadAddress(): usize {
    return _cachedDeadAddress;
}

export function setCachedDeadAddress(addr: usize): void {
    _cachedDeadAddress = addr;
}

export function getCachedZeroAddress(): usize {
    return _cachedZeroAddress;
}

export function setCachedZeroAddress(addr: usize): void {
    _cachedZeroAddress = addr;
}

export const DEAD_ARRAY: u8[] = [
    40, 74, 228, 172, 219, 50, 169, 155, 163, 235, 250, 102, 169, 29, 219, 65, 167, 183, 161, 210,
    254, 244, 21, 57, 153, 34, 205, 138, 4, 72, 92, 2,
];

export const ZERO_ARRAY: u8[] = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

/**
 * Cache storage for ExtendedAddress static methods.
 * Declared in a separate file to avoid forward reference issues in AssemblyScript.
 * Uses getter/setter functions because imported let bindings are read-only.
 */
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

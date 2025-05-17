// @ts-ignore
@external('env', '__atomic_wait32')
declare function __atomic_wait32(addr: i32, expected: i32, timeout: i64, proof: ArrayBuffer, verifier: ArrayBuffer): i32;

// @ts-ignore
@external('env', '__atomic_wait64')
declare function __atomic_wait64(addr: i32, expected: i64, timeout: i64, proof: ArrayBuffer, verifier: ArrayBuffer): i32;

// @ts-ignore
@external('env', '__atomic_notify')
declare function __atomic_notify(addr: i32, count: i32): i32;

// @ts-ignore
@external('env', '__thread_spawn')
declare function __thread_spawn(): i32;

export namespace Atomics {
    export const OK: i32 = 0;
    export const TIMED_OUT: i32 = 1;
    export const NOT_EQUAL: i32 = 2;
    export const NOT_AUTHORIZED: i32 = 3;
    export const FAULT: i32 = -1;

    /** Waits on `addr` until its value != `expected` or timeout (ns). */
    export function wait32(addr: usize, expected: i32, timeoutNs: i64, proof: Uint8Array, verifier: Uint8Array): i32 {
        WARNING('EXPERIMENTAL: wait32 is not yet stable and may change in the future. This feature is not available in production.');

        return __atomic_wait32(<i32>addr, expected, timeoutNs, proof.buffer, verifier.buffer);
    }

    /** Waits on `addr` until its value != `expected` or timeout (ns). */
    export function wait64(addr: usize, expected: i64, timeoutNs: i64, proof: Uint8Array, verifier: Uint8Array): i32 {
        WARNING('EXPERIMENTAL: wait64 is not yet stable and may change in the future. This feature is not available in production.');

        return __atomic_wait64(<i32>addr, expected, timeoutNs, proof.buffer, verifier.buffer);
    }

    /** Wakes up at most `count` waiters. */
    export function notify(addr: usize, count: i32 = 1): i32 {
        WARNING('EXPERIMENTAL: notify is not yet stable and may change in the future. This feature is not available in production.');

        return __atomic_notify(<i32>addr, count);
    }

    /** Spawns a helper thread. */
    export function spawn(): i32 {
        WARNING('EXPERIMENTAL: spawn is not yet stable and may change in the future. This feature is not available in production.');

        return __thread_spawn();
    }
}

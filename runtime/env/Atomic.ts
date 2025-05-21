export namespace Atomics {
    export const OK: i32 = 0;
    export const TIMED_OUT: i32 = 1;
    export const NOT_EQUAL: i32 = 2;
    export const NOT_AUTHORIZED: i32 = 3;
    export const FAULT: i32 = -1;

    /** Waits on `addr` until its value != `expected` or timeout (ns). */
    export function wait32(
        addr: usize,
        expected: i32,
        timeoutNs: i64,
        proof: Uint8Array,
        verifier: Uint8Array,
    ): i32 {
        WARNING(
            'EXPERIMENTAL: wait32 is not yet stable and may change in the future. This feature is not available in production.',
        );

        throw new Error('wait32 is not implemented yet.');
    }

    /** Waits on `addr` until its value != `expected` or timeout (ns). */
    export function wait64(
        addr: usize,
        expected: i64,
        timeoutNs: i64,
        proof: Uint8Array,
        verifier: Uint8Array,
    ): i32 {
        WARNING(
            'EXPERIMENTAL: wait64 is not yet stable and may change in the future. This feature is not available in production.',
        );

        throw new Error('wait64 is not implemented yet.');
    }

    /** Wakes up at most `count` waiters. */
    export function notify(addr: usize, count: i32 = 1): i32 {
        WARNING(
            'EXPERIMENTAL: notify is not yet stable and may change in the future. This feature is not available in production.',
        );

        throw new Error('notify is not implemented yet.');
    }

    /** Spawns a helper thread. */
    export function spawn(): i32 {
        WARNING(
            'EXPERIMENTAL: spawn is not yet stable and may change in the future. This feature is not available in production.',
        );

        throw new Error('spawn is not implemented yet.');
    }
}

import { Blockchain } from '../env';
import { Potential } from '../lang/Definitions';
import { bigEndianAdd } from '../math/bytes';
import { Plugin } from '../plugins/Plugin';

/**
 * A unique key in storage that holds the next free "offset" as a 256-bit counter.
 * You can change this to any 32-byte constant you like.
 */
const ALLOCATOR_KEY = new Uint8Array(32);
for (let i = 0; i < 32; i++) {
    ALLOCATOR_KEY[i] = 0xff;
}

/**
 * PointerManager: ensures we never collide while allocating variable-length data.
 * - We store a global "offset" in ALLOCATOR_KEY (as a big-endian u256).
 * - Each time we allocate N slots (N * 32 bytes), we do:
 *      oldOffset = currentGlobalOffset
 *      newOffset = oldOffset + N
 *      store newOffset back
 *      return oldOffset as the base pointer
 */
class _PointerManager extends Plugin {
    private _cachedOffset: Potential<Uint8Array> = null;

    private get cachedOffset(): Uint8Array {
        if (!this._cachedOffset) {
            this._cachedOffset = Blockchain.getStorageAt(ALLOCATOR_KEY);
        }

        return this._cachedOffset as Uint8Array;
    }

    /**
     * Allocates `numSlots` (each 32 bytes). Returns a 32-byte pointer (u256 in big-endian).
     *
     * Each slot is conceptually:
     *   slot0 = pointer + 0
     *   slot1 = pointer + 1
     *   ...
     * and so forth in big-endian arithmetic.
     */
    public allocateSlots(numSlots: u64): Uint8Array {
        this._cachedOffset = bigEndianAdd(this.cachedOffset, numSlots);

        const val = this.cachedOffset;
        Blockchain.setStorageAt(ALLOCATOR_KEY, val);

        return val;
    }
}

export const PointerManager = new _PointerManager();
Blockchain.registerPlugin(PointerManager);
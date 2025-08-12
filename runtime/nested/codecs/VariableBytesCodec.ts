import { ICodec } from '../interfaces/ICodec';
import { PointerManager } from '../PointerManager';
import { Blockchain } from '../../env';
import { bigEndianAdd } from '../../math/bytes';

/**
 * A generic codec to store an arbitrary-length byte array ("payload") in chunked 32-byte slots.
 * Layout:
 *    - chunk 0 (pointer+0):
 *         first 4 bytes = length (u32 big-endian),
 *         next 28 bytes = partial data
 *    - chunk i>0 (pointer + i): 32 bytes of subsequent data
 */
export class IVariableBytesCodec implements ICodec<Uint8Array> {
    public encode(value: Uint8Array): Uint8Array {
        const length = value.length;

        // Number of bytes that fit in "the first chunk" = 28 (since 4 bytes used by length)
        const firstChunkDataLen = length < 28 ? length : 28;
        let remaining = length - firstChunkDataLen;

        // If remaining > 0, each chunk is 32 bytes.
        // So total chunks needed = 1 (for first chunk) + ceil(remaining / 32).
        const additionalChunks: u32 = remaining == 0 ? 0 : (remaining + 32 - 1) / 32;
        const totalChunks: u32 = 1 + additionalChunks;

        // 1) Allocate `totalChunks` from PointerManager
        const pointerBytes = PointerManager.allocateSlots(totalChunks);

        // 2) Write chunk 0: length + up to 28 bytes
        const chunk0 = new Uint8Array(32);

        // store length in big-endian (4 bytes)
        chunk0[0] = <u8>((length >> 24) & 0xff);
        chunk0[1] = <u8>((length >> 16) & 0xff);
        chunk0[2] = <u8>((length >> 8) & 0xff);
        chunk0[3] = <u8>(length & 0xff);

        for (let i = 0; i < firstChunkDataLen; i++) {
            chunk0[4 + i] = value[i];
        }

        // store chunk0
        Blockchain.setStorageAt(pointerBytes, chunk0);

        // 3) Write subsequent chunks
        let offset: u32 = firstChunkDataLen;
        for (let i: u64 = 1; i < u64(totalChunks); i++) {
            const chunk = new Uint8Array(32);
            const chunkSize: u32 = remaining < 32 ? remaining : 32;

            for (let j: u32 = 0; j < chunkSize; j++) {
                chunk[j] = value[offset + j];
            }

            offset += chunkSize;
            remaining -= chunkSize;

            // compute pointer + i in big-endian
            const chunkPointer = bigEndianAdd(pointerBytes, i);
            Blockchain.setStorageAt(chunkPointer, chunk);
        }

        // 4) Return the pointer as the "encoded" data (32 bytes).
        return pointerBytes;
    }

    public decode(buffer: Uint8Array): Uint8Array {
        // If buffer is 0 or all zero => means no data
        if (buffer.length == 0 || isAllZero(buffer)) {
            return new Uint8Array(0);
        }

        const pointer = buffer; // the pointer (32 bytes)

        // chunk0
        const chunk0 = Blockchain.getStorageAt(pointer);
        if (chunk0.length == 0) {
            // No data stored => empty
            return new Uint8Array(32);
        }

        // read length from first 4 bytes
        const b0 = <u32>chunk0[0];
        const b1 = <u32>chunk0[1];
        const b2 = <u32>chunk0[2];
        const b3 = <u32>chunk0[3];
        const length = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;

        if (length == 0) {
            return new Uint8Array(0);
        }

        // read the data
        const out = new Uint8Array(length);
        const firstChunkLen = length < 28 ? length : 28;

        // copy from chunk0
        for (let i: u32 = 0; i < firstChunkLen; i++) {
            out[i] = chunk0[4 + i];
        }

        let offset = firstChunkLen;
        let remaining = length - firstChunkLen;

        // read subsequent chunks
        let chunkIndex: u64 = 1;
        while (remaining > 0) {
            const chunkPointer = bigEndianAdd(pointer, chunkIndex);
            const chunkData = Blockchain.getStorageAt(chunkPointer);
            const chunkSize: u32 = remaining < 32 ? remaining : 32;

            for (let j: u32 = 0; j < chunkSize; j++) {
                out[offset + j] = chunkData[j];
            }

            offset += chunkSize;
            remaining -= chunkSize;
            chunkIndex++;
        }

        return out;
    }
}

function isAllZero(arr: Uint8Array): bool {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] != 0) return false;
    }
    return true;
}

export const idOfVariableBytes = idof<IVariableBytesCodec>();
export const VariableBytesCodec = new IVariableBytesCodec();

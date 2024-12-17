import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesReader } from '../buffer/BytesReader';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { Revert } from '../types/Revert';
import { UINT256_BYTE_LENGTH } from '../utils/lengths';

// Similar to a struct in Solidity. (Use in worst case scenario, consume a lot of gas)
export abstract class Serializable {
    protected pointer: u16;
    protected subPointer: MemorySlotPointer;

    protected constructor(pointer: u16, subPointer: MemorySlotPointer) {
        this.pointer = pointer;
        this.subPointer = subPointer;
    }

    // Max of 8160 bytes
    public abstract get chunkCount(): u8;

    public abstract writeToBuffer(): BytesWriter;

    public abstract readFromBuffer(reader: BytesReader): void;

    public abstract exists(chunk: u256, index: u8): boolean;

    public load(): boolean {
        const chunks: u256[] = [];

        for (let index: u8 = 0; index < this.chunkCount; index++) {
            const pointer = this.getPointer(this.subPointer, index);
            const chunk: u256 = Blockchain.getStorageAt(pointer, u256.Zero);

            if (!this.exists(chunk, index)) {
                return false;
            }

            chunks.push(chunk);
        }

        const reader = this.chunksToBytes(chunks);
        this.readFromBuffer(reader);

        return true;
    }

    public save(): void {
        const writer: BytesWriter = this.writeToBuffer();
        const buffer = writer.getBuffer();
        const chunks: u256[] = this.bytesToChunks(buffer);

        if (chunks.length !== this.chunkCount) {
            throw new Revert(
                'Invalid chunk count, expected ' +
                    this.chunkCount.toString() +
                    ' but got ' +
                    chunks.length.toString(),
            );
        }

        for (let index: u8 = 0; index < u8(chunks.length); index++) {
            Blockchain.setStorageAt(this.getPointer(this.subPointer, index), chunks[index]);
        }
    }

    protected bytesToChunks(buffer: Uint8Array): u256[] {
        const chunks: u256[] = [];

        for (let index: i32 = 0; index < buffer.byteLength; index += 32) {
            if (chunks.length === 255) {
                throw new Revert('Too many chunks to save');
            }

            const chunk = buffer.slice(index, index + 32);
            chunks.push(u256.fromBytes(chunk, true));
        }

        return chunks;
    }

    protected chunksToBytes(chunks: u256[]): BytesReader {
        if (this.chunkCount >= u8(255)) {
            //67108863
            throw new Revert('Too many chunks received');
        }

        const buffer: Uint8Array = new Uint8Array(this.chunkCount * 32);
        let offset: i32 = 0;

        for (let indexChunk: i32 = 0; indexChunk < chunks.length; indexChunk++) {
            const bytes: u8[] = chunks[indexChunk].toBytes(true);
            for (let indexByte: i32 = 0; indexByte < bytes.length; indexByte++) {
                buffer[offset++] = bytes[indexByte];
            }
        }

        return new BytesReader(buffer);
    }

    protected getPointer(subPointer: u256, index: u8): u256 {
        const writer = new BytesWriter(UINT256_BYTE_LENGTH);
        writer.writeU256(subPointer);

        // Discard the first byte for offset.
        writer.writeU8At(index, 0);

        return encodePointer(this.pointer, writer.getBuffer());
    }
}

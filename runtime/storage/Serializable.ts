import { BytesReader } from '../buffer/BytesReader';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { Revert } from '../types/Revert';
import { GET_EMPTY_BUFFER } from '../math/bytes';

export const SERIALIZED_POINTER_LENGTH: u8 = 29;

// Similar to a struct in Solidity. (Use in worst case scenario, consume a lot of gas)
export abstract class Serializable {
    protected pointer: u16;
    protected subPointer: Uint8Array;

    protected constructor(pointer: u16, subPointer: Uint8Array) {
        if (subPointer.length !== SERIALIZED_POINTER_LENGTH) throw new Revert(`Sub pointer length must be ${SERIALIZED_POINTER_LENGTH} bytes.`);

        this.pointer = pointer;
        this.subPointer = subPointer;
    }

    // Max of 8160 bytes
    public abstract get chunkCount(): u8;

    public abstract writeToBuffer(): BytesWriter;

    public abstract readFromBuffer(reader: BytesReader): void;

    public abstract exists(chunk: Uint8Array, index: u8): boolean;

    public load(): boolean {
        const chunks: Uint8Array[] = [];

        for (let index: u8 = 0; index < this.chunkCount; index++) {
            const pointer = this.getPointer(this.subPointer, index);
            const chunk: Uint8Array = Blockchain.getStorageAt(pointer, GET_EMPTY_BUFFER());

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
        const chunks: Uint8Array[] = this.bytesToChunks(buffer);

        if (chunks.length !== this.chunkCount) {
            throw new Revert(
                'Invalid chunk count, expected ' +
                this.chunkCount.toString() +
                ' but got ' +
                chunks.length.toString(),
            );
        }

        if (chunks.length > 255) {
            throw new Revert('Too many chunks to save. You may only write up to 8160 bytes per object.');
        }

        for (let index: u8 = 0; index < u8(chunks.length); index++) {
            Blockchain.setStorageAt(this.getPointer(this.subPointer, index), chunks[index]);
        }
    }

    protected bytesToChunks(buffer: Uint8Array): Uint8Array[] {
        const chunks: Uint8Array[] = [];

        for (let index: i32 = 0; index < buffer.byteLength; index += 32) {
            if (chunks.length === 256) {
                throw new Revert(`Too many chunks to save You may only write up to 8160 bytes per object.`);
            }

            const chunk = buffer.slice(index, index + 32);
            chunks.push(chunk);
        }

        return chunks;
    }

    protected chunksToBytes(chunks: Uint8Array[]): BytesReader {
        if (this.chunkCount > u8(255)) {
            throw new Revert(`Too many chunks received. You may only write up to 8160 bytes per object.`);
        }

        const buffer: Uint8Array = new Uint8Array(i32(this.chunkCount) * i32(32));
        let offset: i32 = 0;

        for (let indexChunk: i32 = 0; indexChunk < chunks.length; indexChunk++) {
            const bytes: Uint8Array = chunks[indexChunk];
            for (let indexByte: i32 = 0; indexByte < bytes.length; indexByte++) {
                buffer[offset++] = bytes[indexByte];
            }
        }

        return new BytesReader(buffer);
    }

    protected getPointer(subPointer: Uint8Array, index: u8): Uint8Array {
        const writer = new BytesWriter(30);
        writer.writeU8(index);
        writer.writeBytes(subPointer);

        return encodePointer(this.pointer, writer.getBuffer());
    }
}

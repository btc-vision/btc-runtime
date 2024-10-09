import { u256 } from 'as-bignum/assembly';
import { Blockchain } from '../env';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { BytesWriter } from '../buffer/BytesWriter';
import { BytesReader } from '../buffer/BytesReader';
import { Revert } from '../types/Revert';
import { encodePointer } from '../math/abi';

export abstract class Serializable {
    protected pointer: u16;
    protected subPointer: MemorySlotPointer;

    protected constructor(pointer: u16, subPointer: MemorySlotPointer) {
        this.pointer = pointer;
        this.subPointer = subPointer;
    }

    public abstract get chunkCount(): i32;

    public abstract writeToBuffer(): BytesWriter;

    public abstract readFromBuffer(reader: BytesReader): void;

    public load(): void {
        const chunks: u256[] = [];

        for (let index: i32 = 0; index < this.chunkCount; index++) {
            const pointer = this.getPointer(u256.add(this.subPointer, u256.fromU32(index)));
            const chunk: u256 = Blockchain.getStorageAt(pointer, u256.Zero);
            chunks.push(chunk);
        }

        const reader = this.chunksToBytes(chunks);

        this.readFromBuffer(reader);
    }

    public save(): void {
        const writer: BytesWriter = this.writeToBuffer();

        const buffer = writer.getBuffer();

        const chunks: u256[] = this.bytesToChunks(buffer);

        for (let index: i32 = 0; index < chunks.length; index++) {
            Blockchain.setStorageAt(
                this.getPointer(u256.add(this.subPointer, u256.fromU32(index))),
                chunks[index],
            );
        }
    }

    protected bytesToChunks(buffer: Uint8Array): u256[] {
        const chunks: u256[] = [];

        for (let index: i32 = 0; index < buffer.byteLength; index += 32) {
            const chunk = buffer.slice(index, index + 32);
            chunks.push(u256.fromBytes(chunk, true));
        }

        return chunks;
    }

    protected chunksToBytes(chunks: u256[]): BytesReader {
        if (this.chunkCount >= 67108863) {
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

    private getPointer(subPointer: u256): u256 {
        const writer = new BytesWriter(34);
        writer.writeU16(this.pointer);
        writer.writeU256(subPointer);

        return encodePointer(writer.getBuffer());
    }
}

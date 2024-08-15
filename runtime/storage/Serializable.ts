import { u256 } from 'as-bignum/assembly';
import { Blockchain } from '../env';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { BytesWriter } from '../buffer/BytesWriter';
import { BytesReader } from '../buffer/BytesReader';

export abstract class Serializable {
    protected pointer: u16;
    protected subPointer:MemorySlotPointer;

    protected constructor(pointer: u16,
                          subPointer:MemorySlotPointer) {
        this.pointer = pointer;
        this.subPointer = subPointer;
    }

    public abstract get chunkCount(): i32;
    public abstract get length(): i32;
    public abstract writeToBuffer(): BytesWriter;
    public abstract readFromBuffer(reader: BytesReader): void;

    public load() :void {
        const chunks: u256[] = [];

        Blockchain.log(this.chunkCount.toString());

        for(let index:i32 = 0; index < this.chunkCount; index++){
            Blockchain.log(this.pointer.toString());
            Blockchain.log(this.subPointer.toString());
            Blockchain.log(index.toString());
            const chunk: u256 = Blockchain.getStorageAt(this.pointer, u256.add(this.subPointer, u256.fromU32(index)), u256.Zero);
            chunks.push(chunk);
        }

        Blockchain.log('out loop');

        const reader = this.chunksToBytes(chunks);

        Blockchain.log('out chunks');

        this.readFromBuffer(reader);
    }

    public save(): void {
        const writer: BytesWriter = this.writeToBuffer();

        const buffer = writer.getBuffer();

        const chunks: u256[] = this.bytesToChunks(buffer);

        for (let index: i32 = 0; index < chunks.length; index++) {
            Blockchain.setStorageAt(
                this.pointer,
                u256.add(this.subPointer, u256.fromU32(index)),
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
        const buffer: Uint8Array = new Uint8Array(this.length);
        let offset: i32 = 0;

        for (let indexChunk: i32 = 0; indexChunk < chunks.length; indexChunk++) {
            const bytes: u8[] = chunks[indexChunk].toBytes(true);
            for (let indexByte: i32 = 0; indexByte < bytes.length; indexByte++) {
                buffer[offset++] = bytes[indexByte];
            }
        }

        return new BytesReader(buffer);
    }
}

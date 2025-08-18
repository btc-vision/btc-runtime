import { BytesWriter } from '../buffer/BytesWriter';
import { Revert } from '../types/Revert';

export const MAX_EVENT_DATA_SIZE: u32 = 352; // 352 bytes max per event.

export abstract class NetEvent {
    private readonly buffer: Uint8Array;

    protected constructor(
        public readonly eventType: string,
        protected data: BytesWriter,
    ) {
        if (data.bufferLength() > MAX_EVENT_DATA_SIZE) {
            throw new Revert('Event data length exceeds maximum length.');
        }

        this.buffer = data.getBuffer();
    }

    public get length(): u32 {
        if (!this.buffer) {
            throw new Revert('Buffer is not defined');
        }

        return this.buffer.byteLength;
    }

    public getEventData(): Uint8Array {
        if (!this.buffer) {
            throw new Revert('Buffer is not defined');
        }

        return this.buffer;
    }
}

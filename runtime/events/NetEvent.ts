import { BytesWriter } from '../buffer/BytesWriter';

export const MAX_EVENT_DATA_SIZE: u32 = 352; // 352 bytes max per event.
export const MAX_EVENTS: u16 = 1000; // 1000 events max per transactions.

export abstract class NetEvent {
    protected constructor(
        public readonly eventType: string,
        protected data: BytesWriter,
    ) {}

    public get length(): u32 {
        return this.data.bufferLength();
    }

    public getEventData(): Uint8Array {
        if (this.data.bufferLength() > MAX_EVENT_DATA_SIZE) {
            throw new Error('Event data length exceeds maximum length.');
        }

        return this.data.getBuffer();
    }
}

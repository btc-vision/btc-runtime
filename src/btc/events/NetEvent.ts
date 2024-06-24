import { BytesWriter } from '../buffer/BytesWriter';

export const MAX_EVENT_DATA_SIZE: u32 = 256; // 256 bytes max per event.
export const MAX_EVENTS: u8 = 8; // 8 events max per transactions.

export abstract class NetEvent {
    protected constructor(public readonly eventType: string, protected data: BytesWriter) {
    }

    public get length(): u32 {
        return this.data.bufferLength();
    }

    public getEventDataSelector(): u64 {
        return this.data.getSelectorDataType();
    }

    public getEventData(): Uint8Array {
        if (this.data.bufferLength() > MAX_EVENT_DATA_SIZE) {
            throw new Error('Event data length exceeds maximum length.');
        }

        return this.data.getBuffer();
    }
}

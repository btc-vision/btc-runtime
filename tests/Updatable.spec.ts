/**
 * Test Suite: Updatable Contract and Events
 *
 * This test suite validates the Updatable contract events and their data encoding.
 *
 * Expected Behaviors:
 * - UpdateSubmittedEvent correctly encodes source address and block numbers
 * - UpdateAppliedEvent correctly encodes source address and applied block
 * - UpdateCancelledEvent correctly encodes source address and cancelled block
 * - All events have correct event type names
 * - Event data lengths are within limits
 */

import {
    UpdateSubmittedEvent,
    UpdateAppliedEvent,
    UpdateCancelledEvent,
} from '../runtime/events/updatable/UpdatableEvents';
import { Address } from '../runtime/types/Address';
import { ADDRESS_BYTE_LENGTH } from '../runtime/utils';

/**
 * Helper function to create an Address with all zeros
 */
function createZeroAddress(): Address {
    return Address.zero();
}

/**
 * Helper function to create an Address with specific pattern
 */
function createPatternAddress(fillValue: u8): Address {
    const bytes: u8[] = new Array<u8>(ADDRESS_BYTE_LENGTH);
    for (let i = 0; i < ADDRESS_BYTE_LENGTH; i++) {
        bytes[i] = fillValue;
    }
    return new Address(bytes);
}

/**
 * Helper function to create an Address with sequential bytes
 */
function createSequentialAddress(): Address {
    const bytes: u8[] = new Array<u8>(ADDRESS_BYTE_LENGTH);
    for (let i = 0; i < ADDRESS_BYTE_LENGTH; i++) {
        bytes[i] = <u8>((i + 1) % 256);
    }
    return new Address(bytes);
}

describe('Updatable Events', () => {
    describe('UpdateSubmittedEvent', () => {
        it('should create event with correct type name', () => {
            const address = createZeroAddress();
            const event = new UpdateSubmittedEvent(address, 100, 244);
            expect(event.eventType).toBe('UpdateSubmitted');
        });

        it('should have correct data length', () => {
            const address = createZeroAddress();
            const event = new UpdateSubmittedEvent(address, 100, 244);
            // ADDRESS_BYTE_LENGTH + 8 (submitBlock) + 8 (effectiveBlock) = ADDRESS_BYTE_LENGTH + 16
            expect(event.length).toBe(ADDRESS_BYTE_LENGTH + 16);
        });

        it('should encode zero block numbers correctly', () => {
            const address = createZeroAddress();
            const event = new UpdateSubmittedEvent(address, 0, 0);
            expect(event.length).toBe(ADDRESS_BYTE_LENGTH + 16);
        });

        it('should encode large block numbers', () => {
            const address = createZeroAddress();
            const largeBlock: u64 = 1000000000;
            const event = new UpdateSubmittedEvent(address, largeBlock, largeBlock + 144);
            expect(event.length).toBe(ADDRESS_BYTE_LENGTH + 16);
        });

        it('should encode max u64 block numbers', () => {
            const address = createZeroAddress();
            const event = new UpdateSubmittedEvent(address, u64.MAX_VALUE - 1, u64.MAX_VALUE);
            expect(event.length).toBe(ADDRESS_BYTE_LENGTH + 16);
        });

        it('should handle non-zero address bytes', () => {
            const address = createSequentialAddress();
            const event = new UpdateSubmittedEvent(address, 500, 644);
            expect(event.eventType).toBe('UpdateSubmitted');
            expect(event.length).toBe(ADDRESS_BYTE_LENGTH + 16);
        });

        it('should have retrievable event data', () => {
            const address = createZeroAddress();
            const event = new UpdateSubmittedEvent(address, 100, 244);
            const data = event.getEventData();
            expect(data.length).toBe(ADDRESS_BYTE_LENGTH + 16);
        });
    });

    describe('UpdateAppliedEvent', () => {
        it('should create event with correct type name', () => {
            const address = createZeroAddress();
            const event = new UpdateAppliedEvent(address, 244);
            expect(event.eventType).toBe('UpdateApplied');
        });

        it('should have correct data length', () => {
            const address = createZeroAddress();
            const event = new UpdateAppliedEvent(address, 244);
            // ADDRESS_BYTE_LENGTH + 8 (appliedAtBlock)
            expect(event.length).toBe(ADDRESS_BYTE_LENGTH + 8);
        });

        it('should encode zero block number correctly', () => {
            const address = createZeroAddress();
            const event = new UpdateAppliedEvent(address, 0);
            expect(event.length).toBe(ADDRESS_BYTE_LENGTH + 8);
        });

        it('should encode large block numbers', () => {
            const address = createZeroAddress();
            const largeBlock: u64 = 999999999999;
            const event = new UpdateAppliedEvent(address, largeBlock);
            expect(event.length).toBe(ADDRESS_BYTE_LENGTH + 8);
        });

        it('should encode max u64 block number', () => {
            const address = createZeroAddress();
            const event = new UpdateAppliedEvent(address, u64.MAX_VALUE);
            expect(event.length).toBe(ADDRESS_BYTE_LENGTH + 8);
        });

        it('should handle non-zero address bytes', () => {
            const address = createPatternAddress(0xff);
            const event = new UpdateAppliedEvent(address, 1000);
            expect(event.eventType).toBe('UpdateApplied');
        });

        it('should have retrievable event data', () => {
            const address = createZeroAddress();
            const event = new UpdateAppliedEvent(address, 100);
            const data = event.getEventData();
            expect(data.length).toBe(ADDRESS_BYTE_LENGTH + 8);
        });
    });

    describe('UpdateCancelledEvent', () => {
        it('should create event with correct type name', () => {
            const address = createZeroAddress();
            const event = new UpdateCancelledEvent(address, 150);
            expect(event.eventType).toBe('UpdateCancelled');
        });

        it('should have correct data length', () => {
            const address = createZeroAddress();
            const event = new UpdateCancelledEvent(address, 150);
            // ADDRESS_BYTE_LENGTH + 8 (cancelledAtBlock)
            expect(event.length).toBe(ADDRESS_BYTE_LENGTH + 8);
        });

        it('should encode zero block number correctly', () => {
            const address = createZeroAddress();
            const event = new UpdateCancelledEvent(address, 0);
            expect(event.length).toBe(ADDRESS_BYTE_LENGTH + 8);
        });

        it('should encode large block numbers', () => {
            const address = createZeroAddress();
            const largeBlock: u64 = 123456789012345;
            const event = new UpdateCancelledEvent(address, largeBlock);
            expect(event.length).toBe(ADDRESS_BYTE_LENGTH + 8);
        });

        it('should encode max u64 block number', () => {
            const address = createZeroAddress();
            const event = new UpdateCancelledEvent(address, u64.MAX_VALUE);
            expect(event.length).toBe(ADDRESS_BYTE_LENGTH + 8);
        });

        it('should handle non-zero address bytes', () => {
            const address = createSequentialAddress();
            const event = new UpdateCancelledEvent(address, 999);
            expect(event.eventType).toBe('UpdateCancelled');
        });

        it('should have retrievable event data', () => {
            const address = createZeroAddress();
            const event = new UpdateCancelledEvent(address, 100);
            const data = event.getEventData();
            expect(data.length).toBe(ADDRESS_BYTE_LENGTH + 8);
        });
    });

    describe('Event type name distinctness', () => {
        it('should have unique event type names', () => {
            const address = createZeroAddress();
            const submitted = new UpdateSubmittedEvent(address, 100, 244);
            const applied = new UpdateAppliedEvent(address, 244);
            const cancelled = new UpdateCancelledEvent(address, 150);

            expect(submitted.eventType).not.toBe(applied.eventType);
            expect(submitted.eventType).not.toBe(cancelled.eventType);
            expect(applied.eventType).not.toBe(cancelled.eventType);
        });

        it('should have descriptive event type names', () => {
            const address = createZeroAddress();
            const submitted = new UpdateSubmittedEvent(address, 100, 244);
            const applied = new UpdateAppliedEvent(address, 244);
            const cancelled = new UpdateCancelledEvent(address, 150);

            expect(submitted.eventType.includes('Update')).toBe(true);
            expect(applied.eventType.includes('Update')).toBe(true);
            expect(cancelled.eventType.includes('Update')).toBe(true);
        });
    });

    describe('Event data encoding', () => {
        it('should encode address at the beginning of event data', () => {
            // Create address with specific first and last bytes
            const bytes: u8[] = new Array<u8>(ADDRESS_BYTE_LENGTH);
            for (let i = 0; i < ADDRESS_BYTE_LENGTH; i++) {
                bytes[i] = 0;
            }
            bytes[0] = 0xaa;
            bytes[ADDRESS_BYTE_LENGTH - 1] = 0xbb;
            const address = new Address(bytes);

            const event = new UpdateSubmittedEvent(address, 100, 244);
            const data = event.getEventData();

            // First byte should be the first address byte
            expect(data[0]).toBe(0xaa);
            // Address ends at ADDRESS_BYTE_LENGTH - 1
            expect(data[ADDRESS_BYTE_LENGTH - 1]).toBe(0xbb);
        });

        it('should encode block numbers after address', () => {
            const address = createZeroAddress();
            const submitBlock: u64 = 0x0102030405060708;
            const effectiveBlock: u64 = 0x1112131415161718;

            const event = new UpdateSubmittedEvent(address, submitBlock, effectiveBlock);
            const data = event.getEventData();

            // Block numbers start after address (big-endian encoding by default)
            // First u64 at offset ADDRESS_BYTE_LENGTH
            expect(data[ADDRESS_BYTE_LENGTH]).toBe(0x01);
            expect(data[ADDRESS_BYTE_LENGTH + 7]).toBe(0x08);

            // Second u64 at offset ADDRESS_BYTE_LENGTH + 8
            expect(data[ADDRESS_BYTE_LENGTH + 8]).toBe(0x11);
            expect(data[ADDRESS_BYTE_LENGTH + 15]).toBe(0x18);
        });
    });

    describe('Multiple event instances', () => {
        it('should create independent event instances', () => {
            const address1 = createZeroAddress();
            const address2 = createPatternAddress(0xff);

            const event1 = new UpdateSubmittedEvent(address1, 100, 244);
            const event2 = new UpdateSubmittedEvent(address2, 200, 344);

            expect(event1.length).toBe(event2.length);
            expect(event1.eventType).toBe(event2.eventType);

            // Data should be different
            const data1 = event1.getEventData();
            const data2 = event2.getEventData();

            let areDifferent = false;
            for (let i = 0; i < data1.length; i++) {
                if (data1[i] !== data2[i]) {
                    areDifferent = true;
                    break;
                }
            }
            expect(areDifferent).toBe(true);
        });

        it('should handle many sequential event creations', () => {
            const address = createZeroAddress();

            for (let i: u64 = 0; i < 100; i++) {
                const event = new UpdateSubmittedEvent(address, i, i + 144);
                expect(event.eventType).toBe('UpdateSubmitted');
                expect(event.length).toBe(ADDRESS_BYTE_LENGTH + 16);
            }
        });
    });

    describe('Event data boundary cases', () => {
        it('should handle all-zero address', () => {
            const address = createZeroAddress();
            const event = new UpdateAppliedEvent(address, 0);
            expect(event.length).toBe(ADDRESS_BYTE_LENGTH + 8);

            const data = event.getEventData();
            // All bytes should be zero
            let allZero = true;
            for (let i = 0; i < data.length; i++) {
                if (data[i] !== 0) {
                    allZero = false;
                    break;
                }
            }
            expect(allZero).toBe(true);
        });

        it('should handle all-ones address', () => {
            const address = createPatternAddress(0xff);
            const event = new UpdateCancelledEvent(address, u64.MAX_VALUE);

            expect(event.length).toBe(ADDRESS_BYTE_LENGTH + 8);

            const data = event.getEventData();
            // All bytes should be 0xff
            let allOnes = true;
            for (let i = 0; i < data.length; i++) {
                if (data[i] !== 0xff) {
                    allOnes = false;
                    break;
                }
            }
            expect(allOnes).toBe(true);
        });
    });
});

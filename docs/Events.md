### Guide to Creating and Emitting Events in OP_NET Contracts

Events are an essential feature of smart contracts, allowing the contract to communicate important information to
external observers, such as off-chain applications or other contracts. In the OP_NET framework, events are carefully
structured to ensure efficiency and clarity. This guide will explain how to create and emit events in your OP_NET
contracts.

---

### 1. **Understanding the Event System**

The event system in OP_NET is built around the `NetEvent` class, which provides a structured way to define and manage
events. Events are limited by size and quantity to ensure they are manageable and performant.

#### **Key Limitations:**

- **Maximum Event Data Size:** Each event can contain up to 352 bytes of data (`MAX_EVENT_DATA_SIZE`).
- **Maximum Events per Transaction:** A single transaction can emit up to 1000 events (`MAX_EVENTS`).

#### **NetEvent Class Overview**

```typescript
import { BytesWriter } from '../buffer/BytesWriter';

export const MAX_EVENT_DATA_SIZE: u32 = 352; // 352 bytes max per event.
export const MAX_EVENTS: u16 = 1000; // 1000 events max per transaction.

export abstract class NetEvent {
    protected constructor(
        public readonly eventType: string,
        protected data: BytesWriter,
    ) {
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
```

### 2. **Creating Custom Events**

To create a custom event in your contract, you'll need to extend the `NetEvent` class. The `NetEvent` class requires you
to define the event type and provide the event data using the `BytesWriter` class.

#### **Example: Creating a Simple Transfer Event**

Let's say you want to create an event that logs transfers within your contract:

```typescript
import { NetEvent, MAX_EVENT_DATA_SIZE } from '../events/NetEvent';
import { BytesWriter } from '../buffer/BytesWriter';
import { Address } from '../types/Address';
import { u256 } from 'as-bignum/assembly';

class TransferEvent extends NetEvent {
    constructor(from: Address, to: Address, amount: u256) {
        const writer = new BytesWriter();
        writer.writeAddress(from);
        writer.writeAddress(to);
        writer.writeU256(amount);

        super('Transfer', writer);
    }
}
```

#### **Explanation:**

- **Event Type:** The event type is defined as `'Transfer'`.
- **Event Data:** The event data includes the sender address, recipient address, and the amount transferred, all
  serialized using the `BytesWriter`.

### 3. **Emitting Events**

Once you have defined your custom event, you can emit it within your contract using the `emitEvent` method provided by
the `OP_NET` class.

#### **Example: Emitting the Transfer Event**

```typescript
import { Address } from '../types/Address';
import { u256 } from 'as-bignum/assembly';

class MyTokenContract extends OP_NET {
    // Assume this method is called when a transfer occurs
    private transfer(from: Address, to: Address, amount: u256): void {
        // Perform the transfer logic...

        // Emit the Transfer event
        const event = new TransferEvent(from, to, amount);
        this.emitEvent(event);
    }
}
```

#### **Explanation:**

- **Creating the Event:** You create an instance of `TransferEvent` by passing the relevant data (sender, recipient, and
  amount).
- **Emitting the Event:** The `emitEvent` method is used to register the event within the blockchain environment, making
  it available for external observers.

### 4. **Best Practices for Event Creation**

- **Limit Data Size:** Always ensure that the event data does not exceed the `MAX_EVENT_DATA_SIZE` (352 bytes).
  Attempting to emit an event with larger data will result in an error.

- **Efficient Data Packing:** Use the `BytesWriter` efficiently to pack data into the event. This includes using
  appropriate data types and minimizing unnecessary information.

- **Event Naming:** Choose clear and descriptive event names (e.g., `'Transfer'`, `'Approval'`) to make it easier for
  external observers to understand the event's purpose.

### 5. **Summary**

Creating and emitting events in OP_NET contracts is a powerful way to communicate with external systems. By following
the guidelines provided in this guide, you can efficiently define, create, and emit events within your contracts.
Remember to adhere to the size limitations and make your events as informative and concise as possible. Events are a
vital part of your contract's interface, and using them effectively will enhance the functionality and usability of your
smart contracts on the OP_NET platform.

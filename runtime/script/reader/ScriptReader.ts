import { BitcoinOpcodes } from '../Opcodes';
import { Revert } from '../../types/Revert';

/**
 * Instr represents a single instruction from a Bitcoin Script
 * It can be either an opcode or a data push operation
 */
@final
export class Instr {
    public op: i32; // The opcode value (negative for push operations)
    public data: Uint8Array | null; // The data being pushed (null for non-push opcodes)

    public constructor(op: i32, data: Uint8Array | null) {
        this.op = op;
        this.data = data;
    }
}

/**
 * Result type for instruction parsing operations
 * This replaces exceptions with explicit error handling
 */
@final
export class InstrResult {
    public readonly success: bool;
    public readonly value: Instr | null;
    public readonly error: string | null;

    public constructor(success: bool, value: Instr | null, error: string | null) {
        this.success = success;
        this.value = value;
        this.error = error;
    }

    static ok(value: Instr): InstrResult {
        return new InstrResult(true, value, null);
    }

    static err(error: string): InstrResult {
        return new InstrResult(false, null, error);
    }
}

/**
 * ScriptReader provides a way to parse Bitcoin Script byte by byte
 * It maintains internal state to track the current position in the script
 */
@final
export class ScriptReader {
    private i: i32 = 0; // Current position in the script
    private readonly s: Uint8Array; // The script bytes

    public constructor(s: Uint8Array) {
        this.s = s;
    }

    /**
     * Reset the reader to the beginning of the script
     * Useful for re-parsing the same script
     */
    public reset(): void {
        this.i = 0;
    }

    /**
     * Check if we've reached the end of the script
     */
    public done(): bool {
        return this.i >= this.s.length;
    }

    /**
     * Safe version of next() that returns a result object
     * This is the preferred method for AssemblyScript
     *
     * @param strictMinimalPush - If true, enforce minimal push encoding rules
     * @returns InstrResult containing either the instruction or an error
     */
    public nextSafe(strictMinimalPush: bool = true): InstrResult {
        const L = this.s.length;

        // Check if we've reached the end
        if (this.i >= L) {
            return InstrResult.err('eof');
        }

        // Read the opcode
        const op = <i32>this.s[this.i++];

        // OP_0 is a special case - it pushes an empty array
        if (op == <i32>BitcoinOpcodes.OP_0) {
            return InstrResult.ok(new Instr(<i32>BitcoinOpcodes.OP_0, new Uint8Array(0)));
        }

        // Opcodes 1-75 directly encode the length of data to push
        if (op <= 75) {
            const len = op;

            // Check if we have enough bytes remaining
            if (this.i + len > L) {
                return InstrResult.err('trunc push');
            }

            // Extract the data
            const data = this.s.subarray(this.i, this.i + len);
            this.i += len;

            // Return with negative length to indicate it's a push operation
            return InstrResult.ok(new Instr(-len, data));
        }

        // OP_PUSHDATA1: 1 byte specifies the length
        if (op == <i32>BitcoinOpcodes.OP_PUSHDATA1) {
            // Check if we have the length byte
            if (this.i + 1 > L) {
                return InstrResult.err('trunc pd1 len');
            }

            const len = <i32>this.s[this.i++];

            // Check if we have enough data bytes
            if (this.i + len > L) {
                return InstrResult.err('trunc pd1 data');
            }

            const data = this.s.subarray(this.i, this.i + len);
            this.i += len;

            // Enforce minimal encoding if required
            if (strictMinimalPush && len <= 75) {
                return InstrResult.err('non-minimal PUSHDATA1');
            }

            return InstrResult.ok(new Instr(-len, data));
        }

        // OP_PUSHDATA2: 2 bytes specify the length (little-endian)
        if (op == <i32>BitcoinOpcodes.OP_PUSHDATA2) {
            // Check if we have the length bytes
            if (this.i + 2 > L) {
                return InstrResult.err('trunc pd2 len');
            }

            // Read length in little-endian format
            const len = (<i32>this.s[this.i]) | ((<i32>this.s[this.i + 1]) << 8);
            this.i += 2;

            // Check if we have enough data bytes
            if (this.i + len > L) {
                return InstrResult.err('trunc pd2 data');
            }

            const data = this.s.subarray(this.i, this.i + len);
            this.i += len;

            // Enforce minimal encoding if required
            if (strictMinimalPush && len < 0x100) {
                return InstrResult.err('non-minimal PUSHDATA2');
            }

            return InstrResult.ok(new Instr(-len, data));
        }

        // OP_PUSHDATA4: 4 bytes specify the length (little-endian)
        if (op == <i32>BitcoinOpcodes.OP_PUSHDATA4) {
            // Check if we have the length bytes
            if (this.i + 4 > L) {
                return InstrResult.err('trunc pd4 len');
            }

            // Read length in little-endian format
            const len =
                (<i32>this.s[this.i]) |
                ((<i32>this.s[this.i + 1]) << 8) |
                ((<i32>this.s[this.i + 2]) << 16) |
                ((<i32>this.s[this.i + 3]) << 24);
            this.i += 4;

            // Check if we have enough data bytes
            if (this.i + len > L) {
                return InstrResult.err('trunc pd4 data');
            }

            const data = this.s.subarray(this.i, this.i + len);
            this.i += len;

            // Enforce minimal encoding if required
            if (strictMinimalPush && len < 0x10000) {
                return InstrResult.err('non-minimal PUSHDATA4');
            }

            return InstrResult.ok(new Instr(-len, data));
        }

        // It's a regular opcode (not a push operation)
        return InstrResult.ok(new Instr(op, null));
    }

    /**
     * Consider using nextSafe() instead of this method
     * @param strictMinimalPush
     */
    public next(strictMinimalPush: bool = true): Instr {
        const result = this.nextSafe(strictMinimalPush);
        if (!result.success) {
            if (!result.error) {
                throw new Revert('Unexpected error in ScriptReader.next');
            }

            throw new Revert(result.error);
        }
        return result.value!;
    }

    /**
     * Peek at the next opcode without advancing the position
     * Returns -1 if at end of script
     */
    public peekOpcode(): i32 {
        if (this.i >= this.s.length) return -1;
        return <i32>this.s[this.i];
    }

    /**
     * Get the current position in the script
     * Useful for error reporting or saving/restoring state
     */
    public getPosition(): i32 {
        return this.i;
    }

    /**
     * Set the position in the script
     * Use with caution - no bounds checking is performed here
     */
    public setPosition(pos: i32): void {
        this.i = pos;
    }

    /**
     * Get the remaining bytes in the script without parsing
     */
    public getRemainingBytes(): Uint8Array {
        if (this.i >= this.s.length) return new Uint8Array(0);
        return this.s.subarray(this.i);
    }
}

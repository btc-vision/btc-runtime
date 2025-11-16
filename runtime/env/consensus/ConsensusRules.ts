/**
 * Consensus flags for protocol behavior control
 */
@final
export class ConsensusRules {
    // Flag constants
    public static readonly NONE: u64 = 0b00000000;
    public static readonly UNSAFE_QUANTUM_SIGNATURES_ALLOWED: u64 = 0b00000001;
    public static readonly RESERVED_FLAG_1: u64 = 0b00000010;
    public static readonly RESERVED_FLAG_2: u64 = 0b00000100;

    private value: u64;

    constructor(value: u64 = 0) {
        this.value = value;
    }

    /**
     * Creates a new empty ConsensusRules
     */
    public static new(): ConsensusRules {
        return new ConsensusRules(0);
    }

    /**
     * Creates ConsensusRules from u64 value
     */
    public static fromU64(value: u64): ConsensusRules {
        return new ConsensusRules(value);
    }

    /**
     * Helper to create flags from multiple flag values
     */
    public static combine(flags: u64[]): ConsensusRules {
        let result: u64 = 0;
        for (let i = 0; i < flags.length; i++) {
            result |= flags[i];
        }
        return new ConsensusRules(result);
    }

    /**
     * Gets the underlying u64 value
     */
    public asU64(): u64 {
        return this.value;
    }

    /**
     * Converts to big-endian byte array
     */
    public toBeBytes(): Uint8Array {
        const bytes = new Uint8Array(8);
        const view = new DataView(bytes.buffer);
        view.setUint64(0, this.value, false); // false = big-endian
        return bytes;
    }

    /**
     * Checks if all flags in 'other' are set
     */
    public contains(other: ConsensusRules): boolean {
        return (this.value & other.value) == other.value;
    }

    /**
     * Checks if flag value is set
     */
    public containsFlag(flag: u64): boolean {
        return (this.value & flag) == flag;
    }

    /**
     * Checks if any flags in 'other' are set
     */
    public intersects(other: ConsensusRules): boolean {
        return (this.value & other.value) != 0;
    }

    /**
     * Checks if any flag value is set
     */
    public intersectsFlag(flag: u64): boolean {
        return (this.value & flag) != 0;
    }

    /**
     * Checks if no flags are set
     */
    public isEmpty(): boolean {
        return this.value == 0;
    }

    /**
     * Returns union of flags
     */
    public union(other: ConsensusRules): ConsensusRules {
        return new ConsensusRules(this.value | other.value);
    }

    /**
     * Returns intersection of flags
     */
    public intersection(other: ConsensusRules): ConsensusRules {
        return new ConsensusRules(this.value & other.value);
    }

    /**
     * Returns difference of flags (flags in this but not in other)
     */
    public difference(other: ConsensusRules): ConsensusRules {
        return new ConsensusRules(this.value & ~other.value);
    }

    /**
     * Returns symmetric difference of flags
     */
    public symmetricDifference(other: ConsensusRules): ConsensusRules {
        return new ConsensusRules(this.value ^ other.value);
    }

    /**
     * Returns complement of flags
     */
    public complement(): ConsensusRules {
        return new ConsensusRules(~this.value);
    }

    /**
     * Inserts flags from other
     */
    public insert(other: ConsensusRules): void {
        this.value |= other.value;
    }

    /**
     * Inserts a flag value
     */
    public insertFlag(flag: u64): void {
        this.value |= flag;
    }

    /**
     * Removes flags from other
     */
    public remove(other: ConsensusRules): void {
        this.value &= ~other.value;
    }

    /**
     * Removes a flag value
     */
    public removeFlag(flag: u64): void {
        this.value &= ~flag;
    }

    /**
     * Toggles flags from other
     */
    public toggle(other: ConsensusRules): void {
        this.value ^= other.value;
    }

    /**
     * Toggles a flag value
     */
    public toggleFlag(flag: u64): void {
        this.value ^= flag;
    }

    /**
     * Sets or clears flags based on value
     */
    public set(other: ConsensusRules, value: boolean): void {
        if (value) {
            this.insert(other);
        } else {
            this.remove(other);
        }
    }

    /**
     * Sets or clears a flag based on value
     */
    public setFlag(flag: u64, value: boolean): void {
        if (value) {
            this.insertFlag(flag);
        } else {
            this.removeFlag(flag);
        }
    }

    /**
     * Creates a copy of this ConsensusFlags
     */
    public clone(): ConsensusRules {
        return new ConsensusRules(this.value);
    }

    /**
     * Checks equality with another ConsensusFlags
     */
    public equals(other: ConsensusRules): boolean {
        return this.value == other.value;
    }

    /**
     * Returns binary string representation
     */
    public toBinaryString(): string {
        let result = '';
        let val = this.value;
        for (let i = 0; i < 64; i++) {
            result = (val & 1 ? '1' : '0') + result;
            val = val >> 1;
        }
        return '0b' + result;
    }

    public unsafeSignaturesAllowed(): boolean {
        return this.containsFlag(ConsensusRules.UNSAFE_QUANTUM_SIGNATURES_ALLOWED);
    }
}

export function createConsensusFlags(flags: u64[]): ConsensusRules {
    return ConsensusRules.combine(flags);
}

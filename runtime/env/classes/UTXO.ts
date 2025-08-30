import { TransactionInputFlags, TransactionOutputFlags } from '../enums/TransactionFlags';

@final
export class TransactionInput {
    public constructor(
        public readonly flags: u8,
        public readonly txId: Uint8Array,
        public readonly outputIndex: u16,
        public readonly scriptSig: Uint8Array,
        public readonly witnesses: Uint8Array[] | null,
        public readonly coinbase: Uint8Array | null,
    ) {}

    public get isCoinbase(): boolean {
        return (this.flags & TransactionInputFlags.hasCoinbase) !== 0;
    }

    public get hasWitnesses(): boolean {
        return (this.flags & TransactionInputFlags.hasWitnesses) !== 0;
    }
}

@final
export class TransactionOutput {
    public constructor(
        public readonly index: u16,
        public readonly flags: u8,
        public readonly scriptPublicKey: Uint8Array | null,
        public readonly to: string | null,
        public readonly value: u64,
    ) {}

    public get hasTo(): boolean {
        return (this.flags & TransactionOutputFlags.hasTo) !== 0;
    }

    public get hasScriptPubKey(): boolean {
        return (this.flags & TransactionOutputFlags.hasScriptPubKey) !== 0;
    }

    public get isOPReturn(): boolean {
        return (this.flags & TransactionOutputFlags.OP_RETURN) !== 0;
    }
}

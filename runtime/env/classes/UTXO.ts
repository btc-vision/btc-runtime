@final
export class TransactionInput {
    public constructor(
        public readonly txId: Uint8Array,
        public readonly outputIndex: u8,
        public readonly scriptSig: Uint8Array,
    ) {}
}

@final
export class TransactionOutput {
    public constructor(
        public readonly index: u8,
        public readonly scriptPubKey: Uint8Array,
        public readonly value: u64,
    ) {}
}

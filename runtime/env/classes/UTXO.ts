@final
export class TransactionInput {
    public constructor(
        public readonly txId: Uint8Array,
        public readonly outputIndex: u16,
        public readonly scriptSig: Uint8Array,
    ) {
    }
}

@final
export class TransactionOutput {
    public constructor(
        public readonly index: u16,
        public readonly to: string,
        public readonly value: u64,
    ) {
    }
}

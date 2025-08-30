import { TransactionInput, TransactionOutput } from '../classes/UTXO';
import { TransactionInputFlags, TransactionOutputFlags } from '../enums/TransactionFlags';
import { BytesReader } from '../../buffer/BytesReader';

export class TransactionDecoder {
    public readTransactionInputs(buffer: BytesReader): TransactionInput[] {
        const length = buffer.readU16();
        const result = new Array<TransactionInput>(length);

        for (let i: u16 = 0; i < length; i++) {
            result[i] = this.decodeInput(buffer);
        }

        return result;
    }

    public readTransactionOutputs(buffer: BytesReader): TransactionOutput[] {
        const length = buffer.readU16();
        const result = new Array<TransactionOutput>(length);

        for (let i: u16 = 0; i < length; i++) {
            result[i] = this.decodeOutput(buffer);
        }

        return result;
    }

    private decodeInput(buffer: BytesReader): TransactionInput {
        const flags = buffer.readU8();
        const txId = buffer.readBytes(32);
        const outputIndex = buffer.readU16();
        const scriptSig = buffer.readBytesWithLength();

        const coinbase: Uint8Array | null = this.hasFlag(flags, TransactionInputFlags.hasCoinbase)
            ? buffer.readBytesWithLength()
            : null;

        const witnesses: Uint8Array[] | null = this.hasFlag(
            flags,
            TransactionInputFlags.hasWitnesses,
        )
            ? buffer.readArrayOfBuffer()
            : null;

        return new TransactionInput(flags, txId, outputIndex, scriptSig, witnesses, coinbase);
    }

    private decodeOutput(buffer: BytesReader): TransactionOutput {
        const flags = buffer.readU8();
        const index = buffer.readU16();

        let scriptPubKey: Uint8Array | null = null;
        if (this.hasFlag(flags, TransactionOutputFlags.hasScriptPubKey)) {
            scriptPubKey = buffer.readBytesWithLength();
        }

        let to: string | null = null;
        if (this.hasFlag(flags, TransactionOutputFlags.hasTo)) {
            to = buffer.readStringWithLength();
        }

        const value = buffer.readU64();

        return new TransactionOutput(index, flags, scriptPubKey, to, value);
    }

    /**
     * Checks if the given flag is set in the flags byte.
     */
    private hasFlag<T extends u8>(flags: u8, flag: T): boolean {
        return (flags & flag) !== 0;
    }
}

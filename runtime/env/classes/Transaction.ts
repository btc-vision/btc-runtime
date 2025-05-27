import { Address } from '../../types/Address';
import { TransactionInput, TransactionOutput } from './UTXO';
import { Potential } from '../../lang/Definitions';
import { BytesReader } from '../../buffer/BytesReader';
import { inputs, outputs } from '../global';
import { TransactionDecoder } from '../decoders/TransactionDecoder';

@final
export class Transaction {
    private readonly transactionDecoder: TransactionDecoder = new TransactionDecoder();

    public constructor(
        public readonly sender: Address, // "immediate caller"
        public readonly origin: Address, // "leftmost thing in the call chain"
        public readonly txId: Uint8Array,
        public readonly hash: Uint8Array,
        public readonly disableCache: bool = false,
    ) {}

    private _inputs: Potential<TransactionInput[]> = null;

    public get inputs(): TransactionInput[] {
        if (!this._inputs) {
            const inputs = this.loadInputs();
            this._inputs = inputs;

            return inputs;
        }

        return this._inputs as TransactionInput[];
    }

    private _outputs: Potential<TransactionOutput[]> = null;

    public get outputs(): TransactionOutput[] {
        if (this.disableCache) {
            return this.loadOutputs();
        } else {
            if (!this._outputs) {
                const outputs = this.loadOutputs();
                this._outputs = outputs;

                return outputs;
            }

            return this._outputs as TransactionOutput[];
        }
    }

    private loadInputs(): TransactionInput[] {
        const reader = new BytesReader(inputs());
        return this.transactionDecoder.readTransactionInputs(reader);
    }

    private loadOutputs(): TransactionOutput[] {
        const reader = new BytesReader(outputs());
        return this.transactionDecoder.readTransactionOutputs(reader);
    }
}

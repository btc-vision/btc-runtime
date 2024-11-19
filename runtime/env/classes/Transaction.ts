import { Address } from '../../types/Address';
import { TransactionInput, TransactionOutput } from './UTXO';
import { Potential } from '../../lang/Definitions';
import { BytesReader } from '../../buffer/BytesReader';
import { inputs, outputs } from '../global';

@final
export class Transaction {
    public constructor(
        public readonly sender: Address, // "immediate caller"
        public readonly origin: Address, // "leftmost thing in the call chain"
        public readonly id: Uint8Array,
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
        if (!this._outputs) {
            const outputs = this.loadOutputs();
            this._outputs = outputs;

            return outputs;
        }

        return this._outputs as TransactionOutput[];
    }

    private loadInputs(): TransactionInput[] {
        const buffer = new BytesReader(inputs());

        return buffer.readTransactionInputs();
    }

    private loadOutputs(): TransactionOutput[] {
        const buffer = new BytesReader(outputs());

        return buffer.readTransactionOutputs();
    }
}

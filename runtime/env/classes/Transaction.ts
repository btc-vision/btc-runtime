import { Address } from '../../types/Address';
import { TransactionInput, TransactionOutput } from './UTXO';
import { Potential } from '../../lang/Definitions';
import { BytesReader } from '../../buffer/BytesReader';
import { getInputsSize, getOutputsSize, inputs, outputs } from '../global';

@final
export class Transaction {
    public constructor(
        public readonly sender: Address, // "immediate caller"
        public readonly origin: Address, // "leftmost thing in the call chain"
        public readonly hash: Uint8Array,
    ) {
    }

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
        const inputsSize = getInputsSize();
        let resultBuffer = new ArrayBuffer(inputsSize);
        inputs(resultBuffer);

        const reader = new BytesReader(Uint8Array.wrap(resultBuffer));
        return reader.readTransactionInputs();
    }

    private loadOutputs(): TransactionOutput[] {
        const outputsSize = getOutputsSize();
        let resultBuffer = new ArrayBuffer(outputsSize);
        outputs(resultBuffer);

        const reader = new BytesReader(Uint8Array.wrap(resultBuffer));
        return reader.readTransactionOutputs();
    }
}

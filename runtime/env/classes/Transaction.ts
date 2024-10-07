import { Address } from '../../types/Address';
import { TransactionInput, TransactionOutput } from './UTXO';
import { Potential } from '../../lang/Definitions';
import { StaticArray } from 'staticarray';
import { BytesReader } from '../../buffer/BytesReader';
import { inputs, outputs } from '../global';

@final
export class Transaction {
    public constructor(
        public readonly sender: Address, // "immediate caller"
        public readonly origin: Address, // "leftmost thing in the call chain"
        public readonly id: Uint8Array,
    ) {}

    private _inputs: Potential<StaticArray<TransactionInput>> = null;

    public get inputs(): StaticArray<TransactionInput> {
        if (!this._inputs) {
            this._inputs = this.loadInputs();
        }

        return this._inputs;
    }

    private _outputs: Potential<StaticArray<TransactionOutput>> = null;

    public get outputs(): StaticArray<TransactionOutput> {
        if (!this._outputs) {
            this._outputs = this.loadOutputs();
        }

        return this._outputs;
    }

    private loadInputs(): StaticArray<TransactionInput> {
        const buffer = new BytesReader(inputs());

        return buffer.readTransactionInputs();
    }

    private loadOutputs(): StaticArray<TransactionOutput> {
        const buffer = new BytesReader(outputs());

        return buffer.readTransactionOutputs();
    }
}

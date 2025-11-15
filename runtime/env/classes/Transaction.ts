import { Address } from '../../types/Address';
import { TransactionInput, TransactionOutput } from './UTXO';
import { Potential } from '../../lang/Definitions';
import { BytesReader } from '../../buffer/BytesReader';
import { getInputsSize, getOutputsSize, inputs, outputs } from '../global';
import { TransactionDecoder } from '../decoders/TransactionDecoder';
import { ConsensusRules } from '../consensus/ConsensusRules';
import { ExtendedAddress } from '../../types/ExtendedAddress';

@final
export class Transaction {
    public readonly consensus: ConsensusRules;

    /**
     * The `sender` is the immediate caller of this transaction, which may be a contract or a user.
     * It is always typed as `Address`, which may not be quantum-resistant.
     *
     * The `origin` is the original transaction signer (the "leftmost" entity in the call chain).
     * It is typed as `ExtendedAddress`, allowing for both Schnorr and ML-DSA keys (including quantum-resistant keys).
     *
     * This distinction is intentional: only the transaction originator may use quantum-resistant keys,
     * while intermediate contract callers are always standard addresses. This should be considered when
     * performing address verification or signature checks.
     */
    public readonly sender: Address;

    /**
     * The `origin` is the original transaction signer (the "leftmost" entity in the call chain).
     * It is typed as `ExtendedAddress`, allowing for both Schnorr and ML-DSA keys (including quantum-resistant keys).
     *
     * This distinction is intentional: only the transaction originator may use quantum-resistant keys,
     * while intermediate contract callers are always standard addresses. This should be considered when
     * performing address verification or signature checks.
     *
     */
    public readonly origin: ExtendedAddress;

    private readonly transactionDecoder: TransactionDecoder = new TransactionDecoder();

    public constructor(
        sender: Address, // "immediate caller"
        origin: ExtendedAddress, // "leftmost thing in the call chain"
        public readonly txId: Uint8Array,
        public readonly hash: Uint8Array,
        consensusFlags: u64,
    ) {
        this.sender = sender;
        this.origin = origin;
        this.consensus = new ConsensusRules(consensusFlags);
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
        const resultBuffer = new ArrayBuffer(inputsSize);
        inputs(resultBuffer);

        const reader = new BytesReader(Uint8Array.wrap(resultBuffer));
        return this.transactionDecoder.readTransactionInputs(reader);
    }

    private loadOutputs(): TransactionOutput[] {
        const outputsSize = getOutputsSize();
        const resultBuffer = new ArrayBuffer(outputsSize);
        outputs(resultBuffer);

        const reader = new BytesReader(Uint8Array.wrap(resultBuffer));
        return this.transactionDecoder.readTransactionOutputs(reader);
    }
}

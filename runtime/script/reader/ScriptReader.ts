import { BitcoinOpcodes } from '../Opcodes';

@final
export class Instr {
    public op: i32;
    public data: Uint8Array | null;
    public constructor(op: i32, data: Uint8Array | null) {
        this.op = op;
        this.data = data;
    }
}

@final
export class ScriptReader {
    private i: i32 = 0;
    private readonly s: Uint8Array;

    public constructor(s: Uint8Array) {
        this.s = s;
    }

    public reset(): void {
        this.i = 0;
    }

    public done(): bool {
        return this.i >= this.s.length;
    }

    public next(strictMinimalPush: bool = true): Instr {
        const L = this.s.length;

        if (this.i >= L) throw new Error('eof');

        const op = <i32>this.s[this.i++];
        if (op == BitcoinOpcodes.OP_0) return new Instr(BitcoinOpcodes.OP_0, new Uint8Array(0));

        if (op <= 75) {
            const len = op;
            if (this.i + len > L) throw new Error('trunc push');
            const data = this.s.subarray(this.i, this.i + len);
            this.i += len;
            return new Instr(-len, data);
        }

        if (op == BitcoinOpcodes.OP_PUSHDATA1) {
            if (this.i + 1 > L) throw new Error('trunc pd1 len');
            const len = <i32>this.s[this.i++];
            if (this.i + len > L) throw new Error('trunc pd1 data');
            const data = this.s.subarray(this.i, this.i + len);
            this.i += len;
            if (strictMinimalPush && len <= 75) throw new Error('non-minimal PUSHDATA1');
            return new Instr(-len, data);
        }

        if (op == BitcoinOpcodes.OP_PUSHDATA2) {
            if (this.i + 2 > L) throw new Error('trunc pd2 len');
            const len = (<i32>this.s[this.i]) | ((<i32>this.s[this.i + 1]) << 8);
            this.i += 2;
            if (this.i + len > L) throw new Error('trunc pd2 data');
            const data = this.s.subarray(this.i, this.i + len);
            this.i += len;
            if (strictMinimalPush && len < 0x100) throw new Error('non-minimal PUSHDATA2');
            return new Instr(-len, data);
        }

        if (op == BitcoinOpcodes.OP_PUSHDATA4) {
            if (this.i + 4 > L) throw new Error('trunc pd4 len');
            const len =
                (<i32>this.s[this.i]) |
                ((<i32>this.s[this.i + 1]) << 8) |
                ((<i32>this.s[this.i + 2]) << 16) |
                ((<i32>this.s[this.i + 3]) << 24);
            this.i += 4;
            if (this.i + len > L) throw new Error('trunc pd4 data');
            const data = this.s.subarray(this.i, this.i + len);
            this.i += len;
            if (strictMinimalPush && len < 0x10000) throw new Error('non-minimal PUSHDATA4');
            return new Instr(-len, data);
        }

        return new Instr(op, null);
    }
}

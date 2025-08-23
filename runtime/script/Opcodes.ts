import { Revert } from '../types/Revert';

@final
export class BitcoinOpcodes {
    public static readonly OP_FALSE: u8 = 0;
    public static readonly OP_0: u8 = 0;
    public static readonly OP_PUSHDATA1: u8 = 76;
    public static readonly OP_PUSHDATA2: u8 = 77;
    public static readonly OP_PUSHDATA4: u8 = 78;
    public static readonly OP_1NEGATE: u8 = 79;
    public static readonly OP_RESERVED: u8 = 80;
    public static readonly OP_TRUE: u8 = 81;
    public static readonly OP_1: u8 = 81;
    public static readonly OP_2: u8 = 82;
    public static readonly OP_3: u8 = 83;
    public static readonly OP_4: u8 = 84;
    public static readonly OP_5: u8 = 85;
    public static readonly OP_6: u8 = 86;
    public static readonly OP_7: u8 = 87;
    public static readonly OP_8: u8 = 88;
    public static readonly OP_9: u8 = 89;
    public static readonly OP_10: u8 = 90;
    public static readonly OP_11: u8 = 91;
    public static readonly OP_12: u8 = 92;
    public static readonly OP_13: u8 = 93;
    public static readonly OP_14: u8 = 94;
    public static readonly OP_15: u8 = 95;
    public static readonly OP_16: u8 = 96;
    public static readonly OP_NOP: u8 = 97;
    public static readonly OP_VER: u8 = 98;
    public static readonly OP_IF: u8 = 99;
    public static readonly OP_NOTIF: u8 = 100;
    public static readonly OP_VERIF: u8 = 101;
    public static readonly OP_VERNOTIF: u8 = 102;
    public static readonly OP_ELSE: u8 = 103;
    public static readonly OP_ENDIF: u8 = 104;
    public static readonly OP_VERIFY: u8 = 105;
    public static readonly OP_RETURN: u8 = 106;
    public static readonly OP_TOALTSTACK: u8 = 107;
    public static readonly OP_FROMALTSTACK: u8 = 108;
    public static readonly OP_2DROP: u8 = 109;
    public static readonly OP_2DUP: u8 = 110;
    public static readonly OP_3DUP: u8 = 111;
    public static readonly OP_2OVER: u8 = 112;
    public static readonly OP_2ROT: u8 = 113;
    public static readonly OP_2SWAP: u8 = 114;
    public static readonly OP_IFDUP: u8 = 115;
    public static readonly OP_DEPTH: u8 = 116;
    public static readonly OP_DROP: u8 = 117;
    public static readonly OP_DUP: u8 = 118;
    public static readonly OP_NIP: u8 = 119;
    public static readonly OP_OVER: u8 = 120;
    public static readonly OP_PICK: u8 = 121;
    public static readonly OP_ROLL: u8 = 122;
    public static readonly OP_ROT: u8 = 123;
    public static readonly OP_SWAP: u8 = 124;
    public static readonly OP_TUCK: u8 = 125;
    public static readonly OP_CAT: u8 = 126;
    public static readonly OP_SUBSTR: u8 = 127;
    public static readonly OP_LEFT: u8 = 128;
    public static readonly OP_RIGHT: u8 = 129;
    public static readonly OP_SIZE: u8 = 130;
    public static readonly OP_INVERT: u8 = 131;
    public static readonly OP_AND: u8 = 132;
    public static readonly OP_OR: u8 = 133;
    public static readonly OP_XOR: u8 = 134;
    public static readonly OP_EQUAL: u8 = 135;
    public static readonly OP_EQUALVERIFY: u8 = 136;
    public static readonly OP_RESERVED1: u8 = 137;
    public static readonly OP_RESERVED2: u8 = 138;
    public static readonly OP_1ADD: u8 = 139;
    public static readonly OP_1SUB: u8 = 140;
    public static readonly OP_2MUL: u8 = 141;
    public static readonly OP_2DIV: u8 = 142;
    public static readonly OP_NEGATE: u8 = 143;
    public static readonly OP_ABS: u8 = 144;
    public static readonly OP_NOT: u8 = 145;
    public static readonly OP_0NOTEQUAL: u8 = 146;
    public static readonly OP_ADD: u8 = 147;
    public static readonly OP_SUB: u8 = 148;
    public static readonly OP_MUL: u8 = 149;
    public static readonly OP_DIV: u8 = 150;
    public static readonly OP_MOD: u8 = 151;
    public static readonly OP_LSHIFT: u8 = 152;
    public static readonly OP_RSHIFT: u8 = 153;
    public static readonly OP_BOOLAND: u8 = 154;
    public static readonly OP_BOOLOR: u8 = 155;
    public static readonly OP_NUMEQUAL: u8 = 156;
    public static readonly OP_NUMEQUALVERIFY: u8 = 157;
    public static readonly OP_NUMNOTEQUAL: u8 = 158;
    public static readonly OP_LESSTHAN: u8 = 159;
    public static readonly OP_GREATERTHAN: u8 = 160;
    public static readonly OP_LESSTHANOREQUAL: u8 = 161;
    public static readonly OP_GREATERTHANOREQUAL: u8 = 162;
    public static readonly OP_MIN: u8 = 163;
    public static readonly OP_MAX: u8 = 164;
    public static readonly OP_WITHIN: u8 = 165;
    public static readonly OP_RIPEMD160: u8 = 166;
    public static readonly OP_SHA1: u8 = 167;
    public static readonly OP_SHA256: u8 = 168;
    public static readonly OP_HASH160: u8 = 169;
    public static readonly OP_HASH256: u8 = 170;
    public static readonly OP_CODESEPARATOR: u8 = 171;
    public static readonly OP_CHECKSIG: u8 = 172;
    public static readonly OP_CHECKSIGVERIFY: u8 = 173;
    public static readonly OP_CHECKMULTISIG: u8 = 174;
    public static readonly OP_CHECKMULTISIGVERIFY: u8 = 175;
    public static readonly OP_NOP1: u8 = 176;
    public static readonly OP_NOP2: u8 = 177;
    public static readonly OP_CHECKLOCKTIMEVERIFY: u8 = 177;
    public static readonly OP_NOP3: u8 = 178;
    public static readonly OP_CHECKSEQUENCEVERIFY: u8 = 178;
    public static readonly OP_NOP4: u8 = 179;
    public static readonly OP_NOP5: u8 = 180;
    public static readonly OP_NOP6: u8 = 181;
    public static readonly OP_NOP7: u8 = 182;
    public static readonly OP_NOP8: u8 = 183;
    public static readonly OP_NOP9: u8 = 184;
    public static readonly OP_NOP10: u8 = 185;
    public static readonly OP_CHECKSIGADD: u8 = 186;
    public static readonly OP_PUBKEYHASH: u8 = 253;
    public static readonly OP_PUBKEY: u8 = 254;
    public static readonly OP_INVALIDOPCODE: u8 = 255;

    public static opN(n: i32): u8 {
        if (n == 0) return 0;
        if (n < 0 || n > 16) throw new Revert('OP_N out of range');
        return <u8>(0x50 + n);
    }

    public static isPushdataOpcode(op: u8): bool {
        // true for explicit data-push opcodes: 0x01..0x4b, OP_PUSHDATA1/2/4
        if (op >= <u8>1 && op <= <u8>75) return true;
        return (
            op == BitcoinOpcodes.OP_PUSHDATA1 ||
            op == BitcoinOpcodes.OP_PUSHDATA2 ||
            op == BitcoinOpcodes.OP_PUSHDATA4
        );
    }

    public static isOpSuccessTaproot(op: u8): bool {
        // BIP342 OP_SUCCESSx set for Tapscript (witness v1)
        if (op == BitcoinOpcodes.OP_RESERVED /* 0x50 */) return true;
        if (op == BitcoinOpcodes.OP_VER /* 0x62 */) return true;

        // Disabled legacy ops that become OP_SUCCESSx in Tapscript
        if (op >= BitcoinOpcodes.OP_CAT && op <= BitcoinOpcodes.OP_RIGHT) return true;
        if (op >= BitcoinOpcodes.OP_INVERT && op <= BitcoinOpcodes.OP_XOR) return true;
        if (op >= BitcoinOpcodes.OP_2MUL && op <= BitcoinOpcodes.OP_2DIV) return true;
        if (op >= <u8>149 && op <= <u8>153) return true;

        // Unknown/reserved range that is OP_SUCCESSx in Tapscript
        return op >= <u8>187 && op <= <u8>254;
    }
}

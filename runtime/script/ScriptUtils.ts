@final
export class VerifyResult {
    public ok: bool;
    public constructor(ok: bool) {
        this.ok = ok;
    }
}

@final
export class SegwitDecoded {
    public hrp: string;
    public version: i32;
    public program: Uint8Array;
    public constructor(hrp: string, version: i32, program: Uint8Array) {
        this.hrp = hrp;
        this.version = version;
        this.program = program;
    }
}

@final
export class CsvRecognize {
    public ok: bool;
    public csvBlocks: i64;
    public pubkey: Uint8Array | null;
    public constructor(ok: bool, csvBlocks: i64, pubkey: Uint8Array | null) {
        this.ok = ok;
        this.csvBlocks = csvBlocks;
        this.pubkey = pubkey;
    }
}

@final
export class MultisigRecognize {
    public ok: bool;
    public m: i32;
    public n: i32;
    public pubkeys: Array<Uint8Array> | null;
    public constructor(ok: bool, m: i32, n: i32, pubkeys: Array<Uint8Array> | null) {
        this.ok = ok;
        this.m = m;
        this.n = n;
        this.pubkeys = pubkeys;
    }
}

@final
export class CsvP2wshResult {
    public address: string;
    public witnessScript: Uint8Array;
    public constructor(address: string, ws: Uint8Array) {
        this.address = address;
        this.witnessScript = ws;
    }
}

@final
export class MultisigP2wshResult {
    public address: string;
    public witnessScript: Uint8Array;
    public constructor(address: string, ws: Uint8Array) {
        this.address = address;
        this.witnessScript = ws;
    }
}

@final
export class CsvPairCrossCheck {
    public ok: bool;
    public address: string;
    public witnessScript: Uint8Array;
    public csvBlocks: i64;
    public pubkey: Uint8Array | null;
    public constructor(
        ok: bool,
        address: string,
        witnessScript: Uint8Array,
        csvBlocks: i64,
        pubkey: Uint8Array | null,
    ) {
        this.ok = ok;
        this.address = address;
        this.witnessScript = witnessScript;
        this.csvBlocks = csvBlocks;
        this.pubkey = pubkey;
    }
}

@final
export class MultisigPairCrossCheck {
    public ok: bool;
    public m: i32;
    public n: i32;
    public address: string;
    public constructor(ok: bool, m: i32, n: i32, address: string) {
        this.ok = ok;
        this.m = m;
        this.n = n;
        this.address = address;
    }
}

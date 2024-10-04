import EventEmitter from "events";
import chunk from "lodash/chunk";

export const readArrayBufferAsUtf8 = (
  memory: WebAssembly.Memory,
  ptr: number
) => {
  return Buffer.from(
    Array.from(new Uint8Array(readArrayBuffer(memory, ptr)))
  ).toString("utf8");
};

export const readArrayBufferAsHex = (
  memory: WebAssembly.Memory,
  ptr: number
) => {
  return (
    "0x" +
    Buffer.from(
      Array.from(new Uint8Array(readArrayBuffer(memory, ptr)))
    ).toString("hex")
  );
};

export const toU32LEBytes = (n) => {
  const ary = new Uint32Array(1);
  ary[0] = n;
  const byteArray = new Uint8Array(ary.buffer);
  return Buffer.from(Array.from(byteArray));
};

export const readArrayBuffer = (memory: WebAssembly.Memory, ptr: number) => {
  const ary = Array.from(new Uint8Array(memory.buffer));
  const data = Buffer.from(ary);
  const length = data.readUInt32LE(ptr - 4);
  return new Uint8Array(ary.slice(ptr, ptr + length)).buffer;
};

const stripHexPrefix = (s) => (s.substr(0, 2) === "0x" ? s.substr(2) : s);
const addHexPrefix = (s) => (s.substr(0, 2) === "0x" ? s : "0x" + s);

export function toHex(v: Uint8Array): string {
  return addHexPrefix(Buffer.from(Array.from(v)).toString("hex"));
}

export function fromHex(v: string): Uint8Array {
  return new Uint8Array(Array.from(Buffer.from(stripHexPrefix(v), "hex")));
}

export class TestProgram extends EventEmitter {
  public block: string;
  public program: ArrayBuffer;
  public kv: any;
  public blockHeight: number;
  constructor(program: ArrayBuffer) {
    super();
    this.program = program;
    this.kv = {};
  }
  get memory() {
    return (this as any).instance.instance.exports.memory;
  }
  getStringFromPtr(ptr: number): string {
    const ary = Array.from(new Uint8Array(this.memory.buffer));
    const data = Buffer.from(ary);
    const length = data.readUInt32LE(ptr - 4);
    return Buffer.from(ary.slice(ptr, ptr + length)).toString("utf8");
  }
  load(data: number): void {
  }
  store(data: number): void {
  }
  deploy(data: number): void {
  }
  deployFromAddress(data: number): void {
  }
  call(data: number): void {}
  log(data: number) {
    const msg = this.getStringFromPtr(data);
    this.emit('log', msg);
  }
  abort(msgPtr: number) {
    const msg = this.getStringFromPtr(msgPtr);
    this.emit(`abort: ${msg}`);
    throw Error(`abort: ${msg}`);
  }
  setBlock(block: string): IndexerProgram {
    this.block = block;
    return this;
  }
  setBlockHeight(blockHeight: number): IndexerProgram {
    this.blockHeight = blockHeight;
    return this;
  }
  async run(symbol: string) {
    (this as any).instance = await WebAssembly.instantiate(this.program, {
      env: {
        abort: (...args) => (this as any).abort(...args),
        logStatic: (...args) => (this as any).log(...args),
	log: (...args) => (this as any).log(...args),
        store: (...args) => (this as any).store(...args),
        deploy: (...args) => (this as any).deploy(...args),
        deployFromAddress: (...args) => (this as any).deployFromAddress(...args),
        call: () => (this as any).callImport(),
        encodeAddress: (ptr: number) => (this as any).encodeAddress(ptr),
        sha256: (ptr: number) => (this as any).sha256(ptr),
      },
    });
    return await (this as any).instance.instance.exports[symbol]();
  }
}

import { encodeHex, encodeHexUTF8 } from './hex';

export function nullptr<T>(): T {
    return changetype<T>(0);
}

export class Box {
    public start: usize;
    public len: usize;

    constructor(start: usize, len: usize) {
        this.start = start;
        this.len = len;
    }

    static concat(data: Array<Box>): ArrayBuffer {
        const result = new ArrayBuffer(
            data.reduce<i32>((r: i32, v: Box, i: i32, ary: Array<Box>) => {
                return r + <i32>v.len;
            }, 0),
        );
        data.reduce<usize>((r: usize, v: Box, i: i32, ary: Array<Box>) => {
            memory.copy(r, v.start, v.len);
            return r + v.len;
        }, changetype<usize>(result));
        return result;
    }

    static from(data: ArrayBuffer): Box {
        return new Box(changetype<usize>(data), data.byteLength);
    }

    static copy(data: ArrayBuffer): Box {
        const ptr = heap.alloc(data.byteLength);
        memory.copy(ptr, changetype<usize>(data), <usize>data.byteLength);
        return new Box(ptr, <usize>data.byteLength);
    }

    static freeCopy(v: Box): void {
        heap.free(v.start);
    }

    static fromTyped<T>(v: T): Box {
        // const buffer = new ArrayBuffer(sizeof<T>(v));
        const buffer = new ArrayBuffer(offsetof<T>());
        store<T>(changetype<usize>(buffer), v);
        return Box.copy(buffer);
    }

    toHexString(): string {
        return encodeHex(this.start, this.len);
    }

    toHexUTF8(): ArrayBuffer {
        return encodeHexUTF8(this.start, this.len);
    }

    shift(): Box {
        if (this.len == 0) {
            return nullptr<Box>();
        }
        this.start = this.start + 1;
        this.len = this.len - 1;
        return this;
    }

    sliceFrom(start: usize): Box {
        return new Box(this.start + start, this.len - start);
    }

    sliceTo(ptr: usize): Box {
        if (ptr > this.start + this.len) {
            throw new Error('ptr is out of bounds');
        }
        return new Box(this.start, ptr - this.start);
    }

    shrinkFront(distance: usize): Box {
        this.start = this.start + distance;
        this.len = this.len - distance;
        return this;
    }

    growFront(distance: usize): Box {
        this.start = this.start - distance;
        this.len = this.len + distance;
        return this;
    }

    shrinkBack(distance: usize): Box {
        this.len = this.len - distance;
        return this;
    }

    growBack(distance: usize): Box {
        this.len = this.len + distance;
        return this;
    }

    setLength(len: usize): Box {
        this.len = len;
        return this;
    }

    toArrayBuffer(): ArrayBuffer {
        const result = new ArrayBuffer(<i32>this.len);
        memory.copy(changetype<usize>(result), this.start, this.len);
        return result;
    }

    isEmpty(): boolean {
        return this.len == 0;
    }
}

export class RCBox extends Box {
    public buffer: ArrayBuffer;

    constructor(v: ArrayBuffer) {
        super(changetype<usize>(v), <usize>v.byteLength);
        this.buffer = v;
    }

    static from(v: ArrayBuffer): RCBox {
        return new RCBox(v);
    }

    static fromTyped<T>(v: T): RCBox {
        // const buffer = new ArrayBuffer(sizeof<T>(v));
        const buffer = new ArrayBuffer(offsetof<T>());
        store<T>(changetype<usize>(buffer), v);
        return RCBox.from(buffer);
    }
}

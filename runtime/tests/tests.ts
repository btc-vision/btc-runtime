import { BytesWriter } from "../buffer/BytesWriter";
import { u256 } from "as-bignum/assembly";
import { Blockchain } from "../env";
import { Box } from "../utils/box";
import { log } from "./env";
import { assertEq } from "./assert";

export function test_encode(): void {
  const writer = new BytesWriter(64);
  writer.writeU256(u256.from(10));
  writer.writeU256(u256.from(20));
  const buffer = writer.getBuffer().buffer;
  assertEq(Box.from(buffer).toHexString(), "0x0a000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000");
}

export function test_log(): void {
  Blockchain.log("test logging test: OK!");
}

export function test_writeStringWithLength(): void {
  const s = 'test write';
  const writer = new BytesWriter(s.length + 2);
  writer.writeStringWithLength(s);
  assertEq(Box.from(writer.getBuffer().buffer).toHexString(), "0x0a0074657374207772697465");
}

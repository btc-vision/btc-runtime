import { BytesWriter } from "../buffer/BytesWriter";
import { u256 } from "as-bignum/assembly";
import { Blockchain } from "../env";
import { Box } from "../utils/box";
import { assertEq } from "./assert";

export function test_encode(): void {
  const writer = new BytesWriter(64);
  writer.writeU256(u256.from(10));
  writer.writeU256(u256.from(20));
  const buffer = writer.getBuffer().buffer;
  assertEq(Box.from(buffer).toHexString(), "0x0a000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000");
}

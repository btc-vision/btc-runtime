import { BytesWriter } from "./buffer/BytesWriter";
import { u256 } from "as-bignum/assembly";

export function test_encode(): void {
  const writer = new BytesWriter(32);
  writer.writeU256(u256.from(10));
}

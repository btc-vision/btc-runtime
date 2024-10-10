import { BytesWriter } from "../buffer/BytesWriter";
import { u256 } from "as-bignum/assembly";
import { Blockchain } from "../env";
import { Box } from "../utils/box";
import { log } from "./env";
import { assertEq } from "./assert";
import { sha256 } from "../utils/sha256";
import { StorageStruct } from "../storage/StorageStruct";
import { StorageLayout } from "../storage/StorageLayout";
import { StorageSlot } from "../storage/StorageSlot";
import { Serializable } from "../storage/Serializable";

export function test_encode(): void {
  const writer = new BytesWriter(64);
  writer.writeU256(u256.from(10));
  writer.writeU256(u256.from(20));
  const buffer = writer.getBuffer().buffer;
  assertEq(Box.from(buffer).toHexString(), "0x000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000014");
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

export function test_sha256(): void {
  const buffer = new ArrayBuffer(0x01);
  store<u8>(changetype<usize>(buffer), 0x01);
  assertEq(Box.from(sha256(buffer)).toHexString(), "0x4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a");
}

class TestStruct {
  public field: u256;
  constructor(ary: Array<u256>) {
    this.field = ary[0];
  }
  serialize(): Array<u256> {
    const ary = new Array<u256>(0);
    ary.push(u256.from(1));
  }
}

export function test_storagestruct(): void {
  const layout = new StorageLayout();
  StorageStruct.load<TestStruct>(StorageSlot.at(layout.next()));
}

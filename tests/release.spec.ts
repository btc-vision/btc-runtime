import { TestProgram } from "./lib";
import path from "path";
import fs from "fs-extra";
import { EventEmitter } from "events";


const makeProgram = (binary) => {
  const program = new TestProgram(
    new Uint8Array(Array.from(binary)).buffer,
  );
  program.on("log", (v) => console.log(v));
  return program;
};

describe("btc-runtime", () => {
  const makeTest = (s) =>
    it(s, async () => {
      const binary = await fs.readFile('./build/tests.wasm');
      const program = makeProgram(binary);
      const result = await program.run(s);
    });
  [
    "test_encode",
    "test_log",
    "test_writeStringWithLength"
  ].forEach((v) => makeTest(v))
});

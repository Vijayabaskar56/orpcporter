import { test, expect, afterEach } from "bun:test";
import { compileCLI } from "./compiler";
import { rmSync, existsSync } from "fs";

const TEST_OUTPUT = "/tmp/orpc-test-cli";

afterEach(() => {
  rmSync(TEST_OUTPUT, { force: true });
  rmSync(`${TEST_OUTPUT}.ts`, { force: true });
});

test("compileCLI creates executable binary", async () => {
  const source = `#!/usr/bin/env bun\nconsole.log("Hello from generated CLI");\n`;
  await compileCLI(source, TEST_OUTPUT);
  expect(existsSync(TEST_OUTPUT)).toBe(true);
});

test("compileCLI binary is executable", async () => {
  const source = `#!/usr/bin/env bun\nconsole.log("test-output");\n`;
  await compileCLI(source, TEST_OUTPUT);
  const proc = Bun.spawn([TEST_OUTPUT], { stdout: "pipe" });
  const output = await new Response(proc.stdout).text();
  expect(output.trim()).toBe("test-output");
});

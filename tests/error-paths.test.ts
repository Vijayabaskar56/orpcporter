import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { mkdirSync, rmSync, writeFileSync, chmodSync } from "fs";

const PROJECT_ROOT = "/Users/vijayabaskar/work/orpc-cli";
const TEST_DIR = "/tmp/orpc-error-paths-test";

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  // Restore permissions before cleanup in case chmod test left restricted files
  try {
    chmodSync(`${TEST_DIR}/noperm.json`, 0o644);
  } catch {
    // File may not exist
  }
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("error paths", () => {
  // Network errors
  test("generate errors on unreachable URL", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "index.ts", "generate",
        "https://nonexistent.invalid/spec.json",
        "--name", "fail",
        "--output", TEST_DIR,
      ],
      { stdout: "pipe", stderr: "pipe", cwd: PROJECT_ROOT }
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Error");
  }, 30000);

  test("extract errors on unreachable URL", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "index.ts", "extract",
        "https://nonexistent.invalid/spec.json",
      ],
      { stdout: "pipe", stderr: "pipe", cwd: PROJECT_ROOT }
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Error");
  }, 30000);

  // Malformed JSON spec
  test("errors on malformed JSON file", async () => {
    const malformedPath = `${TEST_DIR}/malformed.json`;
    writeFileSync(malformedPath, "{not valid json");

    const proc = Bun.spawn(
      [
        "bun", "run", "index.ts", "generate",
        malformedPath,
        "--name", "fail",
        "--output", TEST_DIR,
      ],
      { stdout: "pipe", stderr: "pipe", cwd: PROJECT_ROOT }
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Error");
  }, 15000);

  // Valid JSON but not OpenAPI
  test("errors on valid JSON without openapi/swagger field", async () => {
    const notOpenapiPath = `${TEST_DIR}/not-openapi.json`;
    writeFileSync(notOpenapiPath, '{"name":"test","version":"1.0"}');

    const proc = Bun.spawn(
      [
        "bun", "run", "index.ts", "generate",
        notOpenapiPath,
        "--name", "fail",
        "--output", TEST_DIR,
      ],
      { stdout: "pipe", stderr: "pipe", cwd: PROJECT_ROOT }
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Error");
  }, 15000);

  // Missing spec URL
  test("extract errors when no URL provided", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "index.ts", "extract"],
      { stdout: "pipe", stderr: "pipe", cwd: PROJECT_ROOT }
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage");
  }, 15000);

  test("generate errors when no source provided", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "index.ts", "generate"],
      { stdout: "pipe", stderr: "pipe", cwd: PROJECT_ROOT }
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage");
  }, 15000);

  // File permission denied
  test("errors when spec file has no read permissions", async () => {
    const nopermPath = `${TEST_DIR}/noperm.json`;
    writeFileSync(
      nopermPath,
      '{"openapi":"3.0.0","info":{"title":"Test","version":"1.0"},"paths":{}}'
    );
    chmodSync(nopermPath, 0o000);

    try {
      const proc = Bun.spawn(
        [
          "bun", "run", "index.ts", "generate",
          nopermPath,
          "--name", "fail",
          "--output", TEST_DIR,
        ],
        { stdout: "pipe", stderr: "pipe", cwd: PROJECT_ROOT }
      );
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Error");
    } finally {
      chmodSync(nopermPath, 0o644);
    }
  }, 15000);

  // HTTP error (non-200 response)
  test("errors on HTTP 404 response", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "index.ts", "generate",
        "https://httpstat.us/404",
        "--name", "fail",
        "--output", TEST_DIR,
      ],
      { stdout: "pipe", stderr: "pipe", cwd: PROJECT_ROOT }
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Error");
  }, 30000);
});

import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { mkdirSync, rmSync } from "fs";

const PROJECT_ROOT = "/Users/vijayabaskar/work/orpc-cli";
const TEST_DIR = "/tmp/orpc-main-entry-test";

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("main entry point", () => {
  // Help output
  test("shows help with --help flag and exits 0", async () => {
    const proc = Bun.spawn(["bun", "run", "index.ts", "--help"], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: PROJECT_ROOT,
    });
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdout).toContain("orpcport");
    expect(stdout).toContain("extract");
    expect(stdout).toContain("generate");
  }, 15000);

  test("shows help with -h flag and exits 0", async () => {
    const proc = Bun.spawn(["bun", "run", "index.ts", "-h"], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: PROJECT_ROOT,
    });
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdout).toContain("orpcport");
  }, 15000);

  test("shows help but exits 1 when no args provided", async () => {
    const proc = Bun.spawn(["bun", "run", "index.ts"], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: PROJECT_ROOT,
    });
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(1);
    expect(stdout).toContain("orpcport");
  }, 15000);

  // Unknown command
  test("errors on unknown command with nonzero exit", async () => {
    const proc = Bun.spawn(["bun", "run", "index.ts", "foobar"], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: PROJECT_ROOT,
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown command: foobar");
    expect(stderr).toContain("Run 'orpcport --help' for usage");
  }, 15000);

  // Extract without URL
  test("errors when extract has no URL argument", async () => {
    const proc = Bun.spawn(["bun", "run", "index.ts", "extract"], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: PROJECT_ROOT,
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage: orpcport extract");
  }, 15000);

  // Generate without source
  test("errors when generate has no source argument", async () => {
    const proc = Bun.spawn(["bun", "run", "index.ts", "generate"], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: PROJECT_ROOT,
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage: orpcport generate");
  }, 15000);

  // Generate with invalid name
  test("errors when --name contains path traversal characters", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "index.ts", "generate", "https://example.com", "--name", "../bad"],
      {
        stdout: "pipe",
        stderr: "pipe",
        cwd: PROJECT_ROOT,
      }
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("must contain only letters, numbers");
  }, 15000);

  // Generate with nonexistent output directory
  test("errors when --output directory does not exist", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "index.ts", "generate", "https://example.com",
        "--output", "/tmp/nonexistent-dir-xyz-orpc",
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
        cwd: PROJECT_ROOT,
      }
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Output directory does not exist");
  }, 15000);

  // Generate with nonexistent local file
  test("errors when local spec file does not exist", async () => {
    const proc = Bun.spawn(
      [
        "bun", "run", "index.ts", "generate",
        "/tmp/nonexistent-spec-orpc.json",
        "--name", "test",
        "--output", TEST_DIR,
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
        cwd: PROJECT_ROOT,
      }
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Error");
  }, 15000);
});

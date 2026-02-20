import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "fs";

const PROJECT_ROOT = "/Users/vijayabaskar/work/orpc-cli";
const TEST_DIR = "/tmp/orpc-real-world-specs";

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("real-world OpenAPI specs", () => {
  test("generates CLI from Stripe OpenAPI spec", async () => {
    const specDir = `${TEST_DIR}/stripe`;
    mkdirSync(specDir, { recursive: true });

    const proc = Bun.spawn(
      [
        "bun", "run", "index.ts", "generate",
        "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json",
        "--name", "stripe-test",
        "--output", specDir,
        "--force",
      ],
      { stdout: "pipe", stderr: "pipe", cwd: PROJECT_ROOT }
    );

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      console.error("Stripe generation failed:", stderr);
    }

    expect(exitCode).toBe(0);
    expect(existsSync(`${specDir}/stripe-test`)).toBe(true);
    expect(existsSync(`${specDir}/stripe-test.1`)).toBe(true);

    // Verify generated CLI works
    const helpProc = Bun.spawn([`${specDir}/stripe-test`, "--help"], {
      stdout: "pipe",
    });
    const helpOutput = await new Response(helpProc.stdout).text();
    expect(helpOutput).toContain("stripe-test");
  }, 180000);

  test("reports clear error for GitHub REST API spec (exceeds path limit)", async () => {
    const specDir = `${TEST_DIR}/github`;
    mkdirSync(specDir, { recursive: true });

    // GitHub REST API has 721 paths, exceeding the 500-path limit.
    // This tests that the tool produces a clear, actionable error for oversized specs.
    const proc = Bun.spawn(
      [
        "bun", "run", "index.ts", "generate",
        "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json",
        "--name", "github-test",
        "--output", specDir,
        "--force",
      ],
      { stdout: "pipe", stderr: "pipe", cwd: PROJECT_ROOT }
    );

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("exceeds maximum");
  }, 60000);

  test("generates CLI from Petstore OpenAPI spec (baseline)", async () => {
    const specDir = `${TEST_DIR}/petstore`;
    mkdirSync(specDir, { recursive: true });

    const proc = Bun.spawn(
      [
        "bun", "run", "index.ts", "generate",
        "https://petstore3.swagger.io/api/v3/openapi.json",
        "--name", "petstore-test",
        "--output", specDir,
        "--force",
      ],
      { stdout: "pipe", stderr: "pipe", cwd: PROJECT_ROOT }
    );

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      console.error("Petstore generation failed:", stderr);
    }

    expect(exitCode).toBe(0);
    expect(existsSync(`${specDir}/petstore-test`)).toBe(true);
    expect(existsSync(`${specDir}/petstore-test.1`)).toBe(true);

    // Verify generated CLI works
    const helpProc = Bun.spawn([`${specDir}/petstore-test`, "--help"], {
      stdout: "pipe",
    });
    const helpOutput = await new Response(helpProc.stdout).text();
    expect(helpOutput).toContain("petstore-test");
  }, 60000);

  test("generates CLI from Twilio API OpenAPI spec", async () => {
    const specDir = `${TEST_DIR}/twilio`;
    mkdirSync(specDir, { recursive: true });

    const proc = Bun.spawn(
      [
        "bun", "run", "index.ts", "generate",
        "https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json",
        "--name", "twilio-test",
        "--output", specDir,
        "--force",
      ],
      { stdout: "pipe", stderr: "pipe", cwd: PROJECT_ROOT }
    );

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      console.error("Twilio generation failed:", stderr);
    }

    expect(exitCode).toBe(0);
    expect(existsSync(`${specDir}/twilio-test`)).toBe(true);
    expect(existsSync(`${specDir}/twilio-test.1`)).toBe(true);

    // Verify generated CLI works
    const helpProc = Bun.spawn([`${specDir}/twilio-test`, "--help"], {
      stdout: "pipe",
    });
    const helpOutput = await new Response(helpProc.stdout).text();
    expect(helpOutput).toContain("twilio-test");
  }, 120000);
});

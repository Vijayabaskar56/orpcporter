import { test, expect, afterAll } from "bun:test";
import { rmSync, existsSync, mkdirSync, writeFileSync } from "fs";

const TEST_DIR = "/tmp/orpc-integration-test";
const TEST_SPEC = {
  openapi: "3.1.0",
  info: { title: "Test API", version: "1.0.0", description: "Integration test API" },
  servers: [{ url: "https://jsonplaceholder.typicode.com" }],
  paths: {
    "/posts": {
      get: {
        operationId: "listPosts",
        description: "List all posts",
        parameters: [
          { name: "_limit", in: "query", schema: { type: "number" } }
        ],
        responses: { "200": { description: "Success" } },
      },
    },
    "/posts/{id}": {
      get: {
        operationId: "getPost",
        description: "Get a post by ID",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "Success" } },
      },
    },
  },
};

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

test("full generation pipeline", async () => {
  mkdirSync(TEST_DIR, { recursive: true });

  // Write test spec
  const specPath = `${TEST_DIR}/spec.json`;
  writeFileSync(specPath, JSON.stringify(TEST_SPEC));

  // Generate CLI
  const proc = Bun.spawn([
    "bun", "run", "index.ts", "generate", specPath, "--name", "test-api", "--output", TEST_DIR, "--force"
  ], { stdout: "pipe", stderr: "pipe", cwd: "/Users/vijayabaskar/work/orpc-cli" });

  await proc.exited;

  // Check binary exists
  expect(existsSync(`${TEST_DIR}/test-api`)).toBe(true);
  expect(existsSync(`${TEST_DIR}/test-api.1`)).toBe(true);
}, 60000);

test("generated CLI shows help", async () => {
  const proc = Bun.spawn([`${TEST_DIR}/test-api`, "--help"], { stdout: "pipe" });
  const output = await new Response(proc.stdout).text();

  expect(output).toContain("test-api");
  expect(output).toContain("posts");
}, 15000);

test("generated CLI shows version", async () => {
  const proc = Bun.spawn([`${TEST_DIR}/test-api`, "--version"], { stdout: "pipe" });
  const output = await new Response(proc.stdout).text();

  expect(output.trim()).toBe("test-api v1.0.0");
}, 15000);

test("generated CLI makes real API call", async () => {
  const proc = Bun.spawn([`${TEST_DIR}/test-api`, "posts", "get", "1"], { stdout: "pipe" });
  const output = await new Response(proc.stdout).text();
  const data = JSON.parse(output);

  expect(data.id).toBe(1);
  expect(data.title).toBeDefined();
}, 15000);

test("generates CLI from remote URL with complex spec", async () => {
  const remoteDir = `${TEST_DIR}/remote`;
  mkdirSync(remoteDir, { recursive: true });

  // Generate CLI from real remote spec (Swagger's official petstore demo)
  const proc = Bun.spawn([
    "bun", "run", "index.ts", "generate",
    "https://petstore3.swagger.io/api/v3/openapi.json",
    "--name", "petstore-test",
    "--output", remoteDir,
    "--force"
  ], { stdout: "pipe", stderr: "pipe", cwd: "/Users/vijayabaskar/work/orpc-cli" });

  await proc.exited;

  // Check binary exists
  expect(existsSync(`${remoteDir}/petstore-test`)).toBe(true);
  expect(existsSync(`${remoteDir}/petstore-test.1`)).toBe(true);

  // Test help works
  const helpProc = Bun.spawn([`${remoteDir}/petstore-test`, "--help"], { stdout: "pipe" });
  const helpOutput = await new Response(helpProc.stdout).text();

  expect(helpOutput).toContain("petstore-test");
  expect(helpOutput).toContain("pet");
}, 60000);

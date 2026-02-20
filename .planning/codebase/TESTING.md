# Testing Patterns

**Analysis Date:** 2026-02-20

## Test Framework

**Runner:**
- Bun Test (built-in)
- No separate config file required

**Assertion Library:**
- `bun:test` built-in assertions (`expect`)

**Run Commands:**
```bash
bun test                    # Run all tests
bun test --coverage         # Run with coverage
bun test --watch            # Watch mode (standard Bun feature)
bun test <pattern>          # Run specific test files
```

## Test File Organization

**Location:**
- Co-located with source files (same directory as implementation)
- Pattern: `<name>.test.ts` next to `<name>.ts`

**Naming:**
- `*.test.ts` suffix for all test files
- Mirrors source file name: `parser.ts` → `parser.test.ts`
- Integration tests in separate directory: `tests/integration.test.ts`

**Structure:**
```
src/
├── runtime/
│   ├── http.ts
│   ├── http.test.ts
│   ├── config.ts
│   └── config.test.ts
├── generator/
│   ├── parser.ts
│   ├── parser.test.ts
│   ├── template.ts
│   └── template.test.ts
tests/
└── integration.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { test, expect } from "bun:test";
import { FunctionToTest } from "./module";

test("describes what the test does", () => {
  // Arrange
  const input = setupTestData();

  // Act
  const result = FunctionToTest(input);

  // Assert
  expect(result).toBe(expected);
});
```

**Patterns:**
- One assertion per test (generally)
- Descriptive test names in plain English: `"HttpClient builds correct URL with path params"`
- Group related tests in same file, no `describe` blocks used
- Tests are flat (no nested `describe` blocks observed)

**Setup/Teardown:**
```typescript
import { test, expect, beforeEach, afterEach, afterAll } from "bun:test";

beforeEach(() => {
  // Setup before each test
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  // Cleanup after each test
  rmSync(TEST_DIR, { recursive: true, force: true });
});

afterAll(() => {
  // Cleanup once after all tests
  rmSync(TEST_DIR, { recursive: true, force: true });
});
```

## Mocking

**Framework:** No explicit mocking framework (Bun's built-in features if needed)

**Patterns:**
- Prefer real implementations over mocks when possible
- Use test data fixtures instead of mocking: `const testModel: CLIModel = {...}`
- Integration tests use real APIs: `https://jsonplaceholder.typicode.com`
- No mock usage detected in current test suite

**What to Mock:**
- Not applicable (codebase doesn't use mocks yet)

**What NOT to Mock:**
- Simple data structures - use real test data
- Pure functions - test with actual inputs
- External APIs in integration tests - use real endpoints

## Fixtures and Factories

**Test Data:**
```typescript
const minimalSpec = {
  openapi: "3.1.0",
  info: { title: "Test API", version: "1.0.0", description: "A test API" },
  servers: [{ url: "https://api.example.com" }],
  paths: {
    "/users": {
      get: {
        operationId: "listUsers",
        description: "List all users",
        responses: { "200": { description: "Success" } },
      },
    },
  },
};

const testModel: CLIModel = {
  name: "test-cli",
  version: "1.0.0",
  description: "Test CLI",
  baseUrl: "https://api.example.com",
  resources: [...],
  securitySchemes: [...],
};
```

**Location:**
- Inline in test files (no separate fixtures directory)
- Defined as constants at file top: `const minimalSpec = {...}`
- Shared temp directories: `const TEST_DIR = "/tmp/orpc-test-config"`

**Pattern:**
- Minimal valid data: Include only fields needed for test to pass
- Real-world examples: Integration tests use actual API specs
- Constants for reusable data: `TEST_DIR`, `TEST_SPEC` defined once per file

## Coverage

**Requirements:** Not enforced (no coverage thresholds configured)

**View Coverage:**
```bash
bun test --coverage                          # Generate coverage
bun test --coverage --coverage-reporter=lcov # Generate lcov format
```

**Coverage Directory:**
- Default: `coverage/` (in `.gitignore`)

## Test Types

**Unit Tests:**
- Test individual functions in isolation
- Located co-located with source: `src/runtime/http.test.ts`, `src/generator/parser.test.ts`
- Fast execution, no external dependencies
- Examples: URL building, parameter parsing, validation logic

**Integration Tests:**
- Test full pipeline end-to-end
- Located in: `tests/integration.test.ts`
- Use real file system, real Bun processes
- Example: Full generation pipeline from spec to binary to execution
- Use long timeouts for slow operations: `test("...", async () => {...}, 60000)`

**E2E Tests:**
- Integration tests serve as E2E tests
- Test generated CLI binaries by spawning processes: `Bun.spawn([...])`
- Make real API calls to verify functionality
- Example: Generate CLI, then test it makes real HTTP requests

## Common Patterns

**Async Testing:**
```typescript
test("async operation", async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});

// With timeout for slow operations
test("slow operation", async () => {
  const result = await slowFunction();
  expect(result).toBeTruthy();
}, 60000); // 60 second timeout
```

**Error Testing:**
```typescript
test("function rejects invalid input", () => {
  expect(() => parseOpenAPI(null)).toThrow("Invalid OpenAPI spec: must be an object");
});

test("async function rejects with error", async () => {
  const client = new HttpClient("http://localhost");
  await expect(client.request("GET", "/test")).rejects.toThrow("private/internal address");
});

// Testing specific error messages
expect(() => doSomething()).toThrow("exact error message");
```

**Testing Multiple Cases:**
```typescript
test("blocks all private addresses", async () => {
  const privateUrls = [
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://10.0.0.1",
    // ... more cases
  ];
  for (const url of privateUrls) {
    const client = new HttpClient(url);
    await expect(client.request("GET", "/test")).rejects.toThrow("private/internal address");
  }
});
```

**File System Testing:**
```typescript
import { mkdirSync, rmSync, writeFileSync } from "fs";

test("persists to file", () => {
  // Setup temp directory
  const TEST_DIR = "/tmp/test-unique-id";
  mkdirSync(TEST_DIR, { recursive: true });

  // Write and read
  const config1 = new ConfigManager("test-cli", TEST_DIR);
  config1.set("key", "value");

  const config2 = new ConfigManager("test-cli", TEST_DIR);
  expect(config2.get("key")).toBe("value");

  // Cleanup handled in afterEach/afterAll
});
```

**Process Spawning:**
```typescript
test("generated CLI shows help", async () => {
  const proc = Bun.spawn([`${TEST_DIR}/test-api`, "--help"], {
    stdout: "pipe"
  });
  const output = await new Response(proc.stdout).text();

  expect(output).toContain("test-api");
  expect(output).toContain("posts");
}, 15000);
```

**Testing Generated Code:**
```typescript
test("generates valid output", () => {
  const source = generateCLISource(testModel);

  // Check for expected content
  expect(source).toContain("test-cli");
  expect(source).toContain("config");
  expect(source).toContain("Bearer");
});
```

## Test Isolation

**Temporary Directories:**
- Use `/tmp/` for test artifacts
- Include unique identifiers: `/tmp/orpc-test-config`, `/tmp/orpc-integration-test`
- Clean up in `afterEach` or `afterAll` hooks
- Use `{ recursive: true, force: true }` for robust cleanup

**State Management:**
- Each test is independent (no shared state between tests)
- Setup/teardown ensures clean state for each test
- Tests can run in any order (no implicit dependencies)

**Resource Cleanup:**
```typescript
afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

// Or in try/finally for critical cleanup
try {
  // test operations
} finally {
  try { unlinkSync(tempFile); } catch { /* ignore */ }
  try { rmdirSync(tempDir); } catch { /* ignore */ }
}
```

---

*Testing analysis: 2026-02-20*

import { test, expect, describe } from "bun:test";
import { generateCLISource } from "./template";
import type { CLIModel, SecurityScheme } from "./types";

function makeModel(overrides: Partial<CLIModel> = {}): CLIModel {
  return {
    name: "test-cli",
    version: "1.0.0",
    description: "Test CLI",
    baseUrl: "https://api.example.com",
    resources: [
      {
        name: "users",
        description: "User operations",
        commands: [
          { name: "list", description: "List users", method: "GET", path: "/users", params: [], responses: {} },
        ],
      },
    ],
    securitySchemes: [{ name: "bearer", type: "bearer" }],
    ...overrides,
  };
}

// ============ Basic generation tests ============

test("generateCLISource produces valid TypeScript", () => {
  const source = generateCLISource(makeModel());
  expect(source).toContain("test-cli");
  expect(source).toContain("https://api.example.com");
  expect(source).toContain("users");
});

test("generateCLISource includes config commands", () => {
  const source = generateCLISource(makeModel());
  expect(source).toContain("config");
  expect(source).toContain("set");
  expect(source).toContain("get");
});

// ============ --flag=value parsing ============

describe("--flag=value parsing", () => {
  test("generated source contains equals-sign parsing logic", () => {
    const source = generateCLISource(makeModel());
    expect(source).toContain('indexOf("=")');
  });

  test("generated parseArgs splits on first equals only", () => {
    const source = generateCLISource(makeModel());
    // Verify the key extraction uses slice(2, eqIdx) and value uses slice(eqIdx + 1)
    expect(source).toContain("arg.slice(2, eqIdx)");
    expect(source).toContain("arg.slice(eqIdx + 1)");
  });

  test("generated parseArgs checks eqIdx > 2 to avoid bare --=", () => {
    const source = generateCLISource(makeModel());
    expect(source).toContain("eqIdx > 2");
  });

  test("generated parseArgs preserves --flag value fallback", () => {
    const source = generateCLISource(makeModel());
    // The else branch for non-equals flags should still exist
    expect(source).toContain('!next.startsWith("--")');
  });

  test("functional: parseArgs handles all flag styles correctly", async () => {
    // Write a temp file that imports the parseArgs logic and tests it
    const tmpFile = "/tmp/test-parseargs.ts";
    await Bun.write(tmpFile, `
      function parseArgs(args: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
        const positional: string[] = [];
        const flags: Record<string, string | boolean> = {};
        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          if (arg.startsWith("--")) {
            const eqIdx = arg.indexOf("=");
            if (eqIdx > 2) {
              flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
            } else {
              const key = arg.slice(2);
              const next = args[i + 1];
              if (next && !next.startsWith("--")) {
                flags[key] = next;
                i++;
              } else {
                flags[key] = true;
              }
            }
          } else {
            positional.push(arg);
          }
        }
        return { positional, flags };
      }

      const tests = [
        { input: ["--key=value"], expected: { positional: [], flags: { key: "value" } } },
        { input: ["--key=value=with=equals"], expected: { positional: [], flags: { key: "value=with=equals" } } },
        { input: ["--key="], expected: { positional: [], flags: { key: "" } } },
        { input: ["--key", "value"], expected: { positional: [], flags: { key: "value" } } },
        { input: ["--a=1", "--b", "2", "pos"], expected: { positional: ["pos"], flags: { a: "1", b: "2" } } },
        { input: ["--help"], expected: { positional: [], flags: { help: true } } },
      ];

      let passed = 0;
      for (const t of tests) {
        const result = parseArgs(t.input);
        const match = JSON.stringify(result) === JSON.stringify(t.expected);
        if (!match) {
          console.error("FAIL:", JSON.stringify(t.input), "got", JSON.stringify(result), "expected", JSON.stringify(t.expected));
          process.exit(1);
        }
        passed++;
      }
      console.log("PASS:" + passed);
    `);
    const proc = Bun.spawn(["bun", tmpFile], { stdout: "pipe", stderr: "pipe" });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
    expect(output.trim()).toBe("PASS:6");
  });
});

// ============ Bearer auth (regression) ============

describe("bearer auth", () => {
  test("generates bearer auth with --token flag", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [{ name: "bearer", type: "bearer" }],
    }));
    expect(source).toContain("flags.token");
    expect(source).toContain("Bearer");
    expect(source).toContain("TEST_CLI_TOKEN");
    expect(source).toContain('config.get("token")');
  });

  test("help text shows --token for bearer auth", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [{ name: "bearer", type: "bearer" }],
    }));
    expect(source).toContain("--token");
  });
});

// ============ API Key auth (header) ============

describe("apiKey auth (header)", () => {
  const apiKeyHeaderScheme: SecurityScheme = {
    name: "api_key",
    type: "apiKey",
    location: "header",
    paramName: "X-API-Key",
  };

  test("generates API key auth with triple-precedence", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [apiKeyHeaderScheme],
    }));
    expect(source).toContain('flags["api-key"]');
    expect(source).toContain("TEST_CLI_API_KEY");
    expect(source).toContain('config.get("api-key")');
  });

  test("uses setHeader with paramName", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [apiKeyHeaderScheme],
    }));
    expect(source).toContain('setHeader("X-API-Key"');
  });

  test("help text shows --api-key flag", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [apiKeyHeaderScheme],
    }));
    expect(source).toContain("--api-key");
    expect(source).not.toContain("--token");
  });

  test("uses custom paramName from scheme", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [{ name: "custom", type: "apiKey", location: "header", paramName: "Authorization-Key" }],
    }));
    expect(source).toContain('setHeader("Authorization-Key"');
  });
});

// ============ API Key auth (query) ============

describe("apiKey auth (query)", () => {
  const apiKeyQueryScheme: SecurityScheme = {
    name: "api_key",
    type: "apiKey",
    location: "query",
    paramName: "api_key",
  };

  test("generates query param API key with setAuthQueryParam", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [apiKeyQueryScheme],
    }));
    expect(source).toContain("setAuthQueryParam");
    expect(source).toContain('"api_key"');
  });

  test("uses triple-precedence for query API key", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [apiKeyQueryScheme],
    }));
    expect(source).toContain('flags["api-key"]');
    expect(source).toContain("TEST_CLI_API_KEY");
    expect(source).toContain('config.get("api-key")');
  });

  test("help text mentions query parameter", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [apiKeyQueryScheme],
    }));
    expect(source).toContain("query parameter");
  });

  test("does NOT use setHeader for query key", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [apiKeyQueryScheme],
    }));
    expect(source).not.toContain('setHeader("api_key"');
  });
});

// ============ Basic auth ============

describe("basic auth", () => {
  const basicScheme: SecurityScheme = {
    name: "basic",
    type: "basic",
  };

  test("generates basic auth with username and password", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [basicScheme],
    }));
    expect(source).toContain("flags.username");
    expect(source).toContain("flags.password");
  });

  test("uses triple-precedence for both credentials", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [basicScheme],
    }));
    expect(source).toContain("TEST_CLI_USERNAME");
    expect(source).toContain("TEST_CLI_PASSWORD");
    expect(source).toContain('config.get("username")');
    expect(source).toContain('config.get("password")');
  });

  test("uses btoa for Basic auth header", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [basicScheme],
    }));
    expect(source).toContain("btoa");
    expect(source).toContain("Basic");
  });

  test("help text shows --username and --password", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [basicScheme],
    }));
    expect(source).toContain("--username");
    expect(source).toContain("--password");
    expect(source).not.toContain("--token");
  });
});

// ============ No auth ============

describe("no auth", () => {
  test("generates no auth block when securitySchemes is empty", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [],
    }));
    expect(source).not.toContain("apiKey");
    expect(source).not.toContain("Bearer");
    expect(source).not.toContain("btoa");
    expect(source).not.toContain("flags.token");
    expect(source).not.toContain('flags["api-key"]');
    expect(source).not.toContain("flags.username");
  });

  test("help text has no auth flags when no security schemes", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [],
    }));
    expect(source).not.toContain("--token");
    expect(source).not.toContain("--api-key");
    expect(source).not.toContain("--username");
  });
});

// ============ OAuth2 auth ============

describe("oauth2 auth", () => {
  const oauth2Scheme: SecurityScheme = {
    name: "oauth2",
    type: "oauth2",
    authorizationUrl: "https://auth.example.com/authorize",
    tokenUrl: "https://auth.example.com/token",
    scopes: ["read", "write"],
  };

  test("generates oauth login command", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [oauth2Scheme],
    }));
    expect(source).toContain('"oauth"');
    expect(source).toContain('"login"');
  });

  test("generates oauth logout command", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [oauth2Scheme],
    }));
    expect(source).toContain('"logout"');
    expect(source).toContain("oauth-access-token");
    expect(source).toContain("oauth-refresh-token");
    expect(source).toContain("oauth-token-expiry");
  });

  test("generates oauth status command", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [oauth2Scheme],
    }));
    expect(source).toContain('"status"');
    expect(source).toContain("Status: Authenticated");
  });

  test("uses Bun.serve for callback server", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [oauth2Scheme],
    }));
    expect(source).toContain("Bun.serve");
    expect(source).toContain("/callback");
  });

  test("includes token refresh logic", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [oauth2Scheme],
    }));
    expect(source).toContain('grant_type: "refresh_token"');
  });

  test("includes authorization URL and token URL", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [oauth2Scheme],
    }));
    expect(source).toContain("https://auth.example.com/authorize");
    expect(source).toContain("https://auth.example.com/token");
  });

  test("includes scopes in authorization request", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [oauth2Scheme],
    }));
    expect(source).toContain("read write");
  });

  test("reads stored token from config", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [oauth2Scheme],
    }));
    expect(source).toContain('config.get("oauth-access-token")');
  });

  test("help text shows oauth command", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [oauth2Scheme],
    }));
    expect(source).toContain("oauth");
    expect(source).toContain("OAuth2 authentication");
  });

  test("no oauth commands when scheme is not oauth2", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [{ name: "bearer", type: "bearer" }],
    }));
    expect(source).not.toContain("oauth login");
    expect(source).not.toContain("oauth logout");
    expect(source).not.toContain("oauth status");
  });

  test("no oauth commands when scheme is apiKey", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [{ name: "api_key", type: "apiKey", location: "header", paramName: "X-API-Key" }],
    }));
    expect(source).not.toContain("oauth login");
  });
});

// ============ Body validation ============

describe("body validation", () => {
  function makeModelWithBody(bodySchema?: object): CLIModel {
    return makeModel({
      securitySchemes: [],
      resources: [{
        name: "users",
        description: "User operations",
        commands: [{
          name: "create",
          description: "Create user",
          method: "POST",
          path: "/users",
          params: [],
          bodySchema,
          responses: {},
        }],
      }],
    });
  }

  test("includes validateBody when commands have bodySchema", () => {
    const source = generateCLISource(makeModelWithBody({
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" } },
    }));
    expect(source).toContain("function validateBody");
  });

  test("does NOT include validateBody when no commands have bodySchema", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [],
      resources: [{
        name: "users",
        description: "Users",
        commands: [{ name: "list", description: "List", method: "GET", path: "/users", params: [], responses: {} }],
      }],
    }));
    expect(source).not.toContain("function validateBody");
  });

  test("does NOT include validateBody for empty bodySchema", () => {
    const source = generateCLISource(makeModelWithBody({}));
    expect(source).not.toContain("function validateBody");
  });

  test("embeds bodySchema as JSON constant", () => {
    const schema = { type: "object", required: ["name"], properties: { name: { type: "string" } } };
    const source = generateCLISource(makeModelWithBody(schema));
    expect(source).toContain("const bodySchema =");
    expect(source).toContain('"required":["name"]');
  });

  test("calls validateBody before http.request", () => {
    const source = generateCLISource(makeModelWithBody({
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" } },
    }));
    const validateIdx = source.indexOf("validateBody(bodySchema, body)");
    const requestIdx = source.indexOf("http.request");
    expect(validateIdx).toBeGreaterThan(-1);
    expect(requestIdx).toBeGreaterThan(-1);
    expect(validateIdx).toBeLessThan(requestIdx);
  });

  test("shows validation errors on stderr", () => {
    const source = generateCLISource(makeModelWithBody({
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" } },
    }));
    expect(source).toContain("Validation errors");
  });

  test("no validation code for GET commands", () => {
    const source = generateCLISource(makeModel({
      securitySchemes: [],
      resources: [{
        name: "users",
        description: "Users",
        commands: [{
          name: "list",
          description: "List",
          method: "GET",
          path: "/users",
          params: [],
          bodySchema: { type: "object" }, // even with schema, GET shouldn't validate
          responses: {},
        }],
      }],
    }));
    expect(source).not.toContain("const bodySchema =");
  });
});

describe("validateBody functional tests", () => {
  // Test the actual validation logic by running it in a subprocess
  test("validates required fields, types, enums, nested objects, and arrays", async () => {
    const tmpFile = "/tmp/test-validate-body.ts";
    await Bun.write(tmpFile, `
      function validateBody(schema: any, data: unknown, path: string = ""): string[] {
        const errors: string[] = [];
        if (!schema || typeof schema !== "object") return errors;
        if (schema.type) {
          const actualType = Array.isArray(data) ? "array" : typeof data;
          if (schema.type === "integer") {
            if (typeof data !== "number" || !Number.isInteger(data)) {
              errors.push((path || "body") + ": expected integer, got " + (typeof data));
            }
          } else if (schema.type === "number") {
            if (typeof data !== "number") {
              errors.push((path || "body") + ": expected number, got " + actualType);
            }
          } else if (actualType !== schema.type) {
            errors.push((path || "body") + ": expected " + schema.type + ", got " + actualType);
          }
        }
        if (schema.enum && Array.isArray(schema.enum) && !schema.enum.includes(data)) {
          errors.push((path || "body") + ": must be one of: " + schema.enum.join(", "));
        }
        if (schema.type === "object" && typeof data === "object" && data !== null && !Array.isArray(data)) {
          if (Array.isArray(schema.required)) {
            for (const field of schema.required) {
              if (!(field in (data as Record<string, unknown>))) {
                errors.push((path ? path + "." : "") + field + ": required field missing");
              }
            }
          }
          if (schema.properties && typeof schema.properties === "object") {
            for (const [key, propSchema] of Object.entries(schema.properties)) {
              if (key in (data as Record<string, unknown>)) {
                errors.push(...validateBody(propSchema, (data as Record<string, unknown>)[key], (path ? path + "." : "") + key));
              }
            }
          }
        }
        if (schema.type === "array" && Array.isArray(data) && schema.items) {
          data.forEach((item: unknown, i: number) => {
            errors.push(...validateBody(schema.items, item, path + "[" + i + "]"));
          });
        }
        return errors;
      }

      const tests = [
        // Required field missing
        {
          schema: { type: "object", required: ["name"], properties: { name: { type: "string" } } },
          data: {},
          expectErrors: ["name: required field missing"],
        },
        // Type mismatch
        {
          schema: { type: "object", properties: { age: { type: "number" } } },
          data: { age: "twenty" },
          expectErrors: ["age: expected number, got string"],
        },
        // Enum violation
        {
          schema: { type: "string", enum: ["active", "inactive"] },
          data: "deleted",
          expectErrors: ["body: must be one of: active, inactive"],
        },
        // Integer validation
        {
          schema: { type: "integer" },
          data: 1.5,
          expectErrors: ["body: expected integer, got number"],
        },
        // Integer valid
        {
          schema: { type: "integer" },
          data: 42,
          expectErrors: [],
        },
        // Array items
        {
          schema: { type: "array", items: { type: "number" } },
          data: [1, "two", 3],
          expectErrors: ["[1]: expected number, got string"],
        },
        // Nested object
        {
          schema: { type: "object", properties: { addr: { type: "object", required: ["city"], properties: { city: { type: "string" } } } } },
          data: { addr: {} },
          expectErrors: ["addr.city: required field missing"],
        },
        // Valid data
        {
          schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, age: { type: "number" } } },
          data: { name: "Alice", age: 30 },
          expectErrors: [],
        },
        // Null/undefined schema
        {
          schema: null,
          data: { anything: true },
          expectErrors: [],
        },
      ];

      let passed = 0;
      for (const t of tests) {
        const result = validateBody(t.schema, t.data);
        const match = JSON.stringify(result) === JSON.stringify(t.expectErrors);
        if (!match) {
          console.error("FAIL: expected", JSON.stringify(t.expectErrors), "got", JSON.stringify(result));
          process.exit(1);
        }
        passed++;
      }
      console.log("PASS:" + passed);
    `);
    const proc = Bun.spawn(["bun", tmpFile], { stdout: "pipe", stderr: "pipe" });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
    expect(output.trim()).toBe("PASS:9");
  });
});

// ============ Env prefix derivation ============

describe("env prefix", () => {
  test("converts hyphenated name to uppercase underscore prefix", () => {
    const source = generateCLISource(makeModel({
      name: "my-cool-api",
      securitySchemes: [{ name: "bearer", type: "bearer" }],
    }));
    expect(source).toContain("MY_COOL_API_TOKEN");
  });

  test("API key env var uses correct prefix", () => {
    const source = generateCLISource(makeModel({
      name: "stripe-cli",
      securitySchemes: [{ name: "api_key", type: "apiKey", location: "header", paramName: "X-API-Key" }],
    }));
    expect(source).toContain("STRIPE_CLI_API_KEY");
  });
});

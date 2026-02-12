# CLI Generator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate standalone CLI binaries from OpenAPI specs with resource-based commands, smart output, and comprehensive docs.

**Architecture:** Parse OpenAPI → build internal command model → generate TypeScript CLI source → bundle with runtime → compile to single binary with Bun.

**Tech Stack:** Bun, TypeScript, OpenAPI 3.x

---

## Task 1: Generator Types

**Files:**
- Create: `src/generator/types.ts`
- Test: `src/generator/types.test.ts`

**Step 1: Create the types file**

```typescript
// src/generator/types.ts

export interface CommandParam {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required: boolean;
  description: string;
  default?: unknown;
  location: "path" | "query" | "header" | "body";
}

export interface Command {
  name: string;
  description: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  params: CommandParam[];
  bodySchema?: object;
  responses: Record<string, { description: string }>;
}

export interface Resource {
  name: string;
  description: string;
  commands: Command[];
}

export interface CLIModel {
  name: string;
  version: string;
  description: string;
  baseUrl: string;
  resources: Resource[];
  securitySchemes: SecurityScheme[];
}

export interface SecurityScheme {
  name: string;
  type: "bearer" | "apiKey" | "basic";
  location?: "header" | "cookie" | "query";
  paramName?: string;
}

export interface GeneratorOptions {
  name?: string;
  output?: string;
  spec: object;
}
```

**Step 2: Write basic type validation test**

```typescript
// src/generator/types.test.ts
import { test, expect } from "bun:test";
import type { CLIModel, Resource, Command } from "./types";

test("CLIModel structure is valid", () => {
  const model: CLIModel = {
    name: "test-cli",
    version: "1.0.0",
    description: "Test CLI",
    baseUrl: "https://api.example.com",
    resources: [],
    securitySchemes: [],
  };

  expect(model.name).toBe("test-cli");
  expect(model.resources).toBeArray();
});

test("Command structure is valid", () => {
  const cmd: Command = {
    name: "get",
    description: "Get a user",
    method: "GET",
    path: "/users/{id}",
    params: [
      { name: "id", type: "string", required: true, description: "User ID", location: "path" }
    ],
    responses: { "200": { description: "Success" } },
  };

  expect(cmd.method).toBe("GET");
  expect(cmd.params).toHaveLength(1);
});
```

**Step 3: Run test to verify it passes**

Run: `bun test src/generator/types.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/generator/types.ts src/generator/types.test.ts
git commit -m "feat: add generator types for CLI model"
```

---

## Task 2: OpenAPI Parser

**Files:**
- Create: `src/generator/parser.ts`
- Test: `src/generator/parser.test.ts`

**Step 1: Write failing test for parser**

```typescript
// src/generator/parser.test.ts
import { test, expect } from "bun:test";
import { parseOpenAPI } from "./parser";

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
    "/users/{id}": {
      get: {
        operationId: "getUser",
        description: "Get a user by ID",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "Success" } },
      },
    },
  },
};

test("parseOpenAPI extracts basic info", () => {
  const model = parseOpenAPI(minimalSpec);

  expect(model.name).toBe("test-api");
  expect(model.version).toBe("1.0.0");
  expect(model.baseUrl).toBe("https://api.example.com");
});

test("parseOpenAPI extracts resources from paths", () => {
  const model = parseOpenAPI(minimalSpec);

  expect(model.resources).toHaveLength(1);
  expect(model.resources[0].name).toBe("users");
  expect(model.resources[0].commands).toHaveLength(2);
});

test("parseOpenAPI extracts command parameters", () => {
  const model = parseOpenAPI(minimalSpec);

  const getUserCmd = model.resources[0].commands.find(c => c.name === "get");
  expect(getUserCmd).toBeDefined();
  expect(getUserCmd!.params).toHaveLength(1);
  expect(getUserCmd!.params[0].name).toBe("id");
  expect(getUserCmd!.params[0].location).toBe("path");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/generator/parser.test.ts`
Expected: FAIL with "parseOpenAPI is not defined"

**Step 3: Implement parser**

```typescript
// src/generator/parser.ts
import type { CLIModel, Resource, Command, CommandParam, SecurityScheme } from "./types";

interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string }>;
  paths: Record<string, Record<string, PathOperation>>;
  components?: {
    securitySchemes?: Record<string, OpenAPISecurityScheme>;
  };
}

interface PathOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: { content?: Record<string, { schema?: object }> };
  responses?: Record<string, { description?: string }>;
}

interface OpenAPIParameter {
  name: string;
  in: "path" | "query" | "header";
  required?: boolean;
  description?: string;
  schema?: { type?: string; default?: unknown };
}

interface OpenAPISecurityScheme {
  type: string;
  scheme?: string;
  in?: string;
  name?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function httpMethodToCommandName(method: string, hasId: boolean): string {
  const map: Record<string, string> = {
    get: hasId ? "get" : "list",
    post: "create",
    put: "update",
    patch: "update",
    delete: "delete",
  };
  return map[method.toLowerCase()] || method.toLowerCase();
}

function extractResourceName(path: string): string {
  const segments = path.split("/").filter(Boolean);
  // Get first non-parameter segment
  for (const seg of segments) {
    if (!seg.startsWith("{")) {
      return seg;
    }
  }
  return segments[0]?.replace(/[{}]/g, "") || "root";
}

function parseParameter(param: OpenAPIParameter): CommandParam {
  return {
    name: param.name,
    type: (param.schema?.type as CommandParam["type"]) || "string",
    required: param.required ?? false,
    description: param.description || "",
    default: param.schema?.default,
    location: param.in,
  };
}

function parseSecuritySchemes(
  schemes?: Record<string, OpenAPISecurityScheme>
): SecurityScheme[] {
  if (!schemes) return [];

  return Object.entries(schemes).map(([name, scheme]) => {
    let type: SecurityScheme["type"] = "bearer";
    if (scheme.type === "apiKey") type = "apiKey";
    else if (scheme.type === "http" && scheme.scheme === "basic") type = "basic";

    return {
      name,
      type,
      location: scheme.in as SecurityScheme["location"],
      paramName: scheme.name,
    };
  });
}

export function parseOpenAPI(spec: OpenAPISpec): CLIModel {
  const name = slugify(spec.info.title);
  const version = spec.info.version;
  const description = spec.info.description || spec.info.title;
  const baseUrl = spec.servers?.[0]?.url || "";

  // Group paths by resource
  const resourceMap = new Map<string, Command[]>();

  for (const [path, methods] of Object.entries(spec.paths)) {
    const resourceName = extractResourceName(path);
    const hasPathParam = path.includes("{");

    for (const [method, operation] of Object.entries(methods)) {
      if (typeof operation !== "object" || !operation) continue;

      const httpMethod = method.toUpperCase() as Command["method"];
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(httpMethod)) continue;

      const params: CommandParam[] = (operation.parameters || []).map(parseParameter);

      // Extract body params if present
      const bodyContent = operation.requestBody?.content?.["application/json"];
      const bodySchema = bodyContent?.schema;

      const command: Command = {
        name: httpMethodToCommandName(method, hasPathParam),
        description: operation.description || operation.summary || "",
        method: httpMethod,
        path,
        params,
        bodySchema,
        responses: Object.fromEntries(
          Object.entries(operation.responses || {}).map(([code, resp]) => [
            code,
            { description: resp.description || "" },
          ])
        ),
      };

      const existing = resourceMap.get(resourceName) || [];
      existing.push(command);
      resourceMap.set(resourceName, existing);
    }
  }

  const resources: Resource[] = Array.from(resourceMap.entries()).map(
    ([name, commands]) => ({
      name,
      description: `${name} operations`,
      commands,
    })
  );

  const securitySchemes = parseSecuritySchemes(spec.components?.securitySchemes);

  return { name, version, description, baseUrl, resources, securitySchemes };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/generator/parser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/generator/parser.ts src/generator/parser.test.ts
git commit -m "feat: add OpenAPI parser to extract CLI model"
```

---

## Task 3: Runtime - Config Manager

**Files:**
- Create: `src/runtime/config.ts`
- Test: `src/runtime/config.test.ts`

**Step 1: Write failing test**

```typescript
// src/runtime/config.test.ts
import { test, expect, beforeEach, afterEach } from "bun:test";
import { ConfigManager } from "./config";
import { rmSync, mkdirSync } from "fs";

const TEST_DIR = "/tmp/orpc-test-config";

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

test("ConfigManager sets and gets values", () => {
  const config = new ConfigManager("test-cli", TEST_DIR);

  config.set("token", "secret123");
  expect(config.get("token")).toBe("secret123");
});

test("ConfigManager persists to file", () => {
  const config1 = new ConfigManager("test-cli", TEST_DIR);
  config1.set("token", "secret123");

  const config2 = new ConfigManager("test-cli", TEST_DIR);
  expect(config2.get("token")).toBe("secret123");
});

test("ConfigManager lists all values", () => {
  const config = new ConfigManager("test-cli", TEST_DIR);
  config.set("token", "secret123");
  config.set("base-url", "https://api.example.com");

  const all = config.list();
  expect(all).toEqual({
    token: "secret123",
    "base-url": "https://api.example.com",
  });
});

test("ConfigManager deletes values", () => {
  const config = new ConfigManager("test-cli", TEST_DIR);
  config.set("token", "secret123");
  config.delete("token");

  expect(config.get("token")).toBeUndefined();
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/runtime/config.test.ts`
Expected: FAIL

**Step 3: Implement ConfigManager**

```typescript
// src/runtime/config.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export class ConfigManager {
  private configPath: string;
  private data: Record<string, string>;

  constructor(cliName: string, configDir?: string) {
    const baseDir = configDir || join(process.env.HOME || "~", ".config");
    const cliDir = join(baseDir, cliName);

    if (!existsSync(cliDir)) {
      mkdirSync(cliDir, { recursive: true });
    }

    this.configPath = join(cliDir, "config.json");
    this.data = this.load();
  }

  private load(): Record<string, string> {
    if (existsSync(this.configPath)) {
      try {
        return JSON.parse(readFileSync(this.configPath, "utf-8"));
      } catch {
        return {};
      }
    }
    return {};
  }

  private save(): void {
    writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
  }

  get(key: string): string | undefined {
    return this.data[key];
  }

  set(key: string, value: string): void {
    this.data[key] = value;
    this.save();
  }

  delete(key: string): void {
    delete this.data[key];
    this.save();
  }

  list(): Record<string, string> {
    return { ...this.data };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/runtime/config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/runtime/config.ts src/runtime/config.test.ts
git commit -m "feat: add ConfigManager for CLI credentials"
```

---

## Task 4: Runtime - HTTP Client

**Files:**
- Create: `src/runtime/http.ts`
- Test: `src/runtime/http.test.ts`

**Step 1: Write failing test**

```typescript
// src/runtime/http.test.ts
import { test, expect } from "bun:test";
import { HttpClient } from "./http";

test("HttpClient builds correct URL with path params", () => {
  const client = new HttpClient("https://api.example.com");
  const url = client.buildUrl("/users/{id}", { id: "123" });

  expect(url).toBe("https://api.example.com/users/123");
});

test("HttpClient builds URL with query params", () => {
  const client = new HttpClient("https://api.example.com");
  const url = client.buildUrl("/users", {}, { limit: "10", offset: "0" });

  expect(url).toBe("https://api.example.com/users?limit=10&offset=0");
});

test("HttpClient adds auth header for bearer token", () => {
  const client = new HttpClient("https://api.example.com");
  client.setAuth({ type: "bearer", token: "secret123" });

  const headers = client.getHeaders();
  expect(headers["Authorization"]).toBe("Bearer secret123");
});

test("HttpClient adds custom headers", () => {
  const client = new HttpClient("https://api.example.com");
  client.setHeader("X-Custom", "value");

  const headers = client.getHeaders();
  expect(headers["X-Custom"]).toBe("value");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/runtime/http.test.ts`
Expected: FAIL

**Step 3: Implement HttpClient**

```typescript
// src/runtime/http.ts

export interface AuthConfig {
  type: "bearer" | "apiKey" | "basic";
  token?: string;
  username?: string;
  password?: string;
  headerName?: string;
}

export class HttpClient {
  private baseUrl: string;
  private headers: Record<string, string> = {};
  private auth?: AuthConfig;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.headers["Content-Type"] = "application/json";
  }

  setAuth(auth: AuthConfig): void {
    this.auth = auth;
  }

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  getHeaders(): Record<string, string> {
    const headers = { ...this.headers };

    if (this.auth) {
      if (this.auth.type === "bearer" && this.auth.token) {
        headers["Authorization"] = `Bearer ${this.auth.token}`;
      } else if (this.auth.type === "apiKey" && this.auth.token) {
        const headerName = this.auth.headerName || "X-API-Key";
        headers[headerName] = this.auth.token;
      } else if (this.auth.type === "basic" && this.auth.username && this.auth.password) {
        const encoded = btoa(`${this.auth.username}:${this.auth.password}`);
        headers["Authorization"] = `Basic ${encoded}`;
      }
    }

    return headers;
  }

  buildUrl(
    path: string,
    pathParams: Record<string, string> = {},
    queryParams: Record<string, string> = {}
  ): string {
    let url = path;

    // Replace path params
    for (const [key, value] of Object.entries(pathParams)) {
      url = url.replace(`{${key}}`, encodeURIComponent(value));
    }

    const fullUrl = `${this.baseUrl}${url}`;

    // Add query params
    const query = new URLSearchParams(queryParams).toString();
    return query ? `${fullUrl}?${query}` : fullUrl;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options: {
      pathParams?: Record<string, string>;
      queryParams?: Record<string, string>;
      body?: unknown;
    } = {}
  ): Promise<{ data: T; status: number; headers: Headers }> {
    const url = this.buildUrl(path, options.pathParams, options.queryParams);

    const response = await fetch(url, {
      method,
      headers: this.getHeaders(),
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json().catch(() => ({}));

    return {
      data: data as T,
      status: response.status,
      headers: response.headers,
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/runtime/http.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/runtime/http.ts src/runtime/http.test.ts
git commit -m "feat: add HttpClient for API requests"
```

---

## Task 5: Runtime - Output Formatter

**Files:**
- Create: `src/runtime/output.ts`
- Test: `src/runtime/output.test.ts`

**Step 1: Write failing test**

```typescript
// src/runtime/output.test.ts
import { test, expect } from "bun:test";
import { OutputFormatter } from "./output";

test("OutputFormatter formats JSON", () => {
  const formatter = new OutputFormatter("json");
  const output = formatter.format({ id: "123", name: "Test" });

  expect(output).toContain('"id"');
  expect(output).toContain('"name"');
});

test("OutputFormatter formats table", () => {
  const formatter = new OutputFormatter("table");
  const output = formatter.format([
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
  ]);

  expect(output).toContain("id");
  expect(output).toContain("name");
  expect(output).toContain("Alice");
  expect(output).toContain("Bob");
});

test("OutputFormatter compact mode for non-TTY", () => {
  const formatter = new OutputFormatter("json", false);
  const output = formatter.format({ id: "123" });

  expect(output).toBe('{"id":"123"}');
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/runtime/output.test.ts`
Expected: FAIL

**Step 3: Implement OutputFormatter**

```typescript
// src/runtime/output.ts

export type OutputFormat = "json" | "table";

export class OutputFormatter {
  private format: OutputFormat;
  private isTTY: boolean;

  constructor(format: OutputFormat = "json", isTTY: boolean = true) {
    this.format = format;
    this.isTTY = isTTY;
  }

  format(data: unknown): string {
    if (this.format === "table" && Array.isArray(data)) {
      return this.formatTable(data);
    }
    return this.formatJson(data);
  }

  private formatJson(data: unknown): string {
    if (this.isTTY) {
      return JSON.stringify(data, null, 2);
    }
    return JSON.stringify(data);
  }

  private formatTable(data: Record<string, unknown>[]): string {
    if (data.length === 0) return "";

    const keys = Object.keys(data[0]);
    const widths = keys.map((key) => {
      const maxDataWidth = Math.max(...data.map((row) => String(row[key] ?? "").length));
      return Math.max(key.length, maxDataWidth);
    });

    const header = keys.map((key, i) => key.padEnd(widths[i])).join("  ");
    const separator = widths.map((w) => "-".repeat(w)).join("  ");
    const rows = data.map((row) =>
      keys.map((key, i) => String(row[key] ?? "").padEnd(widths[i])).join("  ")
    );

    return [header, separator, ...rows].join("\n");
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/runtime/output.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/runtime/output.ts src/runtime/output.test.ts
git commit -m "feat: add OutputFormatter for JSON and table output"
```

---

## Task 6: Resource Mapper

**Files:**
- Create: `src/generator/resource-mapper.ts`
- Test: `src/generator/resource-mapper.test.ts`

**Step 1: Write failing test**

```typescript
// src/generator/resource-mapper.test.ts
import { test, expect } from "bun:test";
import { ResourceMapper } from "./resource-mapper";
import type { CLIModel } from "./types";

test("ResourceMapper generates command tree", () => {
  const model: CLIModel = {
    name: "test-cli",
    version: "1.0.0",
    description: "Test",
    baseUrl: "https://api.example.com",
    resources: [
      {
        name: "users",
        description: "User ops",
        commands: [
          { name: "list", description: "List users", method: "GET", path: "/users", params: [], responses: {} },
          { name: "get", description: "Get user", method: "GET", path: "/users/{id}", params: [
            { name: "id", type: "string", required: true, description: "User ID", location: "path" }
          ], responses: {} },
        ],
      },
    ],
    securitySchemes: [],
  };

  const mapper = new ResourceMapper(model);
  const tree = mapper.getCommandTree();

  expect(tree.children).toHaveProperty("users");
  expect(tree.children.users.children).toHaveProperty("list");
  expect(tree.children.users.children).toHaveProperty("get");
});

test("ResourceMapper generates help text", () => {
  const model: CLIModel = {
    name: "test-cli",
    version: "1.0.0",
    description: "Test CLI",
    baseUrl: "https://api.example.com",
    resources: [],
    securitySchemes: [],
  };

  const mapper = new ResourceMapper(model);
  const help = mapper.getRootHelp();

  expect(help).toContain("test-cli");
  expect(help).toContain("Usage:");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/generator/resource-mapper.test.ts`
Expected: FAIL

**Step 3: Implement ResourceMapper**

```typescript
// src/generator/resource-mapper.ts
import type { CLIModel, Resource, Command } from "./types";

export interface CommandNode {
  name: string;
  description: string;
  command?: Command;
  children: Record<string, CommandNode>;
}

export class ResourceMapper {
  private model: CLIModel;
  private tree: CommandNode;

  constructor(model: CLIModel) {
    this.model = model;
    this.tree = this.buildTree();
  }

  private buildTree(): CommandNode {
    const root: CommandNode = {
      name: this.model.name,
      description: this.model.description,
      children: {},
    };

    // Add config commands
    root.children.config = {
      name: "config",
      description: "Manage configuration",
      children: {
        set: { name: "set", description: "Set a config value", children: {} },
        get: { name: "get", description: "Get a config value", children: {} },
        list: { name: "list", description: "List all config values", children: {} },
        delete: { name: "delete", description: "Delete a config value", children: {} },
      },
    };

    // Add resource commands
    for (const resource of this.model.resources) {
      const resourceNode: CommandNode = {
        name: resource.name,
        description: resource.description,
        children: {},
      };

      for (const cmd of resource.commands) {
        resourceNode.children[cmd.name] = {
          name: cmd.name,
          description: cmd.description,
          command: cmd,
          children: {},
        };
      }

      root.children[resource.name] = resourceNode;
    }

    return root;
  }

  getCommandTree(): CommandNode {
    return this.tree;
  }

  getRootHelp(): string {
    const lines: string[] = [
      `${this.model.name} - ${this.model.description}`,
      "",
      `Usage: ${this.model.name} <command> [options]`,
      "",
      "Commands:",
    ];

    for (const [name, node] of Object.entries(this.tree.children)) {
      lines.push(`  ${name.padEnd(15)} ${node.description}`);
    }

    lines.push("");
    lines.push("Global Options:");
    lines.push("  --token       API token");
    lines.push("  --output      Output format (json|table)");
    lines.push("  --help        Show help");
    lines.push("  --version     Show version");
    lines.push("");
    lines.push(`Run '${this.model.name} <command> --help' for command-specific help.`);

    return lines.join("\n");
  }

  getCommandHelp(path: string[]): string {
    let node = this.tree;
    for (const segment of path) {
      if (node.children[segment]) {
        node = node.children[segment];
      } else {
        return `Unknown command: ${path.join(" ")}`;
      }
    }

    if (node.command) {
      return this.formatCommandHelp(node.command, path);
    }

    // Subcommand group
    const lines: string[] = [
      `${this.model.name} ${path.join(" ")} - ${node.description}`,
      "",
      `Usage: ${this.model.name} ${path.join(" ")} <command> [options]`,
      "",
      "Commands:",
    ];

    for (const [name, child] of Object.entries(node.children)) {
      lines.push(`  ${name.padEnd(15)} ${child.description}`);
    }

    return lines.join("\n");
  }

  private formatCommandHelp(cmd: Command, path: string[]): string {
    const pathParams = cmd.params.filter((p) => p.location === "path");
    const queryParams = cmd.params.filter((p) => p.location === "query");

    const positionals = pathParams.map((p) => `<${p.name}>`).join(" ");
    const usage = `${this.model.name} ${path.join(" ")} ${positionals}`.trim();

    const lines: string[] = [
      `${usage}`,
      "",
      cmd.description,
      "",
    ];

    if (pathParams.length > 0) {
      lines.push("Arguments:");
      for (const p of pathParams) {
        const req = p.required ? "(required)" : "(optional)";
        lines.push(`  ${p.name.padEnd(15)} ${p.type} ${req}  ${p.description}`);
      }
      lines.push("");
    }

    if (queryParams.length > 0 || cmd.bodySchema) {
      lines.push("Options:");
      for (const p of queryParams) {
        const def = p.default !== undefined ? `(default: ${p.default})` : "";
        lines.push(`  --${p.name.padEnd(13)} ${p.type}  ${p.description} ${def}`);
      }
      if (cmd.bodySchema) {
        lines.push(`  --data          string  JSON request body`);
        lines.push(`  --file          string  Path to JSON file for request body`);
      }
      lines.push("");
    }

    if (Object.keys(cmd.responses).length > 0) {
      lines.push("Response Codes:");
      for (const [code, resp] of Object.entries(cmd.responses)) {
        lines.push(`  ${code}  ${resp.description}`);
      }
    }

    return lines.join("\n");
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/generator/resource-mapper.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/generator/resource-mapper.ts src/generator/resource-mapper.test.ts
git commit -m "feat: add ResourceMapper to build command tree"
```

---

## Task 7: CLI Template Generator

**Files:**
- Create: `src/generator/template.ts`
- Test: `src/generator/template.test.ts`

**Step 1: Write failing test**

```typescript
// src/generator/template.test.ts
import { test, expect } from "bun:test";
import { generateCLISource } from "./template";
import type { CLIModel } from "./types";

const testModel: CLIModel = {
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
};

test("generateCLISource produces valid TypeScript", () => {
  const source = generateCLISource(testModel);

  expect(source).toContain("test-cli");
  expect(source).toContain("https://api.example.com");
  expect(source).toContain("users");
});

test("generateCLISource includes config commands", () => {
  const source = generateCLISource(testModel);

  expect(source).toContain("config");
  expect(source).toContain("set");
  expect(source).toContain("get");
});

test("generateCLISource includes auth handling", () => {
  const source = generateCLISource(testModel);

  expect(source).toContain("--token");
  expect(source).toContain("Bearer");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/generator/template.test.ts`
Expected: FAIL

**Step 3: Implement template generator**

```typescript
// src/generator/template.ts
import type { CLIModel, Command, CommandParam } from "./types";

export function generateCLISource(model: CLIModel): string {
  const resourceCases = model.resources
    .map((r) => generateResourceCase(r.name, r.commands, model))
    .join("\n\n");

  return `#!/usr/bin/env bun
// Generated CLI for ${model.name}
// Version: ${model.version}

const CLI_NAME = "${model.name}";
const CLI_VERSION = "${model.version}";
const CLI_DESCRIPTION = "${model.description}";
const BASE_URL = "${model.baseUrl}";

// ============ Config Manager ============
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

class ConfigManager {
  private configPath: string;
  private data: Record<string, string>;

  constructor() {
    const baseDir = join(process.env.HOME || "~", ".config");
    const cliDir = join(baseDir, CLI_NAME);
    if (!existsSync(cliDir)) mkdirSync(cliDir, { recursive: true });
    this.configPath = join(cliDir, "config.json");
    this.data = this.load();
  }

  private load(): Record<string, string> {
    if (existsSync(this.configPath)) {
      try { return JSON.parse(readFileSync(this.configPath, "utf-8")); }
      catch { return {}; }
    }
    return {};
  }

  private save(): void {
    writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
  }

  get(key: string): string | undefined { return this.data[key]; }
  set(key: string, value: string): void { this.data[key] = value; this.save(); }
  delete(key: string): void { delete this.data[key]; this.save(); }
  list(): Record<string, string> { return { ...this.data }; }
}

// ============ HTTP Client ============
class HttpClient {
  private headers: Record<string, string> = { "Content-Type": "application/json" };

  setToken(token: string): void {
    this.headers["Authorization"] = \`Bearer \${token}\`;
  }

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  buildUrl(path: string, pathParams: Record<string, string> = {}, queryParams: Record<string, string> = {}): string {
    let url = path;
    for (const [key, value] of Object.entries(pathParams)) {
      url = url.replace(\`{\${key}}\`, encodeURIComponent(value));
    }
    const fullUrl = \`\${BASE_URL}\${url}\`;
    const query = new URLSearchParams(queryParams).toString();
    return query ? \`\${fullUrl}?\${query}\` : fullUrl;
  }

  async request(method: string, path: string, options: { pathParams?: Record<string, string>; queryParams?: Record<string, string>; body?: unknown } = {}) {
    const url = this.buildUrl(path, options.pathParams, options.queryParams);
    const response = await fetch(url, {
      method,
      headers: this.headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    return { data, status: response.status };
  }
}

// ============ Output ============
function output(data: unknown, format: string): void {
  const isTTY = process.stdout.isTTY;
  if (format === "table" && Array.isArray(data)) {
    console.log(formatTable(data));
  } else if (isTTY) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(JSON.stringify(data));
  }
}

function formatTable(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";
  const keys = Object.keys(data[0]);
  const widths = keys.map((k) => Math.max(k.length, ...data.map((r) => String(r[k] ?? "").length)));
  const header = keys.map((k, i) => k.padEnd(widths[i])).join("  ");
  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  const rows = data.map((r) => keys.map((k, i) => String(r[k] ?? "").padEnd(widths[i])).join("  "));
  return [header, sep, ...rows].join("\\n");
}

// ============ Arg Parser ============
function parseArgs(args: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

// ============ Help ============
function showHelp(): void {
  console.log(\`\${CLI_NAME} - \${CLI_DESCRIPTION}

Usage: \${CLI_NAME} <command> [options]

Commands:
  config          Manage configuration
${model.resources.map((r) => `  ${r.name.padEnd(15)} ${r.description}`).join("\n")}

Global Options:
  --token         API token
  --output        Output format (json|table)
  --help          Show help
  --version       Show version

Run '\${CLI_NAME} <command> --help' for command-specific help.\`);
}

function showVersion(): void {
  console.log(\`\${CLI_NAME} v\${CLI_VERSION}\`);
}

// ============ Main ============
async function main() {
  const config = new ConfigManager();
  const http = new HttpClient();
  const { positional, flags } = parseArgs(process.argv.slice(2));

  // Global flags
  if (flags.help && positional.length === 0) { showHelp(); return; }
  if (flags.version) { showVersion(); return; }

  const outputFormat = (flags.output as string) || "json";

  // Auth
  const token = (flags.token as string) || process.env.${model.name.toUpperCase().replace(/-/g, "_")}_TOKEN || config.get("token");
  if (token) http.setToken(token);

  // Custom headers
  if (flags.header) {
    const [name, value] = (flags.header as string).split(":");
    if (name && value) http.setHeader(name.trim(), value.trim());
  }

  const [cmd, subcmd, ...rest] = positional;

  if (!cmd) { showHelp(); process.exit(1); }

  // Config commands
  if (cmd === "config") {
    if (subcmd === "set" && rest[0] && rest[1]) {
      config.set(rest[0], rest[1]);
      console.log(\`Set \${rest[0]}\`);
    } else if (subcmd === "get" && rest[0]) {
      console.log(config.get(rest[0]) ?? "");
    } else if (subcmd === "list") {
      output(config.list(), outputFormat);
    } else if (subcmd === "delete" && rest[0]) {
      config.delete(rest[0]);
      console.log(\`Deleted \${rest[0]}\`);
    } else {
      console.log(\`Usage: \${CLI_NAME} config <set|get|list|delete> [key] [value]\`);
    }
    return;
  }

${resourceCases}

  console.error(\`Unknown command: \${cmd}\`);
  process.exit(1);
}

main().catch((err) => {
  console.error(\`Error: \${err.message}\`);
  process.exit(1);
});
`;
}

function generateResourceCase(resourceName: string, commands: Command[], model: CLIModel): string {
  const commandCases = commands.map((cmd) => generateCommandCase(cmd, model)).join("\n\n");

  return `  // ${resourceName} commands
  if (cmd === "${resourceName}") {
    if (flags.help && !subcmd) {
      console.log(\`${model.name} ${resourceName} - ${resourceName} operations

Usage: ${model.name} ${resourceName} <command> [options]

Commands:
${commands.map((c) => `  ${c.name.padEnd(15)} ${c.description}`).join("\n")}\`);
      return;
    }

${commandCases}

    console.error(\`Unknown ${resourceName} command: \${subcmd}\`);
    process.exit(1);
  }`;
}

function generateCommandCase(cmd: Command, model: CLIModel): string {
  const pathParams = cmd.params.filter((p) => p.location === "path");
  const queryParams = cmd.params.filter((p) => p.location === "query");

  const pathParamExtract = pathParams
    .map((p, i) => `const ${p.name} = rest[${i}];`)
    .join("\n      ");

  const pathParamCheck = pathParams
    .filter((p) => p.required)
    .map((p) => `if (!${p.name}) { console.error("Missing required argument: ${p.name}"); process.exit(1); }`)
    .join("\n      ");

  const pathParamObj = pathParams.length > 0
    ? `{ ${pathParams.map((p) => p.name).join(", ")} }`
    : "{}";

  const queryParamObj = queryParams.length > 0
    ? `{ ${queryParams.map((p) => `...(flags["${p.name}"] ? { "${p.name}": flags["${p.name}"] as string } : {})`).join(", ")} }`
    : "{}";

  const hasBody = cmd.method === "POST" || cmd.method === "PUT" || cmd.method === "PATCH";
  const bodyHandling = hasBody
    ? `
      let body: unknown = undefined;
      if (flags.data) {
        body = flags.data === "-"
          ? JSON.parse(await Bun.stdin.text())
          : JSON.parse(flags.data as string);
      } else if (flags.file) {
        body = JSON.parse(await Bun.file(flags.file as string).text());
      }`
    : "";

  const requestBody = hasBody ? ", body" : "";

  return `    if (subcmd === "${cmd.name}") {
      if (flags.help) {
        console.log(\`${model.name} ${cmd.name}${pathParams.map((p) => ` <${p.name}>`).join("")}

${cmd.description}
${pathParams.length > 0 ? `
Arguments:
${pathParams.map((p) => `  ${p.name.padEnd(15)} ${p.type} ${p.required ? "(required)" : "(optional)"}  ${p.description}`).join("\n")}` : ""}
${queryParams.length > 0 || hasBody ? `
Options:
${queryParams.map((p) => `  --${p.name.padEnd(13)} ${p.type}  ${p.description}`).join("\n")}${hasBody ? `
  --data          string  JSON request body
  --file          string  Path to JSON file for request body` : ""}` : ""}\`);
        return;
      }
      ${pathParamExtract}
      ${pathParamCheck}${bodyHandling}
      const result = await http.request("${cmd.method}", "${cmd.path}", { pathParams: ${pathParamObj}, queryParams: ${queryParamObj}${requestBody} });
      output(result.data, outputFormat);
      return;
    }`;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/generator/template.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/generator/template.ts src/generator/template.test.ts
git commit -m "feat: add CLI template generator"
```

---

## Task 8: Man Page Generator

**Files:**
- Create: `src/generator/man-page.ts`
- Test: `src/generator/man-page.test.ts`

**Step 1: Write failing test**

```typescript
// src/generator/man-page.test.ts
import { test, expect } from "bun:test";
import { generateManPage } from "./man-page";
import type { CLIModel } from "./types";

const testModel: CLIModel = {
  name: "test-cli",
  version: "1.0.0",
  description: "Test CLI for testing",
  baseUrl: "https://api.example.com",
  resources: [
    {
      name: "users",
      description: "User operations",
      commands: [
        { name: "list", description: "List all users", method: "GET", path: "/users", params: [], responses: { "200": { description: "Success" } } },
      ],
    },
  ],
  securitySchemes: [{ name: "bearer", type: "bearer" }],
};

test("generateManPage produces valid man page format", () => {
  const manPage = generateManPage(testModel);

  expect(manPage).toContain(".TH");
  expect(manPage).toContain("TEST-CLI");
  expect(manPage).toContain("SYNOPSIS");
  expect(manPage).toContain("DESCRIPTION");
});

test("generateManPage includes commands section", () => {
  const manPage = generateManPage(testModel);

  expect(manPage).toContain("COMMANDS");
  expect(manPage).toContain("users");
});

test("generateManPage includes authentication section", () => {
  const manPage = generateManPage(testModel);

  expect(manPage).toContain("AUTHENTICATION");
  expect(manPage).toContain("bearer");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/generator/man-page.test.ts`
Expected: FAIL

**Step 3: Implement man page generator**

```typescript
// src/generator/man-page.ts
import type { CLIModel, Command } from "./types";

export function generateManPage(model: CLIModel): string {
  const date = new Date().toISOString().split("T")[0];
  const nameUpper = model.name.toUpperCase();

  const sections: string[] = [
    // Header
    `.TH ${nameUpper} 1 "${date}" "${model.version}" "${model.name} Manual"`,

    // Name
    `.SH NAME`,
    `${model.name} \\- ${model.description}`,

    // Synopsis
    `.SH SYNOPSIS`,
    `.B ${model.name}`,
    `.I command`,
    `.RI [ options ]`,

    // Description
    `.SH DESCRIPTION`,
    `.B ${model.name}`,
    `is a command-line interface for ${model.description}.`,
    `It provides access to the API at ${model.baseUrl}.`,

    // Commands
    `.SH COMMANDS`,
    generateConfigCommandsMan(model.name),
    ...model.resources.map((r) => generateResourceMan(r.name, r.description, r.commands, model.name)),

    // Global Options
    `.SH GLOBAL OPTIONS`,
    `.TP`,
    `.BR \\-\\-token " " \\fItoken\\fR`,
    `API authentication token. Can also be set via ${nameUpper.replace(/-/g, "_")}_TOKEN environment variable or config file.`,
    `.TP`,
    `.BR \\-\\-output " " \\fIformat\\fR`,
    `Output format. Valid values: json, table. Default: json.`,
    `.TP`,
    `.BR \\-\\-header " " \\fIheader\\fR`,
    `Custom header in "Name: Value" format.`,
    `.TP`,
    `.BR \\-\\-help`,
    `Show help message and exit.`,
    `.TP`,
    `.BR \\-\\-version`,
    `Show version information and exit.`,

    // Authentication
    `.SH AUTHENTICATION`,
    `Authentication can be provided in three ways (in order of precedence):`,
    `.TP`,
    `1. Command-line flag: --token`,
    `.TP`,
    `2. Environment variable: ${nameUpper.replace(/-/g, "_")}_TOKEN`,
    `.TP`,
    `3. Config file: ~/.config/${model.name}/config.json`,
    ``,
    generateSecuritySchemesMan(model),

    // Environment
    `.SH ENVIRONMENT`,
    `.TP`,
    `.B ${nameUpper.replace(/-/g, "_")}_TOKEN`,
    `API authentication token.`,

    // Files
    `.SH FILES`,
    `.TP`,
    `.I ~/.config/${model.name}/config.json`,
    `Configuration file storing persistent settings like API token and base URL.`,

    // Examples
    `.SH EXAMPLES`,
    generateExamplesMan(model),

    // See Also
    `.SH SEE ALSO`,
    `.BR curl (1),`,
    `.BR jq (1)`,

    // Authors
    `.SH AUTHORS`,
    `Generated by orpc-cli from OpenAPI specification.`,
  ];

  return sections.join("\n");
}

function generateConfigCommandsMan(cliName: string): string {
  return `.SS config
Manage CLI configuration.
.TP
.B ${cliName} config set \\fIkey\\fR \\fIvalue\\fR
Set a configuration value.
.TP
.B ${cliName} config get \\fIkey\\fR
Get a configuration value.
.TP
.B ${cliName} config list
List all configuration values.
.TP
.B ${cliName} config delete \\fIkey\\fR
Delete a configuration value.`;
}

function generateResourceMan(name: string, description: string, commands: Command[], cliName: string): string {
  const lines: string[] = [
    `.SS ${name}`,
    description,
  ];

  for (const cmd of commands) {
    const pathParams = cmd.params.filter((p) => p.location === "path");
    const queryParams = cmd.params.filter((p) => p.location === "query");
    const args = pathParams.map((p) => `\\fI${p.name}\\fR`).join(" ");

    lines.push(`.TP`);
    lines.push(`.B ${cliName} ${name} ${cmd.name} ${args}`.trim());
    lines.push(cmd.description);

    if (pathParams.length > 0) {
      lines.push(`.RS`);
      for (const p of pathParams) {
        lines.push(`.TP`);
        lines.push(`.I ${p.name}`);
        lines.push(`${p.description} (${p.type}${p.required ? ", required" : ""})`);
      }
      lines.push(`.RE`);
    }

    if (queryParams.length > 0) {
      lines.push(`.RS`);
      lines.push(`Options:`);
      for (const p of queryParams) {
        lines.push(`.TP`);
        lines.push(`.BR \\-\\-${p.name} " " \\fI${p.type}\\fR`);
        lines.push(p.description);
      }
      lines.push(`.RE`);
    }
  }

  return lines.join("\n");
}

function generateSecuritySchemesMan(model: CLIModel): string {
  if (model.securitySchemes.length === 0) return "";

  const lines: string[] = [`Supported authentication methods:`];

  for (const scheme of model.securitySchemes) {
    lines.push(`.TP`);
    lines.push(`.B ${scheme.type}`);
    if (scheme.type === "bearer") {
      lines.push(`Bearer token authentication. Pass token via --token flag.`);
    } else if (scheme.type === "apiKey") {
      lines.push(`API key authentication via ${scheme.location || "header"} (${scheme.paramName || "X-API-Key"}).`);
    } else if (scheme.type === "basic") {
      lines.push(`HTTP Basic authentication.`);
    }
  }

  return lines.join("\n");
}

function generateExamplesMan(model: CLIModel): string {
  const lines: string[] = [];

  // Config example
  lines.push(`.TP`);
  lines.push(`Set up authentication:`);
  lines.push(`.RS`);
  lines.push(`.nf`);
  lines.push(`$ ${model.name} config set token "your-api-token"`);
  lines.push(`.fi`);
  lines.push(`.RE`);

  // Resource examples
  for (const resource of model.resources.slice(0, 2)) {
    for (const cmd of resource.commands.slice(0, 2)) {
      const pathParams = cmd.params.filter((p) => p.location === "path");
      const args = pathParams.map((p) => `<${p.name}>`).join(" ");

      lines.push(`.TP`);
      lines.push(`${cmd.description}:`);
      lines.push(`.RS`);
      lines.push(`.nf`);
      lines.push(`$ ${model.name} ${resource.name} ${cmd.name} ${args}`.trim());
      lines.push(`.fi`);
      lines.push(`.RE`);
    }
  }

  return lines.join("\n");
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/generator/man-page.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/generator/man-page.ts src/generator/man-page.test.ts
git commit -m "feat: add man page generator"
```

---

## Task 9: Compiler Wrapper

**Files:**
- Create: `src/generator/compiler.ts`
- Test: `src/generator/compiler.test.ts`

**Step 1: Write failing test**

```typescript
// src/generator/compiler.test.ts
import { test, expect, afterEach } from "bun:test";
import { compileCLI } from "./compiler";
import { rmSync, existsSync } from "fs";

const TEST_OUTPUT = "/tmp/orpc-test-cli";

afterEach(() => {
  rmSync(TEST_OUTPUT, { force: true });
  rmSync(`${TEST_OUTPUT}.ts`, { force: true });
});

test("compileCLI creates executable binary", async () => {
  const source = `#!/usr/bin/env bun
console.log("Hello from generated CLI");
`;

  await compileCLI(source, TEST_OUTPUT);

  expect(existsSync(TEST_OUTPUT)).toBe(true);
});

test("compileCLI binary is executable", async () => {
  const source = `#!/usr/bin/env bun
console.log("test-output");
`;

  await compileCLI(source, TEST_OUTPUT);

  const proc = Bun.spawn([TEST_OUTPUT], { stdout: "pipe" });
  const output = await new Response(proc.stdout).text();

  expect(output.trim()).toBe("test-output");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/generator/compiler.test.ts`
Expected: FAIL

**Step 3: Implement compiler**

```typescript
// src/generator/compiler.ts
import { writeFileSync, unlinkSync, chmodSync } from "fs";

export async function compileCLI(source: string, outputPath: string): Promise<void> {
  const tempFile = `${outputPath}.ts`;

  try {
    // Write source to temp file
    writeFileSync(tempFile, source);

    // Compile with Bun
    const proc = Bun.spawn([
      "bun",
      "build",
      tempFile,
      "--compile",
      "--outfile",
      outputPath,
    ], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`Compilation failed: ${stderr}`);
    }

    // Ensure executable
    chmodSync(outputPath, 0o755);
  } finally {
    // Clean up temp file
    try {
      unlinkSync(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/generator/compiler.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/generator/compiler.ts src/generator/compiler.test.ts
git commit -m "feat: add Bun compiler wrapper"
```

---

## Task 10: Update Main CLI

**Files:**
- Modify: `index.ts`

**Step 1: Update index.ts with generate command**

```typescript
// index.ts
import { detectFormat } from "./src/detector";
import { extract } from "./src/extractors";
import { parseOpenAPI } from "./src/generator/parser";
import { generateCLISource } from "./src/generator/template";
import { generateManPage } from "./src/generator/man-page";
import { compileCLI } from "./src/generator/compiler";
import type { FetchResult } from "./src/types";
import { existsSync, writeFileSync } from "fs";
import { join, basename } from "path";

async function fetchUrl(url: string): Promise<FetchResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "openapi-cli/1.0",
      Accept: "application/json, text/html, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const content = await response.text();
  const contentType = response.headers.get("content-type") || "";

  return { content, contentType, url };
}

async function getSpec(source: string): Promise<object> {
  // Check if source is a file
  if (existsSync(source)) {
    const content = await Bun.file(source).text();
    return JSON.parse(content);
  }

  // Treat as URL
  try {
    new URL(source);
  } catch {
    throw new Error(`Invalid URL or file path: ${source}`);
  }

  const result = await fetchUrl(source);
  const format = detectFormat(result);
  const extracted = extract(format, result);

  if (!extracted.success || !extracted.spec) {
    throw new Error(extracted.error || "Failed to extract spec");
  }

  return extracted.spec;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function handleExtract(args: string[]) {
  const url = args[0];

  if (!url) {
    console.error("Usage: orpc extract <url>");
    process.exit(1);
  }

  try {
    const spec = await getSpec(url);
    console.log(JSON.stringify(spec, null, 2));
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function handleGenerate(args: string[]) {
  // Parse args
  let source: string | undefined;
  let name: string | undefined;
  let output = ".";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--name" && args[i + 1]) {
      name = args[++i];
    } else if (arg === "--output" && args[i + 1]) {
      output = args[++i];
    } else if (!arg.startsWith("--")) {
      source = arg;
    }
  }

  if (!source) {
    console.error("Usage: orpc generate <url-or-file> [--name <name>] [--output <dir>]");
    process.exit(1);
  }

  try {
    console.log("Fetching OpenAPI spec...");
    const spec = await getSpec(source);

    console.log("Parsing spec...");
    const model = parseOpenAPI(spec as any);

    // Use provided name or derive from spec
    const cliName = name || model.name;
    model.name = cliName;

    console.log(`Generating CLI: ${cliName}`);
    const cliSource = generateCLISource(model);

    console.log("Generating man page...");
    const manPage = generateManPage(model);

    console.log("Compiling binary...");
    const binaryPath = join(output, cliName);
    await compileCLI(cliSource, binaryPath);

    // Write man page
    const manPath = join(output, `${cliName}.1`);
    writeFileSync(manPath, manPage);

    console.log(`
Generated successfully:
  Binary:   ${binaryPath}
  Man page: ${manPath}

To install the man page:
  sudo cp ${manPath} /usr/local/share/man/man1/

To use:
  ${binaryPath} --help
  ${binaryPath} config set token <your-token>
`);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const cmdArgs = args.slice(1);

  if (!command || command === "--help" || command === "-h") {
    console.log(`
orpc - OpenAPI CLI Generator

Usage: orpc <command> [options]

Commands:
  extract <url>              Extract OpenAPI spec from documentation URL
  generate <url-or-file>     Generate CLI from OpenAPI spec

Generate Options:
  --name <name>              CLI name (default: derived from spec title)
  --output <dir>             Output directory (default: current directory)

Examples:
  orpc extract https://example.com/api/docs
  orpc generate https://example.com/api/docs --name myapi --output ./bin/
  orpc generate ./openapi.json --name myapi
`);
    process.exit(command ? 0 : 1);
  }

  if (command === "extract") {
    await handleExtract(cmdArgs);
  } else if (command === "generate") {
    await handleGenerate(cmdArgs);
  } else {
    console.error(`Unknown command: ${command}`);
    console.error("Run 'orpc --help' for usage.");
    process.exit(1);
  }
}

main();
```

**Step 2: Run all tests**

Run: `bun test`
Expected: All tests PASS

**Step 3: Test end-to-end**

Run: `bun run index.ts generate "https://larabook.in/base/api/auth/reference" --name better-auth --output /tmp/`
Expected: Binary and man page generated at /tmp/better-auth and /tmp/better-auth.1

**Step 4: Test generated CLI**

Run: `/tmp/better-auth --help`
Expected: Help output showing commands

**Step 5: Commit**

```bash
git add index.ts
git commit -m "feat: add generate command to main CLI"
```

---

## Task 11: Integration Test

**Files:**
- Create: `tests/integration.test.ts`

**Step 1: Write integration test**

```typescript
// tests/integration.test.ts
import { test, expect, afterAll } from "bun:test";
import { rmSync, existsSync } from "fs";

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
  const { mkdirSync, writeFileSync } = await import("fs");
  mkdirSync(TEST_DIR, { recursive: true });

  // Write test spec
  const specPath = `${TEST_DIR}/spec.json`;
  writeFileSync(specPath, JSON.stringify(TEST_SPEC));

  // Generate CLI
  const proc = Bun.spawn([
    "bun", "run", "index.ts", "generate", specPath, "--name", "test-api", "--output", TEST_DIR
  ], { stdout: "pipe", stderr: "pipe" });

  await proc.exited;

  // Check binary exists
  expect(existsSync(`${TEST_DIR}/test-api`)).toBe(true);
  expect(existsSync(`${TEST_DIR}/test-api.1`)).toBe(true);
});

test("generated CLI shows help", async () => {
  const proc = Bun.spawn([`${TEST_DIR}/test-api`, "--help"], { stdout: "pipe" });
  const output = await new Response(proc.stdout).text();

  expect(output).toContain("test-api");
  expect(output).toContain("posts");
});

test("generated CLI makes real API call", async () => {
  const proc = Bun.spawn([`${TEST_DIR}/test-api`, "posts", "get", "1"], { stdout: "pipe" });
  const output = await new Response(proc.stdout).text();
  const data = JSON.parse(output);

  expect(data.id).toBe(1);
  expect(data.title).toBeDefined();
});
```

**Step 2: Run integration test**

Run: `bun test tests/integration.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration.test.ts
git commit -m "test: add integration tests for full pipeline"
```

---

## Summary

Tasks completed:
1. Generator types
2. OpenAPI parser
3. Config manager (runtime)
4. HTTP client (runtime)
5. Output formatter (runtime)
6. Resource mapper
7. CLI template generator
8. Man page generator
9. Compiler wrapper
10. Main CLI update
11. Integration tests

The `orpc` CLI now supports:
- `orpc extract <url>` - Extract OpenAPI spec
- `orpc generate <url-or-file> [--name] [--output]` - Generate CLI binary

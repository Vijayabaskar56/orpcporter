import { test, expect, describe } from "bun:test";
import { generateSkillFile } from "./skill";
import type { CLIModel } from "./types";

function makeModel(overrides: Partial<CLIModel> = {}): CLIModel {
  return {
    name: "test-api",
    version: "1.0.0",
    description: "A test API client",
    baseUrl: "https://api.example.com",
    resources: [
      {
        name: "users",
        description: "User operations",
        commands: [
          {
            name: "list",
            description: "List all users",
            method: "GET",
            path: "/users",
            params: [
              { name: "limit", type: "number", required: false, description: "Max results", location: "query" },
            ],
            responses: { "200": { description: "Success" } },
          },
          {
            name: "get",
            description: "Get a user by ID",
            method: "GET",
            path: "/users/{id}",
            params: [
              { name: "id", type: "string", required: true, description: "User ID", location: "path" },
            ],
            responses: { "200": { description: "Success" } },
          },
          {
            name: "create",
            description: "Create a new user",
            method: "POST",
            path: "/users",
            params: [],
            bodySchema: { type: "object", properties: { name: { type: "string" } } },
            responses: { "201": { description: "Created" } },
          },
        ],
      },
    ],
    securitySchemes: [],
    ...overrides,
  };
}

describe("generateSkillFile", () => {
  test("produces valid frontmatter", () => {
    const result = generateSkillFile(makeModel());
    expect(result).toStartWith("---\n");
    expect(result).toContain("name: test-api");
    expect(result).toContain("description: A test API client");
    expect(result).toContain("---\n");
  });

  test("includes title and metadata", () => {
    const result = generateSkillFile(makeModel());
    expect(result).toContain("# test-api");
    expect(result).toContain("A test API client");
    expect(result).toContain("Base URL: https://api.example.com");
    expect(result).toContain("Version: 1.0.0");
  });

  test("lists resource commands", () => {
    const result = generateSkillFile(makeModel());
    expect(result).toContain("### users");
    expect(result).toContain("User operations");
    expect(result).toContain("**users list** - List all users");
    expect(result).toContain("**users get** - Get a user by ID");
    expect(result).toContain("**users create** - Create a new user");
  });

  test("includes usage examples with path params", () => {
    const result = generateSkillFile(makeModel());
    expect(result).toContain("test-api users get <id>");
  });

  test("includes query param options", () => {
    const result = generateSkillFile(makeModel());
    expect(result).toContain("`--limit` (number) - Max results");
  });

  test("mentions --data for POST commands", () => {
    const result = generateSkillFile(makeModel());
    expect(result).toContain("--data");
    expect(result).toContain("--file path.json");
  });

  test("includes global options", () => {
    const result = generateSkillFile(makeModel());
    expect(result).toContain("## Global Options");
    expect(result).toContain("`--output json|table`");
    expect(result).toContain("`--help`");
    expect(result).toContain("`--version`");
  });

  test("no auth scheme shows no authentication required", () => {
    const result = generateSkillFile(makeModel({ securitySchemes: [] }));
    expect(result).toContain("No authentication required");
  });

  test("bearer auth setup instructions", () => {
    const result = generateSkillFile(makeModel({
      securitySchemes: [{ name: "bearer", type: "bearer" }],
    }));
    expect(result).toContain("config set token");
    expect(result).toContain("TEST_API_TOKEN");
  });

  test("apiKey auth setup instructions", () => {
    const result = generateSkillFile(makeModel({
      securitySchemes: [{ name: "api_key", type: "apiKey", location: "header", paramName: "X-API-Key" }],
    }));
    expect(result).toContain("config set api-key");
    expect(result).toContain("TEST_API_API_KEY");
  });

  test("basic auth setup instructions", () => {
    const result = generateSkillFile(makeModel({
      securitySchemes: [{ name: "basic", type: "basic" }],
    }));
    expect(result).toContain("config set username");
    expect(result).toContain("config set password");
  });

  test("oauth2 auth setup instructions", () => {
    const result = generateSkillFile(makeModel({
      securitySchemes: [{
        name: "oauth2",
        type: "oauth2",
        authorizationUrl: "https://auth.example.com/authorize",
        tokenUrl: "https://auth.example.com/token",
        scopes: ["read", "write"],
      }],
    }));
    expect(result).toContain("oauth login");
  });

  test("path params marked as required", () => {
    const result = generateSkillFile(makeModel());
    expect(result).toContain("`id` (string, required)");
  });

  test("multiple resources are all included", () => {
    const model = makeModel({
      resources: [
        {
          name: "users",
          description: "User ops",
          commands: [{
            name: "list",
            description: "List users",
            method: "GET",
            path: "/users",
            params: [],
            responses: { "200": { description: "OK" } },
          }],
        },
        {
          name: "posts",
          description: "Post ops",
          commands: [{
            name: "list",
            description: "List posts",
            method: "GET",
            path: "/posts",
            params: [],
            responses: { "200": { description: "OK" } },
          }],
        },
      ],
    });
    const result = generateSkillFile(model);
    expect(result).toContain("### users");
    expect(result).toContain("### posts");
  });
});

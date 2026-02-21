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
  expect(model.resources[0]!.name).toBe("users");
  expect(model.resources[0]!.commands).toHaveLength(2);
});

test("parseOpenAPI extracts command parameters", () => {
  const model = parseOpenAPI(minimalSpec);
  const getUserCmd = model.resources[0]!.commands.find(c => c.name === "get");
  expect(getUserCmd).toBeDefined();
  expect(getUserCmd!.params).toHaveLength(1);
  expect(getUserCmd!.params[0]!.name).toBe("id");
  expect(getUserCmd!.params[0]!.location).toBe("path");
});

test("parseOpenAPI rejects null input", () => {
  expect(() => parseOpenAPI(null)).toThrow("Invalid OpenAPI spec: must be an object");
});

test("parseOpenAPI rejects non-object input", () => {
  expect(() => parseOpenAPI("not an object")).toThrow("Invalid OpenAPI spec: must be an object");
});

test("parseOpenAPI rejects spec without info", () => {
  expect(() => parseOpenAPI({ paths: {} })).toThrow('Invalid OpenAPI spec: missing "info" section');
});

test("parseOpenAPI rejects spec without paths", () => {
  expect(() => parseOpenAPI({ info: { title: "Test", version: "1.0" } })).toThrow('Invalid OpenAPI spec: missing "paths" section');
});

test("parseOpenAPI rejects spec with missing info.title", () => {
  expect(() => parseOpenAPI({ info: { version: "1.0" }, paths: {} })).toThrow("info.title is required");
});

test("parseOpenAPI rejects spec with missing info.version", () => {
  expect(() => parseOpenAPI({ info: { title: "Test" }, paths: {} })).toThrow("info.version is required");
});

test("parseOpenAPI extracts OAuth2 security scheme", () => {
  const spec = {
    openapi: "3.1.0",
    info: { title: "OAuth API", version: "1.0.0" },
    paths: { "/test": { get: { responses: { "200": { description: "OK" } } } } },
    components: {
      securitySchemes: {
        oauth2_scheme: {
          type: "oauth2",
          flows: {
            authorizationCode: {
              authorizationUrl: "https://auth.example.com/authorize",
              tokenUrl: "https://auth.example.com/token",
              scopes: { read: "Read access", write: "Write access" },
            },
          },
        },
      },
    },
  };
  const model = parseOpenAPI(spec);
  expect(model.securitySchemes).toHaveLength(1);
  expect(model.securitySchemes[0]!.type).toBe("oauth2");
  expect(model.securitySchemes[0]!.authorizationUrl).toBe("https://auth.example.com/authorize");
  expect(model.securitySchemes[0]!.tokenUrl).toBe("https://auth.example.com/token");
  expect(model.securitySchemes[0]!.scopes).toEqual(["read", "write"]);
});

test("parseOpenAPI extracts apiKey security scheme", () => {
  const spec = {
    openapi: "3.1.0",
    info: { title: "API Key API", version: "1.0.0" },
    paths: { "/test": { get: { responses: { "200": { description: "OK" } } } } },
    components: {
      securitySchemes: {
        api_key: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
        },
      },
    },
  };
  const model = parseOpenAPI(spec);
  expect(model.securitySchemes).toHaveLength(1);
  expect(model.securitySchemes[0]!.type).toBe("apiKey");
  expect(model.securitySchemes[0]!.location).toBe("header");
  expect(model.securitySchemes[0]!.paramName).toBe("X-API-Key");
});

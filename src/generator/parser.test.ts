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

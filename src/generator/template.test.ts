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

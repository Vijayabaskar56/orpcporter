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

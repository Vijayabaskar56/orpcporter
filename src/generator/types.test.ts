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

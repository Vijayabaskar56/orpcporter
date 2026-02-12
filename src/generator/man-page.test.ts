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

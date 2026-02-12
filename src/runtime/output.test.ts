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

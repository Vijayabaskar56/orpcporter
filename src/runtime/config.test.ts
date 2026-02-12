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
  expect(all).toEqual({ token: "secret123", "base-url": "https://api.example.com" });
});

test("ConfigManager deletes values", () => {
  const config = new ConfigManager("test-cli", TEST_DIR);
  config.set("token", "secret123");
  config.delete("token");
  expect(config.get("token")).toBeUndefined();
});

test("ConfigManager rejects invalid keys", () => {
  const config = new ConfigManager("test-cli", TEST_DIR);
  expect(() => config.set("__proto__", "malicious")).toThrow("Invalid config key");
  expect(() => config.set("constructor", "malicious")).toThrow("Invalid config key");
  expect(() => config.set("prototype", "malicious")).toThrow("Invalid config key");
  expect(() => config.set("123invalid", "value")).toThrow("Invalid config key");
  expect(() => config.set("", "value")).toThrow("Invalid config key");
  expect(() => config.set("key with spaces", "value")).toThrow("Invalid config key");
});

test("ConfigManager rejects invalid keys on delete", () => {
  const config = new ConfigManager("test-cli", TEST_DIR);
  expect(() => config.delete("__proto__")).toThrow("Invalid config key");
  expect(() => config.delete("constructor")).toThrow("Invalid config key");
});

test("ConfigManager sets restrictive file permissions", () => {
  const { statSync } = require("fs");
  const { join } = require("path");
  const config = new ConfigManager("test-cli-perms", TEST_DIR);
  config.set("token", "secret123");
  const configPath = join(TEST_DIR, "test-cli-perms", "config.json");
  const stats = statSync(configPath);
  // 0o600 = owner read/write only (octal 600 = decimal 384)
  expect(stats.mode & 0o777).toBe(0o600);
});

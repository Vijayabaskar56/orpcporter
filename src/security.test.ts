import { test, expect, describe } from "bun:test";
import { isPrivateIP, validateUrlSafety, validateServerUrls } from "./security";

describe("isPrivateIP", () => {
  // RFC 1918: 10.0.0.0/8
  test("returns true for 10.x.x.x range", () => {
    expect(isPrivateIP("10.0.0.1")).toBe(true);
    expect(isPrivateIP("10.255.255.255")).toBe(true);
    expect(isPrivateIP("10.0.0.0")).toBe(true);
    expect(isPrivateIP("10.100.50.25")).toBe(true);
  });

  // RFC 1918: 172.16.0.0/12
  test("returns true for 172.16-31.x.x range", () => {
    expect(isPrivateIP("172.16.0.1")).toBe(true);
    expect(isPrivateIP("172.31.255.255")).toBe(true);
    expect(isPrivateIP("172.20.0.1")).toBe(true);
  });

  // RFC 1918: 192.168.0.0/16
  test("returns true for 192.168.x.x range", () => {
    expect(isPrivateIP("192.168.0.1")).toBe(true);
    expect(isPrivateIP("192.168.255.255")).toBe(true);
    expect(isPrivateIP("192.168.1.100")).toBe(true);
  });

  // Localhost is ALLOWED (not private per user decision)
  test("returns false for localhost/127.x.x.x (allowed)", () => {
    expect(isPrivateIP("127.0.0.1")).toBe(false);
    expect(isPrivateIP("127.255.255.255")).toBe(false);
  });

  // Public IPs
  test("returns false for public IPs", () => {
    expect(isPrivateIP("8.8.8.8")).toBe(false);
    expect(isPrivateIP("172.32.0.1")).toBe(false);
    expect(isPrivateIP("1.1.1.1")).toBe(false);
    expect(isPrivateIP("192.167.1.1")).toBe(false);
    expect(isPrivateIP("11.0.0.1")).toBe(false);
  });

  // Hostnames (not IPs) — should return false
  test("returns false for hostnames", () => {
    expect(isPrivateIP("example.com")).toBe(false);
    expect(isPrivateIP("api.internal.corp")).toBe(false);
    expect(isPrivateIP("localhost")).toBe(false);
  });

  // Edge cases
  test("returns false for edge cases", () => {
    expect(isPrivateIP("")).toBe(false);
    expect(isPrivateIP("999.999.999.999")).toBe(false);
    expect(isPrivateIP("10.0.0")).toBe(false);
    expect(isPrivateIP("10.0.0.1.1")).toBe(false);
  });
});

describe("validateUrlSafety", () => {
  test("throws for private IP URLs", () => {
    expect(() => validateUrlSafety("http://10.0.0.1/spec.json", false)).toThrow("private IP");
    expect(() => validateUrlSafety("http://10.0.0.1/spec.json", false)).toThrow("--allow-private");
    expect(() => validateUrlSafety("https://192.168.1.100:8080/api/spec", false)).toThrow("private IP");
    expect(() => validateUrlSafety("http://172.16.5.10/v1/spec.json", false)).toThrow("private IP");
  });

  test("does NOT throw for localhost (allowed)", () => {
    expect(() => validateUrlSafety("http://127.0.0.1:3000/spec.json", false)).not.toThrow();
  });

  test("does NOT throw for public URLs", () => {
    expect(() => validateUrlSafety("https://api.example.com/spec.json", false)).not.toThrow();
    expect(() => validateUrlSafety("https://8.8.8.8/spec", false)).not.toThrow();
  });

  test("does NOT throw when allowPrivate is true", () => {
    expect(() => validateUrlSafety("http://10.0.0.1/spec.json", true)).not.toThrow();
    expect(() => validateUrlSafety("http://192.168.1.1/spec.json", true)).not.toThrow();
  });

  test("does NOT throw for invalid URLs (file paths)", () => {
    expect(() => validateUrlSafety("./spec.json", false)).not.toThrow();
    expect(() => validateUrlSafety("spec.json", false)).not.toThrow();
    expect(() => validateUrlSafety("/tmp/spec.json", false)).not.toThrow();
  });
});

describe("validateServerUrls", () => {
  test("throws when servers contain private IPs", () => {
    expect(() =>
      validateServerUrls([{ url: "http://10.0.0.1/api" }], false)
    ).toThrow("private IP");
    expect(() =>
      validateServerUrls([{ url: "https://172.16.5.10/v1" }], false)
    ).toThrow("private IP");
    expect(() =>
      validateServerUrls([{ url: "http://192.168.0.1:3000/api" }], false)
    ).toThrow("private IP");
  });

  test("does NOT throw for relative URLs", () => {
    expect(() =>
      validateServerUrls([{ url: "/api/v1" }], false)
    ).not.toThrow();
    expect(() =>
      validateServerUrls([{ url: "/v2" }], false)
    ).not.toThrow();
  });

  test("does NOT throw for localhost server URLs (allowed)", () => {
    expect(() =>
      validateServerUrls([{ url: "http://localhost:3000/api" }], false)
    ).not.toThrow();
    expect(() =>
      validateServerUrls([{ url: "http://127.0.0.1:8080/api" }], false)
    ).not.toThrow();
  });

  test("does NOT throw when allowPrivate is true", () => {
    expect(() =>
      validateServerUrls([{ url: "http://10.0.0.1/api" }], true)
    ).not.toThrow();
  });

  test("does NOT throw for empty or undefined servers", () => {
    expect(() => validateServerUrls([], false)).not.toThrow();
    expect(() => validateServerUrls(undefined, false)).not.toThrow();
  });

  test("checks all servers and throws on first private IP", () => {
    expect(() =>
      validateServerUrls(
        [{ url: "https://api.example.com" }, { url: "http://10.0.0.1/api" }],
        false
      )
    ).toThrow("private IP");
  });
});

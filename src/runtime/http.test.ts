import { test, expect } from "bun:test";
import { HttpClient } from "./http";

test("HttpClient builds correct URL with path params", () => {
  const client = new HttpClient("https://api.example.com");
  const url = client.buildUrl("/users/{id}", { id: "123" });
  expect(url).toBe("https://api.example.com/users/123");
});

test("HttpClient builds URL with query params", () => {
  const client = new HttpClient("https://api.example.com");
  const url = client.buildUrl("/users", {}, { limit: "10", offset: "0" });
  expect(url).toBe("https://api.example.com/users?limit=10&offset=0");
});

test("HttpClient adds auth header for bearer token", () => {
  const client = new HttpClient("https://api.example.com");
  client.setAuth({ type: "bearer", token: "secret123" });
  const headers = client.getHeaders();
  expect(headers["Authorization"]).toBe("Bearer secret123");
});

test("HttpClient adds custom headers", () => {
  const client = new HttpClient("https://api.example.com");
  client.setHeader("X-Custom", "value");
  const headers = client.getHeaders();
  expect(headers["X-Custom"]).toBe("value");
});

test("HttpClient blocks requests to private/internal addresses", async () => {
  const privateUrls = [
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://10.0.0.1",
    "http://172.16.0.1",
    "http://192.168.1.1",
    "http://169.254.169.254",
    "http://0.0.0.0",
    "http://[::1]",
  ];
  for (const url of privateUrls) {
    const client = new HttpClient(url);
    await expect(client.request("GET", "/test")).rejects.toThrow("private/internal address");
  }
});

test("HttpClient refuses credentials over HTTP", async () => {
  const client = new HttpClient("http://public-api.example.com");
  client.setAuth({ type: "bearer", token: "secret" });
  await expect(client.request("GET", "/data")).rejects.toThrow("Refusing to send credentials over HTTP");
});

test("HttpClient allows credentials over HTTP with allowInsecure", async () => {
  const client = new HttpClient("http://public-api.example.com", { allowInsecure: true });
  client.setAuth({ type: "bearer", token: "secret" });
  // This should not throw the HTTP credentials error (it may fail due to network, but not the security check)
  await expect(client.request("GET", "/data")).rejects.not.toThrow("Refusing to send credentials over HTTP");
});

import { test, expect, describe } from "bun:test";
import { detectFormat } from "./detector";
import type { FetchResult } from "./types";

function makeFetchResult(overrides: Partial<FetchResult>): FetchResult {
  return {
    content: "",
    contentType: "text/html",
    url: "https://example.com/docs",
    ...overrides,
  };
}

describe("detectFormat", () => {
  // direct-json detection
  test("detects direct-json with openapi field", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '{"openapi":"3.0.0","info":{"title":"Test"}}',
          contentType: "application/json",
        })
      )
    ).toBe("direct-json");
  });

  test("detects direct-json with swagger field", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '{"swagger":"2.0","info":{"title":"Test"}}',
          contentType: "application/json",
        })
      )
    ).toBe("direct-json");
  });

  test("detects direct-json for .json URL with text/plain content-type", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '{"openapi":"3.0.0","info":{"title":"Test"}}',
          contentType: "text/plain",
          url: "https://raw.githubusercontent.com/example/openapi/spec3.json",
        })
      )
    ).toBe("direct-json");
  });

  test("detects direct-json when content starts with { regardless of content-type", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '{"openapi":"3.1.0","info":{"title":"Test"},"paths":{}}',
          contentType: "text/plain",
          url: "https://example.com/api/spec",
        })
      )
    ).toBe("direct-json");
  });

  test("does not detect direct-json with invalid JSON", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: "{not valid json",
          contentType: "application/json",
        })
      )
    ).not.toBe("direct-json");
  });

  test("does not detect direct-json when no openapi/swagger field", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '{"name":"test","version":"1.0"}',
          contentType: "application/json",
        })
      )
    ).not.toBe("direct-json");
  });

  // direct-yaml detection
  test("detects direct-yaml with application/yaml content-type and openapi marker", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: 'openapi: "3.0.0"\ninfo:\n  title: Test',
          contentType: "application/yaml",
        })
      )
    ).toBe("direct-yaml");
  });

  test("detects direct-yaml with text/yaml content-type and swagger marker", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: 'swagger: "2.0"\ninfo:\n  title: Test',
          contentType: "text/yaml",
        })
      )
    ).toBe("direct-yaml");
  });

  test("detects direct-yaml for .yaml URL with openapi marker", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: "openapi: 3.0.0\ninfo:\n  title: Test",
          contentType: "text/plain",
          url: "https://example.com/spec.yaml",
        })
      )
    ).toBe("direct-yaml");
  });

  test("detects direct-yaml for .yml URL with openapi marker", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: "openapi: 3.0.0\ninfo:\n  title: Test",
          contentType: "text/plain",
          url: "https://example.com/spec.yml",
        })
      )
    ).toBe("direct-yaml");
  });

  test("does not detect direct-yaml without openapi/swagger markers", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: "name: test\nversion: 1.0",
          contentType: "application/yaml",
        })
      )
    ).not.toBe("direct-yaml");
  });

  // scalar detection
  test("detects scalar with var configuration", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '<html><script>var configuration = {"spec": {}}</script></html>',
        })
      )
    ).toBe("scalar");
  });

  test("detects scalar with data-spec attribute", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '<div data-spec="{}"></div>',
        })
      )
    ).toBe("scalar");
  });

  test("detects scalar with data-spec-url attribute", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '<div data-spec-url="/api.json"></div>',
        })
      )
    ).toBe("scalar");
  });

  test("detects scalar with @scalar/api-reference (case insensitive)", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '<script src="@Scalar/Api-Reference"></script>',
        })
      )
    ).toBe("scalar");
  });

  test("detects scalar with scalar-api-reference", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '<script src="scalar-api-reference"></script>',
        })
      )
    ).toBe("scalar");
  });

  // swagger-ui detection
  test("detects swagger-ui with swagger-ui class (case insensitive)", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '<div id="swagger-ui"></div>',
        })
      )
    ).toBe("swagger-ui");
  });

  test("detects swagger-ui with SwaggerUIBundle", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '<script>SwaggerUIBundle({url: "/api.json"})</script>',
        })
      )
    ).toBe("swagger-ui");
  });

  test("detects swagger-ui with swagger-ui-init.js", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '<script src="swagger-ui-init.js"></script>',
        })
      )
    ).toBe("swagger-ui");
  });

  // redoc detection
  test("detects redoc with <redoc> tag (case insensitive)", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '<redoc spec-url="/api.json"></redoc>',
        })
      )
    ).toBe("redoc");
  });

  test("detects redoc with redoc.standalone (case insensitive)", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '<script src="redoc.standalone.js"></script>',
        })
      )
    ).toBe("redoc");
  });

  test("detects redoc with redocly (case insensitive)", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '<script src="https://cdn.redocly.com/redoc.js"></script>',
        })
      )
    ).toBe("redoc");
  });

  // embedded spec fallback to scalar
  test("detects scalar fallback with embedded openapi and configuration keyword", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '<script>var x = {"openapi":"3.0"};var configuration = x;</script>',
        })
      )
    ).toBe("scalar");
  });

  test("detects scalar fallback with embedded openapi and spec keyword", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: '<html><script>const spec = {"openapi":"3.0.0","paths":{}}</script></html>',
        })
      )
    ).toBe("scalar");
  });

  // unknown detection
  test("returns unknown for plain HTML with no OpenAPI indicators", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: "<html><body>Hello World</body></html>",
        })
      )
    ).toBe("unknown");
  });

  test("returns unknown for empty content", () => {
    expect(
      detectFormat(
        makeFetchResult({
          content: "",
        })
      )
    ).toBe("unknown");
  });
});

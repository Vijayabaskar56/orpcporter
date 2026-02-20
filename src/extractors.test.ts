import { test, expect, describe } from "bun:test";
import { extractDirectYaml, extractDirectJson } from "./extractors";

describe("extractDirectYaml", () => {
  test("parses valid OpenAPI 3.0 YAML spec", () => {
    const yaml = `openapi: '3.0.0'
info:
  title: Test API
  version: '1.0'
paths:
  /users:
    get:
      summary: List users`;

    const result = extractDirectYaml(yaml);
    expect(result.success).toBe(true);
    expect(result.spec).toBeDefined();
    const spec = result.spec as any;
    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info.title).toBe("Test API");
    expect(spec.info.version).toBe("1.0");
    expect(spec.paths["/users"].get.summary).toBe("List users");
  });

  test("parses valid Swagger 2.0 YAML spec", () => {
    const yaml = `swagger: '2.0'
info:
  title: Legacy API
  version: '1.0'
paths: {}`;

    const result = extractDirectYaml(yaml);
    expect(result.success).toBe(true);
    const spec = result.spec as any;
    expect(spec.swagger).toBe("2.0");
    expect(spec.info.title).toBe("Legacy API");
  });

  test("falls through to JSON for JSON content with YAML content-type", () => {
    const json = JSON.stringify({
      openapi: "3.0.0",
      info: { title: "JSON API", version: "1.0" },
      paths: {},
    });

    const result = extractDirectYaml(json);
    expect(result.success).toBe(true);
    const spec = result.spec as any;
    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info.title).toBe("JSON API");
  });

  test("returns failure for non-object YAML content", () => {
    const result = extractDirectYaml("just a string");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not a valid OpenAPI spec");
  });

  test("returns failure for invalid YAML", () => {
    const result = extractDirectYaml("{{{invalid yaml content");
    // This might parse as JSON attempt or fail YAML — either way not a valid spec
    expect(result.success).toBe(false);
  });

  test("parses YAML with anchors and aliases", () => {
    const yaml = `openapi: '3.0.0'
info: &info
  title: Anchor Test
  version: '1.0'
paths: {}`;

    const result = extractDirectYaml(yaml);
    expect(result.success).toBe(true);
    const spec = result.spec as any;
    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info.title).toBe("Anchor Test");
  });

  test("YAML and JSON produce equivalent parsed output", () => {
    const yamlContent = `openapi: '3.0.0'
info:
  title: Equivalence Test
  version: '2.0'
paths:
  /items:
    get:
      summary: Get items
servers:
  - url: https://api.example.com`;

    const jsonContent = JSON.stringify({
      openapi: "3.0.0",
      info: { title: "Equivalence Test", version: "2.0" },
      paths: { "/items": { get: { summary: "Get items" } } },
      servers: [{ url: "https://api.example.com" }],
    });

    const yamlResult = extractDirectYaml(yamlContent);
    const jsonResult = extractDirectJson(jsonContent);

    expect(yamlResult.success).toBe(true);
    expect(jsonResult.success).toBe(true);
    expect(JSON.stringify(yamlResult.spec)).toBe(JSON.stringify(jsonResult.spec));
  });

  test("returns failure for YAML that parses to array", () => {
    const yaml = `- item1
- item2`;

    const result = extractDirectYaml(yaml);
    expect(result.success).toBe(false);
    expect(result.error).toContain("not a valid OpenAPI spec");
  });

  test("returns failure for YAML object without openapi/swagger field", () => {
    const yaml = `name: not-an-api
version: 1.0`;

    const result = extractDirectYaml(yaml);
    expect(result.success).toBe(false);
    expect(result.error).toContain("not a valid OpenAPI spec");
  });
});

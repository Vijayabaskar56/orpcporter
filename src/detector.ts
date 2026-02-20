import type { DocFormat, FetchResult } from "./types";

export function detectFormat(result: FetchResult): DocFormat {
  const { content, contentType, url } = result;
  const lowerContent = content.toLowerCase();

  // Check for direct JSON — match application/json content-type, .json URL extension,
  // or content that starts with '{' (common for raw GitHub URLs serving text/plain)
  if (
    contentType.includes("application/json") ||
    url.endsWith(".json") ||
    content.trimStart().startsWith("{")
  ) {
    try {
      const parsed = JSON.parse(content);
      if (parsed.openapi || parsed.swagger) {
        return "direct-json";
      }
    } catch (e) {
      console.error("[debug] Format detection: JSON parse failed:", e);
    }
  }

  // Check for direct YAML
  if (
    contentType.includes("application/yaml") ||
    contentType.includes("text/yaml") ||
    url.endsWith(".yaml") ||
    url.endsWith(".yml")
  ) {
    if (content.includes("openapi:") || content.includes("swagger:")) {
      return "direct-yaml";
    }
  }

  // Check for Scalar - look for configuration variable or scalar indicators
  if (
    content.includes("var configuration") ||
    content.includes("data-spec=") ||
    content.includes("data-spec-url=") ||
    lowerContent.includes("@scalar/api-reference") ||
    lowerContent.includes("scalar-api-reference")
  ) {
    return "scalar";
  }

  // Check for Swagger UI
  if (
    lowerContent.includes("swagger-ui") ||
    content.includes("SwaggerUIBundle") ||
    content.includes("swagger-ui-init.js")
  ) {
    return "swagger-ui";
  }

  // Check for Redoc
  if (
    lowerContent.includes("<redoc") ||
    lowerContent.includes("redoc.standalone") ||
    lowerContent.includes("redocly")
  ) {
    return "redoc";
  }

  // Try to detect embedded OpenAPI spec in script tags
  if (content.includes('"openapi"') || content.includes('"swagger"')) {
    // Could be any format with embedded spec, try scalar first
    if (content.includes("configuration") || content.includes("spec")) {
      return "scalar";
    }
  }

  return "unknown";
}

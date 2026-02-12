import type { DocFormat, FetchResult, ExtractResult, OpenAPISpec } from "./types";

function isValidOpenAPISpec(obj: unknown): obj is OpenAPISpec {
  if (typeof obj !== "object" || obj === null) return false;
  const spec = obj as OpenAPISpec;
  return Boolean(spec.openapi || spec.swagger);
}

function extractJsonFromString(content: string, startIndex: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (char === '"' && !escape) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        return content.slice(start, i + 1);
      }
    }
  }

  return null;
}

export function extractDirectJson(content: string): ExtractResult {
  try {
    const spec = JSON.parse(content);
    if (isValidOpenAPISpec(spec)) {
      return { success: true, spec };
    }
    return { success: false, error: "Content is not a valid OpenAPI spec" };
  } catch (e) {
    return { success: false, error: `Failed to parse JSON: ${e}` };
  }
}

export function extractDirectYaml(content: string): ExtractResult {
  // Simple YAML to JSON conversion for common OpenAPI patterns
  // For full YAML support, you'd want to add a YAML parser dependency
  try {
    // Check if it's actually JSON (some servers return JSON with yaml content-type)
    if (content.trim().startsWith("{")) {
      return extractDirectJson(content);
    }

    return {
      success: false,
      error: "YAML parsing not implemented. Please provide a JSON spec URL or install a YAML parser.",
    };
  } catch (e) {
    return { success: false, error: `Failed to parse YAML: ${e}` };
  }
}

export function extractScalar(content: string): ExtractResult {
  // Try multiple patterns used by Scalar

  // Pattern 1: var configuration = {...}
  const configMatch = content.match(/var\s+configuration\s*=\s*/);
  if (configMatch) {
    const jsonStr = extractJsonFromString(content, configMatch.index! + configMatch[0].length);
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        // Scalar wraps the spec in a configuration object
        if (isValidOpenAPISpec(parsed)) {
          return { success: true, spec: parsed };
        }
        // Check if spec is nested
        if (parsed.spec && isValidOpenAPISpec(parsed.spec)) {
          return { success: true, spec: parsed.spec };
        }
      } catch {
        // Continue to other patterns
      }
    }
  }

  // Pattern 2: data-spec attribute with JSON
  const dataSpecMatch = content.match(/data-spec=["']([^"']+)["']/);
  if (dataSpecMatch) {
    try {
      const decoded = dataSpecMatch[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
      const spec = JSON.parse(decoded);
      if (isValidOpenAPISpec(spec)) {
        return { success: true, spec };
      }
    } catch {
      // Continue to other patterns
    }
  }

  // Pattern 3: Look for embedded JSON with openapi key
  const openapiMatch = content.match(/\{"openapi"\s*:\s*"[^"]+"/);
  if (openapiMatch) {
    const jsonStr = extractJsonFromString(content, openapiMatch.index!);
    if (jsonStr) {
      try {
        const spec = JSON.parse(jsonStr);
        if (isValidOpenAPISpec(spec)) {
          return { success: true, spec };
        }
      } catch {
        // Continue
      }
    }
  }

  // Pattern 4: script type="application/json" containing spec
  const scriptMatch = content.match(/<script[^>]*type=["']application\/json["'][^>]*>([^<]+)<\/script>/i);
  if (scriptMatch) {
    try {
      const spec = JSON.parse(scriptMatch[1]);
      if (isValidOpenAPISpec(spec)) {
        return { success: true, spec };
      }
    } catch {
      // Continue
    }
  }

  return { success: false, error: "Could not extract OpenAPI spec from Scalar page" };
}

export function extractSwaggerUI(content: string): ExtractResult {
  // Pattern 1: SwaggerUIBundle with url parameter
  const urlMatch = content.match(/SwaggerUIBundle\s*\(\s*\{[^}]*url\s*:\s*["']([^"']+)["']/);
  if (urlMatch) {
    return {
      success: false,
      error: `Swagger UI loads spec from external URL: ${urlMatch[1]}. Please fetch that URL directly.`,
    };
  }

  // Pattern 2: SwaggerUIBundle with spec parameter (embedded)
  const specMatch = content.match(/SwaggerUIBundle\s*\(\s*\{[^}]*spec\s*:\s*/);
  if (specMatch) {
    const jsonStr = extractJsonFromString(content, specMatch.index! + specMatch[0].length);
    if (jsonStr) {
      try {
        const spec = JSON.parse(jsonStr);
        if (isValidOpenAPISpec(spec)) {
          return { success: true, spec };
        }
      } catch {
        // Continue
      }
    }
  }

  // Pattern 3: swagger-ui-init.js with spec
  const initMatch = content.match(/options\s*=\s*\{[^}]*spec\s*:\s*/);
  if (initMatch) {
    const jsonStr = extractJsonFromString(content, initMatch.index! + initMatch[0].length);
    if (jsonStr) {
      try {
        const spec = JSON.parse(jsonStr);
        if (isValidOpenAPISpec(spec)) {
          return { success: true, spec };
        }
      } catch {
        // Continue
      }
    }
  }

  return { success: false, error: "Could not extract OpenAPI spec from Swagger UI page" };
}

export function extractRedoc(content: string): ExtractResult {
  // Pattern 1: <redoc spec-url="...">
  const specUrlMatch = content.match(/<redoc[^>]*spec-url=["']([^"']+)["']/i);
  if (specUrlMatch) {
    return {
      success: false,
      error: `Redoc loads spec from external URL: ${specUrlMatch[1]}. Please fetch that URL directly.`,
    };
  }

  // Pattern 2: Embedded spec in script tag
  const scriptMatches = content.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([^<]+)<\/script>/gi);
  for (const match of scriptMatches) {
    try {
      const spec = JSON.parse(match[1]);
      if (isValidOpenAPISpec(spec)) {
        return { success: true, spec };
      }
    } catch {
      // Continue to next match
    }
  }

  // Pattern 3: __redoc_state or similar
  const redocStateMatch = content.match(/__redoc_state\s*=\s*/);
  if (redocStateMatch) {
    const jsonStr = extractJsonFromString(content, redocStateMatch.index! + redocStateMatch[0].length);
    if (jsonStr) {
      try {
        const state = JSON.parse(jsonStr);
        if (state.spec && isValidOpenAPISpec(state.spec)) {
          return { success: true, spec: state.spec };
        }
      } catch {
        // Continue
      }
    }
  }

  return { success: false, error: "Could not extract OpenAPI spec from Redoc page" };
}

export function extract(format: DocFormat, result: FetchResult): ExtractResult {
  switch (format) {
    case "direct-json":
      return extractDirectJson(result.content);
    case "direct-yaml":
      return extractDirectYaml(result.content);
    case "scalar":
      return extractScalar(result.content);
    case "swagger-ui":
      return extractSwaggerUI(result.content);
    case "redoc":
      return extractRedoc(result.content);
    case "unknown":
      // Try all extractors
      let extractResult = extractScalar(result.content);
      if (extractResult.success) return extractResult;

      extractResult = extractSwaggerUI(result.content);
      if (extractResult.success) return extractResult;

      extractResult = extractRedoc(result.content);
      if (extractResult.success) return extractResult;

      extractResult = extractDirectJson(result.content);
      if (extractResult.success) return extractResult;

      return { success: false, error: "Could not detect or extract OpenAPI spec from the provided URL" };
  }
}

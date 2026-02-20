# Coding Conventions

**Analysis Date:** 2026-02-20

## Naming Patterns

**Files:**
- TypeScript source files: `kebab-case.ts` (e.g., `resource-mapper.ts`, `man-page.ts`)
- Test files: Co-located with source, `<name>.test.ts` pattern (e.g., `parser.test.ts`, `http.test.ts`)
- Type definition files: `types.ts` for module-level types
- Entry point: `index.ts` at project root

**Functions:**
- Regular functions: `camelCase` (e.g., `parseOpenAPI`, `generateCLISource`, `slugify`)
- Async functions: `camelCase` with `async` prefix when appropriate (e.g., `fetchUrl`, `getSpec`)
- Helper/utility functions: `camelCase` (e.g., `escapeForTemplate`, `isValidIdentifier`)
- Validation functions: `is*` or `validate*` prefix (e.g., `isValidOpenAPISpec`, `validateSpec`)

**Variables:**
- Local variables: `camelCase` (e.g., `tempFile`, `pathParams`, `resourceName`)
- Constants: `SCREAMING_SNAKE_CASE` for module-level constants (e.g., `MAX_PATHS`, `MAX_PARAMS_PER_OPERATION`, `MAX_DESCRIPTION_LENGTH`)
- Private class fields: `camelCase` with no prefix (e.g., `this.headers`, `this.configPath`)

**Types/Interfaces:**
- Interfaces: `PascalCase` (e.g., `OpenAPISpec`, `PathOperation`, `CommandParam`)
- Type aliases: `PascalCase` (e.g., `DocFormat`, `OutputFormat`, `AuthConfig`)
- Classes: `PascalCase` (e.g., `HttpClient`, `ConfigManager`, `OutputFormatter`)
- Union types: String literal unions for enums (e.g., `"GET" | "POST" | "PUT" | "PATCH" | "DELETE"`)

## Code Style

**Formatting:**
- No formatter configuration detected (no `.prettierrc`, `.eslintrc`, or `biome.json`)
- Indentation: 2 spaces (observed in all files)
- Quotes: Double quotes for strings (consistent across codebase)
- Semicolons: Always used at statement end
- Line length: Approximately 120-140 characters (not enforced)
- Trailing commas: Used in multi-line arrays and objects

**Linting:**
- TypeScript strict mode enabled via `tsconfig.json`
- No ESLint or Biome configuration detected
- Type safety enforced through `tsc --noEmit` in npm scripts

**TypeScript Configuration:**
- `strict: true` - All strict type-checking enabled
- `noFallthroughCasesInSwitch: true` - Enforce breaks in switch cases
- `noUncheckedIndexedAccess: true` - Index access returns `T | undefined`
- `noImplicitOverride: true` - Require explicit override keyword
- `target: ESNext` - Latest ECMAScript features
- `module: Preserve` - Modern module resolution
- `moduleResolution: bundler` - Bun-specific resolution

## Import Organization

**Order:**
1. Type imports first: `import type { ... } from "..."`
2. Node built-ins: `import { ... } from "fs"`, `import { ... } from "path"`
3. Local modules: `import { ... } from "./..."`

**Path Aliases:**
- No path aliases configured
- All imports use relative paths (`./`, `../`)

**Import Style:**
- Named imports preferred: `import { test, expect } from "bun:test"`
- Type-only imports separated: `import type { CLIModel } from "./types"`
- Default imports for files: `import index from "./index.html"` (Bun-specific)

## Error Handling

**Patterns:**
- Throw errors for invalid input: `throw new Error("message")`
- Return error objects for expected failures: `{ success: false, error: "message" }`
- Catch and re-throw with context: `catch (e) { return { success: false, error: \`Failed to parse: \${e}\` }; }`
- Use `try-catch` for JSON parsing and I/O operations
- Validate input before processing (e.g., `validateSpec`, `isValidKey`)

**Error Messages:**
- Descriptive and actionable: `"Invalid OpenAPI spec: missing 'info' section"`
- Include context when available: `` `HTTP ${response.status}: ${response.statusText}` ``
- Suggest fixes: `"YAML parsing not implemented. Please provide a JSON spec URL..."`

**Process Exit:**
- Exit with code 1 on errors: `process.exit(1)`
- Exit with code 0 on success or help: `process.exit(0)`
- Use `console.error()` before exiting with error

## Logging

**Framework:** Built-in `console` methods only

**Patterns:**
- Errors: `console.error("Error: " + message)`
- Warnings: `console.error("Warning: " + message)` (stderr for warnings too)
- Success messages: `console.log(message)`
- Debug/progress: `console.log("Fetching OpenAPI spec...")` for user feedback

**When to Log:**
- User-facing progress updates in CLI operations
- Error messages before `process.exit(1)`
- Security warnings (e.g., HTTP over HTTPS warnings)
- Validation warnings (e.g., OpenAPI version mismatches)

## Comments

**When to Comment:**
- Complex algorithms: JSON extraction in `extractors.ts` includes step-by-step comments
- Security boundaries: `// Validate output path to prevent path-as-flag confusion`
- Section markers in generated code: `// ============ Config Manager ============`
- Regex patterns: Comments explaining pattern purpose
- Non-obvious constants: `MAX_PATHS`, `FORBIDDEN_KEYS` with purpose explained

**JSDoc/TSDoc:**
- Not used in codebase (no JSDoc comments detected)
- Type information conveyed through TypeScript types only

**Inline Comments:**
- Used sparingly for clarification
- Avoid obvious comments
- Focus on "why" not "what": `// Scalar wraps the spec in a configuration object`

## Function Design

**Size:**
- Small, focused functions preferred (5-30 lines typical)
- Larger functions broken into helpers (e.g., `generateResourceCase` calls `generateCommandCase`)
- Complex logic extracted to separate functions (e.g., `extractJsonFromString`)

**Parameters:**
- Prefer explicit parameters over options objects for simple functions
- Use options objects for functions with many optional parameters: `{ pathParams?, queryParams?, body? }`
- Type all parameters with TypeScript types
- Use default parameters when appropriate: `fmt: OutputFormat = "json"`

**Return Values:**
- Explicit return types preferred (TypeScript infers but explicit is better)
- Use discriminated unions for success/error: `{ success: boolean; spec?: object; error?: string }`
- Async functions return `Promise<T>`
- Void functions for side effects only

## Module Design

**Exports:**
- Export only public API functions/classes
- Use named exports: `export function parseOpenAPI(...)`
- Export types separately: `export type { CLIModel, Resource, Command }`
- No default exports for modules (except Bun HTML imports)

**File Organization:**
- One primary responsibility per file
- Group related functionality (e.g., all extractors in `extractors.ts`)
- Separate types into `types.ts` when used across modules
- Co-locate tests with source files

**Barrel Files:**
- Not used (no `index.ts` re-exports in subdirectories)
- Direct imports from specific files preferred

## Security Patterns

**Input Validation:**
- Validate all external input: `validateSpec`, `isValidKey`, `isValidIdentifier`
- Reject prototype pollution keys: `FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])`
- Validate file paths to prevent traversal: `/^[a-zA-Z0-9_-]+$/` for names
- Sanitize identifiers: `sanitizeIdentifier` function for generated code

**Credentials:**
- Refuse credentials over HTTP: `throw new Error("Refusing to send credentials over HTTP")`
- Block private IPs: `PRIVATE_IP_PATTERNS` regex array
- Set restrictive file permissions: `chmodSync(configPath, 0o600)` for config files
- Create secure temp directories: `chmodSync(tempDir, 0o700)`

**Template Safety:**
- Escape user input in templates: `escapeForTemplate` function
- Use JSON.stringify for untrusted strings in generated code
- Validate output paths: `if (outputPath.startsWith('-'))`

---

*Convention analysis: 2026-02-20*

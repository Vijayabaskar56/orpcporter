# Architecture

**Analysis Date:** 2026-02-20

## Pattern Overview

**Overall:** Pipeline Architecture with Code Generation

**Key Characteristics:**
- Multi-stage transformation pipeline: fetch → detect → extract → parse → generate → compile
- Code generation as primary output (generates complete CLI applications)
- Clear separation between build-time (generator) and runtime (generated code) concerns
- Pure TypeScript with Bun-native APIs

## Layers

**Entry Point Layer:**
- Purpose: CLI orchestration and command routing
- Location: `index.ts`
- Contains: Main entry point, command handlers (extract, generate), argument parsing
- Depends on: All other layers (detector, extractors, generator modules)
- Used by: End users via CLI

**Detection Layer:**
- Purpose: Identify OpenAPI spec format from various documentation frameworks
- Location: `src/detector.ts`
- Contains: Format detection logic for Scalar, Swagger UI, Redoc, direct JSON/YAML
- Depends on: `src/types.ts`
- Used by: Entry point layer via `index.ts`

**Extraction Layer:**
- Purpose: Extract OpenAPI specifications from detected formats
- Location: `src/extractors.ts`
- Contains: Format-specific extractors, JSON parsing logic, embedded spec extraction
- Depends on: `src/types.ts`
- Used by: Entry point layer after detection

**Generator Layer:**
- Purpose: Transform OpenAPI specs into executable CLI applications
- Location: `src/generator/`
- Contains: Parser, template generator, compiler, man page generator, type definitions
- Depends on: Node.js fs/path, Bun build APIs
- Used by: Entry point layer for the generate command

**Runtime Layer:**
- Purpose: Reusable modules embedded into generated CLIs
- Location: `src/runtime/`
- Contains: Config management, HTTP client, output formatting
- Depends on: Node.js fs/path
- Used by: Generated CLI applications (via template embedding)

## Data Flow

**Extract Command Flow:**

1. User provides URL/file path via CLI
2. `index.ts:handleExtract()` fetches content
3. `detector.ts:detectFormat()` identifies documentation framework
4. `extractors.ts:extract()` extracts OpenAPI spec using format-specific logic
5. Spec JSON output to stdout

**Generate Command Flow:**

1. User provides URL/file path and optional flags (--name, --output)
2. `index.ts:handleGenerate()` fetches and extracts spec (reuses extract flow)
3. `parser.ts:parseOpenAPI()` validates and transforms spec into `CLIModel`
4. `template.ts:generateCLISource()` generates TypeScript CLI source code
5. `man-page.ts:generateManPage()` generates troff-formatted man page
6. `compiler.ts:compileCLI()` invokes Bun to compile TypeScript → binary
7. Binary and man page written to output directory

**State Management:**
- Stateless pipeline architecture
- Each stage produces immutable output consumed by next stage
- Config state managed via filesystem (`~/.config/<cli-name>/config.json`) in generated CLIs

## Key Abstractions

**CLIModel:**
- Purpose: Intermediate representation of CLI structure
- Examples: `src/generator/types.ts`
- Pattern: Data transfer object containing resources, commands, parameters, security schemes

**Resource:**
- Purpose: Groups related API endpoints into CLI subcommands
- Examples: Derived from OpenAPI path segments (e.g., `/users` → `users` resource)
- Pattern: Container for commands with shared resource name

**Command:**
- Purpose: Maps individual HTTP operations to CLI subcommands
- Examples: `GET /users/{id}` → `users get <id>`, `POST /users` → `users create`
- Pattern: Declarative specification of method, path, parameters, body schema

**FetchResult & ExtractResult:**
- Purpose: Encapsulate fetch/extraction outcomes with error handling
- Examples: `src/types.ts`
- Pattern: Result type with success/failure discrimination

## Entry Points

**CLI Entry Point:**
- Location: `index.ts`
- Triggers: Direct execution via `bun run index.ts` or compiled binary
- Responsibilities: Argument parsing, command routing, error handling, output formatting

**Generator Entry Points:**
- Location: `src/generator/parser.ts:parseOpenAPI()`, `src/generator/template.ts:generateCLISource()`
- Triggers: Called by generate command flow
- Responsibilities: Core transformation from OpenAPI spec to executable code

**Runtime Entry Points (in generated CLIs):**
- Location: Embedded in generated code via `template.ts`
- Triggers: Users running generated CLIs
- Responsibilities: Config management, HTTP requests, output formatting

## Error Handling

**Strategy:** Fail-fast with descriptive errors

**Patterns:**
- Validation errors throw with context (e.g., `parseOpenAPI` validates spec structure)
- Extraction returns `{ success: boolean, error?: string }` result types
- CLI errors print to stderr and `process.exit(1)`
- Sanitization and escaping for security (template strings, troff output, identifiers)
- Resource limits to prevent DoS (MAX_PATHS, MAX_PARAMS_PER_OPERATION, MAX_DESCRIPTION_LENGTH)

## Cross-Cutting Concerns

**Logging:** Console output with warnings (HTTP security, spec version mismatches)

**Validation:**
- OpenAPI spec structure validation in `parser.ts`
- Config key sanitization in `runtime/config.ts`
- Path parameter validation (prevent path traversal)
- File extension validation (.json only for --file flag)

**Authentication:**
- Token precedence: CLI flag → env var → config file
- Security schemes parsed from OpenAPI specs
- HTTP/HTTPS detection with credential safety checks

**Security:**
- Private IP blocking in HTTP client
- Credential protection over insecure connections
- Temp file permissions (0o600/0o700)
- Input sanitization (identifier names, config keys, template escaping)
- Prototype pollution prevention (Object.create(null) for config data)

---

*Architecture analysis: 2026-02-20*

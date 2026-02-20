# Codebase Structure

**Analysis Date:** 2026-02-20

## Directory Layout

```
orpc-cli/
├── src/
│   ├── generator/       # Code generation pipeline (OpenAPI → CLI)
│   ├── runtime/         # Reusable modules for generated CLIs
│   ├── detector.ts      # OpenAPI format detection
│   ├── extractors.ts    # Format-specific spec extraction
│   └── types.ts         # Shared type definitions
├── tests/               # Integration tests
├── docs/                # Documentation and planning
├── index.ts             # Main CLI entry point
├── package.json         # Project manifest
├── tsconfig.json        # TypeScript configuration
├── bun.lock            # Dependency lockfile
└── CLAUDE.md           # Development instructions
```

## Directory Purposes

**src/**
- Purpose: All application source code
- Contains: Generator modules, runtime modules, core logic
- Key files: `detector.ts`, `extractors.ts`, `types.ts`

**src/generator/**
- Purpose: OpenAPI spec transformation and CLI code generation
- Contains: Parser, template engine, compiler, man page generator, type definitions
- Key files: `parser.ts`, `template.ts`, `compiler.ts`, `man-page.ts`, `types.ts`, `resource-mapper.ts`

**src/runtime/**
- Purpose: Modules embedded into generated CLI applications
- Contains: Configuration management, HTTP client, output formatting
- Key files: `config.ts`, `http.ts`, `output.ts`

**tests/**
- Purpose: Integration testing
- Contains: End-to-end CLI generation tests
- Key files: `integration.test.ts`

**docs/**
- Purpose: Project documentation
- Contains: Planning documents, design decisions
- Key files: `plans/` subdirectory

## Key File Locations

**Entry Points:**
- `index.ts`: Main CLI application (extract/generate commands)

**Configuration:**
- `package.json`: Project dependencies, scripts, metadata
- `tsconfig.json`: TypeScript compiler configuration (strict mode, ESNext, bundler resolution)
- `bun.lock`: Bun package manager lockfile
- `CLAUDE.md`: Development environment instructions (Bun-specific)

**Core Logic:**
- `src/detector.ts`: Documentation format detection
- `src/extractors.ts`: OpenAPI spec extraction from various sources
- `src/generator/parser.ts`: OpenAPI spec validation and transformation
- `src/generator/template.ts`: CLI source code generation (largest file, ~340 lines)
- `src/generator/compiler.ts`: Binary compilation via Bun
- `src/generator/man-page.ts`: Man page generation (troff format)

**Testing:**
- `src/generator/*.test.ts`: Unit tests for generator modules (co-located with source)
- `src/runtime/*.test.ts`: Unit tests for runtime modules (co-located with source)
- `tests/integration.test.ts`: End-to-end integration tests

## Naming Conventions

**Files:**
- `.ts` extension for all TypeScript source files
- `.test.ts` suffix for test files (e.g., `parser.test.ts`)
- kebab-case for multi-word files (e.g., `resource-mapper.ts`, `man-page.ts`)
- lowercase, descriptive names (e.g., `detector.ts`, `extractors.ts`, `template.ts`)

**Directories:**
- lowercase, descriptive names (e.g., `generator`, `runtime`, `tests`)
- Singular nouns for module directories (not plural)

**Modules:**
- Named exports for utilities and classes (e.g., `export function parseOpenAPI`, `export class HttpClient`)
- Type-only imports using `import type` syntax
- One primary abstraction per file (e.g., `config.ts` exports `ConfigManager` class)

## Where to Add New Code

**New Format Detector:**
- Primary code: Add case to `src/detector.ts:detectFormat()`
- Extractor: Add function to `src/extractors.ts` (e.g., `extractNewFormat()`)
- Tests: `src/detector.test.ts` (if created) or inline tests

**New CLI Feature (for generated CLIs):**
- Runtime module: Create new file in `src/runtime/` (e.g., `src/runtime/feature.ts`)
- Embed in template: Update `src/generator/template.ts` to include module
- Types: Add interfaces to module file or `src/generator/types.ts` if shared

**New Generator Feature:**
- Implementation: Add to `src/generator/` (e.g., `src/generator/feature.ts`)
- Integration: Import and call from `index.ts:handleGenerate()`
- Tests: Create `src/generator/feature.test.ts`

**New Validation/Security Check:**
- Parser validation: Add to `src/generator/parser.ts:validateSpec()` or parsing functions
- Runtime validation: Add to relevant `src/runtime/*.ts` module
- Template sanitization: Update escaping functions in `src/generator/template.ts` or `man-page.ts`

**Utilities:**
- Shared helpers: Add to existing module if domain-specific (e.g., `detector.ts` for detection utils)
- Cross-cutting utilities: Consider creating `src/utils.ts` if needed (currently none exists)

## Special Directories

**node_modules/**
- Purpose: Installed dependencies
- Generated: Yes (via `bun install`)
- Committed: No (excluded by .git)

**.planning/**
- Purpose: GSD-generated codebase analysis documents
- Generated: Yes (by GSD commands)
- Committed: Yes (planning artifacts are versioned)

**.claude/, .cursor/, .zed/, .gemini/, .codex/, .vscode/**
- Purpose: Editor/AI assistant configuration
- Generated: User-specific
- Committed: Yes (checked into repo for team consistency)

## Test File Organization

**Location:**
- Co-located with source files (e.g., `src/generator/parser.test.ts` next to `parser.ts`)
- Integration tests in dedicated `tests/` directory

**Naming:**
- `<module>.test.ts` pattern (e.g., `parser.test.ts`, `config.test.ts`)

**Structure:**
- All test files follow Bun test framework conventions
- Use `import { test, expect } from "bun:test"`
- Tests group related functionality (not strict file-per-function)

## Import Patterns

**Local imports:**
- Relative imports with `.ts` extension: `import { parseOpenAPI } from "./parser"`
- Type-only imports: `import type { CLIModel } from "./types"`
- No path aliases configured

**External imports:**
- Node.js built-ins: `import { existsSync } from "fs"`
- Bun built-ins: Used via global `Bun` object (e.g., `Bun.file()`, `Bun.spawn()`)

**Organization:**
- Type imports first, then runtime imports
- Third-party imports before local imports (minimal third-party usage)

## Output Artifacts

**Generated CLIs:**
- Binary: `<output-dir>/<cli-name>` (executable, chmod 755)
- Man page: `<output-dir>/<cli-name>.1` (troff format)

**Generated CLI config:**
- Location: `~/.config/<cli-name>/config.json` (created at runtime by generated CLIs)
- Permissions: 0o600 (user-only read/write)

---

*Structure analysis: 2026-02-20*

# Technology Stack

**Analysis Date:** 2026-02-20

## Languages

**Primary:**
- TypeScript - Used throughout the entire codebase for type safety and modern JavaScript features
- JavaScript (ESNext) - Target compilation output

**Secondary:**
- None detected

## Runtime

**Environment:**
- Bun 1.3.5 - Primary runtime for execution, testing, and compilation
- Node.js 24.12.0 - Available but not primary (project is Bun-first per CLAUDE.md)

**Package Manager:**
- Bun 1.3.5
- Lockfile: `bun.lock` present (lockfileVersion 1, configVersion 1)

## Frameworks

**Core:**
- None - Pure TypeScript/Bun implementation, no external frameworks

**Testing:**
- `bun:test` (built-in) - Native Bun test runner for unit and integration tests

**Build/Dev:**
- `bun build` (built-in) - Used for compilation with `--compile` flag to create native binaries
- TypeScript 5.x (peer dependency) - Type checking only (`tsc --noEmit`)

## Key Dependencies

**Critical:**
- `@types/bun` latest - TypeScript definitions for Bun runtime APIs
- `bun-types` 1.3.9 - Core Bun type definitions (includes @types/node 25.3.0)

**Infrastructure:**
- Node.js built-in modules - Used for file system operations (fs, path, os)
  - `fs`: File operations in `index.ts`, `src/generator/compiler.ts`, `src/runtime/config.ts`
  - `path`: Path manipulation in `index.ts`, `src/generator/compiler.ts`, `src/runtime/config.ts`
  - `os`: Temp directory access in `src/generator/compiler.ts`

## Configuration

**Environment:**
- No `.env` files detected
- Bun automatically loads `.env` if present (no dotenv dependency needed)
- Configuration managed via `ConfigManager` class in `src/runtime/config.ts`
  - Stores user config in `~/.config/<cli-name>/config.json` with 0o600 permissions

**Build:**
- `tsconfig.json` - TypeScript compiler configuration
  - Target: ESNext
  - Module: Preserve (Bun bundler mode)
  - JSX: react-jsx
  - Strict mode enabled
  - No emit (type checking only)
- `package.json` - Project metadata and scripts
  - Module type: ES module
  - Entry point: `index.ts`

## Platform Requirements

**Development:**
- Bun 1.3.x or later
- TypeScript 5.x (peer dependency for type checking)
- macOS/Linux/Windows (Bun supports all platforms)

**Production:**
- Compiled to standalone native binary via `bun build --compile`
- No runtime dependencies in generated CLI binaries
- Generated binaries are platform-specific executables

---

*Stack analysis: 2026-02-20*

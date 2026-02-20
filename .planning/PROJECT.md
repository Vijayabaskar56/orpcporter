# orpcport

## What This Is

A CLI tool that takes any OpenAPI specification and generates a ready-to-use command-line interface plus a Claude Code skill file. Designed primarily for AI agents that need to interact with web APIs through terminal commands instead of browser automation. Published as an npm package with dual distribution: lightweight package mode if Bun is available, standalone binary if not.

## Core Value

AI agents can interact with any API that has OpenAPI docs through simple terminal commands — no browser automation, no custom code.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Extract OpenAPI specs from Swagger UI, Redoc, Scalar, and direct JSON — existing
- ✓ Parse OpenAPI 3.x specs into intermediate CLI model — existing
- ✓ Generate TypeScript CLI source from parsed model — existing
- ✓ Compile to standalone Bun binary — existing
- ✓ Auto-generate man pages from spec — existing
- ✓ Resource-based command structure (e.g., `users list`, `users get <id>`) — existing
- ✓ Token-based authentication with precedence (flag → env → config) — existing
- ✓ JSON and table output formats — existing
- ✓ Security hardening: SSRF protection, credential safety, input sanitization — existing (runtime)
- ✓ Config management with secure file permissions — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Fix all TypeScript strict mode violations — pass `tsc --noEmit`
- [ ] Fix failing integration test (remote URL spec generation)
- [ ] Fix silent error swallowing in catch blocks — add proper logging
- [ ] Add YAML OpenAPI spec support
- [ ] Add SSRF protection to the generator's spec fetcher (not just runtime)
- [ ] Validate OpenAPI server URLs against private/internal IPs
- [ ] Add tests for detector module, main entry point, and error paths
- [ ] Dual distribution: package mode (Bun available) vs compiled binary (no Bun)
- [ ] Generate Claude Code skill files alongside CLIs
- [ ] Publish as npm/bun package (`bun install -g orpcport`)
- [ ] Support additional auth schemes (API key, OAuth2, basic) in generated CLIs
- [ ] Improve argument parsing in generated CLIs (handle `--flag=value`, aliases)
- [ ] Add request body schema validation in generated CLIs
- [ ] Optimize binary size (tree-shaking, minification)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- MCP server generation — skill files cover agent discovery; MCP adds complexity without clear benefit over CLI + skills
- Interactive/REPL mode — agents don't need interactive exploration
- Response caching — agents should get fresh data; caching adds stale data risk
- Node.js compatibility layer — Bun-first project, not worth the abstraction cost
- Batch generation — single spec → single CLI is sufficient; scripting handles batch

## Context

- Brownfield project with working core pipeline: fetch → detect → extract → parse → generate → compile
- Pipeline architecture, stateless, ~1200 lines of TypeScript
- Zero external dependencies (only @types/bun) — hand-rolled JSON extractor, arg parser
- Bun-native throughout (Bun.file, Bun.spawn, bun build --compile)
- Generated binaries are ~50MB due to bundled Bun runtime
- Codebase map available at `.planning/codebase/`

## Constraints

- **Runtime**: Bun 1.3+ required — all APIs are Bun-native
- **Package**: Must work as both global npm install and standalone binary
- **Generated CLIs**: Must work without network access to orpcport itself
- **Security**: Generated CLIs interact with external APIs — must validate inputs and protect credentials

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Bun-only, no Node compat | Simplicity, native compilation, single runtime | — Pending |
| Dual distribution (package + binary) | Users with Bun skip 50MB binary; users without get standalone | — Pending |
| Skill files over MCP servers | Simpler integration, agents use CLI directly, lower maintenance | — Pending |
| Zero external deps approach | Minimal install, but hand-rolled code has bugs | ⚠️ Revisit (consider js-yaml, commander) |

---
*Last updated: 2026-02-20 after initialization*

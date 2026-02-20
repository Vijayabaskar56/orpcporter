# Codebase Concerns

**Analysis Date:** 2026-02-20

## Tech Debt

**TypeScript strict mode violations:**
- Issue: Multiple TypeScript strict mode errors exist despite strict compilation being enabled in `tsconfig.json`
- Files: `/Users/vijayabaskar/work/orpc-cli/index.ts`, `/Users/vijayabaskar/work/orpc-cli/src/extractors.ts`, `/Users/vijayabaskar/work/orpc-cli/src/runtime/output.ts`, `/Users/vijayabaskar/work/orpc-cli/src/generator/parser.test.ts`, `/Users/vijayabaskar/work/orpc-cli/src/generator/resource-mapper.test.ts`
- Impact: Code compiles and runs with `bun` but fails `tsc --noEmit` typecheck, indicating potential runtime errors from undefined values not being properly handled
- Fix approach: Add null checks and type guards throughout affected files, particularly for array access (`data[0]`) and optional chaining for potentially undefined properties

**Silent error swallowing in catch blocks:**
- Issue: Multiple catch blocks silently ignore errors without logging
- Files: `/Users/vijayabaskar/work/orpc-cli/src/generator/compiler.ts` (lines 30-31), `/Users/vijayabaskar/work/orpc-cli/src/generator/template.ts` (line 54), `/Users/vijayabaskar/work/orpc-cli/src/runtime/http.ts` (line 88), `/Users/vijayabaskar/work/orpc-cli/src/runtime/config.ts` (line 36)
- Impact: Failed cleanup operations and parsing errors are hidden, making debugging difficult
- Fix approach: Add debug logging for cleanup failures; validate JSON parsing failures are intentional fallbacks

**YAML parsing not implemented:**
- Issue: YAML OpenAPI specs are detected but not supported; extraction returns error message instead of parsing
- Files: `/Users/vijayabaskar/work/orpc-cli/src/extractors.ts` (lines 61-77)
- Impact: Users with YAML-based OpenAPI documentation cannot use the tool without manual JSON conversion
- Fix approach: Add YAML parser dependency (e.g., `js-yaml`) or document limitation more prominently in README

**Large generated template file:**
- Issue: Template generator at 339 lines is the largest file; contains embedded runtime code as strings
- Files: `/Users/vijayabaskar/work/orpc-cli/src/generator/template.ts`
- Impact: Difficult to maintain, test, and modify runtime behavior; changes require regenerating all CLIs
- Fix approach: Consider splitting into separate template files or using a proper template engine; extract runtime components into importable modules

## Known Bugs

**Integration test failure:**
- Symptoms: Test "generates CLI from remote URL with complex spec" fails with binary not created
- Files: `/Users/vijayabaskar/work/orpc-cli/tests/integration.test.ts` (line 96)
- Trigger: Running `bun test` - expects binary at `${remoteDir}/better-auth-test` but binary doesn't exist
- Workaround: None - test is currently failing

**Possible undefined access in generated CLIs:**
- Symptoms: Generated CLI code may access `data[0]` without checking array length
- Files: `/Users/vijayabaskar/work/orpc-cli/src/generator/template.ts` (line 118)
- Trigger: When API returns empty array and table formatting is requested
- Workaround: Users must ensure API returns non-empty arrays or use JSON output format

**HTTP insecure warning always shown:**
- Symptoms: Warning about HTTP connection shown even when URL is provided via file path
- Files: `/Users/vijayabaskar/work/orpc-cli/index.ts` (line 45)
- Trigger: Any HTTP URL (not HTTPS) triggers warning
- Workaround: Use HTTPS URLs or ignore warning

## Security Considerations

**Private IP blocking in runtime HTTP client:**
- Risk: Generated CLIs block requests to private IP addresses, but generator itself doesn't
- Files: `/Users/vijayabaskar/work/orpc-cli/src/runtime/http.ts` (lines 72-74), `/Users/vijayabaskar/work/orpc-cli/index.ts` (no SSRF protection)
- Current mitigation: Runtime HTTP client has SSRF protection for generated CLIs
- Recommendations: Add same private IP validation to main `index.ts` `fetchUrl()` function to prevent SSRF during spec extraction

**Credentials over HTTP blocked in runtime only:**
- Risk: Generated CLIs properly block auth over HTTP, but main tool doesn't validate during generation
- Files: `/Users/vijayabaskar/work/orpc-cli/src/runtime/http.ts` (lines 76-81), `/Users/vijayabaskar/work/orpc-cli/index.ts` (warning only)
- Current mitigation: Warning printed but not enforced in main tool
- Recommendations: Enforce HTTPS requirement when fetching specs that contain authentication schemes

**No validation of OpenAPI server URLs:**
- Risk: Malicious OpenAPI specs could include private/internal server URLs in `servers[0].url`
- Files: `/Users/vijayabaskar/work/orpc-cli/src/generator/parser.ts` (line 138)
- Current mitigation: None
- Recommendations: Validate server URLs during parsing; warn or reject private IPs

**Path traversal protection in name parameter:**
- Risk: User-provided `--name` could contain path separators
- Files: `/Users/vijayabaskar/work/orpc-cli/index.ts` (lines 106-109)
- Current mitigation: Regex validation allows only `[a-zA-Z0-9_-]+`
- Recommendations: Current implementation is secure

**Config file permissions properly restricted:**
- Risk: Config files could expose API tokens if world-readable
- Files: `/Users/vijayabaskar/work/orpc-cli/src/runtime/config.ts` (lines 19, 43)
- Current mitigation: Config directory set to 0o700, config file set to 0o600
- Recommendations: Current implementation is secure

## Performance Bottlenecks

**Large OpenAPI specs not chunked:**
- Problem: Entire OpenAPI spec loaded into memory during parsing
- Files: `/Users/vijayabaskar/work/orpc-cli/index.ts` (line 33), `/Users/vijayabaskar/work/orpc-cli/src/generator/parser.ts`
- Cause: `Bun.file(source).text()` and `fetch()` load entire content before processing
- Improvement path: Add streaming parser for very large specs (>10MB); implement pagination for specs with >500 paths (current hard limit)

**No caching of fetched specs:**
- Problem: Re-fetching same spec URL multiple times during development
- Files: `/Users/vijayabaskar/work/orpc-cli/index.ts` (`getSpec` function)
- Cause: Every invocation fetches fresh
- Improvement path: Add optional local cache in `~/.cache/orpcport/` with TTL

**JSON extraction uses regex on entire document:**
- Problem: Large documentation pages scanned character-by-character
- Files: `/Users/vijayabaskar/work/orpc-cli/src/extractors.ts` (`extractJsonFromString` function, lines 9-47)
- Cause: Manual JSON parsing instead of leveraging fast native parsers
- Improvement path: Pre-filter content with fast regex before character-by-character extraction

## Fragile Areas

**Extractor pattern matching:**
- Files: `/Users/vijayabaskar/work/orpc-cli/src/extractors.ts` (all extractor functions), `/Users/vijayabaskar/work/orpc-cli/src/detector.ts`
- Why fragile: Relies on specific HTML/JS patterns that documentation frameworks may change (e.g., `var configuration =`, `SwaggerUIBundle`, `<redoc`)
- Safe modification: Add new patterns without removing old ones; test against real-world documentation pages
- Test coverage: Has integration test but limited pattern coverage

**Generated CLI argument parsing:**
- Files: `/Users/vijayabaskar/work/orpc-cli/src/generator/template.ts` (lines 126-147)
- Why fragile: Hand-written parser for flags; doesn't handle edge cases like `--flag=value`, quoted arguments, or flag aliases
- Safe modification: Consider using established arg parsing library in generated code
- Test coverage: Limited - only happy path tested

**Resource name extraction from paths:**
- Files: `/Users/vijayabaskar/work/orpc-cli/src/generator/parser.ts` (`extractResourceName` function, lines 103-109)
- Why fragile: Assumes first non-param segment is resource name; breaks with non-RESTful paths like `/api/v1/internal/users`
- Safe modification: Test against various path patterns before changing; add configuration option for custom resource mapping
- Test coverage: Partially covered in parser tests

**Identifier sanitization:**
- Files: `/Users/vijayabaskar/work/orpc-cli/src/generator/template.ts` (`sanitizeIdentifier`, lines 14-19)
- Why fragile: Simple regex replacement; could create collisions if multiple params differ only in special characters
- Safe modification: Add collision detection; maintain mapping of original to sanitized names
- Test coverage: No dedicated tests for edge cases

## Scaling Limits

**Path limit hardcoded:**
- Current capacity: 500 paths maximum (MAX_PATHS constant)
- Limit: Parser rejects OpenAPI specs with >500 paths
- Files: `/Users/vijayabaskar/work/orpc-cli/src/generator/parser.ts` (lines 38, 143-145)
- Scaling path: Increase limit or make configurable; consider pagination/chunking for very large APIs

**Parameter limit per operation:**
- Current capacity: 50 parameters per operation (MAX_PARAMS_PER_OPERATION)
- Limit: Additional parameters beyond 50 are silently dropped
- Files: `/Users/vijayabaskar/work/orpc-cli/src/generator/parser.ts` (lines 39, 156)
- Scaling path: Make limit configurable; warn user when parameters are dropped

**Generated binary size:**
- Current capacity: No optimization - binaries include full Bun runtime
- Limit: Each generated CLI is ~50MB+ due to runtime bundling
- Files: `/Users/vijayabaskar/work/orpc-cli/src/generator/compiler.ts`
- Scaling path: Implement tree-shaking; use `--minify` flag; explore alternative bundlers (noted in README roadmap)

**No batch generation:**
- Current capacity: One spec → one binary
- Limit: Cannot generate multiple CLIs in single pass
- Scaling path: Add batch mode that processes multiple specs; share common runtime code

## Dependencies at Risk

**Bun-only runtime:**
- Risk: Entire project requires Bun; no Node.js/npm compatibility
- Files: All `.ts` files use Bun APIs (`Bun.file`, `Bun.spawn`, `Bun.serve`)
- Impact: Users without Bun cannot use tool; generated CLIs also require Bun runtime
- Migration plan: Extract Bun-specific code into adapters; create Node.js compatibility layer

**No external dependencies:**
- Risk: Hand-rolled implementations may have bugs (arg parser, JSON extractor, YAML parser)
- Files: `/Users/vijayabaskar/work/orpc-cli/src/extractors.ts`, `/Users/vijayabaskar/work/orpc-cli/src/generator/template.ts`
- Impact: Reinventing wheel leads to maintenance burden
- Migration plan: Consider adding `commander` for arg parsing, `js-yaml` for YAML support

**TypeScript peer dependency only:**
- Risk: No version pinning beyond `^5`
- Files: `/Users/vijayabaskar/work/orpc-cli/package.json` (line 17)
- Impact: Breaking changes in TypeScript could affect builds
- Migration plan: Pin to specific TypeScript minor version

## Missing Critical Features

**No authentication configuration in generated CLIs:**
- Problem: Generated CLIs hard-code token-based auth; no support for OAuth2, API key in header, or custom auth
- Files: `/Users/vijayabaskar/work/orpc-cli/src/generator/template.ts` (lines 73-75, 185)
- Blocks: Using APIs with non-Bearer authentication schemes
- Priority: High - mentioned in README roadmap

**No response validation:**
- Problem: Generated CLIs accept any JSON response; don't validate against OpenAPI response schemas
- Files: `/Users/vijayabaskar/work/orpc-cli/src/generator/template.ts` (line 98)
- Blocks: Detecting API contract violations, malformed responses
- Priority: Medium - helpful for development but not critical for basic usage

**No request body schema validation:**
- Problem: Users can pass invalid JSON; no schema validation before sending
- Files: `/Users/vijayabaskar/work/orpc-cli/src/generator/template.ts` (lines 287-309)
- Blocks: Catching errors before API call; better error messages
- Priority: Medium - would improve UX but current error handling works

**No progress indication for slow operations:**
- Problem: Spec fetching and binary compilation can take seconds with no feedback
- Files: `/Users/vijayabaskar/work/orpc-cli/index.ts` (`handleGenerate` function)
- Blocks: User confidence during long operations
- Priority: Low - already has status messages like "Fetching OpenAPI spec..."

## Test Coverage Gaps

**No tests for detector module:**
- What's not tested: Format detection logic for different documentation types
- Files: `/Users/vijayabaskar/work/orpc-cli/src/detector.ts`
- Risk: Changes to detection patterns could break extraction without warning
- Priority: High

**No tests for main entry point:**
- What's not tested: CLI argument parsing, command routing, error handling in `index.ts`
- Files: `/Users/vijayabaskar/work/orpc-cli/index.ts`
- Risk: Regressions in user-facing commands go unnoticed
- Priority: High

**Limited extractor coverage:**
- What's not tested: Edge cases in HTML pattern matching, nested JSON structures, malformed input
- Files: `/Users/vijayabaskar/work/orpc-cli/src/extractors.ts`
- Risk: Real-world documentation pages may use patterns not covered by tests
- Priority: Medium - has integration test but needs more unit coverage

**No error path testing:**
- What's not tested: Network failures, invalid specs, filesystem permission errors
- Files: All modules - tests focus on happy paths
- Risk: Error messages and recovery behavior unknown
- Priority: Medium

---

*Concerns audit: 2026-02-20*

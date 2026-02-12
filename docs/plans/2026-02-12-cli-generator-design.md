# OpenAPI to CLI Generator Design

## Overview

Extend `orpc` to generate standalone CLI binaries from OpenAPI specifications. The generated CLI provides a user-friendly interface to any API with comprehensive documentation.

## Commands

```bash
# Extract OpenAPI spec (existing)
orpc extract <url>

# Generate CLI binary (new)
orpc generate <url-or-file> [--name mycli] [--output ./dist/]
```

## Generated CLI Features

### Command Structure (Resource-based)

```
mycli
├── config set|get|list|delete   # Credential management
├── <resource>                   # Auto-generated from paths
│   ├── list                     # GET /resources
│   ├── get <id>                # GET /resources/{id}
│   ├── create                  # POST /resources
│   ├── update <id>            # PUT/PATCH /resources/{id}
│   └── delete <id>            # DELETE /resources/{id}
└── --help, --version           # Global flags
```

**Path mapping examples:**
- `/users/{id}` → `mycli users get <id>`
- `/sign-in/email` → `mycli sign-in email`
- `/admin/users/{id}/ban` → `mycli admin users ban <id>`

### Input Handling

**Precedence (highest to lowest):**
1. Individual flags: `--email foo@bar.com --password secret`
2. JSON string: `--data '{"email":"foo@bar.com"}'`
3. JSON file: `--file request.json`
4. Stdin: `echo '{}' | mycli cmd --data -`

**Parameter mapping:**
- Path params → positional arguments
- Query params → optional flags
- Body fields → flags (simple) or `--data`/`--file` (complex)
- Arrays → repeatable flags: `--tag api --tag auth`

### Output Handling

**Smart defaults:**
- TTY → pretty colored JSON
- Piped → raw compact JSON
- Explicit: `--output json|table`

### Authentication

**Precedence (highest to lowest):**
1. Flags: `--token xxx` or `--header "Authorization: Bearer xxx"`
2. Environment: `MYCLI_TOKEN`, `MYCLI_API_KEY`
3. Config file: `~/.config/mycli/config.json`

**Config commands:**
```bash
mycli config set token "secret"
mycli config set base-url "https://api.example.com"
mycli config get token
mycli config list
mycli config delete token
```

### Documentation

**--help (standard):**
- Command list with brief descriptions
- Flag names with types
- Usage examples

**Man pages (detailed):**
- Full command descriptions
- All flags with defaults and descriptions
- Authentication setup guide
- Environment variables reference
- Detailed examples
- Response codes and errors

## Output Artifacts

```bash
orpc generate https://example.com/docs --name mycli --output ./dist/
```

Produces:
```
./dist/
├── mycli      # Single executable (bun build --compile)
└── mycli.1    # Man page file
```

## Project Structure

```
orpc-cli/
├── index.ts                    # Main CLI (extract + generate)
├── src/
│   ├── types.ts               # Shared types
│   ├── detector.ts            # Format detection
│   ├── extractors.ts          # Spec extraction
│   ├── generator/
│   │   ├── parser.ts          # OpenAPI → internal model
│   │   ├── resource-mapper.ts # Paths → resource commands
│   │   ├── template.ts        # CLI code generator
│   │   ├── compiler.ts        # Bun compile wrapper
│   │   └── man-page.ts        # Man page generator
│   └── runtime/
│       ├── cli-runtime.ts     # Bundled into generated CLI
│       ├── config.ts          # Config file handling
│       ├── http.ts            # HTTP client
│       └── output.ts          # Output formatting
└── package.json
```

## Generation Pipeline

```
OpenAPI Spec
    ↓
Parser (parser.ts)
    ↓
Internal Command Model
    ↓
    ├── Resource Mapper → CLI command tree
    ├── Template Generator → TypeScript source
    ├── Man Page Generator → mycli.1
    ↓
Bun Compile
    ↓
Single Binary + Man Page
```

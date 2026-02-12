# openapi-2-cli

A CLI generator that creates native command-line interfaces from OpenAPI specifications. Extract specs from documentation pages and compile them into standalone binaries with man pages.

## Features

- Extract OpenAPI specs from various documentation formats (Swagger UI, Redoc, Scalar, or direct JSON/YAML)
- Generate type-safe CLI tools from OpenAPI specifications
- Compile to native binaries using Bun
- Auto-generate man pages for documentation
- Support for authentication configuration
- Resource-based command structure (e.g., `myapi users list`, `myapi users get <id>`)

## Installation

```bash
bun install
```

## Usage

### Extract OpenAPI Spec

Extract an OpenAPI specification from a documentation URL:

```bash
bun run index.ts extract <url>
```

### Generate CLI

Generate a CLI binary from an OpenAPI spec (URL or local file):

```bash
bun run index.ts generate <url-or-file> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--name <name>` | CLI name (default: derived from spec title) |
| `--output <dir>` | Output directory (default: current directory) |
| `--force` | Overwrite existing files |

**Examples:**

```bash
# Generate from a documentation URL
bun run index.ts generate https://api.example.com/docs --name myapi --output ./bin/

# Generate from a local OpenAPI spec file
bun run index.ts generate ./openapi.json --name myapi

# Overwrite existing binary
bun run index.ts generate ./openapi.json --name myapi --force
```

### Using Generated CLIs

Once generated, your CLI supports:

```bash
# Get help
./myapi --help

# Configure authentication
./myapi config set token <your-api-token>

# Make API calls
./myapi users list
./myapi users get 123
```

## Scripts

```bash
# Run the CLI
bun run start

# Run tests
bun run test

# Type check
bun run typecheck

# Build binary
bun run build
```

## Project Structure

```
openapi-2-cli/
├── index.ts              # Main entry point
├── src/
│   ├── types.ts          # Type definitions
│   ├── detector.ts       # OpenAPI format detection
│   ├── extractors.ts     # Spec extraction logic
│   ├── generator/
│   │   ├── parser.ts     # OpenAPI spec parser
│   │   ├── template.ts   # CLI source code generator
│   │   ├── compiler.ts   # Bun binary compiler
│   │   ├── man-page.ts   # Man page generator
│   │   ├── resource-mapper.ts  # REST resource mapping
│   │   └── types.ts      # Generator types
│   └── runtime/
│       ├── config.ts     # Runtime configuration
│       ├── http.ts       # HTTP client
│       └── output.ts     # Output formatting
```

## Requirements

- [Bun](https://bun.sh) v1.0 or later

## License

MIT

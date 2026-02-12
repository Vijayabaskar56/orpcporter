# Contributing to openapi-2-cli

Thank you for your interest in contributing to openapi-2-cli! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/openapi-2-cli.git
   cd openapi-2-cli
   ```
3. Install dependencies:
   ```bash
   bun install
   ```

## Development

### Running Locally

```bash
bun run index.ts <command>
```

### Running Tests

```bash
bun test
```

To run a specific test file:

```bash
bun test src/generator/parser.test.ts
```

### Type Checking

```bash
bun run typecheck
```

### Building

```bash
bun run build
```

## Project Structure

- `index.ts` - Main entry point and CLI commands
- `src/types.ts` - Shared type definitions
- `src/detector.ts` - OpenAPI format detection
- `src/extractors.ts` - Spec extraction from various documentation formats
- `src/generator/` - CLI code generation
  - `parser.ts` - OpenAPI spec parser
  - `template.ts` - CLI source code generator
  - `compiler.ts` - Bun binary compiler
  - `man-page.ts` - Man page generator
  - `resource-mapper.ts` - REST resource mapping
- `src/runtime/` - Runtime utilities for generated CLIs
  - `config.ts` - Configuration management
  - `http.ts` - HTTP client
  - `output.ts` - Output formatting

## Making Changes

### Coding Standards

- Write TypeScript with strict mode enabled
- Follow existing code style and patterns
- Add tests for new functionality
- Update documentation as needed

### Commit Messages

Use clear and descriptive commit messages:

- `feat: add support for OAuth2 authentication`
- `fix: handle empty response bodies`
- `docs: update README with new options`
- `test: add tests for resource mapper`

### Pull Request Process

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```

2. Make your changes and commit them

3. Ensure tests pass:
   ```bash
   bun test
   ```

4. Ensure type checking passes:
   ```bash
   bun run typecheck
   ```

5. Push to your fork and create a pull request

6. In your PR description:
   - Describe what the change does
   - Reference any related issues
   - Include any breaking changes

## Reporting Issues

When reporting issues, please include:

- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Bun version)
- Relevant error messages or logs

## Feature Requests

Feature requests are welcome! Please:

- Check existing issues first to avoid duplicates
- Describe the use case and why it would be valuable
- Be open to discussion about implementation approaches

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help create a welcoming environment for all contributors

## Questions?

If you have questions about contributing, feel free to open an issue for discussion.

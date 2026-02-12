import { detectFormat } from "./src/detector";
import { extract } from "./src/extractors";
import { parseOpenAPI } from "./src/generator/parser";
import { generateCLISource } from "./src/generator/template";
import { generateManPage } from "./src/generator/man-page";
import { compileCLI } from "./src/generator/compiler";
import type { FetchResult } from "./src/types";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";

async function fetchUrl(url: string): Promise<FetchResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "openapi-cli/1.0",
      Accept: "application/json, text/html, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const content = await response.text();
  const contentType = response.headers.get("content-type") || "";

  return { content, contentType, url };
}

async function getSpec(source: string): Promise<object> {
  // Check if source is a file
  if (existsSync(source)) {
    const content = await Bun.file(source).text();
    return JSON.parse(content);
  }

  // Treat as URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(source);
  } catch {
    throw new Error(`Invalid URL or file path: ${source}`);
  }

  if (parsedUrl.protocol === "http:") {
    console.error("Warning: Fetching spec over insecure HTTP connection. Use HTTPS for production specs.");
  }

  const result = await fetchUrl(source);
  const format = detectFormat(result);
  const extracted = extract(format, result);

  if (!extracted.success || !extracted.spec) {
    throw new Error(extracted.error || "Failed to extract spec");
  }

  return extracted.spec;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function handleExtract(args: string[]) {
  const url = args[0];

  if (!url) {
    console.error("Usage: orpc extract <url>");
    process.exit(1);
  }

  try {
    const spec = await getSpec(url);
    console.log(JSON.stringify(spec, null, 2));
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function handleGenerate(args: string[]) {
  // Parse args
  let source: string | undefined;
  let name: string | undefined;
  let output = ".";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--name" && args[i + 1]) {
      name = args[++i];
    } else if (arg === "--output" && args[i + 1]) {
      output = args[++i];
    } else if (!arg.startsWith("--")) {
      source = arg;
    }
  }

  if (!source) {
    console.error("Usage: orpc generate <url-or-file> [--name <name>] [--output <dir>] [--force]");
    process.exit(1);
  }

  // Validate --name to prevent path traversal
  if (name && !/^[a-zA-Z0-9_-]+$/.test(name)) {
    console.error("Error: --name must contain only letters, numbers, hyphens, and underscores");
    process.exit(1);
  }

  // Validate output directory exists
  if (!existsSync(output)) {
    console.error(`Error: Output directory does not exist: ${output}`);
    process.exit(1);
  }

  try {
    console.log("Fetching OpenAPI spec...");
    const spec = await getSpec(source);

    console.log("Parsing spec...");
    const model = parseOpenAPI(spec as any);

    // Use provided name or derive from spec
    const cliName = name || model.name;
    model.name = cliName;

    console.log(`Generating CLI: ${cliName}`);
    const cliSource = generateCLISource(model);

    console.log("Generating man page...");
    const manPage = generateManPage(model);

    console.log("Compiling binary...");
    const binaryPath = join(output, cliName);

    // Check if binary already exists and --force not provided
    if (existsSync(binaryPath)) {
      const forceFlag = args.includes("--force");
      if (!forceFlag) {
        console.error(`Error: ${binaryPath} already exists. Use --force to overwrite.`);
        process.exit(1);
      }
    }

    await compileCLI(cliSource, binaryPath);

    // Write man page
    const manPath = join(output, `${cliName}.1`);
    if (existsSync(manPath) && !args.includes("--force")) {
      console.error(`Error: ${manPath} already exists. Use --force to overwrite.`);
      process.exit(1);
    }
    writeFileSync(manPath, manPage);

    console.log(`
Generated successfully:
  Binary:   ${binaryPath}
  Man page: ${manPath}

To install the man page:
  sudo cp ${manPath} /usr/local/share/man/man1/

To use:
  ${binaryPath} --help
  ${binaryPath} config set token <your-token>
`);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const cmdArgs = args.slice(1);

  if (!command || command === "--help" || command === "-h") {
    console.log(`
orpc - OpenAPI CLI Generator

Usage: orpc <command> [options]

Commands:
  extract <url>              Extract OpenAPI spec from documentation URL
  generate <url-or-file>     Generate CLI from OpenAPI spec

Generate Options:
  --name <name>              CLI name (default: derived from spec title)
  --output <dir>             Output directory (default: current directory)
  --force                    Overwrite existing files

Examples:
  orpc extract https://example.com/api/docs
  orpc generate https://example.com/api/docs --name myapi --output ./bin/
  orpc generate ./openapi.json --name myapi
`);
    process.exit(command ? 0 : 1);
  }

  if (command === "extract") {
    await handleExtract(cmdArgs);
  } else if (command === "generate") {
    await handleGenerate(cmdArgs);
  } else {
    console.error(`Unknown command: ${command}`);
    console.error("Run 'orpc --help' for usage.");
    process.exit(1);
  }
}

main();

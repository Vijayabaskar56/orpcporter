import type { CLIModel, Command, CommandParam, SecurityScheme } from "./types";

function escapeForTemplate(s: unknown): string {
  if (s == null) return '';
  const str = String(s);
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function isValidIdentifier(name: unknown): boolean {
  if (name == null || typeof name !== 'string') return false;
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}

function sanitizeIdentifier(name: unknown): string {
  if (name == null) return '_unnamed';
  const str = String(name);
  if (isValidIdentifier(str)) return str;
  return str.replace(/[^a-zA-Z0-9_$]/g, '_') || '_unnamed';
}

function generateAuthSetup(model: CLIModel): string {
  const scheme = model.securitySchemes[0];
  if (!scheme) return '';

  const envPrefix = model.name.toUpperCase().replace(/-/g, "_");

  switch (scheme.type) {
    case 'apiKey': {
      const paramName = scheme.paramName || 'X-API-Key';
      if (scheme.location === 'query') {
        return `
  // API Key Auth (query parameter: ${escapeForTemplate(paramName)})
  const apiKey = (flags["api-key"] as string) || process.env.${envPrefix}_API_KEY || config.get("api-key");
  if (apiKey) http.setAuthQueryParam(${JSON.stringify(paramName)}, apiKey);`;
      }
      return `
  // API Key Auth (header: ${escapeForTemplate(paramName)})
  const apiKey = (flags["api-key"] as string) || process.env.${envPrefix}_API_KEY || config.get("api-key");
  if (apiKey) http.setHeader(${JSON.stringify(paramName)}, apiKey);`;
    }
    case 'basic':
      return `
  // Basic Auth
  const username = (flags.username as string) || process.env.${envPrefix}_USERNAME || config.get("username");
  const password = (flags.password as string) || process.env.${envPrefix}_PASSWORD || config.get("password");
  if (username && password) {
    http.setHeader("Authorization", \`Basic \${btoa(\`\${username}:\${password}\`)}\`);
  }`;
    case 'bearer':
      return `
  // Bearer Token Auth
  const token = (flags.token as string) || process.env.${envPrefix}_TOKEN || config.get("token");
  if (token) http.setHeader("Authorization", \`Bearer \${token}\`);`;
    case 'session':
      return `
  // Session Auth (cookie-based)
  const sessionCookie = config.get("session-cookie");
  if (sessionCookie) {
    http.setHeader("Cookie", sessionCookie);
    http.setHeader("X-Device", JSON.stringify({
      platform: "web",
      version: 6430,
      id: config.get("device-id") || "cli-" + Date.now(),
    }));
    http.setHeader("User-Agent", "Mozilla/5.0 (rv:145.0) Firefox/145.0");
  }`;
    case 'oauth2':
      return `
  // OAuth2 Auth
  const oauthToken = config.get("oauth-access-token");
  const oauthExpiry = config.get("oauth-token-expiry");
  if (oauthToken) {
    // Check if token is expired and refresh if possible
    if (oauthExpiry && Number(oauthExpiry) < Date.now()) {
      const refreshToken = config.get("oauth-refresh-token");
      if (refreshToken) {
        try {
          const tokenUrl = ${JSON.stringify(scheme.tokenUrl || '')};
          const clientId = config.get("oauth-client-id") || "";
          const clientSecret = config.get("oauth-client-secret") || "";
          const refreshResp = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: refreshToken,
              client_id: clientId,
              ...(clientSecret ? { client_secret: clientSecret } : {}),
            }).toString(),
          });
          if (refreshResp.ok) {
            const tokens = await refreshResp.json() as Record<string, unknown>;
            if (tokens.access_token) {
              config.set("oauth-access-token", String(tokens.access_token));
              if (tokens.refresh_token) config.set("oauth-refresh-token", String(tokens.refresh_token));
              if (tokens.expires_in) config.set("oauth-token-expiry", String(Date.now() + Number(tokens.expires_in) * 1000));
              http.setHeader("Authorization", \`Bearer \${tokens.access_token}\`);
            }
          } else {
            console.error("Warning: Failed to refresh OAuth2 token. Run '\${CLI_NAME} oauth login' to re-authenticate.");
          }
        } catch {
          console.error("Warning: Token refresh failed. Run '\${CLI_NAME} oauth login' to re-authenticate.");
        }
      } else {
        console.error("Warning: OAuth2 token expired and no refresh token available. Run '\${CLI_NAME} oauth login'.");
      }
    } else {
      http.setHeader("Authorization", \`Bearer \${oauthToken}\`);
    }
  }`;
    default:
      return '';
  }
}

function generateAuthHelpFlags(model: CLIModel): string {
  const scheme = model.securitySchemes[0];
  if (!scheme) return '';

  switch (scheme.type) {
    case 'apiKey':
      return scheme.location === 'query'
        ? `  --api-key       API key (sent as query parameter)`
        : `  --api-key       API key`;
    case 'basic':
      return `  --username      Username for basic auth
  --password      Password for basic auth`;
    case 'bearer':
      return `  --token         API token`;
    case 'session':
      return `  auth            Session authentication (login/logout/status)`;
    case 'oauth2':
      return `  oauth           OAuth2 authentication (login/logout/status)`;
    default:
      return '';
  }
}

function generateSessionCommands(model: CLIModel): string {
  const scheme = model.securitySchemes[0];
  if (!scheme || scheme.type !== 'session') return '';

  const loginUrl = scheme.loginUrl || `${model.baseUrl}/user/signon`;

  return `
  // Session Auth commands
  if (cmd === "auth") {
    if (subcmd === "login") {
      let username = (flags.username as string) || process.env.${model.name.toUpperCase().replace(/-/g, "_")}_USERNAME;
      let password = (flags.password as string) || process.env.${model.name.toUpperCase().replace(/-/g, "_")}_PASSWORD;

      if (!username || !password) {
        console.error("Error: Username and password required.");
        console.error("Usage: " + CLI_NAME + " auth login --username <email> --password <password>");
        console.error("Or set environment variables: ${model.name.toUpperCase().replace(/-/g, "_")}_USERNAME and ${model.name.toUpperCase().replace(/-/g, "_")}_PASSWORD");
        process.exit(1);
      }

      // Generate device ID (24-char hex like MongoDB ObjectId)
      const deviceId = Array.from({length: 24}, () => Math.floor(Math.random() * 16).toString(16)).join('');

      try {
        // TickTick requires these query params for login
        const loginUrl = ${JSON.stringify(loginUrl)} + "?wc=true&remember=true";
        const loginResp = await fetch(loginUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (rv:145.0) Firefox/145.0",
            "X-Device": JSON.stringify({ platform: "web", version: 6430, id: deviceId }),
          },
          body: JSON.stringify({ username, password }),
        });

        if (!loginResp.ok) {
          const errBody = await loginResp.text();
          // Parse error for better messaging
          try {
            const errData = JSON.parse(errBody);
            if (errData.errorCode === "incorrect_password_too_many_times") {
              console.error("Error: Too many login attempts. Please wait a few minutes and try again.");
              console.error("TickTick rate-limits login attempts after multiple failures.");
            } else if (errData.errorCode === "username_password_not_match") {
              console.error("Error: Invalid username or password. Please check your credentials.");
            } else {
              console.error("Error: Login failed: " + errBody);
            }
          } catch {
            console.error("Error: Login failed: " + errBody);
          }
          process.exit(1);
        }

        // Get user info from response
        const userData = await loginResp.json() as Record<string, unknown>;

        // Check for 2FA requirement
        if (userData.authId && !userData.token) {
          console.error("Error: Two-factor authentication required.");
          console.error("This CLI does not currently support 2FA.");
          process.exit(1);
        }

        if (!userData.token) {
          console.error("Error: No token received. Login failed.");
          process.exit(1);
        }

        // Store session token as cookie
        const sessionCookie = "t=" + userData.token;
        config.set("session-cookie", sessionCookie);
        config.set("device-id", deviceId);
        config.set("session-username", username);
        if (userData.inboxId) config.set("inbox-id", String(userData.inboxId));

        console.log("Authentication successful! Session stored.");
        console.log("Username: " + username);
        if (userData.pro) console.log("Pro: Yes");
      } catch (err) {
        console.error("Error: Login failed:", err);
        process.exit(1);
      }
      return;
    }

    if (subcmd === "logout") {
      config.delete("session-cookie");
      config.delete("device-id");
      config.delete("session-username");
      config.delete("inbox-id");
      console.log("Session cleared.");
      return;
    }

    if (subcmd === "status") {
      const cookie = config.get("session-cookie");
      if (!cookie) {
        console.log("Not authenticated. Run: " + CLI_NAME + " auth login");
        return;
      }
      const username = config.get("session-username");
      console.log("Status: Authenticated");
      if (username) console.log("Username: " + username);
      console.log("Session: Active");
      return;
    }

    console.log(\`Usage: \${CLI_NAME} auth <login|logout|status>\`);
    console.log("");
    console.log("Commands:");
    console.log("  login    Login with username and password");
    console.log("  logout   Clear session");
    console.log("  status   Check authentication status");
    console.log("");
    console.log("Options for login:");
    console.log("  --username    Username/email");
    console.log("  --password    Password");
    return;
  }`;
}

function generateOAuthCommands(model: CLIModel): string {
  const scheme = model.securitySchemes[0];
  if (!scheme || scheme.type !== 'oauth2') return '';

  const authUrl = scheme.authorizationUrl || '';
  const tokenUrl = scheme.tokenUrl || '';
  const scopes = scheme.scopes || [];

  return `
  // OAuth2 commands
  if (cmd === "oauth") {
    if (subcmd === "login") {
      const clientId = config.get("oauth-client-id");
      if (!clientId) {
        console.error("Error: OAuth2 client ID not configured. Run: " + CLI_NAME + " config set oauth-client-id <your-client-id>");
        process.exit(1);
      }
      const clientSecret = config.get("oauth-client-secret") || "";
      const port = 8174;
      const redirectUri = \`http://localhost:\${port}/callback\`;
      const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

      const authParams = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        state,
        scope: ${JSON.stringify(scopes.join(' '))},
      });

      const authorizationUrl = ${JSON.stringify(authUrl)} + "?" + authParams.toString();

      console.log("Opening browser for authorization...");
      console.log("If the browser doesn't open, visit: " + authorizationUrl);

      // Open browser
      try {
        const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        Bun.spawn([cmd, authorizationUrl]);
      } catch {
        console.log("Could not open browser automatically.");
      }

      // Start callback server
      let resolveCallback: (code: string) => void;
      const codePromise = new Promise<string>((resolve) => { resolveCallback = resolve; });

      const server = Bun.serve({
        port,
        fetch(req) {
          const url = new URL(req.url);
          if (url.pathname === "/callback") {
            const code = url.searchParams.get("code");
            const returnedState = url.searchParams.get("state");
            if (returnedState !== state) {
              return new Response("State mismatch. Authentication failed.", { status: 400 });
            }
            if (!code) {
              return new Response("No authorization code received.", { status: 400 });
            }
            resolveCallback!(code);
            return new Response("<html><body><h1>Authentication successful!</h1><p>You can close this tab.</p></body></html>", {
              headers: { "Content-Type": "text/html" },
            });
          }
          return new Response("Not found", { status: 404 });
        },
      });

      // Wait for callback with timeout
      const timeoutMs = 120000;
      const code = await Promise.race([
        codePromise,
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs)),
      ]).catch((err) => {
        server.stop();
        console.error("Error: OAuth2 login timed out after " + (timeoutMs / 1000) + " seconds.");
        process.exit(1);
      }) as string;

      server.stop();

      // Exchange code for tokens
      try {
        const tokenResp = await fetch(${JSON.stringify(tokenUrl)}, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            client_id: clientId,
            ...(clientSecret ? { client_secret: clientSecret } : {}),
          }).toString(),
        });

        if (!tokenResp.ok) {
          const errBody = await tokenResp.text();
          console.error("Error: Token exchange failed: " + errBody);
          process.exit(1);
        }

        const tokens = await tokenResp.json() as Record<string, unknown>;
        config.set("oauth-access-token", String(tokens.access_token));
        if (tokens.refresh_token) config.set("oauth-refresh-token", String(tokens.refresh_token));
        if (tokens.expires_in) config.set("oauth-token-expiry", String(Date.now() + Number(tokens.expires_in) * 1000));

        console.log("Authentication successful! Token stored in config.");
      } catch (err) {
        console.error("Error: Failed to exchange authorization code for tokens.");
        process.exit(1);
      }
      return;
    }

    if (subcmd === "logout") {
      config.delete("oauth-access-token");
      config.delete("oauth-refresh-token");
      config.delete("oauth-token-expiry");
      console.log("OAuth2 tokens cleared.");
      return;
    }

    if (subcmd === "status") {
      const token = config.get("oauth-access-token");
      if (!token) {
        console.log("Not authenticated. Run: " + CLI_NAME + " oauth login");
        return;
      }
      const expiry = config.get("oauth-token-expiry");
      const expiryDate = expiry ? new Date(Number(expiry)) : null;
      const isExpired = expiryDate && expiryDate.getTime() < Date.now();
      const hasRefresh = !!config.get("oauth-refresh-token");
      console.log("Status: Authenticated");
      if (expiryDate) console.log("Token expires: " + expiryDate.toISOString() + (isExpired ? " (EXPIRED)" : ""));
      console.log("Refresh token: " + (hasRefresh ? "Available" : "Not available"));
      return;
    }

    console.log(\`Usage: \${CLI_NAME} oauth <login|logout|status>\`);
    return;
  }`;
}

function hasAnyBodySchema(model: CLIModel): boolean {
  return model.resources.some(r =>
    r.commands.some(c => c.bodySchema && Object.keys(c.bodySchema).length > 0)
  );
}

function generateValidateBody(): string {
  return `
// ============ Body Validator ============
function validateBody(schema: any, data: unknown, path: string = ""): string[] {
  const errors: string[] = [];
  if (!schema || typeof schema !== "object") return errors;

  // Type checking
  if (schema.type) {
    const actualType = Array.isArray(data) ? "array" : typeof data;
    if (schema.type === "integer") {
      if (typeof data !== "number" || !Number.isInteger(data)) {
        errors.push((path || "body") + ": expected integer, got " + (typeof data));
      }
    } else if (schema.type === "number") {
      if (typeof data !== "number") {
        errors.push((path || "body") + ": expected number, got " + actualType);
      }
    } else if (actualType !== schema.type) {
      errors.push((path || "body") + ": expected " + schema.type + ", got " + actualType);
    }
  }

  // Enum checking
  if (schema.enum && Array.isArray(schema.enum) && !schema.enum.includes(data)) {
    errors.push((path || "body") + ": must be one of: " + schema.enum.join(", "));
  }

  // Object validation
  if (schema.type === "object" && typeof data === "object" && data !== null && !Array.isArray(data)) {
    if (Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in (data as Record<string, unknown>))) {
          errors.push((path ? path + "." : "") + field + ": required field missing");
        }
      }
    }
    if (schema.properties && typeof schema.properties === "object") {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in (data as Record<string, unknown>)) {
          errors.push(...validateBody(propSchema, (data as Record<string, unknown>)[key], (path ? path + "." : "") + key));
        }
      }
    }
  }

  // Array validation
  if (schema.type === "array" && Array.isArray(data) && schema.items) {
    data.forEach((item: unknown, i: number) => {
      errors.push(...validateBody(schema.items, item, path + "[" + i + "]"));
    });
  }

  return errors;
}`;
}

export function generateCLISource(model: CLIModel): string {
  const resourceCases = model.resources
    .map((r) => generateResourceCase(r.name, r.commands, model))
    .join("\n\n");

  return `#!/usr/bin/env bun
// Generated CLI for ${escapeForTemplate(model.name)}
// Version: ${escapeForTemplate(model.version)}

const CLI_NAME = ${JSON.stringify(model.name)};
const CLI_VERSION = ${JSON.stringify(model.version)};
const CLI_DESCRIPTION = ${JSON.stringify(model.description)};
const BASE_URL = ${JSON.stringify(model.baseUrl)};

// ============ Config Manager ============
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

class ConfigManager {
  private configPath: string;
  private data: Record<string, string>;

  constructor() {
    const baseDir = join(process.env.HOME || "~", ".config");
    const cliDir = join(baseDir, CLI_NAME);
    if (!existsSync(cliDir)) mkdirSync(cliDir, { recursive: true });
    this.configPath = join(cliDir, "config.json");
    this.data = this.load();
  }

  private load(): Record<string, string> {
    if (existsSync(this.configPath)) {
      try { return JSON.parse(readFileSync(this.configPath, "utf-8")); }
      catch { return {}; }
    }
    return {};
  }

  private save(): void {
    writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
  }

  get(key: string): string | undefined { return this.data[key]; }
  set(key: string, value: string): void { this.data[key] = value; this.save(); }
  delete(key: string): void { delete this.data[key]; this.save(); }
  list(): Record<string, string> { return { ...this.data }; }
}

// ============ HTTP Client ============
class HttpClient {
  private headers: Record<string, string> = { "Content-Type": "application/json" };
  private authQueryParams: Record<string, string> = {};

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  setAuthQueryParam(name: string, value: string): void {
    this.authQueryParams[name] = value;
  }

  buildUrl(path: string, pathParams: Record<string, string> = {}, queryParams: Record<string, string> = {}): string {
    let url = path;
    for (const [key, value] of Object.entries(pathParams)) {
      url = url.replace(\`{\${key}}\`, encodeURIComponent(value));
    }
    const fullUrl = \`\${BASE_URL}\${url}\`;
    const mergedQuery = { ...this.authQueryParams, ...queryParams };
    const query = new URLSearchParams(mergedQuery).toString();
    return query ? \`\${fullUrl}?\${query}\` : fullUrl;
  }

  async request(method: string, path: string, options: { pathParams?: Record<string, string>; queryParams?: Record<string, string>; body?: unknown } = {}) {
    const url = this.buildUrl(path, options.pathParams, options.queryParams);
    const response = await fetch(url, {
      method,
      headers: this.headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    return { data, status: response.status };
  }
}

// ============ Output ============
function output(data: unknown, format: string): void {
  const isTTY = process.stdout.isTTY;
  if (format === "table" && Array.isArray(data)) {
    console.log(formatTable(data));
  } else if (isTTY) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(JSON.stringify(data));
  }
}

function formatTable(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";
  const keys = Object.keys(data[0]);
  const widths = keys.map((k) => Math.max(k.length, ...data.map((r) => String(r[k] ?? "").length)));
  const header = keys.map((k, i) => k.padEnd(widths[i])).join("  ");
  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  const rows = data.map((r) => keys.map((k, i) => String(r[k] ?? "").padEnd(widths[i])).join("  "));
  return [header, sep, ...rows].join("\\n");
}

${hasAnyBodySchema(model) ? generateValidateBody() : ''}

// ============ Arg Parser ============
function parseArgs(args: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx > 2) {
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else {
        const key = arg.slice(2);
        const next = args[i + 1];
        if (next && !next.startsWith("--")) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

// ============ Help ============
function showHelp(): void {
  console.log(\`\${CLI_NAME} - \${CLI_DESCRIPTION}

Usage: \${CLI_NAME} <command> [options]

Commands:
  config          Manage configuration
${model.resources.map((r) => `  ${escapeForTemplate(r.name).padEnd(15)} ${escapeForTemplate(r.description)}`).join("\n")}

Global Options:
${generateAuthHelpFlags(model)}
  --output        Output format (json|table)
  --help          Show help
  --version       Show version

Run '\${CLI_NAME} <command> --help' for command-specific help.\`);
}

function showVersion(): void {
  console.log(\`\${CLI_NAME} v\${CLI_VERSION}\`);
}

// ============ Main ============
async function main() {
  const config = new ConfigManager();
  const http = new HttpClient();
  const { positional, flags } = parseArgs(process.argv.slice(2));

  // Global flags
  if (flags.help && positional.length === 0) { showHelp(); return; }
  if (flags.version) { showVersion(); return; }

  const outputFormat = (flags.output as string) || "json";

${generateAuthSetup(model)}

  // Custom headers
  if (flags.header) {
    const [name, value] = (flags.header as string).split(":");
    if (name && value) http.setHeader(name.trim(), value.trim());
  }

  const [cmd, subcmd, ...rest] = positional;

  if (!cmd) { showHelp(); process.exit(1); }

  // Config commands
  if (cmd === "config") {
    if (subcmd === "set" && rest[0] && rest[1]) {
      config.set(rest[0], rest[1]);
      console.log(\`Set \${rest[0]}\`);
    } else if (subcmd === "get" && rest[0]) {
      console.log(config.get(rest[0]) ?? "");
    } else if (subcmd === "list") {
      output(config.list(), outputFormat);
    } else if (subcmd === "delete" && rest[0]) {
      config.delete(rest[0]);
      console.log(\`Deleted \${rest[0]}\`);
    } else {
      console.log(\`Usage: \${CLI_NAME} config <set|get|list|delete> [key] [value]\`);
    }
    return;
  }

${generateOAuthCommands(model)}
${generateSessionCommands(model)}

${resourceCases}

  console.error(\`Unknown command: \${cmd}\`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Error: An unexpected error occurred. Use --help for usage information.");
  process.exit(1);
});
`;
}

function generateResourceCase(resourceName: string, commands: Command[], model: CLIModel): string {
  const commandCases = commands.map((cmd) => generateCommandCase(cmd, model)).join("\n\n");

  const safeResourceName = escapeForTemplate(resourceName);
  const safeModelName = escapeForTemplate(model.name);

  return `  // ${safeResourceName} commands
  if (cmd === ${JSON.stringify(resourceName)}) {
    if (flags.help && !subcmd) {
      console.log(\`${safeModelName} ${safeResourceName} - ${safeResourceName} operations

Usage: ${safeModelName} ${safeResourceName} <command> [options]

Commands:
${commands.map((c) => `  ${escapeForTemplate(c.name).padEnd(15)} ${escapeForTemplate(c.description)}`).join("\n")}\`);
      return;
    }

${commandCases}

    console.error(\`Unknown ${safeResourceName} command: \${subcmd}\`);
    process.exit(1);
  }`;
}

function generateCommandCase(cmd: Command, model: CLIModel): string {
  const pathParams = cmd.params.filter((p) => p.location === "path");
  const queryParams = cmd.params.filter((p) => p.location === "query");

  const pathParamExtract = pathParams
    .map((p, i) => `const ${sanitizeIdentifier(p.name)} = rest[${i}];`)
    .join("\n      ");

  const pathParamCheck = pathParams
    .filter((p) => p.required)
    .map((p) => {
      const safeName = sanitizeIdentifier(p.name);
      return `if (!${safeName}) { console.error("Missing required argument: ${escapeForTemplate(p.name)}"); process.exit(1); }`;
    })
    .join("\n      ");

  const pathParamObj = pathParams.length > 0
    ? `{ ${pathParams.map((p) => {
        const safeName = sanitizeIdentifier(p.name);
        return safeName === p.name ? safeName : `${JSON.stringify(p.name)}: ${safeName}`;
      }).join(", ")} }`
    : "{}";

  const queryParamObj = queryParams.length > 0
    ? `{ ${queryParams.map((p) => {
        const safeKey = JSON.stringify(p.name);
        return `...(flags[${safeKey}] ? { ${safeKey}: flags[${safeKey}] as string } : {})`;
      }).join(", ")} }`
    : "{}";

  const hasBody = cmd.method === "POST" || cmd.method === "PUT" || cmd.method === "PATCH";
  const hasSchema = hasBody && cmd.bodySchema && Object.keys(cmd.bodySchema).length > 0;
  const validationCode = hasSchema
    ? `
      const bodySchema = ${JSON.stringify(cmd.bodySchema)};
      if (body !== undefined) {
        const validationErrors = validateBody(bodySchema, body);
        if (validationErrors.length > 0) {
          console.error("Validation errors:");
          validationErrors.forEach((e: string) => console.error("  - " + e));
          process.exit(1);
        }
      }`
    : "";
  const bodyHandling = hasBody
    ? `
      let body: unknown = undefined;
      if (flags.data) {
        try {
          body = flags.data === "-"
            ? JSON.parse(await Bun.stdin.text())
            : JSON.parse(flags.data as string);
        } catch {
          console.error("Error: Invalid JSON in --data");
          process.exit(1);
        }
      } else if (flags.file) {
        const filePath = flags.file as string;
        if (!filePath.endsWith('.json')) {
          console.error("Error: --file only accepts .json files");
          process.exit(1);
        }
        try {
          body = JSON.parse(await Bun.file(filePath).text());
        } catch {
          console.error("Error: Invalid JSON in file: " + filePath);
          process.exit(1);
        }
      }${validationCode}`
    : "";

  const requestBody = hasBody ? ", body" : "";

  const safeCmdName = escapeForTemplate(cmd.name);
  const safeModelName = escapeForTemplate(model.name);
  const safeCmdDescription = escapeForTemplate(cmd.description);

  return `    if (subcmd === ${JSON.stringify(cmd.name)}) {
      if (flags.help) {
        console.log(\`${safeModelName} ${safeCmdName}${pathParams.map((p) => ` <${escapeForTemplate(p.name)}>`).join("")}

${safeCmdDescription}
${pathParams.length > 0 ? `
Arguments:
${pathParams.map((p) => `  ${escapeForTemplate(p.name).padEnd(15)} ${escapeForTemplate(p.type)} ${p.required ? "(required)" : "(optional)"}  ${escapeForTemplate(p.description)}`).join("\n")}` : ""}
${queryParams.length > 0 || hasBody ? `
Options:
${queryParams.map((p) => `  --${escapeForTemplate(p.name).padEnd(13)} ${escapeForTemplate(p.type)}  ${escapeForTemplate(p.description)}`).join("\n")}${hasBody ? `
  --data          string  JSON request body
  --file          string  Path to JSON file for request body` : ""}` : ""}\`);
        return;
      }
      ${pathParamExtract}
      ${pathParamCheck}${bodyHandling}
      const result = await http.request(${JSON.stringify(cmd.method)}, ${JSON.stringify(cmd.path)}, { pathParams: ${pathParamObj}, queryParams: ${queryParamObj}${requestBody} });
      output(result.data, outputFormat);
      return;
    }`;
}

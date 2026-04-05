import type { CLIModel, Resource, Command, CommandParam, SecurityScheme } from "./types";

interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string }>;
  host?: string;
  basePath?: string;
  schemes?: string[];
  paths: Record<string, Record<string, PathOperation>>;
  securityDefinitions?: Record<string, OpenAPISecurityScheme>;
  components?: {
    securitySchemes?: Record<string, OpenAPISecurityScheme>;
  };
}

interface PathOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: { content?: Record<string, { schema?: object }> };
  responses?: Record<string, { description?: string }>;
}

interface OpenAPIParameter {
  name: string;
  in: "path" | "query" | "header";
  required?: boolean;
  description?: string;
  schema?: { type?: string; default?: unknown };
}

interface OpenAPISecurityScheme {
  type: string;
  scheme?: string;
  in?: string;
  name?: string;
  flows?: {
    authorizationCode?: {
      authorizationUrl?: string;
      tokenUrl?: string;
      scopes?: Record<string, string>;
    };
    implicit?: {
      authorizationUrl?: string;
      scopes?: Record<string, string>;
    };
    password?: {
      tokenUrl?: string;
      scopes?: Record<string, string>;
    };
    clientCredentials?: {
      tokenUrl?: string;
      scopes?: Record<string, string>;
    };
  };
}

const MAX_PATHS = 500;
const MAX_PARAMS_PER_OPERATION = 50;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_SHORT_DESCRIPTION = 80;

function truncateDescription(desc: unknown, short = false): string {
  if (desc == null) return '';
  const str = String(desc);
  const maxLen = short ? MAX_SHORT_DESCRIPTION : MAX_DESCRIPTION_LENGTH;
  if (str.length > maxLen) {
    return str.slice(0, maxLen) + '...';
  }
  return str;
}

function validateSpec(spec: unknown): OpenAPISpec {
  if (!spec || typeof spec !== 'object') {
    throw new Error('Invalid OpenAPI spec: must be an object');
  }

  const s = spec as Record<string, unknown>;

  if (!s.info || typeof s.info !== 'object') {
    throw new Error('Invalid OpenAPI spec: missing "info" section');
  }

  const info = s.info as Record<string, unknown>;
  if (typeof info.title !== 'string' || !info.title) {
    throw new Error('Invalid OpenAPI spec: info.title is required and must be a string');
  }
  if (typeof info.version !== 'string' || !info.version) {
    throw new Error('Invalid OpenAPI spec: info.version is required and must be a string');
  }

  if (!s.paths || typeof s.paths !== 'object') {
    throw new Error('Invalid OpenAPI spec: missing "paths" section');
  }

  // Validate version field if present
  if (s.openapi && typeof s.openapi === 'string') {
    if (!s.openapi.startsWith('3.')) {
      console.error(`Warning: Expected OpenAPI 3.x, got ${s.openapi}`);
    }
  } else if (s.swagger && typeof s.swagger === 'string') {
    if (!s.swagger.startsWith('2.')) {
      console.error(`Warning: Expected Swagger 2.x, got ${s.swagger}`);
    }
  }

  return spec as OpenAPISpec;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function operationIdToCommandName(operationId?: string): string | null {
  if (!operationId) return null;
  const lowerOp = operationId.toLowerCase();

  // Handle common CRUD patterns
  if (lowerOp.startsWith("create") || lowerOp.includes("upload")) return "create";
  if (lowerOp.startsWith("update") || lowerOp.startsWith("put") || lowerOp.includes("star")) return "update";
  if (lowerOp.startsWith("delete") && !lowerOp.includes("undelete")) return "delete";
  if (lowerOp.includes("undelete")) return "undelete";
  if (lowerOp.startsWith("list") || lowerOp.includes("explore")) return "list";

  // Handle Splitwise-style operationIds: delete_group, add_user_to_group, remove_user_from_group
  if (lowerOp.startsWith("add_")) return "add-user";
  if (lowerOp.startsWith("remove_")) return "remove-user";

  if (lowerOp.startsWith("get")) {
    if (lowerOp.includes("stats")) return "stats";
    if (lowerOp.includes("zones")) return "zones";
    if (lowerOp.includes("activities")) return "activities";
    if (lowerOp.includes("friends") || lowerOp.includes("clubs")) return "list";
    if (lowerOp.includes("all") || lowerOp.includes("_list")) return "list";
    return "get";
  }

  // Handle multi-word operationIds: delete_group -> delete, add_user_to_group -> add-user
  const parts = lowerOp.split(/[_\s-]+/).filter(Boolean);
  if (parts.length >= 2) {
    // First part is likely the verb
    const first = parts[0];
    if (['get', 'list', 'create', 'update', 'delete', 'undelete', 'add', 'remove'].includes(first)) {
      return first === 'add' ? 'add-user' : first === 'remove' ? 'remove-user' : first;
    }
    // Otherwise last part is the noun, first is verb
    const verb = parts[0];
    if (['get', 'list', 'create', 'update', 'delete', 'undelete', 'add', 'remove'].includes(verb)) {
      return verb === 'add' ? 'add-user' : verb === 'remove' ? 'remove-user' : verb;
    }
  }

  return null;
}

function httpMethodToCommandName(method: string, hasId: boolean, operationId?: string, path?: string): string {
  const opCommand = operationIdToCommandName(operationId);
  if (opCommand) return opCommand;

  // For compound action paths like /delete_group/{id}, derive from path segment
  if (path) {
    const segments = path.split('/').filter(Boolean);
    const action = segments.find(s => !s.startsWith('{')) || '';
    // Map compound action names to commands
    if (action.includes('undelete')) return 'undelete';
    if (action.startsWith('add_')) return 'add-user';
    if (action.startsWith('remove_')) return 'remove-user';
    if (action.startsWith('delete')) return 'delete';
    if (action.startsWith('create')) return 'create';
    if (action.startsWith('update')) return 'update';
  }

  const map: Record<string, string> = {
    get: hasId ? "get" : "list",
    post: "create",
    put: "update",
    patch: "update",
    delete: "delete",
  };
  return map[method.toLowerCase()] || method.toLowerCase();
}

// Strip common action prefixes from resource names to get the noun
const ACTION_PREFIXES = ['get_', 'create_', 'update_', 'delete_', 'list_', 'add_', 'remove_', 'undelete_'];
// Common nouns to recognize and pluralize
const PLURALIZABLE = new Set(['group', 'user', 'friend', 'friend', 'expense', 'comment', 'notification', 'category', 'currency']);

function extractResourceName(path: string): string {
  const segments = path.split("/").filter(Boolean);
  for (const seg of segments) {
    if (!seg.startsWith("{")) {
      let noun = seg;

      // Strip action prefix if present
      for (const prefix of ACTION_PREFIXES) {
        if (noun.startsWith(prefix)) {
          noun = noun.slice(prefix.length);
          break;
        }
      }

      // Handle compound paths like 'user_to_group' -> strip to 'group'
      // 'add_user_to_group' -> 'group', 'remove_user_from_group' -> 'group'
      if (noun.includes('_to_') || noun.includes('_from_') || noun.includes('_in_')) {
        const parts = noun.split('_');
        // Take the last meaningful noun
        for (let i = parts.length - 1; i >= 0; i--) {
          if (!['to', 'from', 'in', 'of', 'the', 'a', 'an'].includes(parts[i]) && parts[i].length > 2) {
            noun = parts[i];
            break;
          }
        }
      }

      // Pluralize common nouns
      if (PLURALIZABLE.has(noun)) {
        noun = noun + 's';
      }

      return noun;
    }
  }
  return segments[0]?.replace(/[{}]/g, "") || "root";
}

function parseParameter(param: OpenAPIParameter): CommandParam {
  return {
    name: param.name,
    type: (param.schema?.type as CommandParam["type"]) || "string",
    required: param.required ?? false,
    description: truncateDescription(param.description || ""),
    default: param.schema?.default,
    location: param.in,
  };
}

function parseSecuritySchemes(spec: OpenAPISpec): SecurityScheme[] {
  const schemes = spec.components?.securitySchemes || spec.securityDefinitions;
  if (!schemes) return [];
  return Object.entries(schemes).map(([name, scheme]) => {
    let type: SecurityScheme["type"] = "bearer";
    
    // Check for custom x-auth-type extension first
    const customType = (scheme as any)['x-auth-type'];
    if (customType === 'session') {
      type = 'session';
    } else if (scheme.type === "apiKey") {
      // Detect session auth by Cookie header
      if (scheme.name === "Cookie" && scheme.in === "header") {
        type = "session";
      } else {
        type = "apiKey";
      }
    } else if (scheme.type === "http" && scheme.scheme === "basic") {
      type = "basic";
    } else if (scheme.type === "oauth2") {
      type = "oauth2";
    }

    const result: SecurityScheme = { name, type, location: scheme.in as SecurityScheme["location"], paramName: scheme.name };

    // Extract OAuth2 details - both OpenAPI 3.0 and Swagger 2.0 formats
    if (type === "oauth2") {
      const flow = (scheme as any).flows?.authorizationCode || (scheme as any);
      if (flow.authorizationUrl) result.authorizationUrl = flow.authorizationUrl;
      if (flow.tokenUrl) result.tokenUrl = flow.tokenUrl;
      if (flow.scopes) result.scopes = Object.keys(flow.scopes);
    }

    // Extract session login URL from extension
    if (type === "session") {
      const loginUrl = (scheme as any)['x-login-url'];
      if (loginUrl) result.loginUrl = loginUrl;
    }

    return result;
  });
}

export function parseOpenAPI(spec: unknown): CLIModel {
  const validated = validateSpec(spec);

  const name = slugify(validated.info.title);
  const version = validated.info.version;
  // Use summary if available, otherwise first line of description
  const rawDesc = validated.info.description || validated.info.title || '';
  const firstLine = rawDesc.split('\n')[0].trim();
  const description = truncateDescription(firstLine, true);
  
  let baseUrl = "";
  if (validated.servers?.[0]?.url) {
    baseUrl = validated.servers[0].url;
  } else if ((validated as any).host && (validated as any).basePath) {
    const s = validated as any;
    const scheme = s.schemes?.[0] || "https";
    baseUrl = `${scheme}://${s.host}${s.basePath}`;
  }

  const resourceMap = new Map<string, Command[]>();

  const pathEntries = Object.entries(validated.paths);
  if (pathEntries.length > MAX_PATHS) {
    throw new Error(`OpenAPI spec exceeds maximum of ${MAX_PATHS} paths (found ${pathEntries.length})`);
  }

  for (const [path, methods] of pathEntries) {
    const resourceName = extractResourceName(path);
    const hasPathParam = path.includes("{");

    for (const [method, operation] of Object.entries(methods)) {
      if (typeof operation !== "object" || !operation) continue;
      const httpMethod = method.toUpperCase() as Command["method"];
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(httpMethod)) continue;

      const params: CommandParam[] = (operation.parameters || []).slice(0, MAX_PARAMS_PER_OPERATION).map(parseParameter);
      const bodyContent = operation.requestBody?.content?.["application/json"];
      const bodySchema = bodyContent?.schema;

      // Prefer summary for short description, fall back to first line of description
      const opDescRaw = operation.summary || operation.description || '';
      const opDesc = truncateDescription(opDescRaw.split('\n')[0].trim(), true);

      const command: Command = {
        name: httpMethodToCommandName(method, hasPathParam, operation.operationId, path),
        description: opDesc,
        method: httpMethod,
        path,
        params,
        bodySchema,
        responses: Object.fromEntries(
          Object.entries(operation.responses || {}).map(([code, resp]) => [code, { description: truncateDescription(resp.description || "") }])
        ),
      };

      const existing = resourceMap.get(resourceName) || [];
      existing.push(command);
      resourceMap.set(resourceName, existing);
    }
  }

  const resources: Resource[] = Array.from(resourceMap.entries()).map(([name, commands]) => ({
    name, description: truncateDescription(`${name} operations`, true), commands,
  }));

  const securitySchemes = parseSecuritySchemes(validated);
  return { name, version, description, baseUrl, resources, securitySchemes };
}

// src/generator/types.ts

export interface CommandParam {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required: boolean;
  description: string;
  default?: unknown;
  location: "path" | "query" | "header" | "body";
}

export interface Command {
  name: string;
  description: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  params: CommandParam[];
  bodySchema?: object;
  responses: Record<string, { description: string }>;
}

export interface Resource {
  name: string;
  description: string;
  commands: Command[];
}

export interface CLIModel {
  name: string;
  version: string;
  description: string;
  baseUrl: string;
  resources: Resource[];
  securitySchemes: SecurityScheme[];
}

export interface SecurityScheme {
  name: string;
  type: "bearer" | "apiKey" | "basic" | "oauth2" | "session";
  location?: "header" | "cookie" | "query";
  paramName?: string;
  // OAuth2 fields
  authorizationUrl?: string;
  tokenUrl?: string;
  scopes?: string[];
  // Session auth fields
  loginUrl?: string;
}

export interface GeneratorOptions {
  name?: string;
  output?: string;
  spec: object;
}

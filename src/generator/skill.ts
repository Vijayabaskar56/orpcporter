import type { CLIModel, Resource, Command, CommandParam } from "./types";

function escapeMarkdown(text: unknown): string {
  if (text == null) return '';
  return String(text);
}

function generateAuthSetupSection(model: CLIModel): string {
  const scheme = model.securitySchemes[0];
  if (!scheme) return 'No authentication required.';

  const name = model.name;
  switch (scheme.type) {
    case 'bearer':
      return `Run \`${name} config set token <your-token>\` or set the \`${name.toUpperCase().replace(/-/g, '_')}_TOKEN\` environment variable.`;
    case 'apiKey':
      return `Run \`${name} config set api-key <your-key>\` or set the \`${name.toUpperCase().replace(/-/g, '_')}_API_KEY\` environment variable.`;
    case 'basic':
      return `Run \`${name} config set username <user>\` and \`${name} config set password <pass>\`.`;
    case 'oauth2':
      const scopes = scheme.scopes?.join(', ') || 'read,write';
      const authUrl = scheme.authorizationUrl || '[authorization_url]';
      return `1. Register callback URL \`http://localhost:8174/callback\` in your app settings
2. Run \`${name} oauth login\` to authenticate via browser
3. The OAuth scopes requested: ${scopes}

Alternatively, manually exchange token at: ${authUrl}`;
    default:
      return 'No authentication required.';
  }
}

function generateCommandSection(resource: Resource, cliName: string): string {
  const lines: string[] = [];

  lines.push(`### ${escapeMarkdown(resource.name)}`);
  lines.push('');
  if (resource.description) {
    lines.push(escapeMarkdown(resource.description));
    lines.push('');
  }

  for (const cmd of resource.commands) {
    const pathParams = cmd.params.filter(p => p.location === 'path');
    const queryParams = cmd.params.filter(p => p.location === 'query');
    const hasBody = cmd.method === 'POST' || cmd.method === 'PUT' || cmd.method === 'PATCH';
    const args = pathParams.map(p => `<${p.name}>`).join(' ');

    lines.push(`**${resource.name} ${cmd.name}** - ${escapeMarkdown(cmd.description)}`);
    lines.push('');
    lines.push('```');
    lines.push(`${cliName} ${resource.name} ${cmd.name}${args ? ' ' + args : ''}`);
    lines.push('```');
    lines.push('');

    if (pathParams.length > 0) {
      lines.push('Arguments:');
      for (const p of pathParams) {
        lines.push(`- \`${p.name}\` (${p.type}${p.required ? ', required' : ''}) - ${escapeMarkdown(p.description)}`);
      }
      lines.push('');
    }

    if (queryParams.length > 0) {
      lines.push('Options:');
      for (const p of queryParams) {
        lines.push(`- \`--${p.name}\` (${p.type}) - ${escapeMarkdown(p.description)}`);
      }
      lines.push('');
    }

    if (hasBody) {
      lines.push('Accepts request body via `--data \'{"key":"value"}\'` or `--file path.json`');
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function generateSkillFile(model: CLIModel): string {
  const sections: string[] = [];

  // Frontmatter
  sections.push('---');
  sections.push(`name: ${model.name}`);
  sections.push(`description: ${escapeMarkdown(model.description)}`);
  sections.push('---');
  sections.push('');

  // Title and description
  sections.push(`# ${escapeMarkdown(model.name)}`);
  sections.push('');
  sections.push(escapeMarkdown(model.description));
  sections.push('');
  sections.push(`Base URL: ${escapeMarkdown(model.baseUrl)}`);
  sections.push(`Version: ${escapeMarkdown(model.version)}`);
  sections.push('');

  // Setup
  sections.push('## Setup');
  sections.push('');
  sections.push(generateAuthSetupSection(model));
  sections.push('');

  // Commands
  sections.push('## Commands');
  sections.push('');
  for (const resource of model.resources) {
    sections.push(generateCommandSection(resource, model.name));
  }

  // Global Options
  sections.push('## Global Options');
  sections.push('');
  sections.push('- `--output json|table` - Output format');
  sections.push('- `--help` - Show help');
  sections.push('- `--version` - Show version');
  sections.push('');

  return sections.join('\n');
}

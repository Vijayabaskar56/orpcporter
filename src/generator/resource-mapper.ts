import type { CLIModel, Resource, Command } from "./types";

export interface CommandNode {
  name: string;
  description: string;
  command?: Command;
  children: Record<string, CommandNode>;
}

export class ResourceMapper {
  private model: CLIModel;
  private tree: CommandNode;

  constructor(model: CLIModel) {
    this.model = model;
    this.tree = this.buildTree();
  }

  private buildTree(): CommandNode {
    const root: CommandNode = { name: this.model.name, description: this.model.description, children: {} };
    root.children.config = {
      name: "config", description: "Manage configuration",
      children: {
        set: { name: "set", description: "Set a config value", children: {} },
        get: { name: "get", description: "Get a config value", children: {} },
        list: { name: "list", description: "List all config values", children: {} },
        delete: { name: "delete", description: "Delete a config value", children: {} },
      },
    };
    for (const resource of this.model.resources) {
      const resourceNode: CommandNode = { name: resource.name, description: resource.description, children: {} };
      for (const cmd of resource.commands) {
        resourceNode.children[cmd.name] = { name: cmd.name, description: cmd.description, command: cmd, children: {} };
      }
      root.children[resource.name] = resourceNode;
    }
    return root;
  }

  getCommandTree(): CommandNode { return this.tree; }

  getRootHelp(): string {
    const lines: string[] = [
      `${this.model.name} - ${this.model.description}`, "",
      `Usage: ${this.model.name} <command> [options]`, "", "Commands:",
    ];
    for (const [name, node] of Object.entries(this.tree.children)) {
      lines.push(`  ${name.padEnd(15)} ${node.description}`);
    }
    lines.push("", "Global Options:", "  --token       API token", "  --output      Output format (json|table)", "  --help        Show help", "  --version     Show version", "");
    lines.push(`Run '${this.model.name} <command> --help' for command-specific help.`);
    return lines.join("\n");
  }

  getCommandHelp(path: string[]): string {
    let node = this.tree;
    for (const segment of path) {
      if (node.children[segment]) node = node.children[segment];
      else return `Unknown command: ${path.join(" ")}`;
    }
    if (node.command) return this.formatCommandHelp(node.command, path);
    const lines: string[] = [
      `${this.model.name} ${path.join(" ")} - ${node.description}`, "",
      `Usage: ${this.model.name} ${path.join(" ")} <command> [options]`, "", "Commands:",
    ];
    for (const [name, child] of Object.entries(node.children)) {
      lines.push(`  ${name.padEnd(15)} ${child.description}`);
    }
    return lines.join("\n");
  }

  private formatCommandHelp(cmd: Command, path: string[]): string {
    const pathParams = cmd.params.filter((p) => p.location === "path");
    const queryParams = cmd.params.filter((p) => p.location === "query");
    const positionals = pathParams.map((p) => `<${p.name}>`).join(" ");
    const usage = `${this.model.name} ${path.join(" ")} ${positionals}`.trim();
    const lines: string[] = [usage, "", cmd.description, ""];
    if (pathParams.length > 0) {
      lines.push("Arguments:");
      for (const p of pathParams) {
        lines.push(`  ${p.name.padEnd(15)} ${p.type} ${p.required ? "(required)" : "(optional)"}  ${p.description}`);
      }
      lines.push("");
    }
    if (queryParams.length > 0 || cmd.bodySchema) {
      lines.push("Options:");
      for (const p of queryParams) {
        const def = p.default !== undefined ? `(default: ${p.default})` : "";
        lines.push(`  --${p.name.padEnd(13)} ${p.type}  ${p.description} ${def}`);
      }
      if (cmd.bodySchema) {
        lines.push(`  --data          string  JSON request body`);
        lines.push(`  --file          string  Path to JSON file for request body`);
      }
      lines.push("");
    }
    if (Object.keys(cmd.responses).length > 0) {
      lines.push("Response Codes:");
      for (const [code, resp] of Object.entries(cmd.responses)) {
        lines.push(`  ${code}  ${resp.description}`);
      }
    }
    return lines.join("\n");
  }
}

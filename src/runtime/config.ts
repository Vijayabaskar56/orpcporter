import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "fs";
import { join } from "path";

export class ConfigManager {
  private configPath: string;
  private data: Record<string, string>;

  private static readonly FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  private static isValidKey(key: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(key) && !ConfigManager.FORBIDDEN_KEYS.has(key);
  }

  constructor(cliName: string, configDir?: string) {
    const baseDir = configDir || join(process.env.HOME || "~", ".config");
    const cliDir = join(baseDir, cliName);
    if (!existsSync(cliDir)) {
      mkdirSync(cliDir, { recursive: true });
      chmodSync(cliDir, 0o700);
    }
    this.configPath = join(cliDir, "config.json");
    this.data = this.load();
  }

  private load(): Record<string, string> {
    if (existsSync(this.configPath)) {
      try {
        const raw = JSON.parse(readFileSync(this.configPath, "utf-8"));
        const data: Record<string, string> = Object.create(null);
        for (const [key, value] of Object.entries(raw)) {
          if (ConfigManager.isValidKey(key) && typeof value === "string") {
            data[key] = value;
          }
        }
        return data;
      } catch (e) { console.error("Failed to parse config file " + this.configPath + ":", e); return Object.create(null); }
    }
    return Object.create(null);
  }

  private save(): void {
    writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
    chmodSync(this.configPath, 0o600);
  }

  get(key: string): string | undefined { return this.data[key]; }

  set(key: string, value: string): void {
    if (!ConfigManager.isValidKey(key)) {
      throw new Error(`Invalid config key: ${key}`);
    }
    this.data[key] = value;
    this.save();
  }

  delete(key: string): void {
    if (!ConfigManager.isValidKey(key)) {
      throw new Error(`Invalid config key: ${key}`);
    }
    delete this.data[key];
    this.save();
  }

  list(): Record<string, string> { return { ...this.data }; }
}

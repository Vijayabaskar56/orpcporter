export type OutputFormat = "json" | "table";

export class OutputFormatter {
  private fmt: OutputFormat;
  private isTTY: boolean;

  constructor(fmt: OutputFormat = "json", isTTY: boolean = true) {
    this.fmt = fmt;
    this.isTTY = isTTY;
  }

  format(data: unknown): string {
    if (this.fmt === "table" && Array.isArray(data)) {
      return this.formatTable(data);
    }
    return this.formatJson(data);
  }

  private formatJson(data: unknown): string {
    if (this.isTTY) return JSON.stringify(data, null, 2);
    return JSON.stringify(data);
  }

  private formatTable(data: Record<string, unknown>[]): string {
    if (data.length === 0) return "";
    const keys = Object.keys(data[0]);
    const widths = keys.map((key) => {
      const maxDataWidth = Math.max(...data.map((row) => String(row[key] ?? "").length));
      return Math.max(key.length, maxDataWidth);
    });
    const header = keys.map((key, i) => key.padEnd(widths[i])).join("  ");
    const separator = widths.map((w) => "-".repeat(w)).join("  ");
    const rows = data.map((row) =>
      keys.map((key, i) => String(row[key] ?? "").padEnd(widths[i])).join("  ")
    );
    return [header, separator, ...rows].join("\n");
  }
}

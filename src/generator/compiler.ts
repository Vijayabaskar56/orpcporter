import { writeFileSync, unlinkSync, chmodSync, mkdtempSync, rmdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export async function compileCLI(source: string, outputPath: string): Promise<void> {
  // Validate output path to prevent path-as-flag confusion
  if (outputPath.startsWith('-')) {
    throw new Error("Output path cannot start with '-'");
  }

  // Create a unique temp directory with restricted permissions
  const tempDir = mkdtempSync(join(tmpdir(), "orpc-"));
  chmodSync(tempDir, 0o700);
  const tempFile = join(tempDir, "cli.ts");

  try {
    writeFileSync(tempFile, source);
    chmodSync(tempFile, 0o600);

    const proc = Bun.spawn(["bun", "build", "--compile", "--outfile", outputPath, "--", tempFile], {
      stdout: "pipe", stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`Compilation failed (exit code ${exitCode})`);
    }
    chmodSync(outputPath, 0o755);
  } finally {
    try { unlinkSync(tempFile); } catch (e) { console.error("Cleanup: failed to remove temp file " + tempFile + ":", e); }
    try { rmdirSync(tempDir); } catch (e) { console.error("Cleanup: failed to remove temp dir " + tempDir + ":", e); }
  }
}

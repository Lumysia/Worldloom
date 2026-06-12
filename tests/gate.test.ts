import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const eslintPath = "node_modules/eslint/bin/eslint.js";

interface CommandOutput {
  stdout: string;
  stderr: string;
}

async function lintText(filePath: string, code: string): Promise<CommandOutput> {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [eslintPath, "--stdin", "--stdin-filename", filePath],
      { windowsHide: true },
    );
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const output = {
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
      };

      if (code === 0) {
        resolve(output);
        return;
      }

      reject(output);
    });
    child.stdin.end(code);
  });
}

describe("quality gate", () => {
  it("T-GATE-01", async () => {
    await expect(
      execFileAsync(
        process.execPath,
        [
          "node_modules/dependency-cruiser/bin/dependency-cruise.mjs",
          "packages/kernel/src/__violation__.ts",
        ],
        { windowsHide: true },
      ),
    ).rejects.toMatchObject({
      stdout: expect.stringContaining("K1-kernel-purity"),
    });
  });

  it("rejects as unknown as casts", async () => {
    await expect(
      lintText(
        "packages/metamodel/src/cast-regression.ts",
        "const value = ('x' as unknown) as string;\nvoid value;\n",
      ),
    ).rejects.toMatchObject({
      stdout: expect.stringContaining("F5 forbids as unknown as casts"),
    });
  });

  it("rejects console-only kernel catch blocks", async () => {
    await expect(
      lintText(
        "packages/kernel/src/catch-regression.ts",
        "try {\n  throw new Error('x');\n} catch (error) {\n  console.log(error);\n}\n",
      ),
    ).rejects.toMatchObject({
      stdout: expect.stringContaining("F10 forbids console-only catch blocks"),
    });
  });
});

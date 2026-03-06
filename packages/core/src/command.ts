import { spawn } from "node:child_process";
import path from "node:path";

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface SpawnInvocation {
  command: string;
  args: string[];
}

export function buildSpawnInvocation(
  command: string,
  args: string[],
  platform: NodeJS.Platform = process.platform
): SpawnInvocation {
  const extension = path.extname(command).toLowerCase();
  if (platform === "win32" && (extension === ".cmd" || extension === ".bat")) {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", command, ...args]
    };
  }

  return { command, args };
}

export function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const invocation = buildSpawnInvocation(command, args);
    const child = spawn(invocation.command, invocation.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: false
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

export async function which(binary: string, env?: NodeJS.ProcessEnv) {
  const probe = process.platform === "win32" ? "where.exe" : "which";
  const result = await runCommand(probe, [binary], { env });
  if (result.code !== 0 || !result.stdout) {
    return null;
  }

  return result.stdout.split(/\r?\n/)[0] ?? null;
}

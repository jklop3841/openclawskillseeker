import { type ClawhubResolutionMode } from "@openclaw-skill-center/shared";
import { runCommand, type CommandResult, which } from "./command.js";

export interface ClawhubResolutionOptions {
  clawhubBin?: string;
  useWsl?: boolean;
  probeWsl?: boolean;
  env?: NodeJS.ProcessEnv;
  runner?: (command: string, args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv }) => Promise<CommandResult>;
}

export interface ClawhubResolution {
  found: boolean;
  mode: ClawhubResolutionMode;
  command: string;
  argsPrefix: string[];
  displayCommand: string;
  clawhubPath: string | null;
  wslAvailable: boolean;
}

function quoteForBash(value: string) {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

export function buildClawhubInvocation(
  resolution: ClawhubResolution,
  clawhubArgs: string[]
): { command: string; args: string[] } {
  if (resolution.mode === "wsl") {
    const shellCommand = ["clawhub", ...clawhubArgs].map(quoteForBash).join(" ");
    return {
      command: resolution.command,
      args: [...resolution.argsPrefix, shellCommand]
    };
  }

  return {
    command: resolution.command,
    args: [...resolution.argsPrefix, ...clawhubArgs]
  };
}

export async function resolveClawhub(
  options: ClawhubResolutionOptions = {}
): Promise<ClawhubResolution> {
  const env = options.env ?? process.env;
  const runner = options.runner ?? runCommand;
  const explicit = options.clawhubBin?.trim();
  const envBinary = env.CLAWHUB_BIN?.trim();
  const shouldProbeWsl = Boolean(options.useWsl || options.probeWsl);
  const wslAvailable = shouldProbeWsl ? await detectWslAvailability(runner) : false;

  if (options.useWsl) {
    const wslBinary = wslAvailable ? await detectWslClawhub(runner) : null;
    if (wslBinary) {
      return {
        found: true,
        mode: "wsl",
        command: "wsl",
        argsPrefix: ["bash", "-lc"],
        displayCommand: `wsl bash -lc "clawhub"`,
        clawhubPath: wslBinary,
        wslAvailable
      };
    }

    return {
      found: false,
      mode: "not-found",
      command: "wsl",
      argsPrefix: ["bash", "-lc"],
      displayCommand: `wsl bash -lc "clawhub"`,
      clawhubPath: null,
      wslAvailable
    };
  }

  if (explicit) {
    return {
      found: true,
      mode: "explicit-path",
      command: explicit,
      argsPrefix: [],
      displayCommand: explicit,
      clawhubPath: explicit,
      wslAvailable
    };
  }

  if (envBinary) {
    return {
      found: true,
      mode: "env",
      command: envBinary,
      argsPrefix: [],
      displayCommand: envBinary,
      clawhubPath: envBinary,
      wslAvailable
    };
  }

  const pathBinary = await which("clawhub", env);
  if (pathBinary) {
    return {
      found: true,
      mode: "path",
      command: pathBinary,
      argsPrefix: [],
      displayCommand: pathBinary,
      clawhubPath: pathBinary,
      wslAvailable
    };
  }

  return {
    found: false,
    mode: "not-found",
    command: "clawhub",
    argsPrefix: [],
    displayCommand: "clawhub",
    clawhubPath: null,
    wslAvailable
  };
}

export async function detectWslAvailability(
  runner: (command: string, args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv }) => Promise<CommandResult> = runCommand
) {
  if (process.platform !== "win32") {
    return false;
  }

  try {
    const result = await runner("wsl", ["bash", "-lc", "printf __OCSC_WSL_OK__"]);
    return result.code === 0 && `${result.stdout}${result.stderr}`.includes("__OCSC_WSL_OK__");
  } catch {
    return false;
  }
}

async function detectWslClawhub(
  runner: (command: string, args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv }) => Promise<CommandResult>
) {
  try {
    const result = await runner("wsl", ["bash", "-lc", "command -v clawhub"]);
    return result.code === 0 && result.stdout ? result.stdout.split(/\r?\n/)[0] ?? null : null;
  } catch {
    return null;
  }
}

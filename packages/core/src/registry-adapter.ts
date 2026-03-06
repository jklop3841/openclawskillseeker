import { type CommandResult, runCommand } from "./command.js";
import {
  buildClawhubInvocation,
  resolveClawhub,
  type ClawhubResolution,
  type ClawhubResolutionOptions
} from "./clawhub-resolution.js";

export interface RegistryCommandOutput {
  ok: boolean;
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
}

export interface RegistryAdapterOptions {
  binary?: string;
  clawhubBin?: string;
  useWsl?: boolean;
  env?: NodeJS.ProcessEnv;
  runner?: (command: string, args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv }) => Promise<CommandResult>;
}

export class RegistryAdapter {
  private readonly runner: (command: string, args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv }) => Promise<CommandResult>;
  private readonly resolutionOptions: ClawhubResolutionOptions;

  constructor(
    private readonly defaultWorkdir: string,
    options: RegistryAdapterOptions = {}
  ) {
    this.runner = options.runner ?? runCommand;
    this.resolutionOptions = {
      clawhubBin: options.clawhubBin ?? options.binary,
      useWsl: options.useWsl,
      env: options.env,
      runner: this.runner
    };
  }

  async resolveBinary() {
    return resolveClawhub(this.resolutionOptions);
  }

  async detectBinary() {
    const resolution = await this.resolveBinary();
    return resolution.clawhubPath;
  }

  async search(query: string, limit = 10) {
    return this.exec(["search", query, "--limit", String(limit)]);
  }

  async explore(limit = 10) {
    return this.exec(["search", "", "--limit", String(limit)]);
  }

  async inspect(slug: string) {
    const direct = await this.exec(["inspect", slug]);
    if (direct.ok || !this.shouldFallbackInspect(direct)) {
      return direct;
    }

    const fallback = await this.exec(["search", slug, "--limit", "1"]);
    return {
      ...fallback,
      stderr: fallback.stderr
        ? `${fallback.stderr}\ninspect fallback: official inspect command unavailable, used search`
        : "inspect fallback: official inspect command unavailable, used search"
    };
  }

  async install(
    slug: string,
    workdir: string,
    dir = "skills",
    version?: string,
    options: { force?: boolean } = {}
  ) {
    const args = ["install", slug, "--workdir", workdir, "--dir", dir, "--no-input"];
    if (version) {
      args.push("--version", version);
    }

    if (options.force) {
      args.push("--force");
    }

    return this.exec(args, workdir);
  }

  async update(slug: string, workdir: string, dir = "skills") {
    return this.exec(["update", slug, "--workdir", workdir, "--dir", dir, "--no-input"], workdir);
  }

  private async exec(args: string[], cwd = this.defaultWorkdir): Promise<RegistryCommandOutput> {
    const resolution = await this.resolveBinary();
    if (!resolution.found) {
      return {
        ok: false,
        command: resolution.displayCommand,
        args,
        stdout: "",
        stderr: `clawhub not found via mode=${resolution.mode}`
      };
    }

    const invocation = buildClawhubInvocation(resolution, args);
    const result = await this.runner(invocation.command, invocation.args, { cwd, env: this.resolutionOptions.env });
    return {
      ok: result.code === 0,
      command: invocation.command,
      args: invocation.args,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }

  private shouldFallbackInspect(result: RegistryCommandOutput) {
    const haystack = `${result.stdout}\n${result.stderr}`.toLowerCase();
    return haystack.includes("unknown") || haystack.includes("help") || haystack.includes("not recognized");
  }
}

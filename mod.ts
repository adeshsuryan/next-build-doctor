/**
 * Next build doctor — read a Next.js project and report build-memory
 * and build-performance risks before the build hits them.
 *
 * This is the typed entrypoint (used by JSR and ESM consumers). The
 * implementation itself is dependency-free CommonJS under `src/`.
 *
 * ```ts
 * import { run, render } from "@adeshsuryan/next-build-doctor";
 * const result = run("./my-next-app");
 * console.log(render(result));
 * ```
 *
 * @module
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const cjs = require("./src/index.js") as {
  run: (directory?: string, options?: RunOptions) => RunResult;
  render: (result: RunResult) => string;
};

/** Analysis mode. `scan` reads source/config; `inspect` reads `.next/`; `profile` runs `next build`. */
export type Mode = "scan" | "inspect" | "profile";

/** A single build-memory or build-performance risk found in the project. */
export interface Finding {
  /** Stable rule identifier, e.g. `static-gen-fanout`. */
  id: string;
  /** Risk level: `high`, `medium`, or `low`. */
  risk: "high" | "medium" | "low" | string;
  /** One-line summary. */
  title?: string;
  /** Explanation of the risk and its evidence. */
  detail?: string;
  /** Project-relative file path. */
  file?: string;
  /** 1-based line number. */
  line?: number;
  /** Suggested remediation. */
  fix?: string;
}

/** Options accepted by {@linkcode run}. */
export interface RunOptions {
  /** Mode to run. Defaults to `scan`; other modes throw until shipped. */
  mode?: Mode;
}

/** Detected project model plus the findings it produced. */
export interface RunResult {
  /** Absolute path that was scanned. */
  root: string;
  /** Mode that produced this result. */
  mode: Mode;
  /** Number of files read. */
  fileCount: number;
  /** JSON schema version for machine consumers. */
  schemaVersion: number;
  /** Detected project model (version, bundler, routes, config, docker, ci). */
  project: Record<string, unknown>;
  /** Findings sorted by risk (high first). */
  findings: Finding[];
}

/**
 * Scan a Next.js project directory and return detected facts plus findings.
 * Read-only in `scan` mode: it never executes project code or writes files.
 */
export function run(directory?: string, options?: RunOptions): RunResult {
  return cjs.run(directory, options);
}

/** Render a human-readable text report for a {@linkcode run} result. */
export function render(result: RunResult): string {
  return cjs.render(result);
}

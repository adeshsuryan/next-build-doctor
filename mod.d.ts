export type Mode = "scan" | "inspect" | "profile";

export type Finding = {
  id: string;
  risk: "high" | "medium" | "low" | string;
  title?: string;
  detail?: string;
  file?: string;
  line?: number;
  fix?: string;
  confidence?: "exact" | "heuristic" | string;
  [key: string]: unknown;
};

export type RunOptions = {
  mode?: Mode;
  nextBuildArgs?: string[];
  samplesJson?: string;
};

export type RunResult = {
  root: string;
  mode: Mode;
  fileCount: number;
  schemaVersion: number;
  project: unknown;
  findings: Finding[];
};

/** Scan a Next.js project directory and return build-memory / build-performance findings. */
export function run(directory?: string, options?: RunOptions): RunResult;

/** Render a text report for a run() result. */
export function render(result: RunResult): string;

"use strict";

const { run } = require("./run");
const { render } = require("./report");
const pkg = require("../package.json");

const MODES = new Set(["scan", "inspect", "profile", "docker"]);

function usage() {
  return [
    "Usage: next-build-doctor [mode] [directory] [--json] [--fail-on-high] [--verbose]",
    "",
    "Modes:",
    "  scan      Read source and config; report build-memory and build-performance risk (default).",
    "  inspect   Read .next build artifacts (not available in this version).",
    "    profile   Run next build and sample process memory (not available in this version).",
    "  docker    Analyze Dockerfile, .dockerignore, compose, and CI (not available in this version).",
    "",
    "Flags:",
    "  --json           Print the JSON result instead of the text report.",
    "  --fail-on-high   Exit 1 when any finding is high risk.",
    "  --verbose        Add per-rule evidence lines.",
    "  --version        Print the package version.",
    "  --help           Print this message.",
  ].join("\n");
}

function main(argv) {
  const args = argv.slice();
  const json = args.includes("--json");
  const failOn = args.includes("--fail-on-high");
  const verbose = args.includes("--verbose");

  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(usage() + "\n");
    return;
  }
  if (args.includes("--version") || args.includes("-v")) {
    process.stdout.write(pkg.version + "\n");
    return;
  }

  const flagSet = new Set(["--json", "--fail-on-high", "--verbose", "--help", "-h", "--version", "-v"]);
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") break; // reserved passthrough for profile mode
    if (flagSet.has(arg)) continue;
    if (arg.startsWith("-")) {
      console.error(`Unknown flag: ${arg}`);
      process.exitCode = 2;
      return;
    }
    positional.push(arg);
  }

  let mode = "scan";
  if (positional.length > 0 && MODES.has(positional[0])) {
    mode = positional.shift();
  }
  if (positional.length > 1) {
    console.error(`Unexpected extra arguments: ${positional.slice(1).join(" ")}`);
    process.exitCode = 2;
    return;
  }
  const root = positional[0] || ".";

  if (mode !== "scan") {
    console.error(`Mode "${mode}" is not available in this version.`);
    process.exitCode = 2;
    return;
  }

  let result;
  try {
    result = run(root, { mode });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }
  if (json) console.log(JSON.stringify(result, null, 2));
  else process.stdout.write(render(result));
  if (verbose && !json) {
    for (const finding of result.findings) {
      const safe = String(finding.file).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\x9b]/g, "?");
      process.stderr.write(`checked ${finding.id}: ${safe}:${finding.line}\n`);
    }
  }
  if (failOn && result.findings.some((finding) => finding.risk === "high")) {
    process.exitCode = 1;
  }
}

module.exports = { main };

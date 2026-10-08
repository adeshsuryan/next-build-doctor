"use strict";

function render(result) {
  const lines = [];
  lines.push("Next build doctor");
  lines.push(`Mode: ${result.mode}`);
  lines.push(`Files read: ${result.fileCount}`);
  lines.push("");
  lines.push("PROJECT");
  const p = result.project;
  lines.push(
    `  Next: ${p.version.installed || p.version.raw || "unknown"}` +
      `   bundler: ${p.bundler.bundler}` +
      `   routers: ${p.routers.join("+") || "none"}`
  );
  lines.push(
    `  Routes: ${p.routes.total} (${p.routes.dynamicRoutes} dynamic)` +
      `   static-gen fan-out: ${p.routes.fanout}`
  );
  const flags = [];
  flags.push(`cpus=${p.config.cpus === null ? "unset" : p.config.cpus}`);
  flags.push(`workerThreads=${p.config.workerThreads === true ? "on" : "unset"}`);
  flags.push(`sourcemaps=${p.config.productionBrowserSourceMaps ? "on" : "off"}`);
  flags.push(`typecheck=${p.config.typescriptIgnoreBuildErrors ? "skipped" : "on"}`);
  flags.push(`lint=${p.config.eslintIgnoreDuringBuilds ? "skipped" : "on"}`);
  lines.push(`  Config: ${flags.join("  ")}`);
  lines.push(
    `  Heap flag: ${p.heap.maxOldSpaceMb === null ? "not found" : `--max-old-space-size=${p.heap.maxOldSpaceMb}MB`}`
  );
  lines.push(`  Docker: ${p.docker.dockerfiles.length === 0 ? "none" : `${p.docker.dockerfiles.length} file(s)`}`);
  lines.push("");
  lines.push("FINDINGS");
  if (result.findings.length === 0) {
    lines.push("  No build-memory or build-performance risk was detected in the files that were read.");
    return lines.join("\n") + "\n";
  }
  for (const finding of result.findings) {
    lines.push("");
    lines.push(`${finding.risk.toUpperCase()}  ${finding.id}`);
    lines.push(`${finding.file}:${finding.line}`);
    lines.push(finding.title);
    lines.push(finding.detail);
    lines.push(`Fix: ${finding.fix}`);
  }
  lines.push("");
  return lines.join("\n");
}

module.exports = { render };

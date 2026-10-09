"use strict";

// Strip control characters (except newline/tab) so crafted file paths or
// values cannot inject terminal escape sequences into the report.
function clean(value) {
  return String(value).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\x9b]/g, "?");
}

function mb(bytes) {
  return bytes >= 1024 * 1024 * 1024
    ? `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderInspect(result) {
  const lines = [];
  lines.push("Next build doctor");
  lines.push(`Mode: ${result.mode}`);
  lines.push(`Files read: ${result.fileCount}`);
  lines.push("");
  if (!result.artifacts.present) {
    lines.push("No build artifacts found (.next is missing). Run a build first, or use scan mode.");
    return lines.join("\n") + "\n";
  }
  const a = result.artifacts;
  lines.push("BUILD");
  lines.push(`  BUILD_ID: ${a.buildId || "missing"}${a.buildIdAgeMs === null ? "" : `   age: ${Math.round(a.buildIdAgeMs / 60000)}min`}`);
  lines.push(`  stale: ${a.stale ? "yes (source newer than build)" : "no"}`);
  lines.push("PRERENDER");
  lines.push(`  routes: ${a.prerender.routes}   dynamic routes: ${a.prerender.dynamicRoutes}   fallbacks: ${a.prerender.fallbacks}`);
  lines.push("SIZES");
  lines.push(`  .next/cache: ${mb(a.cache.bytes)} (${a.cache.files} files)   webpack=${mb(a.cache.webpack.bytes)} turbopack=${mb(a.cache.turbopack.bytes)} fetch=${mb(a.cache.fetch.bytes)}`);
  lines.push(`  .next/server: ${mb(a.server.bytes)}   .next/static: ${mb(a.static.bytes)}`);
  if (a.heaviestRoutes.length > 0) {
    lines.push("HEAVIEST ROUTES (chunk weight)");
    for (const r of a.heaviestRoutes.slice(0, 10)) {
      lines.push(`  ${mb(r.bytes)}  ${clean(r.route)}`);
    }
  }
  if (a.topChunks.length > 0) {
    lines.push("TOP CHUNKS");
    for (const c of a.topChunks.slice(0, 10)) {
      lines.push(`  ${mb(c.bytes)}  ${clean(c.file)}`);
    }
  }
  lines.push("");
  return renderFindings(lines, result);
}

function renderFindings(lines, result) {
  lines.push("FINDINGS");
  if (result.findings.length === 0) {
    lines.push("  No build-memory or build-performance risk was detected.");
    return lines.join("\n") + "\n";
  }
  for (const finding of result.findings) {
    lines.push("");
    lines.push(`${clean(finding.risk).toUpperCase()}  ${clean(finding.id)}`);
    lines.push(`${clean(finding.file)}:${finding.line}`);
    lines.push(clean(finding.title));
    lines.push(clean(finding.detail));
    lines.push(`Fix: ${clean(finding.fix)}`);
  }
  lines.push("");
  return lines.join("\n");
}

function render(result) {
  if (result.mode === "inspect") return renderInspect(result);
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
  return renderFindings(lines, result);
}

module.exports = { render };

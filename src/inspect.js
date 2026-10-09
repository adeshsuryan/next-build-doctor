"use strict";

const fs = require("fs");
const path = require("path");

const MAX_WALK_FILES = 100000;
const TOP_N = 10;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function statOf(file) {
  try {
    return fs.lstatSync(file);
  } catch {
    return null;
  }
}

// Size + file count of a directory tree. Symlinks are never followed.
// Guarded by MAX_WALK_FILES so a giant .next cannot stall the scan.
function dirStats(dir, topCollector) {
  let bytes = 0;
  let files = 0;
  const top = [];

  function consider(rel, size) {
    if (!topCollector) return;
    top.push({ file: rel, bytes: size });
    if (top.length > TOP_N) {
      top.sort((a, b) => b.bytes - a.bytes);
      top.length = TOP_N;
    }
  }

  function walk(d, prefix) {
    if (files >= MAX_WALK_FILES) return;
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files >= MAX_WALK_FILES) return;
      if (entry.isSymbolicLink()) continue;
      const full = path.join(d, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(full, rel);
        continue;
      }
      const stat = statOf(full);
      if (!stat || !stat.isFile()) continue;
      files += 1;
      bytes += stat.size;
      consider(rel, stat.size);
    }
  }

  walk(dir, "");
  top.sort((a, b) => b.bytes - a.bytes);
  return { bytes, files, top };
}

function newestMtime(files) {
  let newest = 0;
  for (const f of files) {
    const stat = statOf(f);
    if (stat && stat.mtimeMs > newest) newest = stat.mtimeMs;
  }
  return newest;
}

function inspectProject(root, files) {
  const nextDir = path.join(root, ".next");
  const nextStat = statOf(nextDir);
  if (!nextStat || !nextStat.isDirectory()) {
    return { present: false };
  }

  const file = (name) => path.join(nextDir, name);
  const buildIdText = (() => {
    try {
      return fs.readFileSync(file("BUILD_ID"), "utf8").trim();
    } catch {
      return null;
    }
  })();
  const buildIdStat = statOf(file("BUILD_ID"));

  const buildManifest = readJson(file("build-manifest.json"));
  const appBuildManifest = readJson(file("app-build-manifest.json"));
  const prerenderManifest = readJson(file("prerender-manifest.json"));

  const prerenderRoutes = prerenderManifest && prerenderManifest.routes
    ? Object.keys(prerenderManifest.routes).length
    : 0;
  const dynamicRoutes = prerenderManifest && prerenderManifest.dynamicRoutes
    ? Object.keys(prerenderManifest.dynamicRoutes).length
    : 0;
  const fallbacks = prerenderManifest && prerenderManifest.dynamicRoutes
    ? Object.values(prerenderManifest.dynamicRoutes).filter((r) => r && r.fallback).length
    : 0;

  const cacheStats = {
    webpack: dirStats(path.join(nextDir, "cache", "webpack")),
    turbopack: dirStats(path.join(nextDir, "cache", "turbopack")),
    fetch: dirStats(path.join(nextDir, "cache", "fetch-cache")),
  };
  const cacheBytes = cacheStats.webpack.bytes + cacheStats.turbopack.bytes + cacheStats.fetch.bytes;
  const cacheFiles = cacheStats.webpack.files + cacheStats.turbopack.files + cacheStats.fetch.files;

  const serverStats = dirStats(path.join(nextDir, "server"));
  const staticStats = dirStats(path.join(nextDir, "static"), true);

  // Per-route weight: sum the on-disk size of each chunk the manifest lists.
  const routeWeights = [];
  const manifestSources = [
    [buildManifest && buildManifest.pages, ""],
    [appBuildManifest && appBuildManifest.pages, "app "],
  ];
  for (const [pages, prefix] of manifestSources) {
    if (!pages) continue;
    for (const [route, chunks] of Object.entries(pages)) {
      let bytes = 0;
      let resolved = 0;
      for (const chunk of chunks) {
        const stat = statOf(file(chunk));
        if (stat) {
          bytes += stat.size;
          resolved += 1;
        }
      }
      if (resolved > 0) routeWeights.push({ route: prefix + route, bytes });
    }
  }
  routeWeights.sort((a, b) => b.bytes - a.bytes);
  const heaviestRoutes = routeWeights.slice(0, TOP_N);

  // Trace files: presence + line count only. Full span parsing arrives with profile mode.
  const trace = {};
  for (const name of ["trace", "trace-build"]) {
    const stat = statOf(file(name));
    if (stat) {
      let lines = 0;
      try {
        const text = fs.readFileSync(file(name), "utf8");
        lines = text.split("\n").length - 1;
      } catch {
        /* best-effort */
      }
      trace[name] = { bytes: stat.size, events: lines };
    }
  }

  const sourceNewest = newestMtime(files);
  const stale = Boolean(buildIdStat && sourceNewest > buildIdStat.mtimeMs);

  return {
    present: true,
    buildId: buildIdText,
    buildIdAgeMs: buildIdStat ? Math.max(0, Date.now() - buildIdStat.mtimeMs) : null,
    stale,
    artifacts: {
      buildManifest: Boolean(buildManifest),
      appBuildManifest: Boolean(appBuildManifest),
      prerenderManifest: Boolean(prerenderManifest),
      requiredServerFiles: Boolean(readJson(file("required-server-files.json"))),
      middlewareManifest: Boolean(readJson(file("middleware-manifest.json"))),
      functionsConfigManifest: Boolean(readJson(file("functions-config-manifest.json"))),
      trace: Object.keys(trace).length > 0,
    },
    prerender: { routes: prerenderRoutes, dynamicRoutes, fallbacks },
    cache: {
      bytes: cacheBytes,
      files: cacheFiles,
      webpack: { bytes: cacheStats.webpack.bytes, files: cacheStats.webpack.files },
      turbopack: { bytes: cacheStats.turbopack.bytes, files: cacheStats.turbopack.files },
      fetch: { bytes: cacheStats.fetch.bytes, files: cacheStats.fetch.files },
    },
    server: { bytes: serverStats.bytes, files: serverStats.files },
    static: { bytes: staticStats.bytes, files: staticStats.files },
    topChunks: staticStats.top,
    heaviestRoutes,
    trace,
  };
}

module.exports = { inspectProject };

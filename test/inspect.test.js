"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { run } = require("../src/run");
const { analyzeInspect } = require("../src/rules");

const MB = 1024 * 1024;
const GB = 1024 * MB;

// The .next fixture is built at test time in a temp dir so no build
// artifacts are ever committed and cache sizes stay synthetic.
function makeInspectApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nbd-inspect-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ dependencies: { next: "16.3.8" } })
  );
  fs.mkdirSync(path.join(dir, "app"), { recursive: true });
  fs.writeFileSync(path.join(dir, "app", "page.js"), "export default function P() {}\n");

  const nextDir = path.join(dir, ".next");
  fs.mkdirSync(path.join(nextDir, "cache", "webpack"), { recursive: true });
  fs.mkdirSync(path.join(nextDir, "static", "chunks"), { recursive: true });
  fs.mkdirSync(path.join(nextDir, "server"), { recursive: true });

  fs.writeFileSync(path.join(nextDir, "BUILD_ID"), "test-build-id\n");
  fs.writeFileSync(
    path.join(nextDir, "build-manifest.json"),
    JSON.stringify({ pages: { "/": ["static/chunks/main.js"], "/products/[id]": ["static/chunks/products.js"] } })
  );
  fs.writeFileSync(
    path.join(nextDir, "prerender-manifest.json"),
    JSON.stringify({
      routes: { "/": {}, "/products/1": {}, "/products/2": {} },
      dynamicRoutes: { "/products/[id]": { fallback: "x.html" } },
    })
  );
  fs.writeFileSync(path.join(nextDir, "required-server-files.json"), "{}");
  fs.writeFileSync(path.join(nextDir, "static", "chunks", "main.js"), "x");
  fs.writeFileSync(path.join(nextDir, "static", "chunks", "products.js"), "x");
  fs.truncateSync(path.join(nextDir, "static", "chunks", "products.js"), 12 * MB);
  fs.writeFileSync(path.join(nextDir, "server", "app.js"), "x".repeat(1024));

  // BUILD_ID older than source -> stale-build-artifacts
  const old = new Date(Date.now() - 3600e3);
  fs.utimesSync(path.join(nextDir, "BUILD_ID"), old, old);
  return dir;
}

test("inspect reads manifests, sizes, and staleness", () => {
  const dir = makeInspectApp();
  const result = run(dir, { mode: "inspect" });
  assert.equal(result.mode, "inspect");
  assert.equal(result.artifacts.present, true);
  assert.equal(result.artifacts.buildId, "test-build-id");
  assert.equal(result.artifacts.prerender.routes, 3);
  assert.equal(result.artifacts.prerender.dynamicRoutes, 1);
  assert.equal(result.artifacts.prerender.fallbacks, 1);
  assert.equal(result.artifacts.artifacts.buildManifest, true);
  assert.equal(result.artifacts.artifacts.requiredServerFiles, true);
  const ids = result.findings.map((f) => f.id);
  assert.ok(ids.includes("artifact-weight"), "12MB route chunk set should fire artifact-weight");
  assert.ok(ids.includes("stale-build-artifacts"), "old BUILD_ID should fire stale-build-artifacts");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("inspect on a project without .next exits clean", () => {
  const dir = path.join(__dirname, "fixtures", "clean-app");
  const result = run(dir, { mode: "inspect" });
  assert.equal(result.artifacts.present, false);
  assert.deepEqual(result.findings, []);
});

test("cache-dir-bloat fires on large cache sizes", () => {
  const base = { present: true, buildId: "x", stale: false, prerender: { routes: 0, dynamicRoutes: 0, fallbacks: 0 }, heaviestRoutes: [] };
  const big = analyzeInspect({ ...base, cache: { bytes: 9 * GB, files: 1, webpack: {}, turbopack: {}, fetch: {} } });
  assert.ok(big.findings.some((f) => f.id === "cache-dir-bloat" && f.risk === "high"));
  const mid = analyzeInspect({ ...base, cache: { bytes: 3 * GB, files: 1, webpack: {}, turbopack: {}, fetch: {} } });
  assert.ok(mid.findings.some((f) => f.id === "cache-dir-bloat" && f.risk === "medium"));
  const small = analyzeInspect({ ...base, cache: { bytes: 500 * MB, files: 1, webpack: {}, turbopack: {}, fetch: {} } });
  assert.equal(small.findings.length, 0);
});

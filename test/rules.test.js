"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const { run } = require("../src/run");

function fixture(name) {
  return path.join(__dirname, "fixtures", name);
}

function ids(result) {
  return result.findings.map((finding) => finding.id);
}

test("clean-app produces no findings", () => {
  const result = run(fixture("clean-app"));
  assert.deepEqual(result.findings, []);
  assert.equal(result.project.version.installed || result.project.version.raw, "16.3.8");
  assert.deepEqual(result.project.routers, ["app"]);
});

test("large-static-app reports fan-out, heap, sourcemap, and timeout risks", () => {
  const result = run(fixture("large-static-app"));
  const found = ids(result);
  assert.ok(found.includes("static-gen-fanout"));
  assert.ok(found.includes("no-heap-limit-on-large-app"));
  assert.ok(found.includes("production-sourcemaps"));
  assert.ok(found.includes("page-data-timeout-risk"));
  assert.equal(result.project.routes.fanout, "unbounded");
  assert.equal(result.project.bundler.bundler, "turbopack");
});

test("docker-bad-app reports Dockerfile and context findings", () => {
  const result = run(fixture("docker-bad-app"));
  const found = ids(result);
  assert.ok(found.includes("dockerfile-no-build-memory"));
  assert.ok(found.includes("docker-context-bloat"));
});

test("heap-flag-app reports heap over container limit", () => {
  const result = run(fixture("heap-flag-app"));
  const found = ids(result);
  assert.ok(found.includes("heap-limit-over-container-limit"));
  assert.equal(result.project.heap.maxOldSpaceMb, 2048);
});

test("monorepo-app reports transpile and tracing findings", () => {
  const result = run(fixture("monorepo-app"));
  const found = ids(result);
  assert.ok(found.includes("monorepo-over-transpile"));
  assert.ok(found.includes("trace-workspace-heavy"));
  assert.equal(result.project.monorepo.isMonorepo, true);
});

test("pages-router-app detects the pages router", () => {
  const result = run(fixture("pages-router-app"));
  assert.deepEqual(result.project.routers, ["pages"]);
  assert.equal(result.project.version.installed || result.project.version.raw, "15.5.27");
});

test("worker-count-uncapped fires only when cpus are uncapped", () => {
  const large = run(fixture("large-static-app"));
  const found = ids(large);
  if (os.cpus().length >= 8) {
    assert.ok(found.includes("worker-count-uncapped"));
  } else {
    assert.equal(found.includes("worker-count-uncapped"), false);
  }
});

test("worker-count-uncapped wording adapts to the detected bundler", () => {
  if (os.cpus().length < 8) return;
  const { analyze } = require("../src/rules");
  const base = {
    version: {},
    bundler: { bundler: "webpack" },
    routers: ["app"],
    routes: { total: 10, generateStaticParams: [] },
    config: { file: "next.config.js", cpus: null, workerThreads: null },
    heap: { maxOldSpaceMb: null },
    deps: { heavy: [], hasTypeScript: false, hasEslintConfig: false },
    docker: { compose: [], dockerfiles: [], dockerignore: "x", dockerignoreExcludes: null },
    ci: {},
    monorepo: { isMonorepo: false },
    files: [],
    fileCount: 10,
  };
  const webpackRun = analyze(base).findings.find((f) => f.id === "worker-count-uncapped");
  const turboRun = analyze({ ...base, bundler: { bundler: "turbopack" } }).findings.find(
    (f) => f.id === "worker-count-uncapped"
  );
  assert.ok(webpackRun.detail.includes("webpack"));
  assert.ok(turboRun.detail.includes("page-data"));
  assert.equal(turboRun.detail.includes("webpack"), false);
});

test("json result carries schemaVersion", () => {
  const result = run(fixture("clean-app"));
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.mode, "scan");
});

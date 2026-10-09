"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const bin = path.join(__dirname, "..", "bin", "next-build-doctor.js");

function fixture(name) {
  return path.join(__dirname, "fixtures", name);
}

test("bare run prints the text report", () => {
  const out = execFileSync(process.execPath, [bin, fixture("clean-app")], { encoding: "utf8" });
  assert.match(out, /Next build doctor/);
  assert.match(out, /PROJECT/);
  assert.match(out, /FINDINGS/);
});

test("--json prints a parseable result", () => {
  const out = execFileSync(process.execPath, [bin, fixture("large-static-app"), "--json"], { encoding: "utf8" });
  const parsed = JSON.parse(out);
  assert.equal(parsed.schemaVersion, 1);
  assert.ok(parsed.findings.some((f) => f.id === "static-gen-fanout"));
});

test("--fail-on-high exits 1 on a high finding", () => {
  const res = spawnSync(process.execPath, [bin, fixture("large-static-app"), "--fail-on-high"], { encoding: "utf8" });
  assert.equal(res.status, 1);
});

test("reserved modes exit 2 with a message", () => {
  for (const mode of ["profile", "docker"]) {
    const res = spawnSync(process.execPath, [bin, mode, fixture("clean-app")], { encoding: "utf8" });
    assert.equal(res.status, 2, mode);
    assert.match(res.stderr, /not available in this version/);
  }
});

test("inspect mode on a project without .next exits 0", () => {
  const res = spawnSync(process.execPath, [bin, "inspect", fixture("clean-app")], { encoding: "utf8" });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /No build artifacts found/);
});

test("a missing path exits 2", () => {
  const res = spawnSync(process.execPath, [bin, "/nonexistent-dir-nbd"], { encoding: "utf8" });
  assert.equal(res.status, 2);
});

test("--help prints usage", () => {
  const out = execFileSync(process.execPath, [bin, "--help"], { encoding: "utf8" });
  assert.match(out, /Usage: next-build-doctor/);
});

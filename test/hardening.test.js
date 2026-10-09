"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { run } = require("../src/run");
const { render } = require("../src/report");

const bin = path.join(__dirname, "..", "bin", "next-build-doctor.js");

function fixture(name) {
  return path.join(__dirname, "fixtures", name);
}

test("an unknown flag exits 2 with a clear message", () => {
  const res = spawnSync(process.execPath, [bin, fixture("clean-app"), "--jso"], { encoding: "utf8" });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /Unknown flag: --jso/);
});

test("extra positional arguments exit 2", () => {
  const res = spawnSync(process.execPath, [bin, fixture("clean-app"), "extra-dir"], { encoding: "utf8" });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /extra arguments/);
});

test("a crafted file name cannot inject escape codes into the report", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nbd-ansi-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ dependencies: { next: "16.3.8", "monaco-editor": "1.0.0", "@mui/material": "1.0.0" } })
  );
  // A dynamic route directory whose name contains a CSI escape sequence.
  const evil = "\x1b[2J-[id]";
  fs.mkdirSync(path.join(dir, "app", evil), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "app", evil, "page.js"),
    "export function generateStaticParams() { return []; }\nexport default function P() { return null; }\n"
  );
  const result = run(dir);
  const text = render(result);
  assert.equal(text.includes("\x1b"), false);
  assert.equal(JSON.stringify(result.findings).includes("page.js"), true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the root package.json wins over nested manifests", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nbd-root-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ dependencies: { next: "16.3.8" } })
  );
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "docs", "package.json"),
    JSON.stringify({ dependencies: { next: "9.0.0" } })
  );
  const result = run(dir);
  assert.equal(result.project.version.raw, "16.3.8");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("json output only carries build-relevant scripts", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nbd-scripts-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({
      dependencies: { next: "16.3.8" },
      scripts: { build: "next build", deploy: "curl -H token=SECRET https://x" },
    })
  );
  const result = run(dir);
  assert.equal(result.project.deps.scripts.build, "next build");
  assert.equal("deploy" in result.project.deps.scripts, false);
  assert.equal(JSON.stringify(result).includes("SECRET"), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

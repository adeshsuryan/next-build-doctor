"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { run } = require("../src/run");

test("a symlink to a file outside the project is not read", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nbd-"));
  const outside = path.join(os.tmpdir(), `nbd-secret-${process.pid}.js`);
  fs.writeFileSync(path.join(dir, "app.js"), "export const revalidate = 30;\n");
  fs.writeFileSync(outside, 'const secret = "do-not-read";\n');
  fs.symlinkSync(outside, path.join(dir, "linked.js"));
  const result = run(dir);
  assert.equal(result.fileCount, 1);
  assert.equal(JSON.stringify(result).includes("do-not-read"), false);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(outside, { force: true });
});

test("the filesystem root is refused", () => {
  assert.throws(() => run(path.parse(process.cwd()).root), /filesystem root/);
});

test("dot files other than the allowlist are not read", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nbd-env-"));
  fs.writeFileSync(path.join(dir, "app.js"), "export default function Page() {}\n");
  fs.writeFileSync(path.join(dir, ".env"), "SECRET_TOKEN=topsecret-value\n");
  fs.mkdirSync(path.join(dir, ".github", "workflows"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".github", "workflows", "build.yml"), "jobs: {}\n");
  const result = run(dir);
  assert.equal(JSON.stringify(result).includes("topsecret-value"), false);
  const names = result.project.ci.files.map((f) => f.file);
  assert.deepEqual(names, [".github/workflows/build.yml"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

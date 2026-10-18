"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

test("mod.d.ts function exports match the runtime exports", () => {
  const dts = fs.readFileSync(path.join(__dirname, "..", "mod.d.ts"), "utf8");
  const declared = [...dts.matchAll(/export function (\w+)/g)]
    .map((m) => m[1])
    .sort();
  const runtime = Object.keys(require("../src/index.js")).sort();
  assert.deepEqual(declared, runtime);
});

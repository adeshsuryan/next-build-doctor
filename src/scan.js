"use strict";

const fs = require("fs");
const path = require("path");

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "coverage",
  "out",
]);

const SOURCE_EXT = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FILES = 20000;

const EXACT_NAMES = new Set([
  "package.json",
  "tsconfig.json",
  "jsconfig.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "pnpm-workspace.yaml",
  "turbo.json",
  "lerna.json",
  "nx.json",
  ".dockerignore",
]);

function isReadName(rel, base) {
  if (SOURCE_EXT.has(path.extname(base))) return true;
  if (EXACT_NAMES.has(base)) return true;
  if (/^next\.config\.(js|jsx|mjs|cjs|ts|tsx)$/.test(base)) return true;
  if (/^Dockerfile(\..*)?$/i.test(base)) return true;
  if (/^(docker-)?compose.*\.(yml|yaml)$/i.test(base)) return true;
  if (rel.replace(/\\/g, "/").includes(".github/workflows/") && /\.(yml|yaml)$/.test(base)) {
    return true;
  }
  return false;
}

function insideRoot(rootReal, candidate) {
  const relative = path.relative(rootReal, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
}

function assertSafeRoot(rootReal) {
  if (rootReal === path.parse(rootReal).root) {
    throw new Error("Refusing to scan the filesystem root.");
  }
}

function listFiles(root) {
  const rootReal = fs.realpathSync(root);
  assertSafeRoot(rootReal);
  const out = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= MAX_FILES) return;
      if (SKIP_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith(".") && entry.name !== ".github" && entry.name !== ".dockerignore") continue;
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = path.relative(rootReal, full).split(path.sep).join("/");
      if (!isReadName(rel, entry.name)) continue;
      if (!insideRoot(rootReal, full)) continue;
      let stat;
      try {
        stat = fs.lstatSync(full);
      } catch {
        continue;
      }
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_FILE_BYTES) continue;
      out.push(full);
    }
  }

  walk(rootReal);
  return out.sort();
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function capture(text, pattern) {
  const found = [];
  const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
  const regex = new RegExp(pattern.source, flags);
  let match;
  while ((match = regex.exec(text)) !== null) {
    found.push({ match, line: lineOf(text, match.index) });
    if (match.index === regex.lastIndex) regex.lastIndex += 1;
  }
  return found;
}

function readProject(root) {
  const rootReal = fs.realpathSync(root);
  assertSafeRoot(rootReal);
  const files = [];
  for (const file of listFiles(rootReal)) {
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\0")) continue;
    const rel = path.relative(rootReal, file).split(path.sep).join("/");
    files.push({ file: rel, text });
  }
  return { root: rootReal, files };
}

module.exports = {
  listFiles,
  readProject,
  capture,
  insideRoot,
  MAX_FILE_BYTES,
  MAX_FILES,
};

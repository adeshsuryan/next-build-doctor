"use strict";

const path = require("path");
const { capture } = require("./scan");

const HEAVY_DEPS = new Set([
  "monaco-editor",
  "@monaco-editor/react",
  "@mui/material",
  "@mui/icons-material",
  "lodash",
  "moment",
  "aws-sdk",
  "prisma",
  "@prisma/client",
  "puppeteer",
  "playwright",
  "sharp",
  "firebase-admin",
  "three",
]);

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function fileOf(project, base) {
  const matches = project.files.filter((f) => path.posix.basename(f.file) === base);
  if (matches.length === 0) return undefined;
  const root = matches.find((f) => !f.file.includes("/"));
  return root || matches[0];
}

function filesOf(project, predicate) {
  return project.files.filter((f) => predicate(f.file));
}

function detectVersion(project) {
  const pkgFile = fileOf(project, "package.json");
  const pkg = pkgFile ? parseJson(pkgFile.text) : null;
  const raw = pkg ? (pkg.dependencies || {}).next || (pkg.devDependencies || {}).next || null : null;

  let installed = null;
  const lock = fileOf(project, "package-lock.json") || fileOf(project, "npm-shrinkwrap.json");
  if (lock) {
    const parsed = parseJson(lock.text);
    const entry = parsed && parsed.packages && parsed.packages["node_modules/next"];
    if (entry && entry.version) installed = entry.version;
  }
  if (!installed) {
    const pnpm = fileOf(project, "pnpm-lock.yaml");
    if (pnpm) {
      const m = pnpm.text.match(/\/next@(\d+\.\d+\.\d+)/) || pnpm.text.match(/next@[^\n]*?version:\s*'?(\d+\.\d+\.\d+)/);
      if (m) installed = m[1];
    }
  }
  if (!installed) {
    const yarn = fileOf(project, "yarn.lock");
    if (yarn) {
      const m = yarn.text.match(/next@[^\n]*:\n\s+version\s+"?(\d+\.\d+\.\d+)/);
      if (m) installed = m[1];
    }
  }

  const source = installed || raw;
  const majorMatch = source && source.match(/(\d+)\./);
  const major = majorMatch ? Number(majorMatch[1]) : null;
  return {
    raw: raw || null,
    installed: installed || null,
    major,
    confidence: installed ? "exact" : raw ? "heuristic" : "unknown",
  };
}

function detectBundler(project, version) {
  const pkgFile = fileOf(project, "package.json");
  const pkg = pkgFile ? parseJson(pkgFile.text) : null;
  const scripts = pkg && pkg.scripts ? pkg.scripts : {};
  const scriptText = Object.values(scripts).join("\n");
  const configFile = filesOf(project, (f) => /(^|\/)next\.config\./.test(f))[0];

  if (/--webpack\b/.test(scriptText)) {
    return { bundler: "webpack", confidence: "exact", evidence: "package.json build script" };
  }
  if (/--turbopack\b/.test(scriptText)) {
    return { bundler: "turbopack", confidence: "exact", evidence: "package.json build script" };
  }
  if (configFile && /(^|\s)turbopack\s*:/m.test(configFile.text)) {
    return { bundler: "turbopack", confidence: "heuristic", evidence: `${configFile.file} turbopack key` };
  }
  if (version && version.major !== null && version.major >= 16) {
    return { bundler: "turbopack", confidence: "heuristic", evidence: "Next 16 default" };
  }
  if (version && version.major !== null) {
    return { bundler: "webpack", confidence: "heuristic", evidence: `Next ${version.major} default` };
  }
  return { bundler: "unknown", confidence: "unknown", evidence: null };
}

function detectRouters(project) {
  const routers = [];
  if (project.files.some((f) => /^(src\/)?app\//.test(f.file))) routers.push("app");
  if (project.files.some((f) => /^(src\/)?pages\//.test(f.file))) routers.push("pages");
  return routers;
}

function detectConfig(project) {
  const configs = filesOf(project, (f) => /(^|\/)next\.config\.(js|ts|mjs|cjs)$/.test(f));
  const configFile = configs.find((f) => !f.file.includes("/")) || configs[0] || null;
  const flags = {
    file: configFile ? configFile.file : null,
    output: null,
    cpus: null,
    workerThreads: null,
    webpackMemoryOptimizations: null,
    staticPageGenerationTimeout: null,
    outputFileTracingRoot: false,
    productionBrowserSourceMaps: false,
    typescriptIgnoreBuildErrors: false,
    eslintIgnoreDuringBuilds: false,
    transpilePackages: [],
    cacheHandler: false,
    turbopackKey: false,
  };
  if (!configFile) return flags;
  const text = configFile.text;

  const output = text.match(/output\s*:\s*['"](standalone|export)['"]/);
  if (output) flags.output = output[1];
  const cpus = text.match(/cpus\s*:\s*(\d+)/);
  if (cpus) flags.cpus = Number(cpus[1]);
  if (/workerThreads\s*:\s*true/.test(text)) flags.workerThreads = true;
  if (/webpackMemoryOptimizations\s*:\s*true/.test(text)) flags.webpackMemoryOptimizations = true;
  const spgt = text.match(/staticPageGenerationTimeout\s*:\s*(\d+)/);
  if (spgt) flags.staticPageGenerationTimeout = Number(spgt[1]);
  if (/outputFileTracingRoot\s*:/.test(text)) flags.outputFileTracingRoot = true;
  if (/productionBrowserSourceMaps\s*:\s*true/.test(text)) flags.productionBrowserSourceMaps = true;
  if (/ignoreBuildErrors\s*:\s*true/.test(text)) flags.typescriptIgnoreBuildErrors = true;
  if (/ignoreDuringBuilds\s*:\s*true/.test(text)) flags.eslintIgnoreDuringBuilds = true;
  const transpile = text.match(/transpilePackages\s*:\s*\[([^\]]*)\]/s);
  if (transpile) {
    flags.transpilePackages = transpile[1]
      .split(",")
      .map((s) => s.trim().replace(/^['"`]|['"`]$/g, ""))
      .filter(Boolean);
  }
  if (/cacheHandler\s*:/.test(text)) flags.cacheHandler = true;
  if (/(^|\s)turbopack\s*:/m.test(text)) flags.turbopackKey = true;
  return flags;
}

function detectHeap(project) {
  const found = [];
  let maxOldSpaceMb = null;
  for (const f of project.files) {
    if (!/package\.json$|^Dockerfile|docker-compose|\.github\/workflows\//.test(f.file)) continue;
    for (const item of capture(f.text, /--max-old-space-size[=\s](\d+)/g)) {
      const mb = Number(item.match[1]);
      found.push({ file: f.file, line: item.line, mb });
      maxOldSpaceMb = Math.max(maxOldSpaceMb || 0, mb);
    }
    for (const item of capture(f.text, /NODE_OPTIONS/g)) {
      if (!found.some((e) => e.file === f.file && e.line === item.line)) {
        found.push({ file: f.file, line: item.line, mb: null });
      }
    }
  }
  return { found, maxOldSpaceMb };
}

function detectDeps(project) {
  const pkgFile = fileOf(project, "package.json");
  const pkg = pkgFile ? parseJson(pkgFile.text) : null;
  const heavy = [];
  if (pkg) {
    const all = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
    for (const name of Object.keys(all)) {
      if (HEAVY_DEPS.has(name)) {
        heavy.push({
          name,
          range: all[name],
          devOnly: Boolean((pkg.devDependencies || {})[name]) && !(pkg.dependencies || {})[name],
        });
      }
    }
  }
  const allScripts = pkg && pkg.scripts ? pkg.scripts : {};
  const scripts = {};
  for (const key of ["prebuild", "build", "postbuild", "dev", "start"]) {
    if (allScripts[key]) scripts[key] = allScripts[key];
  }
  return {
    heavy,
    scripts,
    hasTypeScript: Boolean(pkg && ((pkg.devDependencies || {}).typescript || (pkg.dependencies || {}).typescript))
      || project.files.some((f) => /\.tsx?$/.test(f.file)),
    hasEslintConfig: project.files.some((f) => /(^|\/)\.eslintrc|eslint\.config\.|(^|\/)eslint\./.test(f.file))
      || Boolean(pkg && ((pkg.devDependencies || {}).eslint || (pkg.dependencies || {}).eslint)),
    packageManager: pkg ? pkg.packageManager || null : null,
  };
}

function detectDocker(project) {
  const dockerfiles = filesOf(project, (f) => /(^|\/)Dockerfile(\..*)?$/i.test(f)).map((f) => ({
    file: f.file,
    hasBuildStep: /(next\s+build|npm\s+run\s+build|yarn\s+build|pnpm\s+(\w+\s+)?build)/.test(f.text),
    hasNodeOptions: /NODE_OPTIONS|--max-old-space-size/.test(f.text),
    hasCacheMount: /--mount=type=cache/.test(f.text),
    usesStandalone: false,
  }));

  const dockerignore = fileOf(project, ".dockerignore");
  const dockerignoreExcludes = dockerignore
    ? dockerignore.text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    : null;

  const compose = filesOf(project, (f) => /(docker-)?compose.*\.(yml|yaml)$/i.test(path.posix.basename(f))).map((f) => {
    const memLimits = [];
    for (const item of capture(f.text, /(?:mem_limit|memory)\s*:\s*['"]?(\d+(?:\.\d+)?)([gGmMkK])[bB]?/g)) {
      const unit = item.match[2].toLowerCase();
      const mb = unit === "g" ? Number(item.match[1]) * 1024 : unit === "m" ? Number(item.match[1]) : Number(item.match[1]) / 1024;
      memLimits.push({ line: item.line, mb: Math.round(mb) });
    }
    return { file: f.file, memLimits };
  });

  return { dockerfiles, dockerignore: dockerignore ? dockerignore.file : null, dockerignoreExcludes, compose };
}

function detectCi(project) {
  const files = filesOf(project, (f) => f.includes(".github/workflows/")).map((f) => ({
    file: f.file,
    hasNodeOptions: /NODE_OPTIONS|--max-old-space-size/.test(f.text),
    cachesNext: /\.next[\/\\]?cache/.test(f.text) || /actions\/cache/.test(f.text),
    runsBuild: /(next\s+build|npm\s+run\s+build|yarn\s+build|pnpm\s+(\w+\s+)?build)/.test(f.text),
  }));
  return { files };
}

function detectMonorepo(project) {
  const pkgFile = fileOf(project, "package.json");
  const pkg = pkgFile ? parseJson(pkgFile.text) : null;
  const roots = filesOf(project, (f) => /(^|\/)next\.config\./.test(f)).map((f) =>
    f.file.replace(/\/next\.config\..*$/, "").replace(/^next\.config\..*$/, ".")
  );
  return {
    isMonorepo: Boolean(
      (pkg && pkg.workspaces) ||
        fileOf(project, "pnpm-workspace.yaml") ||
        fileOf(project, "turbo.json") ||
        fileOf(project, "lerna.json") ||
        fileOf(project, "nx.json")
    ),
    roots: [...new Set(roots)],
  };
}

function detect(project) {
  const version = detectVersion(project);
  const bundler = detectBundler(project, version);
  const routers = detectRouters(project);
  const config = detectConfig(project);
  const heap = detectHeap(project);
  const deps = detectDeps(project);
  const docker = detectDocker(project);
  const ci = detectCi(project);
  const monorepo = detectMonorepo(project);
  return { version, bundler, routers, config, heap, deps, docker, ci, monorepo };
}

module.exports = { detect, HEAVY_DEPS };

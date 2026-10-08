"use strict";

function analyze(project) {
  const { version, bundler, routers, routes, config, heap, deps, docker, ci, monorepo } = project;
  const findings = [];

  const isLarge = routes.total > 50 || project.fileCount > 300 || deps.heavy.length >= 2 || routes.generateStaticParams.length > 0;

  if (isLarge && heap.maxOldSpaceMb === null) {
    findings.push({
      id: "no-heap-limit-on-large-app",
      risk: "high",
      file: deps.scripts.build ? "package.json" : config.file || "package.json",
      line: 1,
      title: "Large project builds without a Node heap limit",
      detail: `This project has ${routes.total} routes, ${project.fileCount} source files, and ${deps.heavy.length} known-heavy dependencies, but no --max-old-space-size is set in scripts, Dockerfile, or CI. Build workers can exhaust the default heap and fail with an out-of-memory error.`,
      fix: "Set NODE_OPTIONS=\"--max-old-space-size=4096\" (or the value that fits your CI runner) in the build environment, Dockerfile, or CI workflow.",
    });
  }

  for (const c of docker.compose) {
    for (const limit of c.memLimits) {
      if (heap.maxOldSpaceMb !== null && heap.maxOldSpaceMb > limit.mb) {
        findings.push({
          id: "heap-limit-over-container-limit",
          risk: "high",
          file: c.file,
          line: limit.line,
          title: "Node heap limit exceeds the container memory limit",
          detail: `--max-old-space-size is ${heap.maxOldSpaceMb} MB but this compose file limits the container to ${limit.mb} MB. The cgroup OOM killer can terminate the build before V8 garbage-collects.`,
          fix: "Set the heap limit below the container limit (for example, 75-80% of it), or raise the container limit.",
        });
      }
    }
  }

  const cpuCount = require("os").cpus().length;
  if (cpuCount >= 8 && config.cpus === null && config.workerThreads === null) {
    findings.push({
      id: "worker-count-uncapped",
      risk: "medium",
      file: config.file || "next.config.js",
      line: 1,
      title: "Next.js build workers are not capped",
      detail: `This machine has ${cpuCount} logical CPUs and the project does not set experimental.cpus or experimental.workerThreads. Next.js can spawn a worker per core, each growing its own heap.`,
      fix: "Set experimental.cpus or experimental.workerThreads in next.config to a number that fits your CI memory budget.",
    });
  }

  const unboundedParams = routes.generateStaticParams.filter((s) => s.dynamicParams !== false);
  if (unboundedParams.length > 0) {
    findings.push({
      id: "static-gen-fanout",
      risk: "high",
      file: unboundedParams[0].file,
      line: 1,
      title: "generateStaticParams can create unbounded static-generation fan-out",
      detail: "A route uses generateStaticParams without dynamicParams = false. If the parameter space is large or unbounded, static generation can explode the page count and exhaust build workers.",
      fix: "Set export const dynamicParams = false to prebuild only returned params, or move high-cardinality routes to runtime rendering.",
    });
  }

  if (deps.hasTypeScript && deps.hasEslintConfig && !config.typescriptIgnoreBuildErrors && !config.eslintIgnoreDuringBuilds && project.fileCount > 200) {
    findings.push({
      id: "double-compile",
      risk: "medium",
      file: config.file || "next.config.js",
      line: 1,
      title: "Type checking and linting run inside next build",
      detail: `The project has ${project.fileCount} source files, TypeScript, and ESLint, but neither typescript.ignoreBuildErrors nor eslint.ignoreDuringBuilds is set. next build will parse the codebase twice.`,
      fix: "Run typecheck and lint as separate CI steps, or set typescript.ignoreBuildErrors and eslint.ignoreDuringBuilds to skip them during next build.",
    });
  }

  if (config.productionBrowserSourceMaps) {
    findings.push({
      id: "production-sourcemaps",
      risk: "medium",
      file: config.file,
      line: 1,
      title: "productionBrowserSourceMaps increases compile memory",
      detail: "Source-map generation raises build-time memory and artifact weight.",
      fix: "Set productionBrowserSourceMaps: false unless production debugging requires source maps.",
    });
  }

  const hasCachedData = project.files.some((f) => /next\s*:\s*\{[^}]*revalidate|export\s+const\s+revalidate|unstable_cache|cacheTag|cacheLife/.test(f.text));
  if (config.output === "standalone" && !config.cacheHandler && hasCachedData) {
    findings.push({
      id: "cache-handler-without-shared",
      risk: "low",
      file: config.file,
      line: 1,
      title: "Standalone output has no shared cache handler",
      detail: "Invalidating data on one Node process does not reach other instances. A multi-instance deploy can keep serving stale entries.",
      fix: "Set cacheHandler to a store every instance can read, or run a single instance.",
    });
  }

  for (const df of docker.dockerfiles) {
    if (df.hasBuildStep && !df.hasNodeOptions) {
      findings.push({
        id: "dockerfile-no-build-memory",
        risk: "medium",
        file: df.file,
        line: 1,
        title: "Dockerfile runs the build without NODE_OPTIONS",
        detail: "next build inside Docker has no --max-old-space-size. The build can hit the container limit before V8 reaches its heap cap.",
        fix: "Add ENV NODE_OPTIONS=\"--max-old-space-size=<value>\" in the Dockerfile before the build step.",
      });
    }
  }

  const dockerignoreMissing = docker.dockerfiles.length > 0 && docker.dockerignore === null;
  const dockerignoreIncomplete = docker.dockerignoreExcludes && !["node_modules", ".next", ".git"].every((p) => docker.dockerignoreExcludes.some((e) => e === p || e === p + "/" || e === p + "/**"));
  if (dockerignoreMissing || dockerignoreIncomplete) {
    findings.push({
      id: "docker-context-bloat",
      risk: "medium",
      file: docker.dockerignore || "Dockerfile",
      line: 1,
      title: "Docker build context carries unnecessary weight",
      detail: dockerignoreMissing
        ? "No .dockerignore exists. The context sends node_modules, .next, and .git to the daemon."
        : ".dockerignore does not exclude node_modules, .next, and .git.",
      fix: "Add a .dockerignore that excludes node_modules, .next, .git, and *.log.",
    });
  }

  if (monorepo.isMonorepo && config.transpilePackages.length > 5) {
    findings.push({
      id: "monorepo-over-transpile",
      risk: "low",
      file: config.file,
      line: 1,
      title: "transpilePackages covers many workspace packages",
      detail: `${config.transpilePackages.length} packages are transpiled. Each one pulls its module graph into compilation.`,
      fix: "Review whether every package in transpilePackages needs transpilation, or use a narrower entry point.",
    });
  }

  if (monorepo.isMonorepo && config.output === "standalone" && !config.outputFileTracingRoot) {
    findings.push({
      id: "trace-workspace-heavy",
      risk: "medium",
      file: config.file,
      line: 1,
      title: "Standalone output in a monorepo traces the whole workspace",
      detail: "Without outputFileTracingRoot, Next.js traces from the repository root and can bundle files outside the app.",
      fix: "Set outputFileTracingRoot to the workspace root or the app directory to limit tracing scope.",
    });
  }

  if ((routes.fanout === "unbounded" || routes.total > 500) && config.staticPageGenerationTimeout === null) {
    findings.push({
      id: "page-data-timeout-risk",
      risk: "low",
      file: config.file || "next.config.js",
      line: 1,
      title: "Large static generation without a page-data timeout",
      detail: `The project has ${routes.total} routes and no staticPageGenerationTimeout. A slow page can stall page-data collection and hide the real bottleneck.`,
      fix: "Set staticPageGenerationTimeout in next.config to a value that fits your slowest static page.",
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => order[a.risk] - order[b.risk] || a.id.localeCompare(b.id));
  return { findings };
}

module.exports = { analyze };

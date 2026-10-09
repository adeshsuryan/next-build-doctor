# Usage

Library:

```js
const { run, render } = require("next-build-doctor");

const result = run("/path/to/next-app", { mode: "scan" });
process.stdout.write(render(result));
```

Command, after install:

```bash
npx next-build-doctor [directory] [--json] [--fail-on-high] [--verbose]
```

With pnpm: `pnpm exec next-build-doctor . --fail-on-high`

With yarn: `yarn next-build-doctor . --fail-on-high`

`directory` defaults to the current working directory.

The text report has two parts.

PROJECT lists the detected Next.js version and bundler, routers, route counts with static-generation fan-out, memory-relevant config flags, the heap flag if found, and Docker file presence.

FINDINGS lists risks. Each line has a risk (`high`, `medium`, `low`), an id, a file and line, a description, and a fix.

## Finding ids

| Id | Risk | Meaning |
| --- | --- | --- |
| `no-heap-limit-on-large-app` | high | The project is large (routes, files, or heavy deps) and no `--max-old-space-size` is set in scripts, Docker, or CI. |
| `heap-limit-over-container-limit` | high | The heap flag exceeds a detected Docker/Compose memory limit. |
| `static-gen-fanout` | high | `generateStaticParams` runs with default `dynamicParams`, so static generation can fan out without bound. |
| `worker-count-uncapped` | medium | Many CPUs and neither `experimental.cpus` nor `experimental.workerThreads` is set. |
| `double-compile` | medium | TypeScript check and ESLint run inside `next build` on a large codebase. |
| `production-sourcemaps` | medium | `productionBrowserSourceMaps` is on, raising compile memory and artifact weight. |
| `dockerfile-no-build-memory` | medium | A Dockerfile runs `next build` with no `NODE_OPTIONS`. |
| `docker-context-bloat` | medium | `.dockerignore` is missing or does not exclude `node_modules`, `.next`, `.git`. |
| `trace-workspace-heavy` | medium | `output: "standalone"` in a monorepo without `outputFileTracingRoot`. |
| `cache-handler-without-shared` | low | `output: "standalone"` with cached data and no `cacheHandler`. |
| `monorepo-over-transpile` | low | `transpilePackages` covers many workspace packages. |
| `page-data-timeout-risk` | low | Large static generation with no `staticPageGenerationTimeout`. |

Inspect-mode findings (from `.next/` artifacts):

| Id | Risk | Meaning |
| --- | --- | --- |
| `cache-dir-bloat` | medium/high | `.next/cache` above 2 GB (warn) or 8 GB (high). |
| `artifact-weight` | medium | A single route's chunk set is above 10 MB. |
| `stale-build-artifacts` | low | `BUILD_ID` is older than source files — the inventory describes a stale build. |

`--fail-on-high` sets the exit code to 1 when any high finding is present. Without that flag the exit code stays 0 so the report can be read in a shell without failing the shell.

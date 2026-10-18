# Changelog

Each entry matches one tagged commit on `main`. The tag, the `version` field in `package.json` and `jsr.json`, and this file use the same number.

## 0.2.2 - 2026-10-18

Tag: `v0.2.2`

### Fixed

- `worker-count-uncapped` advice is now bundler-aware: under Turbopack
  (the Next 16 default) the detail correctly describes the page-data and
  static-generation worker pool instead of claiming webpack compile workers.

### Added

- GitHub Actions CI on push/PR — `node --test` on Node 18, 20, and 22.
- Regression test covering the bundler-aware finding text.

## 0.2.1 - 2026-10-09

Tag: `v0.2.1`

### Changed

- Added the package banner (`docs/assets/banner.jpg`) and linked it from the README with an absolute URL so it renders on npm, JSR, and Packagist.

## 0.2.0 - 2026-10-09

Tag: `v0.2.0`

### Added

- `inspect` mode: reads `.next/` artifacts without running a build. Reports BUILD_ID and staleness, prerendered route/fallback counts, `.next/cache` weight split (webpack vs turbopack vs fetch), server/static size rollups, heaviest route chunk sets, and top static chunks.
- Three inspect rules: `cache-dir-bloat` (medium >2 GB, high >8 GB), `artifact-weight` (single route chunk set >10 MB), `stale-build-artifacts` (BUILD_ID older than source files).
- `inspect` on a project with no `.next` exits 0 with a "no build artifacts found" message.
- Missing or partial `.next` trees are tolerated — every artifact read is optional.

## 0.1.1 - 2026-10-09

Tag: `v0.1.1`

### Security and hardening

- CLI rejects unknown flags and extra positional arguments with exit 2, instead of silently treating a mistyped flag as a directory.
- Text report and `--verbose` output strip terminal control characters from finding fields, so a crafted file name cannot inject escape sequences into CI logs.
- Detector prefers the project-root `package.json` and `next.config.*` over nested files, fixing wrong version/config detection on repos that carry secondary manifests.
- Lockfiles get an 8 MB read cap (other files stay at 1 MB), so large `package-lock.json`/`pnpm-lock.yaml` files still resolve the installed Next.js version.
- The JSON result's `project.deps.scripts` now carries only build-relevant scripts (`prebuild`, `build`, `postbuild`, `dev`, `start`) instead of every script.
- `.dockerignore` analysis accepts `**/dir` and `dir/` patterns.
- Publish workflows scope `id-token` to the job and set `timeout-minutes`; added a JSR publish workflow using OIDC provenance (no token secret).

### Added

- `mod.ts` typed entrypoint for JSR with documented exports (`run`, `render`, `Mode`, `Finding`, `RunOptions`, `RunResult`).

## 0.1.0 - 2026-10-08

Tag: `v0.1.0`

### Added

- First public release. Static `scan` mode reads a Next.js project and reports build-memory and build-performance risks.
- Detection: Next.js version (package.json + lockfiles), bundler (webpack/turbopack), routers, route inventory with `generateStaticParams` fan-out, memory-relevant `next.config` flags, `NODE_OPTIONS`/`--max-old-space-size` across scripts, Dockerfiles, and CI, known-heavy dependencies, Docker/CI file presence.
- Twelve findings, from `no-heap-limit-on-large-app` and `static-gen-fanout` (high) through Docker context and double-compile risks (medium/low).
- CLI `next-build-doctor [directory]` with `--json`, `--fail-on-high`, `--verbose`; `inspect`, `profile`, and `docker` subcommands are reserved and exit 2 until shipped.
- Library API `run(directory, { mode })` and `render(result)`; `schemaVersion` in JSON output.
- Install paths for npm, JSR, and Packagist.

# Changelog

Each entry matches one tagged commit on `main`. The tag, the `version` field in `package.json` and `jsr.json`, and this file use the same number.

## 0.1.0 - 2026-10-08

Tag: `v0.1.0`

### Added

- First public release. Static `scan` mode reads a Next.js project and reports build-memory and build-performance risks.
- Detection: Next.js version (package.json + lockfiles), bundler (webpack/turbopack), routers, route inventory with `generateStaticParams` fan-out, memory-relevant `next.config` flags, `NODE_OPTIONS`/`--max-old-space-size` across scripts, Dockerfiles, and CI, known-heavy dependencies, Docker/CI file presence.
- Twelve findings, from `no-heap-limit-on-large-app` and `static-gen-fanout` (high) through Docker context and double-compile risks (medium/low).
- CLI `next-build-doctor [directory]` with `--json`, `--fail-on-high`, `--verbose`; `inspect`, `profile`, and `docker` subcommands are reserved and exit 2 until shipped.
- Library API `run(directory, { mode })` and `render(result)`; `schemaVersion` in JSON output.
- Install paths for npm, JSR, and Packagist.

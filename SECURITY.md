# Security

## Reporting

Open a private vulnerability report on GitHub:

https://github.com/adeshsuryan/next-build-doctor/security

Do not file a public issue for a security report.

## What this package does

Version 0.1.0 ships `scan` mode only. The command and `run()` read source and configuration files under the directory you pass. They do not start a server, open a network connection, or write into that project.

Later modes are planned:

- `inspect` will read `.next` build artifacts. Still read-only.
- `profile` will run `next build` as a supervised child process. **Running `profile` executes the target project's build-time code** (`next.config.js`, webpack/turbopack config, custom build plugins). Only use `profile` on code you trust, and never enable it automatically on untrusted pull requests.

## Limits in the scanner

- The filesystem root is rejected.
- Symbolic links are not followed.
- Names that start with a dot are skipped, which covers `.env` and `.git`. Two exceptions: `.github/workflows/` is read for CI analysis, and `.dockerignore` is read for Docker context checks.
- `node_modules`, `.next`, `dist`, `coverage`, and `out` are skipped.
- Only JavaScript/TypeScript source and a fixed allowlist of config/build files (`package.json`, lockfiles, `next.config.*`, `Dockerfile*`, `docker-compose*`, workflow YAML, workspace manifests) are read.
- A file larger than 1 MB is skipped (8 MB for lockfiles).
- A file that contains a null byte is skipped.
- The walk stops at 20,000 files.
- Since 0.1.1: unknown CLI flags exit with code 2 instead of being treated as a path, the report strips terminal control characters from finding fields, and the JSON result exposes only build-relevant scripts.

A finding is a pattern in source or config. It is not a proof that a build will run out of memory, and it is not a verdict that the project is safe.

## Dependencies

Version 0.1.0 has no runtime dependencies. Review `package.json` before any later release that adds one.

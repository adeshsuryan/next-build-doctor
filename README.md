# Next build doctor

Next build doctor reads a Next.js project on disk and reports build-memory and build-performance risks before the build hits them.

`next build` can run out of memory, stall in static generation, or compile the same code twice — and the framework does not say why. This package names the flag, file, or route family that is likely to cause it.

It is a library and a command. Current release: **0.2.0**. Modes: `scan` (static analysis of source/config, read-only) and `inspect` (`.next` artifact inventory: cache weight, prerendered routes, heaviest chunks). `profile` (supervised `next build` with memory sampling) is a planned mode.

Each release commit on `main` is an annotated git tag and an entry in [CHANGELOG.md](CHANGELOG.md).

- GitHub: https://github.com/adeshsuryan/next-build-doctor
- npm: https://www.npmjs.com/package/next-build-doctor
- JSR: https://jsr.io/@adeshsuryan/next-build-doctor
- Packagist: https://packagist.org/packages/adeshsuryan/next-build-doctor

## Install

Node.js 18 or newer.

### npm / pnpm / yarn (recommended for Next.js)

```bash
npm install next-build-doctor
pnpm add next-build-doctor
yarn add next-build-doctor
```

```bash
npx next-build-doctor
```

### JSR

```bash
npx jsr add @adeshsuryan/next-build-doctor
# or: deno add jsr:@adeshsuryan/next-build-doctor
```

### Composer (Packagist)

Composer installs the files. Node runs them.

```bash
composer require adeshsuryan/next-build-doctor
node vendor/adeshsuryan/next-build-doctor/bin/next-build-doctor.js
```

## Use it from code

```js
// npm (CommonJS)
const { run, render } = require("next-build-doctor");

// npm / JSR (ESM)
// import { run, render } from "next-build-doctor";
// import { run, render } from "@adeshsuryan/next-build-doctor";

const result = run("/path/to/next-app", { mode: "scan" });
process.stdout.write(render(result));

for (const finding of result.findings) {
  if (finding.risk === "high") {
    console.error(finding.id, finding.file, finding.line);
  }
}
```

`run(directory, { mode })` returns `{ root, mode, fileCount, schemaVersion, project, findings }`. `render(result)` returns the text report. The package has no dependencies.

## Use it from the shell

```bash
npx next-build-doctor [directory] [--json] [--fail-on-high] [--verbose]
```

`directory` defaults to the current working directory. `--json` prints the same object `run()` returns. `--fail-on-high` exits 1 when any finding is high. Exit 2 means the path was refused or could not be read.

Subcommands (`scan` is the default):

```text
next-build-doctor scan|inspect|profile|docker [directory]
```

`inspect` reads `.next/` artifacts — no build is run. `profile` and `docker` exit 2 until their versions ship.

Example:

```text
Next build doctor
Mode: scan
Files read: 12

PROJECT
  Next: 16.3.8   bundler: turbopack   routers: app
  Routes: 4 (1 dynamic)   static-gen fan-out: unbounded
  Config: cpus=unset  workerThreads=unset  sourcemaps=off  typecheck=on  lint=on
  Heap flag: not found
  Docker: 1 file(s)

FINDINGS

HIGH  static-gen-fanout
app/products/[id]/page.tsx:1
generateStaticParams can create unbounded static-generation fan-out
...
```

## What a high finding means

| Id | What is wrong |
| --- | --- |
| `no-heap-limit-on-large-app` | Route count, file count, or heavy dependencies suggest build-memory pressure, and no `--max-old-space-size` is set anywhere. |
| `heap-limit-over-container-limit` | `--max-old-space-size` exceeds a Docker/Compose memory limit; the cgroup killer can stop the build before V8 collects. |
| `static-gen-fanout` | `generateStaticParams` with default `dynamicParams` can generate an unbounded number of static pages. |

Medium and low findings are in [docs/usage.md](docs/usage.md).

## What the scan will not open

- The filesystem root.
- Symbolic links.
- `node_modules`, `.next`, `.git`, `dist`, `coverage`, `out`, and any name that starts with a dot. Two exceptions: `.github/workflows/` for CI analysis and `.dockerignore` for Docker checks. `.env` files are never read.
- Files larger than 1 MB.
- More than 20,000 files. The walk stops there.

The file is read as text. It is not executed. A path that resolves outside the directory you passed is dropped.

## A note on `profile` mode

When `profile` ships it will run `next build` in the target project, which executes `next.config.js` and build plugins. That mode will stay opt-in and will print a warning. Do not run it on code you do not trust. See [SECURITY.md](SECURITY.md).

## Develop

```bash
git clone https://github.com/adeshsuryan/next-build-doctor.git
cd next-build-doctor
npm test
```

`pnpm test` and `yarn test` run the same `node --test` script. There is no install step, because the package has no dependencies.

## Releases

Versions follow semantic versioning. The git tag, `package.json`, and `jsr.json` use the same number. History is in [CHANGELOG.md](CHANGELOG.md).

Report a vulnerability through GitHub private security reporting, described in [SECURITY.md](SECURITY.md).

## License

MIT. Copyright 2026 Adesh Suryan. See [LICENSE](LICENSE).

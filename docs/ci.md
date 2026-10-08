# Continuous integration

`scan` mode is safe for CI: it reads files and exits. It never runs the project's build.

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: "22"
- run: npx next-build-doctor . --fail-on-high
```

Do not run `profile` in a per-commit CI gate: it executes a full `next build`, including the project's build-time code. Keep `profile` behind a manual `workflow_dispatch` trigger, and only on code you trust.

Cache `.next/cache` between builds when the project does not flag `cold-cache-ci`.

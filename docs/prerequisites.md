# Prerequisites

- Node.js 18 or newer. Check with `node -v`.
- A Next.js project on disk. App Router and Pages Router files are both read as text.
- Run the command from the project root, or pass that directory as the argument.
- Read permission on the source tree. The tool does not need a network connection, a running server, or cloud credentials.
- npm, pnpm, or yarn, if you install the package. The Git repository can be installed before the name exists on the npm registry. See the README.

The scanner is textual. It does not typecheck the project and it does not execute `next build`. A config flag computed by code can be missed. A finding is a source-level risk, not proof that a build will run out of memory.

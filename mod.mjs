/**
 * ESM entry for JSR / modern import paths.
 * Core implementation stays CommonJS for the Node CLI and npm require() users.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { run, render } = require("./src/index.js");

export { run, render };

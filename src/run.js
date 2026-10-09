"use strict";

const path = require("path");
const { readProject } = require("./scan");
const { detect } = require("./detect");
const { routeInfo } = require("./routes");
const { analyze, analyzeInspect } = require("./rules");
const { inspectProject } = require("./inspect");

const SCHEMA_VERSION = 1;
const AVAILABLE_MODES = new Set(["scan", "inspect"]);

function run(directory, options) {
  const opts = options || {};
  const mode = opts.mode || "scan";
  if (!AVAILABLE_MODES.has(mode)) {
    throw new Error(`Mode "${mode}" is not available in this version.`);
  }
  const resolved = path.resolve(directory || ".");

  if (mode === "inspect") {
    const project = readProject(resolved);
    const artifacts = inspectProject(resolved, project.files.map((f) => path.join(resolved, f.file)));
    const { findings } = analyzeInspect(artifacts);
    return {
      root: resolved,
      mode,
      fileCount: project.files.length,
      schemaVersion: SCHEMA_VERSION,
      artifacts,
      findings,
    };
  }

  const project = readProject(resolved);
  const detected = detect(project);
  const routes = routeInfo(project);
  const model = { ...detected, routes, fileCount: project.files.length, files: project.files };
  const { findings } = analyze(model);
  delete model.files;
  return {
    root: resolved,
    mode,
    fileCount: project.files.length,
    schemaVersion: SCHEMA_VERSION,
    project: model,
    findings,
  };
}

module.exports = { run };

"use strict";

const path = require("path");
const { readProject } = require("./scan");
const { detect } = require("./detect");
const { routeInfo } = require("./routes");
const { analyze } = require("./rules");

const SCHEMA_VERSION = 1;

function run(directory, options) {
  const opts = options || {};
  const mode = opts.mode || "scan";
  if (mode !== "scan") {
    throw new Error(`Mode "${mode}" is not available in this version.`);
  }
  const resolved = path.resolve(directory || ".");
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

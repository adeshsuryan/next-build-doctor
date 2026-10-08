"use strict";

const path = require("path");

const PAGE_EXT = /\.(js|jsx|ts|tsx)$/;

function isDynamic(segment) {
  return /^\[.*\]$/.test(segment);
}

function routeInfo(project) {
  const appPages = [];
  const appLayouts = [];
  const appHandlers = [];
  const pagesRoutes = [];
  const staticParams = [];

  for (const f of project.files) {
    const rel = f.file;
    const appMatch = rel.match(/^(?:src\/)?app\/(.*)$/);
    const pagesMatch = rel.match(/^(?:src\/)?pages\/(.*)$/);

    if (appMatch) {
      const base = path.posix.basename(appMatch[1]);
      if (/^page\./.test(base) && PAGE_EXT.test(base)) {
        appPages.push(rel);
        if (/generateStaticParams/.test(f.text)) {
          const dynamicParams = f.text.match(/export\s+const\s+dynamicParams\s*=\s*(true|false)/);
          staticParams.push({
            file: rel,
            dynamicParams: dynamicParams ? dynamicParams[1] === "true" : null,
          });
        }
      } else if (/^layout\./.test(base) && PAGE_EXT.test(base)) {
        appLayouts.push(rel);
      } else if (/^route\./.test(base) && PAGE_EXT.test(base)) {
        appHandlers.push(rel);
      }
    }

    if (pagesMatch && PAGE_EXT.test(path.posix.basename(pagesMatch[1]))) {
      const base = path.posix.basename(pagesMatch[1]);
      if (!base.startsWith("_") && base !== "app.tsx" && base !== "document.tsx") {
        pagesRoutes.push(rel);
      }
    }
  }

  const dynamicRoutes = appPages.filter((p) => p.split("/").some(isDynamic));
  const total = appPages.length + appHandlers.length + pagesRoutes.length;

  // Static-gen fan-out estimate: each generateStaticParams route multiplies pages.
  // Bounded if dynamicParams=false; unbounded otherwise.
  const unbounded = staticParams.filter((s) => s.dynamicParams !== false);
  const bounded = staticParams.filter((s) => s.dynamicParams === false);
  let fanout = "none";
  let estimate = 0;
  if (staticParams.length > 0) {
    const dynamicSegs = new Set();
    for (const s of staticParams) {
      for (const seg of s.file.split("/")) {
        if (isDynamic(seg)) dynamicSegs.add(seg);
      }
    }
    estimate = unbounded.length > 0 ? -1 : bounded.length; // -1 means unbounded
    fanout = unbounded.length > 0 ? "unbounded" : "bounded";
  }

  return {
    appPages: appPages.length,
    appLayouts: appLayouts.length,
    appHandlers: appHandlers.length,
    pagesRoutes: pagesRoutes.length,
    dynamicRoutes: dynamicRoutes.length,
    total,
    generateStaticParams: staticParams,
    fanout,
    fanoutEstimate: estimate,
  };
}

module.exports = { routeInfo, isDynamic };

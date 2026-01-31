const fs = require("fs");
const path = require("path");

const paramsPath = path.join(
  __dirname,
  "..",
  "dist",
  "services",
  "solaredge-diagram-scraper-service",
  "models",
  "parameters.js",
);
const mod = require(paramsPath);
const params = mod && mod.default ? mod.default : mod;

// Take all exports that are arrays and contain strings
const outObj = {};
for (const [name, value] of Object.entries(params)) {
  if (Array.isArray(value)) {
    // optional: only allow string arrays
    const stringsOnly = value.filter((v) => typeof v === "string");
    if (stringsOnly.length) outObj[name] = stringsOnly;
  }
}

const out =
  "window.SOLAREDGE_ENUMS = " + JSON.stringify(outObj, null, 2) + ";\n";

// Write to resources/
const outDir = path.join(__dirname, "..", "resources");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "parameters.js"), out, "utf8");

// Write to resources/node-red-contrib-solaredge-optimizers/
const outDirAddon = path.join(
  __dirname,
  "..",
  "resources",
  "node-red-contrib-solaredge-optimizers",
);
fs.mkdirSync(outDirAddon, { recursive: true });
fs.writeFileSync(path.join(outDirAddon, "parameters.js"), out, "utf8");

console.log("Loaded:", paramsPath);
console.log("Exported keys:", Object.keys(outObj));

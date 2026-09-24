const fs = require("fs");
const path = require("path");

const targets = [
  {
    paramsPath: path.join(
      __dirname,
      "..",
      "dist",
      "services",
      "solaredge-diagram-scraper-service",
      "models",
      "parameters.js",
    ),
    globalVar: "SOLAREDGE_ENUMS",
    outFile: "parameters.js",
  },
  {
    paramsPath: path.join(
      __dirname,
      "..",
      "dist",
      "services",
      "solaredge-custom-analysis-service",
      "models",
      "parameters.js",
    ),
    globalVar: "SOLAREDGE_CUSTOM_ANALYSIS_ENUMS",
    outFile: "custom-analysis-parameters.js",
  },
];

const outDirs = [
  path.join(__dirname, "..", "resources"),
  path.join(__dirname, "..", "resources", "node-red-contrib-solaredge-optimizers"),
];

for (const { paramsPath, globalVar, outFile } of targets) {
  const mod = require(paramsPath);
  const params = mod && mod.default ? mod.default : mod;

  // Take all exports that are arrays and contain strings
  const outObj = {};
  for (const [name, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      const stringsOnly = value.filter((v) => typeof v === "string");
      if (stringsOnly.length) outObj[name] = stringsOnly;
    }
  }

  const out =
    `window.${globalVar} = ` + JSON.stringify(outObj, null, 2) + ";\n";

  for (const outDir of outDirs) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, outFile), out, "utf8");
  }

  console.log("Loaded:", paramsPath);
  console.log(`Exported keys (window.${globalVar}):`, Object.keys(outObj));
}

const fs = require("fs");
const path = require("path");

const paramsPath = path.join(
  __dirname,
  "..",
  "dist",
  "models",
  "parameters.js"
); // ggf. anpassen
const mod = require(paramsPath);
const params = mod && mod.default ? mod.default : mod;

// Nimm alle Exporte, die Arrays sind und Strings enthalten
const outObj = {};
for (const [name, value] of Object.entries(params)) {
  if (Array.isArray(value)) {
    // optional: nur string arrays zulassen
    const stringsOnly = value.filter((v) => typeof v === "string");
    if (stringsOnly.length) outObj[name] = stringsOnly;
  }
}

const out =
  "window.SOLAREDGE_ENUMS = " + JSON.stringify(outObj, null, 2) + ";\n";

const outDir = path.join(__dirname, "..", "resources");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "parameters.js"), out, "utf8");

console.log("Loaded:", paramsPath);
console.log("Exported keys:", Object.keys(outObj));

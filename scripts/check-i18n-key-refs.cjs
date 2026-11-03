// Scan ui/src for t("...") / t('...') literal keys and verify each exists in
// the merged English locale resources (base + area parts). Reports missing
// keys with file:line so raw-key renderings can be fixed in one pass.
const fs = require("fs");
const path = require("path");

const LOCALES = path.join(__dirname, "..", "ui", "src", "i18n", "locales");
const SRC = path.join(__dirname, "..", "ui", "src");

// --- deep merge all en*.json part files (mirrors locales.ts) ---
function mergeInto(target, part, pathStr) {
  for (const [key, value] of Object.entries(part)) {
    if (!(key in target)) { target[key] = value; continue; }
    if (typeof target[key] === "object" && typeof value === "object" && target[key] !== null && value !== null) {
      mergeInto(target[key], value, `${pathStr}.${key}`);
      continue;
    }
    console.error(`OVERLAP ${pathStr}.${key}`);
  }
}
const merged = {};
for (const file of fs.readdirSync(LOCALES).filter((f) => /^en(\..+)?\.json$/.test(f))) {
  mergeInto(merged, JSON.parse(fs.readFileSync(path.join(LOCALES, file), "utf8")), "en");
}

function hasKey(key) {
  const segments = key.split(".");
  const base = segments[segments.length - 1];
  let node = merged;
  for (const segment of segments.slice(0, -1)) {
    if (typeof node !== "object" || node === null || !(segment in node)) return false;
    node = node[segment];
  }
  if (typeof node !== "object" || node === null) return false;
  if (typeof node[base] === "string") return true;
  // plural base key: resolved at runtime via _one/_other (or other suffix) sibling keys
  return Object.keys(node).some((k) => k.startsWith(`${base}_`) && /_(one|other|zero|two|few|many)$/.test(k));
}

// --- collect t("...") literals ---
const SKIP = /(\.test\.|\.stories\.|\/fixtures\/|\/storybook\/|artifact-directions|design-sandbox|Lab\.tsx$)/;
const missing = new Map();
let checked = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walk(full);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    const rel = path.relative(SRC, full).replace(/\\/g, "/");
    if (SKIP.test(rel)) continue;
    const text = fs.readFileSync(full, "utf8");
    const re = /\bt\(\s*(["'])((?:[^"'\\]|\\.)*)\1/g;
    let m;
    while ((m = re.exec(text))) {
      const key = m[2];
      if (!key || key.includes("${")) continue; // dynamic keys can't be checked statically
      checked++;
      if (!hasKey(key)) {
        const line = text.slice(0, m.index).split("\n").length;
        if (!missing.has(key)) missing.set(key, []);
        missing.get(key).push(`${rel}:${line}`);
      }
    }
  }
}
walk(SRC);

console.log(`checked ${checked} literal keys`);
const sorted = [...missing.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [key, sites] of sorted) {
  console.log(`MISSING ${key}  (${sites.length} refs)`);
  for (const site of sites.slice(0, 4)) console.log(`    ${site}`);
}
console.log(`total missing keys: ${missing.size}`);

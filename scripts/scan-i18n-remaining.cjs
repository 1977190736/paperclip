// Scan ui/src for files that still contain likely user-visible English strings
// but are not wired to i18n. Rough heuristic: count English-looking sentences
// inside JSX-ish lines (text nodes / label-ish props), excluding tests,
// storybook, design-lab fixtures, and files already importing i18n.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "ui", "src");
const SKIP_DIRS = new Set(["__tests__", "artifact-directions", "storybook", "design-sandbox"]);
const SKIP_FILE = /(\.test\.|\.stories\.|tmp-|\/tmp\/|Lab\.tsx$|production\.test\.)/;

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name === "node_modules") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !SKIP_FILE.test(full.replace(/\\/g, "/"))) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(ROOT, []);
const report = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const wired = /useTranslation|from "@\/i18n"|from "\.\.\/i18n"|from "\.\.\/\.\.\/i18n"|from "\.\/i18n"/.test(text);
  // Heuristic English-UI hits: >word< JSX text nodes or label-ish props.
  const hits = text.match(/>\s*[A-Z][a-zA-Z0-9' ,.!?&/-]{2,60}\s*<|aria-label="[A-Z][^"]{3,60}"|label="[A-Z][^"]{3,60}"|placeholder="[A-Z][^"]{3,60}"|title="[A-Z][^"]{3,60}"|"[A-Z][a-z]+ [a-z]+[^"]{0,50}"/g) || [];
  // Filter obvious non-UI lines: imports, types, URLs, CSS, console, keys, ids
  const meaningful = hits.filter((h) => {
    if (/console\.|data-testid|className|key:|id:|href|import |from "|aria-controls|font-|tracking-|text-|bg-|border-|rounded|placeholder-|type="/.test(h)) return false;
    if (/^(If|The|This|That|Use|When|All|Any|New|Add|Edit|Delete|Remove|Save|Cancel|Close|Open|Copy|Retry|Loading|Error|Sign|Search|Filter|Select|Create|Update|Enable|Disable|Show|Hide|View|Back|Next|Done|Confirm|Are you|No |Your |My |Get |Set |Turn )/.test(h.replace(/^[>"]\s*/, ""))) return true;
    if (/^[>"]\s*[A-Z][a-z]+ [a-z]/.test(h)) return true;
    return false;
  });
  if (meaningful.length >= 3) {
    report.push({
      file: path.relative(ROOT, file).replace(/\\/g, "/"),
      wired,
      hits: meaningful.length,
    });
  }
}
const unwired = report.filter((r) => !r.wired).sort((a, b) => b.hits - a.hits);
const wiredLeftover = report.filter((r) => r.wired).sort((a, b) => b.hits - a.hits);
console.log("=== UNWIRED files with English UI text (suspects) ===");
for (const r of unwired) console.log(`${String(r.hits).padStart(3)}  ${r.file}`);
console.log(`total unwired suspects: ${unwired.length}`);
console.log("=== WIRED files still showing English-pattern hits (possible leftovers) ===");
for (const r of wiredLeftover.slice(0, 40)) console.log(`${String(r.hits).padStart(3)}  ${r.file}`);
console.log(`total wired-with-hits: ${wiredLeftover.length}`);

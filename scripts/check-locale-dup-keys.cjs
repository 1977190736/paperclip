// One-off: detect duplicate keys within single JSON files (JSON.parse silently
// keeps the last one, which hides real bugs in generated locale files).
// Braces inside string values (e.g. `{{placeholder}}`) are ignored by
// stripping string bodies before counting structural braces.
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "ui", "src", "i18n", "locales");
let badFiles = 0;

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const lines = fs.readFileSync(path.join(dir, file), "utf8").split(/\r?\n/);
  const frames = [new Map()]; // one Map per open object; frames[depth] is current
  let depth = 0;
  const dups = [];
  for (const [i, raw] of lines.entries()) {
    const m = raw.match(/^\s*"([^"]+)"\s*:/);
    if (m) {
      const frame = frames[depth];
      if (frame.has(m[1])) {
        dups.push(`${m[1]} -> duplicate at line ${i + 1} (first seen earlier)`);
      } else {
        frame.set(m[1], i + 1);
      }
    }
    const structural = raw.replace(/"(?:[^"\\]|\\.)*"/g, '""');
    const opens = (structural.match(/\{/g) || []).length;
    const closes = (structural.match(/\}/g) || []).length;
    depth += opens - closes;
    for (let k = 0; k < opens; k++) frames.push(new Map());
    for (let k = 0; k < closes; k++) frames.pop();
    if (depth < 0) break;
  }
  if (dups.length > 0) {
    badFiles++;
    console.log(`DUPLICATE KEYS in ${file}:`);
    for (const d of dups) console.log("  " + d);
  }
}
console.log(badFiles === 0 ? "no duplicate keys found" : `${badFiles} file(s) with duplicate keys`);

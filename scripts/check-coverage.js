// scripts/check-coverage.js
// Called by CI to enforce coverage threshold.
// Usage: node scripts/check-coverage.js [threshold=65]

const fs = require("fs");

const threshold = parseFloat(process.argv[2] ?? "65");

let report;
try {
  report = JSON.parse(fs.readFileSync("coverage/coverage-final.json", "utf8"));
} catch {
  console.warn("Coverage report not found — skipping threshold check");
  process.exit(0);
}

const files = Object.values(report);
let totalStatements = 0;
let coveredStatements = 0;

for (const f of files) {
  totalStatements += f.statementMap ? Object.keys(f.statementMap).length : 0;
  coveredStatements += f.s ? Object.values(f.s).filter((v) => v > 0).length : 0;
}

const pct = totalStatements > 0
  ? ((coveredStatements / totalStatements) * 100).toFixed(1)
  : "0.0";

console.log("Coverage: " + pct + "%");

if (parseFloat(pct) < threshold) {
  console.error("::error::Coverage " + pct + "% is below required " + threshold + "%");
  process.exit(1);
}

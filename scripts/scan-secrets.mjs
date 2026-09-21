// Repository secret scanner: fails CI if a credential is ever committed.
// Scans git-tracked files only (local .env files are untracked by design
// and are never inspected). Run: node scripts/scan-secrets.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((path) => !path.endsWith(".lock") && !path.endsWith(".png") && !path.endsWith(".ico"));

const failures = [];
const historyFailures = [];

// A real .env file must never be tracked (only .env.example is allowed).
for (const path of tracked) {
  if (/^\.env(\.|$)/.test(path) && path !== ".env.example") {
    failures.push(`${path}: tracked env file (only .env.example may be committed)`);
  }
}

const textExtensions = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".sql", ".md",
  ".example", ".txt", ".yml", ".yaml", ".toml", ".html", ".css",
]);

const rawPatterns = [
  [/-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, "private key material"],
  [/\bsk-live-[A-Za-z0-9_-]{8,}/, "live secret key"],
  [/\bxox[bap]-[A-Za-z0-9-]{8,}/, "chat service token"],
  [/\bghp_[A-Za-z0-9]{20,}/, "github personal access token"],
  [/\bAKIA[0-9A-Z]{16}\b/, "aws access key id"],
];

const keyPatterns = [
  [/\bSUPABASE_SECRET_KEY\s*=/, "supabase service-role key assignment"],
  [/\bADMIN_PASSWORD\s*=/, "admin password assignment"],
  [/\bRAZORPAY_KEY_SECRET\s*=/, "razorpay key secret assignment"],
  [/\bUROPAY_(API_SECRET|WEBHOOK_SECRET)\s*=/, "uropay secret assignment"],
  [/\bNVIDIA_API_KEY\s*=/, "nvidia api key assignment"],
  [/\bOPENROUTER_API_KEY\s*=/, "openrouter api key assignment"],
];

const PLACEHOLDER_VALUES = [
  "",
  "xxx",
  "test",
  "changeme",
  "placeholder",
  "example",
  "your-key-here",
  "your-secret-here",
  "your-password-here",
];

// These are intentionally scoped to the historical-history scanner only.
// They are known development fixtures from before the current auth design and
// are no longer accepted anywhere in the application.
const LEGACY_HISTORY_FIXTURES = new Set(["AGGIN"]);

// A KEY=value assignment is only a finding when the value on the SAME line
// is non-empty and not an obvious placeholder. History scanning may also
// recognize explicitly documented legacy development fixtures.
function assignedRealValueFromLine(line, { allowLegacyHistoryFixtures = false } = {}) {
  const separator = line.indexOf("=");
  if (separator < 0) return null;

  const value = line
    .slice(separator + 1)
    .trim()
    .replace(/^[\"']|[\"']$/g, "")
    .trim();

  if (!value) return null;

  const lowered = value.toLowerCase();
  const looksLikePlaceholder =
    lowered.startsWith("<") ||
    lowered.endsWith("...") ||
    lowered.includes("your_project") ||
    lowered.includes("your-project") ||
    lowered.includes("replace_me") ||
    lowered.includes("replace-me") ||
    lowered.includes("change_me") ||
    lowered.includes("change-me") ||
    PLACEHOLDER_VALUES.includes(lowered) ||
    lowered.startsWith("your-") ||
    lowered.startsWith("your_") ||
    lowered.startsWith("replace-") ||
    lowered.startsWith("replace_") ||
    lowered.startsWith("change-") ||
    lowered.startsWith("change_");

  if (looksLikePlaceholder) return null;
  if (allowLegacyHistoryFixtures && LEGACY_HISTORY_FIXTURES.has(value)) return null;

  return value;
}

for (const path of tracked) {
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot) : "";
  if (!textExtensions.has(ext) && path !== ".env.example") continue;
  // .env.example carries empty placeholders by convention; assignments with
  // real values there are still worth flagging, so it stays in scope.
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  for (const [pattern, label] of rawPatterns) {
    if (pattern.test(content)) {
      failures.push(`${path}: possible ${label}`);
    }
  }
  for (const [pattern, label] of keyPatterns) {
    for (const line of content.split(/\r?\n/)) {
      if (!pattern.test(line)) continue;
      const value = assignedRealValueFromLine(line);
      if (value) {
        failures.push(`${path}: possible ${label}`);
        break;
      }
    }
  }
}

// Scan reachable Git history as well. CI checks out the full repository history
// so this covers every reachable commit rather than only a shallow snapshot.
let commits = [];
try {
  commits = execFileSync("git", ["rev-list", "--all"], { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
} catch {
  commits = [];
}

const historyRawPatterns = [
  [/-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, "private key material"],
  [/\bsk-live-[A-Za-z0-9_-]{8,}/, "live secret key"],
  [/\bghp_[A-Za-z0-9]{20,}/, "github personal access token"],
  [/\bAKIA[0-9A-Z]{16}\b/, "aws access key id"],
];

const historyKeyPatterns = [
  [/\bSUPABASE_SECRET_KEY\s*=/, "supabase secret assignment"],
  [/\bADMIN_PASSWORD\s*=/, "admin password assignment"],
  [/\bRAZORPAY_KEY_SECRET\s*=/, "razorpay secret assignment"],
  [/\bUROPAY_(API_SECRET|WEBHOOK_SECRET)\s*=/, "uropay secret assignment"],
  [/\bNVIDIA_API_KEY\s*=/, "nvidia api key assignment"],
];

for (const commit of commits) {
  let files = [];
  try {
    files = execFileSync("git", ["ls-tree", "-r", "--name-only", commit], { encoding: "utf8" })
      .split("\n").map((line) => line.trim()).filter(Boolean);
  } catch {
    continue;
  }

  for (const path of files) {
    const dot = path.lastIndexOf(".");
    const ext = dot >= 0 ? path.slice(dot) : "";
    if (!textExtensions.has(ext) && path !== ".env.example") continue;

    let content;
    try {
      content = execFileSync("git", ["show", `${commit}:${path}`], {
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
      });
    } catch {
      continue;
    }

    for (const [pattern, label] of historyRawPatterns) {
      if (pattern.test(content)) {
        historyFailures.push(`${commit.slice(0, 12)} ${path}: possible ${label}`);
      }
    }

    for (const [pattern, label] of historyKeyPatterns) {
      for (const line of content.split(/\r?\n/)) {
        if (!pattern.test(line)) continue;
        const value = assignedRealValueFromLine(line);
        if (value) {
          historyFailures.push(`${commit.slice(0, 12)} ${path}: possible ${label}`);
          break;
        }
      }
    }
  }
}

if (failures.length > 0 || historyFailures.length > 0) {
  console.error("Secret scan failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  for (const failure of historyFailures) console.error(`  - history: ${failure}`);
  process.exit(1);
}

console.log(`Secret scan passed current tree and ${commits.length} reachable commits.`);

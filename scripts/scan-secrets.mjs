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

const PLACEHOLDER_VALUES = ["", "xxx", "test", "changeme", "placeholder", "example", "your-key-here"];

// A KEY=value assignment is only a finding when the value on the SAME line
// is non-empty and not an obvious placeholder.
function assignedRealValue(content, keyMatch) {
  const lineStart = content.lastIndexOf("\n", keyMatch.index) + 1;
  const lineEnd = content.indexOf("\n", keyMatch.index + keyMatch[0].length);
  const line = content.slice(lineStart, lineEnd < 0 ? content.length : lineEnd);
  const value = (line.split("=").slice(1).join("=") || "").trim().replace(/^["']|["']$/g, "").trim();
  if (!value) return null;
  const lowered = value.toLowerCase();
  if (lowered.startsWith("<") || PLACEHOLDER_VALUES.includes(lowered) || lowered.startsWith("your-")) return null;
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
    const match = content.match(pattern);
    if (match) {
      const value = assignedRealValue(content, match);
      if (value) failures.push(`${path}: possible ${label}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Secret scan failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("Secret scan passed.");

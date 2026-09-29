#!/usr/bin/env node
/**
 * Release gate.
 *
 * Runs the project's checks — typecheck, lint, and the security contract — and
 * only when all three pass does it commit and push. If any check fails the
 * script stops before touching git, so unverified work cannot ship.
 *
 *   node scripts/release.mjs -m "fix: ..."              verify, commit, push
 *   node scripts/release.mjs -m "fix: ..." --no-push    verify and commit only
 *   node scripts/release.mjs --dry-run                  verify only, change nothing
 *
 * Generated and local-only files are never staged, so they cannot add commit
 * noise or leak an env file into the repository.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const USAGE = `Usage: node scripts/release.mjs -m "<commit message>" [options]

Options:
  -m, --message <msg>  Commit message (required unless --dry-run)
      --no-push        Commit locally but do not push
      --dry-run        Run the checks and report what would be committed, then stop
  -h, --help           Show this help
`;

/**
 * Generated or local-only files that should never be staged. `.env.example` is
 * the one tracked env file, so it is deliberately not treated as noise.
 */
function isNoise(name) {
  if (name === ".env.example") return false;
  if (name === ".env" || name.startsWith(".env.")) return true;
  return name === "next-env.d.ts" || /\.tsbuildinfo$/.test(name) || /\.log$/.test(name) || name === ".DS_Store";
}

// Each gate is the same check a human would run by hand; the local binary is
// preferred so the gate does not depend on a package-manager shim resolving.
const CHECKS = [
  { name: "typecheck", script: "typecheck", bin: "node_modules/typescript/bin/tsc", args: ["--noEmit"] },
  { name: "lint", script: "lint", bin: "node_modules/eslint/bin/eslint.js", args: ["."] },
  { name: "security contract", script: "test", bin: "scripts/security-contract-check.mjs", args: [] },
];

function run(command, args, { cwd, capture = false } = {}) {
  return spawnSync(command, args, {
    cwd,
    shell: false,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });
}

function git(root, args, { capture = true } = {}) {
  const result = run("git", ["-C", root, ...args], { capture });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(`git ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return result.stdout ?? "";
}

function resolvePackageManager() {
  for (const candidate of [{ command: "pnpm", prefix: [] }, { command: "corepack", prefix: ["pnpm"] }]) {
    const probe = run(candidate.command, [...candidate.prefix, "--version"], { capture: true });
    if (probe.status === 0) return candidate;
  }
  return null;
}

function runCheck(check, root) {
  // check.bin entries are hardcoded literals in CHECKS below. Normalize and
  // refuse anything resolving outside the repo root regardless.
  const binary = path.normalize(path.join(root, check.bin));
  if (binary !== root && !binary.startsWith(root + path.sep)) {
    throw new Error(`Refusing to run check binary outside repo root: ${check.bin}`);
  }

  if (existsSync(binary)) {
    return run(process.execPath, [binary, ...check.args], { cwd: root });
  }

  const manager = resolvePackageManager();
  if (!manager) return { status: 1 };

  return run(manager.command, [...manager.prefix, "run", check.script], { cwd: root });
}

function parseStatus(output) {
  return output
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const raw = line.slice(3).trim();
      const renamed = raw.includes(" -> ") ? raw.split(" -> ").pop() : raw;
      return {
        code: line.slice(0, 2),
        file: renamed.replace(/^"(.*)"$/, "$1"),
      };
    });
}

function isConflict(code) {
  return ["DD", "AU", "UD", "UA", "DU", "AA", "UU"].includes(code);
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write(USAGE);
    return 0;
  }

  const messageFlag = argv.findIndex((arg) => arg === "-m" || arg === "--message");
  const message = messageFlag >= 0 ? argv[messageFlag + 1] : undefined;
  const dryRun = argv.includes("--dry-run");
  const noPush = argv.includes("--no-push");

  if (!dryRun && !message) {
    process.stderr.write(`A commit message is required.\n\n${USAGE}`);
    return 1;
  }

  if (messageFlag >= 0 && !message) {
    process.stderr.write(`--message needs a value.\n\n${USAGE}`);
    return 1;
  }

  const root = git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
  const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();

  console.log(`\nReleasing from ${root}`);
  console.log(`Branch: ${branch}${dryRun ? "  (dry run — nothing will be committed)" : ""}\n`);

  if (branch === "HEAD") {
    console.error("Refusing to release from a detached HEAD. Check out a branch first.");
    return 1;
  }

  console.log("── Checks " + "─".repeat(50));
  for (const check of CHECKS) {
    process.stdout.write(`  ${check.name} ... `);
    const result = runCheck(check, root);

    if (result.status !== 0) {
      console.log("FAILED\n");
      console.error(`Release stopped: ${check.name} did not pass. Nothing was committed or pushed.`);
      return 1;
    }

    console.log("ok");
  }
  console.log("");

  const entries = parseStatus(git(root, ["status", "--porcelain"]));
  const conflicts = entries.filter((entry) => isConflict(entry.code));

  if (conflicts.length > 0) {
    console.error("Unresolved merge conflicts — resolve them before releasing:");
    for (const conflict of conflicts) console.error(`  ${conflict.code} ${conflict.file}`);
    return 1;
  }

  const staged = entries.filter((entry) => !isNoise(path.basename(entry.file)));
  const skipped = entries.filter((entry) => isNoise(path.basename(entry.file)));

  if (skipped.length > 0) {
    console.log("Skipping generated/local files:");
    for (const entry of skipped) console.log(`  ${entry.file}`);
    console.log("");
  }

  const hasChanges = staged.length > 0;
  const upstreamRef = (() => {
    const result = run("git", ["-C", root, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], { capture: true });
    return result.status === 0 ? result.stdout.trim() : null;
  })();
  const ahead = upstreamRef
    ? Number(git(root, ["rev-list", "--count", `${upstreamRef}..HEAD`]).trim())
    : 0;

  if (!hasChanges && ahead === 0) {
    console.log("Checks passed and there is nothing to release — the tree is clean and the branch is up to date.");
    return 0;
  }

  if (hasChanges) {
    console.log(`Would stage ${staged.length} file(s):`);
    for (const entry of staged) console.log(`  ${entry.code.trim() || "??"}  ${entry.file}`);
    console.log("");
  } else {
    console.log(`No working changes to commit, but ${ahead} commit(s) are waiting to be pushed.\n`);
  }

  if (dryRun) {
    console.log("Dry run complete: checks passed, nothing was committed or pushed.");
    return 0;
  }

  if (hasChanges) {
    git(root, ["add", "--", ...staged.map((entry) => entry.file)], { capture: false });

    const stagedList = git(root, ["diff", "--cached", "--name-status"]).trim();
    if (!stagedList) {
      console.error("Nothing ended up staged; aborting so an empty commit is not created.");
      return 1;
    }

    git(root, ["commit", "-m", message], { capture: false });
    const head = git(root, ["rev-parse", "HEAD"]).trim();
    console.log(`\nCommitted ${head.slice(0, 7)}: ${message.split("\n")[0]}`);
  }

  if (noPush) {
    console.log("\n--no-push set: skipping the push. Run `git push` when you are ready.");
    return 0;
  }

  console.log("");
  const pushArgs = upstreamRef ? ["push", "origin", branch] : ["push", "-u", "origin", branch];
  const push = run("git", ["-C", root, ...pushArgs], { capture: false });

  if (push.status !== 0) {
    console.error("\nPush failed. The commit exists locally; fix the problem and push again.");
    return 1;
  }

  console.log("\nRelease complete.");
  return 0;
}

process.exit(main());

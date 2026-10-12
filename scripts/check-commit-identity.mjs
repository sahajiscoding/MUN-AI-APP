#!/usr/bin/env node
/**
 * Commit identity guard.
 *
 * GitHub attaches a commit to a GitHub account by matching the *email* in the
 * commit against the addresses registered on accounts. The display name is
 * cosmetic; the address is the identity. If a commit is authored with an
 * address that a stranger has registered on their own account, GitHub counts
 * that commit as theirs and lists them as a contributor to this repository.
 *
 * That is not hypothetical. On 2026-10-11 three commits from PR #10 were
 * authored as `Arena Agent <agent@arena.ai>`. The address `agent@arena.ai` was
 * registered to an unrelated GitHub account (Nixes407), so those commits were
 * credited to a stranger and they appeared in this repository's contributor
 * list with 3 contributions. No file in the repository mentioned them: the
 * credit came entirely from the address in the commit metadata, and removing it
 * meant rewriting history and force-pushing main.
 *
 * So this script checks addresses, not names, and it is deny-by-default:
 *
 *   1. GitHub's per-account no-reply form, `<id>+<login>@users.noreply.github.com`,
 *      is allowed. GitHub issues those per account and nobody else can register
 *      one, so this form cannot be squatted the way `agent@arena.ai` was.
 *   2. `noreply@github.com` is allowed: GitHub itself is the committer of every
 *      merge made in the web interface.
 *   3. ALLOWED lists the addresses this project's own accounts registered, with
 *      the reason for each. This is the only place to add a new one.
 *   4. GRANDFATHERED lists addresses that exist in history from before this
 *      guard was introduced. They are allowed so that scanning a branch stays
 *      green, and they are documented as legacy. Do not reuse any of them.
 *   5. DENIED always wins over 1-4, including over anything added to ALLOWED:
 *      if an entry above matches a DENIED rule the script refuses to run rather
 *      than quietly re-legalising the address that caused this.
 *
 * Per commit it checks the author email, the committer email and every
 * `Co-authored-by:` address in the message (a trailer grants a contribution
 * too). In hook mode it also checks the identity git is about to stamp on the
 * commit, plus the message being committed.
 *
 * Honest limits:
 *   - The local hooks only see commits made through `git commit` with the hooks
 *     installed. Commits made with plumbing (`git commit-tree`), pushed through
 *     the GitHub API, or committed on a clone where `pnpm hooks:install` was
 *     never run are invisible locally. The CI workflow ("Commit Identity") runs
 *     this same script over every commit reachable from the branch, and that is
 *     the layer that cannot be bypassed.
 *   - Anyone who can push can edit this file. The DENIED list and the
 *     self-check below exist so the easy "fix" (allowlisting the squatted
 *     address) fails loudly and has to be done deliberately, in a reviewable
 *     diff, instead of by accident.
 *   - Names are not checked. `SCARY HACKER CODER XD <298482267+arena-ai-coding-agent[bot]@users.noreply.github.com>`
 *     is allowed on purpose: the name is decoration, the address is owned.
 *
 * Usage:
 *   node scripts/check-commit-identity.mjs                # every commit reachable from HEAD
 *   node scripts/check-commit-identity.mjs --rev <rev>    # ...from another revision or range
 *   node scripts/check-commit-identity.mjs --hook <file>  # git hook mode: identity + message file
 *   node scripts/check-commit-identity.mjs --quiet        # only speak up when something is wrong
 *
 * Exit codes: 0 clean, 1 policy violation, 2 the script could not do its job.
 * In hook mode an exit of 2 is downgraded to a warning (0), because a broken
 * hook must not be able to block the owner's work; the CI run still fails on it.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

/** Form GitHub issues per account: <numeric id>+<login>@users.noreply.github.com. */
const NO_REPLY_ACCOUNT = {
  test: (email) => /^[0-9]+\+[^@\s]+@users\.noreply\.github\.com$/.test(email),
  describe: "<id>+<login>@users.noreply.github.com (your GitHub no-reply address)",
  why: "GitHub issues this form per account and nobody else can register one, so it cannot be squatted",
};

/** Addresses owned by this project's accounts. Add new identities here, with a reason. */
const ALLOWED = [
  {
    email: "135018977+sahajiscoding@users.noreply.github.com",
    why: "owner's GitHub no-reply address",
  },
  {
    email: "sahajgangwani@gmail.com",
    why: "owner's address, registered on the owner's GitHub account",
  },
  {
    email: "noreply@github.com",
    why: "GitHub's own committer identity for merges made in the web interface",
  },
];

/** Pre-guard history only. Do not reuse: these are not owned by an account we control. */
const GRANDFATHERED = [
  {
    email: "arena-agent@users.noreply.github.com",
    why: "older no-reply form for the Arena Agent account, used before this guard existed",
  },
  {
    email: "arena-ai-coding-agent@users.noreply.github.com",
    why: "older no-reply form for the agent bot, used in a pre-guard Co-authored-by trailer",
  },
  {
    email: "noreply@codebuff.com",
    why: "vendor address in a pre-guard Co-Authored-By trailer; never attributable to a GitHub account",
  },
  {
    email: "noreply@anthropic.com",
    why: "vendor address in a pre-guard Co-Authored-By trailer; never attributable to a GitHub account",
  },
  {
    email: "1.35018977e+08+sahajiscoding@users.noreply.github.com",
    why: "mangled rendering of the owner's numeric id by early tooling; pre-guard commits only",
  },
];

/** Always denied, ahead of every allow list. */
const DENIED = [
  {
    test: (email) => /@(?:[^@]*\.)?arena\.ai$/i.test(email),
    why:
      "`@arena.ai` is not registered to any account that owns this repository, and a third party " +
      "registered `agent@arena.ai` and was credited with 3 commits here on 2026-10-11 (Nixes407). " +
      "Use your GitHub no-reply address instead.",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);

const usage = () => {
  const text = readFileSync(new URL(import.meta.url), "utf8");
  const from = text.indexOf("Usage:");
  const to = text.indexOf("Exit codes:");
  console.log(
    text
      .slice(from, to > from ? to : undefined)
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s?/, ""))
      .join("\n")
      .trimEnd(),
  );
};

const deniedBy = (email) => DENIED.find((rule) => rule.test(email));

/** Classification for one address: { ok: true } or { ok: false, why }. */
const classify = (email) => {
  const address = (email ?? "").trim().toLowerCase();
  if (address === "") return { ok: false, why: "commit has no email address" };
  const denied = deniedBy(address);
  if (denied) return { ok: false, why: denied.why };
  if (NO_REPLY_ACCOUNT.test(address)) return { ok: true };
  if ([...ALLOWED, ...GRANDFATHERED].some((entry) => entry.email === address)) return { ok: true };
  return { ok: false, why: "not an address registered by any account that owns this repository" };
};

/** `Name <email>` trailers, anywhere in the message body. */
const TRAILER = /^[ \t]*co-authored-by[ \t]*:[ \t]*(.*)$/gim;

const trailerIdentities = (message) => {
  const found = [];
  for (const match of message.matchAll(TRAILER)) {
    const value = match[1].trim();
    const ident = /^(.*?)\s*<([^<>]+)>\s*$/.exec(value);
    if (ident) found.push({ name: ident[1].trim(), email: ident[2].trim() });
    else if (value !== "") found.push({ name: value, email: "", malformed: true });
  }
  return found;
};

const git = (...args) =>
  execFileSync("git", ["--no-pager", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const failed = (error) =>
  `${error.stderr ?? ""}`.toString().trim().split("\n")[0] || `${error.message}`;

// The self-check: an allow list entry that is also denied means someone tried to
// re-legalise a squatted address. Refusing to run beats reporting a false pass.
for (const entry of [...ALLOWED, ...GRANDFATHERED]) {
  const denied = deniedBy(entry.email);
  if (denied) {
    console.error(
      `commit-identity: refusing to run.\n\n` +
        `  allow list entry: ${entry.email}\n` +
        `  denied because:   ${denied.why}\n\n` +
        `Remove it from ALLOWED/GRANDFATHERED. An address can only be allowed if an account\n` +
        `this project controls has registered it.`,
    );
    process.exit(2);
  }
}

const allowedSummary = () =>
  [NO_REPLY_ACCOUNT, ...ALLOWED]
    .map((entry) => `  ${entry.describe ?? entry.email}${entry.describe ? "" : ` (${entry.why})`}`)
    .join("\n");

const report = (violations, context) => {
  const unique = [...new Map(violations.map((v) => [`${v.sha}|${v.where}|${v.email}`, v])).values()];
  console.error(`commit-identity: FAIL - ${unique.length} unowned address(es) in ${context}\n`);
  for (const v of unique.slice(0, 25)) {
    let subject = "";
    if (v.sha !== "(pending)") {
      try {
        subject = git("log", "-1", "--format=%s", v.sha).trim();
      } catch {
        subject = "";
      }
    }
    const label = (v.sha === "(pending)" ? "(pending)" : v.sha.slice(0, 7)).padEnd(11);
    console.error(`  ${label}${v.where.padEnd(12)}${v.email || "(missing)"}`);
    if (subject) console.error(`  ${" ".repeat(11)}${subject}`);
    console.error(`  ${" ".repeat(11)}${v.why}`);
    console.error("");
  }
  if (unique.length > 25) console.error(`  ... and ${unique.length - 25} more\n`);
  console.error(`  allowed addresses:\n${allowedSummary()}\n`);
  console.error(
    `  fix: rewrite the offending commit(s) so they carry an address above, then force-push\n` +
      `       the branch. Rules and reasons: scripts/check-commit-identity.mjs, AGENTS.md.`,
  );
  process.exit(1);
};

// ---------------------------------------------------------------------------
// Hook mode: the identity git is about to use, plus the message being committed
// ---------------------------------------------------------------------------

const identOf = (variable) => {
  const raw = git("var", variable).trim(); // "Name <email> 1791738793 +0000"
  const ident = /^(.*?)\s*<([^<>]+)>/.exec(raw);
  return ident ? { name: ident[1].trim(), email: ident[2].trim() } : null;
};

const runHookMode = (messagePath, quiet) => {
  const violations = [];
  for (const [variable, where] of [
    ["GIT_AUTHOR_IDENT", "author"],
    ["GIT_COMMITTER_IDENT", "committer"],
  ]) {
    const ident = identOf(variable);
    if (!ident) continue;
    const verdict = classify(ident.email);
    if (!verdict.ok) {
      violations.push({ sha: "(pending)", where, email: ident.email, why: verdict.why });
    }
  }
  for (const trailer of trailerIdentities(readFileSync(messagePath, "utf8"))) {
    const verdict = classify(trailer.email);
    if (!verdict.ok) {
      violations.push({
        sha: "(pending)",
        where: "co-author",
        email: trailer.email,
        why: trailer.malformed
          ? "Co-authored-by needs an address: `Co-authored-by: Name <email@example.com>`"
          : verdict.why,
      });
    }
  }
  if (violations.length > 0) report(violations, "this commit");
  if (!quiet) console.log("commit-identity: OK - this commit uses an owned address");
};

// ---------------------------------------------------------------------------
// Scan mode: every commit reachable from a revision (default HEAD)
// ---------------------------------------------------------------------------

const runScanMode = (rev, quiet) => {
  let raw;
  try {
    // -z separates commits with NUL, which no commit message can contain, and
    // the unit separator keeps the fields of each record apart. The message is
    // the last field, so separator bytes inside it stay inside that field.
    raw = git("log", "-z", "--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B", rev, "--");
  } catch (error) {
    console.error(
      `commit-identity: cannot read the history of '${rev}': ${failed(error)}\n` +
        `  run this from the repository root, or pass --rev <revision>.`,
    );
    process.exit(2);
  }

  const violations = [];
  let commits = 0;
  for (const record of raw.split("\0")) {
    if (record === "") continue;
    const fields = record.split("\x1f");
    const sha = fields[0];
    const message = fields.length > 5 ? fields.slice(5).join("\x1f") : "";
    if (fields.length < 6 || !/^[0-9a-f]{40}$/.test(sha ?? "")) {
      console.error(
        `commit-identity: cannot parse a commit record (${JSON.stringify(
          (sha ?? "").slice(0, 40),
        )}).\n  refusing to report a pass on history it could not read.`,
      );
      process.exit(2);
    }
    commits += 1;
    for (const [email, where] of [
      [fields[2], "author"],
      [fields[4], "committer"],
    ]) {
      const verdict = classify(email);
      if (!verdict.ok) violations.push({ sha, where, email, why: verdict.why });
    }
    for (const trailer of trailerIdentities(message)) {
      const verdict = classify(trailer.email);
      if (!verdict.ok) {
        violations.push({
          sha,
          where: "co-author",
          email: trailer.email,
          why: trailer.malformed
            ? "Co-authored-by needs an address: `Co-authored-by: Name <email@example.com>`"
            : verdict.why,
        });
      }
    }
  }

  if (violations.length > 0) report(violations, `'${rev}'`);
  if (!quiet) {
    console.log(
      `commit-identity: OK - ${commits} commit(s) reachable from '${rev}' all carry addresses owned by this project`,
    );
  }
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

let hookPath = null;
let rev = "HEAD";
let quiet = false;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  const value = () => {
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      console.error(`commit-identity: ${arg} needs a value\n`);
      usage();
      process.exit(2);
    }
    i += 1;
    return next;
  };
  if (arg === "--help" || arg === "-h") {
    usage();
    process.exit(0);
  } else if (arg === "--quiet" || arg === "-q") {
    quiet = true;
  } else if (arg === "--hook") {
    hookPath = value();
  } else if (arg.startsWith("--hook=")) {
    hookPath = arg.slice("--hook=".length);
  } else if (arg === "--rev") {
    rev = value();
  } else if (arg.startsWith("--rev=")) {
    rev = arg.slice("--rev=".length);
  } else {
    console.error(`commit-identity: unknown argument '${arg}'\n`);
    usage();
    process.exit(2);
  }
}

const inRepository = (() => {
  try {
    return git("rev-parse", "--is-inside-work-tree").trim() === "true";
  } catch {
    return false;
  }
})();

if (!inRepository) {
  if (hookPath) process.exit(0); // not our business
  console.error("commit-identity: not inside a git work tree.");
  process.exit(2);
}

try {
  if (hookPath) runHookMode(hookPath, quiet);
  else runScanMode(rev, quiet);
} catch (error) {
  if (hookPath) {
    // Fail open locally: a broken hook must never block the owner's work. The
    // CI workflow runs this same script and does fail closed.
    console.error(`commit-identity: hook could not run (${error.message}); allowing the commit.`);
    process.exit(0);
  }
  console.error(`commit-identity: ${error.message}`);
  process.exit(2);
}

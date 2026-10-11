#!/usr/bin/env node
/**
 * Installs this repository's git hooks by pointing core.hooksPath at .githooks,
 * which turns on the commit identity guard in scripts/check-commit-identity.mjs
 * for `git commit` and `git push` made from this clone.
 *
 *   pnpm hooks:install
 *
 * Deliberately explicit: pnpm does not run the root package's `prepare` or
 * `postinstall` on `pnpm install` (verified against pnpm 11.19.0, the version
 * this repository pins), so a lifecycle script here would be dead config that
 * only looks like protection.
 *
 * This script MUST NEVER fail. It runs from a package script, and this
 * repository has already lost a deploy to an install-time failure, so every
 * error path is swallowed and the exit code is always 0.
 *
 * Environments where hooks are pointless are skipped silently: CI and Vercel
 * check out source, they never make commits.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";

const HOOKS_PATH = ".githooks";
const HOOKS = ["commit-msg", "pre-push"];
const SKIP = ["CI", "GITHUB_ACTIONS", "VERCEL", "MUN_SKIP_HOOK_INSTALL"];
const isUnset = (value) => value.trim() === "";

const git = (...args) =>
  execFileSync("git", ["--no-pager", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const main = () => {
  const skip = SKIP.find((name) => process.env[name]);
  if (skip) {
    console.log(`hooks:install: skipped (${skip} is set; no commits happen here)`);
    return;
  }

  if (git("rev-parse", "--is-inside-work-tree").trim() !== "true") {
    console.log("hooks:install: skipped (not inside a git work tree)");
    return;
  }

  const missing = HOOKS.filter((hook) => !existsSync(`${HOOKS_PATH}/${hook}`));
  if (missing.length > 0) {
    console.log(`hooks:install: skipped (missing ${missing.map((h) => `${HOOKS_PATH}/${h}`).join(", ")})`);
    return;
  }

  for (const hook of HOOKS) {
    try {
      chmodSync(`${HOOKS_PATH}/${hook}`, 0o755); // git runs hooks only if they are executable
    } catch {
      // A filesystem without POSIX modes (Windows): git uses the file as-is.
    }
  }

  let configured = "";
  try {
    configured = git("config", "--get", "core.hooksPath").trim();
  } catch {
    configured = "";
  }

  if (configured === HOOKS_PATH) {
    console.log(`hooks:install: already installed (core.hooksPath=${HOOKS_PATH})`);
    return;
  }
  if (!isUnset(configured)) {
    // Never clobber someone else's hook manager (husky, lefthook, ...).
    console.log(
      `hooks:install: NOT installed - core.hooksPath is already '${configured}'.\n` +
        `  Point it at ${HOOKS_PATH} yourself, or copy ${HOOKS_PATH}/commit-msg and\n` +
        `  ${HOOKS_PATH}/pre-push into '${configured}'.`,
    );
    return;
  }

  git("config", "core.hooksPath", HOOKS_PATH);
  console.log(
    `hooks:install: installed core.hooksPath=${HOOKS_PATH} (commit identity guard active\n` +
      `  for git commit and git push in this clone; CI enforces the same policy regardless)`,
  );
};

try {
  main();
} catch (error) {
  // Informational only: a hook installer must never be able to break an install.
  console.log(`hooks:install: skipped (${`${error.message}`.split("\n")[0]})`);
}

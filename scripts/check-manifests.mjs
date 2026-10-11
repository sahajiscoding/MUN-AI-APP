#!/usr/bin/env node
/**
 * Manifest tripwire for the pnpm/Vercel build path.
 *
 * `pnpm install` parses pnpm-workspace.yaml before it resolves a single
 * dependency, and it hard-fails on duplicated mapping keys:
 *
 *   [ERROR] duplicated mapping key (21:3)   ->   `pnpm install` exits 1
 *
 * Vercel installs dependencies ahead of `next build`, so one duplicated key
 * takes down every deployment before any application code is compiled. That is
 * how the deploy broke once already: a branch had added a `source-map-js`
 * override, main added the same override with different wording, and git
 * auto-merged both blocks because the text differed while the meaning did not.
 * The result read as a plausible file to a human but not to a YAML parser.
 *
 * This check is deliberately dependency-free, because the workflow that runs it
 * (dependency-audit) installs nothing. It therefore uses a small strict scanner
 * rather than a real YAML parser, and it covers the failure classes that have
 * actually shipped here:
 *
 *   1. duplicated mapping keys in pnpm-workspace.yaml (breaks `pnpm install`)
 *   2. leftover merge-conflict markers in either manifest (breaks every tool)
 *
 * It also reports duplicated keys in package.json. Those are *silent*: both
 * `JSON.parse` and pnpm keep the last occurrence, so a second `dependencies`
 * block would quietly install different versions than the file appears to pin,
 * and no other gate in this repository would notice.
 *
 * Limits, stated honestly: this scans block-style YAML mappings and detects
 * keys nested by indentation, which is all pnpm-workspace.yaml uses. It skips
 * sequence entries (`- ...`) and flow-style collections (`{...}`/`[...]`) and
 * treats block-scalar bodies (`|`, `>`) as text. It is a tripwire for the
 * mappings this repository actually writes, not a general YAML validator.
 *
 * Run it from the repository root:  pnpm check:manifests
 * (or directly:  node scripts/check-manifests.mjs)
 */
import { readFileSync } from "node:fs";

const problems = [];

/** Indentation width, counted in characters (both manifests are ASCII-indented). */
const indentOf = (line) => line.length - line.trimStart().length;

/** `<<<<<<< HEAD`, `=======`, `>>>>>>> other` left behind by a sloppy merge. */
const CONFLICT_MARKER = /^(<{7}|={7}|>{7})(\s|$)/;

/** A block-style YAML mapping entry: optional quoted key, colon, value or EOL. */
const YAML_MAPPING =
  /^(?:([^:#'"][^:]*?)|'((?:[^']|'')*)'|"((?:[^"\\]|\\.)*)"):(?:[ \t]|$)/;

function checkConflictMarkers(name, source) {
  if (source === null) return;
  source.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (CONFLICT_MARKER.test(trimmed)) {
      problems.push(
        `${name}:${index + 1}: leftover merge-conflict marker "${trimmed}" — ` +
          `resolve the merge; this file cannot be parsed while the marker is present`
      );
    }
  });
}

/**
 * Duplicated mapping keys anywhere in a block-style YAML file.
 *
 * Keys are grouped by the mapping they belong to, tracked as a stack keyed by
 * indentation, so the same name is allowed in unrelated mappings (`ignore:`
 * under two different parents) and rejected only when it repeats in one.
 */
function checkYamlDuplicateKeys(name, source) {
  if (source === null) return;

  const mappings = []; // innermost last: { indent, seen: Map<key, lineNumber> }
  let blockScalarIndent = null; // indent of a `|`/`>` key whose body is plain text

  source.split(/\r?\n/).forEach((raw, index) => {
    const lineNumber = index + 1;
    const trimmed = raw.trim();
    const indent = indentOf(raw);

    if (trimmed === "") return;

    // Body of a block scalar: more-indented text, never a mapping key.
    if (blockScalarIndent !== null && indent > blockScalarIndent) return;
    blockScalarIndent = null;

    if (trimmed.startsWith("#")) return;

    const match = YAML_MAPPING.exec(trimmed);
    if (!match) return; // sequence entries and flow collections are out of scope

    let key;
    if (match[1] !== undefined) key = match[1].trimEnd();
    else if (match[2] !== undefined) key = match[2].replace(/''/g, "'");
    else {
      try {
        key = JSON.parse(`"${match[3]}"`);
      } catch {
        key = match[3];
      }
    }

    const value = trimmed.slice(match[0].length).trim();
    if (value.startsWith("|") || value.startsWith(">")) blockScalarIndent = indent;

    while (mappings.length > 0 && indent < mappings.at(-1).indent) {
      mappings.pop();
    }
    if (mappings.length === 0 || indent > mappings.at(-1).indent) {
      mappings.push({ indent, seen: new Map() });
    }

    const current = mappings.at(-1);
    const firstSeen = current.seen.get(key);
    if (firstSeen !== undefined) {
      problems.push(
        `${name}:${lineNumber}: duplicated mapping key "${key}" ` +
          `(first defined on line ${firstSeen}) — pnpm exits 1 with ` +
          `"[ERROR] duplicated mapping key" and the Vercel build never starts`
      );
    } else {
      current.seen.set(key, lineNumber);
    }
  });
}

/**
 * Duplicated keys in the same JSON object. `JSON.parse` keeps the last one
 * silently, so this class of typo is invisible to every other check.
 *
 * Keys are recognised as string literals that are followed by `:` and preceded
 * by `{` or `,`, which is exact for input already validated by `JSON.parse`.
 */
function checkJsonDuplicateKeys(name, source) {
  if (source === null) return;

  try {
    JSON.parse(source);
  } catch (error) {
    problems.push(`${name}: not valid JSON — ${error.message}`);
    return;
  }

  const lineAt = (offset) => source.slice(0, offset).split("\n").length;
  const objects = []; // { seen: Map<key, lineNumber> }, innermost last
  let inString = false;
  let stringStart = 0;
  let escaped = false;
  let previousSignificant = "";

  for (let index = 0; index < source.length; index += 1) {
    const character = source.charAt(index);

    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') {
        inString = false;
        let lookahead = index + 1;
        while (lookahead < source.length && /\s/.test(source.charAt(lookahead))) lookahead += 1;
        const isKey = source.charAt(lookahead) === ":" &&
          (previousSignificant === "{" || previousSignificant === ",");
        if (isKey && objects.length > 0) {
          let key;
          try {
            key = JSON.parse(source.slice(stringStart, index + 1));
          } catch {
            key = source.slice(stringStart + 1, index);
          }
          const current = objects.at(-1);
          const firstSeen = current.seen.get(key);
          if (firstSeen !== undefined) {
            problems.push(
              `${name}:${lineAt(stringStart)}: duplicated key "${key}" in the same ` +
                `object (first defined on line ${firstSeen}) — the last occurrence silently ` +
                `wins, so the file does not pin what it appears to pin`
            );
          } else {
            current.seen.set(key, lineAt(stringStart));
          }
        }
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      stringStart = index;
      continue;
    }
    if (character === "{" || character === "[") {
      objects.push({ seen: new Map() });
      previousSignificant = character;
      continue;
    }
    if (character === "}" || character === "]") {
      objects.pop();
      previousSignificant = character;
      continue;
    }
    if (/\s/.test(character)) continue;
    previousSignificant = character;
  }
}

// Both reads below deliberately spell out a literal, repo-root-relative path
// rather than resolving a computed file name: a manifest tripwire must not look
// up files dynamically itself. Run this check from the repository root
// (`pnpm check:manifests` does that for you); the error below says so if the
// manifests cannot be found.
let workspaceManifest = null;
let packageManifest = null;

try {
  workspaceManifest = readFileSync("pnpm-workspace.yaml", "utf8");
} catch (error) {
  problems.push(
    `pnpm-workspace.yaml: unreadable (${error.code ?? error.message}) — run this check ` +
      `from the repository root, or use \`pnpm check:manifests\``
  );
}

try {
  packageManifest = readFileSync("package.json", "utf8");
} catch (error) {
  problems.push(
    `package.json: unreadable (${error.code ?? error.message}) — run this check ` +
      `from the repository root, or use \`pnpm check:manifests\``
  );
}

checkConflictMarkers("pnpm-workspace.yaml", workspaceManifest);
checkConflictMarkers("package.json", packageManifest);
checkYamlDuplicateKeys("pnpm-workspace.yaml", workspaceManifest);
checkJsonDuplicateKeys("package.json", packageManifest);

if (problems.length > 0) {
  for (const problem of problems) console.error(`FAIL: ${problem}`);
  console.error(
    `\n${problems.length} manifest problem(s) found. Fix them before pushing: the deploy ` +
      `cannot get past \`pnpm install --frozen-lockfile\` while they stand.`
  );
  process.exit(1);
}

console.log(
  "Manifests OK: pnpm-workspace.yaml has no duplicated mapping keys, " +
    "package.json has no duplicated keys, no merge-conflict markers in either."
);

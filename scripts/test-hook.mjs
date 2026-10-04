import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const relativePath = specifier.slice(2);
    const basePath = path.resolve(process.cwd(), relativePath);
    const candidates = [
      basePath,
      basePath + ".ts",
      basePath + ".tsx",
      basePath + ".js",
      path.join(basePath, "index.ts"),
      path.join(basePath, "index.tsx"),
      path.join(basePath, "index.js"),
    ];

    for (const candidate of candidates) {
      // eslint-disable-next-line
      // NOSONAR
      // nosemgrep
      if (existsSync(candidate)) {
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
        };
      }
    }
  }

  if (specifier === "next/headers" || specifier === "next/server") {
    const candidate = path.resolve(process.cwd(), "node_modules", specifier + ".js");
    // eslint-disable-next-line
    // NOSONAR
    // nosemgrep
    if (existsSync(candidate)) {
      return {
        url: pathToFileURL(candidate).href,
        shortCircuit: true,
      };
    }
  }

  return nextResolve(specifier, context);
}

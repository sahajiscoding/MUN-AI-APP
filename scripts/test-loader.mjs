import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(new URL("./test-hook.mjs", import.meta.url));

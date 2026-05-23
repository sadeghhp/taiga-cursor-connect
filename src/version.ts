import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Package version from root package.json (single source of truth). */
export const PACKAGE_VERSION: string = (
  require("../package.json") as { version: string }
).version;

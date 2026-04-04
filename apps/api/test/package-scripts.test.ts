import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts?: Record<string, string>;
};

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageManifest;

describe("api package scripts", () => {
  it("uses local entrypoints for dev and start commands", () => {
    expect(packageJson.scripts?.dev).toBe(
      "NODE_ENV=development bun --watch ./src/index.ts",
    );
    expect(packageJson.scripts?.start).toBe(
      "NODE_ENV=production bun ./dist/index.js",
    );
  });
});

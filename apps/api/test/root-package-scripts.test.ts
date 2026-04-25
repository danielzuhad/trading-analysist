import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts?: Record<string, string>;
};

const packageJson = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
) as PackageManifest;

describe("root package scripts", () => {
  it("uses cross-platform turbo wrapper scripts for validation commands", () => {
    expect(packageJson.scripts?.build).toBe("node scripts/run-turbo.mjs build");
    expect(packageJson.scripts?.lint).toBe("node scripts/run-turbo.mjs lint");
    expect(packageJson.scripts?.typecheck).toBe(
      "node scripts/run-turbo.mjs typecheck",
    );
    expect(packageJson.scripts?.test).toBe("node scripts/run-turbo.mjs test");
  });

  it("does not use Bash-only parameter expansion in root scripts", () => {
    for (const script of Object.values(packageJson.scripts ?? {})) {
      expect(script).not.toContain("${");
    }
  });
});

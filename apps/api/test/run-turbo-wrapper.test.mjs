import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTurboBin } from "../../../scripts/run-turbo.mjs";

describe("run-turbo wrapper", () => {
  it("prefers Bun's Windows turbo.exe shim over turbo.cmd", () => {
    const repoRoot = "D:\\Projects\\solva\\trading-analyst";
    const turboExe = path.win32.join(
      repoRoot,
      "node_modules",
      ".bin",
      "turbo.exe",
    );
    const turboCmd = path.win32.join(
      repoRoot,
      "node_modules",
      ".bin",
      "turbo.cmd",
    );

    expect(
      resolveTurboBin({
        exists: (candidate) => candidate === turboExe || candidate === turboCmd,
        platform: "win32",
        repoRoot,
      }),
    ).toBe(turboExe);
  });
});

#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function resolveRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

export function resolveTurboBin({
  exists = existsSync,
  platform = process.platform,
  repoRoot = resolveRepoRoot(),
} = {}) {
  const pathApi = platform === "win32" ? path.win32 : path;
  const localBinDir = pathApi.join(repoRoot, "node_modules", ".bin");
  const localBinNames =
    platform === "win32" ? ["turbo.exe", "turbo.cmd"] : ["turbo"];

  for (const binName of localBinNames) {
    const candidate = pathApi.join(localBinDir, binName);

    if (exists(candidate)) {
      return candidate;
    }
  }

  return platform === "win32" ? "turbo.exe" : "turbo";
}

function main(argv = process.argv.slice(2)) {
  const [task, ...rawArgs] = argv;

  if (!task) {
    console.error(
      "Usage: node scripts/run-turbo.mjs <task> [--node-env value] [-- ...args]",
    );
    process.exit(1);
  }

  const env = { ...process.env };
  const passThroughArgs = [];

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--node-env") {
      const value = rawArgs[index + 1];

      if (!value) {
        console.error("--node-env requires a value.");
        process.exit(1);
      }

      env.NODE_ENV = value;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--node-env=")) {
      env.NODE_ENV = arg.slice("--node-env=".length);
      continue;
    }

    passThroughArgs.push(arg);
  }

  const cacheDir =
    env.TURBO_CACHE_DIR ??
    (process.platform === "win32"
      ? path.join(os.tmpdir(), "trading-analyst-turbo")
      : "/tmp/turbo");

  if (task === "test") {
    const defaultTempDir = process.platform === "win32" ? os.tmpdir() : "/tmp";

    env.TMPDIR ??= defaultTempDir;
    env.TEMP ??= defaultTempDir;
    env.TMP ??= defaultTempDir;
  }

  mkdirSync(cacheDir, { recursive: true });

  const turboBin = resolveTurboBin();
  const turboArgs =
    task === "dev"
      ? ["dev", ...passThroughArgs]
      : [
          "run",
          task,
          "--cache=local:r,remote:r",
          "--cache-dir",
          cacheDir,
          ...passThroughArgs,
        ];

  const child = spawn(turboBin, turboArgs, {
    env,
    shell: process.platform === "win32" && turboBin.endsWith(".cmd"),
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(error.message);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`turbo exited with signal ${signal}`);
      process.exit(1);
    }

    process.exit(code ?? 1);
  });
}

function isMainModule() {
  if (!process.argv[1]) {
    return false;
  }

  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isMainModule()) {
  main();
}

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import {
  KOREAN_DISTRIBUTION_ID,
  koreanDesktopConfig,
  koreanReleaseConfig,
  upstreamVersion,
} from "./desktop-config.mjs";

const base = JSON.parse(
  readFileSync(
    new URL("../../src-tauri/tauri.conf.json", import.meta.url),
    "utf8",
  ),
);

it("keeps the Korean storage, product name and scheme together", () => {
  expect(KOREAN_DISTRIBUTION_ID).toBe("ai.codepair.buzz-korean");
  for (const development of [false, true]) {
    const config = koreanDesktopConfig(KOREAN_DISTRIBUTION_ID, {
      development,
    });
    expect(config.identifier).toBe(
      `ai.codepair.buzz-korean${development ? ".dev" : ""}`,
    );
    expect(config.productName).toBe("Buzz Korean");
    expect(config.plugins["deep-link"].desktop.schemes).toEqual([
      "buzz-ai.codepair.buzz-korean",
    ]);
    expect(config).not.toHaveProperty("build");
    expect(config).not.toHaveProperty("plugins.updater");
  }
});

it("rejects official, empty, path-shaped or malformed IDs", () => {
  for (const id of [
    "",
    "../other",
    "example",
    "example..org",
    "-example.org",
    "example-.org",
    "Example.org",
    "example.org/child",
    "example.한국",
    "xyz.block.buzz",
    "xyz.block.buzz.desktop",
    "dev.local.buzz.foundation",
    "a".repeat(129),
  ])
    expect(() => koreanDesktopConfig(id)).toThrow(/distribution ID/);
});

it("reads the app version from the upstream release tag", () => {
  expect(upstreamVersion({ tag: "v1.0.5" })).toBe("1.0.5");
  for (const lock of [{}, { tag: "main" }, { tag: "v1.0" }, null])
    expect(() => upstreamVersion(lock)).toThrow(/release tag/);
});

it("builds a release overlay with the updater off and the window titled", () => {
  const { config, environment } = koreanReleaseConfig({
    base,
    version: "1.0.5",
  });
  expect(environment).toEqual({
    BUZZ_DISTRIBUTION_ID: "ai.codepair.buzz-korean",
  });
  expect(Object.keys(environment).some((key) => key.includes("UPDATER"))).toBe(
    false,
  );
  expect(config.identifier).toBe("ai.codepair.buzz-korean");
  expect(config.version).toBe("1.0.5");
  expect(config.plugins).not.toHaveProperty("updater");
  expect(config.bundle.createUpdaterArtifacts).toBe(false);
  expect(config.app.windows).toHaveLength(base.app.windows.length);
  expect(config.app.windows[0]).toEqual({
    ...base.app.windows[0],
    title: "Buzz Korean 1.0.5",
  });
});

it("rejects invalid native build inputs at compile time", () => {
  const root = mkdtempSync(join(tmpdir(), "buzz-distribution-profile-"));
  try {
    for (const id of [
      undefined,
      "ai.codepair.buzz-korean",
      "",
      "../other",
      "xyz.block.buzz.desktop",
    ]) {
      const env = { ...process.env };
      if (id === undefined) delete env.BUZZ_DISTRIBUTION_ID;
      else env.BUZZ_DISTRIBUTION_ID = id;
      const result = spawnSync(
        "rustc",
        [
          "--edition=2021",
          "--crate-type=lib",
          "--emit=metadata",
          fileURLToPath(
            new URL(
              "../../crates/credential-store/src/distribution.rs",
              import.meta.url,
            ),
          ),
          "-o",
          join(root, "profile.rmeta"),
        ],
        { env, encoding: "utf8", timeout: 15000, maxBuffer: 512 * 1024 },
      );
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(
        id === undefined || id === "ai.codepair.buzz-korean" ? 0 : 1,
      );
      if (result.status !== 0)
        expect(result.stderr).toMatch(
          /Invalid distribution ID|belongs to official Buzz/,
        );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30000);

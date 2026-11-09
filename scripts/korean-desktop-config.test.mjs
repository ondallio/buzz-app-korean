import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { koreanDesktopConfig } from "./korean-desktop-config.mjs";

it("keeps distributor storage and product identity together without changing canonical links", () => {
  const id = "io.github.ondallio.buzz-korean-beta";
  for (const development of [false, true]) {
    const config = koreanDesktopConfig(id, { development });
    expect(config.identifier).toBe(`${id}${development ? ".dev" : ""}`);
    expect(config.productName).toBe("Buzz Korean Beta");
    expect(config.plugins["deep-link"].desktop.schemes).toEqual([`buzz-${id}`]);
    expect(config).not.toHaveProperty("build");
    expect(config).not.toHaveProperty("plugins.updater");
  }
});

it("rejects official, empty, path-shaped or malformed IDs rather than selecting an official fallback", () => {
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
  ]) {
    expect(() => koreanDesktopConfig(id)).toThrow(/distribution ID/);
  }
  expect(koreanDesktopConfig("org.example.buzz-beta").identifier).toBe(
    "org.example.buzz-beta",
  );
});

it("rejects invalid native build inputs at compile time independently of the JS config helper", () => {
  const root = mkdtempSync(join(tmpdir(), "buzz-distribution-profile-"));
  try {
    for (const id of [
      undefined,
      "org.example.buzz-beta",
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
              "../crates/credential-store/src/distribution.rs",
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
        id === undefined || id === "org.example.buzz-beta" ? 0 : 1,
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

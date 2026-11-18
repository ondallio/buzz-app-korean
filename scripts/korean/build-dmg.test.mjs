import { expect, it } from "vitest";
import { buildEnvironment, tauriArguments } from "./build-dmg.mjs";
import { koreanReleaseConfig } from "./desktop-config.mjs";

it("drops signing, updater and development inputs and adds the distribution ID", () => {
  const release = koreanReleaseConfig({ version: "1.0.5" });
  const environment = buildEnvironment(
    {
      PATH: "/usr/bin",
      HOME: "/home/user",
      BUZZ_UPDATER_PUBLIC_KEY: "key",
      BUZZ_UPDATER_ENDPOINT: "https://example.org",
      TAURI_SIGNING_PRIVATE_KEY: "secret",
      APPLE_SIGNING_IDENTITY: "identity",
      BUZZ_DEV_CREDENTIAL_HELPER: "/helper",
      BUZZ_DEV_RELEASE_KEY: "1",
      BUZZODZ_HOME: "/other",
      BUZZ_DISTRIBUTION_ID: "org.example.other",
    },
    release,
  );
  expect(environment).toEqual({
    PATH: "/usr/bin",
    HOME: "/home/user",
    BUZZ_DISTRIBUTION_ID: "ai.codepair.buzz-korean",
    CI: "true",
  });
});

it("builds unsigned Apple Silicon app and DMG bundles with the locked lockfile", () => {
  const args = tauriArguments(".local/korean-builds/run/release.json");
  expect(args).toContain("--no-sign");
  expect(
    args.slice(args.indexOf("--bundles"), args.indexOf("--bundles") + 2),
  ).toEqual(["--bundles", "app,dmg"]);
  expect(args).toContain("aarch64-apple-darwin");
  expect(args.at(-1)).toBe("--locked");
});

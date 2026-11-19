import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  buildEnvironment,
  dmgName,
  macosConfig,
  releaseAsset,
  releaseFields,
  TARGET,
  tauriArguments,
  writeGithubOutput,
} from "./build-dmg.mjs";
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

it("builds Apple Silicon app and DMG bundles with the locked lockfile", () => {
  const args = tauriArguments(".local/korean-builds/run/release.json");
  expect(args).not.toContain("--no-sign");
  expect(
    args.slice(args.indexOf("--bundles"), args.indexOf("--bundles") + 2),
  ).toEqual(["--bundles", "app,dmg"]);
  expect(args).toContain("aarch64-apple-darwin");
  expect(args.at(-1)).toBe("--locked");
});

it("ad-hoc signs the bundle without dropping other bundle settings", () => {
  const { config } = koreanReleaseConfig({ version: "1.0.5" });
  const signed = macosConfig(config);
  expect(signed.bundle.macOS.signingIdentity).toBe("-");
  expect(signed.bundle.createUpdaterArtifacts).toBe(false);
  expect(signed.identifier).toBe(config.identifier);
});

it("names the DMG and a space-free release asset", () => {
  const config = { productName: "Buzz Korean", version: "1.0.5" };
  expect(TARGET).toBe("aarch64-apple-darwin");
  expect(dmgName(config)).toBe("Buzz Korean_1.0.5_aarch64.dmg");
  expect(releaseAsset(dmgName(config))).toBe("Buzz.Korean_1.0.5_aarch64.dmg");
});

it("reports the Korean identity for the workflow checks", () => {
  const { config } = koreanReleaseConfig({ version: "1.0.5" });
  expect(releaseFields(config)).toEqual({
    version: "1.0.5",
    productName: "Buzz Korean",
    identifier: "ai.codepair.buzz-korean",
    scheme: "buzz-ai.codepair.buzz-korean",
  });
});

it("appends step outputs only when GitHub Actions provides a file", () => {
  const directory = mkdtempSync(join(tmpdir(), "korean-output-"));
  try {
    const file = join(directory, "output");
    writeGithubOutput({ dmg: "/a/Buzz Korean_1.0.5_aarch64.dmg" }, file);
    writeGithubOutput({ version: "1.0.5" }, file);
    expect(readFileSync(file, "utf8")).toBe(
      "dmg=/a/Buzz Korean_1.0.5_aarch64.dmg\nversion=1.0.5\n",
    );
    expect(() => writeGithubOutput({ x: "a\nb=c" }, file)).toThrow();
    expect(() => writeGithubOutput({ x: "y" }, undefined)).not.toThrow();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

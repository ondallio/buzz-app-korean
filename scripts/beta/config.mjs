import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { koreanDesktopConfig } from "../korean-desktop-config.mjs";
import { validateChannel } from "./policy.mjs";

/** Public release overlay and matching compile inputs; never launches or signs an app. */
export function betaReleaseConfig(channel) {
  validateChannel(channel);
  const config = koreanDesktopConfig(channel.identifier);
  return {
    config: {
      ...config,
      version: channel.version,
      bundle: { createUpdaterArtifacts: true },
      plugins: {
        ...config.plugins,
        updater: { pubkey: channel.publicKey, endpoints: [channel.endpoint] },
      },
    },
    environment: {
      BUZZ_DISTRIBUTION_ID: channel.identifier,
      BUZZ_UPDATER_PUBLIC_KEY: channel.publicKey,
      BUZZ_UPDATER_ENDPOINT: channel.endpoint,
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 2, "Usage: config.mjs");
  const channel = JSON.parse(
    await readFile(new URL("../../beta-channel.json", import.meta.url), "utf8"),
  );
  console.log(JSON.stringify(betaReleaseConfig(channel), null, 2));
}

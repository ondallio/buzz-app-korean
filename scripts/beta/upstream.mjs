import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  loadPreview,
  previewParts,
  readPreviewFeed,
  validateChannel,
  validatePublishedPreview,
} from "./policy.mjs";

/** Discover a verified official preview; never port code or change the saved pin. */
export async function discoverUpstream(channel, download = fetch) {
  validateChannel(channel);
  const feed = await readPreviewFeed(download);
  const tag = `v${feed.version}`;
  const latest = previewParts(tag);
  const pinned = previewParts(channel.source.tag);
  let order = 0;
  for (let index = 0; index < latest.length; index++) {
    if (latest[index] === pinned[index]) continue;
    order = latest[index] > pinned[index] ? 1 : -1;
    break;
  }
  assert.ok(order >= 0, "Official preview feed moved backward");
  const data = await loadPreview(tag, download, feed);
  const available = validatePublishedPreview(
    { repository: channel.source.repository, tag, commit: data.commit },
    channel.platform,
    data.release,
    data.commit,
    data.sourceText,
    data.feed,
  );
  if (order === 0)
    assert.equal(
      available.commit,
      channel.source.commit,
      "Pinned official tag was retargeted",
    );
  return {
    pinned: { ...channel.source },
    available,
    updateAvailable: order > 0,
    sourceChanged: available.commit !== channel.source.commit,
    needsReview: order > 0,
    scope:
      "discovery only; no source integration, build, signing, publication or app update",
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 2, "Usage: upstream.mjs");
  const channel = JSON.parse(
    await readFile(new URL("../../beta-channel.json", import.meta.url), "utf8"),
  );
  console.log(JSON.stringify(await discoverUpstream(channel), null, 2));
}

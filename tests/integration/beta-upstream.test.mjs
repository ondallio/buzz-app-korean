import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { discoverUpstream } from "../../scripts/beta/upstream.mjs";

const channel = JSON.parse(
  await readFile(new URL("../../beta-channel.json", import.meta.url), "utf8"),
);
function fixture({
  tag = channel.source.tag,
  commit = channel.source.commit,
  source = commit,
  annotated = false,
  feedPatch = {},
  releasePatch = {},
} = {}) {
  const base = `https://github.com/block/buzz-app/releases/download/${tag}`;
  const name = `Buzz_${tag.slice(1)}_aarch64.app.tar.gz`;
  const feed = {
    version: tag.slice(1),
    platforms: {
      "darwin-aarch64": { url: `${base}/${name}`, signature: "fixture" },
    },
    ...feedPatch,
  };
  const release = {
    tag_name: tag,
    draft: false,
    prerelease: true,
    published_at: "2026-11-09T01:21:07Z",
    html_url: `https://github.com/block/buzz-app/releases/tag/${tag}`,
    assets: [
      { name: "SOURCE_COMMIT", browser_download_url: `${base}/SOURCE_COMMIT` },
      { name, browser_download_url: `${base}/${name}` },
    ],
    ...releasePatch,
  };
  const calls = [];
  return {
    calls,
    download: async (url) => {
      calls.push(url);
      if (url.endsWith("/latest.json"))
        return new Response(JSON.stringify(feed));
      if (url.endsWith("/SOURCE_COMMIT")) return new Response(`${source}\n`);
      if (url.includes("/git/ref/"))
        return new Response(
          JSON.stringify({
            object: { type: annotated ? "tag" : "commit", sha: commit },
          }),
        );
      if (url.includes("/git/tags/"))
        return new Response(
          JSON.stringify({ object: { type: "commit", sha: commit } }),
        );
      if (url.includes("/releases/tags/"))
        return new Response(JSON.stringify(release));
      throw new Error("Unexpected public request");
    },
  };
}

test("reports unchanged official source and leaves the pin untouched", async () => {
  const f = fixture();
  const before = JSON.stringify(channel);
  const result = await discoverUpstream(channel, f.download);
  assert.equal(result.updateAvailable, false);
  assert.equal(result.sourceChanged, false);
  assert.equal(result.needsReview, false);
  assert.equal(result.available.commit, channel.source.commit);
  assert.equal(result.pinned.commit, channel.source.commit);
  assert.equal(f.calls.length, 4);
  assert.equal(JSON.stringify(channel), before);
});

test("distinguishes a new source from a new tag rebuilding the same source", async () => {
  for (const commit of [channel.source.commit, "a".repeat(40)]) {
    const f = fixture({ tag: "v0.7.0-preview.261.1", commit });
    const result = await discoverUpstream(channel, f.download);
    assert.equal(result.updateAvailable, true);
    assert.equal(result.sourceChanged, commit !== channel.source.commit);
    assert.equal(result.needsReview, true);
  }
});

test("discovers a new base version without rewriting the Korean build version", async () => {
  const f = fixture({
    tag: "v0.8.0-preview.1.1",
    commit: "b".repeat(40),
    annotated: true,
  });
  const result = await discoverUpstream(channel, f.download);
  assert.equal(result.available.tag, "v0.8.0-preview.1.1");
  assert.equal(result.updateAvailable, true);
  assert.equal(channel.version, "0.7.0-korean.2");
  assert.equal(f.calls.length, 5);
});

test("rejects rollback, moved tags and inconsistent or unpublished receipts", async () => {
  for (const options of [
    { tag: "v0.7.0-preview.257.9" },
    { commit: "c".repeat(40) },
    { source: "d".repeat(40) },
    { tag: "v0.7.0-preview.261.1", releasePatch: { draft: true } },
    { feedPatch: { version: "0.7.0-preview.0259.1" } },
    { feedPatch: { version: "../main" } },
    { feedPatch: { version: "0.7.0" } },
  ])
    await assert.rejects(discoverUpstream(channel, fixture(options).download));
});

test("compares large numeric preview components without Number rounding", async () => {
  const pin = structuredClone(channel);
  pin.source.tag = "v0.7.0-preview.9007199254740992.1";
  const newer = fixture({ tag: "v0.7.0-preview.9007199254740993.1" });
  assert.equal(
    (await discoverUpstream(pin, newer.download)).updateAvailable,
    true,
  );
  const older = fixture({ tag: "v0.7.0-preview.9007199254740991.9" });
  await assert.rejects(discoverUpstream(pin, older.download), /backward/);
});

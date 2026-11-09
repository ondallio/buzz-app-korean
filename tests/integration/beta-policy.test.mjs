import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  checkUpstream,
  readPublic,
  validateChannel,
  validateUpstream,
} from "../../scripts/beta/policy.mjs";
import { betaReleaseConfig } from "../../scripts/beta/config.mjs";

const channel = JSON.parse(
  await readFile(new URL("../../beta-channel.json", import.meta.url), "utf8"),
);
const tag = channel.source.tag;
const version = tag.slice(1);
const base = `https://github.com/block/buzz-app/releases/download/${tag}`;
const archive = `${base}/Buzz_${version}_aarch64.app.tar.gz`;
const release = {
  tag_name: tag,
  draft: false,
  prerelease: true,
  published_at: "2026-11-09T01:21:07Z",
  html_url: `https://github.com/block/buzz-app/releases/tag/${tag}`,
  assets: [
    { name: "SOURCE_COMMIT", browser_download_url: `${base}/SOURCE_COMMIT` },
    {
      name: `Buzz_${version}_aarch64.app.tar.gz`,
      browser_download_url: archive,
    },
  ],
};
const feed = {
  version,
  platforms: {
    "darwin-aarch64": { url: archive, signature: "public-signature-fixture" },
  },
};
const clone = (value) => structuredClone(value);
const validate = (
  r = release,
  sha = channel.source.commit,
  source = `${sha}\n`,
  f = feed,
) => validateUpstream(channel, r, sha, source, f);

test("keeps the official baseline and Korean release coordinates separate", () => {
  assert.deepEqual(validateChannel(channel), channel);
  assert.equal(validate().commit, channel.source.commit);
  assert.equal(validate().tag, tag);
  assert.equal(validate().archive, archive);
});

test("rejects invalid or foreign channel coordinates without echoing their values", () => {
  for (const [key, value] of [
    ["repository", "other/repo"],
    ["identifier", "xyz.block.buzz.desktop"],
    ["platform", "windows-x86_64"],
    [
      "endpoint",
      "https://github.com/block/buzz-app/releases/download/preview-feed/latest.json",
    ],
    ["publicKey", "private-value-must-not-be-echoed"],
    ["version", "0.7.0"],
    ["version", "0.7.0-korean.01"],
    ["version", "0.8.0-korean.1"],
    ["privateKey", "private-value-must-not-be-echoed"],
  ]) {
    const bad = { ...channel, [key]: value };
    assert.throws(
      () => validateChannel(bad),
      (error) =>
        error instanceof Error && !error.message.includes("private-value"),
    );
  }
  for (const source of [
    { ...channel.source, repository: "block/buzz" },
    { ...channel.source, commit: "../main" },
    { ...channel.source, tag: "v0.7.0-preview.01.1" },
    { ...channel.source, tag: "../main" },
    { ...channel.source, extra: "secret" },
  ])
    assert.throws(() => validateChannel({ ...channel, source }));
});

test("rejects retargeted, unpublished, foreign or incomplete official inputs", () => {
  for (const patch of [
    { draft: true },
    { prerelease: false },
    { published_at: null },
    { published_at: "invalid" },
    { tag_name: "v0.7.0-preview.259.1" },
    { html_url: "https://example.org/release" },
    { assets: [] },
    { assets: [...release.assets, release.assets[0]] },
  ])
    assert.throws(() => validate({ ...release, ...patch }));
  assert.throws(() => validate(release, "a".repeat(40)));
  assert.throws(() => validate(release, channel.source.commit, "a".repeat(40)));
  const foreign = clone(release);
  foreign.assets[1].browser_download_url = `${archive}?other=1`;
  assert.throws(() => validate(foreign));
  const wrong = clone(feed);
  wrong.platforms["darwin-aarch64"].url = "https://example.org/app.tar.gz";
  assert.throws(() =>
    validate(
      release,
      channel.source.commit,
      `${channel.source.commit}\n`,
      wrong,
    ),
  );
  assert.throws(() =>
    validate(release, channel.source.commit, `${channel.source.commit}\n`, {
      ...feed,
      version: "0.7.0-preview.259.1",
    }),
  );
});

test("binds release, tag, source receipt and preview feed in the real checker", async () => {
  const seen = [];
  const download = async (url, options) => {
    seen.push(url);
    assert.equal(options.redirect, "manual");
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.Authorization, undefined);
    const data = url.endsWith("/SOURCE_COMMIT")
      ? `${channel.source.commit}\n`
      : JSON.stringify(
          url.includes("/git/ref/")
            ? { object: { type: "commit", sha: channel.source.commit } }
            : url.endsWith("/latest.json")
              ? feed
              : release,
        );
    return new Response(data);
  };
  const before = JSON.stringify(channel);
  assert.equal(
    (await checkUpstream(channel, download)).commit,
    channel.source.commit,
  );
  assert.equal(seen.length, 4);
  assert.equal(JSON.stringify(channel), before);
  assert.ok(
    seen.every(
      (url) =>
        url.startsWith("https://api.github.com/repos/block/buzz-app/") ||
        url.startsWith("https://github.com/block/buzz-app/releases/download/"),
    ),
  );
  await assert.rejects(
    checkUpstream(channel, async () => new Response("denied", { status: 403 })),
    /HTTP 403/,
  );
});

test("bounds public responses and refuses redirects and unexpected hosts", async () => {
  const url = "https://api.github.com/repos/block/buzz-app/releases";
  await assert.rejects(
    readPublic("https://example.org/file", async () => new Response("ok")),
    /URL/,
  );
  await assert.rejects(
    readPublic(url, async () => new Response("abc"), 2),
    /limit/,
  );
  await assert.rejects(
    readPublic(url, async () => new Response("", { status: 302 })),
    /HTTP 302/,
  );
  await assert.rejects(
    readPublic(
      url,
      async () => new Response("a", { headers: { "content-length": "300" } }),
      2,
    ),
    /limit/,
  );
});

test("follows only one official asset hop to the exact public release CDN", async () => {
  const url = `${base}/SOURCE_COMMIT`;
  const cdn =
    "https://release-assets.githubusercontent.com/github-production-release-asset/123/file?public=1";
  const calls = [];
  const text = await readPublic(url, async (request, options) => {
    calls.push(request);
    assert.equal(options.redirect, "manual");
    return request === url
      ? new Response(null, { status: 302, headers: { location: cdn } })
      : new Response("public receipt");
  });
  assert.equal(text, "public receipt");
  assert.deepEqual(calls, [url, cdn]);
  for (const location of [
    "https://example.org/file",
    "http://release-assets.githubusercontent.com/github-production-release-asset/123",
    "https://release-assets.githubusercontent.com:444/github-production-release-asset/123",
    "https://user@release-assets.githubusercontent.com/github-production-release-asset/123",
    "https://release-assets.githubusercontent.com/other/123",
  ]) {
    let count = 0;
    await assert.rejects(
      readPublic(url, async () => {
        count++;
        return new Response(null, { status: 302, headers: { location } });
      }),
      /redirect/,
    );
    assert.equal(count, 1);
  }
  let count = 0;
  await assert.rejects(
    readPublic(url, async () => {
      count++;
      return new Response(null, { status: 302, headers: { location: cdn } });
    }),
    /HTTP 302/,
  );
  assert.equal(count, 2);
});

test("generates an updater-enabled release overlay with matching public compile inputs", () => {
  const result = betaReleaseConfig(channel);
  assert.equal(result.config.identifier, channel.identifier);
  assert.equal(result.config.version, channel.version);
  assert.deepEqual(result.config.plugins.updater, {
    pubkey: channel.publicKey,
    endpoints: [channel.endpoint],
  });
  assert.deepEqual(result.config.plugins["deep-link"].desktop.schemes, [
    `buzz-${channel.identifier}`,
  ]);
  assert.equal(result.config.bundle.createUpdaterArtifacts, true);
  assert.deepEqual(result.environment, {
    BUZZ_DISTRIBUTION_ID: channel.identifier,
    BUZZ_UPDATER_PUBLIC_KEY: channel.publicKey,
    BUZZ_UPDATER_ENDPOINT: channel.endpoint,
  });
  assert.equal(result.config.build, undefined);
  assert.equal(result.config.bundle.macOS, undefined);
  assert.ok(!JSON.stringify(result).includes("PRIVATE_KEY"));
});

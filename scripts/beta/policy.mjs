import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const sourceRepo = "block/buzz-app";
const destination = "ondallio/buzz-app-korean";
const endpoint = `https://github.com/${destination}/releases/download/korean-beta-feed/latest.json`;
const officialFeed = `https://github.com/${sourceRepo}/releases/download/preview-feed/latest.json`;
const number = "(0|[1-9][0-9]*)";
const previewPattern = new RegExp(
  `^v${number}\\.${number}\\.${number}-preview\\.${number}\\.${number}$`,
);
const koreanPattern = new RegExp(
  `^${number}\\.${number}\\.${number}-korean\\.${number}$`,
);
const shaPattern = /^[a-f0-9]{40}$/;

function fields(value, expected) {
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    "Expected an object",
  );
  assert.deepEqual(
    Object.keys(value).sort(),
    [...expected].sort(),
    "Unexpected policy fields",
  );
}

/** Validate only public distributor inputs; reject extra fields instead of printing them. */
export function validateChannel(channel) {
  fields(channel, [
    "schemaVersion",
    "repository",
    "identifier",
    "platform",
    "version",
    "endpoint",
    "publicKey",
    "source",
  ]);
  assert.equal(channel.schemaVersion, 1, "Unsupported policy schema");
  assert.equal(
    channel.repository,
    destination,
    "Unexpected distributor repository",
  );
  assert.equal(
    channel.identifier,
    "io.github.ondallio.buzz-korean-beta",
    "Unexpected distributor ID",
  );
  assert.equal(
    channel.platform,
    "darwin-aarch64",
    "Unsupported Korean platform",
  );
  assert.equal(channel.endpoint, endpoint, "Unexpected Korean feed");
  fields(channel.source, ["repository", "tag", "commit"]);
  assert.equal(
    channel.source.repository,
    sourceRepo,
    "Unexpected source repository",
  );
  assert.ok(
    typeof channel.source.commit === "string" &&
      shaPattern.test(channel.source.commit),
    "Invalid source commit",
  );
  const source =
    typeof channel.source.tag === "string" &&
    previewPattern.exec(channel.source.tag);
  const version =
    typeof channel.version === "string" && koreanPattern.exec(channel.version);
  assert.ok(source && version, "Invalid source or Korean version");
  assert.deepEqual(
    source.slice(1, 4),
    version.slice(1, 4),
    "Source/Korean base version mismatch",
  );
  assert.ok(BigInt(version[4]) > 0n, "Korean build number must be positive");
  assert.ok(
    typeof channel.publicKey === "string" && channel.publicKey.length < 512,
    "Invalid updater public key",
  );
  // Audited public key from the existing dedicated Korean updater channel.
  assert.equal(
    createHash("sha256").update(channel.publicKey).digest("hex"),
    "e93a95850d5f3cc4c88d143a9c5b081b2934976fb8ab19b6fa12acc314b9d740",
    "Unexpected updater public key",
  );
  return channel;
}

/** Check provenance agreement, not the archive bytes, updater signature or CI status. */
export function validateUpstream(
  channel,
  release,
  tagCommit,
  sourceText,
  feed,
) {
  validateChannel(channel);
  return validatePublishedPreview(
    channel.source,
    channel.platform,
    release,
    tagCommit,
    sourceText,
    feed,
  );
}

/** Canonical official preview components, compared without floating-point rounding. */
export function previewParts(tag) {
  const match =
    typeof tag === "string" && tag.length <= 128 && previewPattern.exec(tag);
  assert.ok(match, "Unsupported official preview version");
  return match.slice(1).map(BigInt);
}

/** Validate an official coordinate independently of the Korean build's base version. */
export function validatePublishedPreview(
  source,
  platformName,
  release,
  tagCommit,
  sourceText,
  feed,
) {
  fields(source, ["repository", "tag", "commit"]);
  assert.equal(source.repository, sourceRepo, "Unexpected source repository");
  previewParts(source.tag);
  assert.ok(
    typeof source.commit === "string" && shaPattern.test(source.commit),
    "Invalid source commit",
  );
  assert.equal(platformName, "darwin-aarch64", "Unsupported Korean platform");
  const { tag, commit } = source;
  assert.equal(release?.tag_name, tag, "Official release tag mismatch");
  assert.equal(release.draft, false, "Official release is a draft");
  assert.equal(
    release.prerelease,
    true,
    "Expected the official preview channel",
  );
  assert.ok(
    typeof release.published_at === "string" &&
      Number.isFinite(Date.parse(release.published_at)),
    "Official release is unpublished",
  );
  assert.equal(
    release.html_url,
    `https://github.com/${sourceRepo}/releases/tag/${tag}`,
    "Foreign release URL",
  );
  assert.equal(tagCommit, commit, "Official tag moved or source pin differs");
  assert.ok(
    typeof sourceText === "string" && /^(?:[a-f0-9]{40})\n?$/.test(sourceText),
    "Malformed SOURCE_COMMIT",
  );
  assert.equal(sourceText.trimEnd(), commit, "SOURCE_COMMIT mismatch");
  const base = `https://github.com/${sourceRepo}/releases/download/${tag}`;
  const archiveName = `Buzz_${tag.slice(1)}_aarch64.app.tar.gz`;
  assert.ok(Array.isArray(release.assets), "Missing official assets");
  for (const name of ["SOURCE_COMMIT", archiveName]) {
    const assets = release.assets.filter((asset) => asset.name === name);
    assert.equal(assets.length, 1, "Missing or duplicate official asset");
    assert.equal(
      assets[0].browser_download_url,
      `${base}/${name}`,
      "Foreign asset URL",
    );
  }
  assert.equal(
    feed?.version,
    tag.slice(1),
    "Official preview feed differs from the pin",
  );
  const platform = feed.platforms?.[platformName];
  assert.equal(
    platform?.url,
    `${base}/${archiveName}`,
    "Official feed asset mismatch",
  );
  assert.ok(
    typeof platform.signature === "string" &&
      platform.signature.length > 0 &&
      platform.signature.length <= 8192,
    "Missing official feed signature",
  );
  return {
    repository: sourceRepo,
    tag,
    commit,
    archive: `${base}/${archiveName}`,
  };
}

/** Read bounded public metadata. Redirects require an explicit, constrained second hop. */
export async function readPublic(url, download = fetch, limit = 256 * 1024) {
  const parsed = new URL(url);
  assert.ok(
    parsed.protocol === "https:" &&
      !parsed.port &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash &&
      ((parsed.hostname === "api.github.com" &&
        parsed.pathname.startsWith(`/repos/${sourceRepo}/`)) ||
        (parsed.hostname === "github.com" &&
          parsed.pathname.startsWith(`/${sourceRepo}/releases/download/`))),
    "Unexpected public URL",
  );
  const options = {
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "buzz-korean-beta-check",
    },
  };
  let response = await download(url, options);
  if (
    parsed.hostname === "github.com" &&
    [301, 302, 303, 307, 308].includes(response.status)
  ) {
    const location = response.headers.get("location");
    await response.body?.cancel();
    assert.ok(location, "Missing release asset redirect");
    const redirected = new URL(location);
    assert.ok(
      redirected.protocol === "https:" &&
        !redirected.port &&
        !redirected.username &&
        !redirected.password &&
        !redirected.hash &&
        redirected.hostname === "release-assets.githubusercontent.com" &&
        redirected.pathname.startsWith("/github-production-release-asset/"),
      "Unexpected release asset redirect",
    );
    response = await download(redirected.href, options);
  }
  assert.ok(response.ok, `Public metadata HTTP ${response.status}`);
  const size = response.headers.get("content-length");
  assert.ok(
    !size || (/^[0-9]+$/.test(size) && Number(size) <= limit),
    "Public response size limit exceeded",
  );
  assert.ok(response.body, "Missing public response body");
  const reader = response.body.getReader();
  const parts = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      assert.ok(length <= limit, "Public response size limit exceeded");
      parts.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(parts).toString("utf8");
}

/** Validate the pinned release without changing configuration or contacting a community. */
export async function checkUpstream(channel, download = fetch) {
  validateChannel(channel);
  const { tag } = channel.source;
  const data = await loadPreview(tag, download);
  return validateUpstream(
    channel,
    data.release,
    data.commit,
    data.sourceText,
    data.feed,
  );
}

/** Read public preview metadata only; callers still validate its provenance. */
export async function readPreviewFeed(download = fetch) {
  return JSON.parse(await readPublic(officialFeed, download, 32 * 1024));
}

/** Resolve one preview release's public evidence without modifying a source pin. */
export async function loadPreview(tag, download = fetch, feed) {
  previewParts(tag);
  const api = `https://api.github.com/repos/${sourceRepo}`;
  const release = JSON.parse(
    await readPublic(`${api}/releases/tags/${tag}`, download),
  );
  const ref = JSON.parse(
    await readPublic(`${api}/git/ref/tags/${tag}`, download),
  );
  let object = ref.object;
  if (object?.type === "tag" && shaPattern.test(object.sha)) {
    const annotated = JSON.parse(
      await readPublic(`${api}/git/tags/${object.sha}`, download),
    );
    object = annotated.object;
  }
  assert.equal(object?.type, "commit", "Tag must resolve to a commit");
  const source = await readPublic(
    `https://github.com/${sourceRepo}/releases/download/${tag}/SOURCE_COMMIT`,
    download,
    128,
  );
  return {
    release,
    commit: object.sha,
    sourceText: source,
    feed: feed ?? (await readPreviewFeed(download)),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assert.deepEqual(
    process.argv.slice(2),
    ["--check"],
    "Usage: policy.mjs --check",
  );
  const channel = JSON.parse(
    await readFile(new URL("../../beta-channel.json", import.meta.url), "utf8"),
  );
  console.log(
    JSON.stringify(
      {
        ...(await checkUpstream(channel)),
        scope:
          "public provenance only; no archive, CI, signing or update validation",
      },
      null,
      2,
    ),
  );
}

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  prepareProposal,
  proposalBranch,
  proposalGate,
} from "../../scripts/beta/proposal.mjs";

const original = JSON.parse(
  await readFile(new URL("../../beta-channel.json", import.meta.url), "utf8"),
);
const git = (root, ...args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
async function fixture(t, { conflict = false, protectedChange = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), "buzz-proposal-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Fixture");
  git(root, "config", "user.email", "fixture@example.org");
  await writeFile(join(root, "app.txt"), "original\n");
  git(root, "add", ".");
  git(root, "commit", "-m", "original");
  const source = git(root, "rev-parse", "HEAD");
  git(root, "checkout", "-b", "upstream");
  await writeFile(join(root, "app.txt"), "official update\n");
  if (protectedChange) {
    await mkdir(join(root, ".github"));
    await writeFile(join(root, ".github", "policy.txt"), "changed\n");
  }
  git(root, "add", ".");
  git(root, "commit", "-m", "upstream update");
  const commit = git(root, "rev-parse", "HEAD");
  git(root, "checkout", "main");
  const channel = structuredClone(original);
  channel.version = "0.7.0-korean.1";
  channel.source.tag = "v0.7.0-preview.258.1";
  channel.source.commit = source;
  await writeFile(join(root, "beta-channel.json"), JSON.stringify(channel));
  await writeFile(
    join(root, "README.md"),
    "# Korean\n| 한글판 베타 버전 | old |\n| 기반 공식 버전 | old |\n| 기반 커밋 | old |\n",
  );
  if (conflict) await writeFile(join(root, "app.txt"), "Korean change\n");
  git(root, "add", ".");
  git(root, "commit", "-m", "Korean customization");
  const base = git(root, "rev-parse", "HEAD");
  return {
    root,
    base,
    discovery: {
      updateAvailable: true,
      pinned: channel.source,
      available: {
        repository: "block/buzz-app",
        tag: "v1.0.5-preview.1",
        commit,
      },
    },
  };
}

test("unchanged skips all work, including pending PR lookups", () => {
  assert.equal(
    proposalGate({ updateAvailable: false }, [], false),
    "unchanged",
  );
});
test("existing human/automatic PR and retained branch stop duplicate or reopened proposals", () => {
  const d = { updateAvailable: true };
  for (const ref of [
    "claude/upstream-v0.7.0-preview.275.1",
    "automation/upstream-v1.0.5-preview.1-123456789abc",
  ])
    assert.equal(
      proposalGate(d, [{ state: "open", head: { ref } }], false),
      "existing-pr",
    );
  assert.equal(proposalGate(d, [], true), "existing-branch");
  const exact = {
    ...d,
    available: { tag: "v1.0.5-preview.1", commit: "a".repeat(40) },
  };
  assert.equal(
    proposalGate(
      exact,
      [{ state: "closed", head: { ref: proposalBranch(exact.available) } }],
      false,
    ),
    "reviewed-pr",
  );
  assert.equal(
    proposalGate(d, [{ state: "open", head: { ref: "feature/other" } }], false),
    "prepare",
  );
});
test("branch rejects command/path injection and malformed official coordinates", () => {
  assert.throws(() =>
    proposalBranch({ tag: "v1.0.5-preview.1;touch x", commit: "a".repeat(40) }),
  );
  assert.throws(() =>
    proposalBranch({ tag: "v1.0.5-preview.1", commit: "../main" }),
  );
});
test("new version clean merge prepares code, updates pin/readme, preserves HEAD until checks", async (t) => {
  const f = await fixture(t);
  const result = await prepareProposal(f.root, f.discovery);
  assert.equal(result.status, "prepared");
  assert.equal(result.version, "1.0.5-korean.1");
  assert.equal(git(f.root, "rev-parse", "HEAD"), f.base);
  assert.equal(
    await readFile(join(f.root, "app.txt"), "utf8"),
    "official update\n",
  );
  const channel = JSON.parse(
    await readFile(join(f.root, "beta-channel.json"), "utf8"),
  );
  assert.equal(channel.source.commit, f.discovery.available.commit);
  assert.equal(channel.endpoint, original.endpoint);
  assert.equal(channel.publicKey, original.publicKey);
  assert.match(
    await readFile(join(f.root, "README.md"), "utf8"),
    /1\.0\.5-korean\.1/,
  );
});
test("conflict aborts merge and preserves Korean code, source pin and branch", async (t) => {
  const f = await fixture(t, { conflict: true });
  const before = await readFile(join(f.root, "beta-channel.json"), "utf8");
  const result = await prepareProposal(f.root, f.discovery);
  assert.equal(result.status, "conflict");
  assert.deepEqual(result.files, ["app.txt"]);
  assert.equal(git(f.root, "status", "--porcelain"), "");
  assert.equal(git(f.root, "rev-parse", "HEAD"), f.base);
  assert.equal(
    await readFile(join(f.root, "beta-channel.json"), "utf8"),
    before,
  );
});
test("protected workflow changes stop and roll back instead of changing permissions", async (t) => {
  const f = await fixture(t, { protectedChange: true });
  assert.equal(
    (await prepareProposal(f.root, f.discovery)).status,
    "protected-change",
  );
  assert.equal(git(f.root, "status", "--porcelain"), "");
  assert.equal(git(f.root, "rev-parse", "HEAD"), f.base);
});
test("dirty checkout and stale pin fail before integration", async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.root, "unrelated.txt"), "user work");
  await assert.rejects(
    prepareProposal(f.root, f.discovery),
    /Checkout must be clean/,
  );
  await rm(join(f.root, "unrelated.txt"));
  f.discovery.pinned = { ...f.discovery.pinned, commit: "a".repeat(40) };
  await assert.rejects(
    prepareProposal(f.root, f.discovery),
    /Source pin changed/,
  );
});
test("workflow failure cannot reach publish; write job never runs candidate scripts", async () => {
  const workflow = await readFile(
    new URL("../../.github/workflows/upstream-proposal.yml", import.meta.url),
    "utf8",
  );
  const publish = workflow.slice(workflow.indexOf("  proposal:\n"));
  assert.match(publish, /needs\.candidate\.result == 'success'/);
  assert.match(publish, /--draft/);
  assert.doesNotMatch(
    publish,
    /pnpm|npm |node |\.\/scripts|checkout.*candidate|secrets\./,
  );
  assert.doesNotMatch(
    workflow,
    /continue-on-error|gh pr merge|gh release|pull_request_target|secrets\./,
  );
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /git diff --name-only/);
});

test("a failing check command exits before packaging/publish commands", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "buzz-check-failure-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "bin"));
  await writeFile(join(root, "bin", "pnpm"), "#!/bin/sh\nexit 17\n", {
    mode: 0o755,
  });
  const workflow = await readFile(
    new URL("../../.github/workflows/upstream-proposal.yml", import.meta.url),
    "utf8",
  );
  const block = workflow
    .split("name: Check candidate (no publishing on failure)")[1]
    .split("      - name:")[0];
  const commands = block
    .split("        run: |\n")[1]
    .split("\n")
    .map((line) => line.slice(10))
    .join("\n");
  assert.throws(
    () =>
      execFileSync("bash", ["-e", "-c", `${commands}\ntouch published`], {
        cwd: root,
      }),
    (error) => error.status === 17,
  );
  await assert.rejects(readFile(join(root, "published")), { code: "ENOENT" });
});

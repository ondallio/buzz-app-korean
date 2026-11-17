import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverUpstream } from "./upstream.mjs";
import { validateChannel, previewParts } from "./policy.mjs";

const sha = /^[a-f0-9]{40}$/;
const protectedPath =
  /^(?:\.github\/|\.agents\/|AGENTS\.md$|scripts\/beta\/|beta-channel\.json$)/;
const git = (root, ...args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

export function proposalBranch(available) {
  previewParts(available.tag);
  assert.match(available.commit, sha);
  return `automation/upstream-${available.tag}-${available.commit.slice(0, 12)}`;
}

// Never overwrite/reopen an existing proposal or compete with a human's upstream PR.
export function proposalGate(discovery, pulls, branchExists) {
  if (!discovery.updateAvailable) return "unchanged";
  if (
    pulls.some(
      (pr) =>
        pr.state === "open" &&
        /^(?:claude\/upstream-|automation\/upstream-)/.test(pr.head.ref),
    )
  )
    return "existing-pr";
  if (
    discovery.available &&
    pulls.some((pr) => pr.head.ref === proposalBranch(discovery.available))
  )
    return "reviewed-pr";
  if (branchExists) return "existing-branch";
  return "prepare";
}

/** Runs only in a disposable clean checkout. Conflict/protected changes are never resolved. */
export async function prepareProposal(root, discovery) {
  assert.equal(discovery.updateAvailable, true);
  const channelPath = join(root, "beta-channel.json");
  const channel = JSON.parse(await readFile(channelPath, "utf8"));
  validateChannel(channel);
  assert.deepEqual(
    discovery.pinned,
    channel.source,
    "Source pin changed during discovery",
  );
  const branch = proposalBranch(discovery.available);
  const base = git(root, "rev-parse", "HEAD");
  assert.equal(
    git(root, "status", "--porcelain"),
    "",
    "Checkout must be clean",
  );
  assert.equal(
    git(root, "rev-parse", `${discovery.available.commit}^{commit}`),
    discovery.available.commit,
  );
  git(
    root,
    "merge-base",
    "--is-ancestor",
    channel.source.commit,
    discovery.available.commit,
  );
  try {
    git(root, "merge", "--no-commit", "--no-ff", discovery.available.commit);
  } catch (error) {
    const conflicts = git(root, "diff", "--name-only", "--diff-filter=U");
    if (conflicts) {
      git(root, "merge", "--abort");
      return { status: "conflict", base, branch, files: conflicts.split("\n") };
    }
    throw error;
  }
  const files = git(root, "diff", "--cached", "--name-only")
    .split("\n")
    .filter(Boolean);
  const protectedFiles = files.filter((path) => {
    if (protectedPath.test(path)) return true;
    // FOUNDATION owners require explicit human guidance, even on a clean merge.
    for (const ref of [base, discovery.available.commit]) {
      try {
        if (/FOUNDATION:/.test(git(root, "show", `${ref}:${path}`)))
          return true;
      } catch {
        // Added/deleted files may not exist on both sides.
      }
    }
    return false;
  });
  if (protectedFiles.length) {
    git(root, "merge", "--abort");
    return { status: "protected-change", base, branch, files: protectedFiles };
  }
  const parts = previewParts(discovery.available.tag);
  const versionBase = parts.slice(0, 3).join(".");
  const prior = channel.version.split("-korean.");
  channel.version = `${versionBase}-korean.${prior[0] === versionBase ? BigInt(prior[1]) + 1n : 1n}`;
  channel.source = {
    repository: discovery.available.repository,
    tag: discovery.available.tag,
    commit: discovery.available.commit,
  };
  validateChannel(channel);
  const readmePath = join(root, "README.md");
  let readme = await readFile(readmePath, "utf8");
  for (const [pattern, replacement] of [
    [
      /^\| 한글판 베타 버전 \|.*$/m,
      `| 한글판 베타 버전 | \`${channel.version}\` |`,
    ],
    [
      /^\| 기반 공식 버전 \|.*$/m,
      `| 기반 공식 버전 | [block/buzz-app \`${channel.source.tag}\`](https://github.com/block/buzz-app/releases/tag/${channel.source.tag}) |`,
    ],
    [
      /^\| 기반 커밋 \|.*$/m,
      `| 기반 커밋 | \`${channel.source.commit.slice(0, 12)}\` |`,
    ],
  ]) {
    assert.match(
      readme,
      pattern,
      "Korean README version row missing; manual review needed",
    );
    readme = readme.replace(pattern, replacement);
  }
  await writeFile(channelPath, `${JSON.stringify(channel, null, 2)}\n`);
  await writeFile(readmePath, readme);
  git(root, "add", "beta-channel.json", "README.md");
  return {
    status: "prepared",
    base,
    branch,
    tag: channel.source.tag,
    commit: channel.source.commit,
    version: channel.version,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  assert.equal(rest.length, 0);
  const root = process.cwd();
  const report = process.env.RUNNER_TEMP;
  assert.ok(report, "Run through the upstream proposal workflow");
  if (mode === "discover") {
    const channel = JSON.parse(await readFile("beta-channel.json", "utf8"));
    const discovery = await discoverUpstream(channel);
    await writeFile(
      join(report, "upstream-discovery.json"),
      JSON.stringify(discovery),
    );
    const branch = proposalBranch(discovery.available);
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `available=${discovery.updateAvailable}\nbranch=${branch}\nsha=${discovery.available.commit}\n`,
    );
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Upstream discovery\n${discovery.updateAvailable ? "New verified version" : "Unchanged; no branch, PR or checks created"}: ${discovery.available.tag}\n`,
    );
  } else if (mode === "gate") {
    const discovery = JSON.parse(
      await readFile(join(report, "upstream-discovery.json"), "utf8"),
    );
    const pulls = JSON.parse(
      await readFile(join(report, "upstream-pulls.json"), "utf8"),
    );
    const exists =
      (await readFile(join(report, "upstream-branch.txt"), "utf8")).trim()
        .length > 0;
    const status = proposalGate(discovery, pulls, exists);
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `proceed=${status === "prepare"}\n`,
    );
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Proposal gate: ${status}\nExisting branches and PRs are never overwritten or closed.\n`,
    );
  } else {
    assert.equal(mode, "prepare");
    const discovery = JSON.parse(
      await readFile(join(report, "upstream-discovery.json"), "utf8"),
    );
    const result = await prepareProposal(root, discovery);
    await writeFile(join(report, "proposal.json"), JSON.stringify(result));
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `prepared=${result.status === "prepared"}\n`,
    );
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Candidate: ${result.status}\n${JSON.stringify(result, null, 2)}\n`,
    );
    if (result.status !== "prepared") process.exitCode = 1;
  }
}

// 원본(block/buzz-app)의 최신 정식 릴리스를 한글판 브랜치에 합친다.
//
// 사용:
//   node scripts/korean/sync.mjs              최신 정식 릴리스로 동기화
//   node scripts/korean/sync.mjs --tag v1.0.5 특정 태그로 동기화
//   node scripts/korean/sync.mjs --check      새 릴리스가 있는지만 확인
//
// 결과(stdout 마지막 줄, JSON): {"status": "...", ...}
//   up-to-date  새 릴리스 없음
//   available   (--check) 새 릴리스 있음
//   conflict    병합 충돌. 작업 트리에 충돌 상태가 남아 있음(로컬에서 해결용)
//   merged      병합 완료. korean/upstream.json 갱신, 보고서 작성
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const lockPath = path.join(root, "korean/upstream.json");
const reportPath = path.join(root, "korean/sync-report.md");
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const git = (...gitArgs) =>
  execFileSync("git", gitArgs, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 256,
  }).trim();
const finish = (result) => {
  console.log(JSON.stringify(result));
  process.exit(result.status === "conflict" ? 1 : 0);
};

const lock = JSON.parse(await fs.readFile(lockPath, "utf8"));
const remoteUrl = `https://github.com/${lock.repository}.git`;
const remotes = git("remote").split("\n");
if (!remotes.includes("upstream")) git("remote", "add", "upstream", remoteUrl);

// 정식 릴리스 태그(vX.Y.Z)만 본다. preview/beta 태그는 제외한다.
const semver = (tag) => tag.slice(1).split(".").map(Number);
const newer = (a, b) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};
const stableTags = git("ls-remote", "--tags", "--refs", "upstream")
  .split("\n")
  .map((line) => line.split("refs/tags/")[1])
  .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag ?? ""));
const latest = stableTags.reduce(
  (best, tag) => (best && !newer(tag, best) ? best : tag),
  undefined,
);
const target = option("--tag") ?? latest;
if (!target) finish({ status: "error", message: "no stable upstream tag" });
if (!option("--tag") && !newer(target, lock.tag))
  finish({ status: "up-to-date", current: lock.tag });
if (args.includes("--check"))
  finish({ status: "available", current: lock.tag, target });

if (git("status", "--porcelain", "--untracked-files=no"))
  finish({ status: "error", message: "working tree has uncommitted changes" });

git(
  "fetch",
  "--no-tags",
  "upstream",
  `+refs/tags/${target}:refs/tags/${target}`,
);
git(
  "fetch",
  "--no-tags",
  "upstream",
  `+refs/tags/${lock.tag}:refs/tags/${lock.tag}`,
);
const commit = git("rev-parse", `${target}^{commit}`);

const merge = spawnSync(
  "git",
  ["merge", "--no-ff", "--no-edit", "-m", `merge: upstream ${target}`, target],
  { cwd: root, encoding: "utf8" },
);
if (merge.status !== 0) {
  const conflicts = git("diff", "--name-only", "--diff-filter=U")
    .split("\n")
    .filter(Boolean);
  if (!conflicts.length)
    finish({ status: "error", message: merge.stderr || merge.stdout });
  finish({ status: "conflict", current: lock.tag, target, conflicts });
}

await fs.writeFile(
  lockPath,
  `${JSON.stringify({ ...lock, tag: target, commit }, null, 2)}\n`,
);
const report = spawnSync(
  process.execPath,
  [
    path.join(root, "scripts/korean/upstream-text-report.mjs"),
    lock.tag,
    target,
  ],
  { cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024 * 64 },
);
await fs.writeFile(reportPath, report.stdout);
git("add", lockPath, reportPath);
git("commit", "-m", `chore(korean): record upstream ${target}`);
finish({
  status: "merged",
  previous: lock.tag,
  target,
  commit,
  needsReview: report.status !== 0,
});

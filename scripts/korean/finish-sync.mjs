// 충돌을 직접 해결하고 병합 커밋을 만든 뒤 실행한다.
// korean/upstream.json을 새 태그로 갱신하고 원본 텍스트 영향 보고서를 만든다.
// 사용: node scripts/korean/finish-sync.mjs <새태그>
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const target = process.argv[2];
if (!/^v\d+\.\d+\.\d+$/.test(target ?? "")) {
  console.error("usage: finish-sync.mjs vX.Y.Z");
  process.exit(2);
}
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
if (git("diff", "--name-only", "--diff-filter=U"))
  throw new Error("Resolve and commit every conflict first.");
if (git("grep", "-l", "-E", "^(<<<<<<<|>>>>>>>) ", "--", "src").length)
  throw new Error("Conflict markers remain under src/.");
const commit = git("rev-parse", `${target}^{commit}`);
if (
  spawnSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], {
    cwd: root,
  }).status
)
  throw new Error(`${target} is not merged into HEAD.`);

const lockPath = path.join(root, "korean/upstream.json");
const lock = JSON.parse(await fs.readFile(lockPath, "utf8"));
const report = spawnSync(
  process.execPath,
  [
    path.join(root, "scripts/korean/upstream-text-report.mjs"),
    lock.tag,
    target,
  ],
  { cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024 * 64 },
);
await fs.writeFile(path.join(root, "korean/sync-report.md"), report.stdout);
await fs.writeFile(
  lockPath,
  `${JSON.stringify({ ...lock, tag: target, commit }, null, 2)}\n`,
);
git("add", "korean/upstream.json", "korean/sync-report.md");
git("commit", "-m", `chore(korean): record upstream ${target}`);
console.log(report.stdout);

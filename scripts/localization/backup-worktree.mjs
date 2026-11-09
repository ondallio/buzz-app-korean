import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, writeFile } from "node:fs/promises";
import path from "node:path";

// Run after activating this checkout's Hermit environment. Read-only Git calls
// preserve the existing index and worktree; restoring is deliberately manual.
const git = (...args) =>
  execFileSync("git", ["--no-optional-locks", ...args], {
    maxBuffer: 32 * 1024 * 1024,
  });
const root = git("rev-parse", "--show-toplevel").toString().trim();
if (path.resolve(process.cwd()) !== root)
  throw new Error("Run this backup from the repository root");
// Refuse a destination that could enter the source inventory or a public commit.
try {
  execFileSync("git", [
    "check-ignore",
    "--quiet",
    "--no-index",
    ".local/backups",
  ]);
} catch {
  throw new Error("The private backup directory must be ignored by Git");
}
const stamp = new Date().toISOString().replaceAll(":", "-");
const directory = path.join(
  root,
  ".local/backups",
  `${stamp}-${randomBytes(3).toString("hex")}`,
);
await mkdir(path.dirname(directory), { recursive: true, mode: 0o700 });
await mkdir(directory, { mode: 0o700 });
const base = git("rev-parse", "HEAD").toString().trim();
const status = git("status", "--porcelain=v1", "-z");
const files = git("ls-files", "--others", "--exclude-standard", "-z");
const names = files.toString().split("\0").filter(Boolean);
if (
  names.some((name) => path.isAbsolute(name) || name.split("/").includes(".."))
)
  throw new Error("Unexpected non-relative source path");
const artifacts = {
  "tracked.patch": git("diff", "--binary", "HEAD"),
  "staged.patch": git("diff", "--cached", "--binary"),
  "status.bin": status,
  "untracked.bin": files,
};
for (const [name, data] of Object.entries(artifacts))
  await writeFile(path.join(directory, name), data, {
    mode: 0o600,
    flag: "wx",
  });
const archive = await open(
  path.join(directory, "untracked.tar.gz"),
  "wx",
  0o600,
);
try {
  execFileSync(
    "tar",
    ["-czf", "-", "--null", "-T", path.join(directory, "untracked.bin")],
    {
      cwd: root,
      stdio: ["ignore", archive.fd, "pipe"],
      env: { ...process.env, COPYFILE_DISABLE: "1" },
      maxBuffer: 1024 * 1024,
    },
  );
} finally {
  await archive.close();
}
const hashes = {};
for (const name of [...Object.keys(artifacts), "untracked.tar.gz"]) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path.join(directory, name)))
    hash.update(chunk);
  hashes[name] = hash.digest("hex");
}
const receipt = {
  root,
  base,
  recordedAt: new Date().toISOString(),
  untrackedFiles: names.length,
  hashes,
  concurrentEdits:
    "Source writers may be active. This is a recovery snapshot, not a validated build or completion attestation.",
  restore:
    "Preserve the destination first. Start from the recorded base in a separate checkout. Review/apply --check tracked.patch, then apply it; staged.patch separately records the original index. Extract untracked.tar.gz into a review directory and compare before restoring. Never overwrite current work blindly. Git-ignored files, including ignored credentials, are excluded. Nonignored files are archived, so review before sharing any backup. macOS extended metadata is omitted.",
};
await writeFile(
  path.join(directory, "receipt.json"),
  `${JSON.stringify(receipt, null, 2)}\n`,
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    directory,
    base,
    untrackedFiles: names.length,
    artifacts: Object.keys(hashes),
  }),
);

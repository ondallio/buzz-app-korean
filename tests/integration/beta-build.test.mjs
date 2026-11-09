import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildBetaCandidate } from "../../scripts/beta/build.mjs";
import { betaReleaseConfig } from "../../scripts/beta/config.mjs";

const source = fileURLToPath(new URL("../../", import.meta.url));
const policy = JSON.parse(
  readFileSync(join(source, "beta-channel.json"), "utf8"),
);
const config = JSON.parse(
  readFileSync(join(source, "src-tauri/tauri.conf.json"), "utf8"),
);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const publicEnvironment = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "LANG"]
    .filter((key) => process.env[key] !== undefined)
    .map((key) => [key, process.env[key]]),
);
const gitEnvironment = {
  ...publicEnvironment,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.org",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.org",
};
function git(root, ...args) {
  const result = spawnSync(
    "git",
    ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", ...args],
    {
      cwd: root,
      env: gitEnvironment,
      encoding: "utf8",
      timeout: 20_000,
      maxBuffer: 128 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function put(root, name, value, mode) {
  mkdirSync(dirname(join(root, name)), { recursive: true });
  writeFileSync(join(root, name), value, mode ? { mode } : {});
}
const fakeChild = `#!${process.execPath}
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd(), mode=JSON.parse(fs.readFileSync('.fixture-mode.json','utf8'));
const args=process.argv.slice(2), overlay=args[args.indexOf('--config')+1];
const release=JSON.parse(fs.readFileSync(overlay,'utf8'));
fs.mkdirSync('.local',{recursive:true});
fs.appendFileSync('.local/child-count','1\\n');
fs.writeFileSync('.local/child.json',JSON.stringify({args,env:process.env,release,baseHook:JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8')).build.beforeBuildCommand}));
if(mode==='fail')process.exit(7);
if(mode==='deadline')process.exit(124);
const bundle=path.join(process.env.CARGO_TARGET_DIR,'aarch64-apple-darwin/release/bundle');
const app=path.join(bundle,'macos/Buzz Korean Beta.app');
const paths=['Contents/MacOS/Buzz','Contents/Resources/bin/goose-acp','Contents/Resources/bin/buzz-agent-command','Contents/Resources/bin/buzz'];
for(const file of paths){const target=path.join(app,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,mode==='empty-helper'&&file.endsWith('/buzz')?'':'fake fixture '+file,{mode:0o755});}
const archive=path.join(bundle,'macos/Buzz Korean Beta.app.tar.gz');
const dmg=path.join(bundle,'dmg/Buzz Korean Beta_'+release.version+'_aarch64.dmg');
fs.mkdirSync(path.dirname(dmg),{recursive:true});
if(mode!=='missing-archive')fs.writeFileSync(archive,'fake updater archive');
fs.writeFileSync(dmg,'fake dmg');
if(mode==='duplicate-dmg')fs.writeFileSync(path.join(path.dirname(dmg),'unexpected.dmg'),'duplicate');
if(mode==='signature')fs.writeFileSync(archive+'.sig','unexpected signature');
if(mode==='linked-artifact'){fs.unlinkSync(dmg);fs.symlinkSync(path.join(root,'.fixture-mode.json'),dmg);}
if(mode==='oversize'){fs.truncateSync(archive,2*1024**3+1);}
if(mode==='source-mutation')fs.appendFileSync('app-source.txt','changed');
if(mode==='head-mutation')spawnSync('git',['update-ref','HEAD',JSON.parse(fs.readFileSync('beta-channel.json','utf8')).source.commit],{env:process.env});
`;
function fixture(t, mode = "success", mutateChannel) {
  const root = mkdtempSync(
    join(realpathSync(tmpdir()), "buzz-beta-build-test-"),
  );
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, "init", "-q");
  put(
    root,
    ".gitignore",
    ".local\ntarget\nsrc-tauri/target\nsrc-tauri/resources/bin\ndist\n.env*\n!.env.example\n.npmrc\n",
  );
  put(
    root,
    "package.json",
    JSON.stringify({
      type: "module",
      devDependencies: { "@tauri-apps/cli": "2.12.3" },
    }),
  );
  put(root, "src-tauri/tauri.conf.json", JSON.stringify(config));
  put(root, "Cargo.lock", "fixture cargo lock\n");
  put(root, "pnpm-lock.yaml", "fixture pnpm lock\n");
  put(root, ".env.example", "# public example only\n");
  put(root, "app-source.txt", "fixture source\n");
  put(root, ".fixture-mode.json", JSON.stringify(mode));
  put(root, "bin/pnpm", fakeChild, 0o755);
  put(
    root,
    "scripts/ci-retry.sh",
    readFileSync(join(source, "scripts/ci-retry.sh")),
  );
  git(root, "add", ".");
  git(root, "commit", "-q", "-s", "-m", "synthetic upstream fixture");
  const base = git(root, "rev-parse", "HEAD");
  const channel = structuredClone(policy);
  channel.source.commit = base;
  mutateChannel?.(channel);
  put(root, "beta-channel.json", JSON.stringify(channel));
  git(root, "add", "beta-channel.json");
  git(root, "commit", "-q", "-s", "-m", "candidate fixture");
  return { root, base, channel, commit: git(root, "rev-parse", "HEAD") };
}
const receipts = (root) => {
  const directory = join(root, ".local/beta-builds");
  return existsSync(directory)
    ? readdirSync(directory).filter((name) =>
        existsSync(join(directory, name, "receipt.json")),
      )
    : [];
};

test("builds one private keyless candidate from the real policy and writes only pending evidence", async (t) => {
  const h = fixture(t);
  const receipt = await buildBetaCandidate(h.root, h.commit, {
    ...publicEnvironment,
    GH_TOKEN: "do-not-inherit",
    GITHUB_TOKEN: "do-not-inherit",
    TAURI_SIGNING_PRIVATE_KEY: "do-not-inherit",
    APPLE_ID: "do-not-inherit",
    TAURI_BUNDLER_DMG_IGNORE_CI: "true",
    TAURI_CONFIG: "do-not-inherit",
    CARGO_TARGET_DIR: "/foreign/shared-target",
    RUSTFLAGS: "do-not-inherit",
    BUZZ_PRIVATE_KEY: "do-not-inherit",
    BUZZ_AGENT_HELPER: "do-not-inherit",
    VITE_ACCOUNT: "do-not-inherit",
    BUZZ_DISTRIBUTION_ID: "xyz.block.buzz.desktop",
  });
  const child = JSON.parse(
    readFileSync(join(h.root, ".local/child.json"), "utf8"),
  );
  const release = betaReleaseConfig(h.channel);
  assert.deepEqual(child.release, release.config);
  assert.equal(child.baseHook, config.build.beforeBuildCommand);
  assert.deepEqual(child.args, [
    "exec",
    "tauri",
    "build",
    "--ci",
    "--no-sign",
    "--bundles",
    "app,dmg",
    "--target",
    "aarch64-apple-darwin",
    "--config",
    join(receipt.runDirectory, "release.json"),
    "--",
    "--locked",
  ]);
  assert.equal(readFileSync(join(h.root, ".local/child-count"), "utf8"), "1\n");
  for (const name of [
    "GH_TOKEN",
    "GITHUB_TOKEN",
    "TAURI_SIGNING_PRIVATE_KEY",
    "APPLE_ID",
    "TAURI_BUNDLER_DMG_IGNORE_CI",
    "TAURI_CONFIG",
    "RUSTFLAGS",
    "BUZZ_PRIVATE_KEY",
    "BUZZ_AGENT_HELPER",
    "VITE_ACCOUNT",
  ])
    assert.equal(child.env[name], undefined, name);
  for (const [key, value] of Object.entries(release.environment))
    assert.equal(child.env[key], value);
  assert.equal(child.env.HOME, publicEnvironment.HOME);
  assert.equal(child.env.CI, "true");
  assert.equal(child.env.CARGO_BUILD_JOBS, "2");
  assert.equal(
    child.env.CARGO_TARGET_DIR,
    join(h.root, receipt.runDirectory, "cargo-target"),
  );
  assert.equal(child.env.GIT_CONFIG_GLOBAL, "/dev/null");
  assert.equal(child.env.GIT_CONFIG_NOSYSTEM, "1");
  assert.equal(child.env.GIT_TERMINAL_PROMPT, "0");
  assert.equal(child.env.pnpm_config_verify_deps_before_run, "false");
  assert.equal(
    readFileSync(child.env.npm_config_userconfig, "utf8"),
    "# Public build configuration only\n",
  );
  assert.equal(
    readFileSync(child.env.npm_config_globalconfig, "utf8"),
    "# Public build configuration only\n",
  );
  assert.equal(receipt.candidateCommit, h.commit);
  assert.deepEqual(receipt.source, h.channel.source);
  assert.equal(receipt.verification, "pending");
  assert.equal(receipt.signing, "not-requested");
  assert.equal(receipt.identifier, h.channel.identifier);
  assert.equal(receipt.version, h.channel.version);
  assert.equal(receipt.platform, "darwin-aarch64");
  assert.equal(receipt.updater.publicKeySha256, sha(h.channel.publicKey));
  assert.equal(receipt.updater.endpoint, h.channel.endpoint);
  assert.equal(receipt.executables.length, 4);
  assert.equal(receipt.artifacts.length, 2);
  for (const item of [
    ...receipt.executables,
    ...receipt.artifacts,
    receipt.overlay,
  ]) {
    const bytes = readFileSync(join(h.root, receipt.runDirectory, item.path));
    assert.equal(item.bytes, bytes.length);
    assert.equal(item.sha256, sha(bytes));
  }
  assert.equal(
    receipt.locks.cargo.sha256,
    sha(readFileSync(join(h.root, "Cargo.lock"))),
  );
  assert.equal(
    receipt.locks.pnpm.sha256,
    sha(readFileSync(join(h.root, "pnpm-lock.yaml"))),
  );
  assert.deepEqual(
    JSON.parse(
      readFileSync(join(h.root, receipt.runDirectory, "receipt.json"), "utf8"),
    ),
    receipt,
  );
  assert.equal(receipts(h.root).length, 1);
  assert.equal(git(h.root, "rev-parse", "HEAD"), h.commit);
  assert.equal(git(h.root, "status", "--porcelain"), "");
});

for (const mode of [
  "fail",
  "deadline",
  "missing-archive",
  "duplicate-dmg",
  "signature",
  "linked-artifact",
  "empty-helper",
  "oversize",
  "source-mutation",
  "head-mutation",
]) {
  test(`does not issue a receipt for ${mode}`, async (t) => {
    const h = fixture(t, mode);
    await assert.rejects(
      buildBetaCandidate(h.root, h.commit, publicEnvironment),
    );
    assert.deepEqual(receipts(h.root), []);
  });
}

for (const file of [
  ".env",
  ".env.local",
  ".env.production.local",
  ".ENV.LOCAL",
  ".npmrc",
  "src-tauri/.env",
  "src-tauri/.env.example.local",
  "src-tauri/.npmrc",
]) {
  test(`rejects input file ${file} without reading or deleting its values`, async (t) => {
    const h = fixture(t);
    put(h.root, file, "private-sentinel-do-not-echo");
    await assert.rejects(
      buildBetaCandidate(h.root, h.commit, publicEnvironment),
      (error) =>
        error instanceof Error &&
        /Environment input/.test(error.message) &&
        !error.message.includes("private-sentinel"),
    );
    assert.equal(
      readFileSync(join(h.root, file), "utf8"),
      "private-sentinel-do-not-echo",
    );
    assert.equal(existsSync(join(h.root, ".local/child.json")), false);
  });
}

for (const file of [
  ".local",
  "target",
  "target/goose-acp-download",
  "src-tauri/target",
  "src-tauri/resources/bin",
  "dist",
]) {
  test(`rejects a foreign staging link at ${file}`, async (t) => {
    const h = fixture(t);
    const outside = mkdtempSync(
      join(realpathSync(tmpdir()), "buzz-beta-foreign-"),
    );
    t.after(() => rmSync(outside, { recursive: true, force: true }));
    mkdirSync(dirname(join(h.root, file)), { recursive: true });
    symlinkSync(outside, join(h.root, file));
    await assert.rejects(
      buildBetaCandidate(h.root, h.commit, publicEnvironment),
      /symlink/i,
    );
    assert.equal(existsSync(join(h.root, ".local/child.json")), false);
    assert.deepEqual(readdirSync(outside), []);
  });
}

test("rejects bad SHA, changed source, untracked source and a different HEAD before child execution", async (t) => {
  const h = fixture(t);
  for (const sha of ["HEAD", "A".repeat(40), "a".repeat(40)])
    await assert.rejects(buildBetaCandidate(h.root, sha, publicEnvironment));
  put(h.root, "app-source.txt", "dirty");
  await assert.rejects(
    buildBetaCandidate(h.root, h.commit, publicEnvironment),
    /clean/i,
  );
  git(h.root, "checkout", "--", "app-source.txt");
  put(h.root, "unexpected-source.ts", "data");
  await assert.rejects(
    buildBetaCandidate(h.root, h.commit, publicEnvironment),
    /clean/i,
  );
  assert.equal(existsSync(join(h.root, ".local/child.json")), false);
});

test("rejects malformed distributor policy and a source pin outside candidate ancestry", async (t) => {
  const foreign = fixture(t, "success", (channel) => {
    channel.identifier = "xyz.block.buzz.desktop";
  });
  await assert.rejects(
    buildBetaCandidate(foreign.root, foreign.commit, publicEnvironment),
  );
  const h = fixture(t, "success", (channel) => {
    channel.source.commit = "a".repeat(40);
  });
  await assert.rejects(buildBetaCandidate(h.root, h.commit, publicEnvironment));
  assert.equal(existsSync(join(h.root, ".local/child.json")), false);
});

test("the real CLI rejects extra configuration arguments before any native command", () => {
  const result = spawnSync(
    process.execPath,
    [
      join(source, "scripts/beta/build.mjs"),
      "--commit",
      "a".repeat(40),
      "--config",
      "foreign.json",
    ],
    {
      env: publicEnvironment,
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 4096,
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage|Darwin arm64/);
});

test("requires the new run directory to be ignored before invoking the child", async (t) => {
  const h = fixture(t);
  put(
    h.root,
    ".gitignore",
    readFileSync(join(h.root, ".gitignore"), "utf8").replace(".local\n", ""),
  );
  git(h.root, "add", ".gitignore");
  git(h.root, "commit", "-q", "-s", "-m", "fixture output policy");
  const commit = git(h.root, "rev-parse", "HEAD");
  await assert.rejects(buildBetaCandidate(h.root, commit, publicEnvironment));
  assert.equal(existsSync(join(h.root, ".local/child.json")), false);
  assert.deepEqual(receipts(h.root), []);
});

test("rejects a real existing source commit from a different history", async (t) => {
  const h = fixture(t);
  const unrelated = git(
    h.root,
    "commit-tree",
    git(h.root, "rev-parse", "HEAD^{tree}"),
    "-m",
    "unrelated synthetic source\n\nSigned-off-by: Fixture <fixture@example.org>",
  );
  const channel = {
    ...h.channel,
    source: { ...h.channel.source, commit: unrelated },
  };
  put(h.root, "beta-channel.json", JSON.stringify(channel));
  git(h.root, "add", "beta-channel.json");
  git(h.root, "commit", "-q", "-s", "-m", "nonancestor candidate fixture");
  await assert.rejects(
    buildBetaCandidate(
      h.root,
      git(h.root, "rev-parse", "HEAD"),
      publicEnvironment,
    ),
  );
  assert.equal(existsSync(join(h.root, ".local/child.json")), false);
});

for (const flag of ["--assume-unchanged", "--skip-worktree"]) {
  test(`refuses ${flag} index flags that can conceal changed candidate source`, async (t) => {
    const h = fixture(t);
    git(h.root, "update-index", flag, "app-source.txt");
    put(
      h.root,
      "app-source.txt",
      "changed source hidden from normal git status",
    );
    assert.equal(git(h.root, "status", "--porcelain"), "");
    await assert.rejects(
      buildBetaCandidate(h.root, h.commit, publicEnvironment),
    );
    assert.equal(existsSync(join(h.root, ".local/child.json")), false);
  });
}

for (const file of [
  "src-tauri/resources/bin/buzz.new",
  "target/goose-acp-download/fixture.tar.gz",
]) {
  test(`rejects nested ignored staging symlink ${file} before child execution`, async (t) => {
    const h = fixture(t);
    const outside = mkdtempSync(
      join(realpathSync(tmpdir()), "buzz-beta-leaf-"),
    );
    t.after(() => rmSync(outside, { recursive: true, force: true }));
    const foreign = join(outside, "fixture.bin");
    writeFileSync(foreign, "controlled foreign file must remain untouched");
    mkdirSync(dirname(join(h.root, file)), { recursive: true });
    symlinkSync(foreign, join(h.root, file));
    assert.equal(git(h.root, "status", "--porcelain"), "");
    await assert.rejects(
      buildBetaCandidate(h.root, h.commit, publicEnvironment),
      /Staging tree contains a symlink/,
    );
    assert.equal(existsSync(join(h.root, ".local/child.json")), false);
    assert.deepEqual(receipts(h.root), []);
    assert.equal(
      readFileSync(foreign, "utf8"),
      "controlled foreign file must remain untouched",
    );
  });
}

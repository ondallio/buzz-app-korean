import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  opendir,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { betaReleaseConfig } from "./config.mjs";

const maximum = 2 * 1024 ** 3;
const publicNames = [
  "PATH",
  "HOME",
  "SHELL",
  "USER",
  "LOGNAME",
  "LANG",
  "LC_ALL",
  "RUSTUP_HOME",
  "CARGO_HOME",
  "HERMIT_STATE_DIR",
  "NODE_EXTRA_CA_CERTS",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
];
const hash = (text) => createHash("sha256").update(text).digest("hex");

async function checked(root, name) {
  assert.ok(
    !isAbsolute(name) && !name.split(/[\\/]/).includes(".."),
    "Path escaped build root",
  );
  let path = root;
  let found;
  for (const part of name.split("/")) {
    path = join(path, part);
    found = await lstat(path).catch((error) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    assert.ok(!found?.isSymbolicLink(), "Build path contains a symlink");
  }
  return found;
}

async function input(root, name) {
  const stat = await checked(root, name);
  assert.ok(
    stat?.isFile() && stat.size <= 1024 ** 2,
    "Invalid public source input",
  );
  return JSON.parse(await readFile(join(root, name), "utf8"));
}

async function rejectInputs(root) {
  for (const name of [".", "src-tauri"]) {
    await checked(root, name);
    const directory = await opendir(join(root, name));
    let count = 0;
    for await (const entry of directory) {
      assert.ok(++count <= 4096, "Too many source input entries");
      const lower = entry.name.toLowerCase();
      assert.ok(
        !(lower.startsWith(".env") && entry.name !== ".env.example") &&
          lower !== ".npmrc",
        "Environment input file is not permitted",
      );
    }
  }
}

async function staging(root) {
  for (const path of [
    "target",
    "src-tauri/target",
    "dist",
    "src-tauri/resources/bin",
    "target/goose-acp-download",
  ])
    await checked(root, path);
  const pending = [
    "dist",
    "src-tauri/resources/bin",
    "target/goose-acp-download",
  ];
  let count = 0;
  while (pending.length) {
    const path = pending.pop();
    const stat = await checked(root, path);
    if (!stat?.isDirectory()) continue;
    for await (const entry of await opendir(join(root, path))) {
      assert.ok(++count <= 20_000, "Staging tree is too large");
      assert.ok(!entry.isSymbolicLink(), "Staging tree contains a symlink");
      if (entry.isDirectory()) pending.push(`${path}/${entry.name}`);
    }
  }
}

async function digest(root, name, executable = false) {
  const entry = await checked(root, name);
  assert.ok(
    entry?.isFile() &&
      entry.nlink === 1 &&
      entry.size > 0 &&
      entry.size <= maximum,
    "Missing, linked or oversized artifact",
  );
  if (executable) assert.ok(entry.mode & 0o111, "Artifact is not executable");
  const handle = await open(
    join(root, name),
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const before = await handle.stat();
    assert.equal(before.ino, entry.ino, "Artifact changed before hashing");
    const sha = createHash("sha256");
    let bytes = 0;
    for await (const chunk of handle.createReadStream({ autoClose: false })) {
      bytes += chunk.length;
      assert.ok(bytes <= maximum, "Artifact exceeds size bound");
      sha.update(chunk);
    }
    const after = await handle.stat();
    assert.ok(
      bytes === entry.size &&
        after.size === entry.size &&
        after.mtimeMs === entry.mtimeMs,
      "Artifact changed while hashing",
    );
    return { path: name, bytes, sha256: sha.digest("hex") };
  } finally {
    await handle.close();
  }
}

function git(root, environment, ...args) {
  return execFileSync(
    "git",
    ["-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", ...args],
    {
      cwd: root,
      env: environment,
      encoding: "utf8",
      timeout: 20_000,
      maxBuffer: 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();
}
function unchanged(root, environment, commit) {
  assert.equal(
    git(root, environment, "rev-parse", "HEAD"),
    commit,
    "Candidate HEAD changed",
  );
  const flags = git(root, environment, "ls-files", "-v", "-z").split("\0");
  assert.ok(
    flags.every((entry) => !/^[a-zS]/.test(entry)),
    "Candidate index flags conceal source state",
  );
  assert.equal(
    git(root, environment, "status", "--porcelain=v1", "--untracked-files=all"),
    "",
    "Candidate source must be clean",
  );
}

/** Build a prepared checkout; returned evidence still needs independent native verification. */
export async function buildBetaCandidate(
  root,
  commit,
  environment = process.env,
) {
  assert.match(commit, /^[a-f0-9]{40}$/, "Expected an exact candidate commit");
  root = resolve(root);
  assert.equal(await realpath(root), root, "Candidate root must be canonical");
  const childEnvironment = Object.fromEntries(
    publicNames
      .filter((key) => environment[key] !== undefined)
      .map((key) => [key, environment[key]]),
  );
  assert.ok(
    environment.HOME && (await lstat(environment.HOME)).isDirectory(),
    "An existing HOME is required",
  );
  Object.assign(childEnvironment, {
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_ASKPASS: "/usr/bin/false",
    SSH_ASKPASS: "/usr/bin/false",
  });
  await rejectInputs(root);
  unchanged(root, childEnvironment, commit);
  const channel = await input(root, "beta-channel.json");
  const release = betaReleaseConfig(channel);
  git(
    root,
    childEnvironment,
    "merge-base",
    "--is-ancestor",
    channel.source.commit,
    commit,
  );
  const manifest = await input(root, "package.json");
  assert.equal(
    manifest.devDependencies?.["@tauri-apps/cli"],
    "2.12.3",
    "Unexpected Tauri CLI pin",
  );
  await staging(root);
  await checked(root, ".local/beta-builds");
  await mkdir(join(root, ".local/beta-builds"), {
    recursive: true,
    mode: 0o700,
  });
  const run = await mkdtemp(join(root, ".local/beta-builds/run-"));
  await chmod(run, 0o700);
  git(root, childEnvironment, "check-ignore", "-q", relative(root, run));
  for (const name of ["cargo-target", "tmp"])
    await mkdir(join(run, name), { mode: 0o700 });
  for (const name of ["npm-user.rc", "npm-global.rc"])
    await writeFile(join(run, name), "# Public build configuration only\n", {
      flag: "wx",
      mode: 0o600,
    });
  const overlay = "release.json";
  await writeFile(
    join(run, overlay),
    `${JSON.stringify(release.config, null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  Object.assign(childEnvironment, release.environment, {
    CI: "true",
    CARGO_TARGET_DIR: join(run, "cargo-target"),
    CARGO_BUILD_JOBS: "2",
    TMPDIR: join(run, "tmp"),
    TMP: join(run, "tmp"),
    TEMP: join(run, "tmp"),
    npm_config_userconfig: join(run, "npm-user.rc"),
    npm_config_globalconfig: join(run, "npm-global.rc"),
    pnpm_config_verify_deps_before_run: "false",
    COPYFILE_DISABLE: "1",
    BUZZ_BUILDERLAB_URL: "",
    BUZZ_DEV_VIEWER: "",
  });
  const locks = {
    cargo: await digest(root, "Cargo.lock"),
    pnpm: await digest(root, "pnpm-lock.yaml"),
  };
  const args = [
    "scripts/ci-retry.sh",
    "1",
    "5400",
    "bin/pnpm",
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
    relative(root, join(run, overlay)),
    "--",
    "--locked",
  ];
  await new Promise((accept, reject) => {
    const child = spawn("bash", args, {
      cwd: root,
      env: childEnvironment,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? accept()
        : reject(new Error(`Keyless build failed (${signal ?? code})`)),
    );
  });
  const bundle = "cargo-target/aarch64-apple-darwin/release/bundle";
  const macos = `${bundle}/macos`;
  const dmg = `${bundle}/dmg`;
  for (const [path, suffix, expected] of [
    [macos, ".app", "Buzz Korean Beta.app"],
    [macos, ".app.tar.gz", "Buzz Korean Beta.app.tar.gz"],
    [dmg, ".dmg", `Buzz Korean Beta_${channel.version}_aarch64.dmg`],
  ]) {
    await checked(run, path);
    const matches = [];
    let count = 0;
    for await (const entry of await opendir(join(run, path))) {
      assert.ok(
        ++count <= 256 && !entry.name.endsWith(".sig"),
        "Unexpected build outputs",
      );
      if (entry.name.endsWith(suffix)) matches.push(entry.name);
    }
    assert.deepEqual(matches, [expected], "Missing or duplicate build output");
  }
  const executables = [];
  for (const path of [
    "MacOS/Buzz",
    "Resources/bin/goose-acp",
    "Resources/bin/buzz-agent-command",
    "Resources/bin/buzz",
  ])
    executables.push(
      await digest(run, `${macos}/Buzz Korean Beta.app/Contents/${path}`, true),
    );
  const artifacts = [
    {
      kind: "app-tar-gz",
      ...(await digest(run, `${macos}/Buzz Korean Beta.app.tar.gz`)),
    },
    {
      kind: "dmg",
      ...(await digest(
        run,
        `${dmg}/Buzz Korean Beta_${channel.version}_aarch64.dmg`,
      )),
    },
  ];
  assert.ok(
    [...artifacts, ...executables].reduce((sum, file) => sum + file.bytes, 0) <=
      4 * 1024 ** 3,
    "Total artifact size exceeds bound",
  );
  await rejectInputs(root);
  await staging(root);
  unchanged(root, childEnvironment, commit);
  const receipt = {
    schemaVersion: 1,
    kind: "built-keyless-candidate",
    runDirectory: relative(root, run),
    candidateCommit: commit,
    source: channel.source,
    identifier: channel.identifier,
    version: channel.version,
    platform: channel.platform,
    updater: {
      endpoint: channel.endpoint,
      publicKeySha256: hash(channel.publicKey),
    },
    overlay: await digest(run, overlay),
    locks,
    command: { file: "bash", args },
    tauriCli: "2.12.3",
    executables,
    artifacts,
    verification: "pending",
    signing: "not-requested",
  };
  await writeFile(
    join(run, "receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  return receipt;
}

if (import.meta.main) {
  assert.ok(
    process.platform === "darwin" && process.arch === "arm64",
    "CLI requires Darwin arm64",
  );
  assert.ok(
    process.argv.length === 4 && process.argv[2] === "--commit",
    "Usage: build.mjs --commit <40-character SHA>",
  );
  try {
    const receipt = await buildBetaCandidate(
      fileURLToPath(new URL("../../", import.meta.url)),
      process.argv[3],
    );
    console.log(JSON.stringify(receipt, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

// 한글판 Apple Silicon DMG를 서명·공증 없이 로컬에서 빌드한다.
//
// 사용: bin/node scripts/korean/build-dmg.mjs
//
// - 네이티브 입력 BUZZ_DISTRIBUTION_ID와 Tauri 오버레이(desktop-config.mjs)를 함께 넣어
//   키체인·앱 데이터·딥링크 스킴이 공식 Buzz와 겹치지 않게 한다.
// - 업데이터는 끈다(BUZZ_UPDATER_* 제거, plugins.updater 없음).
// - 서명·공증 관련 환경 변수는 자식 프로세스에 넘기지 않는다.
// - 빌드한 앱을 실행하거나 /Applications에 설치하지 않는다.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { koreanReleaseConfig } from "./desktop-config.mjs";

const TARGET = "aarch64-apple-darwin";
const DROPPED = [
  /^BUZZ_UPDATER_/,
  /^TAURI_SIGNING_/,
  /^APPLE_/,
  /^BUZZ_DEV_SIGNING_IDENTITY$/,
  /^BUZZ_DEV_CREDENTIAL_HELPER$/,
  /^BUZZ_DEV_RELEASE_KEY$/,
  /^BUZZ_BUILDERLAB_/,
  /^BUZZ_DEV_VIEWER$/,
  /^BUZZODZ_/,
];

/** 서명·업데이터·개발용 입력을 뺀 빌드 환경. */
export function buildEnvironment(environment, release) {
  const kept = Object.fromEntries(
    Object.entries(environment).filter(
      ([key]) => !DROPPED.some((pattern) => pattern.test(key)),
    ),
  );
  return { ...kept, ...release.environment, CI: "true" };
}

/** tauri build 인자: 서명 없이 app·dmg만, 오버레이 적용, Cargo.lock 고정. */
export function tauriArguments(overlay) {
  return [
    "exec",
    "tauri",
    "build",
    "--ci",
    "--no-sign",
    "--bundles",
    "app,dmg",
    "--target",
    TARGET,
    "--config",
    overlay,
    "--",
    "--locked",
  ];
}

const plist = (app, key) =>
  execFileSync(
    "/usr/bin/plutil",
    ["-extract", key, "raw", "-o", "-", join(app, "Contents/Info.plist")],
    { encoding: "utf8" },
  ).trim();

function main() {
  assert.ok(
    process.platform === "darwin" && process.arch === "arm64",
    "Apple Silicon macOS에서만 빌드할 수 있습니다",
  );
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const release = koreanReleaseConfig();
  const run = join(root, ".local/korean-builds", `run-${Date.now()}`);
  mkdirSync(run, { recursive: true, mode: 0o700 });
  const overlay = join(run, "release.json");
  writeFileSync(overlay, `${JSON.stringify(release.config, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  const result = spawnSync(
    join(root, "bin/pnpm"),
    tauriArguments(relative(root, overlay)),
    {
      cwd: root,
      env: buildEnvironment(process.env, release),
      stdio: "inherit",
    },
  );
  rmSync(run, { recursive: true, force: true });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `tauri build failed (${result.status})`);

  const target = process.env.CARGO_TARGET_DIR || join(root, "target");
  const bundle = join(target, TARGET, "release/bundle");
  const name = release.config.productName;
  const app = join(bundle, "macos", `${name}.app`);
  const dmgs = readdirSync(join(bundle, "dmg")).filter(
    (file) =>
      file.endsWith(".dmg") &&
      file.startsWith(`${name}_${release.config.version}_`),
  );
  assert.ok(existsSync(app), `Missing ${app}`);
  assert.equal(dmgs.length, 1, "Expected exactly one Korean DMG");
  const info = {
    app,
    dmg: join(bundle, "dmg", dmgs[0]),
    CFBundleIdentifier: plist(app, "CFBundleIdentifier"),
    CFBundleShortVersionString: plist(app, "CFBundleShortVersionString"),
    CFBundleURLSchemes: plist(app, "CFBundleURLTypes.0.CFBundleURLSchemes.0"),
  };
  assert.equal(info.CFBundleIdentifier, release.config.identifier);
  assert.equal(info.CFBundleShortVersionString, release.config.version);
  assert.equal(
    info.CFBundleURLSchemes,
    release.config.plugins["deep-link"].desktop.schemes[0],
  );
  process.stdout.write(`${JSON.stringify(info, null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

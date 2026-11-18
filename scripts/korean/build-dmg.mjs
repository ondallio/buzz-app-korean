// 한글판 Apple Silicon DMG를 서명·공증 없이 로컬에서 빌드한다.
//
// 사용: bin/node scripts/korean/build-dmg.mjs            (로컬 Mac 또는 GitHub Actions macOS)
//       bin/node scripts/korean/build-dmg.mjs --dry-run  (어느 OS에서나 설정만 출력)
//
// - 네이티브 입력 BUZZ_DISTRIBUTION_ID와 Tauri 오버레이(desktop-config.mjs)를 함께 넣어
//   키체인·앱 데이터·딥링크 스킴이 공식 Buzz와 겹치지 않게 한다.
// - 업데이터는 끈다(BUZZ_UPDATER_* 제거, plugins.updater 없음).
// - 서명·공증 관련 환경 변수는 자식 프로세스에 넘기지 않는다.
// - 빌드한 앱을 실행하거나 /Applications에 설치하지 않는다.
// - GITHUB_OUTPUT이 있으면 결과(dmg, asset, version, identifier, scheme)를 거기에도 쓴다.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { koreanReleaseConfig } from "./desktop-config.mjs";

export const TARGET = "aarch64-apple-darwin";
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

/** Tauri DMG 파일 이름(`Buzz Korean_1.0.5_aarch64.dmg`). */
export const dmgName = ({ productName, version }) =>
  `${productName}_${version}_aarch64.dmg`;

/** GitHub 릴리스 자산 이름: 파일 이름의 공백을 점으로 (GitHub가 하는 것과 같게). */
export const releaseAsset = (fileName) => fileName.replaceAll(" ", ".");

/** 빌드 결과를 GitHub Actions step output으로 남긴다. 값에 줄바꿈은 허용하지 않는다. */
export function writeGithubOutput(info, file = process.env.GITHUB_OUTPUT) {
  if (!file) return;
  const lines = Object.entries(info).map(([key, value]) => {
    assert.ok(!/[\r\n]/.test(String(value)), `Multiline output: ${key}`);
    return `${key}=${value}\n`;
  });
  appendFileSync(file, lines.join(""));
}

/** 앱 메타데이터에서 나오는 공통 결과 필드. */
export const releaseFields = (config) => ({
  version: config.version,
  productName: config.productName,
  identifier: config.identifier,
  scheme: config.plugins["deep-link"].desktop.schemes[0],
});

const plist = (app, key) =>
  execFileSync(
    "/usr/bin/plutil",
    ["-extract", key, "raw", "-o", "-", join(app, "Contents/Info.plist")],
    { encoding: "utf8" },
  ).trim();

function build() {
  assert.ok(
    process.platform === "darwin" && process.arch === "arm64",
    "Apple Silicon macOS에서만 빌드할 수 있습니다 (그 밖에서는 --dry-run)",
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
  assert.deepEqual(dmgs, [dmgName(release.config)]);
  const info = {
    app,
    dmg: join(bundle, "dmg", dmgs[0]),
    asset: releaseAsset(dmgs[0]),
    ...releaseFields(release.config),
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
  writeGithubOutput(info);
  process.stdout.write(`${JSON.stringify(info, null, 2)}\n`);
}

function dryRun() {
  const release = koreanReleaseConfig();
  process.stdout.write(
    `${JSON.stringify(
      {
        config: release.config,
        environment: buildEnvironment({}, release),
        arguments: tauriArguments("<overlay>.json"),
        dmg: dmgName(release.config),
        asset: releaseAsset(dmgName(release.config)),
        ...releaseFields(release.config),
      },
      null,
      2,
    )}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => arg !== "--dry-run"))
    throw new Error("Usage: build-dmg.mjs [--dry-run]");
  if (args.includes("--dry-run")) dryRun();
  else build();
}

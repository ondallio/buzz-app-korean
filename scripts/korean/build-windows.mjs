// 한글판 Windows x64 NSIS 설치 파일을 서명 없이 빌드한다 (GitHub Actions windows-2025용).
//
// 사용: node scripts/korean/build-windows.mjs            (Windows에서 빌드)
//       node scripts/korean/build-windows.mjs --dry-run  (어느 OS에서나 설정만 출력)
//
// - macOS DMG와 같은 오버레이(desktop-config.mjs)와 빌드 환경(build-dmg.mjs의
//   buildEnvironment)을 쓴다: BUZZ_DISTRIBUTION_ID, 업데이터 off, 서명·개발 입력 제거.
// - 창 설정은 원본 tauri.windows.conf.json 것을 그대로 두고 제목만 바꾼다
//   (--config는 배열을 통째로 바꾸므로 macOS 창 설정이 섞이지 않게).
// - PATH를 건드리지 않는 한글판 전용 NSIS 훅(korean/windows/installer-hooks.nsh)을 쓴다.
// - 빌드한 설치 파일을 실행하지 않는다. 설치 확인은 워크플로가 일회용 러너에서 한다.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildEnvironment,
  releaseAsset,
  releaseFields,
  writeGithubOutput,
} from "./build-dmg.mjs";
import { koreanReleaseConfig } from "./desktop-config.mjs";

export const WINDOWS_TARGET = "x86_64-pc-windows-msvc";
export const INSTALLER_HOOKS = "korean/windows/installer-hooks.nsh";
const ROOT = fileURLToPath(new URL("../../", import.meta.url));

const readJson = (relative) =>
  JSON.parse(readFileSync(join(ROOT, relative), "utf8"));

/** Windows 릴리스 오버레이와 빌드 환경. `root`는 훅 경로를 절대 경로로 만든다. */
export function koreanWindowsConfig({
  root = ROOT,
  base = readJson("src-tauri/tauri.windows.conf.json"),
  ...options
} = {}) {
  const release = koreanReleaseConfig({ ...options, base });
  return {
    ...release,
    config: {
      ...release.config,
      bundle: {
        ...release.config.bundle,
        windows: {
          nsis: {
            // tauri-cli는 src-tauri에서 경로를 풀므로 절대 경로로 넘긴다.
            installerHooks: join(root, INSTALLER_HOOKS),
            languages: ["Korean"],
          },
        },
      },
    },
  };
}

/** tauri build 인자: 서명 없이 NSIS만, x64 고정, 오버레이 적용, Cargo.lock 고정. */
export function windowsTauriArguments(overlay) {
  return [
    "build",
    "--ci",
    "--no-sign",
    "--bundles",
    "nsis",
    "--target",
    WINDOWS_TARGET,
    "--config",
    overlay,
    "--",
    "--locked",
  ];
}

/** Tauri NSIS 파일 이름(`Buzz Korean_1.0.5_x64-setup.exe`). */
export const installerName = ({ productName, version }) =>
  `${productName}_${version}_x64-setup.exe`;

/** GitHub 릴리스 자산 이름: 공백 없이 (`Buzz.Korean_1.0.5_x64-setup.exe`). */
export const releaseAssetName = (config) => releaseAsset(installerName(config));

function build() {
  assert.ok(
    process.platform === "win32" && process.arch === "x64",
    "Windows x64에서만 빌드할 수 있습니다 (macOS에서는 --dry-run)",
  );
  const release = koreanWindowsConfig();
  const { config } = release;
  assert.ok(existsSync(config.bundle.windows.nsis.installerHooks));
  const run = join(
    process.env.RUNNER_TEMP || join(ROOT, ".local/korean-builds"),
    `korean-windows-${Date.now()}`,
  );
  mkdirSync(run, { recursive: true });
  const overlay = join(run, "release.json");
  writeFileSync(overlay, `${JSON.stringify(config, null, 2)}\n`, {
    flag: "wx",
  });
  // pnpm.cmd를 셸로 부르지 않고 Tauri CLI의 JS 진입점을 node로 직접 실행한다.
  const cli = createRequire(join(ROOT, "package.json")).resolve(
    "@tauri-apps/cli/tauri.js",
  );
  const result = spawnSync(
    process.execPath,
    [cli, ...windowsTauriArguments(overlay)],
    {
      cwd: ROOT,
      env: buildEnvironment(process.env, release),
      stdio: "inherit",
    },
  );
  rmSync(run, { recursive: true, force: true });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `tauri build failed (${result.status})`);

  const target = process.env.CARGO_TARGET_DIR || join(ROOT, "target");
  const nsis = join(target, WINDOWS_TARGET, "release/bundle/nsis");
  const installers = readdirSync(nsis).filter((file) => file.endsWith(".exe"));
  assert.deepEqual(installers, [installerName(config)]);
  const info = {
    installer: join(nsis, installers[0]),
    asset: releaseAssetName(config),
    ...releaseFields(config),
  };
  writeGithubOutput(info);
  process.stdout.write(`${JSON.stringify(info, null, 2)}\n`);
}

function dryRun() {
  const release = koreanWindowsConfig();
  const environment = buildEnvironment({}, release);
  process.stdout.write(
    `${JSON.stringify(
      {
        config: release.config,
        environment,
        arguments: windowsTauriArguments("<overlay>.json"),
        installer: installerName(release.config),
        asset: releaseAssetName(release.config),
      },
      null,
      2,
    )}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => arg !== "--dry-run"))
    throw new Error("Usage: build-windows.mjs [--dry-run]");
  if (args.includes("--dry-run")) dryRun();
  else build();
}

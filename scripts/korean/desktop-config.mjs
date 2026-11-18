// 한글판 독립 배포판의 Tauri 설정 오버레이와 네이티브 빌드 입력.
// 네이티브 `BUZZ_DISTRIBUTION_ID`와 짝을 이뤄 identifier·productName·딥링크 스킴을
// 한글판 것으로 바꾼다. 이 모듈은 설정만 만들고 앱을 빌드·실행하지 않는다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const KOREAN_DISTRIBUTION_ID = "ai.codepair.buzz-korean";
export const KOREAN_PRODUCT_NAME = "Buzz Korean";

const ID_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const OFFICIAL_PATTERN = /^(?:xyz\.block\.buzz|dev\.local\.buzz)(?:\.|$)/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/** 배포 ID 검증. 공식 Buzz 네임스페이스나 잘못된 ID는 공식값으로 대체하지 않고 거부한다. */
export function validDistributionId(id) {
  if (
    typeof id !== "string" ||
    id.length > 128 ||
    !ID_PATTERN.test(id) ||
    OFFICIAL_PATTERN.test(id)
  )
    throw new Error("Invalid or official Buzz distribution ID");
  return id;
}

/** identifier·productName·딥링크 스킴 오버레이. 스킴은 0.7 규칙(`buzz-<ID>`) 그대로. */
export function koreanDesktopConfig(
  id = KOREAN_DISTRIBUTION_ID,
  { development = false } = {},
) {
  validDistributionId(id);
  return {
    productName: KOREAN_PRODUCT_NAME,
    identifier: `${id}${development ? ".dev" : ""}`,
    plugins: { "deep-link": { desktop: { schemes: [`buzz-${id}`] } } },
  };
}

/** `korean/upstream.json`의 원본 태그(`v1.0.5`)에서 앱 버전(`1.0.5`)을 읽는다. */
export function upstreamVersion(lock) {
  const version =
    typeof lock?.tag === "string" ? lock.tag.replace(/^v/, "") : "";
  if (!VERSION_PATTERN.test(version))
    throw new Error("korean/upstream.json has no release tag like v1.0.5");
  return version;
}

const readJson = (relative) =>
  JSON.parse(
    readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8"),
  );

/**
 * 로컬 DMG용 릴리스 오버레이와 빌드 환경. 업데이터는 끈다: `plugins.updater`도,
 * `BUZZ_UPDATER_*` 입력도, 업데이터 산출물도 만들지 않는다.
 */
export function koreanReleaseConfig({
  id = KOREAN_DISTRIBUTION_ID,
  base = readJson("src-tauri/tauri.conf.json"),
  version = upstreamVersion(readJson("korean/upstream.json")),
} = {}) {
  const config = koreanDesktopConfig(id);
  if (!VERSION_PATTERN.test(version)) throw new Error("Invalid app version");
  return {
    config: {
      ...config,
      version,
      // Tauri의 --config는 JSON merge patch라 배열을 통째로 바꾼다. 창 설정은
      // 원본 그대로 두고 제목만 바꾼다.
      app: {
        windows: base.app.windows.map((window) => ({
          ...window,
          title: `${config.productName} ${version}`,
        })),
      },
      bundle: { createUpdaterArtifacts: false },
    },
    environment: { BUZZ_DISTRIBUTION_ID: id },
  };
}

// 설정만 출력한다. 가져오거나 호출해도 Tauri를 시작하지 않는다.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => arg !== "--release"))
    throw new Error("Usage: desktop-config.mjs [--release]");
  const output = args.includes("--release")
    ? koreanReleaseConfig()
    : koreanDesktopConfig();
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

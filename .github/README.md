# Buzz 한글판 (비공식)

[Buzz](https://github.com/block/buzz-app) 데스크톱 앱의 **비공식 한국어·영어 버전**입니다.
Block의 공식 배포판이 아니며, 커뮤니티에서 원본 오픈소스에 한글 번역을 입혀 관리합니다.

> 원본: [block/buzz-app](https://github.com/block/buzz-app) · 현재 기준 원본 버전: **v1.0.5** (`korean-v1.0.5`)

## Buzz는 어떤 앱인가요?

팀 채팅과 AI 에이전트를 한곳에서 쓰는 데스크톱 앱입니다. 커뮤니티에 참여해 채널과 DM으로 대화하고,
Claude·Codex·Goose·Pi 같은 에이전트를 내 컴퓨터에서 실행해 대화 안에서 바로 답을 받을 수 있습니다.
자세한 기능은 [원본 README](../README.md)를 참고하세요.

## 한글판에서 달라진 점

- **한국어·영어 전환**: 설정 → 화면 설정 → 언어에서 `한국어` 또는 `English`를 고릅니다.
  처음 실행할 때는 macOS 언어가 한국어면 한국어로 시작합니다.
- 메뉴, 버튼, 안내, 오류, 접근성 이름 등 **앱이 직접 보여주는 문구**를 번역했습니다. (번역 문장 약 6,200개)
- 날짜·시간·숫자는 고른 언어 형식으로 표시합니다. ("오늘", "어제" 등)
- macOS 메뉴 막대와 마이크 권한 안내도 한국어로 나옵니다.
- **번역하지 않는 것**: 사용자가 쓴 메시지, 채널·커뮤니티·에이전트 이름, 명령어, 모델 이름, 파일 경로

### 용어

| 원문 | 한글판 |
| --- | --- |
| Solo | 탭·메뉴는 **1:1**, 문장 안에서는 **1:1 채팅** |
| Team / Channel / Direct message | 팀 / 채널 / 다이렉트 메시지(DM) |
| Agent / Workflow | 에이전트 / 워크플로 |
| Community / Relay | 커뮤니티 / 릴레이 |

사람·에이전트 이름 뒤에는 "님"을 붙여 조사가 어색하지 않게 했습니다. 전체 용어집: [GLOSSARY](../docs/localization/GLOSSARY.md)

## 설치

1. [Releases](https://github.com/ondallio/buzz-app-korean/releases)에서 `Buzz Korean_<버전>_aarch64.dmg`를 내려받습니다. (Apple Silicon Mac 전용)
2. DMG를 열고 `Buzz Korean.app`을 응용 프로그램 폴더로 끌어다 놓습니다.
3. 처음 열 때 "확인되지 않은 개발자" 경고가 나오면 앱을 **우클릭 → 열기**를 누릅니다.
   (또는 시스템 설정 → 개인정보 보호 및 보안 → **그래도 열기**)
4. 첫 화면에서 새 계정을 만들거나, 기존 비밀 키(`nsec1…`)를 붙여넣어 시작합니다.

**공식 Buzz와 따로 동작합니다.** 한글판은 별도 식별자(`ai.codepair.buzz-korean`)를 쓰므로
공식 Buzz와 나란히 설치할 수 있고, 공식 Buzz의 키체인·데이터·`buzz://` 링크를 읽거나 바꾸지 않습니다.
그래서 공식 Buzz의 계정이 자동으로 넘어오지 않습니다. 같은 계정을 쓰려면 공식 Buzz의
설정 → 신원에서 비밀 키를 복사해 한글판 첫 화면에 붙여넣으세요.

- 앱에는 Apple 개발자 서명·공증이 없습니다. 내려받은 파일의 SHA-256 값은 릴리스 설명에 있습니다.
- 앱 안의 자동 업데이트는 꺼져 있습니다. 새 버전은 Releases에서 내려받아 덮어 설치합니다.

### 소스에서 빌드

```sh
git clone https://github.com/ondallio/buzz-app-korean.git
cd buzz-app-korean
bin/node scripts/korean/build-dmg.mjs   # 서명 없는 한글판 DMG
```

`bin/` 폴더의 [Hermit](https://cashapp.github.io/hermit/)이 Node, pnpm, Rust 등 필요한 도구 버전을 자동으로 맞춥니다.
데스크톱 빌드에는 [Tauri 준비 사항](https://v2.tauri.app/start/prerequisites/)이 필요합니다.

## 업데이트 방식

원본의 **정식 릴리스(vX.Y.Z)를 따라갑니다.** 미리보기·베타 버전은 따라가지 않습니다.

1. GitHub Actions가 6시간마다 원본의 새 정식 릴리스를 확인합니다.
2. 충돌 없이 합쳐지면 검사(타입·린트·번역·테스트)를 돌리고 PR을 엽니다.
   PR에는 **원본에서 바뀐 영어 문장**과 **새로 생긴 영어 문구** 목록이 함께 실립니다.
3. 번역을 보완해 PR을 합치면 `korean-v<원본버전>` 태그가 자동으로 붙습니다. (예: 원본 `v1.0.5` → `korean-v1.0.5`)
4. 충돌이 나면 이슈를 열고 멈춥니다. 직접 해결한 뒤 `scripts/korean/finish-sync.mjs`로 마무리합니다.

관련 파일: [`korean/upstream.json`](../korean/upstream.json) (현재 기준 원본 버전),
[`scripts/korean/`](../scripts/korean/), [`.github/workflows/korean-sync.yml`](workflows/korean-sync.yml)

## 번역에 참여하기

- 번역 문장은 [`src/shared/i18n/catalogs/`](../src/shared/i18n/catalogs/)에 있습니다. 파일마다 `en`(원문)과 `ko`(번역)가 짝을 이룹니다.
- 고친 뒤 다음 검사를 통과해야 합니다.
  ```sh
  bin/node scripts/localization/check-catalogs.mjs
  bin/pnpm check
  ```
- 어색한 번역이나 영어로 남은 화면은 [이슈](https://github.com/ondallio/buzz-app-korean/issues)로 알려주세요.

## 라이선스

원본과 같은 [Apache License 2.0](../LICENSE)을 따릅니다. 원본 저작권 고지는 [NOTICE](../NOTICE.md)에 있습니다.
"Buzz"와 관련 상표는 Block, Inc.의 것이며, 이 저장소는 Block과 관계없는 비공식 커뮤니티 배포입니다.

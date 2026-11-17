# 한글판 공식 업데이트 제안

`.github/workflows/upstream-proposal.yml`은 **main에 병합된 뒤** 매일
01:17 UTC(한국 10:17)에 실행됩니다. Actions의 **Korean upstream proposal →
Run workflow**로 main에서 수동 실행할 수도 있습니다. 이 PR을 열어 놓는 것만으로
예약이 활성화되지는 않습니다. Mac을 켜 둘 필요는 없습니다.

## 하는 일

1. 공식 preview 피드, 공개 릴리스, 태그 커밋, `SOURCE_COMMIT`을 대조합니다.
   기존 `v0.7.0-preview.275.1`과 새 `v1.0.5-preview.1` 형식을 지원합니다.
2. 버전이 같으면 브랜치·PR·빌드 없이 끝냅니다. 이미 열린
   `claude/upstream-*` 또는 `automation/upstream-*` PR이 있으면 중복 작업하지 않습니다.
   같은 후보 브랜치가 남아 있어도 덮어쓰거나 닫힌 PR을 다시 열지 않습니다.
3. 새 버전은 임시 checkout에서 병합을 시도합니다. 충돌은 자동으로 해결하지 않고
   중단합니다. `.github/`, `.agents/`, `AGENTS.md`, `scripts/beta/`,
   `beta-channel.json`, `FOUNDATION:` 표시 파일의 upstream 변경도 수동 검토 대상으로 중단합니다.
4. 깨끗한 병합만 공식 소스 pin·한글판 버전·README를 함께 갱신합니다.
   공개 업데이트 URL과 검증 키는 유지합니다.
5. lint/types/design 검사, frontend build, beta integration tests, i18n unit tests를
   실행합니다. 하나라도 실패하면 후보를 원격에 올리지 않고 PR도 만들지 않습니다.
6. 성공한 후보만 별도 runner에서 새 브랜치와 **draft PR**로 공개합니다.
   그 사이 main이 바뀌거나 다른 업데이트 PR이 생기면 중단합니다.

## 하지 않는 일

자동 병합, 릴리스, 서명, 배포, 업데이트 피드 변경, 설치된 Mac 앱 변경,
자동 번역 또는 충돌 해결을 하지 않습니다. 새 영어 문구와 화면은 사람이 검토해야 합니다.
기존 PR #1/#2와 다른 작업 브랜치는 수정하거나 닫지 않습니다.

후보 코드를 실행하는 runner에는 쓰기 토큰이나 서명 비밀 키가 없습니다.
별도 PR 발행 job만 해당 저장소의 contents/pull-requests 쓰기 권한을 사용합니다.
새 PAT, GitHub App, 저장소 보안 설정 변경은 필요하지 않습니다.
저장소 정책이 GITHUB_TOKEN의 PR 생성을 금지한다면 오류로 멈춥니다.
그 설정을 자동으로 바꾸지 않습니다.

## 검사 범위와 실패 확인

Actions 실행 요약에 감지 버전, 중단 이유, 충돌/보호 파일 목록이 표시됩니다.
실패를 성공으로 처리하거나 자동 재시도하지 않습니다. 다음 날 다시 확인합니다.
같은 후보 브랜치가 이미 있으면 자동 재게시하지 않으므로, PR 생성 직전 오류로
브랜치만 만들어진 경우 사람에게 확인받아 그 브랜치에서 PR을 열어야 합니다.

GitHub는 GITHUB_TOKEN이 생성한 PR의 일반 `pull_request` CI를 자동 시작하지 않습니다.
따라서 PR 본문이 링크한 **Korean upstream proposal 실행**이 자동 검사 증거입니다.
이 검사에는 전체 브라우저/Rust CI, macOS 빌드·서명, 화면·번역 검토가 포함되지 않습니다.
병합 전 사람의 검토와 전체 CI가 필요합니다. 사람이 GitHub에서 PR을 닫았다 다시 열면
`pull_request` CI가 시작될 수 있지만, 실제 실행을 확인해야 합니다.
기존 CI의 수동 실행은 Windows 검사 전용이므로 전체 CI 대용으로 안내하지 않습니다.

## 개발 검증

```sh
bin/node --test tests/integration/beta-{policy,upstream,proposal}.test.mjs
bin/node scripts/beta/upstream.mjs
```

첫 명령은 임시 Git 저장소와 가짜 공개 응답으로 변경 없음·새 버전·중복 PR·충돌·
보호 파일·잘못된 입력을 검사합니다. 두 번째는 공개 upstream을 실제로 조회하지만
저장소나 앱을 변경하지 않습니다. workflow의 job 실패 차단 구조는 별도 정적 검사로
확인합니다. 실제 hosted 실패/PR 생성/권한은 Actions 실행 전에는 검증된 것이 아닙니다.

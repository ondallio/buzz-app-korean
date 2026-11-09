export const en = {
  "pluginManagement.access.program": "Program: {program}",
  "pluginManagement.access.arguments": "Arguments:",
  "pluginManagement.access.noArguments": "Arguments: none",
  "pluginManagement.access.argument": "Argument {index}",
  "pluginManagement.access.command": "Command {id}:",
  "pluginManagement.access.run": "Run {program}",
  "pluginManagement.access.commandHint": "Run a program on your computer.",
  "pluginManagement.access.inputNone": "Input: none",
  "pluginManagement.access.inputBytes": "Input: up to {count} bytes",
  "pluginManagement.access.outputBytes": "Output: up to {count} bytes",
  "pluginManagement.access.details": "{name} details",
  "pluginManagement.access.removedDetails": "Removed {name} details",
  "pluginManagement.access.executionTitle": "Agent execution:",
  "pluginManagement.access.executionLabel": "Run {name} on another host",
  "pluginManagement.access.executionHint":
    "Can run native agent code and read files on that host. Buzz keeps the agent's identity.",
  "pluginManagement.access.hooksTitle": "Agent hooks:",
  "pluginManagement.access.hooksLabel": "Observe and influence {name}",
  "pluginManagement.access.hooksHint":
    "Can read hook events and change or block agent actions.",
  "pluginManagement.access.originTitle": "HTTPS origin:",
  "pluginManagement.access.originName": "HTTPS origin {origin}",
  "pluginManagement.access.originLabel": "Connect to {origin}",
  "pluginManagement.access.originHint":
    "Buzz can make HTTPS requests to this address for the plugin.",
  "pluginManagement.access.federatedTitle": "Federated authority {authority}:",
  "pluginManagement.access.federatedHint":
    "Buzz can call this route with your community session for the plugin.",
  "pluginManagement.access.processTitle": "Process {id}:",
  "pluginManagement.access.processLabel": "Start {program}",
  "pluginManagement.access.processHint":
    "Can start a background process with additional arguments, using your account’s full access.",
  "pluginManagement.access.bundled": "Bundled with Buzz.",
  "pluginManagement.access.artifact": "Executable artifact: {path}",
  "pluginManagement.access.sha256": "SHA-256: {hash}",
  "pluginManagement.access.sibling": "Sibling {name}: {hash}",
  "pluginManagement.access.processAccess":
    "Allows further arguments and standard input, with your account’s full access.",
  "pluginManagement.access.mcpTitle": "MCP servers:",
  "pluginManagement.access.mcpLabel": "Provide tools to local agents",
  "pluginManagement.access.mcpHint":
    "Exposes plugin tools through Buzz’s local MCP server.",
  "pluginManagement.access.mcpDetails":
    "Tools served to local agents over loopback HTTP.",
  "pluginManagement.access.managedTitle": "Managed files:",
  "pluginManagement.access.managedLabel": "Save temporary plugin files",
  "pluginManagement.access.managedHint":
    "Save up to 16 MiB at a time in host-selected private storage, without file-reading access.",
  "pluginManagement.access.managedDetails":
    "Shared storage is limited to 64 MiB and 16 files; any plugin can fill it. Files normally remain for 24 hours, survive plugin unload and app restart, and are removed on a later save after expiry. Explicit app-data erase or user deletion can remove them sooner. This does not grant file reading or arbitrary-path writes.",
  "pluginManagement.access.filesTitle": "Files:",
  "pluginManagement.access.filesLabel": "Read your files",
  "pluginManagement.access.filesHint":
    "Can read any file your account can, and create folders it resolves.",
  "pluginManagement.access.filesDetails":
    "Reads files and resolves folders with your account’s full access.",
  "pluginManagement.access.changed": "{label} (changed)",
  "pluginManagement.access.added": "{label} (added)",
  "pluginManagement.access.removed": "Removed: {label}",
  "pluginManagement.access.previously": "Previously",
  "pluginManagement.access.afterUpdate": "After this update",
  "pluginManagement.access.declared": "Declared scopes",
  "pluginManagement.access.noAdditional":
    "No additional capabilities declared.",
  "pluginManagement.access.computer": "Computer access",
  "pluginManagement.access.changes": "Declared access changes",
  "pluginManagement.access.noChanges": "No declared access changes",
  "pluginManagement.access.addedGroup": "Added",
  "pluginManagement.access.changedGroup": "Changed",
  "pluginManagement.access.removedGroup": "Removed",
  "pluginManagement.access.addedDeclarations": "Added declarations",
  "pluginManagement.access.changedDeclarations": "Changed declarations",
  "pluginManagement.access.removedDeclarations": "Removed declarations",
  "pluginManagement.access.updateTrust":
    "Plugins can access your computer beyond these declarations. Only update code you trust.",
  "pluginManagement.access.computerHint":
    "Can access files and run programs on your computer.",
  "pluginManagement.access.safety": "Plugin safety",
  "pluginManagement.access.beyondTitle": "Access beyond this list",
  "pluginManagement.access.notSandboxed":
    "Plugins aren’t sandboxed. They can access your computer beyond these declarations, even when no additional capabilities are listed.",
  "pluginManagement.access.notLimits":
    "These declarations describe what the plugin asks Buzz to do. They don’t limit what its code can do.",
  "pluginManagement.access.unchanged": "View unchanged declarations",
  "pluginManagement.add": "Add",
  "pluginManagement.update": "Update",
  "pluginManagement.enable": "Enable plugin",
  "pluginManagement.install": "Install plugin",
  "pluginManagement.back": "Back",
  "pluginManagement.tryAgain": "Try again",
  "pluginManagement.done": "Done",
  "pluginManagement.continue": "Continue",
  "pluginManagement.openBuzz": "Open in Buzz",
  "pluginManagement.cancel": "Cancel",
  "pluginManagement.close": "Close",
  "pluginManagement.retry": "Retry",
  "pluginManagement.plugin": "plugin",
  "pluginManagement.unknown": "Unknown",
  "pluginManagement.unsigned": "Unsigned",
  "pluginManagement.repositoryDefault": "Repository default",
  "pluginManagement.updateNamed": "Update {name}",
  "pluginManagement.updatingNamed": "Updating {name}",
  "pluginManagement.reviewAccess": "Review {plugin} access",
  "pluginManagement.pluginName": "{name} Plugin",
  "pluginManagement.reviewNamed": "Review {name}",
  "pluginManagement.rollbackWarning":
    "You cannot roll back to the unsigned revision after this update.",
  "pluginManagement.conflictKnown":
    "{name} is already installed from {source}; remove it first to install it from {destination}.",
  "pluginManagement.conflictUnknown":
    "{name} is already installed from an unknown source; remove it first to install it from {destination}.",
  "pluginManagement.import.pinMismatch":
    "This repository is not at the commit that was requested. Nothing was installed.",
  "pluginManagement.import.noUpdateSourceTry":
    "No update source found. Try again.",
  "pluginManagement.import.savedMissing":
    "The saved folder or repository no longer contains this plugin at its installed path.",
  "pluginManagement.import.installedMissing":
    "This source does not contain the installed plugin. Choose a source with the same plugin ID.",
  "pluginManagement.import.missingPath":
    "This repository has no plugin at {path}. Nothing was installed.",
  "pluginManagement.import.noUpdateSource": "No update source found",
  "pluginManagement.import.savedRepositoryMissing":
    "The saved repository no longer contains this plugin at its installed path.",
  "pluginManagement.import.sourceChanged":
    "The plugin source changed. Close this review and check again.",
  "pluginManagement.installUnconfirmed":
    "Plugin installation wasn’t confirmed. Check the preview and try again.",
  "pluginManagement.import.dropOne": "Drop one folder, or choose Browse.",
  "pluginManagement.import.errorPrefix": "Error: {message}",
  "pluginManagement.import.updates": "Plugin updates",
  "pluginManagement.sourceRepository": "Source repository",
  "pluginManagement.sourceFolder": "Source folder",
  "pluginManagement.source": "Source",
  "pluginManagement.import.noSavedSource":
    "No saved source. Choose a folder or repository to update this plugin.",
  "pluginManagement.import.checking": "Checking for updates…",
  "pluginManagement.import.checkUpdates": "Check for updates",
  "pluginManagement.import.sourceRepositoryUnavailable":
    "Source repository unavailable. {error}",
  "pluginManagement.import.sourceFolderUnavailable":
    "Source folder unavailable. {error}",
  "pluginManagement.upToDate": "Up to date",
  "pluginManagement.import.unchangedTitle": "Unchanged declarations",
  "pluginManagement.import.updateTitle": "Update plugin",
  "pluginManagement.import.addTitle": "Add a plugin",
  "pluginManagement.import.alreadyInstalled": "Already installed",
  "pluginManagement.import.choose": "Choose a plugin",
  "pluginManagement.import.none": "No plugins found",
  "pluginManagement.import.updateWarning":
    "Save unfinished forms and stop active plugin workers before you update. Updating an enabled plugin reloads it immediately.",
  "pluginManagement.import.trust": "Only install code you trust.",
  "pluginManagement.import.chooseHelp":
    "Select a plugin to review before installing.",
  "pluginManagement.import.tryAnother": "Try another folder or repository.",
  "pluginManagement.import.builtHelp":
    "Load built plugins containing manifest.json and plugin.js. Buzz doesn’t build source code or run install scripts.",
  "pluginManagement.stayDisabled": "This plugin will stay disabled.",
  "pluginManagement.updating": "Updating plugin…",
  "pluginManagement.installing": "Installing plugin…",
  "pluginManagement.import.fromFolder": "Add from folder",
  "pluginManagement.import.dropHint": "Drop a plugin folder here",
  "pluginManagement.import.browseAria": "Browse plugin folder",
  "pluginManagement.import.browse": "Browse",
  "pluginManagement.import.fromGit": "Add from Git",
  "pluginManagement.import.repository": "Git or GitHub repository",
  "pluginManagement.import.reference": "Branch or tag (optional)",
  "pluginManagement.import.openedFrom": "Opened from {requester}.",
  "pluginManagement.import.openedLink": "Opened from a link.",
  "pluginManagement.import.pinnedHelp":
    "Pinned to commit {commit}. Nothing is installed unless the fetched repository matches it.",
  "pluginManagement.import.folderHint": "Plugin folder: {path}.",
  "pluginManagement.import.reviewFind":
    "Review the source, then choose Find to read it. Nothing is installed until you confirm.",
  "pluginManagement.import.confirmOnly":
    "Nothing is installed until you confirm.",
  "pluginManagement.import.gitHelp":
    "HTTPS or SSH; GitHub owner/repository also works. SSH uses your agent and known hosts. Password prompts and credential helpers are not used. Buzz git repositories in this community sign in with your account.",
  "pluginManagement.import.findAria": "Find plugins",
  "pluginManagement.import.find": "Find",
  "pluginManagement.import.reading":
    "Reading plugin folders… Git imports may take up to a minute.",
  "pluginManagement.import.preview": "Plugin import preview",
  "pluginManagement.sourceDetail": "Source: {source}",
  "pluginManagement.commitDetail": "Commit: {commit}",
  "pluginManagement.import.noBuilt":
    "No built plugins found. Build the plugin first, then choose its output folder, or use a repository that includes built artifacts.",
  "pluginManagement.import.skipped": "Skipped folders",
  "pluginManagement.import.skippedCount": "Folders skipped ({count})",
  "pluginManagement.import.skippedHelp":
    "These folders couldn’t be loaded as plugins. Other listed plugins can still be installed.",
  "pluginManagement.import.publisher":
    "Publisher: {current}. Previous publisher: {previous}.",
  "pluginManagement.import.updateSource": "Update source",
  "pluginManagement.import.commit": "Commit {commit}",
  "pluginManagement.import.commitMatches":
    "Commit {commit} (matches the requested commit)",
  "pluginManagement.import.installedHelp":
    "This plugin is already installed. Open its details to manage it.",
  "pluginManagement.bundledHelp":
    "This plugin is included with Buzz. Update Buzz to get its latest version.",
  "pluginManagement.managed.unavailable": "Recommended plugins unavailable",
  "pluginManagement.managed.invalidFile":
    "Buzz couldn’t use the managed plugin file {path}. {reason}",
  "pluginManagement.managed.recommendedBy": "Recommended by {source}",
  "pluginManagement.managed.recommended": "Recommended plugins",
  "pluginManagement.managed.otherSource":
    "Installed from a different source. Remove it to review the recommended version. {location}",
  "pluginManagement.managed.updateLocation": "Update recommended. {location}",
  "pluginManagement.managed.reviewInstall": "Review and install",
  "pluginManagement.managed.reviewUpdate": "Review update",
  "pluginManagement.managed.reviewInstallNamed": "Review and install {id}",
  "pluginManagement.managed.reviewUpdateNamed": "Review update {id}",
  "pluginManagement.managed.ignored":
    "Some entries in the managed plugin file were ignored:",
  "pluginManagement.managed.updates": "Managed updates",
  "pluginManagement.managed.different":
    "{source} recommends a different version of this plugin.",
  "pluginManagement.managed.follow":
    "Updates follow the recommendation from {source}.",
  "pluginManagement.managed.noUrlPlugin": "No plugin found at this URL.",
  "pluginManagement.managed.wrongUrl":
    "The plugin at this URL is {found}, not {wanted}.",
  "pluginManagement.managed.noSource": "No plugin source found.",
  "pluginManagement.managed.wrongCommit":
    "The repository returned commit {actual}, not the recommended commit {wanted}.",
  "pluginManagement.managed.wrongUnknownCommit":
    "The repository returned commit unknown, not the recommended commit {wanted}.",
  "pluginManagement.managed.wrongPath":
    "The plugin at {path} is {found}, not {wanted}.",
  "pluginManagement.managed.missingPath":
    "This commit has no plugin at {path}.",
  "pluginManagement.managed.requestTrust":
    "Requested by {name}. Only install code you trust.",
  "pluginManagement.managed.recommendTrust":
    "Recommended by {source}. Only install code you trust.",
  "pluginManagement.managed.downloading": "Downloading the plugin…",
  "pluginManagement.managed.reading":
    "Reading the plugin at the pinned commit… Git imports may take up to a minute.",
  "pluginManagement.managed.source": "Managed plugin source",
  "pluginManagement.managed.sameRevision":
    "This plugin’s code already matches this revision. Updating records {source}’s recommended source and keeps the plugin as it is.",
  "pluginManagement.managed.sourceUrl": "Source URL",
  "pluginManagement.managed.pinnedFile":
    "This plugin was installed from a single pinned file. To update it, install the newer version from the plugin marketplace or a new install link.",
  "pluginManagement.updates.cannotCheck": "Cannot check {name}",
  "pluginManagement.updates.warning":
    "Save unfinished forms and stop active plugin workers first. Updating an enabled plugin reloads it immediately.",
  "pluginManagement.updates.dismiss": "Dismiss plugin update notice",
  "pluginManagement.updates.manageChecks": "Manage {name} update checks",
  "pluginManagement.updates.reviewPermissions": "Review permissions",
  "pluginManagement.updates.reload": "Update and reload",
  "pluginManagement.updates.later": "Later",
  "pluginManagement.updates.cannotStart": "{name} cannot start",
  "pluginManagement.updates.retryActivation": "Retry activation",
  "pluginManagement.updates.recovery": "Plugin recovery actions",
  "pluginManagement.updates.plugins": "Plugins",
  "pluginManagement.updates.retryNamed": "Retry update {name}",
  "pluginManagement.updates.manage": "Manage plugins",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "pluginManagement.access.program": "프로그램: {program}",
  "pluginManagement.access.arguments": "인수:",
  "pluginManagement.access.noArguments": "인수: 없음",
  "pluginManagement.access.argument": "인수 {index}",
  "pluginManagement.access.command": "명령 {id}:",
  "pluginManagement.access.run": "{program} 실행",
  "pluginManagement.access.commandHint": "이 컴퓨터에서 프로그램을 실행합니다.",
  "pluginManagement.access.inputNone": "입력: 없음",
  "pluginManagement.access.inputBytes": "입력: 최대 {count}바이트",
  "pluginManagement.access.outputBytes": "출력: 최대 {count}바이트",
  "pluginManagement.access.details": "{name} 세부 정보",
  "pluginManagement.access.removedDetails": "제거된 {name} 세부 정보",
  "pluginManagement.access.executionTitle": "에이전트 실행:",
  "pluginManagement.access.executionLabel": "다른 호스트에서 {name} 실행",
  "pluginManagement.access.executionHint":
    "해당 호스트에서 네이티브 에이전트 코드를 실행하고 파일을 읽을 수 있습니다. Buzz는 에이전트의 신원을 유지합니다.",
  "pluginManagement.access.hooksTitle": "에이전트 훅:",
  "pluginManagement.access.hooksLabel": "{name} 관찰 및 동작 제어",
  "pluginManagement.access.hooksHint":
    "훅 이벤트를 읽고 에이전트의 동작을 변경하거나 차단할 수 있습니다.",
  "pluginManagement.access.originTitle": "HTTPS 출처:",
  "pluginManagement.access.originName": "HTTPS 출처 {origin}",
  "pluginManagement.access.originLabel": "{origin}에 연결",
  "pluginManagement.access.originHint":
    "Buzz가 플러그인을 위해 이 주소에 HTTPS 요청을 보낼 수 있습니다.",
  "pluginManagement.access.federatedTitle": "연합 인증 기관 {authority}:",
  "pluginManagement.access.federatedHint":
    "Buzz가 플러그인을 위해 커뮤니티 세션을 사용하여 이 경로를 호출할 수 있습니다.",
  "pluginManagement.access.processTitle": "프로세스 {id}:",
  "pluginManagement.access.processLabel": "{program} 시작",
  "pluginManagement.access.processHint":
    "계정의 전체 접근 권한으로 추가 인수를 전달하여 백그라운드 프로세스를 시작할 수 있습니다.",
  "pluginManagement.access.bundled": "Buzz에 포함되어 있습니다.",
  "pluginManagement.access.artifact": "실행 파일 아티팩트: {path}",
  "pluginManagement.access.sha256": "SHA-256: {hash}",
  "pluginManagement.access.sibling": "동반 파일 {name}: {hash}",
  "pluginManagement.access.processAccess":
    "계정의 전체 접근 권한으로 추가 인수와 표준 입력을 허용합니다.",
  "pluginManagement.access.mcpTitle": "MCP 서버:",
  "pluginManagement.access.mcpLabel": "로컬 에이전트에 도구 제공",
  "pluginManagement.access.mcpHint":
    "Buzz의 로컬 MCP 서버를 통해 플러그인 도구를 제공합니다.",
  "pluginManagement.access.mcpDetails":
    "루프백 HTTP를 통해 로컬 에이전트에 도구를 제공합니다.",
  "pluginManagement.access.managedTitle": "관리 파일:",
  "pluginManagement.access.managedLabel": "임시 플러그인 파일 저장",
  "pluginManagement.access.managedHint":
    "파일 읽기 권한 없이 호스트가 선택한 전용 저장소에 한 번에 최대 16 MiB를 저장합니다.",
  "pluginManagement.access.managedDetails":
    "공유 저장소는 64 MiB와 파일 16개로 제한되며, 어느 플러그인이든 이 공간을 모두 사용할 수 있습니다. 파일은 일반적으로 24시간 동안 유지되고 플러그인을 해제하거나 앱을 재시작해도 남아 있습니다. 보관 기간이 지난 뒤 다음 저장 시 삭제됩니다. 앱 데이터를 지우거나 사용자가 삭제하면 더 일찍 제거될 수 있습니다. 파일 읽기나 임의 경로에 쓰는 권한은 부여하지 않습니다.",
  "pluginManagement.access.filesTitle": "파일:",
  "pluginManagement.access.filesLabel": "파일 읽기",
  "pluginManagement.access.filesHint":
    "계정으로 읽을 수 있는 모든 파일을 읽고, 확인된 폴더를 생성할 수 있습니다.",
  "pluginManagement.access.filesDetails":
    "계정의 전체 접근 권한으로 파일을 읽고 폴더를 확인합니다.",
  "pluginManagement.access.changed": "{label} (변경됨)",
  "pluginManagement.access.added": "{label} (추가됨)",
  "pluginManagement.access.removed": "제거됨: {label}",
  "pluginManagement.access.previously": "이전",
  "pluginManagement.access.afterUpdate": "업데이트 후",
  "pluginManagement.access.declared": "선언된 범위",
  "pluginManagement.access.noAdditional": "추가로 선언된 기능이 없습니다.",
  "pluginManagement.access.computer": "컴퓨터 접근 권한",
  "pluginManagement.access.changes": "선언된 접근 권한 변경",
  "pluginManagement.access.noChanges": "선언된 접근 권한 변경 없음",
  "pluginManagement.access.addedGroup": "추가됨",
  "pluginManagement.access.changedGroup": "변경됨",
  "pluginManagement.access.removedGroup": "제거됨",
  "pluginManagement.access.addedDeclarations": "추가된 선언",
  "pluginManagement.access.changedDeclarations": "변경된 선언",
  "pluginManagement.access.removedDeclarations": "제거된 선언",
  "pluginManagement.access.updateTrust":
    "플러그인은 이 선언 범위를 넘어 컴퓨터에 접근할 수 있습니다. 신뢰하는 코드만 업데이트하세요.",
  "pluginManagement.access.computerHint":
    "이 컴퓨터의 파일에 접근하고 프로그램을 실행할 수 있습니다.",
  "pluginManagement.access.safety": "플러그인 안전성",
  "pluginManagement.access.beyondTitle": "목록에 없는 접근 권한",
  "pluginManagement.access.notSandboxed":
    "플러그인은 샌드박스로 격리되지 않습니다. 추가 기능이 나열되지 않았더라도 이 선언 범위를 넘어 컴퓨터에 접근할 수 있습니다.",
  "pluginManagement.access.notLimits":
    "이 선언은 플러그인이 Buzz에 요청하는 기능을 설명합니다. 플러그인 코드가 할 수 있는 일을 제한하지는 않습니다.",
  "pluginManagement.access.unchanged": "변경되지 않은 선언 보기",
  "pluginManagement.add": "추가",
  "pluginManagement.update": "업데이트",
  "pluginManagement.enable": "플러그인 활성화",
  "pluginManagement.install": "플러그인 설치",
  "pluginManagement.back": "뒤로",
  "pluginManagement.tryAgain": "다시 시도",
  "pluginManagement.done": "완료",
  "pluginManagement.continue": "계속",
  "pluginManagement.openBuzz": "Buzz에서 열기",
  "pluginManagement.cancel": "취소",
  "pluginManagement.close": "닫기",
  "pluginManagement.retry": "다시 시도",
  "pluginManagement.plugin": "플러그인",
  "pluginManagement.unknown": "알 수 없음",
  "pluginManagement.unsigned": "서명 없음",
  "pluginManagement.repositoryDefault": "저장소 기본값",
  "pluginManagement.updateNamed": "{name} 업데이트",
  "pluginManagement.updatingNamed": "{name} 업데이트 중",
  "pluginManagement.reviewAccess": "{plugin} 접근 권한 검토",
  "pluginManagement.pluginName": "{name} 플러그인",
  "pluginManagement.reviewNamed": "{name} 검토",
  "pluginManagement.rollbackWarning":
    "이 업데이트 이후에는 서명되지 않은 리비전으로 되돌릴 수 없습니다.",
  "pluginManagement.conflictKnown":
    "{name}은(는) 이미 {source}에서 설치되어 있습니다. {destination}에서 설치하려면 먼저 제거하세요.",
  "pluginManagement.conflictUnknown":
    "{name}은(는) 이미 알 수 없는 출처에서 설치되어 있습니다. {destination}에서 설치하려면 먼저 제거하세요.",
  "pluginManagement.import.pinMismatch":
    "이 저장소가 요청된 커밋과 일치하지 않습니다. 설치된 항목은 없습니다.",
  "pluginManagement.import.noUpdateSourceTry":
    "업데이트 출처를 찾지 못했습니다. 다시 시도하세요.",
  "pluginManagement.import.savedMissing":
    "저장된 폴더 또는 저장소의 설치 경로에 더 이상 이 플러그인이 없습니다.",
  "pluginManagement.import.installedMissing":
    "이 출처에는 설치된 플러그인이 없습니다. 플러그인 ID가 같은 출처를 선택하세요.",
  "pluginManagement.import.missingPath":
    "이 저장소의 {path} 경로에는 플러그인이 없습니다. 설치된 항목은 없습니다.",
  "pluginManagement.import.noUpdateSource": "업데이트 출처를 찾지 못했습니다",
  "pluginManagement.import.savedRepositoryMissing":
    "저장된 저장소의 설치 경로에 더 이상 이 플러그인이 없습니다.",
  "pluginManagement.import.sourceChanged":
    "플러그인 출처가 변경되었습니다. 검토 창을 닫고 다시 확인하세요.",
  "pluginManagement.installUnconfirmed":
    "플러그인 설치를 확인하지 못했습니다. 미리보기를 확인하고 다시 시도하세요.",
  "pluginManagement.import.dropOne":
    "폴더 하나를 끌어 놓거나 찾아보기를 선택하세요.",
  "pluginManagement.import.errorPrefix": "오류: {message}",
  "pluginManagement.import.updates": "플러그인 업데이트",
  "pluginManagement.sourceRepository": "원본 저장소",
  "pluginManagement.sourceFolder": "원본 폴더",
  "pluginManagement.source": "출처",
  "pluginManagement.import.noSavedSource":
    "저장된 출처가 없습니다. 이 플러그인을 업데이트할 폴더 또는 저장소를 선택하세요.",
  "pluginManagement.import.checking": "업데이트 확인 중…",
  "pluginManagement.import.checkUpdates": "업데이트 확인",
  "pluginManagement.import.sourceRepositoryUnavailable":
    "원본 저장소를 사용할 수 없습니다. {error}",
  "pluginManagement.import.sourceFolderUnavailable":
    "원본 폴더를 사용할 수 없습니다. {error}",
  "pluginManagement.upToDate": "최신 상태",
  "pluginManagement.import.unchangedTitle": "변경되지 않은 선언",
  "pluginManagement.import.updateTitle": "플러그인 업데이트",
  "pluginManagement.import.addTitle": "플러그인 추가",
  "pluginManagement.import.alreadyInstalled": "이미 설치됨",
  "pluginManagement.import.choose": "플러그인 선택",
  "pluginManagement.import.none": "플러그인을 찾지 못했습니다",
  "pluginManagement.import.updateWarning":
    "업데이트 전에 작성 중인 내용을 저장하고 실행 중인 플러그인 작업을 중지하세요. 활성화된 플러그인을 업데이트하면 즉시 다시 로드됩니다.",
  "pluginManagement.import.trust": "신뢰하는 코드만 설치하세요.",
  "pluginManagement.import.chooseHelp":
    "설치 전에 검토할 플러그인을 선택하세요.",
  "pluginManagement.import.tryAnother":
    "다른 폴더 또는 저장소를 사용해 보세요.",
  "pluginManagement.import.builtHelp":
    "manifest.json과 plugin.js가 포함된 빌드된 플러그인을 불러옵니다. Buzz는 소스 코드를 빌드하거나 설치 스크립트를 실행하지 않습니다.",
  "pluginManagement.stayDisabled": "이 플러그인은 비활성화 상태로 유지됩니다.",
  "pluginManagement.updating": "플러그인 업데이트 중…",
  "pluginManagement.installing": "플러그인 설치 중…",
  "pluginManagement.import.fromFolder": "폴더에서 추가",
  "pluginManagement.import.dropHint": "플러그인 폴더를 여기에 끌어 놓으세요",
  "pluginManagement.import.browseAria": "플러그인 폴더 찾아보기",
  "pluginManagement.import.browse": "찾아보기",
  "pluginManagement.import.fromGit": "Git에서 추가",
  "pluginManagement.import.repository": "Git 또는 GitHub 저장소",
  "pluginManagement.import.reference": "브랜치 또는 태그 (선택사항)",
  "pluginManagement.import.openedFrom": "{requester}에서 열었습니다.",
  "pluginManagement.import.openedLink": "링크에서 열었습니다.",
  "pluginManagement.import.pinnedHelp":
    "커밋 {commit}에 고정되어 있습니다. 가져온 저장소가 일치해야 설치할 수 있습니다.",
  "pluginManagement.import.folderHint": "플러그인 폴더: {path}.",
  "pluginManagement.import.reviewFind":
    "출처를 검토한 뒤 찾기를 선택하여 불러오세요. 확인하기 전에는 설치되지 않습니다.",
  "pluginManagement.import.confirmOnly": "확인하기 전에는 설치되지 않습니다.",
  "pluginManagement.import.gitHelp":
    "HTTPS 또는 SSH를 사용하며 GitHub 소유자/저장소 형식도 지원합니다. SSH는 사용자의 에이전트와 알려진 호스트를 사용합니다. 비밀번호 입력 창과 자격 증명 도우미는 사용하지 않습니다. 이 커뮤니티의 Buzz Git 저장소에는 사용자의 계정으로 로그인합니다.",
  "pluginManagement.import.findAria": "플러그인 찾기",
  "pluginManagement.import.find": "찾기",
  "pluginManagement.import.reading":
    "플러그인 폴더를 읽는 중… Git에서 가져오기는 최대 1분이 걸릴 수 있습니다.",
  "pluginManagement.import.preview": "플러그인 가져오기 미리보기",
  "pluginManagement.sourceDetail": "출처: {source}",
  "pluginManagement.commitDetail": "커밋: {commit}",
  "pluginManagement.import.noBuilt":
    "빌드된 플러그인을 찾지 못했습니다. 먼저 플러그인을 빌드한 뒤 출력 폴더를 선택하거나 빌드 결과물이 포함된 저장소를 사용하세요.",
  "pluginManagement.import.skipped": "건너뛴 폴더",
  "pluginManagement.import.skippedCount": "건너뛴 폴더 ({count}개)",
  "pluginManagement.import.skippedHelp":
    "이 폴더들은 플러그인으로 불러올 수 없습니다. 목록에 있는 다른 플러그인은 설치할 수 있습니다.",
  "pluginManagement.import.publisher":
    "게시자: {current}. 이전 게시자: {previous}.",
  "pluginManagement.import.updateSource": "업데이트 출처",
  "pluginManagement.import.commit": "커밋 {commit}",
  "pluginManagement.import.commitMatches": "커밋 {commit} (요청된 커밋과 일치)",
  "pluginManagement.import.installedHelp":
    "이 플러그인은 이미 설치되어 있습니다. 세부 정보를 열어 관리하세요.",
  "pluginManagement.bundledHelp":
    "이 플러그인은 Buzz에 포함되어 있습니다. 최신 버전을 사용하려면 Buzz를 업데이트하세요.",
  "pluginManagement.managed.unavailable": "추천 플러그인을 사용할 수 없음",
  "pluginManagement.managed.invalidFile":
    "Buzz가 관리 플러그인 파일 {path}을(를) 사용할 수 없습니다. {reason}",
  "pluginManagement.managed.recommendedBy": "{source}의 추천",
  "pluginManagement.managed.recommended": "추천 플러그인",
  "pluginManagement.managed.otherSource":
    "다른 출처에서 설치되었습니다. 추천 버전을 검토하려면 먼저 제거하세요. {location}",
  "pluginManagement.managed.updateLocation":
    "업데이트를 권장합니다. {location}",
  "pluginManagement.managed.reviewInstall": "검토 및 설치",
  "pluginManagement.managed.reviewUpdate": "업데이트 검토",
  "pluginManagement.managed.reviewInstallNamed": "{id} 검토 및 설치",
  "pluginManagement.managed.reviewUpdateNamed": "{id} 업데이트 검토",
  "pluginManagement.managed.ignored":
    "관리 플러그인 파일의 일부 항목을 무시했습니다:",
  "pluginManagement.managed.updates": "관리 업데이트",
  "pluginManagement.managed.different":
    "{source}에서 이 플러그인의 다른 버전을 권장합니다.",
  "pluginManagement.managed.follow":
    "업데이트는 {source}의 권장 사항을 따릅니다.",
  "pluginManagement.managed.noUrlPlugin":
    "이 URL에서 플러그인을 찾지 못했습니다.",
  "pluginManagement.managed.wrongUrl":
    "이 URL의 플러그인은 {wanted}이(가) 아닌 {found}입니다.",
  "pluginManagement.managed.noSource": "플러그인 출처를 찾지 못했습니다.",
  "pluginManagement.managed.wrongCommit":
    "저장소에서 권장 커밋 {wanted}이(가) 아닌 커밋 {actual}을(를) 반환했습니다.",
  "pluginManagement.managed.wrongUnknownCommit":
    "저장소에서 권장 커밋 {wanted}이(가) 아닌 알 수 없는 커밋을 반환했습니다.",
  "pluginManagement.managed.wrongPath":
    "{path} 경로의 플러그인은 {wanted}이(가) 아닌 {found}입니다.",
  "pluginManagement.managed.missingPath":
    "이 커밋의 {path} 경로에는 플러그인이 없습니다.",
  "pluginManagement.managed.requestTrust":
    "{name}에서 요청했습니다. 신뢰하는 코드만 설치하세요.",
  "pluginManagement.managed.recommendTrust":
    "{source}에서 추천했습니다. 신뢰하는 코드만 설치하세요.",
  "pluginManagement.managed.downloading": "플러그인 다운로드 중…",
  "pluginManagement.managed.reading":
    "고정된 커밋의 플러그인을 읽는 중… Git에서 가져오기는 최대 1분이 걸릴 수 있습니다.",
  "pluginManagement.managed.source": "관리 플러그인 출처",
  "pluginManagement.managed.sameRevision":
    "이 플러그인의 코드는 이미 이 리비전과 일치합니다. 업데이트하면 플러그인은 그대로 유지되고 {source}의 추천 출처가 기록됩니다.",
  "pluginManagement.managed.sourceUrl": "원본 URL",
  "pluginManagement.managed.pinnedFile":
    "이 플러그인은 고정된 단일 파일에서 설치되었습니다. 업데이트하려면 플러그인 마켓플레이스 또는 새 설치 링크에서 최신 버전을 설치하세요.",
  "pluginManagement.updates.cannotCheck": "{name} 확인 불가",
  "pluginManagement.updates.warning":
    "먼저 작성 중인 내용을 저장하고 실행 중인 플러그인 작업을 중지하세요. 활성화된 플러그인을 업데이트하면 즉시 다시 로드됩니다.",
  "pluginManagement.updates.dismiss": "플러그인 업데이트 알림 닫기",
  "pluginManagement.updates.manageChecks": "{name} 업데이트 확인 관리",
  "pluginManagement.updates.reviewPermissions": "권한 검토",
  "pluginManagement.updates.reload": "업데이트 및 다시 로드",
  "pluginManagement.updates.later": "나중에",
  "pluginManagement.updates.cannotStart": "{name}을(를) 시작할 수 없음",
  "pluginManagement.updates.retryActivation": "활성화 다시 시도",
  "pluginManagement.updates.recovery": "플러그인 복구 작업",
  "pluginManagement.updates.plugins": "플러그인",
  "pluginManagement.updates.retryNamed": "{name} 업데이트 다시 시도",
  "pluginManagement.updates.manage": "플러그인 관리",
};

export const en = {
  "u275a.cancel": "Cancel",
  "u275a.security.revokeTitle": "Revoke {client}?",
  "u275a.security.revokeDescription":
    "It stops working until you pair it again with buzz auth desktop pair.",
  "u275a.decisions.subtitle":
    "{agents}, {plugins} and features like {attention} can use this API for quick, inexpensive judgments, such as whether a watched event should wake your agent. Your chosen provider handles these questions and receives the message text sent with them, which may come from private channels.",
  "u275a.decisions.agents": "Agents",
  "u275a.decisions.plugins": "plugins",
  "u275a.decisions.attention": "Attention",
  "u275a.decisions.provider": "Decision provider",
  "u275a.decisions.unavailable": "Unavailable for this account",
  "u275a.decisions.providers": "Providers",
  "u275a.decisions.builderlabUnavailable":
    "Decisions API isn’t available for this Builderlab account. Use your own TypeSafe key or contact your account administrator.",
  "u275a.decisions.typesafeUnavailable": "TypeSafe settings are unavailable.",
  "u275a.decisions.connectTypesafe": "Connect TypeSafe",
  "u275a.decisions.setupBuilderlab": "Set up Builderlab",
  "u275a.decisions.setupDescription":
    "Complete account setup to use Builderlab for decision requests.",
  "u275a.identity.recoveryCorrupt":
    "Buzz can’t read its saved sign-in for this server, and signing in again may not replace it. If this keeps happening, contact support.",
  "u275a.identity.failure.unavailable":
    "Key backup isn’t configured for this build. You can continue without a backup.",
  "u275a.identity.failure.busy": "Another backup of this key is in progress.",
  "u275a.identity.failure.interrupted": "The backup was interrupted.",
  "u275a.identity.failure.timeout":
    "Builderlab is taking too long to confirm your backup.",
  "u275a.identity.failure.signed_out":
    "Your Builderlab sign-in is no longer valid, so your key wasn’t backed up.",
  "u275a.identity.failure.not_offered":
    "Builderlab doesn’t offer key backup for this account yet.",
  "u275a.identity.failure.not_linked":
    "This key isn’t linked to your Builderlab account yet, so it can’t be backed up.",
  "u275a.identity.failure.other_key_linked":
    "Your Builderlab account is linked to a different key, so this one can’t be backed up. This key may also be refused when you use this Builderlab account to sign in to a community.",
  "u275a.identity.failure.invalid_service":
    "Buzz couldn’t verify Builderlab’s backup service, so your key wasn’t sent.",
  "u275a.identity.failure.refused": "Builderlab refused this backup.",
  "u275a.identity.failure.unreachable":
    "Couldn’t reach Builderlab to back up your key.",
  "u275a.identity.failure.unconfirmed":
    "Builderlab couldn’t confirm your backup.",
  "u275a.identity.failure.storage":
    "Buzz couldn’t save backup progress on this device.",
  "u275a.identity.failure.unknown": "Your key wasn’t backed up.",
  "u275a.identity.yourAccount": "your {location} account",
  "u275a.identity.anAccount": "a {location} account",
  "u275a.identity.copied": "Buzz ID copied.",
  "u275a.identity.copyFailed":
    "Couldn’t copy buzz id. Select it and copy manually.",
  "u275a.identity.subtitle": "Your identity is shared across communities.",
  "u275a.identity.yourId": "Your Buzz ID",
  "u275a.identity.privateKey": "Your private key",
  "u275a.identity.keyStored": "This key is stored securely on this device.",
  "u275a.identity.backupSaved": "A backup is saved with {account}.",
  "u275a.identity.saveCopy":
    "Save a copy from the private key menu to use this ID on another device. Lose every copy and you lose this ID.",
  "u275a.identity.onThisDevice": "On this device",
  "u275a.identity.onThisDeviceDescription":
    "Your private key is kept in this device’s secure storage. It proves this Buzz ID is yours.",
  "u275a.identity.onNewDevice": "On a new device",
  "u275a.identity.onNewDeviceDescription":
    "Use a saved copy of your private key to restore this ID. Keep it somewhere safe. If you lose every copy, you can’t recover this ID.",
  "u275a.identity.removeFromDevice": "Remove from device",
  "u275a.identity.communitySignIns": "Community sign-ins",
  "u275a.identity.communitySignInsDescription":
    "Accounts you use to verify who you are and access your communities.",
  "u275a.identity.fullId": "Full Buzz ID:",
  "u275a.identity.accounts": "Accounts",
  "u275a.identity.needsAttention": "Needs attention",
  "u275a.identity.signedIn": "Signed in",
  "u275a.identity.checkingSignIn": "Checking sign-in…",
  "u275a.identity.signingIn": "Signing in…",
  "u275a.identity.organizationAccount": "your organization account",
  "u275a.identity.savedCommunities": "Saved communities for this host",
  "u275a.identity.usedToAccess": "Used to access",
  "u275a.identity.signInToAccess": "Sign in to access",
  "u275a.identity.recheckHint":
    "Buzz couldn’t check your saved sign-in. Check your connection, then choose Check again.",
  "u275a.identity.checkAgain": "Check again",
  "u275a.identity.finishInBrowser": "Finish in your browser",
  "u275a.identity.moreActions": "More actions for {organization}",
  "u275a.identity.renewSignIn": "Renew sign-in",
  "u275a.identity.signInError": "Account sign-in error",
  "u275a.identity.signOutTitle": "Sign out of {organization}?",
  "u275a.identity.signOutDescription":
    "Your Buzz identity stays on this device. You and your agents can’t reconnect to communities that require your {organization} login until you sign back in.",
  "u275a.identity.backUpToBuilderlab": "Back up this key to Builderlab",
  "u275a.identity.backupUnknown": "Backup status unknown",
  "u275a.identity.signInToBackUp": "Sign in to Builderlab to back up your key",
  "u275a.identity.backupStartFailed":
    "Couldn’t start the backup. Try signing in again.",
  "u275a.identity.backUpKey": "Back up key",
  "u275a.identity.retryBackup": "Retry backup",
  "u275a.plugins.requestedConflict": "Requested by {requester}. {conflict}",
  "u275a.plugins.loadingRecommended": "Loading the recommended plugin list…",
  "u275a.plugins.recommendedLoadFailed":
    "Buzz couldn’t load the recommended plugin list from {url}. {reason}",
  "u275a.plugins.openPlugin": "Open plugin",
  "u275a.plugins.gitToPackage":
    "This update switches this plugin from Git to a packaged download. The URL below replaces its saved Git source.",
  "u275a.updates.checkingTryAgain":
    "Checking for updates. Try again when the check finishes.",
  "u275a.updates.candidateChanged":
    "The update candidate changed after it was checked. Check for updates again before reviewing it.",
  "u275a.updates.anotherReview":
    "Another plugin review opened. Close it before confirming this update.",
  "u275a.updates.pluginChanged":
    "The installed plugin changed after this update was checked.",
  "u275a.updates.checking": "Checking for updates…",
  "u275a.updates.checkFailed": "Couldn’t check for updates.",
  "u275a.updates.checkAgain": "Check again",
  "u275a.updates.details": "Details",
  "u275a.import.hint.gitOutput":
    "Try another branch or tag. If the same output limit persists, ask the publisher for a ref or repository that Buzz can read.",
  "u275a.import.hint.repositorySize":
    "Try another branch or tag with a smaller plugin source. If it still exceeds the limit, ask the publisher for a smaller plugin-focused repository.",
  "u275a.import.hint.fileCount":
    "Choose Back, enter the plugin folder in Folder, then try again.",
  "u275a.import.hint.entryLimit":
    "Try another branch or tag with fewer repository entries. If it still exceeds the limit, ask the publisher for a plugin-focused repository.",
  "u275a.import.hint.fileSize":
    "Try another branch or tag with a smaller plugin file. If it still exceeds the limit, ask the publisher to provide a smaller file.",
  "u275a.import.hint.scoped":
    "Choose Back, enter a smaller folder path in Folder, then try again.",
  "u275a.import.referenceHelp":
    "Copy a plugin listing’s Ref into this field. Leave blank to scan the repository’s default branch.",
  "u275a.import.pinnedOn":
    "Pinned to commit {commit} on {reference}. Nothing is installed unless that commit is verified to be on it.",
  "u275a.import.defaultBranch": "the repository default branch",
  "u275a.import.folderOnly": "Plugin folder: {path}. Only this folder is read.",
  "u275a.import.commitVerified":
    "Commit {commit} (matches the requested commit, verified on {reference})",
  "u275a.import.publisherChanged":
    "The update publisher changed after it was checked. Check for updates again before reviewing it.",
  "u275a.import.installedChanged":
    "The installed plugin changed. Close this review and check again.",
  "u275a.import.reviewInactive":
    "This update review is no longer active. Check for updates again before reviewing it.",
  "u275a.import.folder": "Folder (optional)",
  "u275a.import.wholeRepository": "Whole repository",
  "u275a.import.futureUpdates":
    "Future updates will follow {requested} instead of {tracked}.",
  "u275a.import.repositoryDefault": "the repository default",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "u275a.cancel": "취소",
  "u275a.security.revokeTitle": "{client} 접근을 취소할까요?",
  "u275a.security.revokeDescription":
    "다시 buzz auth desktop pair로 연결하기 전까지 작동하지 않습니다.",
  "u275a.decisions.subtitle":
    "{agents}, {plugins}, {attention} 같은 기능은 감시 중인 이벤트가 에이전트를 깨워야 하는지 같은 간단하고 저렴한 판단에 이 API를 사용할 수 있습니다. 선택한 제공자가 이 요청을 처리하며, 비공개 채널에서 온 것일 수 있는 메시지 텍스트도 함께 받습니다.",
  "u275a.decisions.agents": "에이전트",
  "u275a.decisions.plugins": "플러그인",
  "u275a.decisions.attention": "Attention",
  "u275a.decisions.provider": "결정 제공자",
  "u275a.decisions.unavailable": "이 계정에서는 사용할 수 없습니다",
  "u275a.decisions.providers": "제공자",
  "u275a.decisions.builderlabUnavailable":
    "이 Builderlab 계정에서는 Decisions API를 사용할 수 없습니다. 직접 가진 TypeSafe 키를 사용하거나 계정 관리자에게 문의하세요.",
  "u275a.decisions.typesafeUnavailable": "TypeSafe 설정을 사용할 수 없습니다.",
  "u275a.decisions.connectTypesafe": "TypeSafe 연결",
  "u275a.decisions.setupBuilderlab": "Builderlab 설정",
  "u275a.decisions.setupDescription":
    "결정 요청에 Builderlab을 사용하려면 계정 설정을 완료하세요.",
  "u275a.identity.recoveryCorrupt":
    "이 서버에 저장된 로그인을 Buzz가 읽을 수 없고, 다시 로그인해도 교체되지 않을 수 있습니다. 문제가 계속되면 지원팀에 문의해 주세요.",
  "u275a.identity.failure.unavailable":
    "이 빌드에는 키 백업이 설정되어 있지 않습니다. 백업 없이 계속할 수 있습니다.",
  "u275a.identity.failure.busy": "이 키의 다른 백업이 진행 중입니다.",
  "u275a.identity.failure.interrupted": "백업이 중단되었습니다.",
  "u275a.identity.failure.timeout":
    "Builderlab이 백업을 확인하는 데 너무 오래 걸리고 있습니다.",
  "u275a.identity.failure.signed_out":
    "Builderlab 로그인이 더 이상 유효하지 않아 키를 백업하지 못했습니다.",
  "u275a.identity.failure.not_offered":
    "Builderlab은 아직 이 계정에 키 백업을 제공하지 않습니다.",
  "u275a.identity.failure.not_linked":
    "이 키가 아직 Builderlab 계정에 연결되지 않아 백업할 수 없습니다.",
  "u275a.identity.failure.other_key_linked":
    "Builderlab 계정이 다른 키에 연결되어 있어 이 키를 백업할 수 없습니다. 이 Builderlab 계정으로 커뮤니티에 로그인할 때도 이 키가 거부될 수 있습니다.",
  "u275a.identity.failure.invalid_service":
    "Builderlab의 백업 서비스를 확인하지 못해 키를 전송하지 않았습니다.",
  "u275a.identity.failure.refused": "Builderlab이 이 백업을 거부했습니다.",
  "u275a.identity.failure.unreachable":
    "키를 백업할 Builderlab에 연결하지 못했습니다.",
  "u275a.identity.failure.unconfirmed":
    "Builderlab이 백업을 확인하지 못했습니다.",
  "u275a.identity.failure.storage":
    "이 기기에 백업 진행 상황을 저장하지 못했습니다.",
  "u275a.identity.failure.unknown": "키를 백업하지 못했습니다.",
  "u275a.identity.yourAccount": "내 {location} 계정",
  "u275a.identity.anAccount": "{location} 계정",
  "u275a.identity.copied": "Buzz ID를 복사했습니다.",
  "u275a.identity.copyFailed":
    "Buzz ID를 복사하지 못했습니다. 직접 선택하여 복사해 주세요.",
  "u275a.identity.subtitle": "신원은 여러 커뮤니티에서 함께 사용합니다.",
  "u275a.identity.yourId": "내 Buzz ID",
  "u275a.identity.privateKey": "내 비밀 키",
  "u275a.identity.keyStored": "이 키는 이 기기에 안전하게 저장되어 있습니다.",
  "u275a.identity.backupSaved": "백업이 {account}에 저장되어 있습니다.",
  "u275a.identity.saveCopy":
    "다른 기기에서 이 ID를 사용하려면 비밀 키 메뉴에서 사본을 저장하세요. 모든 사본을 잃어버리면 이 ID도 잃게 됩니다.",
  "u275a.identity.onThisDevice": "이 기기에서",
  "u275a.identity.onThisDeviceDescription":
    "비밀 키는 이 기기의 보안 저장소에 보관됩니다. 이 Buzz ID가 내 것임을 증명합니다.",
  "u275a.identity.onNewDevice": "새 기기에서",
  "u275a.identity.onNewDeviceDescription":
    "저장해 둔 비밀 키 사본으로 이 ID를 복원할 수 있습니다. 안전한 곳에 보관하세요. 모든 사본을 잃어버리면 이 ID를 복구할 수 없습니다.",
  "u275a.identity.removeFromDevice": "기기에서 제거",
  "u275a.identity.communitySignIns": "커뮤니티 로그인",
  "u275a.identity.communitySignInsDescription":
    "내 신원을 확인하고 커뮤니티에 접속할 때 사용하는 계정입니다.",
  "u275a.identity.fullId": "전체 Buzz ID:",
  "u275a.identity.accounts": "계정",
  "u275a.identity.needsAttention": "확인 필요",
  "u275a.identity.signedIn": "로그인됨",
  "u275a.identity.checkingSignIn": "로그인 확인 중…",
  "u275a.identity.signingIn": "로그인 중…",
  "u275a.identity.organizationAccount": "조직 계정",
  "u275a.identity.savedCommunities": "이 호스트에 저장된 커뮤니티",
  "u275a.identity.usedToAccess": "접속에 사용됨",
  "u275a.identity.signInToAccess": "로그인하여 접속",
  "u275a.identity.recheckHint":
    "저장된 로그인을 Buzz가 확인하지 못했습니다. 연결을 확인한 뒤 ‘다시 확인’을 선택하세요.",
  "u275a.identity.checkAgain": "다시 확인",
  "u275a.identity.finishInBrowser": "브라우저에서 완료하세요",
  "u275a.identity.moreActions": "{organization} 추가 작업",
  "u275a.identity.renewSignIn": "로그인 갱신",
  "u275a.identity.signInError": "계정 로그인 오류",
  "u275a.identity.signOutTitle": "{organization}에서 로그아웃할까요?",
  "u275a.identity.signOutDescription":
    "Buzz 신원은 이 기기에 그대로 남습니다. 다시 로그인할 때까지 나와 내 에이전트는 {organization} 로그인이 필요한 커뮤니티에 다시 연결할 수 없습니다.",
  "u275a.identity.backUpToBuilderlab": "이 키를 Builderlab에 백업",
  "u275a.identity.backupUnknown": "백업 상태를 알 수 없음",
  "u275a.identity.signInToBackUp": "키를 백업하려면 Builderlab에 로그인하세요",
  "u275a.identity.backupStartFailed":
    "백업을 시작하지 못했습니다. 다시 로그인해 보세요.",
  "u275a.identity.backUpKey": "키 백업",
  "u275a.identity.retryBackup": "백업 다시 시도",
  "u275a.plugins.requestedConflict": "{requester}의 요청입니다. {conflict}",
  "u275a.plugins.loadingRecommended": "추천 플러그인 목록을 불러오는 중…",
  "u275a.plugins.recommendedLoadFailed":
    "{url}에서 추천 플러그인 목록을 불러오지 못했습니다. {reason}",
  "u275a.plugins.openPlugin": "플러그인 열기",
  "u275a.plugins.gitToPackage":
    "이 업데이트는 플러그인을 Git에서 패키지 다운로드로 전환합니다. 아래 URL이 저장된 Git 소스를 대체합니다.",
  "u275a.updates.checkingTryAgain":
    "업데이트를 확인하는 중입니다. 확인이 끝나면 다시 시도하세요.",
  "u275a.updates.candidateChanged":
    "확인한 뒤 업데이트 후보가 바뀌었습니다. 검토하기 전에 업데이트를 다시 확인하세요.",
  "u275a.updates.anotherReview":
    "다른 플러그인 검토가 열렸습니다. 이 업데이트를 확인하기 전에 먼저 닫으세요.",
  "u275a.updates.pluginChanged":
    "이 업데이트를 확인한 뒤 설치된 플러그인이 바뀌었습니다.",
  "u275a.updates.checking": "업데이트 확인 중…",
  "u275a.updates.checkFailed": "업데이트를 확인하지 못했습니다.",
  "u275a.updates.checkAgain": "다시 확인",
  "u275a.updates.details": "세부 정보",
  "u275a.import.hint.gitOutput":
    "다른 브랜치나 태그를 시도하세요. 같은 출력 제한이 계속되면 게시자에게 Buzz가 읽을 수 있는 ref나 저장소를 요청하세요.",
  "u275a.import.hint.repositorySize":
    "플러그인 소스가 더 작은 다른 브랜치나 태그를 시도하세요. 그래도 제한을 넘으면 게시자에게 플러그인 중심의 더 작은 저장소를 요청하세요.",
  "u275a.import.hint.fileCount":
    "뒤로를 선택하고 폴더에 플러그인 폴더를 입력한 뒤 다시 시도하세요.",
  "u275a.import.hint.entryLimit":
    "저장소 항목이 더 적은 다른 브랜치나 태그를 시도하세요. 그래도 제한을 넘으면 게시자에게 플러그인 중심의 저장소를 요청하세요.",
  "u275a.import.hint.fileSize":
    "플러그인 파일이 더 작은 다른 브랜치나 태그를 시도하세요. 그래도 제한을 넘으면 게시자에게 더 작은 파일을 요청하세요.",
  "u275a.import.hint.scoped":
    "뒤로를 선택하고 폴더에 더 작은 폴더 경로를 입력한 뒤 다시 시도하세요.",
  "u275a.import.referenceHelp":
    "플러그인 목록의 Ref를 이 입력란에 복사하세요. 비워 두면 저장소의 기본 브랜치를 검색합니다.",
  "u275a.import.pinnedOn":
    "{reference}의 커밋 {commit}에 고정되었습니다. 해당 커밋이 그 브랜치에 있는 것으로 확인되지 않으면 아무것도 설치되지 않습니다.",
  "u275a.import.defaultBranch": "저장소 기본 브랜치",
  "u275a.import.folderOnly": "플러그인 폴더: {path}. 이 폴더만 읽습니다.",
  "u275a.import.commitVerified":
    "커밋 {commit} (요청한 커밋과 일치하며 {reference}에서 확인됨)",
  "u275a.import.publisherChanged":
    "확인한 뒤 업데이트 게시자가 바뀌었습니다. 검토하기 전에 업데이트를 다시 확인하세요.",
  "u275a.import.installedChanged":
    "설치된 플러그인이 바뀌었습니다. 검토 창을 닫고 다시 확인하세요.",
  "u275a.import.reviewInactive":
    "이 업데이트 검토는 더 이상 활성 상태가 아닙니다. 검토하기 전에 업데이트를 다시 확인하세요.",
  "u275a.import.folder": "폴더 (선택)",
  "u275a.import.wholeRepository": "저장소 전체",
  "u275a.import.futureUpdates":
    "앞으로 업데이트는 {tracked} 대신 {requested}을(를) 따릅니다.",
  "u275a.import.repositoryDefault": "저장소 기본값",
};

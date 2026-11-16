export const en = {
  "u275b.search.savedUntilConnects":
    "Only saved conversations are searched until this community connects.",
  "u275b.search.savedWhileDisconnected":
    "Only saved conversations are searched while this community is disconnected.",
  "u275b.search.connectingCommunity": "Connecting to this community…",
  "u275b.search.connectForPeople":
    "Connect to this community to search people.",
  "u275b.signin.issuerRefusalAgain":
    "Buzz couldn’t confirm your organization sign-in for this community. Try again. If it keeps happening, contact your administrator.",
  "u275b.signin.recoveryCorrupt":
    "Buzz can’t read its saved sign-in for this server, and signing in again may not replace it. If this keeps happening, contact support.",
  "u275b.signin.alsoUsesOne":
    "{names} also uses this account. Switching may change your access there.",
  "u275b.signin.alsoUsesMany":
    "{names} also use this account. Switching may change your access there.",
  "u275b.community.enterAddress": "Enter a community address or invite link.",
  "u275b.community.pasteWholeLink":
    "Paste the whole invite link, not only its code.",
  "u275b.avatar.selectCommunity":
    "Select a community to upload an image or emoji. Your local default can use a public HTTPS image URL.",
  "u275b.identity.backupTitle": "Back up your key?",
  "u275b.identity.backupDescription":
    "Buzz will save an encrypted copy of your identity key with your Builderlab account. That copy can restore your identity, including in other apps where you use the same key. If you manage your own key, keep a copy of your private key: you need it to use this account on another device or if you lose access to this one.",
  "u275b.identity.backupKey": "Back up key",
  "u275b.identity.removeKeyTitle": "Remove your key from this device?",
  "u275b.identity.removeKeyDescription":
    "Your private key is how you sign in to Buzz. This removes it from this device’s secure storage and signs you out of your organization, Builderlab and hosted communities. Account backups and copies saved elsewhere stay. Save a copy so you can sign back in.",
  "u275b.identity.removeAndErase": "Remove and erase data",
  "u275b.identity.removeFromDevice": "Remove from device",
  "u275b.identity.restoreErrorHelp":
    "{error} Or enter your private key if you have a copy.",
  "u275b.identity.privateCopied":
    "Private key copied. Paste it somewhere safe now: Buzz tries to clear it from your clipboard in a minute.",
  "u275b.identity.copiedTitle": "Private key copied",
  "u275b.identity.copiedDescription":
    "Paste it somewhere safe now: Buzz tries to clear it from your clipboard in a minute.",
  "u275b.identity.keyActions": "Private key actions",
  "u275b.identity.privateKey": "Private key",
  "u275b.identity.copy": "Copy",
  "u275b.identity.reveal": "Reveal",
  "u275b.identity.hide": "Hide",
  "u275b.identity.replaceNotBackedUp":
    "Replacing it removes that account from this computer to continue with the one you just signed in to. Its key may not be backed up: copy its private key first, or you could lose that account.",
  "u275b.identity.unreadableKey":
    "Buzz can’t read the key saved on this computer, so it can’t open with it or copy it. Trying again won’t change that.",
  "u275b.identity.removeUnreadableTitle": "Remove the unreadable key?",
  "u275b.identity.removeUnreadableDescription":
    "This deletes it from this computer’s secure storage, signs you out of your organizations and restarts Buzz. Then sign in to restore your account’s key from its backup, or enter your private key. Without a backup or a copy, that identity can’t be recovered.",
  "u275b.identity.keyNotHereRestore":
    "Your account’s key isn’t on this device. Try restoring it from a backup, or enter its private key.",
  "u275b.identity.keyNotHereEnter":
    "Your account’s key isn’t on this device. Enter its private key to continue.",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "u275b.search.savedUntilConnects":
    "이 커뮤니티에 연결될 때까지 저장된 대화만 검색합니다.",
  "u275b.search.savedWhileDisconnected":
    "이 커뮤니티에 연결되지 않은 동안에는 저장된 대화만 검색합니다.",
  "u275b.search.connectingCommunity": "이 커뮤니티에 연결하고 있습니다…",
  "u275b.search.connectForPeople":
    "사람을 검색하려면 이 커뮤니티에 연결해 주세요.",
  "u275b.signin.issuerRefusalAgain":
    "이 커뮤니티의 조직 로그인을 확인하지 못했습니다. 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.",
  "u275b.signin.recoveryCorrupt":
    "이 서버에 저장된 로그인 정보를 Buzz가 읽을 수 없으며, 다시 로그인해도 대체되지 않을 수 있습니다. 문제가 계속되면 지원팀에 문의해 주세요.",
  "u275b.signin.alsoUsesOne":
    "{names} 커뮤니티도 이 계정을 사용합니다. 계정을 전환하면 해당 커뮤니티의 접근 권한이 바뀔 수 있습니다.",
  "u275b.signin.alsoUsesMany":
    "{names} 커뮤니티도 이 계정을 사용합니다. 계정을 전환하면 해당 커뮤니티의 접근 권한이 바뀔 수 있습니다.",
  "u275b.community.enterAddress":
    "커뮤니티 주소 또는 초대 링크를 입력해 주세요.",
  "u275b.community.pasteWholeLink":
    "초대 코드만이 아니라 초대 링크 전체를 붙여넣어 주세요.",
  "u275b.avatar.selectCommunity":
    "이미지나 이모지를 업로드하려면 커뮤니티를 선택해 주세요. 로컬 기본값에는 공개 HTTPS 이미지 URL을 사용할 수 있습니다.",
  "u275b.identity.backupTitle": "키를 백업할까요?",
  "u275b.identity.backupDescription":
    "Buzz가 신원 키의 암호화된 사본을 Builderlab 계정에 저장합니다. 이 사본으로 신원을 복원할 수 있으며, 같은 키를 사용하는 다른 앱에서도 복원할 수 있습니다. 키를 직접 관리한다면 비밀 키 사본을 보관해 주세요. 다른 기기에서 이 계정을 사용하거나 이 기기에 접근할 수 없게 되었을 때 필요합니다.",
  "u275b.identity.backupKey": "키 백업",
  "u275b.identity.removeKeyTitle": "이 기기에서 키를 제거할까요?",
  "u275b.identity.removeKeyDescription":
    "비밀 키는 Buzz에 로그인하는 수단입니다. 이 기기의 보안 저장소에서 키를 제거하고 조직, Builderlab 및 호스팅 커뮤니티에서 로그아웃합니다. 계정 백업과 다른 곳에 저장한 사본은 그대로 남습니다. 다시 로그인할 수 있도록 사본을 저장해 주세요.",
  "u275b.identity.removeAndErase": "제거 및 데이터 삭제",
  "u275b.identity.removeFromDevice": "기기에서 제거",
  "u275b.identity.restoreErrorHelp":
    "{error} 사본이 있다면 비밀 키를 직접 입력할 수도 있습니다.",
  "u275b.identity.privateCopied":
    "비밀 키를 복사했습니다. 지금 안전한 곳에 붙여넣어 두세요. Buzz가 1분 뒤 클립보드에서 지우려고 시도합니다.",
  "u275b.identity.copiedTitle": "비밀 키를 복사했습니다",
  "u275b.identity.copiedDescription":
    "지금 안전한 곳에 붙여넣어 두세요. Buzz가 1분 뒤 클립보드에서 지우려고 시도합니다.",
  "u275b.identity.keyActions": "비밀 키 작업",
  "u275b.identity.privateKey": "비밀 키",
  "u275b.identity.copy": "복사",
  "u275b.identity.reveal": "보기",
  "u275b.identity.hide": "숨기기",
  "u275b.identity.replaceNotBackedUp":
    "교체하면 이 컴퓨터에서 기존 계정이 제거되고 방금 로그인한 계정으로 계속합니다. 기존 계정의 키가 백업되어 있지 않을 수 있습니다. 먼저 비밀 키를 복사해 두세요. 그렇지 않으면 해당 계정을 잃을 수 있습니다.",
  "u275b.identity.unreadableKey":
    "이 컴퓨터에 저장된 키를 Buzz가 읽을 수 없어 이 키로 열거나 복사할 수 없습니다. 다시 시도해도 달라지지 않습니다.",
  "u275b.identity.removeUnreadableTitle": "읽을 수 없는 키를 제거할까요?",
  "u275b.identity.removeUnreadableDescription":
    "이 컴퓨터의 보안 저장소에서 키를 삭제하고 조직에서 로그아웃한 뒤 Buzz를 다시 시작합니다. 이후 로그인해 계정의 백업에서 키를 복원하거나 비밀 키를 입력해 주세요. 백업이나 사본이 없으면 이 신원은 복구할 수 없습니다.",
  "u275b.identity.keyNotHereRestore":
    "계정의 키가 이 기기에 없습니다. 백업에서 복원하거나 비밀 키를 입력해 주세요.",
  "u275b.identity.keyNotHereEnter":
    "계정의 키가 이 기기에 없습니다. 계속하려면 비밀 키를 입력해 주세요.",
};

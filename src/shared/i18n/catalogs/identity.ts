export const en = {
  "identity.progress.heading": "Getting ready",
  "identity.progress.preparing": "Preparing your identity…",
  "identity.progress.opening": "Opening Buzz…",
  "identity.progress.signingIn": "Signing in…",
  "identity.publicKey.heading": "Your public key (npub)",
  "identity.publicKey.copyLabel": "Copy npub",
  "identity.publicKey.copy": "Copy",
  "identity.publicKey.copied": "Public key copied.",
  "identity.publicKey.copyFailed":
    "Could not copy. Select the key above to copy it.",
  "identity.publicKey.description":
    "This is your public identity — it’s safe to share.",
  "identity.legacy.title": "Continue with your Buzz identity?",
  "identity.legacy.description":
    "Old Buzz was used on this device. Continue with the identity it saved instead of setting up a new one. Your computer may ask you to allow access.",
  "identity.notNow": "Not now",
  "identity.continue": "Continue",
  "identity.cancel": "Cancel",
  "identity.replace": "Replace",
  "identity.back": "Back",
  "identity.welcome.identity": "Your Buzz identity",
  "identity.welcome.openingSaved": "Opening your saved identity…",
  "identity.welcome.retryStorage": "Retry secure storage access",
  "identity.welcome.join": "Join a community",
  "identity.welcome.joinDescription":
    "Enter a community address or an invite link to continue.",
  "identity.welcome.tagline": "Your people, your agents, one place.",
  "identity.welcome.signIn": "Sign in",
  "identity.welcome.createAccount": "Create account",
  "identity.welcome.continueWithoutSignIn": "Continue without signing in",
  "identity.welcome.otherOptions": "Other options",
  "identity.replace.title": "A different account is saved on this computer",
  "identity.replace.backedUp":
    "Replacing it removes that account from this computer to continue with the one you just signed in to. Its key was backed up in Builderlab: sign in to that account again to restore it.",
  "identity.replace.notBackedUp":
    "Replacing it removes that account from this computer to continue with the one you just signed in to. It may not be backed up.",
  "identity.failure.switchAccount": "Couldn’t switch accounts. Try again.",
  "identity.failure.finishJoining": "Couldn’t finish joining",
  "identity.failure.join": "Couldn’t join community",
  "identity.failure.inviteRequired": "This community needs an invite",
  "identity.failure.unreachable":
    "Could not reach the relay. Check your connection and try again.",
  "identity.failure.notReady": "Your saved communities aren’t ready yet.",
  "identity.failure.inviteDescription":
    "{host} admits members by invite, and this key has none yet. Enter an invite code, or send your public key to a community administrator so they can add you, then try again.",
  "identity.failure.setup": "Couldn’t finish setup",
  "identity.failure.keySaved": "Your key is saved on this device.",
  "identity.failure.unlinked":
    "Your key is saved on this device, but it isn’t linked to your account or backed up yet.",
  "identity.failure.signOut": "Couldn’t sign out",
  "identity.failure.signIn": "Couldn’t sign in",
  "identity.failure.otherAccount": "Use a different account",
  "identity.failure.withoutBackup": "Continue without backup",
  "identity.failure.retry": "Try again",
  "identity.browser.title": "Finish in your browser",
  "identity.browser.description":
    "Finish signing in there, then come back and choose Continue.",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "identity.progress.heading": "준비 중",
  "identity.progress.preparing": "신원을 준비하고 있습니다…",
  "identity.progress.opening": "Buzz를 열고 있습니다…",
  "identity.progress.signingIn": "로그인하고 있습니다…",
  "identity.publicKey.heading": "내 공개 키(npub)",
  "identity.publicKey.copyLabel": "npub 복사",
  "identity.publicKey.copy": "복사",
  "identity.publicKey.copied": "공개 키를 복사했습니다.",
  "identity.publicKey.copyFailed":
    "복사하지 못했습니다. 위의 키를 선택해서 복사해 주세요.",
  "identity.publicKey.description":
    "내 공개 신원 정보입니다. 다른 사람에게 공유해도 안전합니다.",
  "identity.legacy.title": "기존 Buzz 신원으로 계속할까요?",
  "identity.legacy.description":
    "이 기기에서 이전 Buzz를 사용한 기록이 있습니다. 새 신원을 만드는 대신 기존에 저장된 신원으로 계속하세요. 컴퓨터에서 접근 허용을 요청할 수 있습니다.",
  "identity.notNow": "나중에",
  "identity.continue": "계속",
  "identity.cancel": "취소",
  "identity.replace": "교체",
  "identity.back": "뒤로",
  "identity.welcome.identity": "내 Buzz 신원",
  "identity.welcome.openingSaved": "저장된 신원을 열고 있습니다…",
  "identity.welcome.retryStorage": "보안 저장소 접근 다시 시도",
  "identity.welcome.join": "커뮤니티 참여",
  "identity.welcome.joinDescription":
    "계속하려면 커뮤니티 주소나 초대 링크를 입력해 주세요.",
  "identity.welcome.tagline": "사람과 에이전트가 함께하는 한 공간.",
  "identity.welcome.signIn": "로그인",
  "identity.welcome.createAccount": "계정 만들기",
  "identity.welcome.continueWithoutSignIn": "로그인하지 않고 계속",
  "identity.welcome.otherOptions": "다른 방법",
  "identity.replace.title": "이 컴퓨터에 다른 계정이 저장되어 있습니다",
  "identity.replace.backedUp":
    "교체하면 이 컴퓨터에서 기존 계정이 제거되고 방금 로그인한 계정으로 계속합니다. 기존 계정의 키는 Builderlab에 백업되어 있습니다. 복원하려면 해당 계정으로 다시 로그인하세요.",
  "identity.replace.notBackedUp":
    "교체하면 이 컴퓨터에서 기존 계정이 제거되고 방금 로그인한 계정으로 계속합니다. 기존 계정의 키가 백업되어 있지 않을 수 있습니다.",
  "identity.failure.switchAccount":
    "계정을 전환하지 못했습니다. 다시 시도해 주세요.",
  "identity.failure.finishJoining": "참여를 완료하지 못했습니다",
  "identity.failure.join": "커뮤니티에 참여하지 못했습니다",
  "identity.failure.inviteRequired": "초대가 필요한 커뮤니티입니다",
  "identity.failure.unreachable":
    "릴레이에 연결하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
  "identity.failure.notReady": "저장된 커뮤니티가 아직 준비되지 않았습니다.",
  "identity.failure.inviteDescription":
    "{host}에서는 초대받은 사람만 참여할 수 있으며, 이 키에는 아직 초대가 없습니다. 초대 코드를 입력하거나 커뮤니티 관리자에게 공개 키를 보내 참여를 요청한 뒤 다시 시도해 주세요.",
  "identity.failure.setup": "설정을 완료하지 못했습니다",
  "identity.failure.keySaved": "키가 이 기기에 저장되어 있습니다.",
  "identity.failure.unlinked":
    "키가 이 기기에 저장되어 있지만, 아직 계정에 연결되거나 백업되지 않았습니다.",
  "identity.failure.signOut": "로그아웃하지 못했습니다",
  "identity.failure.signIn": "로그인하지 못했습니다",
  "identity.failure.otherAccount": "다른 계정 사용",
  "identity.failure.withoutBackup": "백업하지 않고 계속",
  "identity.failure.retry": "다시 시도",
  "identity.browser.title": "브라우저에서 마무리해 주세요",
  "identity.browser.description":
    "브라우저에서 로그인을 마친 다음 돌아와서 계속을 선택해 주세요.",
};

export const en = {
  "u275f02.workspace.unfiled": "Unfiled",
  "u275f02.workspace.hideTasks": "Hide tasks and chats in {title}",
  "u275f02.workspace.showTasks": "Show tasks and chats in {title}",
  "u275f02.workspace.newTaskIn": "New task in {title}",
  "u275f02.workspace.newTask": "New task",
  "u275f02.linkedKey.yourAccount": "Your Builderlab account",
  "u275f02.linkedKey.title": "Your account uses a different key",
  "u275f02.linkedKey.restorable":
    "{account} is linked to a different key than the one on this computer, and Builderlab has a backup of it. Replacing removes this computer’s key and restarts Buzz to restore your account’s key. {backup}",
  "u275f02.linkedKey.backedUp":
    "This computer’s key was backed up in Builderlab: sign in to its account to restore it.",
  "u275f02.linkedKey.notBackedUp":
    "This computer’s key may not be backed up: copy its private key from Settings → Identity first, or you could lose it.",
  "u275f02.linkedKey.elsewhere":
    "{account} is linked to a key that lives on another device, and Builderlab has no backup of it. Buzz keeps using this computer’s key. To use your account’s key here, turn on Identity sync in Settings → Identity on that device, or bring its private key here.",
  "u275f02.linkedKey.notNow": "Not now",
  "u275f02.linkedKey.replace": "Replace",
  "u275f02.linkedKey.ok": "OK",
  "u275f02.linkPreviews.showFewer": "Show fewer previews",
  "u275f02.linkPreviews.showMoreOne": "Show {count} more preview",
  "u275f02.linkPreviews.showMoreMany": "Show {count} more previews",
  "u275f02.apiKey.save": "Save",
  "u275f02.apiKey.cancel": "Cancel",
  "u275f02.apiKey.replace": "Replace",
  "u275f02.apiKey.remove": "Remove",
  "u275f02.apiKey.saved": "Saved",
  "u275f02.apiKey.description": "Saved securely on this computer.",
  "u275f02.apiKey.replacementLabel": "Replacement API key",
  "u275f02.apiKey.savedLabel": "Saved API key",
  "u275f02.apiKey.actions": "API key actions",
  "u275f02.apiKey.pasteReplacement": "Paste a replacement API key",
  "u275f02.lifetime.label": "New Solo chats",
  "u275f02.lifetime.description":
    "Chats you start with New chat in this community begin with this lifetime. You can change it in a chat’s settings.",
  "u275f02.lifetime.temporary": "Temporary, {duration}",
  "u275f02.lifetime.saveFailed":
    "Couldn’t save this on this device. Try again.",
  "u275f02.newWorkspace.unsaved": "Your new workspace has unsaved changes.",
  "u275f02.solo.regionUnavailable":
    "This chat's plugin is unavailable. Your draft is saved.",
  "u275f02.solo.agentUnsupported":
    "This chat's plugin can't use one of these agents. Choose another agent.",
  "u275f02.solo.startNotSaved":
    "This chat couldn't be saved on this device. Your draft is kept.",
  "u275f02.models.availability": "Saved model and effort availability",
  "u275f02.models.omitsOverrides":
    "Send omits model and effort overrides; the agent or provider decides which model runs",
  "u275f02.models.using": "Using {model}",
  "u275f02.models.usingDefaultEffort":
    "Using {model} with its default effort ({effort})",
  "u275f02.models.usingProviderEffort":
    "Using {model} with the provider's default effort",
  "u275f02.models.noSupported":
    "No supported model is listed in the loaded catalog. Send omits model and effort overrides and uses the agent's defaults",
  "u275f02.models.savedModelUnavailable": "Saved model is unavailable.",
  "u275f02.models.savedEffortUnavailableFor":
    "Saved effort is unavailable for {model}.",
  "u275f02.models.savedEffortUnavailable": "Saved effort is unavailable.",
  "u275f02.models.unavailable":
    "{reason} {fallback}. Your saved choice is retained until you reset it.",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "u275f02.workspace.unfiled": "분류 안 됨",
  "u275f02.workspace.hideTasks": "{title}의 작업 및 채팅 숨기기",
  "u275f02.workspace.showTasks": "{title}의 작업 및 채팅 보기",
  "u275f02.workspace.newTaskIn": "{title}에 새 작업",
  "u275f02.workspace.newTask": "새 작업",
  "u275f02.linkedKey.yourAccount": "내 Builderlab 계정",
  "u275f02.linkedKey.title": "계정이 다른 키를 사용합니다",
  "u275f02.linkedKey.restorable":
    "{account}에 연결된 키가 이 컴퓨터의 키와 다르며, Builderlab에 그 키의 백업이 있습니다. 교체하면 이 컴퓨터의 키를 삭제하고 Buzz를 다시 시작해 계정의 키를 복원합니다. {backup}",
  "u275f02.linkedKey.backedUp":
    "이 컴퓨터의 키는 Builderlab에 백업되어 있습니다. 해당 계정에 로그인하면 복원할 수 있습니다.",
  "u275f02.linkedKey.notBackedUp":
    "이 컴퓨터의 키는 백업되지 않았을 수 있습니다. 먼저 설정 → 신원에서 개인 키를 복사해 두세요. 그렇지 않으면 키를 잃을 수 있습니다.",
  "u275f02.linkedKey.elsewhere":
    "{account}에 연결된 키는 다른 기기에 있으며 Builderlab에 백업이 없습니다. Buzz는 계속 이 컴퓨터의 키를 사용합니다. 계정의 키를 여기서 사용하려면 해당 기기의 설정 → 신원에서 신원 동기화를 켜거나 개인 키를 이곳으로 가져오세요.",
  "u275f02.linkedKey.notNow": "나중에",
  "u275f02.linkedKey.replace": "교체",
  "u275f02.linkedKey.ok": "확인",
  "u275f02.linkPreviews.showFewer": "미리보기 줄이기",
  "u275f02.linkPreviews.showMoreOne": "미리보기 {count}개 더 보기",
  "u275f02.linkPreviews.showMoreMany": "미리보기 {count}개 더 보기",
  "u275f02.apiKey.save": "저장",
  "u275f02.apiKey.cancel": "취소",
  "u275f02.apiKey.replace": "교체",
  "u275f02.apiKey.remove": "제거",
  "u275f02.apiKey.saved": "저장했습니다",
  "u275f02.apiKey.description": "이 컴퓨터에 안전하게 저장되어 있습니다.",
  "u275f02.apiKey.replacementLabel": "교체할 API 키",
  "u275f02.apiKey.savedLabel": "저장된 API 키",
  "u275f02.apiKey.actions": "API 키 작업",
  "u275f02.apiKey.pasteReplacement": "교체할 API 키를 붙여넣으세요",
  "u275f02.lifetime.label": "새 솔로 채팅",
  "u275f02.lifetime.description":
    "이 커뮤니티에서 새 채팅으로 시작하는 채팅은 이 유지 기간으로 시작합니다. 채팅 설정에서 바꿀 수 있습니다.",
  "u275f02.lifetime.temporary": "임시, {duration}",
  "u275f02.lifetime.saveFailed":
    "이 기기에 저장하지 못했습니다. 다시 시도해 주세요.",
  "u275f02.newWorkspace.unsaved":
    "새 작업 공간에 저장하지 않은 변경 사항이 있습니다.",
  "u275f02.solo.regionUnavailable":
    "이 채팅의 플러그인을 사용할 수 없습니다. 초안은 저장되어 있습니다.",
  "u275f02.solo.agentUnsupported":
    "이 채팅의 플러그인이 선택한 에이전트 중 하나를 사용할 수 없습니다. 다른 에이전트를 선택해 주세요.",
  "u275f02.solo.startNotSaved":
    "이 기기에 채팅을 저장하지 못했습니다. 초안은 그대로 유지됩니다.",
  "u275f02.models.availability": "저장된 모델 및 추론 강도 사용 가능 여부",
  "u275f02.models.omitsOverrides":
    "보내기에서 모델과 추론 강도 재정의를 생략하며, 에이전트 또는 제공자가 실행할 모델을 정합니다",
  "u275f02.models.using": "{model} 사용",
  "u275f02.models.usingDefaultEffort": "{model} 사용, 기본 추론 강도({effort})",
  "u275f02.models.usingProviderEffort": "{model} 사용, 제공자 기본 추론 강도",
  "u275f02.models.noSupported":
    "불러온 목록에 지원되는 모델이 없습니다. 보내기에서 모델과 추론 강도 재정의를 생략하고 에이전트 기본값을 사용합니다",
  "u275f02.models.savedModelUnavailable": "저장된 모델을 사용할 수 없습니다.",
  "u275f02.models.savedEffortUnavailableFor":
    "{model}에서 저장된 추론 강도를 사용할 수 없습니다.",
  "u275f02.models.savedEffortUnavailable":
    "저장된 추론 강도를 사용할 수 없습니다.",
  "u275f02.models.unavailable":
    "{reason} {fallback}. 저장된 선택은 초기화할 때까지 유지됩니다.",
};

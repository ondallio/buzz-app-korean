export const en = {
  "v106ag.communitySession": "Community session",
  "v106ag.scope.perCommunity": "One session per community",
  "v106ag.scope.piPerCommunity": "One conversation per community",
  "v106ag.scope.description":
    "Choose how your agent uses sessions to keep context.",
  "v106ag.compactAt": "Auto-compact at",
  "v106ag.tokensK": "{count}K tokens",
  "v106ag.harnessDefault": "Harness default",
  "v106ag.compact.protected": "Protected agents never compact automatically.",
  "v106ag.claude.chooseModel":
    "Choose an available Claude model or clear the model and thinking overrides.",
  "v106ag.claude.chooseThinking":
    "Choose a thinking level this Claude model supports or use Default.",
  "v106ag.codex.checkModels":
    "Check Codex models or clear the model and thinking overrides before saving.",
  "v106ag.codex.chooseModel":
    "Choose an available Codex model or Codex default before saving.",
  "v106ag.codex.chooseThinking":
    "Choose a thinking level this Codex model supports or use Default.",
  "v106ag.codex.checkVoices":
    "Check Huddle voices or choose Codex default before saving.",
  "v106ag.codex.chooseVoice": "Choose an available Huddle voice.",
  "v106ag.codex.voicesUnchecked":
    "Voice choices could not be checked. Try again, update Codex, or choose Codex default.",
  "v106ag.codex.checkVoicesAgain": "Check voices again",
  "v106ag.voice.codexDefault": "Codex default",
  "v106ag.voice.unavailable": "{voice} (unavailable)",
  "v106ag.voice.noRecording": "No recording is available for this voice.",
  "v106ag.voice.previewFailed": "Could not preview voice. Try again.",
  "v106ag.voice.currently": "Currently {voice}",
  "v106ag.voice.otherVoices": "Other voices",
  "v106ag.voice.title": "Huddle voice",
  "v106ag.voice.subtitle":
    "Determines which voice your agent speaks with in Huddles (Codex only).",
  "v106ag.voice.defaultValue": "{voice} · Default",
  "v106ag.voice.choose": "Choose voice",
  "v106ag.voice.voice": "Voice",
  "v106ag.voice.languageRegion": "Language and region",
  "v106ag.voice.voices": "Voices",
  "v106ag.voice.loadingSamples": "Loading voice samples…",
  "v106ag.voice.loadingPreview": "Loading preview…",
  "v106ag.voice.unavailableDevice":
    "Voice previews are unavailable on this device.",
  "v106ag.voice.loadFailed": "Voice recording could not be loaded. Try again.",
  "v106ag.goose.clearOverrides":
    "Clear the model and thinking overrides to use the target’s defaults.",
  "v106ag.goose.chooseModel":
    "Choose an available Goose model or clear the model and thinking overrides.",
  "v106ag.goose.chooseThinking":
    "Choose a thinking level this Goose model supports or use Default.",
  "v106ag.pi.chooseModel":
    "Choose an available Pi model or clear the model and thinking overrides.",
  "v106ag.pi.chooseThinking":
    "Choose a thinking level this Pi model supports or use Default.",
  "v106ag.mesh.sharingDisclosure":
    "Members of {community} can run prompts on this machine. Sharing resumes when Buzz reconnects after relaunch.",
  "v106ag.mesh.sharingDisclosureDefault":
    "Members of this community can run prompts on this machine. Sharing resumes when Buzz reconnects after relaunch.",
  "v106ag.gh.joinsQueueWhenReady": "Joins the merge queue when ready",
  "v106ag.gh.review.approved": "approved",
  "v106ag.gh.review.changesRequested": "changes requested",
  "v106ag.diff.oldCode": "{file} old code",
  "v106ag.diff.newCode": "{file} new code",
  "v106ag.diff.code": "{file} code",
  "v106ag.wf.owner": "Owner:",
  "v106ag.on": "On",
  "v106ag.off": "Off",
  "v106ag.proposed.title": "Proposed settings",
  "v106ag.proposed.to": " to ",
  "v106ag.proposed.same": "The proposed settings match the saved settings.",
  "v106ag.create.waitPicture": "Wait for the picture to finish preparing",
  "v106ag.create.notReady": "{harness} isn’t ready on this computer.",
  "v106ag.create.settingsUnavailable":
    "Settings are unavailable for this harness.",
  "v106ag.review.askAgain":
    "Close this review and ask the agent for a new proposal.",
  "v106ag.cost.daily": "Daily cost, oldest first: {days}",
  "v106ag.cost.title": "Cost, last {count} days",
  "v106ag.cost.noUsage":
    "Not available: this agent's type doesn't report its usage.",
  "v106ag.cost.elsewhere":
    "Not available: usage is read from sessions on this device, and this agent runs elsewhere.",
  "v106ag.cost.readFailed": "Couldn't read this agent's sessions.",
  "v106ag.cost.reading": "Reading its sessions…",
  "v106ag.cost.estimate":
    "An estimate from its sessions on this device, not a bill.",
  "v106ag.cost.openUsage": "Open Usage",
  "v106ag.stored.openThread": "Open this thread",
  "v106ag.stored.openConversation": "Open this conversation",
  "v106ag.stored.listFailed": "Could not list conversations: {error}",
  "v106ag.stored.noRecent":
    "No recent conversations found. Older ones aren't shown.",
  "v106ag.stored.noOthers": "No other conversations stored yet.",
  "v106ag.stored.olderHidden": "Older conversations aren't shown.",
  "v106ag.stored.reading": "Reading the stored session…",
  "v106ag.stored.readFailed": "Could not read the stored session",
  "v106ag.stored.missing":
    "Builderlab has no stored transcript for this conversation. It may have ended or been removed.",
  "v106ag.stored.liveActivity": "Live activity",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "v106ag.communitySession": "커뮤니티 세션",
  "v106ag.scope.perCommunity": "커뮤니티마다 세션 하나",
  "v106ag.scope.piPerCommunity": "커뮤니티마다 대화 하나",
  "v106ag.scope.description":
    "에이전트가 맥락을 유지하려고 세션을 어떻게 사용할지 선택하세요.",
  "v106ag.compactAt": "자동 압축 기준",
  "v106ag.tokensK": "{count}K 토큰",
  "v106ag.harnessDefault": "하네스 기본값",
  "v106ag.compact.protected": "보호된 에이전트는 자동으로 압축하지 않습니다.",
  "v106ag.claude.chooseModel":
    "사용할 수 있는 Claude 모델을 선택하거나 모델과 사고 수준 지정을 지우세요.",
  "v106ag.claude.chooseThinking":
    "이 Claude 모델이 지원하는 사고 수준을 선택하거나 기본값을 사용하세요.",
  "v106ag.codex.checkModels":
    "저장하기 전에 Codex 모델을 확인하거나 모델과 사고 수준 지정을 지우세요.",
  "v106ag.codex.chooseModel":
    "저장하기 전에 사용할 수 있는 Codex 모델이나 Codex 기본값을 선택하세요.",
  "v106ag.codex.chooseThinking":
    "이 Codex 모델이 지원하는 사고 수준을 선택하거나 기본값을 사용하세요.",
  "v106ag.codex.checkVoices":
    "저장하기 전에 허들 음성을 확인하거나 Codex 기본값을 선택하세요.",
  "v106ag.codex.chooseVoice": "사용할 수 있는 허들 음성을 선택하세요.",
  "v106ag.codex.voicesUnchecked":
    "음성 선택지를 확인하지 못했습니다. 다시 시도하거나 Codex를 업데이트하거나 Codex 기본값을 선택하세요.",
  "v106ag.codex.checkVoicesAgain": "음성 다시 확인",
  "v106ag.voice.codexDefault": "Codex 기본값",
  "v106ag.voice.unavailable": "{voice} (사용할 수 없음)",
  "v106ag.voice.noRecording": "이 음성에는 녹음이 없습니다.",
  "v106ag.voice.previewFailed":
    "음성을 미리 듣지 못했습니다. 다시 시도해 주세요.",
  "v106ag.voice.currently": "현재 {voice}",
  "v106ag.voice.otherVoices": "기타 음성",
  "v106ag.voice.title": "허들 음성",
  "v106ag.voice.subtitle":
    "허들에서 에이전트가 말할 음성을 정합니다(Codex 전용).",
  "v106ag.voice.defaultValue": "{voice} · 기본값",
  "v106ag.voice.choose": "음성 선택",
  "v106ag.voice.voice": "음성",
  "v106ag.voice.languageRegion": "언어 및 지역",
  "v106ag.voice.voices": "음성 목록",
  "v106ag.voice.loadingSamples": "음성 샘플을 불러오는 중…",
  "v106ag.voice.loadingPreview": "미리 듣기를 불러오는 중…",
  "v106ag.voice.unavailableDevice":
    "이 기기에서는 음성 미리 듣기를 사용할 수 없습니다.",
  "v106ag.voice.loadFailed":
    "음성 녹음을 불러오지 못했습니다. 다시 시도해 주세요.",
  "v106ag.goose.clearOverrides":
    "실행 대상의 기본값을 쓰려면 모델과 사고 수준 지정을 지우세요.",
  "v106ag.goose.chooseModel":
    "사용할 수 있는 Goose 모델을 선택하거나 모델과 사고 수준 지정을 지우세요.",
  "v106ag.goose.chooseThinking":
    "이 Goose 모델이 지원하는 사고 수준을 선택하거나 기본값을 사용하세요.",
  "v106ag.pi.chooseModel":
    "사용할 수 있는 Pi 모델을 선택하거나 모델과 사고 수준 지정을 지우세요.",
  "v106ag.pi.chooseThinking":
    "이 Pi 모델이 지원하는 사고 수준을 선택하거나 기본값을 사용하세요.",
  "v106ag.mesh.sharingDisclosure":
    "{community} 커뮤니티 멤버가 이 컴퓨터에서 프롬프트를 실행할 수 있습니다. Buzz를 다시 실행해 재연결되면 공유가 다시 시작됩니다.",
  "v106ag.mesh.sharingDisclosureDefault":
    "이 커뮤니티 멤버가 이 컴퓨터에서 프롬프트를 실행할 수 있습니다. Buzz를 다시 실행해 재연결되면 공유가 다시 시작됩니다.",
  "v106ag.gh.joinsQueueWhenReady": "준비되면 병합 대기열에 들어감",
  "v106ag.gh.review.approved": "승인됨",
  "v106ag.gh.review.changesRequested": "변경 요청됨",
  "v106ag.diff.oldCode": "{file} 이전 코드",
  "v106ag.diff.newCode": "{file} 새 코드",
  "v106ag.diff.code": "{file} 코드",
  "v106ag.wf.owner": "소유자:",
  "v106ag.on": "켜짐",
  "v106ag.off": "꺼짐",
  "v106ag.proposed.title": "제안된 설정",
  "v106ag.proposed.to": ", 변경 후: ",
  "v106ag.proposed.same": "제안된 설정이 저장된 설정과 같습니다.",
  "v106ag.create.waitPicture": "사진 준비가 끝날 때까지 기다려 주세요",
  "v106ag.create.notReady": "이 컴퓨터에서 {harness} 준비가 되지 않았습니다.",
  "v106ag.create.settingsUnavailable":
    "이 하네스에서는 설정을 사용할 수 없습니다.",
  "v106ag.review.askAgain": "이 검토를 닫고 에이전트에게 새 제안을 요청하세요.",
  "v106ag.cost.daily": "일별 비용(오래된 순): {days}",
  "v106ag.cost.title": "비용, 최근 {count}일",
  "v106ag.cost.noUsage":
    "사용할 수 없음: 이 에이전트 유형은 사용량을 보고하지 않습니다.",
  "v106ag.cost.elsewhere":
    "사용할 수 없음: 사용량은 이 기기의 세션에서 읽는데, 이 에이전트는 다른 곳에서 실행됩니다.",
  "v106ag.cost.readFailed": "이 에이전트의 세션을 읽지 못했습니다.",
  "v106ag.cost.reading": "세션을 읽는 중…",
  "v106ag.cost.estimate":
    "이 기기의 세션으로 추정한 값이며 청구 금액이 아닙니다.",
  "v106ag.cost.openUsage": "사용량 열기",
  "v106ag.stored.openThread": "이 스레드 열기",
  "v106ag.stored.openConversation": "이 대화 열기",
  "v106ag.stored.listFailed": "대화 목록을 불러오지 못했습니다: {error}",
  "v106ag.stored.noRecent":
    "최근 대화가 없습니다. 오래된 대화는 표시되지 않습니다.",
  "v106ag.stored.noOthers": "아직 저장된 다른 대화가 없습니다.",
  "v106ag.stored.olderHidden": "오래된 대화는 표시되지 않습니다.",
  "v106ag.stored.reading": "저장된 세션을 읽는 중…",
  "v106ag.stored.readFailed": "저장된 세션을 읽지 못했습니다",
  "v106ag.stored.missing":
    "Builderlab에 이 대화의 저장된 기록이 없습니다. 대화가 끝났거나 삭제되었을 수 있습니다.",
  "v106ag.stored.liveActivity": "실시간 활동",
};

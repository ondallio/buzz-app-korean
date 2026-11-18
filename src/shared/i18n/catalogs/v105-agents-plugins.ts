export const en = {
  "v105agent.avatar.frameFailed": "Couldn't frame the image. Try again.",
  "v105agent.avatar.moveEmojiHint":
    "Drag or use the arrow keys to move the emoji",
  "v105agent.model.currently": "Currently {model}",
  "v105agent.claude.followsSettings": "Follows Claude Code settings",
  "v105agent.codex.appsProtected":
    "Protected agents never use Codex apps or plugins.",
  "v105agent.codex.appsAllowed":
    "The agent may use apps and plugins that are installed in Codex.",
  "v105agent.repo.oneCommit": "1 commit",
  "v105agent.repo.latestOneCommit": "Latest 1 commit",
  "v105agent.repo.contributorsOneCommit": "Contributors in the latest 1 commit",
  "v105agent.usage.noConversation": "No conversation",
  "v105agent.workflow.mentionOwnerRuns":
    "Agents you mention respond only when you start this workflow, not when someone else does. This community limits which workflows can use agents, so other people can't use yours.",
  "v105agent.workflow.mentionWebhook":
    "Agents won't respond to workflows started by a webhook. This community limits which workflows can use agents, so other people can't use yours.",
  "v105agent.workflow.mentionSteps":
    "Agents won't respond to this workflow because it has steps other than Send Message and Delay. This community limits which workflows can use agents, so other people can't use yours.",
  "v105agent.bestie.thisAgent": "This agent",
  "v105agent.bestie.noLonger":
    "{name} is no longer your Bestie. These are still on.",
  "v105agent.bestie.makeAgain": "Make my Bestie again",
  "v105agent.bestie.thisIsYours": "This is your Bestie",
  "v105agent.bestie.pinned":
    "It's pinned at the top of Buzz, with your DM as its home.",
  "v105agent.bestie.change": "Change",
  "v105agent.bestie.makeYours": "Make your Bestie",
  "v105agent.bestie.removeHint": "Have no Bestie until you make one again.",
  "v105agent.bestie.remove": "Remove",
  "v105agent.bestie.settings": "Settings",
  "v105agent.bestie.checkIns": "Check-ins",
  "v105agent.bestie.readingInstructions": "Reading its instructions…",
  "v105agent.bestie.retry": "Retry",
  "v105agent.bestie.editedRestorable":
    "Its section in Instructions was edited where it starts or ends. Restore puts back the original section.",
  "v105agent.bestie.editedFix":
    "Its section in Instructions was edited where it starts or ends. Fix its start and end lines there.",
  "v105agent.bestie.restore": "Restore",
  "v105agent.bestie.onlyBestie": "Only your Bestie checks in.",
  "v105agent.bestie.turnOnFirst": "Turn on {feature} first.",
  "v105agent.bestie.pausedInAttention":
    "Paused in Attention. Turn {feature} off and on again to restart it.",
  "v105agent.bestie.pausedNoWatches":
    "Paused: watches aren't running on this device. Turn on the Attention plugin.",
  "v105agent.bestie.partlySaved": "{feature} is partly saved",
  "v105agent.bestie.partlySavedHint":
    "Part of it is missing, so it reads as off. Remove clears the rest.",
  "v105agent.bestie.feature.memory": "Remembers you",
  "v105agent.bestie.feature.memoryDescription":
    "Adds memory rules to Bestie's instructions. Off removes them. Nothing Bestie remembered is deleted, and its core memory still goes into every prompt. To clear a memory, ask Bestie to forget it.",
  "v105agent.bestie.feature.hourlyNotes": "Hourly notes",
  "v105agent.bestie.feature.hourlyNotesDescription":
    "Bestie wakes once an hour, reads what is new in the channels it is in and notes what matters. It tells you only when a follow-up you asked for is due. A pass with nothing new writes and sends nothing, but every wake still uses your tokens. Runs while Buzz is open and the Watching plugin is on.",
  "v105agent.bestie.feature.nightlyReview": "Nightly review",
  "v105agent.bestie.feature.nightlyReviewDescription":
    "Around 3 AM Bestie tidies its memory: it checks its notes against the messages, sorts what it knows and writes a short reflection. It never messages you. It needs only Remembers you. Runs while Buzz is open and the Watching plugin is on, and uses your tokens.",
  "v105agent.bestie.feature.everyHour": "Every hour",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "v105agent.avatar.frameFailed":
    "이미지 위치를 맞추지 못했습니다. 다시 시도해 주세요.",
  "v105agent.avatar.moveEmojiHint":
    "드래그하거나 화살표 키로 이모지를 옮기세요",
  "v105agent.model.currently": "현재 {model}",
  "v105agent.claude.followsSettings": "Claude Code 설정을 따릅니다",
  "v105agent.codex.appsProtected":
    "보호된 에이전트는 Codex 앱이나 플러그인을 사용하지 않습니다.",
  "v105agent.codex.appsAllowed":
    "에이전트가 Codex에 설치된 앱과 플러그인을 사용할 수 있습니다.",
  "v105agent.repo.oneCommit": "커밋 1개",
  "v105agent.repo.latestOneCommit": "최근 커밋 1개",
  "v105agent.repo.contributorsOneCommit": "최근 커밋 1개의 기여자",
  "v105agent.usage.noConversation": "대화 없음",
  "v105agent.workflow.mentionOwnerRuns":
    "멘션한 에이전트는 다른 사람이 아니라 내가 이 워크플로를 시작할 때만 응답합니다. 이 커뮤니티는 에이전트를 사용할 수 있는 워크플로를 제한하므로 다른 사람은 내 에이전트를 사용할 수 없습니다.",
  "v105agent.workflow.mentionWebhook":
    "웹훅으로 시작된 워크플로에는 에이전트가 응답하지 않습니다. 이 커뮤니티는 에이전트를 사용할 수 있는 워크플로를 제한하므로 다른 사람은 내 에이전트를 사용할 수 없습니다.",
  "v105agent.workflow.mentionSteps":
    "이 워크플로에는 메시지 보내기와 지연 외의 단계가 있어 에이전트가 응답하지 않습니다. 이 커뮤니티는 에이전트를 사용할 수 있는 워크플로를 제한하므로 다른 사람은 내 에이전트를 사용할 수 없습니다.",
  "v105agent.bestie.thisAgent": "이 에이전트",
  "v105agent.bestie.noLonger":
    "{name} 님은 더 이상 내 베스티가 아닙니다. 아래 항목은 아직 켜져 있습니다.",
  "v105agent.bestie.makeAgain": "다시 내 베스티로 지정",
  "v105agent.bestie.thisIsYours": "내 베스티입니다",
  "v105agent.bestie.pinned":
    "Buzz 맨 위에 고정되며, 나와의 DM이 베스티의 홈이 됩니다.",
  "v105agent.bestie.change": "변경",
  "v105agent.bestie.makeYours": "베스티로 지정",
  "v105agent.bestie.removeHint": "다시 지정하기 전까지는 베스티가 없습니다.",
  "v105agent.bestie.remove": "제거",
  "v105agent.bestie.settings": "설정",
  "v105agent.bestie.checkIns": "정기 확인",
  "v105agent.bestie.readingInstructions": "지침을 읽는 중…",
  "v105agent.bestie.retry": "다시 시도",
  "v105agent.bestie.editedRestorable":
    "지침에서 이 항목의 시작이나 끝 부분이 수정되었습니다. 복원하면 원래 항목으로 되돌립니다.",
  "v105agent.bestie.editedFix":
    "지침에서 이 항목의 시작이나 끝 부분이 수정되었습니다. 지침에서 시작 줄과 끝 줄을 고쳐 주세요.",
  "v105agent.bestie.restore": "복원",
  "v105agent.bestie.onlyBestie": "정기 확인은 내 베스티만 합니다.",
  "v105agent.bestie.turnOnFirst": "먼저 {feature} 기능을 켜세요.",
  "v105agent.bestie.pausedInAttention":
    "지켜보기 탭에서 일시 중지되었습니다. 다시 시작하려면 {feature} 기능을 껐다가 다시 켜세요.",
  "v105agent.bestie.pausedNoWatches":
    "일시 중지됨: 이 기기에서 지켜보기가 실행되지 않고 있습니다. 지켜보기 플러그인을 켜세요.",
  "v105agent.bestie.partlySaved": "{feature} 기능이 일부만 저장되었습니다",
  "v105agent.bestie.partlySavedHint":
    "일부가 빠져 있어 꺼진 것으로 표시됩니다. 제거하면 나머지를 정리합니다.",
  "v105agent.bestie.feature.memory": "나를 기억하기",
  "v105agent.bestie.feature.memoryDescription":
    "베스티 지침에 기억 규칙을 추가합니다. 끄면 규칙을 제거합니다. 베스티가 기억한 내용은 삭제되지 않으며, 핵심 기억은 계속 모든 프롬프트에 들어갑니다. 기억을 지우려면 베스티에게 잊어 달라고 요청하세요.",
  "v105agent.bestie.feature.hourlyNotes": "매시간 메모",
  "v105agent.bestie.feature.hourlyNotesDescription":
    "베스티가 한 시간에 한 번 깨어나 참여한 채널의 새 내용을 읽고 중요한 점을 기록합니다. 요청한 후속 조치 시점이 되었을 때만 알려 줍니다. 새 내용이 없으면 아무것도 쓰거나 보내지 않지만, 깨어날 때마다 토큰은 사용됩니다. Buzz가 열려 있고 지켜보기 플러그인이 켜져 있을 때 실행됩니다.",
  "v105agent.bestie.feature.nightlyReview": "야간 정리",
  "v105agent.bestie.feature.nightlyReviewDescription":
    "새벽 3시쯤 베스티가 기억을 정리합니다. 메모를 메시지와 대조하고, 아는 내용을 분류하고, 짧은 회고를 씁니다. 메시지는 절대 보내지 않습니다. '나를 기억하기'만 켜져 있으면 됩니다. Buzz가 열려 있고 지켜보기 플러그인이 켜져 있을 때 실행되며, 토큰을 사용합니다.",
  "v105agent.bestie.feature.everyHour": "매시간",
};

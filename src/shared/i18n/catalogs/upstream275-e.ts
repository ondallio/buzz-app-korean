export const en = {
  "u275e.lifecycle.retry": "Retry",
  "u275e.lifecycle.pausedWait":
    "{description} Relay requests are paused, so nothing was deleted. You can retry in {wait}.",
  "u275e.lifecycle.pausedNow":
    "{description} Relay requests were paused, so nothing was deleted. You can retry now.",
  "u275e.wait.oneSecond": "1 second",
  "u275e.wait.seconds": "{count} seconds",
  "u275e.wait.oneMinute": "1 minute",
  "u275e.wait.minutes": "{count} minutes",
  "u275e.workflow.archivedReason":
    "This channel is archived, so its workflows can't run.",
  "u275e.workflow.archivedTurnOff":
    "{reason} Turn this workflow off to save it.",
  "u275e.archived": "Archived",
  "u275e.members.archived": "Archived",
  "u275e.members.filter": "Filter members: {summary}",
  "u275e.members.peopleAndAgents": "People and agents",
  "u275e.members.access": "Access",
  "u275e.members.anyAccess": "Any access · {count}",
  "u275e.members.noFilterMatches": "No members match this filter.",
  "u275e.channels.welcomeDescription":
    "Choose a community to see its channels, or join one. Your profile and settings work without a community.",
  "u275e.channels.chooseCommunity": "Choose a community",
  "u275e.admin.sections": "Membership sections",
  "u275e.admin.invite": "Invite",
  "u275e.admin.qrAlt": "Scan this QR code to open the invite link",
  "u275e.admin.shareFailed":
    "Could not open sharing. Try again or copy the link.",
  "u275e.admin.share": "Share",
  "u275e.admin.maxUses": "Max uses",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "u275e.lifecycle.retry": "다시 시도",
  "u275e.lifecycle.pausedWait":
    "{description} 릴레이 요청이 일시 중지되어 아무것도 삭제되지 않았습니다. {wait} 후에 다시 시도할 수 있습니다.",
  "u275e.lifecycle.pausedNow":
    "{description} 릴레이 요청이 일시 중지되어 아무것도 삭제되지 않았습니다. 지금 다시 시도할 수 있습니다.",
  "u275e.wait.oneSecond": "1초",
  "u275e.wait.seconds": "{count}초",
  "u275e.wait.oneMinute": "1분",
  "u275e.wait.minutes": "{count}분",
  "u275e.workflow.archivedReason":
    "이 채널은 보관되어 있어 워크플로를 실행할 수 없습니다.",
  "u275e.workflow.archivedTurnOff": "{reason} 저장하려면 이 워크플로를 끄세요.",
  "u275e.archived": "보관됨",
  "u275e.members.archived": "보관됨",
  "u275e.members.filter": "멤버 필터: {summary}",
  "u275e.members.peopleAndAgents": "사람 및 에이전트",
  "u275e.members.access": "접근 권한",
  "u275e.members.anyAccess": "모든 접근 권한 · {count}",
  "u275e.members.noFilterMatches": "이 필터에 맞는 멤버가 없습니다.",
  "u275e.channels.welcomeDescription":
    "커뮤니티를 선택해 채널을 보거나 커뮤니티에 참여하세요. 커뮤니티 없이도 프로필과 설정을 사용할 수 있습니다.",
  "u275e.channels.chooseCommunity": "커뮤니티 선택",
  "u275e.admin.sections": "멤버 관리 섹션",
  "u275e.admin.invite": "초대",
  "u275e.admin.qrAlt": "이 QR 코드를 스캔하면 초대 링크가 열립니다",
  "u275e.admin.shareFailed":
    "공유를 열지 못했습니다. 다시 시도하거나 링크를 복사하세요.",
  "u275e.admin.share": "공유",
  "u275e.admin.maxUses": "최대 사용 횟수",
};

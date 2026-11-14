export const en = {
  "completionDisplay.emoji": "Emoji",
  "completionDisplay.mention": "Mention",
  "completionDisplay.channel": "Channel",
  "completionDisplay.suggestions": "{provider} suggestions",
  "completionDisplay.unavailable": "{provider} suggestions unavailable",
  "completionDisplay.retry": "Retry suggestions",
  "completionDisplay.agentName": "{name} Agent",
  "completionDisplay.detail": "{label} {detail}",
  "completionDisplay.unicode": "Unicode emoji",
  "completionDisplay.community": "Community emoji",
  "completionDisplay.searchingEmoji": "Searching emoji…",
  "completionDisplay.communityUnavailable":
    "Community emoji unavailable; Unicode results shown.",
  "completionDisplay.unicodeUnavailable":
    "Unicode emoji unavailable. Custom matches shown.",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "completionDisplay.emoji": "이모지",
  "completionDisplay.mention": "멘션",
  "completionDisplay.channel": "채널",
  "completionDisplay.suggestions": "{provider} 추천",
  "completionDisplay.unavailable": "{provider} 추천을 사용할 수 없습니다.",
  "completionDisplay.retry": "추천 다시 불러오기",
  "completionDisplay.agentName": "{name} 에이전트",
  "completionDisplay.detail": "{label} {detail}",
  "completionDisplay.unicode": "유니코드 이모지",
  "completionDisplay.community": "커뮤니티 이모지",
  "completionDisplay.searchingEmoji": "이모지 검색 중…",
  "completionDisplay.communityUnavailable":
    "커뮤니티 이모지를 사용할 수 없어 유니코드 결과를 표시합니다.",
  "completionDisplay.unicodeUnavailable":
    "유니코드 이모지를 사용할 수 없어 사용자 지정 이모지 결과를 표시합니다.",
};

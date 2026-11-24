export const en = {
  "v106sh.includeMacLocalModifier":
    "Include Command, Control or Option so ordinary typing keeps working.",
  "v106sh.searchResultDigitsReserved":
    "{chord} to 9 open search results. Try another.",
  "v106sh.shortcut.app-restart": "Reload Buzz and restart agents",
  "v106sh.shortcut.quote-selection": "Quote selected text",
  "v106sh.shortcut.search-previous-result": "Previous search result",
  "v106sh.shortcut.search-next-result": "Next search result",
  "v106sh.search.tagDm": "DM",
  "v106sh.search.tagMentioned": "Mentioned",
  "v106sh.search.tagThread": "Thread",
  "v106sh.search.mentionedYou": "{name} mentioned you",
  "v106sh.search.filters": "Filters",
  "v106sh.search.filtersWhy": "Type one, or press ↵ to add it",
  "v106sh.search.filtersTitle": "Filters (type ?)",
  "v106sh.search.keyAdd": "Add",
  "v106sh.search.keyBack": "Back",
  "v106sh.search.keyBackTo": "Back to {name}",
  "v106sh.guide.from": "Who sent it",
  "v106sh.guide.fromAbout":
    "Messages one person sent. Type a name after it to pick someone, or me for your own.",
  "v106sh.guide.fromMe": "Your messages",
  "v106sh.guide.in": "Where it was sent",
  "v106sh.guide.inAbout":
    "Messages in one channel, or in:@name for your direct messages with someone.",
  "v106sh.guide.inChannel": "In #{channel}",
  "v106sh.guide.askAbout":
    "{name} searches Buzz for you and answers in a new chat. Filters you’ve added stay in the question.",
  "v106sh.guide.askAboutDefault":
    "Your agent searches Buzz for you and answers in a new chat. Filters you’ve added stay in the question.",
  "v106sh.guide.askQuestion": "Ask a question",
  "v106sh.guide.during": "When it was sent",
  "v106sh.guide.duringAbout":
    "Messages from a day, a month (march or 2026-03) or a year, or from the past few days, weeks, months or years (7d, 2w, 3m, 1y).",
  "v106sh.guide.inMarch": "In March",
  "v106sh.guide.before": "Before a day",
  "v106sh.guide.beforeAbout":
    "Messages sent before a day, not on it. Name the day as YYYY-MM-DD, today or yesterday.",
  "v106sh.guide.beforeToday": "Before today",
  "v106sh.guide.after": "After a day",
  "v106sh.guide.afterAbout":
    "Messages sent on or after a day. Name the day as YYYY-MM-DD, today or yesterday.",
  "v106sh.guide.sinceYesterday": "Since yesterday",
  "v106sh.guide.on": "On one day",
  "v106sh.guide.onAbout":
    "Messages sent on a single day. Name the day as YYYY-MM-DD, today or yesterday.",
  "v106sh.guide.phrase": "Exact words",
  "v106sh.guide.phraseAbout":
    "Words in quotes match together, in that order. Put - before a word to leave it out.",
  "v106sh.guide.thatPhrase": "That phrase",
  "v106sh.guide.withoutDraft": "Without “draft”",
  "v106sh.guide.try": "Try",
  "v106sh.plugins.automaticInstalledOne": "{source} installed {name}",
  "v106sh.plugins.automaticUpdatedOne": "{source} updated {name}",
  "v106sh.plugins.automaticInstalledMany": "{source} installed {count} plugins",
  "v106sh.plugins.automaticUpdatedMany": "{source} updated {count} plugins",
  "v106sh.plugins.automaticChangedMany":
    "{source} installed or updated {count} plugins",
  "v106sh.plugins.automaticInstalledDetail":
    "It’s on now. You can turn it off or remove it in Manage plugins.",
  "v106sh.plugins.automaticUpdatedDetail":
    "It now runs the version {source} recommends.",
  "v106sh.plugins.automaticDismiss": "Dismiss automatic plugin changes",
  "v106sh.plugins.managedAutomatic": "{source} · updates automatically",
  "v106sh.security.diagnostics": "Diagnostics",
  "v106sh.security.webInspector": "Allow Safari Web Inspector",
  "v106sh.security.webInspectorDescription":
    "Safari can inspect this Buzz window, including its data. Turns off when you quit Buzz.",
  "v106sh.security.webInspectorFailed":
    "Buzz couldn’t change Web Inspector access. Try again.",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "v106sh.includeMacLocalModifier":
    "일반 입력을 방해하지 않도록 Command, Control 또는 Option을 포함해 주세요.",
  "v106sh.searchResultDigitsReserved":
    "{chord}~9는 검색 결과를 여는 데 사용됩니다. 다른 단축키를 사용해 주세요.",
  "v106sh.shortcut.app-restart": "Buzz 새로고침 후 에이전트 다시 시작",
  "v106sh.shortcut.quote-selection": "선택한 텍스트 인용",
  "v106sh.shortcut.search-previous-result": "이전 검색 결과",
  "v106sh.shortcut.search-next-result": "다음 검색 결과",
  "v106sh.search.tagDm": "DM",
  "v106sh.search.tagMentioned": "멘션됨",
  "v106sh.search.tagThread": "스레드",
  "v106sh.search.mentionedYou": "{name} 님이 나를 멘션했습니다",
  "v106sh.search.filters": "필터",
  "v106sh.search.filtersWhy": "직접 입력하거나 ↵를 눌러 추가하세요",
  "v106sh.search.filtersTitle": "필터 (? 입력)",
  "v106sh.search.keyAdd": "추가",
  "v106sh.search.keyBack": "뒤로",
  "v106sh.search.keyBackTo": "{name} 탭으로 돌아가기",
  "v106sh.guide.from": "보낸 사람",
  "v106sh.guide.fromAbout":
    "한 사람이 보낸 메시지입니다. 뒤에 이름을 입력해 사람을 고르거나, 내 메시지는 me를 입력하세요.",
  "v106sh.guide.fromMe": "내 메시지",
  "v106sh.guide.in": "보낸 곳",
  "v106sh.guide.inAbout":
    "한 채널의 메시지입니다. 누군가와 주고받은 다이렉트 메시지는 in:@이름으로 찾습니다.",
  "v106sh.guide.inChannel": "#{channel} 안에서",
  "v106sh.guide.askAbout":
    "{name} 님이 Buzz를 검색해 새 채팅에서 답합니다. 추가한 필터는 질문에 그대로 남습니다.",
  "v106sh.guide.askAboutDefault":
    "내 에이전트가 Buzz를 검색해 새 채팅에서 답합니다. 추가한 필터는 질문에 그대로 남습니다.",
  "v106sh.guide.askQuestion": "질문하기",
  "v106sh.guide.during": "보낸 시기",
  "v106sh.guide.duringAbout":
    "특정 날짜, 달(march 또는 2026-03), 연도의 메시지나 최근 며칠·몇 주·몇 달·몇 년(7d, 2w, 3m, 1y) 동안의 메시지입니다.",
  "v106sh.guide.inMarch": "3월",
  "v106sh.guide.before": "특정 날짜 이전",
  "v106sh.guide.beforeAbout":
    "그날을 빼고 그 이전에 보낸 메시지입니다. 날짜는 YYYY-MM-DD, today, yesterday 중 하나로 입력하세요.",
  "v106sh.guide.beforeToday": "오늘 이전",
  "v106sh.guide.after": "특정 날짜 이후",
  "v106sh.guide.afterAbout":
    "그날 또는 그 이후에 보낸 메시지입니다. 날짜는 YYYY-MM-DD, today, yesterday 중 하나로 입력하세요.",
  "v106sh.guide.sinceYesterday": "어제부터",
  "v106sh.guide.on": "특정 날짜",
  "v106sh.guide.onAbout":
    "하루 동안 보낸 메시지입니다. 날짜는 YYYY-MM-DD, today, yesterday 중 하나로 입력하세요.",
  "v106sh.guide.phrase": "정확한 문구",
  "v106sh.guide.phraseAbout":
    "따옴표로 묶은 단어는 그 순서대로 함께 찾습니다. 단어 앞에 -를 붙이면 그 단어를 뺍니다.",
  "v106sh.guide.thatPhrase": "해당 문구",
  "v106sh.guide.withoutDraft": "“draft” 제외",
  "v106sh.guide.try": "예시",
  "v106sh.plugins.automaticInstalledOne":
    "{source}에서 {name} 플러그인을 설치했습니다",
  "v106sh.plugins.automaticUpdatedOne":
    "{source}에서 {name} 플러그인을 업데이트했습니다",
  "v106sh.plugins.automaticInstalledMany":
    "{source}에서 플러그인 {count}개를 설치했습니다",
  "v106sh.plugins.automaticUpdatedMany":
    "{source}에서 플러그인 {count}개를 업데이트했습니다",
  "v106sh.plugins.automaticChangedMany":
    "{source}에서 플러그인 {count}개를 설치하거나 업데이트했습니다",
  "v106sh.plugins.automaticInstalledDetail":
    "지금 켜져 있습니다. 플러그인 관리에서 끄거나 제거할 수 있습니다.",
  "v106sh.plugins.automaticUpdatedDetail":
    "이제 {source}에서 권장하는 버전으로 실행됩니다.",
  "v106sh.plugins.automaticDismiss": "자동 플러그인 변경 알림 닫기",
  "v106sh.plugins.managedAutomatic": "{source} · 자동 업데이트",
  "v106sh.security.diagnostics": "진단",
  "v106sh.security.webInspector": "Safari 웹 속성 보기 허용",
  "v106sh.security.webInspectorDescription":
    "Safari에서 데이터를 포함한 이 Buzz 창을 검사할 수 있습니다. Buzz를 종료하면 꺼집니다.",
  "v106sh.security.webInspectorFailed":
    "웹 속성 보기 접근 권한을 바꾸지 못했습니다. 다시 시도해 주세요.",
};

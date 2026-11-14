export const en = {
  "notifications.settings.title": "Notifications",
  "notifications.settings.about": "Notify me about",
  "notifications.settings.deliveryRegion": "Desktop delivery",
  "notifications.settings.delivery": "Delivery",
  "notifications.settings.alerts": "Desktop alerts",
  "notifications.settings.viewing": "Notify while viewing",
  "notifications.settings.viewingDescription":
    "Include direct messages in the conversation you’re viewing.",
  "notifications.settings.sound": "Sound",
  "notifications.settings.soundDescription": "Choose a sound to preview it.",
  "notifications.settings.silent": "Silent",
  "notifications.settings.recommended": "{sound} rec.",
  "notifications.category.mention": "Mentions",
  "notifications.sound.mention": "@Mentions",
  "notifications.category.direct": "Direct messages",
  "notifications.category.thread": "Thread replies",
  "notifications.category.agent": "Solo chat completions",
  "notifications.category.reminders": "Reminders",
  "notifications.permission.development":
    "Notifications are paused by your local development setting. Remove BUZZ_DEV_NOTIFICATIONS=0 from .env.local and restart the dev server to resume normal behavior. Your saved alert choices are unchanged.",
  "notifications.permission.waiting": "Waiting for system permission…",
  "notifications.permission.denied":
    "Notifications are off. Turn them on in your browser or system settings.",
  "notifications.permission.unsupported":
    "This build can’t show system notifications.",
  "notifications.permission.default": "Allow notifications to receive alerts.",
  "notifications.permission.allow": "Allow notifications",
  "notifications.permission.check": "Check permission",
  "notifications.error.preferences": "Notification choices weren’t saved",
  "notifications.error.retry": "Retry saving choices",
  "notifications.error.reload": "Reload saved choices",
  "notifications.error.send": "Buzz couldn’t send the notification",
  "notifications.dock.title": "Dock unread badge",
  "notifications.dock.unavailable":
    "Dock badges require a bundled macOS app and aren’t available from the development server.",
  "notifications.dock.description":
    "Shows a dot for unread activity in the selected community. It doesn’t show a message count.",
  "notifications.dock.default":
    "Allow notifications and badges to show the unread dot.",
  "notifications.dock.setupStatus":
    "Set up Dock badges to show the unread dot.",
  "notifications.dock.enabled": "Buzz can show Dock badges.",
  "notifications.dock.disabled":
    "Dock badges are off. Turn them on in macOS System Settings.",
  "notifications.dock.denied":
    "Notifications are off. Turn them on in macOS System Settings.",
  "notifications.dock.setup": "Set up Dock badges",
  "notifications.dock.allow": "Allow notifications and badges",
  "notifications.dock.check": "Check Dock permission",
  "notifications.dock.error": "Dock badge unavailable",
  "notifications.completion.done": "{agent} is done",
  "notifications.completion.error": "{agent} encountered an error",
  "notifications.completion.doneIn": "{agent} is done in {conversation}",
  "notifications.completion.errorIn":
    "{agent} encountered an error in {conversation}",
  "notifications.completion.viewIn": "View in {conversation}",
  "notifications.completion.view": "View conversation",
  "notifications.completion.errorBody": "View conversation · {error}",
  "notifications.completion.errorBodyIn": "View in {conversation} · {error}",
  "notifications.completion.action": "View",
  "notifications.completion.agent": "Agent",
  "notifications.payload.newMessage": "New message",
  "notifications.payload.newCategory": "New {category}",
  "notifications.payload.mentionChannel":
    "{sender} mentioned you in #{channel}",
  "notifications.payload.mentionDm":
    "{sender} mentioned you in a direct message",
  "notifications.payload.direct": "{sender} sent you a direct message",
  "notifications.payload.replyChannel": "{sender} replied in #{channel}",
  "notifications.payload.replyDm": "{sender} replied in a direct message",
  "notifications.payload.workflowMentionChannel":
    "Workflow · owned by {owner} mentioned you in #{channel}",
  "notifications.payload.workflowMentionDm":
    "Workflow · owned by {owner} mentioned you in a direct message",
  "notifications.payload.workflowDirect":
    "Workflow · owned by {owner} sent you a direct message",
  "notifications.payload.workflowReplyChannel":
    "Workflow · owned by {owner} replied in #{channel}",
  "notifications.payload.workflowReplyDm":
    "Workflow · owned by {owner} replied in a direct message",
  "notifications.completion.unknownDone": "Agent is done",
  "notifications.completion.unknownError": "Agent encountered an error",
  "notifications.completion.unknownDoneIn": "Agent is done in {conversation}",
  "notifications.completion.unknownErrorIn":
    "Agent encountered an error in {conversation}",
  "notifications.error.restoreDetails":
    "Notification preferences could not be restored. Alerts are paused; retry loading your settings.",
  "notifications.error.saveDetails":
    "These notification choices are active, but could not be saved on this device. Retry saving.",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "notifications.settings.title": "알림",
  "notifications.settings.about": "알림을 받을 항목",
  "notifications.settings.deliveryRegion": "데스크톱 알림 전달",
  "notifications.settings.delivery": "전달",
  "notifications.settings.alerts": "데스크톱 알림",
  "notifications.settings.viewing": "보고 있는 대화에서도 알림 받기",
  "notifications.settings.viewingDescription":
    "현재 보고 있는 대화의 다이렉트 메시지도 알립니다.",
  "notifications.settings.sound": "소리",
  "notifications.settings.soundDescription":
    "소리를 선택하면 미리 들을 수 있습니다.",
  "notifications.settings.silent": "무음",
  "notifications.settings.recommended": "{sound} 권장",
  "notifications.category.mention": "멘션",
  "notifications.sound.mention": "@멘션",
  "notifications.category.direct": "다이렉트 메시지",
  "notifications.category.thread": "스레드 답글",
  "notifications.category.agent": "솔로 채팅 완료",
  "notifications.category.reminders": "미리 알림",
  "notifications.permission.development":
    "로컬 개발 설정에 따라 알림이 일시 중지되었습니다. .env.local에서 BUZZ_DEV_NOTIFICATIONS=0을 제거하고 개발 서버를 다시 시작하면 알림을 다시 받을 수 있습니다. 저장된 알림 설정은 유지됩니다.",
  "notifications.permission.waiting": "시스템 권한을 기다리는 중…",
  "notifications.permission.denied":
    "알림이 꺼져 있습니다. 브라우저 또는 시스템 설정에서 알림을 켜세요.",
  "notifications.permission.unsupported":
    "이 빌드에서는 시스템 알림을 표시할 수 없습니다.",
  "notifications.permission.default": "알림을 받으려면 알림 권한을 허용하세요.",
  "notifications.permission.allow": "알림 허용",
  "notifications.permission.check": "권한 확인",
  "notifications.error.preferences": "알림 설정을 저장하지 못했습니다",
  "notifications.error.retry": "설정 저장 다시 시도",
  "notifications.error.reload": "저장된 설정 다시 불러오기",
  "notifications.error.send": "Buzz에서 알림을 보내지 못했습니다",
  "notifications.dock.title": "Dock 읽지 않음 배지",
  "notifications.dock.unavailable":
    "Dock 배지는 번들로 설치된 macOS 앱에서 사용할 수 있으며 개발 서버에서는 사용할 수 없습니다.",
  "notifications.dock.description":
    "선택한 커뮤니티에 읽지 않은 활동이 있으면 점을 표시합니다. 메시지 수는 표시하지 않습니다.",
  "notifications.dock.default":
    "읽지 않음 표시를 보려면 알림과 배지를 허용하세요.",
  "notifications.dock.setupStatus":
    "읽지 않음 표시를 보려면 Dock 배지를 설정하세요.",
  "notifications.dock.enabled": "Buzz에서 Dock 배지를 표시할 수 있습니다.",
  "notifications.dock.disabled":
    "Dock 배지가 꺼져 있습니다. macOS 시스템 설정에서 켜세요.",
  "notifications.dock.denied":
    "알림이 꺼져 있습니다. macOS 시스템 설정에서 켜세요.",
  "notifications.dock.setup": "Dock 배지 설정",
  "notifications.dock.allow": "알림과 배지 허용",
  "notifications.dock.check": "Dock 권한 확인",
  "notifications.dock.error": "Dock 배지를 사용할 수 없습니다",
  "notifications.completion.done": "{agent} 작업이 완료되었습니다",
  "notifications.completion.error": "{agent}에서 오류가 발생했습니다",
  "notifications.completion.doneIn":
    "{conversation}에서 {agent} 작업이 완료되었습니다",
  "notifications.completion.errorIn":
    "{conversation}에서 {agent} 오류가 발생했습니다",
  "notifications.completion.viewIn": "{conversation}에서 보기",
  "notifications.completion.view": "대화 보기",
  "notifications.completion.errorBody": "대화 보기 · {error}",
  "notifications.completion.errorBodyIn": "{conversation}에서 보기 · {error}",
  "notifications.completion.action": "보기",
  "notifications.completion.agent": "에이전트",
  "notifications.payload.newMessage": "새 메시지",
  "notifications.payload.newCategory": "새 {category}",
  "notifications.payload.mentionChannel":
    "{sender}님이 #{channel} 채널에서 나를 언급했습니다",
  "notifications.payload.mentionDm":
    "{sender}님이 다이렉트 메시지에서 나를 언급했습니다",
  "notifications.payload.direct": "{sender}님이 다이렉트 메시지를 보냈습니다",
  "notifications.payload.replyChannel":
    "{sender}님이 #{channel} 채널에서 답글을 남겼습니다",
  "notifications.payload.replyDm":
    "{sender}님이 다이렉트 메시지에서 답글을 남겼습니다",
  "notifications.payload.workflowMentionChannel":
    "워크플로 · 소유자 {owner}: #{channel} 채널에서 나를 언급했습니다",
  "notifications.payload.workflowMentionDm":
    "워크플로 · 소유자 {owner}: 다이렉트 메시지에서 나를 언급했습니다",
  "notifications.payload.workflowDirect":
    "워크플로 · 소유자 {owner}: 다이렉트 메시지를 보냈습니다",
  "notifications.payload.workflowReplyChannel":
    "워크플로 · 소유자 {owner}: #{channel} 채널에서 답글을 남겼습니다",
  "notifications.payload.workflowReplyDm":
    "워크플로 · 소유자 {owner}: 다이렉트 메시지에서 답글을 남겼습니다",
  "notifications.completion.unknownDone": "에이전트 작업이 완료되었습니다",
  "notifications.completion.unknownError": "에이전트에서 오류가 발생했습니다",
  "notifications.completion.unknownDoneIn":
    "{conversation}에서 에이전트 작업이 완료되었습니다",
  "notifications.completion.unknownErrorIn":
    "{conversation}에서 에이전트 오류가 발생했습니다",
  "notifications.error.restoreDetails":
    "알림 설정을 복원하지 못했습니다. 알림을 일시 중지했습니다. 설정을 다시 불러오세요.",
  "notifications.error.saveDetails":
    "선택한 알림 설정을 적용했지만 이 기기에 저장하지 못했습니다. 저장을 다시 시도하세요.",
};

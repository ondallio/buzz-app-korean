export const en = {
  "sidebarUnreadNavigation.landmark": "Subscribed channels",
  "sidebarUnreadNavigation.aboveOne": "{count} unread conversation above",
  "sidebarUnreadNavigation.aboveMany": "{count} unread conversations above",
  "sidebarUnreadNavigation.belowOne": "{count} unread conversation below",
  "sidebarUnreadNavigation.belowMany": "{count} unread conversations below",
  "sidebarUnreadNavigation.count": "{count} unread",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "sidebarUnreadNavigation.landmark": "참여 중인 채널",
  "sidebarUnreadNavigation.aboveOne": "위쪽에 읽지 않은 대화 {count}개",
  "sidebarUnreadNavigation.aboveMany": "위쪽에 읽지 않은 대화 {count}개",
  "sidebarUnreadNavigation.belowOne": "아래쪽에 읽지 않은 대화 {count}개",
  "sidebarUnreadNavigation.belowMany": "아래쪽에 읽지 않은 대화 {count}개",
  "sidebarUnreadNavigation.count": "읽지 않음 {count}개",
};

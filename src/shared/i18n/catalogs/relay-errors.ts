export const en = {
  "relayErrors.refreshMentionMembership":
    "Refresh channel membership before mentioning anyone",
  "relayErrors.recipientNoLongerMember":
    "A selected recipient is no longer a channel member; remove them or refresh membership",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "relayErrors.refreshMentionMembership":
    "멘션하기 전에 채널 멤버 정보를 새로 고쳐 주세요.",
  "relayErrors.recipientNoLongerMember":
    "선택한 수신자가 더 이상 채널 멤버가 아닙니다. 해당 수신자를 제거하거나 멤버 정보를 새로 고쳐 주세요.",
};

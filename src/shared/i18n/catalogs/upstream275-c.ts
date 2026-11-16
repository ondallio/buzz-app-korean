export const en = {
  "u275c.file.preview": "Preview {name}",
  "u275c.composer.sendChipsMainWindow": "Send chips from the main window.",
  "u275c.delete.removeLabel": "Remove from this device",
  "u275c.delete.unconfirmedTitle": "Remove message from this device?",
  "u275c.delete.unconfirmedDescription":
    "Buzz couldn’t confirm whether this message was delivered. Removing it stops this device from sending it. If it was delivered, it stays in the conversation. This cannot be undone.",
  "u275c.delete.removePending": "Removing…",
  "u275c.delete.removeConfirm": "Remove",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "u275c.file.preview": "{name} 미리보기",
  "u275c.composer.sendChipsMainWindow": "칩은 메인 창에서 보내 주세요.",
  "u275c.delete.removeLabel": "이 기기에서 제거",
  "u275c.delete.unconfirmedTitle": "이 기기에서 메시지를 제거할까요?",
  "u275c.delete.unconfirmedDescription":
    "이 메시지가 전달되었는지 Buzz에서 확인하지 못했습니다. 제거하면 이 기기에서 더 이상 전송하지 않습니다. 이미 전달되었다면 대화에 그대로 남습니다. 이 작업은 되돌릴 수 없습니다.",
  "u275c.delete.removePending": "제거 중…",
  "u275c.delete.removeConfirm": "제거",
};

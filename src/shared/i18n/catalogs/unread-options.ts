export const en = {
  "unreadOptions.markLocal": "Mark unread on this device",
  "unreadOptions.markThrough": "Mark read through loaded messages",
  "unreadOptions.status": "Unread status",
  "unreadOptions.guidance":
    "Observed messages only—not exact totals. Manual unread is local to this device. Older read hints can expire; this is not an everlasting read receipt log.",
  "unreadOptions.sync": "Read sync: {capability} · {status}",
  "unreadOptions.refresh": "Refresh unread observations",
  "unreadOptions.retry": "Retry read sync",
  "unreadOptions.operationFailed": "Read-state operation failed",
  "unreadOptions.loadVerified":
    "Load a verified message before marking through it.",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "unreadOptions.markLocal": "이 기기에서 읽지 않음으로 표시",
  "unreadOptions.markThrough": "불러온 메시지까지 읽음으로 표시",
  "unreadOptions.status": "읽지 않음 상태",
  "unreadOptions.guidance":
    "확인한 메시지만 표시하며 전체 개수를 뜻하지 않습니다. 읽지 않음 표시는 이 기기에만 적용됩니다. 오래된 읽음 정보는 만료될 수 있으므로 영구적인 읽음 확인 기록이 아닙니다.",
  "unreadOptions.sync": "읽음 동기화: {capability} · {status}",
  "unreadOptions.refresh": "읽지 않음 정보 새로고침",
  "unreadOptions.retry": "읽음 동기화 다시 시도",
  "unreadOptions.operationFailed": "읽음 상태 작업에 실패했습니다.",
  "unreadOptions.loadVerified":
    "먼저 검증된 메시지를 불러온 후 해당 메시지까지 읽음으로 표시하세요.",
};

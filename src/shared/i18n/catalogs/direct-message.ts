export const en = {
  "directMessage.new": "New message",
  "directMessage.channelName": "new message",
  "directMessage.messageTo": "Message {names}",
  "directMessage.savedInvalid": "The saved new message could not be restored.",
  "directMessage.restoreFailed": "Could not restore the message.",
  "directMessage.agentUnavailable":
    "A selected agent is no longer available. Remove it or refresh its details and try again.",
  "directMessage.confirmEarlier":
    "Retry the earlier message to confirm its delivery before editing.",
  "directMessage.sendFailed": "Could not send your message. Try again.",
  "directMessage.uploading": "Uploading files…",
  "directMessage.sending": "Sending message…",
  "directMessage.uploadFailed":
    "A file couldn’t upload. Retry or remove it, then send again.",
  "directMessage.unavailable":
    "Starting direct messages is unavailable on this connection.",
  "directMessage.retrySend": "Retry send",
  "directMessage.loadingHistory": "Loading messages…",
  "directMessage.retryHistory": "Retry messages",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "directMessage.new": "새 메시지",
  "directMessage.channelName": "새 메시지",
  "directMessage.messageTo": "{names}에게 메시지",
  "directMessage.savedInvalid": "저장된 새 메시지를 복원하지 못했습니다.",
  "directMessage.restoreFailed": "메시지를 복원하지 못했습니다.",
  "directMessage.agentUnavailable":
    "선택한 에이전트를 더 이상 사용할 수 없습니다. 제거하거나 세부 정보를 새로 고친 뒤 다시 시도하세요.",
  "directMessage.confirmEarlier":
    "수정하기 전에 이전 메시지 전송을 다시 시도하여 전달 여부를 확인하세요.",
  "directMessage.sendFailed": "메시지를 보내지 못했습니다. 다시 시도하세요.",
  "directMessage.uploading": "파일을 업로드하는 중…",
  "directMessage.sending": "메시지를 보내는 중…",
  "directMessage.uploadFailed":
    "파일을 업로드하지 못했습니다. 다시 시도하거나 파일을 제거한 뒤 다시 보내세요.",
  "directMessage.unavailable": "이 연결에서는 새 DM을 시작할 수 없습니다.",
  "directMessage.retrySend": "전송 다시 시도",
  "directMessage.loadingHistory": "메시지를 불러오는 중…",
  "directMessage.retryHistory": "메시지 다시 불러오기",
};

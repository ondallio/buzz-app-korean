export const en = {
  "messageNotices.upload.preparing": "Preparing upload to {name}",
  "messageNotices.upload.preparingMore":
    "Preparing upload to {name} and {count} more",
  "messageNotices.upload.preparingThread":
    "Preparing upload to thread in {name}",
  "messageNotices.upload.preparingThreadMore":
    "Preparing upload to thread in {name} and {count} more",
  "messageNotices.upload.uploading": "Uploading to {name}",
  "messageNotices.upload.uploadingMore": "Uploading to {name} and {count} more",
  "messageNotices.upload.uploadingThread": "Uploading to thread in {name}",
  "messageNotices.upload.uploadingThreadMore":
    "Uploading to thread in {name} and {count} more",
  "messageNotices.upload.finishing": "Finishing upload to {name}",
  "messageNotices.upload.finishingMore":
    "Finishing upload to {name} and {count} more",
  "messageNotices.upload.finishingThread":
    "Finishing upload to thread in {name}",
  "messageNotices.upload.finishingThreadMore":
    "Finishing upload to thread in {name} and {count} more",
  "messageNotices.upload.failed": "Upload to {name} failed",
  "messageNotices.upload.failedThread": "Upload to thread in {name} failed",
  "messageNotices.send.failed": "Message to {name} failed to send",
  "messageNotices.send.failedThread":
    "Message to thread in {name} failed to send",
  "messageNotices.recovery.failed":
    "Could not restore the failed send to {name}. Retry recovery before leaving this session.",
  "messageNotices.recovery.failedThread":
    "Could not restore the failed send to thread in {name}. Retry recovery before leaving this session.",
  "messageNotices.recovery.conflict":
    "Failed send to {name} was kept because its draft changed. Clear that draft, then retry recovery before leaving this session.",
  "messageNotices.recovery.conflictThread":
    "Failed send to thread in {name} was kept because its draft changed. Clear that draft, then retry recovery before leaving this session.",
  "messageNotices.upload.cancelLabel": "Cancel upload to {name}",
  "messageNotices.upload.cancelThreadLabel":
    "Cancel upload to thread in {name}",
  "messageNotices.open": "Open {name}",
  "messageNotices.openThread": "Open thread in {name}",
  "messageNotices.cancel": "Cancel",
  "messageNotices.recovery.retry": "Retry failed send recovery",
  "messageNotices.unknownError": "Unknown error",
  "messageNotices.channel.archivedLabel": "Archived channel",
  "messageNotices.channel.readOnlyLabel": "Read-only channel",
  "messageNotices.channel.previewLabel": "Channel preview",
  "messageNotices.channel.archived": "This channel is archived",
  "messageNotices.channel.readOnly": "This channel is read-only",
  "messageNotices.channel.readOnlyJoin":
    "This channel is read-only. Join to keep it in your sidebar and appear as a viewer.",
  "messageNotices.channel.joinPrompt": "Join channel to send messages",
  "messageNotices.channel.preview": "You’re previewing this channel",
  "messageNotices.channel.failed": "Couldn’t join this channel.",
  "messageNotices.chat.archivedLabel": "Archived chat",
  "messageNotices.chat.readOnlyLabel": "Read-only chat",
  "messageNotices.chat.previewLabel": "Chat preview",
  "messageNotices.chat.archived": "This chat is archived",
  "messageNotices.chat.readOnly": "This chat is read-only",
  "messageNotices.chat.readOnlyJoin":
    "This chat is read-only. Join to keep it in your sidebar and appear as a viewer.",
  "messageNotices.chat.joinPrompt": "Join chat to send messages",
  "messageNotices.chat.preview": "You’re previewing this chat",
  "messageNotices.chat.failed": "Couldn’t join this chat.",
  "messageNotices.join": "Join",
  "messageNotices.readOnlyAccess": "Read-only access",
  "messageNotices.joinUnconfirmed":
    "Join may have taken effect, but it is not confirmed yet. Try again to check.",
  "messageNotices.delivery.failed": "Couldn’t send this message.",
  "messageNotices.delivery.unconfirmed": "Delivery not yet confirmed.",
  "messageNotices.delivery.unconfirmedError":
    "Delivery not yet confirmed. {error}",
  "messageNotices.delivery.retry": "Retry",
  "messageNotices.latest": "Jump to latest",
  "messageNotices.latest.one": "{count} new message",
  "messageNotices.latest.many": "{count} new messages",
  "messageNotices.drop": "Drop files into this conversation",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "messageNotices.upload.preparing": "{name}에 업로드 준비 중",
  "messageNotices.upload.preparingMore": "{name} 외 {count}건 업로드 준비 중",
  "messageNotices.upload.preparingThread": "{name}의 스레드에 업로드 준비 중",
  "messageNotices.upload.preparingThreadMore":
    "{name}의 스레드 외 {count}건 업로드 준비 중",
  "messageNotices.upload.uploading": "{name}에 업로드 중",
  "messageNotices.upload.uploadingMore": "{name} 외 {count}건 업로드 중",
  "messageNotices.upload.uploadingThread": "{name}의 스레드에 업로드 중",
  "messageNotices.upload.uploadingThreadMore":
    "{name}의 스레드 외 {count}건 업로드 중",
  "messageNotices.upload.finishing": "{name}에 업로드 마무리 중",
  "messageNotices.upload.finishingMore": "{name} 외 {count}건 업로드 마무리 중",
  "messageNotices.upload.finishingThread": "{name}의 스레드에 업로드 마무리 중",
  "messageNotices.upload.finishingThreadMore":
    "{name}의 스레드 외 {count}건 업로드 마무리 중",
  "messageNotices.upload.failed": "{name}에 업로드하지 못했습니다",
  "messageNotices.upload.failedThread":
    "{name}의 스레드에 업로드하지 못했습니다",
  "messageNotices.send.failed": "{name}에 메시지를 보내지 못했습니다",
  "messageNotices.send.failedThread":
    "{name}의 스레드에 메시지를 보내지 못했습니다",
  "messageNotices.recovery.failed":
    "{name}에 보내지 못한 메시지를 복원하지 못했습니다. 이 세션을 떠나기 전에 복구를 다시 시도하세요.",
  "messageNotices.recovery.failedThread":
    "{name}의 스레드에 보내지 못한 메시지를 복원하지 못했습니다. 이 세션을 떠나기 전에 복구를 다시 시도하세요.",
  "messageNotices.recovery.conflict":
    "{name}에 보내지 못한 메시지는 초안이 변경되어 보관했습니다. 초안을 비운 뒤 이 세션을 떠나기 전에 복구를 다시 시도하세요.",
  "messageNotices.recovery.conflictThread":
    "{name}의 스레드에 보내지 못한 메시지는 초안이 변경되어 보관했습니다. 초안을 비운 뒤 이 세션을 떠나기 전에 복구를 다시 시도하세요.",
  "messageNotices.upload.cancelLabel": "{name} 업로드 취소",
  "messageNotices.upload.cancelThreadLabel": "{name}의 스레드 업로드 취소",
  "messageNotices.open": "{name} 열기",
  "messageNotices.openThread": "{name}의 스레드 열기",
  "messageNotices.cancel": "취소",
  "messageNotices.recovery.retry": "실패한 전송 복구 다시 시도",
  "messageNotices.unknownError": "알 수 없는 오류",
  "messageNotices.channel.archivedLabel": "보관된 채널",
  "messageNotices.channel.readOnlyLabel": "읽기 전용 채널",
  "messageNotices.channel.previewLabel": "채널 미리보기",
  "messageNotices.channel.archived": "이 채널은 보관되었습니다",
  "messageNotices.channel.readOnly": "이 채널은 읽기 전용입니다",
  "messageNotices.channel.readOnlyJoin":
    "이 채널은 읽기 전용입니다. 참여하면 사이드바에 유지하고 열람자로 표시할 수 있습니다.",
  "messageNotices.channel.joinPrompt": "채널에 참여하여 메시지를 보내세요",
  "messageNotices.channel.preview": "이 채널을 미리 보고 있습니다",
  "messageNotices.channel.failed": "이 채널에 참여하지 못했습니다.",
  "messageNotices.chat.archivedLabel": "보관된 채팅",
  "messageNotices.chat.readOnlyLabel": "읽기 전용 채팅",
  "messageNotices.chat.previewLabel": "채팅 미리보기",
  "messageNotices.chat.archived": "이 채팅은 보관되었습니다",
  "messageNotices.chat.readOnly": "이 채팅은 읽기 전용입니다",
  "messageNotices.chat.readOnlyJoin":
    "이 채팅은 읽기 전용입니다. 참여하면 사이드바에 유지하고 열람자로 표시할 수 있습니다.",
  "messageNotices.chat.joinPrompt": "채팅에 참여하여 메시지를 보내세요",
  "messageNotices.chat.preview": "이 채팅을 미리 보고 있습니다",
  "messageNotices.chat.failed": "이 채팅에 참여하지 못했습니다.",
  "messageNotices.join": "참여",
  "messageNotices.readOnlyAccess": "읽기 전용 접근",
  "messageNotices.joinUnconfirmed":
    "참여가 적용되었을 수 있지만 아직 확인되지 않았습니다. 다시 시도하여 확인하세요.",
  "messageNotices.delivery.failed": "이 메시지를 보내지 못했습니다.",
  "messageNotices.delivery.unconfirmed": "아직 전송이 확인되지 않았습니다.",
  "messageNotices.delivery.unconfirmedError":
    "아직 전송이 확인되지 않았습니다. {error}",
  "messageNotices.delivery.retry": "다시 시도",
  "messageNotices.latest": "최신 메시지로 이동",
  "messageNotices.latest.one": "새 메시지 {count}개",
  "messageNotices.latest.many": "새 메시지 {count}개",
  "messageNotices.drop": "이 대화에 파일을 놓으세요",
};

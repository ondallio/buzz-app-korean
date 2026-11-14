export const en = {
  "messageActions.report.category.spam": "Spam",
  "messageActions.report.category.profanity": "Profanity or hate speech",
  "messageActions.report.category.nudity": "Nudity or sexual content",
  "messageActions.report.category.impersonation": "Impersonation",
  "messageActions.report.category.malware": "Malware or scam",
  "messageActions.report.category.illegal": "Illegal content",
  "messageActions.report.category.other": "Other",
  "messageActions.report.title": "Report message",
  "messageActions.report.description":
    "Reports go to this community's moderators for review. The author is not notified of who reported them.",
  "messageActions.cancel": "Cancel",
  "messageActions.report.submit": "Submit report",
  "messageActions.report.reason": "Reason",
  "messageActions.report.note": "Additional context (optional)",
  "messageActions.report.placeholder": "Add anything that helps moderators...",
  "messageActions.report.failed": "Failed to submit report. Try again.",
  "messageActions.report.pending": "Submitting report…",
  "messageActions.report.review": "Review report",
  "messageActions.read": "Mark read",
  "messageActions.unread": "Mark unread",
  "messageActions.edit": "Edit message",
  "messageActions.delete.label": "Delete message",
  "messageActions.follow": "Follow thread",
  "messageActions.unfollow": "Unfollow thread",
  "messageActions.unreadFailed": "Could not update unread state. Try again.",
  "messageActions.restoreUnreadFailed": "Could not restore unread state.",
  "messageActions.followFailed": "Could not save thread follow. Try again.",
  "messageActions.delete.unavailable":
    "This conversation is no longer available for changes.",
  "messageActions.delete.changed":
    "This message’s delivery changed. Cancel to see its current status.",
  "messageActions.delete.failed": "Could not delete this message. Try again.",
  "messageActions.delete.title": "Delete message?",
  "messageActions.delete.unsentDescription":
    "This message wasn’t sent. Deleting it removes it from this device. This cannot be undone.",
  "messageActions.delete.sentDescription":
    "This requests removal of this message from Buzz’s relay. People may still have copies. This cannot be undone.",
  "messageActions.close": "Close",
  "messageActions.delete.pending": "Deleting…",
  "messageActions.retry": "Retry",
  "messageActions.delete.confirm": "Delete",
  "messageActions.delete.unconfirmed":
    "Delivery could not be confirmed. Retry sends the same operation.",
  "messageActions.update.editError": "Message edit: {error}",
  "messageActions.update.deleteError": "Message deletion: {error}",
  "messageActions.update.editUnconfirmed":
    "Message edit: Delivery could not be confirmed.",
  "messageActions.update.deleteUnconfirmed":
    "Message deletion: Delivery could not be confirmed.",
  "messageActions.update.unknown":
    "This may already have reached the conversation. Retry sends the same operation; dismissing does not undo it.",
  "messageActions.update.dismissFailed": "Could not dismiss the operation.",
  "messageActions.update.discard": "Discard failed update",
  "messageActions.update.dismiss": "Dismiss unconfirmed update",
  "messageActions.update.retry": "Retry message update",
  "messageActions.forward.blocked":
    "Retry the pending forward before forwarding another message.",
  "messageActions.forward.review": "Review pending forward",
  "messageActions.forward.personUnavailable":
    "This agent is no longer available for direct messages. Choose another person.",
  "messageActions.forward.failed": "Couldn’t forward the message. Try again.",
  "messageActions.forward.success": "Message forwarded to {name}",
  "messageActions.forward.open": "Open your DM with {name}",
  "messageActions.forward.title": "Forward message",
  "messageActions.forward.description":
    "Send this message to a person, with an optional note.",
  "messageActions.forward.retry": "Retry forward",
  "messageActions.forward.confirm": "Forward",
  "messageActions.forward.note": "Note (optional)",
  "messageActions.forward.preview": "Message to forward",
  "messageActions.forward.access":
    "The recipient can open the original only if they have access to its conversation.",
  "messageActions.queue.label": "Queued follow-ups",
  "messageActions.queue.attachment": "Attachment",
  "messageActions.queue.sending": "Sending…",
  "messageActions.queue.predecessor":
    "Paused because an earlier message was handled in another window. Send when ready.",
  "messageActions.queue.restored": "Saved before restart. Send when ready.",
  "messageActions.queue.remove": "Remove queued message",
  "messageActions.queue.edit": "Edit queued message",
  "messageActions.queue.send": "Send",
  "messageActions.queue.compacting":
    "Wait for compaction to finish, or interrupt it.",
  "messageActions.typing.scopeChannel": "Channel conversation",
  "messageActions.typing.scopeUnknown": "Work with unconfirmed thread",
  "messageActions.typing.scopeThread": "Thread · {name}",
  "messageActions.typing.scopeMore": "+{count} more",
  "messageActions.typing.noStep": "No current step details received.",
  "messageActions.typing.onlyUpdates":
    "Only typing updates are reaching this app.",
  "messageActions.typing.remoteBuilderlab": "Running remotely on Builderlab…",
  "messageActions.typing.remote": "Running on a remote machine…",
  "messageActions.typing.openActivity": "View {name} activity",
  "messageActions.typing.openThread": "Open thread for {name}",
  "messageActions.typing.openConversation": "Open conversation for {name}",
  "messageActions.typing.workingOne": "{names} is working",
  "messageActions.typing.workingMany": "{names} are working",
  "messageActions.typing.humanOne": "{names} is typing",
  "messageActions.typing.humanMany": "{names} are typing",
  "messageActions.typing.humanMore": "{names} and {count} others are typing",
  "messageActions.typing.region": "Conversation activity",
  "messageActions.typing.activityOne": "Activity: {name} working",
  "messageActions.typing.activityMany": "Activity: {count} agents working",
  "messageActions.typing.stop": "Stop {name}",
  "messageActions.typing.stopScope": "Stop {name} in {scope}",
  "messageActions.typing.stopping": "Stopping…",
  "messageActions.typing.stopLabel": "Stop",
  "messageActions.typing.keyboard":
    "Press Down Arrow for working agents and conversation actions.",
  "messageActions.typing.workingNow": "Working now",
  "messageActions.typing.agentsNow": "Agents working now",
  "messageActions.typing.combinedOneOne":
    "{agents} is working. {names} is typing",
  "messageActions.typing.combinedOneMany":
    "{agents} is working. {names} are typing",
  "messageActions.typing.combinedOneMore":
    "{agents} is working. {names} and {count} others are typing",
  "messageActions.typing.combinedManyOne":
    "{agents} are working. {names} is typing",
  "messageActions.typing.combinedManyMany":
    "{agents} are working. {names} are typing",
  "messageActions.typing.combinedManyMore":
    "{agents} are working. {names} and {count} others are typing",
  "messageActions.report.menu": "Report",
  "messageActions.report.sent": "Report submitted to community moderators",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "messageActions.report.category.spam": "스팸",
  "messageActions.report.category.profanity": "욕설 또는 혐오 표현",
  "messageActions.report.category.nudity": "노출 또는 성적 콘텐츠",
  "messageActions.report.category.impersonation": "사칭",
  "messageActions.report.category.malware": "악성 코드 또는 사기",
  "messageActions.report.category.illegal": "불법 콘텐츠",
  "messageActions.report.category.other": "기타",
  "messageActions.report.title": "메시지 신고",
  "messageActions.report.description":
    "신고는 이 커뮤니티의 운영자에게 전달되어 검토됩니다. 작성자에게 신고자의 신원은 알려지지 않습니다.",
  "messageActions.cancel": "취소",
  "messageActions.report.submit": "신고 제출",
  "messageActions.report.reason": "사유",
  "messageActions.report.note": "추가 설명 (선택사항)",
  "messageActions.report.placeholder":
    "운영자의 검토에 도움이 되는 내용을 추가하세요...",
  "messageActions.report.failed":
    "신고를 제출하지 못했습니다. 다시 시도하세요.",
  "messageActions.report.pending": "신고 제출 중…",
  "messageActions.report.review": "신고 검토",
  "messageActions.read": "읽음으로 표시",
  "messageActions.unread": "읽지 않음으로 표시",
  "messageActions.edit": "메시지 수정",
  "messageActions.delete.label": "메시지 삭제",
  "messageActions.follow": "스레드 팔로우",
  "messageActions.unfollow": "스레드 팔로우 취소",
  "messageActions.unreadFailed":
    "읽지 않음 상태를 변경하지 못했습니다. 다시 시도하세요.",
  "messageActions.restoreUnreadFailed": "읽지 않음 상태를 복원하지 못했습니다.",
  "messageActions.followFailed":
    "스레드 팔로우를 저장하지 못했습니다. 다시 시도하세요.",
  "messageActions.delete.unavailable": "이 대화는 더 이상 변경할 수 없습니다.",
  "messageActions.delete.changed":
    "메시지의 전송 상태가 변경되었습니다. 취소하여 현재 상태를 확인하세요.",
  "messageActions.delete.failed":
    "이 메시지를 삭제하지 못했습니다. 다시 시도하세요.",
  "messageActions.delete.title": "메시지를 삭제할까요?",
  "messageActions.delete.unsentDescription":
    "이 메시지는 전송되지 않았습니다. 삭제하면 이 기기에서 제거되며 되돌릴 수 없습니다.",
  "messageActions.delete.sentDescription":
    "Buzz 릴레이에 이 메시지의 삭제를 요청합니다. 다른 사람이 사본을 가지고 있을 수 있습니다. 이 작업은 되돌릴 수 없습니다.",
  "messageActions.close": "닫기",
  "messageActions.delete.pending": "삭제 중…",
  "messageActions.retry": "다시 시도",
  "messageActions.delete.confirm": "삭제",
  "messageActions.delete.unconfirmed":
    "전송을 확인하지 못했습니다. 다시 시도하면 동일한 작업을 전송합니다.",
  "messageActions.update.editError": "메시지 수정: {error}",
  "messageActions.update.deleteError": "메시지 삭제: {error}",
  "messageActions.update.editUnconfirmed":
    "메시지 수정: 전송을 확인하지 못했습니다.",
  "messageActions.update.deleteUnconfirmed":
    "메시지 삭제: 전송을 확인하지 못했습니다.",
  "messageActions.update.unknown":
    "이미 대화에 반영되었을 수 있습니다. 다시 시도하면 동일한 작업을 전송하며, 알림을 닫아도 작업은 취소되지 않습니다.",
  "messageActions.update.dismissFailed": "작업 알림을 닫지 못했습니다.",
  "messageActions.update.discard": "실패한 업데이트 버리기",
  "messageActions.update.dismiss": "미확인 업데이트 알림 닫기",
  "messageActions.update.retry": "메시지 업데이트 다시 시도",
  "messageActions.forward.blocked":
    "다른 메시지를 전달하기 전에 대기 중인 전달을 다시 시도하세요.",
  "messageActions.forward.review": "대기 중인 전달 검토",
  "messageActions.forward.personUnavailable":
    "이 에이전트에게 더 이상 다이렉트 메시지를 보낼 수 없습니다. 다른 사람을 선택하세요.",
  "messageActions.forward.failed":
    "메시지를 전달하지 못했습니다. 다시 시도하세요.",
  "messageActions.forward.success": "{name}에게 메시지를 전달했습니다",
  "messageActions.forward.open": "{name}과의 DM 열기",
  "messageActions.forward.title": "메시지 전달",
  "messageActions.forward.description":
    "이 메시지를 다른 사람에게 전달합니다. 메모를 추가할 수 있습니다.",
  "messageActions.forward.retry": "전달 다시 시도",
  "messageActions.forward.confirm": "전달",
  "messageActions.forward.note": "메모 (선택사항)",
  "messageActions.forward.preview": "전달할 메시지",
  "messageActions.forward.access":
    "수신자는 해당 대화에 접근 권한이 있어야 원본을 열 수 있습니다.",
  "messageActions.queue.label": "대기 중인 후속 메시지",
  "messageActions.queue.attachment": "첨부 파일",
  "messageActions.queue.sending": "전송 중…",
  "messageActions.queue.predecessor":
    "이전 메시지가 다른 창에서 처리되어 일시 정지되었습니다. 준비되면 전송하세요.",
  "messageActions.queue.restored":
    "재시작 전에 저장되었습니다. 준비되면 전송하세요.",
  "messageActions.queue.remove": "대기 메시지 제거",
  "messageActions.queue.edit": "대기 메시지 수정",
  "messageActions.queue.send": "전송",
  "messageActions.queue.compacting":
    "압축이 끝날 때까지 기다리거나 중단하세요.",
  "messageActions.typing.scopeChannel": "채널 대화",
  "messageActions.typing.scopeUnknown": "스레드가 확인되지 않은 작업",
  "messageActions.typing.scopeThread": "스레드 · {name}",
  "messageActions.typing.scopeMore": "+{count}개 더",
  "messageActions.typing.noStep":
    "현재 단계의 세부 정보를 아직 받지 못했습니다.",
  "messageActions.typing.onlyUpdates":
    "이 앱에는 입력 중 업데이트만 도착하고 있습니다.",
  "messageActions.typing.remoteBuilderlab": "Builderlab에서 원격으로 실행 중…",
  "messageActions.typing.remote": "원격 기기에서 실행 중…",
  "messageActions.typing.openActivity": "{name} 활동 보기",
  "messageActions.typing.openThread": "{name}의 스레드 열기",
  "messageActions.typing.openConversation": "{name}의 대화 열기",
  "messageActions.typing.workingOne": "{names} 작업 중",
  "messageActions.typing.workingMany": "{names} 작업 중",
  "messageActions.typing.humanOne": "{names} 입력 중",
  "messageActions.typing.humanMany": "{names} 입력 중",
  "messageActions.typing.humanMore": "{names} 외 {count}명 입력 중",
  "messageActions.typing.region": "대화 활동",
  "messageActions.typing.activityOne": "활동: {name} 작업 중",
  "messageActions.typing.activityMany": "활동: 에이전트 {count}명 작업 중",
  "messageActions.typing.stop": "{name} 중지",
  "messageActions.typing.stopScope": "{scope}의 {name} 중지",
  "messageActions.typing.stopping": "중지 중…",
  "messageActions.typing.stopLabel": "중지",
  "messageActions.typing.keyboard":
    "아래쪽 화살표를 눌러 작업 중인 에이전트와 대화 작업을 확인하세요.",
  "messageActions.typing.workingNow": "현재 작업 중",
  "messageActions.typing.agentsNow": "현재 작업 중인 에이전트",
  "messageActions.typing.combinedOneOne": "{agents} 작업 중. {names} 입력 중",
  "messageActions.typing.combinedOneMany": "{agents} 작업 중. {names} 입력 중",
  "messageActions.typing.combinedOneMore":
    "{agents} 작업 중. {names} 외 {count}명 입력 중",
  "messageActions.typing.combinedManyOne": "{agents} 작업 중. {names} 입력 중",
  "messageActions.typing.combinedManyMany": "{agents} 작업 중. {names} 입력 중",
  "messageActions.typing.combinedManyMore":
    "{agents} 작업 중. {names} 외 {count}명 입력 중",
  "messageActions.report.menu": "신고",
  "messageActions.report.sent": "커뮤니티 운영자에게 신고를 제출했습니다",
};

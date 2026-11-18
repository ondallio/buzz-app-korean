export const en = {
  "futerms.forward.reloadMessage": "Reload the message before forwarding it.",
  "futerms.forward.reloadAttachments":
    "Reload the message attachments before forwarding it.",
  "futerms.forward.attachmentNotForwardable":
    "This message contains an attachment that can’t be forwarded. Copy its link instead.",
  "futerms.forward.tooLong":
    "This message is too long to forward. Copy its link instead.",
  "futerms.forward.cannotForward": "This message cannot be forwarded.",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "futerms.forward.reloadMessage": "전달하기 전에 메시지를 다시 불러오세요.",
  "futerms.forward.reloadAttachments":
    "전달하기 전에 메시지 첨부 파일을 다시 불러오세요.",
  "futerms.forward.attachmentNotForwardable":
    "이 메시지에는 전달할 수 없는 첨부 파일이 있습니다. 대신 링크를 복사하세요.",
  "futerms.forward.tooLong":
    "메시지가 너무 길어 전달할 수 없습니다. 대신 링크를 복사하세요.",
  "futerms.forward.cannotForward": "이 메시지는 전달할 수 없습니다.",
};

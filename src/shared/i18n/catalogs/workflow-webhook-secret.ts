export const en = {
  "workflowSecret.title": "Webhook ready",
  "workflowSecret.description":
    "This private secret is shown once and cannot be recovered. Copy and store it before continuing.",
  "workflowSecret.continue": "Continue",
  "workflowSecret.url": "Webhook URL",
  "workflowSecret.copyUrl": "Copy URL",
  "workflowSecret.noAddress":
    "The relay’s HTTP address is unavailable from this host. Send requests to {path} on the relay.",
  "workflowSecret.header": "X-Webhook-Secret header",
  "workflowSecret.unavailable": "Unavailable",
  "workflowSecret.hideLabel": "Hide webhook secret",
  "workflowSecret.revealLabel": "Reveal webhook secret",
  "workflowSecret.hide": "Hide",
  "workflowSecret.reveal": "Reveal",
  "workflowSecret.copySecret": "Copy secret",
  "workflowSecret.gone":
    "This secret is no longer available from this session.",
  "workflowSecret.urlCopied": "URL copied.",
  "workflowSecret.secretCopied": "Secret copied.",
  "workflowSecret.urlCopyFailed":
    "Couldn’t copy the URL. Select it and copy it manually.",
  "workflowSecret.secretCopyFailed":
    "Couldn’t copy the secret. Reveal it and copy it manually.",
  "workflowSecret.leaveTitle": "Continue without this secret?",
  "workflowSecret.leaveDescription":
    "This private webhook secret cannot be recovered. Copy and store it before continuing, or explicitly leave it behind.",
  "workflowSecret.goBack": "Go back",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "workflowSecret.title": "웹훅 준비 완료",
  "workflowSecret.description":
    "이 비공개 시크릿은 한 번만 표시되며 다시 확인할 수 없습니다. 계속하기 전에 복사해 보관하세요.",
  "workflowSecret.continue": "계속",
  "workflowSecret.url": "웹훅 URL",
  "workflowSecret.copyUrl": "URL 복사",
  "workflowSecret.noAddress":
    "이 호스트에서 릴레이의 HTTP 주소를 확인할 수 없습니다. 릴레이의 {path} 경로로 요청을 보내세요.",
  "workflowSecret.header": "X-Webhook-Secret 헤더",
  "workflowSecret.unavailable": "사용할 수 없음",
  "workflowSecret.hideLabel": "웹훅 시크릿 숨기기",
  "workflowSecret.revealLabel": "웹훅 시크릿 표시",
  "workflowSecret.hide": "숨기기",
  "workflowSecret.reveal": "표시",
  "workflowSecret.copySecret": "시크릿 복사",
  "workflowSecret.gone": "이 세션에서 더 이상 이 시크릿을 확인할 수 없습니다.",
  "workflowSecret.urlCopied": "URL을 복사했습니다.",
  "workflowSecret.secretCopied": "시크릿을 복사했습니다.",
  "workflowSecret.urlCopyFailed":
    "URL을 복사하지 못했습니다. URL을 선택해 직접 복사하세요.",
  "workflowSecret.secretCopyFailed":
    "시크릿을 복사하지 못했습니다. 시크릿을 표시한 뒤 직접 복사하세요.",
  "workflowSecret.leaveTitle": "시크릿을 보관하지 않고 계속할까요?",
  "workflowSecret.leaveDescription":
    "이 비공개 웹훅 시크릿은 다시 확인할 수 없습니다. 계속하기 전에 복사해 보관하거나, 시크릿을 보관하지 않고 계속할지 선택하세요.",
  "workflowSecret.goBack": "돌아가기",
};

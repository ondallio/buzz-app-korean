export const en = {
  "v106msg.agentHistory.incompatible": "Incompatible",
  "v106msg.agentSave.clearModelOverrides": "Clear model and thinking overrides",
  "v106msg.agentConfig.versionHintBefore":
    ". Use a Buzz version that supports them, or open ",
  "v106msg.agentConfig.versionHintButton": "Previous Versions",
  "v106msg.agentConfig.versionHintAfter": " to look for a compatible revision.",
  "v106msg.compaction.title": "Auto-compact at",
  "v106msg.compaction.unit": "(thousands of tokens)",
  "v106msg.compaction.hint":
    "Compacts at this many tokens, or sooner if the model's context window fills first.",
  "v106msg.compaction.invalid":
    "Enter a whole number of at least {min}K, or leave it blank for the harness default.",
  "v106msg.compaction.placeholder": "Harness default",
  "v106msg.opened.communitySession": "Community session",
  "v106msg.composerLink.documentDraftChanged":
    "The draft changed or this link exceeds the document limit. Close and try again.",
  "v106msg.composerLink.destination": "Link destination",
  "v106msg.composerLink.browse": "Browse destinations",
  "v106msg.composerLink.search": "Search destinations…",
  "v106msg.composerLink.noMatch": "No destinations match.",
  "v106msg.messageAction.copyHighlight": "Copy highlight",
  "v106msg.messageAction.quoteHighlight": "Quote highlight",
  "v106msg.messageAction.copyLinkUrl": "Copy link URL",
  "v106msg.messageAction.copyMessageLink": "Copy message link",
  "v106msg.messageAction.quoteFailed":
    "Couldn’t quote. Select the text and try again.",
  "v106msg.messageAction.textCopied": "Text copied",
  "v106msg.messageAction.linkUrlCopied": "Link URL copied",
  "v106msg.documentEditor.body": "Document body",
  "v106msg.documentEditor.placeholder": "Write…",
  "v106msg.documentEditor.formatting": "Document formatting",
  "v106msg.documentEditor.content": "Document content",
  "v106msg.documentEditor.markdown": "Markdown",
  "v106msg.newWorkspace.moveTitle": "Move to new workspace",
  "v106msg.newWorkspace.preferencesUnavailable":
    "Saved workspace preferences are unavailable.",
  "v106msg.workspaceFields.instructionsPlaceholder":
    "Instructions and context for agents working in this workspace.",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "v106msg.agentHistory.incompatible": "호환되지 않음",
  "v106msg.agentSave.clearModelOverrides": "모델·사고 수준 재정의 지우기",
  "v106msg.agentConfig.versionHintBefore":
    ". 이를 지원하는 Buzz 버전을 사용하거나 ",
  "v106msg.agentConfig.versionHintButton": "이전 버전",
  "v106msg.agentConfig.versionHintAfter": "을 열어 호환되는 리비전을 찾으세요.",
  "v106msg.compaction.title": "자동 압축 기준",
  "v106msg.compaction.unit": "(천 토큰 단위)",
  "v106msg.compaction.hint":
    "이 토큰 수에 도달하면 압축합니다. 모델의 컨텍스트 창이 먼저 차면 더 일찍 압축합니다.",
  "v106msg.compaction.invalid":
    "{min}K 이상의 정수를 입력하거나, 하네스 기본값을 쓰려면 비워 두세요.",
  "v106msg.compaction.placeholder": "하네스 기본값",
  "v106msg.opened.communitySession": "커뮤니티 세션",
  "v106msg.composerLink.documentDraftChanged":
    "초안이 변경됐거나 링크가 문서 한도를 초과했습니다. 닫은 뒤 다시 시도해 주세요.",
  "v106msg.composerLink.destination": "링크 대상",
  "v106msg.composerLink.browse": "대상 둘러보기",
  "v106msg.composerLink.search": "대상 검색…",
  "v106msg.composerLink.noMatch": "일치하는 대상이 없습니다.",
  "v106msg.messageAction.copyHighlight": "선택한 텍스트 복사",
  "v106msg.messageAction.quoteHighlight": "선택한 텍스트 인용",
  "v106msg.messageAction.copyLinkUrl": "링크 URL 복사",
  "v106msg.messageAction.copyMessageLink": "메시지 링크 복사",
  "v106msg.messageAction.quoteFailed":
    "인용하지 못했습니다. 텍스트를 선택하고 다시 시도하세요.",
  "v106msg.messageAction.textCopied": "텍스트를 복사했습니다",
  "v106msg.messageAction.linkUrlCopied": "링크 URL을 복사했습니다",
  "v106msg.documentEditor.body": "문서 본문",
  "v106msg.documentEditor.placeholder": "내용 입력…",
  "v106msg.documentEditor.formatting": "문서 서식",
  "v106msg.documentEditor.content": "문서 내용",
  "v106msg.documentEditor.markdown": "Markdown",
  "v106msg.newWorkspace.moveTitle": "새 작업 공간으로 이동",
  "v106msg.newWorkspace.preferencesUnavailable":
    "저장된 작업 공간 설정을 사용할 수 없습니다.",
  "v106msg.workspaceFields.instructionsPlaceholder":
    "이 작업 공간에서 일하는 에이전트를 위한 지침과 맥락을 적어 주세요.",
} as const;

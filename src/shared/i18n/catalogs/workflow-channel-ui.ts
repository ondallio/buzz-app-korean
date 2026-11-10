export const en = {
  "workflowChannel.submitFailed":
    "The workflow could not be submitted. Your draft is retained.",
  "workflowChannel.deletePermissionLost":
    "You no longer have permission to delete this workflow. Refresh and try again.",
  "workflowChannel.deleteUnavailable":
    "Workflow deletion is unavailable on this connection.",
  "workflowChannel.runFailed": "Run could not be submitted.",
  "workflowChannel.saveUnavailable": "Saving is unavailable from this host.",
  "workflowChannel.checkSaved":
    "Check saved configuration or review Recent activity before continuing.",
  "workflowChannel.awaitingReadback":
    "Configuration saved; waiting for a readback of this exact revision. Check saved configuration or review the current version in Recent activity.",
  "workflowChannel.rejectedDraft":
    "Draft retained. Review the error below before continuing.",
  "workflowChannel.reading": "Reading configurations…",
  "workflowChannel.cleared": "Configurations cleared. Refresh to read again.",
  "workflowChannel.definitionsUnavailable":
    "Workflow definitions are unavailable.",
  "workflowChannel.readFailed":
    "Configurations could not be read. Use Refresh configurations to retry.",
  "workflowChannel.readFailedShort":
    "Configurations could not be read. Refresh to retry.",
  "workflowChannel.partial": "This is a bounded, partial list.",
  "workflowChannel.readOnlyHost":
    "Creating and saving workflows is unavailable from this host. You can browse saved configurations, but cannot save changes here yet.",
  "workflowChannel.region": "Workflows in {name}",
  "workflowChannel.runNow": "Run now",
  "workflowChannel.delete": "Delete workflow",
  "workflowChannel.authorOnly":
    "Only the author or their verified agent owner can delete this workflow.",
  "workflowChannel.refresh": "Refresh configurations",
  "workflowChannel.noDelete": "You can't delete workflows here.",
  "workflowChannel.continueEditing": "Continue editing retained draft",
  "workflowChannel.unsaved":
    "Unsaved changes stay in this editor. Leaving or reloading discards them without cancelling submitted operations.",
  "workflowChannel.details": "Configuration details",
  "workflowChannel.owner": "Owner: {id}",
  "workflowChannel.revision": "Revision: {id}",
  "workflowChannel.leaveTitle": "Leave this draft?",
  "workflowChannel.leaveDescription":
    "Unsaved draft changes will be discarded. Any submitted operation stays with the captured community session; leaving does not cancel or repeat it.",
  "workflowChannel.leaveAction": "Leave draft",
  "workflowChannel.keepEditing": "Keep editing",
  "workflowChannel.deleteTitle": "Delete this workflow?",
  "workflowChannel.deleteDescription":
    "The saved workflow may remain visible. Work already running may continue.",
  "workflowChannel.cancel": "Cancel",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "workflowChannel.submitFailed":
    "워크플로를 제출하지 못했습니다. 작성 중인 내용은 유지됩니다.",
  "workflowChannel.deletePermissionLost":
    "이 워크플로를 삭제할 권한이 더 이상 없습니다. 새로고침한 뒤 다시 시도해 주세요.",
  "workflowChannel.deleteUnavailable":
    "이 연결에서는 워크플로를 삭제할 수 없습니다.",
  "workflowChannel.runFailed": "실행 요청을 제출하지 못했습니다.",
  "workflowChannel.saveUnavailable": "이 호스트에서는 저장할 수 없습니다.",
  "workflowChannel.checkSaved":
    "계속하기 전에 저장된 구성을 확인하거나 최근 활동을 검토해 주세요.",
  "workflowChannel.awaitingReadback":
    "구성을 저장했으며, 정확히 이 리비전을 다시 읽어 확인하기를 기다리고 있습니다. 저장된 구성을 확인하거나 최근 활동에서 현재 버전을 검토해 주세요.",
  "workflowChannel.rejectedDraft":
    "작성 중인 내용이 유지됩니다. 계속하기 전에 아래 오류를 확인해 주세요.",
  "workflowChannel.reading": "구성 읽는 중…",
  "workflowChannel.cleared":
    "구성 목록을 비웠습니다. 다시 읽으려면 새로고침해 주세요.",
  "workflowChannel.definitionsUnavailable":
    "워크플로 정의를 사용할 수 없습니다.",
  "workflowChannel.readFailed":
    "구성을 읽지 못했습니다. 다시 시도하려면 구성 새로고침을 눌러 주세요.",
  "workflowChannel.readFailedShort":
    "구성을 읽지 못했습니다. 새로고침해서 다시 시도해 주세요.",
  "workflowChannel.partial": "개수 제한으로 목록의 일부만 표시됩니다.",
  "workflowChannel.readOnlyHost":
    "이 호스트에서는 워크플로를 만들거나 저장할 수 없습니다. 저장된 구성은 볼 수 있지만, 아직 여기서 변경 사항을 저장할 수는 없습니다.",
  "workflowChannel.region": "{name}의 워크플로",
  "workflowChannel.runNow": "지금 실행",
  "workflowChannel.delete": "워크플로 삭제",
  "workflowChannel.authorOnly":
    "작성자 또는 작성자가 에이전트인 경우 소유자로 확인된 사용자만 이 워크플로를 삭제할 수 있습니다.",
  "workflowChannel.refresh": "구성 새로고침",
  "workflowChannel.noDelete": "여기서는 워크플로를 삭제할 수 없습니다.",
  "workflowChannel.continueEditing": "유지된 작성 내용 계속 편집",
  "workflowChannel.unsaved":
    "저장하지 않은 변경 사항은 이 편집기에 유지됩니다. 나가거나 새로고침하면 해당 내용은 사라지지만, 이미 제출한 작업은 취소되지 않습니다.",
  "workflowChannel.details": "구성 세부 정보",
  "workflowChannel.owner": "소유자: {id}",
  "workflowChannel.revision": "리비전: {id}",
  "workflowChannel.leaveTitle": "작성 중인 내용에서 나갈까요?",
  "workflowChannel.leaveDescription":
    "저장하지 않은 변경 사항은 사라집니다. 제출한 작업은 제출 당시의 커뮤니티 세션에 남으며, 나가도 취소되거나 다시 실행되지 않습니다.",
  "workflowChannel.leaveAction": "작성 화면 나가기",
  "workflowChannel.keepEditing": "계속 편집",
  "workflowChannel.deleteTitle": "이 워크플로를 삭제할까요?",
  "workflowChannel.deleteDescription":
    "저장된 워크플로가 계속 표시될 수 있습니다. 이미 실행 중인 작업은 계속될 수 있습니다.",
  "workflowChannel.cancel": "취소",
};

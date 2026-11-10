export const en = {
  "workflowOperations.region": "Workflow operations",
  "workflowOperations.recent": "Recent activity",
  "workflowOperations.requestFailed":
    "The request could not be completed. Try again.",
  "workflowOperations.save.pending": "Saving configuration…",
  "workflowOperations.save.succeeded": "Configuration saved.",
  "workflowOperations.save.rejected": "Configuration was not saved.",
  "workflowOperations.save.unknown":
    "Save response was lost. Check the saved configuration before trying again.",
  "workflowOperations.trigger.pending": "Requesting a run…",
  "workflowOperations.trigger.succeeded":
    "Run requested. Inspect run history for its result.",
  "workflowOperations.trigger.rejected": "Failed to trigger workflow",
  "workflowOperations.trigger.unknown":
    "The run may have started, but its response was lost. Checking configuration or dismissing this notice cannot confirm a run.",
  "workflowOperations.delete.rejected":
    "Couldn't delete this workflow. Review the delivery details.",
  "workflowOperations.delete.confirmed":
    "Saved workflow deleted. Work already running may continue.",
  "workflowOperations.delete.stillSaved":
    "This workflow is still in saved configuration. Check again before deleting.",
  "workflowOperations.delete.unconfirmed":
    "Couldn't confirm deletion. Check saved configuration before deleting again.",
  "workflowOperations.noRun": "The relay did not create a workflow run.",
  "workflowOperations.reviewSaved": "Review current configuration",
  "workflowOperations.delivery": "{action}: {outcome} · delivery {delivery}",
  "workflowOperations.eventId": "Event ID: {id}",
  "workflowOperations.runId": "Returned run ID: {id}",
  "workflowOperations.action.save": "save",
  "workflowOperations.action.delete": "delete",
  "workflowOperations.action.trigger": "trigger",
  "workflowOperations.outcome.pending": "pending",
  "workflowOperations.outcome.succeeded": "succeeded",
  "workflowOperations.outcome.rejected": "rejected",
  "workflowOperations.outcome.unknown": "unknown",
  "workflowOperations.delivery.sending": "sending",
  "workflowOperations.delivery.accepted": "accepted",
  "workflowOperations.delivery.unknown": "unknown",
  "workflowOperations.delivery.failed": "failed",
  "workflowOperations.delivery.seen": "seen",
  "workflowOperations.dismissDelete":
    "Your draft is kept and editing is unlocked. Dismissing this notice does not confirm, cancel, or repeat deletion. Check saved configuration before deleting again.",
  "workflowOperations.dismissCommand":
    "Dismissal only clears this notice and its editor lock. It does not undo, cancel, or repeat a command, or confirm its outcome. Review the saved configuration before saving again; a new run request may run the workflow again. Your unsaved draft is kept.",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "workflowOperations.region": "워크플로 작업",
  "workflowOperations.recent": "최근 활동",
  "workflowOperations.requestFailed":
    "요청을 완료하지 못했습니다. 다시 시도해 주세요.",
  "workflowOperations.save.pending": "구성 저장 중…",
  "workflowOperations.save.succeeded": "구성을 저장했습니다.",
  "workflowOperations.save.rejected": "구성을 저장하지 못했습니다.",
  "workflowOperations.save.unknown":
    "저장 응답을 받지 못했습니다. 다시 시도하기 전에 저장된 구성을 확인해 주세요.",
  "workflowOperations.trigger.pending": "실행 요청 중…",
  "workflowOperations.trigger.succeeded":
    "실행을 요청했습니다. 실행 기록에서 결과를 확인해 주세요.",
  "workflowOperations.trigger.rejected": "워크플로 실행을 요청하지 못했습니다",
  "workflowOperations.trigger.unknown":
    "실행이 시작됐을 수 있지만 응답을 받지 못했습니다. 구성을 확인하거나 이 알림을 닫아도 실행 여부는 확인되지 않습니다.",
  "workflowOperations.delete.rejected":
    "이 워크플로를 삭제하지 못했습니다. 전달 세부 정보를 확인해 주세요.",
  "workflowOperations.delete.confirmed":
    "저장된 워크플로가 삭제되었습니다. 이미 실행 중인 작업은 계속될 수 있습니다.",
  "workflowOperations.delete.stillSaved":
    "이 워크플로가 아직 저장된 구성에 있습니다. 삭제하기 전에 다시 확인해 주세요.",
  "workflowOperations.delete.unconfirmed":
    "삭제 여부를 확인하지 못했습니다. 다시 삭제하기 전에 저장된 구성을 확인해 주세요.",
  "workflowOperations.noRun": "릴레이가 워크플로 실행을 생성하지 않았습니다.",
  "workflowOperations.reviewSaved": "현재 구성 검토",
  "workflowOperations.delivery": "{action}: {outcome} · 전달 상태: {delivery}",
  "workflowOperations.eventId": "이벤트 ID: {id}",
  "workflowOperations.runId": "반환된 실행 ID: {id}",
  "workflowOperations.action.save": "저장",
  "workflowOperations.action.delete": "삭제",
  "workflowOperations.action.trigger": "실행 요청",
  "workflowOperations.outcome.pending": "대기 중",
  "workflowOperations.outcome.succeeded": "성공",
  "workflowOperations.outcome.rejected": "거부됨",
  "workflowOperations.outcome.unknown": "확인되지 않음",
  "workflowOperations.delivery.sending": "전송 중",
  "workflowOperations.delivery.accepted": "수락됨",
  "workflowOperations.delivery.unknown": "확인되지 않음",
  "workflowOperations.delivery.failed": "실패",
  "workflowOperations.delivery.seen": "이벤트 확인됨",
  "workflowOperations.dismissDelete":
    "작성 중인 내용은 유지되며 편집 잠금이 해제됩니다. 이 알림을 닫아도 삭제가 확인되거나 취소되거나 다시 실행되지는 않습니다. 다시 삭제하기 전에 저장된 구성을 확인해 주세요.",
  "workflowOperations.dismissCommand":
    "이 알림을 닫으면 알림과 편집 잠금만 해제됩니다. 명령을 되돌리거나 취소하거나 다시 실행하지 않으며, 결과를 확인해 주지도 않습니다. 다시 저장하기 전에 저장된 구성을 검토해 주세요. 새로 실행을 요청하면 워크플로가 다시 실행될 수 있습니다. 저장하지 않은 작성 내용은 유지됩니다.",
};

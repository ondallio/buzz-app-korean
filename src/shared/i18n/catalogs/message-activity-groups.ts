export const en = {
  "activityGroup.showHistory": "Show activity history: {summary}",
  "activityGroup.collapseHistory": "Collapse activity history: {summary}",
  "activityGroup.namedFailed": "{name}: Couldn’t finish",
  "activityGroup.namedStopped": "{name}: Stopped",
  "activityGroup.namedOutcome": "{name}: {outcome}",
  "activityGroup.stillWorking": "{name}: still working — {preview}",
  "activityGroup.failureReason":
    "This request ended before it could finish. Try again in a new thread, or choose a different model.",
  "activityGroup.stoppedReason": "This request was stopped.",
  "activityGroup.namedReason": "{name}: {reason}",
  "activityGroup.namedTranscript": "{name} transcript",
  "activityGroup.retryName": "Retry {name}",
  "activityGroup.dismissName": "Dismiss error from {name}",
  "activityGroup.retryFailed": "Couldn’t retry {name}. {reason}",
  "activityGroup.remote": "Remote",
  "activityGroup.remoteBuilderlab": "Runs remotely on Builderlab",
  "activityGroup.remoteMachine": "Runs on a remote machine",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "activityGroup.showHistory": "활동 기록 보기: {summary}",
  "activityGroup.collapseHistory": "활동 기록 접기: {summary}",
  "activityGroup.namedFailed": "{name}: 완료하지 못함",
  "activityGroup.namedStopped": "{name}: 중지됨",
  "activityGroup.namedOutcome": "{name}: {outcome}",
  "activityGroup.stillWorking": "{name}: 아직 작업 중 — {preview}",
  "activityGroup.failureReason":
    "요청을 완료하기 전에 종료되었습니다. 새 스레드에서 다시 시도하거나 다른 모델을 선택하세요.",
  "activityGroup.stoppedReason": "요청이 중지되었습니다.",
  "activityGroup.namedReason": "{name}: {reason}",
  "activityGroup.namedTranscript": "{name} 대화 기록",
  "activityGroup.retryName": "{name} 다시 시도",
  "activityGroup.dismissName": "{name}의 오류 닫기",
  "activityGroup.retryFailed": "{name} 다시 시도에 실패했습니다. {reason}",
  "activityGroup.remote": "원격",
  "activityGroup.remoteBuilderlab": "Builderlab에서 원격으로 실행됩니다",
  "activityGroup.remoteMachine": "원격 컴퓨터에서 실행됩니다",
};

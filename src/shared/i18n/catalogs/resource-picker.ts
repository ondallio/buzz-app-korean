export const en = {
  "resourcePicker.issue": "Issue",
  "resourcePicker.pr": "Pull request",
  "resourcePicker.issueUnavailable": "This issue is no longer available.",
  "resourcePicker.prUnavailable": "This pull request is no longer available.",
  "resourcePicker.checkFailed":
    "Could not check this item. Choose it again to retry.",
  "resourcePicker.add": "Add issue or pull request",
  "resourcePicker.unavailableTitle": "Add issue or pull request (unavailable)",
  "resourcePicker.loadingRepositories": "Loading repositories…",
  "resourcePicker.controls": "Issue and pull request controls",
  "resourcePicker.repositoriesFailed":
    "Could not load this channel’s repositories.",
  "resourcePicker.retryRepositories": "Retry repositories",
  "resourcePicker.search": "Search issues and pull requests",
  "resourcePicker.searchPlaceholder": "Search",
  "resourcePicker.clearSearch": "Clear search issues and pull requests",
  "resourcePicker.loadingItems": "Loading issues and pull requests…",
  "resourcePicker.itemsFailed": "Could not load issues and pull requests.",
  "resourcePicker.retry": "Retry",
  "resourcePicker.truncated":
    "Showing the latest items only. Some issues or pull requests may be missing.",
  "resourcePicker.checkingItem": "Checking the chosen item…",
  "resourcePicker.checking": "Checking…",
  "resourcePicker.row": "{label}, {kind} in {repository}",
  "resourcePicker.caption": "{kind} · {repository}",
  "resourcePicker.noMatches": "No matching issues or pull requests.",
  "resourcePicker.empty":
    "These repositories have no issues or pull requests yet.",
  "resourcePicker.selectionHint": "{label}. Press Enter to add.",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "resourcePicker.issue": "이슈",
  "resourcePicker.pr": "PR",
  "resourcePicker.issueUnavailable": "이 이슈는 더 이상 사용할 수 없습니다.",
  "resourcePicker.prUnavailable": "이 PR은 더 이상 사용할 수 없습니다.",
  "resourcePicker.checkFailed":
    "이 항목을 확인하지 못했습니다. 다시 선택해 주세요.",
  "resourcePicker.add": "이슈 또는 PR 추가",
  "resourcePicker.unavailableTitle": "이슈 또는 PR 추가 (사용 불가)",
  "resourcePicker.loadingRepositories": "저장소 불러오는 중…",
  "resourcePicker.controls": "이슈 및 PR 도구",
  "resourcePicker.repositoriesFailed":
    "이 채널의 저장소를 불러오지 못했습니다.",
  "resourcePicker.retryRepositories": "저장소 다시 불러오기",
  "resourcePicker.search": "이슈 및 PR 검색",
  "resourcePicker.searchPlaceholder": "검색",
  "resourcePicker.clearSearch": "이슈 및 PR 검색 지우기",
  "resourcePicker.loadingItems": "이슈 및 PR 불러오는 중…",
  "resourcePicker.itemsFailed": "이슈 및 PR을 불러오지 못했습니다.",
  "resourcePicker.retry": "다시 시도",
  "resourcePicker.truncated":
    "최근 항목만 표시하고 있습니다. 일부 이슈나 PR이 누락되었을 수 있습니다.",
  "resourcePicker.checkingItem": "선택한 항목 확인 중…",
  "resourcePicker.checking": "확인 중…",
  "resourcePicker.row": "{repository}의 {kind}: {label}",
  "resourcePicker.caption": "{kind} · {repository}",
  "resourcePicker.noMatches": "일치하는 이슈나 PR이 없습니다.",
  "resourcePicker.empty": "이 저장소들에는 아직 이슈나 PR이 없습니다.",
  "resourcePicker.selectionHint":
    "{label} 항목을 추가하려면 Enter 키를 누르세요.",
};

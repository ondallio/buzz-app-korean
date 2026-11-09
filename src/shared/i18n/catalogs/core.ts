export const en = {
  "language.label": "Language",
  "language.description": "Choose the language used by Buzz on this device.",
  "language.unsaved":
    "This language is active, but could not be saved on this device.",
  "language.retry": "Retry saving language",
  "language.systemUnavailable":
    "Buzz could not read your system language. Choose a language here.",
  "language.nativeFailed":
    "Buzz could not apply your chosen language to the app menus.",
  "language.nativeRetry": "Retry app menu language",
  "language.nativeIncomplete": "Some app menus are still displayed in English.",
  "date.today": "Today",
  "date.yesterday": "Yesterday",
  "date.withTime": "{day} at {time}",
  "toast.dismiss": "Dismiss notification",
  "toast.region": "App notifications",
  "dialog.close": "Close",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "language.label": "언어",
  "language.description": "이 기기에서 Buzz에 사용할 언어를 선택하세요.",
  "language.unsaved": "선택한 언어를 적용했지만 이 기기에 저장하지 못했습니다.",
  "language.retry": "언어 저장 다시 시도",
  "language.systemUnavailable":
    "시스템 언어를 확인하지 못했습니다. 여기에서 언어를 선택해 주세요.",
  "language.nativeFailed": "앱 메뉴에 선택한 언어를 적용하지 못했습니다.",
  "language.nativeRetry": "앱 메뉴 언어 다시 적용",
  "language.nativeIncomplete": "일부 앱 메뉴는 아직 영어로 표시됩니다.",
  "date.today": "오늘",
  "date.yesterday": "어제",
  "date.withTime": "{day} {time}",
  "toast.dismiss": "알림 닫기",
  "toast.region": "앱 알림",
  "dialog.close": "닫기",
};

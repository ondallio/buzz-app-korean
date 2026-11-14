export const en = {
  "terminalSettings.title": "Terminal",
  "terminalSettings.subtitle": "Customize your terminal.",
  "terminalSettings.font": "Font",
  "terminalSettings.family": "Font family",
  "terminalSettings.familyHelp":
    "Type an installed font family name. For Nerd Fonts, use a Mono variant for cell alignment.",
  "terminalSettings.familyInvalid":
    "Enter one font family name, up to 64 characters, without quotes, commas, or CSS syntax. Use default to clear this choice.",
  "terminalSettings.unavailable":
    "Couldn’t load “{font}”. Check the font name or install it, then try again.",
  "terminalSettings.retryCheck": "Retry font check",
  "terminalSettings.savedUnavailable":
    "Couldn’t load your saved font “{font}”. The terminal is using JetBrains Mono.",
  "terminalSettings.size": "Font size (px)",
  "terminalSettings.sizeHelp":
    "Terminal text size, independent of interface text size. Default: {size} px.",
  "terminalSettings.sizeInvalid": "Enter a number from {min} to {max}.",
  "terminalSettings.preview": "Preview: {sample}",
  "terminalSettings.default": "Use default",
  "terminalSettings.apply": "Apply",
  "terminalSettings.attention": "Terminal font preference needs attention",
  "terminalSettings.retryPreference": "Retry terminal font preference",
  "terminalSettings.keyboard": "Keyboard",
  "terminalSettings.optionMeta": "Use Option as Meta key",
  "terminalSettings.optionMetaHelp":
    "Treat the Option key as the Meta key in the terminal.",
  "terminalSettings.retrySave": "Retry saving",
  "terminalSettings.restoreFailed":
    "Your terminal font could not be restored. The default is active.",
  "terminalSettings.resetFailed":
    "The default terminal font is active, but this reset could not be saved on this device. Your previous font may return after restarting. Try again.",
  "terminalSettings.saveFailed":
    "Your terminal font is active, but could not be saved on this device. Try again.",
  "terminalSettings.optionSaveFailed":
    "This choice is active, but could not be saved on this device. Try again.",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "terminalSettings.title": "터미널",
  "terminalSettings.subtitle": "터미널을 원하는 대로 설정하세요.",
  "terminalSettings.font": "글꼴",
  "terminalSettings.family": "글꼴 이름",
  "terminalSettings.familyHelp":
    "설치된 글꼴 이름을 입력하세요. Nerd Fonts는 글자 간격을 맞추기 위해 Mono 버전을 사용하세요.",
  "terminalSettings.familyInvalid":
    "따옴표, 쉼표, CSS 문법 없이 글꼴 이름 하나를 64자 이내로 입력하세요. 선택을 지우려면 기본값 사용을 누르세요.",
  "terminalSettings.unavailable":
    "“{font}” 글꼴을 불러올 수 없습니다. 이름을 확인하거나 글꼴을 설치한 뒤 다시 시도하세요.",
  "terminalSettings.retryCheck": "글꼴 다시 확인",
  "terminalSettings.savedUnavailable":
    "저장된 “{font}” 글꼴을 불러올 수 없어 터미널에 JetBrains Mono를 사용하고 있습니다.",
  "terminalSettings.size": "글꼴 크기 (px)",
  "terminalSettings.sizeHelp":
    "앱 화면의 글자 크기와 별도로 적용되는 터미널 글자 크기입니다. 기본값은 {size}px입니다.",
  "terminalSettings.sizeInvalid": "{min}~{max} 사이의 숫자를 입력하세요.",
  "terminalSettings.preview": "미리 보기: {sample}",
  "terminalSettings.default": "기본값 사용",
  "terminalSettings.apply": "적용",
  "terminalSettings.attention": "터미널 글꼴 설정을 확인해 주세요",
  "terminalSettings.retryPreference": "터미널 글꼴 설정 재시도",
  "terminalSettings.keyboard": "키보드",
  "terminalSettings.optionMeta": "Option 키를 Meta 키로 사용",
  "terminalSettings.optionMetaHelp":
    "터미널에서 Option 키를 Meta 키로 처리합니다.",
  "terminalSettings.retrySave": "다시 저장",
  "terminalSettings.restoreFailed":
    "터미널 글꼴 설정을 복원할 수 없어 기본 글꼴을 사용하고 있습니다.",
  "terminalSettings.resetFailed":
    "기본 터미널 글꼴을 사용 중이지만 이 기기에 초기화 결과를 저장하지 못했습니다. 앱을 다시 시작하면 이전 글꼴이 적용될 수 있습니다. 다시 시도해 주세요.",
  "terminalSettings.saveFailed":
    "터미널 글꼴을 적용했지만 이 기기에 저장하지 못했습니다. 다시 시도해 주세요.",
  "terminalSettings.optionSaveFailed":
    "선택한 설정을 적용했지만 이 기기에 저장하지 못했습니다. 다시 시도해 주세요.",
};

export const en = {
  "claudeAuthUi.keyOnce":
    "Claude requires an API key to connect to your account. Create one at console.anthropic.com and paste it below. You only have to set this up once, and Buzz keeps it securely on this computer.",
  "claudeAuthUi.signedIn": "Claude runs with your Anthropic API key.",
  "claudeAuthUi.missingSettings":
    "Claude is missing an API key. Head to {settings} to add one.",
  "claudeAuthUi.missing":
    "Claude is missing an API key. Add one in Settings → Agent setup.",
  "claudeAuthUi.replaceKey": "Replace API key",
  "claudeAuthUi.apiKey": "Anthropic API key",
  "claudeAuthUi.replaceDescription":
    "Create a key at console.anthropic.com. Buzz keeps it securely on this computer and gives it only to Claude, so commands your Claude agents run can read it.",
  "claudeAuthUi.saveKey": "Save key",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "claudeAuthUi.keyOnce":
    "Claude를 계정에 연결하려면 API 키가 필요합니다. console.anthropic.com에서 키를 만들어 아래에 붙여 넣어 주세요. 한 번만 설정하면 Buzz가 이 컴퓨터에 안전하게 보관합니다.",
  "claudeAuthUi.signedIn": "Claude는 사용자의 Anthropic API 키로 실행됩니다.",
  "claudeAuthUi.missingSettings":
    "Claude API 키가 없습니다. {settings}에서 키를 추가해 주세요.",
  "claudeAuthUi.missing":
    "Claude API 키가 없습니다. 설정 → 에이전트 설정에서 키를 추가해 주세요.",
  "claudeAuthUi.replaceKey": "API 키 교체",
  "claudeAuthUi.apiKey": "Anthropic API 키",
  "claudeAuthUi.replaceDescription":
    "console.anthropic.com에서 키를 만들어 주세요. Buzz는 이 컴퓨터에 키를 안전하게 보관하고 Claude에만 전달합니다. 따라서 Claude 에이전트가 실행하는 명령도 키를 읽을 수 있습니다.",
  "claudeAuthUi.saveKey": "키 저장",
};

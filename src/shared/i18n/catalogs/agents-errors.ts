export const en = {
  "agentsErrors.noAgent": "No such agent on this device",
  "agentsErrors.missingType": "That agent type is not available",
  "agentsErrors.hostedKey":
    "A hosted provider cannot take over a local agent key",
  "agentsErrors.nameRequired": "Name the agent",
  "agentsErrors.waitForChange": "Wait for the agent's last change to finish",
  "agentsErrors.setupRequired": "Finish the agent's setup first",
  "agentsErrors.providerChanging": "{name}'s provider is already changing",
  "agentsErrors.configMoving":
    "This agent's config is moving to the community; try again shortly",
  "agentsErrors.protectedTypeChange":
    "The protected runtime cannot safely change its type",
  "agentsErrors.runtimeBindingUnsupported":
    "This runtime does not support the saved execution binding",
  "agentsErrors.connectForType": "Connect to the community to change its type",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "agentsErrors.noAgent": "이 기기에 이 에이전트가 없습니다.",
  "agentsErrors.missingType": "이 에이전트 유형을 사용할 수 없습니다.",
  "agentsErrors.hostedKey":
    "호스팅 제공자는 로컬 에이전트 키를 가져갈 수 없습니다.",
  "agentsErrors.nameRequired": "에이전트 이름을 입력해 주세요.",
  "agentsErrors.waitForChange":
    "에이전트의 이전 변경이 끝날 때까지 기다려 주세요.",
  "agentsErrors.setupRequired": "먼저 에이전트 설정을 완료해 주세요.",
  "agentsErrors.providerChanging": "{name}의 제공자를 변경하는 중입니다.",
  "agentsErrors.configMoving":
    "이 에이전트의 구성을 커뮤니티로 이동하는 중입니다. 잠시 후 다시 시도해 주세요.",
  "agentsErrors.protectedTypeChange":
    "보호된 런타임의 유형을 안전하게 변경할 수 없습니다.",
  "agentsErrors.runtimeBindingUnsupported":
    "이 런타임은 저장된 실행 연결을 지원하지 않습니다.",
  "agentsErrors.connectForType": "유형을 변경하려면 커뮤니티에 연결해 주세요.",
};

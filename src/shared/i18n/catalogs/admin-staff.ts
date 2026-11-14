export const en = {
  "adminStaff.addStaff": "Add staff",
  "adminStaff.publicKey": "Public key",
  "adminStaff.publicKeyPlaceholder": "npub or 64-hex public key",
  "adminStaff.role": "Role",
  "adminStaff.add": "Add",
  "adminStaff.empty": "No staff configured.",
  "adminStaff.you": "you",
  "adminStaff.roleFor": "Role for {name}",
  "adminStaff.remove": "Remove",
  "adminStaff.fixedSource":
    "Set in relay configuration; cannot be removed here",
  "adminStaff.removeTitle": "Remove staff?",
  "adminStaff.removeSelf":
    "You are removing your own staff access. You may not be able to undo this.",
  "adminStaff.cancel": "Cancel",
  "adminStaff.removeModerator": "{name} (moderator) loses relay staff access.",
  "adminStaff.removeOperator": "{name} (operator) loses relay staff access.",
  "adminStaff.source.config": "config",
  "adminStaff.source.ownerFallback": "owner (fallback)",
  "adminStaff.source.db": "db",
  "adminStaff.role.moderator": "moderator",
  "adminStaff.role.operator": "operator",
  "adminStaff.duplicateModerator":
    "Already staff as moderator. Change their role on their row.",
  "adminStaff.duplicateOperator":
    "Already staff as operator. Change their role on their row.",
  "adminStaff.namesSource": "Names come from profiles in {host}.",
  "adminStaff.loading": "Loading…",
  "adminStaff.retry": "Retry",
  "adminStaff.signatureRejected": "The relay did not accept your signature.",
  "adminStaff.permissionDenied": "You do not have permission to do that.",
  "adminStaff.intercepted":
    "A network gateway (such as VPN or SSO) intercepted the request.",
  "adminStaff.unconfirmed": "The relay did not confirm the result.",
  "adminStaff.unconfirmedDetail":
    "The relay did not confirm the result. {message}",
  "adminStaff.privateKey":
    "That looks like a private key. Never paste it here.",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "adminStaff.addStaff": "운영진 추가",
  "adminStaff.publicKey": "공개 키",
  "adminStaff.publicKeyPlaceholder": "npub 또는 64자리 16진수 공개 키",
  "adminStaff.role": "역할",
  "adminStaff.add": "추가",
  "adminStaff.empty": "등록된 운영진이 없습니다.",
  "adminStaff.you": "나",
  "adminStaff.roleFor": "{name}의 역할",
  "adminStaff.remove": "제거",
  "adminStaff.fixedSource":
    "릴레이 설정에 지정되어 있어 여기서 제거할 수 없습니다",
  "adminStaff.removeTitle": "운영진을 제거할까요?",
  "adminStaff.removeSelf":
    "내 운영진 권한을 제거합니다. 이 작업을 되돌리지 못할 수 있습니다.",
  "adminStaff.cancel": "취소",
  "adminStaff.removeModerator": "{name}님의 릴레이 중재자 권한이 제거됩니다.",
  "adminStaff.removeOperator": "{name}님의 릴레이 운영자 권한이 제거됩니다.",
  "adminStaff.source.config": "설정",
  "adminStaff.source.ownerFallback": "소유자(대체 지정)",
  "adminStaff.source.db": "데이터베이스",
  "adminStaff.role.moderator": "중재자",
  "adminStaff.role.operator": "릴레이 운영자",
  "adminStaff.duplicateModerator":
    "이미 중재자로 등록되어 있습니다. 해당 행에서 역할을 변경하세요.",
  "adminStaff.duplicateOperator":
    "이미 릴레이 운영자로 등록되어 있습니다. 해당 행에서 역할을 변경하세요.",
  "adminStaff.namesSource": "이름은 {host}의 프로필에서 가져옵니다.",
  "adminStaff.loading": "불러오는 중…",
  "adminStaff.retry": "다시 시도",
  "adminStaff.signatureRejected": "릴레이가 서명을 수락하지 않았습니다.",
  "adminStaff.permissionDenied": "이 작업을 수행할 권한이 없습니다.",
  "adminStaff.intercepted":
    "VPN 또는 SSO 같은 네트워크 게이트웨이가 요청을 가로챘습니다.",
  "adminStaff.unconfirmed": "릴레이에서 결과가 확인되지 않았습니다.",
  "adminStaff.unconfirmedDetail":
    "릴레이에서 결과가 확인되지 않았습니다. {message}",
  "adminStaff.privateKey":
    "비밀 키로 보입니다. 여기에 비밀 키를 붙여넣지 마세요.",
};

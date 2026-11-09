export const en = {
  "profileEditing.displayName": "Display name",
  "profileEditing.profileDescription": "Profile description (optional)",
  "profileEditing.characters": "{count} of {max} characters",
  "profileEditing.shortenDescription":
    "Shorten the description to {max} characters before saving.",
  "profileEditing.verified": "Name verified by {issuer}",
  "profileEditing.verifiedUsername": "Name verified by {issuer} · @{username}",
  "profileEditing.cachedVerification": "Cached verification from {issuer}",
  "profileEditing.cachedUsername":
    "Cached verification from {issuer} · @{username}",
  "profileEditing.pictureError":
    "Use an HTTPS image URL without credentials (up to 2,048 characters), or remove the avatar.",
  "profileEditing.unsupportedFormat":
    "Choose a PNG, JPEG, GIF, WebP or HEIC image.",
  "profileEditing.imageSize": "Choose an image smaller than 50 MiB.",
  "profileEditing.uploadUnavailable":
    "Image uploads are unavailable on this connection.",
  "profileEditing.invalidImageResponse":
    "The server did not return an avatar image.",
  "profileEditing.emojiUnavailable":
    "Emoji images are unavailable in this browser.",
  "profileEditing.chooseEmojiColor": "Choose an emoji and a background color.",
  "profileEditing.emojiPrepareFailed": "Could not prepare the emoji image.",
  "profileEditing.addAvatar": "Add avatar",
  "profileEditing.editAvatar": "Edit avatar",
  "profileEditing.avatarPreview": "Avatar preview",
  "profileEditing.avatar": "Avatar",
  "profileEditing.emojiPosition": "Emoji position",
  "profileEditing.positionDown": "{count}% down",
  "profileEditing.positionUp": "{count}% up",
  "profileEditing.centered": "Centered",
  "profileEditing.uploadFailed": "Image upload failed. Try again.",
  "profileEditing.done": "Done",
  "profileEditing.emojiSize": "Emoji size",
  "profileEditing.uploading": "Uploading…",
  "profileEditing.dropHere": "Drop image here",
  "profileEditing.dropBrowse": "Drop or browse",
  "profileEditing.uploadImage": "Upload an image",
  "profileEditing.pictureUrl": "Picture URL (optional)",
  "profileEditing.pasteImageUrl": "Paste an image URL",
  "profileEditing.avatarBackground": "Avatar background",
  "profileEditing.useBackground": "Use {color} background",
  "profileEditing.customColor": "Custom background color",
  "profileEditing.avatarPicker": "Avatar picker",
  "profileEditing.avatarSource": "Avatar source",
  "profileEditing.image": "Image",
  "profileEditing.emoji": "Emoji",
  "profileEditing.background": "Background",
  "profileEditing.uploadingAvatar": "Uploading avatar…",
  "profileEditing.selectCommunity":
    "Select a community in the sidebar to upload an image or emoji. Your local default can use a public HTTPS image URL.",
  "profileEditing.removeAvatar": "Remove avatar",
  "profileEditing.emojiLoadFailed":
    "Could not load the emoji picker. Reopen it to retry.",
  "profileEditing.colorSpectrum": "Color spectrum",
  "profileEditing.spectrumInstructions":
    "{saturation}% saturation, {brightness}% brightness. Use left and right for saturation, up and down for brightness.",
  "profileEditing.colorHue": "Color hue",
  "profileEditing.useColor": "Use color",
  "profileEditing.unreachable":
    "Couldn’t reach {host}. Check the address, or try again.",
  "profileEditing.chooseCommunity": "Choose a community first",
  "profileEditing.continue": "Continue",
  "profileEditing.connecting": "Connecting…",
  "profileEditing.joining": "Joining…",
  "profileEditing.saveProfile": "Save profile",
  "profileEditing.saving": "Saving…",
  "profileEditing.publishOpen": "Publish profile & open",
  "profileEditing.publishing": "Publishing…",
  "profileEditing.connectionDescription":
    "Enter a wss:// or https:// relay address without a path. Changing the connection URL does not rename or move this community.",
  "profileEditing.joinDescription":
    "Use your identity across communities. Your profile and conversations stay separate in each one.",
  "profileEditing.localProfileDescription":
    "Your local default. Use it when joining communities; saving here does not publish changes to them.",
  "profileEditing.newProfileDescription":
    "Start with your local profile, or choose how you appear in this community.",
  "profileEditing.cancel": "Cancel",
  "profileEditing.back": "Back",
  "profileEditing.yourProfile": "Your profile",
  "profileEditing.editConnection": "Edit connection",
  "profileEditing.joinCommunity": "Join a community",
  "profileEditing.openingIdentity": "Opening your local identity…",
  "profileEditing.connectionBuildUnavailable":
    "Your identity is ready, but connecting to communities is not available in this build yet. You can manage your local profile and identity in Settings.",
  "profileEditing.developmentIdentityUnavailable":
    "Live identity access is unavailable. For development, set BUZZ_DEV_VIEWER to your Buzz public key in .env.local, then restart just web or just desktop. See docs/contributing.md for requirements.",
  "profileEditing.findingCommunity": "Finding your community…",
  "profileEditing.communityUrl": "Community URL",
  "profileEditing.communityUrlDescription":
    "Paste your community link. Continue shares your Buzz identity with the community so you can preview it before joining.",
  "profileEditing.inviteCode": "Invite code",
  "profileEditing.terms": "Terms of Service",
  "profileEditing.privacy": "Privacy Notice",
  "profileEditing.consentBoth":
    "I agree to this community’s {terms} and {privacy}.",
  "profileEditing.consentTerms": "I agree to this community’s {terms}.",
  "profileEditing.consentPrivacy": "I agree to this community’s {privacy}.",
  "profileEditing.adult": "I confirm that I am at least 18 years old.",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "profileEditing.displayName": "표시 이름",
  "profileEditing.profileDescription": "프로필 설명 (선택 사항)",
  "profileEditing.characters": "{max}자 중 {count}자",
  "profileEditing.shortenDescription":
    "저장하기 전에 설명을 {max}자 이하로 줄여 주세요.",
  "profileEditing.verified": "{issuer}에서 확인한 이름",
  "profileEditing.verifiedUsername": "{issuer}에서 확인한 이름 · @{username}",
  "profileEditing.cachedVerification": "{issuer}의 저장된 확인 정보",
  "profileEditing.cachedUsername": "{issuer}의 저장된 확인 정보 · @{username}",
  "profileEditing.pictureError":
    "인증 정보가 없는 HTTPS 이미지 URL을 사용하거나 아바타를 제거해 주세요. URL은 2,048자 이하여야 합니다.",
  "profileEditing.unsupportedFormat":
    "PNG, JPEG, GIF, WebP 또는 HEIC 이미지를 선택해 주세요.",
  "profileEditing.imageSize": "50 MiB보다 작은 이미지를 선택해 주세요.",
  "profileEditing.uploadUnavailable":
    "이 연결에서는 이미지를 업로드할 수 없습니다.",
  "profileEditing.invalidImageResponse":
    "서버가 아바타 이미지를 반환하지 않았습니다.",
  "profileEditing.emojiUnavailable":
    "이 브라우저에서는 이모지 이미지를 사용할 수 없습니다.",
  "profileEditing.chooseEmojiColor": "이모지와 배경색을 선택해 주세요.",
  "profileEditing.emojiPrepareFailed": "이모지 이미지를 준비하지 못했습니다.",
  "profileEditing.addAvatar": "아바타 추가",
  "profileEditing.editAvatar": "아바타 편집",
  "profileEditing.avatarPreview": "아바타 미리보기",
  "profileEditing.avatar": "아바타",
  "profileEditing.emojiPosition": "이모지 위치",
  "profileEditing.positionDown": "아래로 {count}%",
  "profileEditing.positionUp": "위로 {count}%",
  "profileEditing.centered": "가운데",
  "profileEditing.uploadFailed":
    "이미지 업로드에 실패했습니다. 다시 시도해 주세요.",
  "profileEditing.done": "완료",
  "profileEditing.emojiSize": "이모지 크기",
  "profileEditing.uploading": "업로드 중…",
  "profileEditing.dropHere": "여기에 이미지 놓기",
  "profileEditing.dropBrowse": "이미지 놓기 또는 찾아보기",
  "profileEditing.uploadImage": "이미지 업로드",
  "profileEditing.pictureUrl": "이미지 URL (선택 사항)",
  "profileEditing.pasteImageUrl": "이미지 URL 붙여넣기",
  "profileEditing.avatarBackground": "아바타 배경",
  "profileEditing.useBackground": "{color} 배경 사용",
  "profileEditing.customColor": "사용자 지정 배경색",
  "profileEditing.avatarPicker": "아바타 선택",
  "profileEditing.avatarSource": "아바타 소스",
  "profileEditing.image": "이미지",
  "profileEditing.emoji": "이모지",
  "profileEditing.background": "배경",
  "profileEditing.uploadingAvatar": "아바타 업로드 중…",
  "profileEditing.selectCommunity":
    "이미지나 이모지를 업로드하려면 사이드바에서 커뮤니티를 선택해 주세요. 로컬 기본값에는 공개 HTTPS 이미지 URL을 사용할 수 있습니다.",
  "profileEditing.removeAvatar": "아바타 제거",
  "profileEditing.emojiLoadFailed":
    "이모지 선택기를 불러오지 못했습니다. 다시 열어 시도해 주세요.",
  "profileEditing.colorSpectrum": "색상 스펙트럼",
  "profileEditing.spectrumInstructions":
    "채도 {saturation}%, 밝기 {brightness}%. 좌우 화살표로 채도를, 위아래 화살표로 밝기를 조절하세요.",
  "profileEditing.colorHue": "색조",
  "profileEditing.useColor": "이 색상 사용",
  "profileEditing.unreachable":
    "{host}에 연결하지 못했습니다. 주소를 확인하거나 다시 시도해 주세요.",
  "profileEditing.chooseCommunity": "먼저 커뮤니티를 선택해 주세요",
  "profileEditing.continue": "계속",
  "profileEditing.connecting": "연결 중…",
  "profileEditing.joining": "참여 중…",
  "profileEditing.saveProfile": "프로필 저장",
  "profileEditing.saving": "저장 중…",
  "profileEditing.publishOpen": "프로필 공개 및 열기",
  "profileEditing.publishing": "공개 중…",
  "profileEditing.connectionDescription":
    "경로가 없는 wss:// 또는 https:// 릴레이 주소를 입력해 주세요. 연결 URL을 바꿔도 커뮤니티의 이름이나 위치는 바뀌지 않습니다.",
  "profileEditing.joinDescription":
    "여러 커뮤니티에서 같은 신원을 사용하세요. 프로필과 대화는 커뮤니티마다 분리됩니다.",
  "profileEditing.localProfileDescription":
    "로컬 기본 프로필입니다. 커뮤니티에 참여할 때 사용하며 여기서 저장해도 기존 커뮤니티에 변경 내용이 공개되지 않습니다.",
  "profileEditing.newProfileDescription":
    "로컬 프로필로 시작하거나 이 커뮤니티에서 사용할 프로필을 정해 주세요.",
  "profileEditing.cancel": "취소",
  "profileEditing.back": "뒤로",
  "profileEditing.yourProfile": "내 프로필",
  "profileEditing.editConnection": "연결 수정",
  "profileEditing.joinCommunity": "커뮤니티 참여",
  "profileEditing.openingIdentity": "로컬 신원을 여는 중…",
  "profileEditing.connectionBuildUnavailable":
    "신원은 준비되었지만 이 빌드에서는 아직 커뮤니티에 연결할 수 없습니다. 설정에서 로컬 프로필과 신원을 관리할 수 있습니다.",
  "profileEditing.developmentIdentityUnavailable":
    "신원에 실시간으로 접근할 수 없습니다. 개발 환경에서는 .env.local의 BUZZ_DEV_VIEWER를 Buzz 공개 키로 설정한 뒤 just web 또는 just desktop을 다시 실행하세요. 필요한 조건은 docs/contributing.md를 확인해 주세요.",
  "profileEditing.findingCommunity": "커뮤니티를 찾는 중…",
  "profileEditing.communityUrl": "커뮤니티 URL",
  "profileEditing.communityUrlDescription":
    "커뮤니티 링크를 붙여넣어 주세요. 계속을 누르면 참여 전에 미리 볼 수 있도록 커뮤니티에 Buzz 신원을 공유합니다.",
  "profileEditing.inviteCode": "초대 코드",
  "profileEditing.terms": "서비스 이용약관",
  "profileEditing.privacy": "개인정보 처리방침",
  "profileEditing.consentBoth":
    "이 커뮤니티의 {terms} 및 {privacy}에 동의합니다.",
  "profileEditing.consentTerms": "이 커뮤니티의 {terms}에 동의합니다.",
  "profileEditing.consentPrivacy": "이 커뮤니티의 {privacy}에 동의합니다.",
  "profileEditing.adult": "만 18세 이상임을 확인합니다.",
};

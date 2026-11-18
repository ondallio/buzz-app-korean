export const en = {
  "v105msg.composer.agentsLoadFailed": "Could not load your agents. Retry.",
  "v105msg.composer.finishEditBeforeForward":
    "Finish this edit before pasting a forwarded message.",
  "v105msg.composer.forwardLoadFailed":
    "Couldn't load this message. Remove it or try pasting again.",
  "v105msg.composer.oneForward":
    "Only one forwarded message can be attached. Remove it before pasting another.",
  "v105msg.decline.notDirected":
    "{name} didn't respond because this workflow message wasn't set up to direct agents.",
  "v105msg.decline.ownerOnly":
    "{name} didn't respond to this workflow message. This community limits which workflows can use agents, so other people can't use yours. If the workflow's Runs tab gives a reason, it's there.",
  "v105msg.decline.yourAgent": "Your agent",
  "v105msg.dm.joiningOne":
    "Sending adds {names} to this DM. It can read its earlier messages.",
  "v105msg.dm.joiningMany":
    "Sending adds {names} to this DM. They can read its earlier messages.",
  "v105msg.emoji.remove": "Remove emoji",
  "v105msg.forward.attachmentIncluded": "{count} attachment included",
  "v105msg.forward.attachmentsIncluded": "{count} attachments included",
  "v105msg.forward.audienceChannel": "Everyone in #{channel}",
  "v105msg.forward.audienceHuddle": "Everyone in this Huddle",
  "v105msg.forward.audienceRecipients": "The recipients",
  "v105msg.forward.channelUnavailable":
    "You can no longer post in this channel. Choose another destination.",
  "v105msg.forward.copied":
    "Copied. Paste it in any message box to forward it.",
  "v105msg.forward.copyAsForward": "Copy as forward",
  "v105msg.forward.copyFailed": "Couldn't copy. Try again, or use Forward.",
  "v105msg.forward.copyLink": "Copy link",
  "v105msg.forward.disclosure":
    "{audience} will be able to read this message, even if they can’t see where it came from.",
  "v105msg.forward.forwardTo": "Forward to {name}",
  "v105msg.forward.linkCopied": "Message link copied",
  "v105msg.forward.linkCopyFailed": "Couldn’t copy the link. Try again.",
  "v105msg.forward.loadFailed": "Couldn’t load this message. Try again.",
  "v105msg.forward.loadingForwarded": "Loading forwarded message…",
  "v105msg.forward.loadingSource": "Loading message…",
  "v105msg.forward.openDestination": "Open {name}",
  "v105msg.forward.openMainWindow":
    "Open this conversation in the main window to paste a forwarded message.",
  "v105msg.forward.otherCommunity":
    "This message belongs to another community. Switch communities to forward it.",
  "v105msg.forward.otherCommunityShort":
    "This message belongs to another community.",
  "v105msg.forward.peopleCount": "{count} people",
  "v105msg.forward.remove": "Remove forwarded message",
  "v105msg.forward.sourceUnavailable":
    "Couldn’t load this message. It may have been deleted, or you no longer have access.",
  "v105msg.forward.twoPeople": "{first} and {second}",
  "v105msg.forwarded.badge": "Forwarded",
  "v105msg.forwarded.directMessage": "Direct message",
  "v105msg.forwarded.label": "Forwarded message from {name}, {time}",
  "v105msg.forwarded.originalUnavailable": "Original unavailable",
  "v105msg.forwarded.privateConversation": "Private conversation",
  "v105msg.forwarded.showFull": "Show full message",
  "v105msg.forwarded.showLess": "Show less",
  "v105msg.forwarded.soloChat": "Solo chat",
  "v105msg.forwarded.viewOriginal": "View original",
  "v105msg.media.actions": "Media actions",
  "v105msg.media.copyImageFailed": "Couldn’t copy image. Try again.",
  "v105msg.media.copyImageUrl": "Copy image URL",
  "v105msg.media.copyUrlFailed": "Couldn’t copy URL. Try again.",
  "v105msg.media.copyVideoUrl": "Copy video URL",
  "v105msg.media.imageUrlCopied": "Image URL copied",
  "v105msg.media.openImage": "Open image",
  "v105msg.media.openVideo": "Open video",
  "v105msg.media.startingDownload": "Starting download…",
  "v105msg.media.videoUrlCopied": "Video URL copied",
  "v105msg.mention.outsideChat": "Not in chat · Will not be notified",
  "v105msg.queue.forwardedMessage": "Forwarded message",
  "v105msg.queue.reloadForward":
    "Reload this forwarded message before sending it.",
  "v105msg.recipient.channel": "Channel",
  "v105msg.recipient.channelOption": "{name}, channel",
  "v105msg.recipient.findPersonOrChannel": "Find a person or channel…",
  "v105msg.recipient.noPeopleOrChannels":
    'No people or channels match "{query}".',
  "v105msg.recipient.peopleAndChannels": "People and channels",
  "v105msg.recipient.privateChannel": "Private channel",
  "v105msg.recipient.privateChannelOption": "{name}, private channel",
  "v105msg.recipient.removeChannel":
    "Remove this channel to choose another destination.",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "v105msg.composer.agentsLoadFailed":
    "내 에이전트를 불러오지 못했습니다. 다시 시도하세요.",
  "v105msg.composer.finishEditBeforeForward":
    "전달된 메시지를 붙여 넣기 전에 이 편집을 마치세요.",
  "v105msg.composer.forwardLoadFailed":
    "이 메시지를 불러오지 못했습니다. 제거하거나 다시 붙여 넣어 보세요.",
  "v105msg.composer.oneForward":
    "전달된 메시지는 하나만 첨부할 수 있습니다. 다른 메시지를 붙여 넣으려면 먼저 제거하세요.",
  "v105msg.decline.notDirected":
    "이 워크플로 메시지가 에이전트에게 지시하도록 설정되지 않아 {name} 님이 응답하지 않았습니다.",
  "v105msg.decline.ownerOnly":
    "{name} 님이 이 워크플로 메시지에 응답하지 않았습니다. 이 커뮤니티는 에이전트를 사용할 수 있는 워크플로를 제한하므로 다른 사람은 내 에이전트를 사용할 수 없습니다. 워크플로의 실행 탭에 이유가 있다면 거기에서 확인할 수 있습니다.",
  "v105msg.decline.yourAgent": "내 에이전트",
  "v105msg.dm.joiningOne":
    "보내면 {names} 님이 이 DM에 추가됩니다. 이전 메시지를 읽을 수 있습니다.",
  "v105msg.dm.joiningMany":
    "보내면 {names} 님이 이 DM에 추가됩니다. 모두 이전 메시지를 읽을 수 있습니다.",
  "v105msg.emoji.remove": "이모지 제거",
  "v105msg.forward.attachmentIncluded": "첨부 파일 {count}개 포함",
  "v105msg.forward.attachmentsIncluded": "첨부 파일 {count}개 포함",
  "v105msg.forward.audienceChannel": "#{channel}의 모든 사람",
  "v105msg.forward.audienceHuddle": "이 허들의 모든 사람",
  "v105msg.forward.audienceRecipients": "받는 사람",
  "v105msg.forward.channelUnavailable":
    "더 이상 이 채널에 게시할 수 없습니다. 다른 대상을 선택하세요.",
  "v105msg.forward.copied":
    "복사했습니다. 아무 메시지 입력란에나 붙여 넣으면 전달됩니다.",
  "v105msg.forward.copyAsForward": "전달용으로 복사",
  "v105msg.forward.copyFailed":
    "복사하지 못했습니다. 다시 시도하거나 전달을 사용하세요.",
  "v105msg.forward.copyLink": "링크 복사",
  "v105msg.forward.disclosure":
    "출처를 볼 수 없더라도 {audience}에게 이 메시지가 공개됩니다.",
  "v105msg.forward.forwardTo": "{name}에 전달",
  "v105msg.forward.linkCopied": "메시지 링크를 복사했습니다",
  "v105msg.forward.linkCopyFailed":
    "링크를 복사하지 못했습니다. 다시 시도하세요.",
  "v105msg.forward.loadFailed":
    "이 메시지를 불러오지 못했습니다. 다시 시도하세요.",
  "v105msg.forward.loadingForwarded": "전달된 메시지 불러오는 중…",
  "v105msg.forward.loadingSource": "메시지 불러오는 중…",
  "v105msg.forward.openDestination": "{name} 열기",
  "v105msg.forward.openMainWindow":
    "전달된 메시지를 붙여 넣으려면 메인 창에서 이 대화를 여세요.",
  "v105msg.forward.otherCommunity":
    "이 메시지는 다른 커뮤니티에 속해 있습니다. 전달하려면 커뮤니티를 전환하세요.",
  "v105msg.forward.otherCommunityShort":
    "이 메시지는 다른 커뮤니티에 속해 있습니다.",
  "v105msg.forward.peopleCount": "{count}명",
  "v105msg.forward.remove": "전달된 메시지 제거",
  "v105msg.forward.sourceUnavailable":
    "이 메시지를 불러오지 못했습니다. 삭제되었거나 더 이상 접근 권한이 없을 수 있습니다.",
  "v105msg.forward.twoPeople": "{first}, {second}",
  "v105msg.forwarded.badge": "전달됨",
  "v105msg.forwarded.directMessage": "다이렉트 메시지",
  "v105msg.forwarded.label": "{name}님이 보낸 전달된 메시지, {time}",
  "v105msg.forwarded.originalUnavailable": "원본을 사용할 수 없음",
  "v105msg.forwarded.privateConversation": "비공개 대화",
  "v105msg.forwarded.showFull": "전체 메시지 보기",
  "v105msg.forwarded.showLess": "간략히 보기",
  "v105msg.forwarded.soloChat": "1:1 채팅",
  "v105msg.forwarded.viewOriginal": "원본 보기",
  "v105msg.media.actions": "미디어 작업",
  "v105msg.media.copyImageFailed":
    "이미지를 복사하지 못했습니다. 다시 시도하세요.",
  "v105msg.media.copyImageUrl": "이미지 URL 복사",
  "v105msg.media.copyUrlFailed": "URL을 복사하지 못했습니다. 다시 시도하세요.",
  "v105msg.media.copyVideoUrl": "동영상 URL 복사",
  "v105msg.media.imageUrlCopied": "이미지 URL을 복사했습니다",
  "v105msg.media.openImage": "이미지 열기",
  "v105msg.media.openVideo": "동영상 열기",
  "v105msg.media.startingDownload": "다운로드 시작 중…",
  "v105msg.media.videoUrlCopied": "동영상 URL을 복사했습니다",
  "v105msg.mention.outsideChat": "채팅에 없음 · 알림을 받지 않음",
  "v105msg.queue.forwardedMessage": "전달된 메시지",
  "v105msg.queue.reloadForward":
    "보내기 전에 이 전달된 메시지를 다시 불러오세요.",
  "v105msg.recipient.channel": "채널",
  "v105msg.recipient.channelOption": "{name}, 채널",
  "v105msg.recipient.findPersonOrChannel": "사람 또는 채널 찾기…",
  "v105msg.recipient.noPeopleOrChannels":
    '"{query}"에 해당하는 사람이나 채널이 없습니다.',
  "v105msg.recipient.peopleAndChannels": "사람 및 채널",
  "v105msg.recipient.privateChannel": "비공개 채널",
  "v105msg.recipient.privateChannelOption": "{name}, 비공개 채널",
  "v105msg.recipient.removeChannel":
    "다른 대상을 선택하려면 이 채널을 제거하세요.",
};

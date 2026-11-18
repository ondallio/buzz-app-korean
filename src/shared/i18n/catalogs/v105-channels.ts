export const en = {
  "v105ch.archiveInactive.archiveChats": "Archive chats",
  "v105ch.archiveInactive.archiveCount": "Archive {chats}",
  "v105ch.archiveInactive.archiveFailed": "Couldn’t archive {chats}. {error}",
  "v105ch.archiveInactive.archived": "Archived {chats}",
  "v105ch.archiveInactive.archivedPartial":
    "Archived {chats}. Couldn’t archive {failed}. {error}",
  "v105ch.archiveInactive.archiving": "Archiving inactive chats…",
  "v105ch.archiveInactive.chatCount": "{count} chats",
  "v105ch.archiveInactive.checkFailed":
    "Couldn’t check which chats are inactive.",
  "v105ch.archiveInactive.checking": "Checking which chats are inactive…",
  "v105ch.archiveInactive.foundMany":
    "{count} chats have been inactive for the last {days} days.",
  "v105ch.archiveInactive.foundNone":
    "No chats have been inactive for the last {days} days.",
  "v105ch.archiveInactive.foundOne":
    "1 chat has been inactive for the last {days} days.",
  "v105ch.archiveInactive.noneLeft": "No inactive chats left to archive",
  "v105ch.archiveInactive.oneChat": "1 chat",
  "v105ch.archiveInactive.progress": "{current} of {total}",
  "v105ch.archiveInactive.restoreFailed": "Couldn’t restore {chats}. {error}",
  "v105ch.archiveInactive.restored": "Restored {chats}",
  "v105ch.archiveInactive.restoredPartial":
    "Restored {chats}. Couldn’t restore {failed}. {error}",
  "v105ch.archiveInactive.restoring": "Restoring chats…",
  "v105ch.archiveInactive.title": "Archive inactive chats",
  "v105ch.general.newParticipateExisting":
    "New people can participate. People already in the {subject} keep their access.",
  "v105ch.general.noSwitchBack":
    "You won’t be able to switch back to Public here.",
  "v105ch.general.retainedGuest":
    "People who joined while it was View only are members and keep reading until you remove them.",
  "v105ch.general.retainedMember":
    "People who already joined remain members and keep their access until you remove them.",
  "v105ch.general.subjectNewParticipate":
    "New people will be able to participate. People already in the {subject} keep their access.",
  "v105ch.general.subjectNewView":
    "New people will only be able to view. People already in the {subject} keep their access.",
  "v105ch.general.subjectRead": "Only {subject} members can read.",
  "v105ch.members.addFailed": "Could not add them. Try again.",
  "v105ch.members.archivedDm": "Archived DMs cannot add members.",
  "v105ch.members.dmAddUnavailable":
    "Adding people to this DM is unavailable in this connection.",
  "v105ch.members.dmCannotAdd": "People can’t be added to this DM.",
  "v105ch.members.dmChoiceDescription":
    "Include history to add them to this DM with its earlier messages.",
  "v105ch.members.dmChoiceTitle": "Add {name}?",
  "v105ch.members.includeHistory": "Include history",
  "v105ch.members.notInDm": "Not in this DM",
  "v105ch.members.notYetAdded": "Not yet added",
  "v105ch.members.peopleInDm": "{names} are in the DM.",
  "v105ch.members.personInOtherDm": "{name} is in another DM.",
  "v105ch.members.profileNotInDm": "not in this DM",
  "v105ch.members.refreshRoles":
    "Refresh members and roles before trying again.",
  "v105ch.members.removeAgentDm": "Remove agent from DM",
  "v105ch.members.removeFromDm": "Remove from DM",
  "v105ch.members.removeMemberDm": "Remove member from DM",
  "v105ch.members.startNewDm": "Start a new DM",
  "v105ch.members.transfer": "Transfer ownership",
  "v105ch.members.transferChannel":
    "{name} becomes the owner of this channel and you'll become an admin. They can change your role, remove you or delete the channel. Only an owner can make you an owner again.",
  "v105ch.members.transferChat":
    "{name} becomes the owner of this chat and you'll become an admin. They can change your role, remove you or delete the chat. Only an owner can make you an owner again.",
  "v105ch.members.transferRefusal":
    "Ownership can only go to a person who has set up a profile.",
  "v105ch.members.transferTitle": "Transfer ownership to {name}?",
  "v105ch.outbox.abandonAdminSetup": "Abandon admin setup",
  "v105ch.outbox.abandonDescription":
    "The chat keeps its current roles. Retry your opening message to continue, or send a new message if it expired.",
  "v105ch.outbox.abandonTitle": "Abandon admin setup?",
  "v105ch.outbox.openingAdminSetup": "Opening agent admin setup",
  "v105ch.section.changeEmoji": "Change section emoji, currently {emoji}",
  "v105ch.section.chooseEmoji": "Choose section emoji",
  "v105ch.sidebar.optionalUnavailable":
    "This optional control is unavailable. Other settings and channel recovery remain available.",
  "v105ch.sidebar.soloSection": "Solo",
  "v105ch.sidebar.soloTab": "Solo",
  "v105ch.workspace.previousOrder":
    "The previous order is shown. A partial save may already exist on the relay.",
  "v105ch.workspace.refreshBeforeRetry":
    "Refresh saved workspace preferences before retrying this move.",
  "v105ch.workspace.thisWorkspace": "this workspace",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "v105ch.archiveInactive.archiveChats": "채팅 보관",
  "v105ch.archiveInactive.archiveCount": "{chats} 보관",
  "v105ch.archiveInactive.archiveFailed":
    "{chats}를 보관하지 못했습니다. {error}",
  "v105ch.archiveInactive.archived": "{chats}를 보관했습니다",
  "v105ch.archiveInactive.archivedPartial":
    "{chats}를 보관했습니다. {failed}개는 보관하지 못했습니다. {error}",
  "v105ch.archiveInactive.archiving": "비활성 채팅 보관 중…",
  "v105ch.archiveInactive.chatCount": "채팅 {count}개",
  "v105ch.archiveInactive.checkFailed":
    "어떤 채팅이 비활성 상태인지 확인하지 못했습니다.",
  "v105ch.archiveInactive.checking": "비활성 채팅 확인 중…",
  "v105ch.archiveInactive.foundMany":
    "채팅 {count}개가 지난 {days}일 동안 활동이 없었습니다.",
  "v105ch.archiveInactive.foundNone":
    "지난 {days}일 동안 활동이 없었던 채팅이 없습니다.",
  "v105ch.archiveInactive.foundOne":
    "채팅 1개가 지난 {days}일 동안 활동이 없었습니다.",
  "v105ch.archiveInactive.noneLeft": "보관할 비활성 채팅이 남아 있지 않습니다",
  "v105ch.archiveInactive.oneChat": "채팅 1개",
  "v105ch.archiveInactive.progress": "{current}/{total}",
  "v105ch.archiveInactive.restoreFailed":
    "{chats}를 복원하지 못했습니다. {error}",
  "v105ch.archiveInactive.restored": "{chats}를 복원했습니다",
  "v105ch.archiveInactive.restoredPartial":
    "{chats}를 복원했습니다. {failed}개는 복원하지 못했습니다. {error}",
  "v105ch.archiveInactive.restoring": "채팅 복원 중…",
  "v105ch.archiveInactive.title": "비활성 채팅 보관",
  "v105ch.general.newParticipateExisting":
    "새 사용자는 참여할 수 있습니다. 기존 {subject} 멤버의 접근 권한은 유지됩니다.",
  "v105ch.general.noSwitchBack": "여기서는 다시 공개로 바꿀 수 없습니다.",
  "v105ch.general.retainedGuest":
    "열람 전용일 때 참여한 사람은 멤버로 남으며, 직접 제거하기 전까지 계속 읽을 수 있습니다.",
  "v105ch.general.retainedMember":
    "이미 참여한 사람은 멤버로 남으며, 직접 제거하기 전까지 접근 권한이 유지됩니다.",
  "v105ch.general.subjectNewParticipate":
    "새 사용자는 참여할 수 있게 됩니다. 기존 {subject} 멤버의 접근 권한은 유지됩니다.",
  "v105ch.general.subjectNewView":
    "새 사용자는 열람만 할 수 있게 됩니다. 기존 {subject} 멤버의 접근 권한은 유지됩니다.",
  "v105ch.general.subjectRead": "{subject} 멤버만 읽을 수 있습니다.",
  "v105ch.members.addFailed": "추가하지 못했습니다. 다시 시도하세요.",
  "v105ch.members.archivedDm": "보관된 DM에는 멤버를 추가할 수 없습니다.",
  "v105ch.members.dmAddUnavailable":
    "이 연결에서는 이 DM에 사람을 추가할 수 없습니다.",
  "v105ch.members.dmCannotAdd": "이 DM에는 사람을 추가할 수 없습니다.",
  "v105ch.members.dmChoiceDescription":
    "기록을 포함하면 이전 메시지와 함께 이 DM에 추가됩니다.",
  "v105ch.members.dmChoiceTitle": "{name}님을 추가할까요?",
  "v105ch.members.includeHistory": "기록 포함",
  "v105ch.members.notInDm": "이 DM에 없음",
  "v105ch.members.notYetAdded": "아직 추가되지 않음",
  "v105ch.members.peopleInDm": "{names}의 DM 참여가 완료되었습니다.",
  "v105ch.members.personInOtherDm": "{name}님은 다른 DM에 있습니다.",
  "v105ch.members.profileNotInDm": "이 DM에 없음",
  "v105ch.members.refreshRoles":
    "다시 시도하기 전에 멤버와 역할을 새로 고치세요.",
  "v105ch.members.removeAgentDm": "DM에서 에이전트 제거",
  "v105ch.members.removeFromDm": "DM에서 제거",
  "v105ch.members.removeMemberDm": "DM에서 멤버 제거",
  "v105ch.members.startNewDm": "새 DM 시작",
  "v105ch.members.transfer": "소유권 이전",
  "v105ch.members.transferChannel":
    "{name}님이 이 채널의 소유자가 되고 나는 관리자가 됩니다. 새 소유자는 내 역할을 바꾸거나, 나를 제거하거나, 채널을 삭제할 수 있습니다. 소유자만 나를 다시 소유자로 지정할 수 있습니다.",
  "v105ch.members.transferChat":
    "{name}님이 이 채팅의 소유자가 되고 나는 관리자가 됩니다. 새 소유자는 내 역할을 바꾸거나, 나를 제거하거나, 채팅을 삭제할 수 있습니다. 소유자만 나를 다시 소유자로 지정할 수 있습니다.",
  "v105ch.members.transferRefusal":
    "소유권은 프로필을 설정한 사람에게만 넘길 수 있습니다.",
  "v105ch.members.transferTitle": "{name}님에게 소유권을 이전할까요?",
  "v105ch.outbox.abandonAdminSetup": "관리자 설정 중단",
  "v105ch.outbox.abandonDescription":
    "채팅의 현재 역할은 그대로 유지됩니다. 계속하려면 시작 메시지를 다시 보내고, 만료되었다면 새 메시지를 보내세요.",
  "v105ch.outbox.abandonTitle": "관리자 설정을 중단할까요?",
  "v105ch.outbox.openingAdminSetup": "에이전트 관리자 설정 여는 중",
  "v105ch.section.changeEmoji": "섹션 이모지 변경, 현재 {emoji}",
  "v105ch.section.chooseEmoji": "섹션 이모지 선택",
  "v105ch.sidebar.optionalUnavailable":
    "이 선택 기능을 사용할 수 없습니다. 다른 설정과 채널 복구는 계속 사용할 수 있습니다.",
  "v105ch.sidebar.soloSection": "1:1 채팅",
  "v105ch.sidebar.soloTab": "1:1",
  "v105ch.workspace.previousOrder":
    "이전 순서를 표시합니다. 릴레이에 일부가 이미 저장되었을 수 있습니다.",
  "v105ch.workspace.refreshBeforeRetry":
    "이 이동을 다시 시도하기 전에 저장된 작업 공간 설정을 새로 고치세요.",
  "v105ch.workspace.thisWorkspace": "이 작업 공간",
};

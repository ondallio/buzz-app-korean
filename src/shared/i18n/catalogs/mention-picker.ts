export const en = {
  "mentionPicker.controls": "Mention controls",
  "mentionPicker.mentionMember": "Mention a member",
  "mentionPicker.popup": "Mention a member or agent",
  "mentionPicker.searchRecipients": "Search recipients",
  "mentionPicker.searchMembers": "Search members and agents",
  "mentionPicker.searchCommunity": "Search community people and agents",
  "mentionPicker.searchPlaceholder": "Search",
  "mentionPicker.clearRecipients": "Clear search recipients",
  "mentionPicker.clearMembers": "Clear search members and agents",
  "mentionPicker.clearCommunity": "Clear search community people and agents",
  "mentionPicker.searchingCommunity": "Searching community…",
  "mentionPicker.shareSearch": "Search people and channels",
  "mentionPicker.sharePlaceholder": "Send to people or a channel",
  "mentionPicker.shareClear": "Clear search people and channels",
  "mentionPicker.sendingTo": "Sending to · {count}",
  "mentionPicker.people": "People",
  "mentionPicker.channels": "Channels",
  "mentionPicker.searching": "Searching…",
  "mentionPicker.loadingPeople": "Loading people…",
  "mentionPicker.minCharacters":
    "Type at least {count} characters to search people.",
  "mentionPicker.noTargets": "No people or channels match your search.",
  "mentionPicker.noOthers": "No one else to send to yet.",
  "mentionPicker.recipients": "Recipients",
  "mentionPicker.to": "To:",
  "mentionPicker.removeName": "Remove {name}",
  "mentionPicker.agent": "Agent",
  "mentionPicker.messageRecipients": "Message recipients",
  "mentionPicker.oneSelected": "{count} person selected",
  "mentionPicker.manySelected": "{count} people selected",
  "mentionPicker.addPerson": "Add another person…",
  "mentionPicker.findPerson": "Find a person…",
  "mentionPicker.invalidRecipient": "“{query}” is not a valid recipient",
  "mentionPicker.oneAtATime":
    "One person at a time. Remove them to choose someone else.",
  "mentionPicker.maxPeople": "You can message up to {count} people at once.",
  "mentionPicker.noPeople": "No matching people.",
  "mentionPicker.loadingPeopleLabel": "Loading people",
  "mentionPicker.peopleFailed": "Could not load people.",
  "mentionPicker.retryPeople": "Retry loading people",
  "mentionPicker.loadMorePeople": "Load more people",
  "mentionPicker.agentOption": "{name}, Agent",
  "mentionPicker.verifiedAgentOption": "{name}, {verified}, Agent",
  "mentionPicker.agentIdentifier": "{identifier} · Agent",
  "mentionPicker.chooseAgent": "Choose agent",
  "mentionPicker.changeAgents": "Change agents",
  "mentionPicker.sendingAgents": "Sending to {names}. Change agents",
  "mentionPicker.inviteChannel":
    "Agents you mention join this channel when you send, with access to its history.",
  "mentionPicker.inviteChat":
    "Agents you mention join this chat when you send, with access to its history.",
  "mentionPicker.retryCommunity": "Retry community search",
  "mentionPicker.loadingAgents": "Loading agents…",
  "mentionPicker.retryAgents": "Retry agent list",
  "mentionPicker.retryArchives": "Retry archive information",
  "mentionPicker.retryLegacyTeams": "Retry legacy teams",
  "mentionPicker.namesUnavailable":
    "Names unavailable. Exact public keys still identify recipients.",
  "mentionPicker.membershipFailed": "Could not refresh channel membership.",
  "mentionPicker.retryMembership": "Retry channel membership",
  "mentionPicker.membershipUnavailable": "Channel membership unavailable.",
  "mentionPicker.addsChannel": "Adds to channel when you send",
  "mentionPicker.addsChat": "Adds to chat when you send",
  "mentionPicker.noMembers": "No matching channel members.",
  "mentionPicker.namedTags":
    "Your message tags {names}, so picks here add or remove tags.",
  "mentionPicker.announceMention": "{name}. Press Enter to mention.",
  "mentionPicker.announceToggle":
    "{name}. Press Enter to add or remove this agent.",
  "mentionPicker.changedRecipient":
    "Channel membership changed. Reopen to review adding this recipient.",
  "mentionPicker.archived": "Archived",
  "mentionPicker.unavailableRecipient":
    "No longer available. Change your search to refresh choices.",
  "mentionPicker.changedTeam":
    "Team changed or unavailable. Reopen to refresh.",
  "mentionPicker.changedTeamMembership":
    "Channel membership changed. Reopen to review adding this team.",
  "mentionPicker.emptyTeam": "This team has no agents.",
  "mentionPicker.teamLimit": "Teams can mention at most 32 agents.",
  "mentionPicker.unavailableTeamMember":
    "A team member is unavailable. Edit the team or refresh choices.",
  "mentionPicker.loadingLegacyTeams": "Loading legacy teams…",
  "mentionPicker.legacyTeamsFailed":
    "Could not load legacy teams. Retry to refresh.",
  "mentionPicker.communityPeopleFailed":
    "Could not search community people. Retry to refresh.",
  "mentionPicker.remote": "Remote",
  "mentionPicker.outsideDm": "Not in DM · Will not be notified",
  "mentionPicker.outsideChannel": "Not in channel",
  "mentionPicker.inHost": "In {host}",
  "mentionPicker.managedBy": "Managed by {name}",
  "mentionPicker.teamNameDetail": "{name} · {detail}",
  "mentionPicker.savedTeam": "Saved team · {count} agents",
  "mentionPicker.teamOutsideDm":
    "Saved team · {count} agents · {outside} not in DM · Will not be notified",
  "mentionPicker.teamAddsChannel":
    "Saved team · {count} agents · Adds {outside} to channel when you send",
  "mentionPicker.teamAddsChat":
    "Saved team · {count} agents · Adds {outside} to chat when you send",
  "mentionPicker.teamOutsideChannel":
    "Saved team · {count} agents · {outside} not in channel",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "mentionPicker.controls": "멘션 도구",
  "mentionPicker.mentionMember": "멤버 멘션하기",
  "mentionPicker.popup": "멤버 또는 에이전트 멘션하기",
  "mentionPicker.searchRecipients": "받는 사람 검색",
  "mentionPicker.searchMembers": "멤버와 에이전트 검색",
  "mentionPicker.searchCommunity": "커뮤니티의 사람과 에이전트 검색",
  "mentionPicker.searchPlaceholder": "검색",
  "mentionPicker.clearRecipients": "받는 사람 검색어 지우기",
  "mentionPicker.clearMembers": "멤버와 에이전트 검색어 지우기",
  "mentionPicker.clearCommunity": "커뮤니티의 사람과 에이전트 검색어 지우기",
  "mentionPicker.searchingCommunity": "커뮤니티를 검색하는 중…",
  "mentionPicker.shareSearch": "사람과 채널 검색",
  "mentionPicker.sharePlaceholder": "사람 또는 채널에 보내기",
  "mentionPicker.shareClear": "사람과 채널 검색어 지우기",
  "mentionPicker.sendingTo": "전송 대상 · {count}",
  "mentionPicker.people": "사람",
  "mentionPicker.channels": "채널",
  "mentionPicker.searching": "검색 중…",
  "mentionPicker.loadingPeople": "사람을 불러오는 중…",
  "mentionPicker.minCharacters": "사람을 검색하려면 {count}자 이상 입력하세요.",
  "mentionPicker.noTargets": "검색어와 일치하는 사람이나 채널이 없습니다.",
  "mentionPicker.noOthers": "아직 보낼 수 있는 다른 사람이 없습니다.",
  "mentionPicker.recipients": "받는 사람",
  "mentionPicker.to": "받는 사람:",
  "mentionPicker.removeName": "{name} 제거",
  "mentionPicker.agent": "에이전트",
  "mentionPicker.messageRecipients": "메시지를 받을 사람",
  "mentionPicker.oneSelected": "{count}명 선택됨",
  "mentionPicker.manySelected": "{count}명 선택됨",
  "mentionPicker.addPerson": "다른 사람 추가…",
  "mentionPicker.findPerson": "사람 찾기…",
  "mentionPicker.invalidRecipient":
    "“{query}”은(는) 올바른 받는 사람이 아닙니다",
  "mentionPicker.oneAtATime":
    "한 번에 한 사람만 선택할 수 있습니다. 다른 사람을 선택하려면 현재 선택을 제거하세요.",
  "mentionPicker.maxPeople":
    "한 번에 최대 {count}명에게 메시지를 보낼 수 있습니다.",
  "mentionPicker.noPeople": "일치하는 사람이 없습니다.",
  "mentionPicker.loadingPeopleLabel": "사람 불러오는 중",
  "mentionPicker.peopleFailed": "사람을 불러오지 못했습니다.",
  "mentionPicker.retryPeople": "사람 목록 다시 불러오기",
  "mentionPicker.loadMorePeople": "사람 더 불러오기",
  "mentionPicker.agentOption": "{name}, 에이전트",
  "mentionPicker.verifiedAgentOption": "{name}, {verified}, 에이전트",
  "mentionPicker.agentIdentifier": "{identifier} · 에이전트",
  "mentionPicker.chooseAgent": "에이전트 선택",
  "mentionPicker.changeAgents": "에이전트 변경",
  "mentionPicker.sendingAgents":
    "{names}에게 보내는 중입니다. 에이전트를 변경합니다.",
  "mentionPicker.inviteChannel":
    "멘션한 에이전트는 전송할 때 이 채널에 참여하며 이전 대화에 접근할 수 있습니다.",
  "mentionPicker.inviteChat":
    "멘션한 에이전트는 전송할 때 이 채팅에 참여하며 이전 대화에 접근할 수 있습니다.",
  "mentionPicker.retryCommunity": "커뮤니티 검색 다시 시도",
  "mentionPicker.loadingAgents": "에이전트를 불러오는 중…",
  "mentionPicker.retryAgents": "에이전트 목록 다시 불러오기",
  "mentionPicker.retryArchives": "보관 정보 다시 불러오기",
  "mentionPicker.retryLegacyTeams": "이전 버전 팀 다시 불러오기",
  "mentionPicker.namesUnavailable":
    "이름을 불러올 수 없습니다. 정확한 공개 키로 받는 사람을 확인할 수 있습니다.",
  "mentionPicker.membershipFailed": "채널 멤버 정보를 새로 고치지 못했습니다.",
  "mentionPicker.retryMembership": "채널 멤버 정보 다시 불러오기",
  "mentionPicker.membershipUnavailable": "채널 멤버 정보를 사용할 수 없습니다.",
  "mentionPicker.addsChannel": "전송하면 채널에 추가됨",
  "mentionPicker.addsChat": "전송하면 채팅에 추가됨",
  "mentionPicker.noMembers": "일치하는 채널 멤버가 없습니다.",
  "mentionPicker.namedTags":
    "메시지에는 {names} 태그가 있습니다. 여기서 선택하면 태그를 추가하거나 제거합니다.",
  "mentionPicker.announceMention": "{name}. Enter 키를 누르면 멘션합니다.",
  "mentionPicker.announceToggle":
    "{name}. Enter 키를 누르면 이 에이전트를 추가하거나 제거합니다.",
  "mentionPicker.changedRecipient":
    "채널 멤버 구성이 변경되었습니다. 다시 열어 이 받는 사람을 추가할지 확인하세요.",
  "mentionPicker.archived": "보관됨",
  "mentionPicker.unavailableRecipient":
    "더 이상 사용할 수 없습니다. 검색어를 바꾸어 선택 항목을 새로 고치세요.",
  "mentionPicker.changedTeam":
    "팀이 변경되었거나 사용할 수 없습니다. 다시 열어 새로 고치세요.",
  "mentionPicker.changedTeamMembership":
    "채널 멤버 구성이 변경되었습니다. 다시 열어 이 팀을 추가할지 확인하세요.",
  "mentionPicker.emptyTeam": "이 팀에는 에이전트가 없습니다.",
  "mentionPicker.teamLimit": "팀은 최대 32명의 에이전트를 멘션할 수 있습니다.",
  "mentionPicker.unavailableTeamMember":
    "팀 멤버를 사용할 수 없습니다. 팀을 수정하거나 선택 항목을 새로 고치세요.",
  "mentionPicker.loadingLegacyTeams": "이전 버전 팀을 불러오는 중…",
  "mentionPicker.legacyTeamsFailed":
    "이전 버전 팀을 불러오지 못했습니다. 다시 시도해 새로 고치세요.",
  "mentionPicker.communityPeopleFailed":
    "커뮤니티의 사람을 검색하지 못했습니다. 다시 시도해 새로 고치세요.",
  "mentionPicker.remote": "원격",
  "mentionPicker.outsideDm": "DM에 없음 · 알림을 받지 않음",
  "mentionPicker.outsideChannel": "채널에 없음",
  "mentionPicker.inHost": "{host}에 있음",
  "mentionPicker.managedBy": "{name}님이 관리",
  "mentionPicker.teamNameDetail": "{name} · {detail}",
  "mentionPicker.savedTeam": "저장된 팀 · 에이전트 {count}명",
  "mentionPicker.teamOutsideDm":
    "저장된 팀 · 에이전트 {count}명 · {outside}명은 DM에 없어 알림을 받지 않습니다",
  "mentionPicker.teamAddsChannel":
    "저장된 팀 · 에이전트 {count}명 · 전송하면 {outside}명이 채널에 추가됩니다",
  "mentionPicker.teamAddsChat":
    "저장된 팀 · 에이전트 {count}명 · 전송하면 {outside}명이 채팅에 추가됩니다",
  "mentionPicker.teamOutsideChannel":
    "저장된 팀 · 에이전트 {count}명 · {outside}명은 채널에 없습니다",
};

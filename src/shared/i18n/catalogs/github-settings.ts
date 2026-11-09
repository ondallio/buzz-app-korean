export const en = {
  "githubSettings.settings": "GitHub settings",
  "githubSettings.authorsSettings": "GitHub comment authors settings",
  "githubSettings.authors": "Comment authors",
  "githubSettings.authorsHelp":
    "Agents watching a pull request are woken by CI, and by the comments and reviews these rules allow.",
  "githubSettings.rulesForm": "GitHub comment author rules",
  "githubSettings.invalidSaved":
    "Your saved rules no longer parse, so no comment or review wakes your agents until you fix them.",
  "githubSettings.openPolicy":
    "Comments from anyone no rule denies can wake your agents.",
  "githubSettings.rules": "Rules",
  "githubSettings.rulesHelp":
    "One rule per line. The first rule that matches decides.",
  "githubSettings.syntax": "Rule syntax",
  "githubSettings.syntaxConditions":
    "allow or deny, then any of author:login, author:/pattern/, org:organization, body:/pattern/ and prefix:text, which runs to the end of the line. A bare allow or deny matches everyone.",
  "githubSettings.syntaxAccount":
    "author:@me is your GitHub account, a bot’s login ends in [bot], and logins match case aside.",
  "githubSettings.syntaxBody":
    "body: sees a comment’s first 1,000 characters, the most a wake quotes.",
  "githubSettings.syntaxPattern":
    "Patterns are JavaScript regular expressions without backreferences, lookaround or escapes JavaScript reads as plain letters, such as \\q.",
  "githubSettings.syntaxMembership":
    "Membership your GitHub account cannot see, or of a misspelled organization, counts as none.",
  "githubSettings.fallback": "When no rule matches",
  "githubSettings.allow": "Wake the agent",
  "githubSettings.deny": "Don’t wake it",
  "githubSettings.save": "Save",
  "githubSettings.accountDesktop":
    "Your GitHub account is the one gh is signed in to in the desktop app.",
  "githubSettings.accountChecking":
    "Checking which GitHub account gh is signed in to…",
  "githubSettings.accountFailed":
    "gh couldn’t read your GitHub account: {reason}",
  "githubSettings.accountSignedIn":
    "Signed in to GitHub as {login} through gh.",
  "githubSettings.linksSettings": "GitHub link settings",
  "githubSettings.links": "Links",
  "githubSettings.openLinks": "Open GitHub links in Buzz",
  "githubSettings.openLinksHelp":
    "Open supported GitHub links in a side panel. Turn off to use your browser. This applies to all communities on this device.",
  "githubSettings.choiceFailed":
    "Your choice could not be saved. Try changing it again.",
} as const;
export const ko: Record<keyof typeof en, string> = {
  "githubSettings.settings": "GitHub 설정",
  "githubSettings.authorsSettings": "GitHub 댓글 작성자 설정",
  "githubSettings.authors": "댓글 작성자",
  "githubSettings.authorsHelp":
    "PR을 지켜보는 에이전트는 CI 결과와 이 규칙에서 허용한 댓글·리뷰가 도착하면 작업을 이어갑니다.",
  "githubSettings.rulesForm": "GitHub 댓글 작성자 규칙",
  "githubSettings.invalidSaved":
    "저장된 규칙을 해석할 수 없습니다. 규칙을 수정하기 전에는 어떤 댓글이나 리뷰도 에이전트의 작업을 재개하지 않습니다.",
  "githubSettings.openPolicy":
    "규칙에서 거부하지 않은 작성자의 댓글은 에이전트의 작업을 재개할 수 있습니다.",
  "githubSettings.rules": "규칙",
  "githubSettings.rulesHelp":
    "한 줄에 규칙 하나를 입력하세요. 처음 일치한 규칙을 적용합니다.",
  "githubSettings.syntax": "규칙 문법",
  "githubSettings.syntaxConditions":
    "allow 또는 deny 뒤에 author:login, author:/pattern/, org:organization, body:/pattern/, prefix:text 조건을 넣으세요. prefix:text는 줄 끝까지 적용됩니다. 조건 없는 allow 또는 deny는 모든 작성자에게 적용됩니다.",
  "githubSettings.syntaxAccount":
    "author:@me는 내 GitHub 계정을 가리킵니다. 봇의 로그인 이름은 [bot]으로 끝나며, 로그인 이름은 대소문자를 구분하지 않습니다.",
  "githubSettings.syntaxBody":
    "body:는 댓글의 처음 1,000자를 검사합니다. 에이전트의 작업 재개 알림에 인용되는 최대 길이와 같습니다.",
  "githubSettings.syntaxPattern":
    "패턴은 JavaScript 정규식입니다. 역참조, 전후방 탐색, \\q처럼 JavaScript가 일반 문자로 해석하는 이스케이프는 사용할 수 없습니다.",
  "githubSettings.syntaxMembership":
    "내 GitHub 계정에서 확인할 수 없는 조직 소속이나 이름을 잘못 입력한 조직의 소속은 없는 것으로 처리합니다.",
  "githubSettings.fallback": "일치하는 규칙이 없을 때",
  "githubSettings.allow": "에이전트 작업 재개",
  "githubSettings.deny": "작업 재개 안 함",
  "githubSettings.save": "저장",
  "githubSettings.accountDesktop":
    "데스크톱 앱의 gh에 로그인한 계정을 GitHub 계정으로 사용합니다.",
  "githubSettings.accountChecking": "gh에 로그인한 GitHub 계정을 확인하는 중…",
  "githubSettings.accountFailed":
    "gh에서 GitHub 계정을 확인하지 못했습니다: {reason}",
  "githubSettings.accountSignedIn":
    "gh를 통해 GitHub에 {login} 계정으로 로그인했습니다.",
  "githubSettings.linksSettings": "GitHub 링크 설정",
  "githubSettings.links": "링크",
  "githubSettings.openLinks": "Buzz에서 GitHub 링크 열기",
  "githubSettings.openLinksHelp":
    "지원하는 GitHub 링크를 사이드 패널에서 엽니다. 끄면 브라우저에서 열립니다. 이 기기의 모든 커뮤니티에 적용됩니다.",
  "githubSettings.choiceFailed":
    "선택을 저장하지 못했습니다. 다시 변경해 주세요.",
};

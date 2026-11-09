// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { nsecEncode, npubEncode } from "nostr-tools/nip19";
import { getPublicKey } from "nostr-tools/pure";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { CommunityUrlField } from "./CommunityUrlField";
import { OnboardingBack } from "./OnboardingBack";
import { KeyImport } from "./KeyImport";
import { WelcomeBack } from "./WelcomeBack";
import { KeyRestore } from "./KeyRestore";
import { KeyLost } from "./KeyLost";
import { BackupPrompt } from "./BackupConsent";
import { ProfileStep } from "./ProfileStep";
import { JoinCommunity } from "./JoinCommunity";
import { CreateCommunityStep } from "./CreateCommunityStep";
import { InviteCodeField } from "./InviteCodeField";
import { ConnectChoice } from "./ConnectChoice";
import { PrivateKey } from "./PrivateKey";
import { RestoreIdentity } from "./RestoreIdentity";
import { IdentitySetup } from "./IdentitySetup";
import { createIdentity } from "./service";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => false),
  Channel: class {},
}));
// Public, deterministic test vector; never a user's identity or an account credential.
const nsec = nsecEncode(new Uint8Array(32).fill(1));
const pubkey = getPublicKey(new Uint8Array(32).fill(1));
const npub = npubEncode(pubkey);
const identities: ReturnType<typeof createIdentity>[] = [];
function identity() {
  const service = createIdentity();
  identities.push(service);
  return service;
}
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const waiting = { status: "waiting" } as const;
const recovery = {
  subscribe: () => () => {},
  snapshot: () => waiting,
  installRecovery: vi.fn(async () => {}),
  cancelRecovery: vi.fn(async () => true),
  beginRecovery: vi.fn(async () => {}),
};
afterEach(() => {
  cleanup();
  for (const service of identities.splice(0)) service.dispose();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  localStorage.clear();
});

it.each([
  [
    "key import",
    <KeyImport key="KeyImport" onBack={vi.fn()} onImport={vi.fn()} />,
    "Enter your private key",
    "비밀 키 입력",
  ],
  [
    "welcome back",
    <WelcomeBack
      key="WelcomeBack"
      npub={npub}
      onImport={vi.fn()}
      onSwitchAccount={vi.fn()}
    />,
    "Continue with this key",
    "이 키로 계속",
  ],
  [
    "key restore",
    <KeyRestore
      key="KeyRestore"
      recovery={recovery}
      expectedPubkey={pubkey}
      onBack={vi.fn()}
      onImport={vi.fn()}
      onInstalled={vi.fn()}
    />,
    "Restore your key",
    "키 복원",
  ],
  [
    "lost key",
    <KeyLost key="KeyLost" owned={[]} onBack={vi.fn()} onStartOver={vi.fn()} />,
    "Lost your key?",
    "키를 잃어버리셨나요?",
  ],
  [
    "profile",
    <ProfileStep
      key="ProfileStep"
      found={{ url: "https://fixture.example", host: "fixture.example" }}
      read={{
        exists: false,
        existing: {},
        profile: { name: "", picture: "", about: "" },
      }}
      defaultName="fixture user"
      onContinue={vi.fn()}
    />,
    "Set up your profile",
    "프로필 설정",
  ],
  [
    "join",
    <JoinCommunity
      key="JoinCommunity"
      url=""
      onUrlChange={vi.fn()}
      onFind={vi.fn()}
    />,
    "Connect to a community",
    "커뮤니티 연결",
  ],
  [
    "create",
    <CreateCommunityStep
      key="CreateCommunityStep"
      account={{
        communityAvailable: async () => false,
        createCommunity: async () => "https://fixture.example",
      }}
      onCreated={vi.fn()}
      onBack={vi.fn()}
    />,
    "Create a community",
    "커뮤니티 만들기",
  ],
  [
    "connect",
    <ConnectChoice
      key="ConnectChoice"
      host="user host"
      onBack={vi.fn()}
      onConnect={vi.fn()}
      onImport={vi.fn()}
    />,
    "Connect to your community",
    "내 커뮤니티 연결",
  ],
] as const)(
  "keeps the real %s screen mounted through EN → KO → EN",
  (_, component, english, korean) => {
    setLanguage("en");
    render(component);
    const heading = screen.getByRole("heading", { name: english });
    act(() => setLanguage("ko"));
    expect(screen.getByRole("heading", { name: korean })).toBe(heading);
    act(() => setLanguage("en"));
    expect(screen.getByRole("heading", { name: english })).toBe(heading);
  },
);

it("keeps invite input, source error and trimmed wire value through language changes", () => {
  setLanguage("en");
  const submit = vi.fn();
  render(
    <InviteCodeField
      error="Continue"
      busy={false}
      pending={false}
      onSubmit={submit}
    />,
  );
  const input = screen.getByRole("textbox", { name: "Invite code" });
  act(() => setLanguage("ko"));
  expect(screen.getByRole("textbox", { name: "초대 코드" })).toBe(input);
  expect(screen.getByText("Continue")).toBeVisible();
  fireEvent.change(input, { target: { value: " AbC-123 " } });
  input.focus();
  act(() => setLanguage("en"));
  expect(input).toHaveValue(" AbC-123 ");
  expect(input).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Join" }));
  expect(submit).toHaveBeenCalledExactlyOnceWith("AbC-123");
});

it("updates an existing address validation error and preserves the same input and canonical address", () => {
  setLanguage("en");
  const submit = vi.fn();
  const view = render(
    <CommunityUrlField url="" onUrlChange={vi.fn()} onSubmit={submit} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  const input = screen.getByRole("textbox");
  input.focus();
  act(() => setLanguage("ko"));
  expect(
    screen.getByRole("textbox", { name: "커뮤니티 주소 또는 초대 링크" }),
  ).toBe(input);
  expect(
    screen.getByText("커뮤니티 주소나 초대 링크를 입력해 주세요."),
  ).toBeVisible();
  view.rerender(
    <CommunityUrlField
      url="fixture.example"
      onUrlChange={vi.fn()}
      onSubmit={submit}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "계속" }));
  expect(submit).toHaveBeenCalledExactlyOnceWith("https://fixture.example", "");
});

it("keeps default Back reactive and caller-provided labels untouched", () => {
  setLanguage("en");
  render(
    <>
      <OnboardingBack />
      <OnboardingBack aria-label="Back supplied" />
    </>,
  );
  const back = screen.getByRole("button", { name: "Back" });
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "뒤로" })).toBe(back);
  expect(screen.getByRole("button", { name: "Back supplied" })).toBeVisible();
});

it("keeps key input and raw import refusal, and retranslates a pending import", async () => {
  setLanguage("en");
  const gate = deferred();
  const submit = vi.fn(() => gate.promise);
  render(<KeyImport onBack={vi.fn()} onImport={submit} />);
  const input = screen.getByLabelText("Private key (nsec)");
  fireEvent.change(input, { target: { value: nsec } });
  act(() => setLanguage("ko"));
  expect(screen.getByLabelText("비밀 키(nsec)")).toBe(input);
  expect(input).toHaveValue(nsec);
  fireEvent.click(screen.getByRole("button", { name: "이 키로 계속" }));
  expect(submit).toHaveBeenCalledExactlyOnceWith(nsec);
  expect(screen.getByRole("status")).toHaveTextContent(
    "키를 가져오고 있습니다…",
  );
  act(() => setLanguage("en"));
  expect(screen.getByRole("status")).toHaveTextContent("Importing your key…");
  await act(async () => gate.reject(new Error("Continue")));
  expect(screen.getByLabelText("Private key (nsec)")).toHaveValue(nsec);
  expect(screen.getByText("Continue")).toBeVisible();
});

it("retranslates retained backup-save fallback and retries with unchanged public key and boolean", async () => {
  setLanguage("en");
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error("native detail"))
    .mockResolvedValue(undefined);
  const close = vi.fn();
  render(
    <BackupPrompt
      identity={{ setBackupChoice: save }}
      pubkey={pubkey}
      onClose={close}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Sync with Builderlab" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not save your choice. Try again.",
  );
  const dialog = screen.getByRole("alertdialog");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("alertdialog")).toBe(dialog);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "선택한 설정을 저장하지 못했습니다. 다시 시도해 주세요.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Builderlab과 동기화" }));
  await act(async () => {});
  expect(save.mock.calls).toEqual([
    [pubkey, true],
    [pubkey, true],
  ]);
  expect(close).toHaveBeenCalledExactlyOnceWith(true);
});

it("retranslates private-key copy result while preserving the exact clipboard fixture and revealed value", async () => {
  setLanguage("en");
  const user = userEvent.setup();
  vi.mocked(invoke).mockImplementation((command) =>
    Promise.resolve(command === "identity_export" ? nsec : null),
  );
  const write = vi.spyOn(navigator.clipboard, "writeText");
  render(<PrivateKey identity={identity()} />);
  await user.click(screen.getByRole("button", { name: "Reveal private key" }));
  const input = screen.getByRole("textbox", { name: "Private key (nsec)" });
  expect(input).toHaveValue(nsec);
  await user.click(screen.getByRole("button", { name: "Copy private key" }));
  expect(write).toHaveBeenCalledExactlyOnceWith(nsec);
  act(() => setLanguage("ko"));
  expect(screen.getByRole("textbox", { name: "비밀 키(nsec)" })).toBe(input);
  expect(input).toHaveValue(nsec);
  expect(screen.getByRole("status")).toHaveTextContent(
    "비밀 키를 복사했습니다. 안전한 곳에 보관하세요. 현재 클립보드에 비밀 키가 들어 있습니다.",
  );
  act(() => setLanguage("en"));
  expect(screen.getByRole("textbox", { name: "Private key (nsec)" })).toBe(
    input,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Private key copied.");
});

it("changes a real recovery status without restarting or changing native handle values", () => {
  setLanguage("en");
  const install = vi.fn();
  const recoveryState = {
    status: "choosing" as const,
    candidates: [{ handle: "unchanged-handle", pubkey }],
    currentPubkey: pubkey,
    failedCount: 0,
  };
  render(
    <RestoreIdentity
      identity={{
        beginRecovery: vi.fn(),
        installRecovery: install,
        cancelRecovery: vi.fn(),
      }}
      recovery={recoveryState}
    />,
  );
  const radio = screen.getByRole("radio");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("radio")).toBe(radio);
  expect(radio).toBeChecked();
  expect(screen.getByText("현재 신원")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "이 신원 복원" }));
  expect(install).toHaveBeenCalledExactlyOnceWith("unchanged-handle");
});

it("keeps the legacy setup import draft when language changes", async () => {
  setLanguage("en");
  vi.mocked(invoke).mockResolvedValue(null);
  render(
    <IdentitySetup identity={identity()}>
      <p>App</p>
    </IdentitySetup>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Use an existing key" }),
  );
  const input = screen.getByLabelText("Private key (nsec)");
  fireEvent.change(input, { target: { value: nsec } });
  input.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByLabelText("비밀 키(nsec)")).toBe(input);
  expect(input).toHaveValue(nsec);
  expect(input).toHaveFocus();
  act(() => setLanguage("en"));
  expect(screen.getByLabelText("Private key (nsec)")).toBe(input);
});

it("keeps the original inline npub code node in a translated complete mismatch sentence", () => {
  setLanguage("en");
  render(
    <KeyImport
      expectedPubkey={"ab".repeat(32)}
      onBack={vi.fn()}
      onImport={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Private key (nsec)"), {
    target: { value: nsec },
  });
  const expected = npubEncode("ab".repeat(32));
  const code = screen.getByText(expected);
  expect(code.tagName).toBe("CODE");
  expect(code.parentElement).toHaveTextContent(
    `That isn’t the key linked to this account. It expects ${expected} (the key on your other device).`,
  );
  act(() => setLanguage("ko"));
  expect(screen.getByText(expected)).toBe(code);
  expect(code.parentElement).toHaveTextContent(
    `이 계정에 연결된 키가 아닙니다. 다른 기기에 있는 키인 ${expected}를 입력해 주세요.`,
  );
  expect(screen.getByRole("button", { name: "이 키로 계속" })).toBeDisabled();
  act(() => setLanguage("en"));
  expect(screen.getByText(expected)).toBe(code);
});

it("retranslates a retained classified profile failure and keeps the same draft and retry payload", async () => {
  setLanguage("en");
  const submit = vi
    .fn()
    .mockRejectedValueOnce(new Error("Relay read failed (403)"))
    .mockResolvedValue(undefined);
  render(
    <ProfileStep
      found={{ url: "https://fixture.example", host: "fixture.example" }}
      read={{
        exists: false,
        existing: {},
        profile: { name: "", picture: "", about: "" },
      }}
      defaultName="Continue"
      onContinue={submit}
    />,
  );
  const input = screen.getByRole("textbox", { name: "Display name" });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "fixture.example no longer admits this key.",
  );
  act(() => setLanguage("ko"));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "fixture.example에서 이 키의 접근을 더 이상 허용하지 않습니다.",
  );
  expect(screen.getByRole("textbox", { name: "표시 이름" })).toBe(input);
  expect(input).toHaveValue("Continue");
  fireEvent.click(screen.getByRole("button", { name: "계속" }));
  await act(async () => {});
  expect(submit.mock.calls).toEqual([
    [{ name: "Continue", picture: "", about: "" }],
    [{ name: "Continue", picture: "", about: "" }],
  ]);
});

it("preserves user names, email addresses and community hosts that resemble English labels", () => {
  setLanguage("ko");
  const view = render(
    <WelcomeBack
      npub={npub}
      email="Continue"
      profile={{ name: "Saved key", picture: "" }}
      onImport={vi.fn()}
      onSwitchAccount={vi.fn()}
    />,
  );
  expect(screen.getByText("Saved key")).toBeVisible();
  expect(screen.getByText("Continue 계정으로 로그인했습니다")).toBeVisible();
  expect(
    screen.getByRole("button", { name: /^Saved key님으로 계속, npub1/ }),
  ).toBeEnabled();
  view.unmount();
  const find = vi.fn();
  render(
    <JoinCommunity
      url=""
      onUrlChange={vi.fn()}
      onFind={find}
      owned={[{ host: "Connect", url: "https://fixture.example" }]}
    />,
  );
  expect(screen.getByText("Connect")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Connect에 연결" }));
  expect(find).toHaveBeenCalledExactlyOnceWith("https://fixture.example");
});

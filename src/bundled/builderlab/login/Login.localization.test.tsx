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
import { StrictMode, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../../shared/i18n";
import { Login } from "./Login";
import { createTestSession, deferred } from "../test-helpers";
import type { BuilderlabSession, Credential, LoginSnapshot } from "../session";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const credential: Credential = {
  revision: "fixture-only",
  account: {
    subject: "opaque-subject",
    email: "Raw {email} 한글@example.test",
    canUseRemoteAgents: true,
    canUseBuilderlabDecisions: false,
  },
};
const rawDraft = "Host {draft} 한글";
function Host({
  session,
  ...props
}: Omit<Parameters<typeof Login>[0], "active"> & { active?: () => boolean }) {
  const [draft, setDraft] = useState(rawDraft);
  return (
    <>
      <Login
        session={session}
        active={props.active ?? (() => true)}
        {...props}
      />
      <input
        aria-label="Host draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </>
  );
}
function input() {
  const node = screen.getByRole("textbox", { name: "Host draft" });
  if (!(node instanceof HTMLInputElement))
    throw new Error("Missing host draft");
  return node;
}

it.each(["native", "broker"] as const)(
  "uses complete %s signed-out/signed-in intro messages without changing the session, raw email or host draft",
  async (mode) => {
    vi.stubEnv("VITE_BUZZ_LIVE", mode === "broker" ? "1" : "");
    vi.stubEnv("VITE_BUZZ_FEDERATED_IDENTITY", mode === "native" ? "1" : "");
    const acquire = vi.fn(async () => credential),
      session = createTestSession(acquire);
    render(<Host session={session} available />);
    const draft = input();
    draft.focus();
    draft.setSelectionRange(2, 8);
    const intro = screen.getByText(/Connect your Builderlab account/),
      button = screen.getByRole("button", { name: "Sign in with Builderlab" });
    const source =
      mode === "broker"
        ? "Connect your Builderlab account. Your sign-in stays on the development server through app reloads, until you sign out or the session expires."
        : "Connect your Builderlab account. Buzz keeps your sign-in in your system keychain until you sign out.";
    const korean =
      mode === "broker"
        ? "Builderlab 계정을 연결하세요. 로그아웃하거나 세션이 만료될 때까지 개발 서버에 로그인 정보가 유지되므로 앱을 다시 불러와도 로그인 상태가 유지됩니다."
        : "Builderlab 계정을 연결하세요. Buzz는 로그아웃할 때까지 시스템 키체인에 로그인 정보를 보관합니다.";
    expect(intro.textContent).toBe(source);
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByText(language === "ko" ? korean : source)).toBe(intro);
      expect(input()).toBe(draft);
      expect(draft).toHaveValue(rawDraft);
      expect(draft).toHaveFocus();
      expect([draft.selectionStart, draft.selectionEnd]).toEqual([2, 8]);
      expect(
        screen.getByRole("button", {
          name:
            language === "ko"
              ? "Builderlab으로 로그인"
              : "Sign in with Builderlab",
        }),
      ).toBe(button);
      expect(acquire).not.toHaveBeenCalled();
    }
    await act(async () => session.signIn());
    expect(acquire).toHaveBeenCalledOnce();
    const signedIn =
      mode === "broker"
        ? "Your sign-in stays on the development server through app reloads, until you sign out or the session expires."
        : "Buzz keeps your sign-in in your system keychain until you sign out.";
    const signedInKo =
      mode === "broker"
        ? "로그아웃하거나 세션이 만료될 때까지 개발 서버에 로그인 정보가 유지되므로 앱을 다시 불러와도 로그인 상태가 유지됩니다."
        : "Buzz는 로그아웃할 때까지 시스템 키체인에 로그인 정보를 보관합니다.";
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByText(language === "ko" ? signedInKo : signedIn)).toBe(
        intro,
      );
      expect(screen.getByRole("status").textContent).toBe(
        language === "ko"
          ? `${credential.account.email} 계정으로 로그인했습니다.`
          : `Signed in as ${credential.account.email}.`,
      );
      expect(session.credential().account.email).toBe(credential.account.email);
      expect(draft).toHaveValue(rawDraft);
      expect(acquire).toHaveBeenCalledOnce();
    }
    session.dispose();
  },
);

it.each([
  undefined,
  "",
  "Open the Buzz desktop app to sign in with Builderlab.",
])(
  "translates only absent unavailableReason (%s), preserving the explicit value and same status",
  (reason) => {
    const acquire = vi.fn(),
      session = createTestSession(acquire);
    render(
      <Host
        session={session}
        available={false}
        {...(reason === undefined ? {} : { unavailableReason: reason })}
      />,
    );
    const status = screen.getByRole("status"),
      draft = input();
    draft.focus();
    draft.setSelectionRange(1, 5);
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole("status")).toBe(status);
      expect(status.textContent).toBe(
        reason ??
          (language === "ko"
            ? "Builderlab에 로그인하려면 Buzz 데스크톱 앱을 여세요."
            : "Open the Buzz desktop app to sign in with Builderlab."),
      );
      expect(input()).toBe(draft);
      expect(draft).toHaveFocus();
      expect([draft.selectionStart, draft.selectionEnd]).toEqual([1, 5]);
      expect(screen.queryByRole("button")).toBeNull();
      expect(acquire).not.toHaveBeenCalled();
    }
    session.dispose();
  },
);

it.each(["complete", "cancel", "abandon", "observe"] as const)(
  "keeps one pending sign-in and original lifecycle on %s through locale",
  async (outcome) => {
    const held = deferred<Credential>(),
      acquire = vi.fn((_signal: AbortSignal) => held.promise),
      session = createTestSession(acquire),
      cancel = vi.spyOn(session, "cancel"),
      abandon = vi.spyOn(session, "abandon");
    const user = userEvent.setup();
    const view = render(
      <Host
        session={session}
        available
        cancelOnUnmount={outcome !== "observe"}
      />,
      { wrapper: StrictMode },
    );
    const draft = input();
    draft.setSelectionRange(2, 7);
    await user.click(
      screen.getByRole("button", { name: "Sign in with Builderlab" }),
    );
    const button = screen.getByRole("button", { name: "Cancel sign-in" }),
      signal = acquire.mock.calls[0]?.[0];
    try {
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        expect(
          screen.getByRole("button", {
            name: language === "ko" ? "로그인 취소" : "Cancel sign-in",
          }),
        ).toBe(button);
        expect(button).toHaveFocus();
        expect(screen.getByRole("status").textContent).toBe(
          language === "ko"
            ? "브라우저에서 로그인을 완료한 후 Buzz로 돌아오세요."
            : "Finish sign-in in your browser, then return to Buzz.",
        );
        expect(input()).toBe(draft);
        expect(draft).toHaveValue(rawDraft);
        expect([draft.selectionStart, draft.selectionEnd]).toEqual([2, 7]);
        expect(signal?.aborted).toBe(false);
        expect(acquire).toHaveBeenCalledOnce();
        expect(cancel).not.toHaveBeenCalled();
        expect(abandon).not.toHaveBeenCalled();
      }
      if (outcome === "cancel") await user.click(button);
      else if (outcome !== "complete") view.unmount();
      expect(signal?.aborted).toBe(
        outcome === "cancel" || outcome === "abandon",
      );
      expect(cancel).toHaveBeenCalledTimes(outcome === "cancel" ? 1 : 0);
      expect(abandon).toHaveBeenCalledTimes(outcome === "abandon" ? 1 : 0);
    } finally {
      await act(async () => held.resolve(credential));
    }
    expect(session.snapshot().status).toBe(
      outcome === "cancel" || outcome === "abandon"
        ? "signed-out"
        : "signed-in",
    );
    expect(acquire).toHaveBeenCalledOnce();
    session.dispose();
  },
);

it.each([true, false])(
  "keeps the complete native organization sentence and existing %s link node without sign-out or account changes",
  async (hasAction) => {
    vi.stubEnv("VITE_BUZZ_FEDERATED_IDENTITY", "1");
    const session = createTestSession(async () => credential);
    await session.signIn();
    const signOut = vi.spyOn(session, "signOut"),
      identity = vi.fn();
    let active = true;
    render(
      <Host
        session={session}
        available
        active={() => active}
        {...(hasAction ? { openIdentity: identity } : {})}
      />,
    );
    const draft = input();
    draft.setSelectionRange(1, 6);
    const sentence = screen.getByText(
      /Builderlab uses your organization sign-in/,
    );
    const link = hasAction
      ? screen.getByRole("button", { name: "Identity → Organization sign-in" })
      : sentence;
    if (hasAction) link.focus();
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      const label =
        language === "ko"
          ? "신원 → 조직 로그인"
          : "Identity → Organization sign-in";
      expect(
        hasAction
          ? screen.getByRole("button", { name: label })
          : screen.getByText(
              language === "ko"
                ? /Builderlab은 조직 로그인을 사용합니다/
                : /Builderlab uses your organization sign-in/,
            ),
      ).toBe(link);
      expect(link.closest("p")).toBe(sentence);
      expect(sentence?.textContent).toBe(
        language === "ko"
          ? "Builderlab은 조직 로그인을 사용합니다. 로그아웃하려면 신원 → 조직 로그인으로 이동하세요."
          : "Builderlab uses your organization sign-in. To sign out, go to Identity → Organization sign-in.",
      );
      expect(sentence?.textContent?.split(label).length).toBe(2);
      expect(input()).toBe(draft);
      expect(draft).toHaveValue(rawDraft);
      expect([draft.selectionStart, draft.selectionEnd]).toEqual([1, 6]);
      if (hasAction) expect(link).toHaveFocus();
      expect(identity).not.toHaveBeenCalled();
      expect(signOut).not.toHaveBeenCalled();
    }
    if (hasAction) {
      active = false;
      fireEvent.click(link);
      expect(identity).not.toHaveBeenCalled();
      active = true;
      fireEvent.click(link);
      expect(identity).toHaveBeenCalledExactlyOnceWith();
    }
    expect(signOut).not.toHaveBeenCalled();
    expect(session.credential().account.subject).toBe("opaque-subject");
    session.dispose();
  },
);

it("keeps checking and raw same-English diagnostics without acquiring or cancelling on locale", () => {
  const acquire = vi.fn(async () => credential),
    base = createTestSession(acquire),
    cancel = vi.fn();
  let state: LoginSnapshot = { status: "pending", checking: true };
  const listeners = new Set<() => void>();
  const session: BuilderlabSession = {
    ...base,
    cancel,
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  render(<Host session={session} available />);
  const button = screen.getByRole("button", { name: "Checking sign-in" });
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("button", {
        name: language === "ko" ? "로그인 확인 중" : "Checking sign-in",
      }),
    ).toBe(button);
    expect(screen.getByRole("status").textContent).toBe(
      language === "ko"
        ? "Builderlab 로그인 상태를 확인하는 중…"
        : "Checking your Builderlab sign-in…",
    );
    fireEvent.click(button);
    expect(cancel).not.toHaveBeenCalled();
    expect(acquire).not.toHaveBeenCalled();
  }
  act(() => {
    state = {
      status: "signed-out",
      error: "Sign in securely in your browser.",
    };
    for (const notify of listeners) notify();
  });
  act(() => setLanguage("ko"));
  expect(screen.getByRole("alert").textContent).toBe(
    "Sign in securely in your browser.",
  );
  expect(screen.getByRole("status").textContent).toBe(
    "브라우저에서 안전하게 로그인하세요.",
  );
  expect(acquire).not.toHaveBeenCalled();
  base.dispose();
});

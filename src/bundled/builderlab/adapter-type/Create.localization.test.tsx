// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../../shared/i18n";
import type { Host } from "../../../features/host/service";
import { createAgentClient } from "../agents/client";
import { createTestSession, deferred } from "../test-helpers";
import type { BuilderlabSession, Credential, LoginSnapshot } from "../session";
import {
  createCreationAction,
  createCreationFields,
  EMPTY_CREATION,
} from "./Create";
import { SignInAction } from "./SignInAction";

beforeEach(() =>
  vi.stubEnv("VITE_BUZZ_BUILDERLAB_URL", "https://builderlab.example"),
);
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const credential: Credential = {
  revision: "fixture-revision",
  account: {
    subject: "opaque-subject",
    email: "fixture@example.com",
    canUseRemoteAgents: true,
    canUseBuilderlabDecisions: false,
  },
};
const rawDraft = "Keep {raw} 한글 instructions";
const models = [
  {
    id: "opaque/{id}",
    display_name: "Choose a model",
    supported_reasoning_efforts: ["high", "xhigh"],
  },
  {
    id: "opaque-second",
    display_name: "Default",
    supported_reasoning_efforts: ["none"],
  },
];
async function fixture(signedIn = false, recommendation = false) {
  const held = deferred<void>();
  const request = vi.fn<Host["request"]>(async () => {
    await held.promise;
    return {
      status: 200,
      headers: {},
      body: JSON.stringify({
        models,
        ...(recommendation
          ? {
              recommended_selection: {
                model_id: models[0]?.id,
                reasoning_effort: "high",
              },
            }
          : {}),
      }),
    };
  });
  const acquire = vi.fn(async (_signal: AbortSignal) => credential);
  const session = createTestSession(acquire, undefined, { request });
  if (signedIn) await session.signIn();
  const client = createAgentClient(session, null),
    catalog = vi.spyOn(client, "modelCatalog");
  const { Create, CreateConfiguration } = createCreationFields(client, session),
    Action = createCreationAction(session);
  const changed = vi.fn(),
    ready = vi.fn(),
    submit = vi.fn();
  let draft: unknown = { ...EMPTY_CREATION, instructions: rawDraft };
  function Form() {
    const [config, setConfig] = useState(draft);
    draft = config;
    return (
      <form
        aria-label="Raw fixture form"
        onSubmit={(event) => {
          event.preventDefault();
          submit(config);
        }}
      >
        <Action disabled={false} />
        <CreateConfiguration
          config={config}
          onChange={(next, options) => {
            changed(next, options);
            setConfig(next);
          }}
          disabled={false}
          harnessControl={null}
          onReadyChange={ready}
        />
        <Create
          config={config}
          onChange={(next) => setConfig(next)}
          disabled={false}
        />
        <button type="submit">Raw submit</button>
      </form>
    );
  }
  const view = render(<Form />);
  return {
    session,
    acquire,
    request,
    client,
    catalog,
    held,
    changed,
    ready,
    submit,
    view,
    draft: () => draft,
  };
}
function instruction() {
  const node = screen.getByRole("textbox");
  if (!(node instanceof HTMLTextAreaElement))
    throw new Error("Missing instructions textarea");
  return node;
}

it("translates signed-out creation on the same form, disabled choices and raw draft without sign-in or catalog work", async () => {
  const h = await fixture(),
    input = instruction(),
    form = screen.getByRole("form", { name: "Raw fixture form" }),
    model = screen.getByRole("button", { name: "Model: Choose a model" }),
    thinking = screen.getByRole("combobox", { name: "Thinking" }),
    signIn = screen.getByRole("button", { name: "Sign in to Builderlab" });
  input.focus();
  input.setSelectionRange(2, 8);
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(screen.getByRole("form", { name: "Raw fixture form" })).toBe(form);
    expect(
      screen.getByRole("button", {
        name: language === "ko" ? "모델: 모델 선택" : "Model: Choose a model",
      }),
    ).toBe(model);
    expect(
      screen.getByRole("combobox", {
        name: language === "ko" ? "사고" : "Thinking",
      }),
    ).toBe(thinking);
    expect(thinking).toHaveTextContent(
      language === "ko" ? "사고 수준 선택" : "Choose thinking",
    );
    expect(
      screen.getByRole("button", {
        name:
          language === "ko" ? "Builderlab에 로그인" : "Sign in to Builderlab",
      }),
    ).toBe(signIn);
    expect(model).toBeDisabled();
    expect(thinking).toBeDisabled();
    expect(instruction()).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue(rawDraft);
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 8]);
    expect(h.acquire).not.toHaveBeenCalled();
    expect(h.request).not.toHaveBeenCalled();
    expect(h.changed).not.toHaveBeenCalled();
    expect(h.submit).not.toHaveBeenCalled();
  }
  h.session.dispose();
});

it("retains one held catalog signal and raw draft across locale, then uses exact recommended and explicit keyboard selections", async () => {
  const h = await fixture(true, true),
    input = instruction();
  const user = userEvent.setup();
  input.focus();
  input.setSelectionRange(1, 7);
  await waitFor(() => expect(h.request).toHaveBeenCalledOnce());
  const signal = h.catalog.mock.calls[0]?.[0];
  expect(signal?.aborted).toBe(false);
  const readyCalls = h.ready.mock.calls.length;
  try {
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole("status")).toHaveTextContent(
        language === "ko" ? "모델 불러오는 중…" : "Loading models…",
      );
      expect(input).toHaveFocus();
      expect([input.selectionStart, input.selectionEnd]).toEqual([1, 7]);
      expect(h.request).toHaveBeenCalledOnce();
      expect(h.catalog).toHaveBeenCalledOnce();
      expect(signal?.aborted).toBe(false);
      expect(h.ready).toHaveBeenCalledTimes(readyCalls);
      expect(h.changed).not.toHaveBeenCalled();
    }
  } finally {
    await act(async () => h.held.resolve());
  }
  await waitFor(() =>
    expect(h.changed).toHaveBeenCalledExactlyOnceWith(
      {
        instructions: rawDraft,
        modelId: "opaque/{id}",
        reasoningEffort: "high",
        subject: "opaque-subject",
      },
      { suggested: true },
    ),
  );
  expect(h.ready).toHaveBeenLastCalledWith(true);
  expect(input).toHaveValue(rawDraft);
  const trigger = screen.getByRole("button", { name: "Model: Choose a model" });
  await user.click(trigger);
  const family = await screen.findByRole("menuitem", { name: "Other" });
  family.focus();
  await user.keyboard("{ArrowRight}");
  const option = await screen.findByRole("menuitemradio", { name: "Default" });
  option.focus();
  const popup = screen.getByRole("menu", { name: "Other models" });
  act(() => setLanguage("ko"));
  expect(screen.getByRole("menu", { name: "기타 모델" })).toBe(popup);
  expect(option).toHaveFocus();
  expect(option).toHaveAccessibleName("Default");
  expect(screen.getByRole("button", { name: "모델: Choose a model" })).toBe(
    trigger,
  );
  await user.keyboard("{Enter}");
  expect(h.draft()).toEqual({
    instructions: rawDraft,
    modelId: "opaque-second",
    reasoningEffort: "",
    subject: "opaque-subject",
  });
  expect(h.changed).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole("combobox", { name: "사고" }));
  const effort = await screen.findByRole("option", { name: "None" });
  effort.focus();
  const effortPopup = screen.getByRole("listbox");
  act(() => setLanguage("en"));
  expect(screen.getByRole("listbox")).toBe(effortPopup);
  expect(effort).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(h.draft()).toEqual({
    instructions: rawDraft,
    modelId: "opaque-second",
    reasoningEffort: "none",
    subject: "opaque-subject",
  });
  expect(h.changed).toHaveBeenCalledTimes(3);
  expect(h.request).toHaveBeenCalledOnce();
  expect(h.submit).not.toHaveBeenCalled();
  fireEvent.submit(screen.getByRole("form", { name: "Raw fixture form" }));
  expect(h.submit).toHaveBeenCalledExactlyOnceWith(h.draft());
  h.session.dispose();
});

it.each(["local", "external", "empty"] as const)(
  "retains %s catalog failure provenance and original empty-error truthiness through locale and explicit retry",
  async (kind) => {
    const h = await fixture();
    h.catalog.mockRejectedValueOnce(
      kind === "local"
        ? { opaque: true }
        : new Error(kind === "empty" ? "" : "Could not load models."),
    );
    await act(async () => h.session.signIn());
    if (kind === "empty") await screen.findByText("Loading models…");
    else await screen.findByRole("alert");
    const input = instruction();
    input.focus();
    input.setSelectionRange(0, 4);
    const retries = h.catalog.mock.calls.length;
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      if (kind === "empty") {
        expect(screen.queryByRole("alert")).toBeNull();
        expect(
          screen.queryByRole("button", {
            name: /^(Retry models|모델 다시 불러오기)$/,
          }),
        ).toBeNull();
        expect(screen.getByRole("status")).toHaveTextContent(
          language === "ko" ? "모델 불러오는 중…" : "Loading models…",
        );
      } else {
        expect(screen.getByRole("alert").textContent).toBe(
          kind === "local" && language === "ko"
            ? "모델을 불러올 수 없습니다."
            : "Could not load models.",
        );
      }
      expect(input).toHaveFocus();
      expect(input).toHaveValue(rawDraft);
      expect([input.selectionStart, input.selectionEnd]).toEqual([0, 4]);
      expect(h.catalog).toHaveBeenCalledTimes(retries);
    }
    if (kind !== "empty") {
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Retry models" }));
      await waitFor(() => expect(h.request).toHaveBeenCalledOnce());
      expect(h.catalog).toHaveBeenCalledTimes(retries + 1);
      await act(async () => h.held.resolve());
      expect(h.submit).not.toHaveBeenCalled();
    }
    h.session.dispose();
  },
);

it("keeps another-account guidance live without altering raw choices or making locale a catalog identity", async () => {
  const h = await fixture(true, true);
  await act(async () => h.held.resolve());
  await waitFor(() => expect(h.ready).toHaveBeenLastCalledWith(true));
  await userEvent
    .setup()
    .click(screen.getByRole("combobox", { name: "Thinking" }));
  await userEvent
    .setup()
    .click(await screen.findByRole("option", { name: "Extra high" }));
  const original = structuredClone(h.draft());
  act(() => h.session.signOut());
  h.acquire.mockResolvedValue({
    ...credential,
    revision: "other-revision",
    account: { ...credential.account, subject: "other-subject" },
  });
  await act(async () => h.session.signIn());
  await screen.findByText(/These choices belong/);
  const requests = h.request.mock.calls.length;
  const thinking = screen.getByRole("combobox", { name: "Thinking" });
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(screen.getByRole("status")).toHaveTextContent(
      language === "ko"
        ? "이 선택 항목은 다른 Builderlab 계정의 것입니다. 모델과 사고 수준을 다시 선택해 주세요."
        : "These choices belong to another Builderlab account. Choose a model and thinking level again.",
    );
    expect(
      screen.getByRole("combobox", {
        name: language === "ko" ? "사고" : "Thinking",
      }),
    ).toBe(thinking);
    expect(thinking).toBeDisabled();
    expect(h.draft()).toEqual(original);
    expect(h.request).toHaveBeenCalledTimes(requests);
    expect(h.ready).toHaveBeenLastCalledWith(false);
  }
  h.session.dispose();
});

it("keeps automatic sign-in once, its same cancellable button and original signal across locale and rejects a late result", async () => {
  const held = deferred<Credential>(),
    acquire = vi.fn((_signal: AbortSignal) => held.promise),
    session = createTestSession(acquire);
  render(<SignInAction session={session} automatic />, { wrapper: StrictMode });
  expect(acquire).toHaveBeenCalledOnce();
  const signal = acquire.mock.calls[0]?.[0],
    button = screen.getByRole("button", { name: "Cancel sign-in" });
  button.focus();
  try {
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("button", {
          name: language === "ko" ? "로그인 취소" : "Cancel sign-in",
        }),
      ).toBe(button);
      expect(button).toHaveFocus();
      expect(button).toBeEnabled();
      expect(signal?.aborted).toBe(false);
      expect(acquire).toHaveBeenCalledOnce();
    }
    fireEvent.click(button);
    expect(signal?.aborted).toBe(true);
    expect(session.snapshot().status).toBe("signed-out");
  } finally {
    await act(async () => held.resolve(credential));
  }
  expect(session.snapshot().status).toBe("signed-out");
  expect(acquire).toHaveBeenCalledOnce();
  session.dispose();
});

it("keeps checking non-cancellable and leaves an external same-English sign-in error raw", () => {
  const acquire = vi.fn(async () => credential),
    base = createTestSession(acquire);
  let state: LoginSnapshot = { status: "pending", checking: true };
  const listeners = new Set<() => void>();
  const cancel = vi.fn();
  const session: BuilderlabSession = {
    ...base,
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    cancel,
  };
  render(<SignInAction session={session} automatic />);
  const button = screen.getByRole("button", { name: "Sign in to Builderlab" });
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(screen.getByRole("status")).toHaveTextContent(
      language === "ko"
        ? "Builderlab 로그인 상태를 확인하는 중…"
        : "Checking your Builderlab sign-in…",
    );
    expect(
      screen.getByRole("button", {
        name:
          language === "ko" ? "Builderlab에 로그인" : "Sign in to Builderlab",
      }),
    ).toBe(button);
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(cancel).not.toHaveBeenCalled();
    expect(acquire).not.toHaveBeenCalled();
  }
  act(() => {
    state = {
      status: "signed-out",
      error: "Checking your Builderlab sign-in…",
    };
    for (const notify of listeners) notify();
  });
  expect(acquire).not.toHaveBeenCalled();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("alert").textContent).toBe(
    "Checking your Builderlab sign-in…",
  );
  expect(acquire).not.toHaveBeenCalled();
  base.dispose();
});

it("translates the explicit retry control while retaining its cancel path and makes only the requested sign-in", async () => {
  const held = deferred<Credential>(),
    acquire = vi.fn((_signal: AbortSignal) => held.promise),
    session = createTestSession(acquire),
    cancel = vi.fn();
  const view = render(
    <SignInAction session={session} retry={{ waiting: true, cancel }} />,
  );
  const button = screen.getByRole("button", { name: "Cancel sign-in" });
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "로그인 취소" })).toBe(button);
  fireEvent.click(button);
  expect(cancel).toHaveBeenCalledExactlyOnceWith();
  expect(acquire).not.toHaveBeenCalled();
  view.rerender(
    <SignInAction session={session} retry={{ waiting: false, cancel }} />,
  );
  const retry = screen.getByRole("button", { name: "다시 시도" });
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "Retry" })).toBe(retry);
  fireEvent.click(retry);
  expect(acquire).toHaveBeenCalledOnce();
  await act(async () => held.resolve(credential));
  await waitFor(() => expect(session.snapshot().status).toBe("signed-in"));
  expect(cancel).toHaveBeenCalledOnce();
  session.dispose();
});

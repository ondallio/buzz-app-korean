// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { Context } from "@deepseek-ai/cordis";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState, useSyncExternalStore } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { registerNavigationShortcuts } from "../../app/shortcuts";
import type {
  AgentProviderSnapshot,
  Agents,
  RegisteredAgentType,
} from "../../features/agents/service";
import {
  createNavigationController,
  type Navigation,
} from "../../features/navigation/controller";
import { createMemoryHistory } from "../../features/navigation/history";
import type { PageNavigation } from "../../features/navigation/service";
import { ShortcutsService } from "../../features/shortcuts/service";
import { AgentDefaults } from "./AgentDefaults";
import { setLanguage } from "../../shared/i18n";
import { ProviderDialogActions } from "../../features/agents/ProviderDialogActions";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
});

function fixture(initial: AgentProviderSnapshot = { readiness: "ready" }) {
  let state = initial;
  const listeners = new Set<() => void>();
  const check = vi.fn();
  const type = {
    key: "local/echo",
    pluginId: "local",
    revision: "1",
    id: "echo",
    title: "Echo",
    defaults: () => ({ config: {} }),
    provider: {
      snapshot: () => state,
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      check,
      DialogBody: () => <p>Echo controls</p>,
    },
  } satisfies RegisteredAgentType;
  const types = [type];
  const agents = {
    types: () => types,
    subscribe: () => () => {},
  } as unknown as Agents;
  const update = (next: AgentProviderSnapshot) =>
    act(() => {
      state = next;
      for (const listener of listeners) listener();
    });
  return { agents, update, check, type };
}

/** The host's history shortcuts, driving a real memory-history controller. */
async function withHistoryShortcuts(
  run: (navigation: Navigation) => Promise<void>,
) {
  const ctx = new Context();
  ctx.provide("pluginStatus", {
    isActive: () => true,
    subscribe: () => () => {},
  });
  const shortcuts = new ShortcutsService(ctx, window);
  const controller = createNavigationController(createMemoryHistory());
  const remove = registerNavigationShortcuts(shortcuts, controller.navigation);
  try {
    await run(controller.navigation);
  } finally {
    remove();
    controller.dispose();
    await ctx.fiber.dispose();
  }
}

/** Agent setup as Settings routes it: each provider opens as a nested visit. */
function RoutedDefaults({
  agents,
  navigation,
}: {
  agents: Agents;
  navigation: Navigation;
}) {
  const { target } = useSyncExternalStore(
    navigation.subscribe,
    navigation.snapshot,
  ).entry;
  const page = {
    target,
    signal: new AbortController().signal,
  } as unknown as PageNavigation;
  return (
    <AgentDefaults
      agents={agents}
      navigation={page}
      onProvider={(provider) => {
        if (target.kind === "settings" && provider)
          void navigation.open({ ...target, provider });
      }}
    />
  );
}

it("keeps an unrouted provider a local dialog that Back does not close", async () => {
  const { agents } = fixture();
  render(<AgentDefaults agents={agents} />);
  fireEvent.click(screen.getByRole("button", { name: "Echo, ready" }));
  const dialog = await screen.findByRole("dialog", { name: "Echo" });
  expect(dialog).not.toHaveAttribute("data-navigation-visit");
  await withHistoryShortcuts(async (navigation) => {
    const behind = { version: 1, kind: "settings" } as const;
    void navigation.open({ version: 1, kind: "home" });
    void navigation.open(behind);
    await vi.waitFor(() => expect(navigation.snapshot().canGoBack).toBe(true));
    // Not prevented: the reserved chord stays inert over a plain modal.
    expect(fireEvent.keyDown(dialog, { key: "[", ctrlKey: true })).toBe(true);
    await act(async () => {});
    expect(navigation.snapshot().attempt.entry.target).toEqual(behind);
  });
});

it("lets Back hide a routed provider's blocking work and Forward restore it", async () => {
  const { agents, update, check } = fixture();
  await withHistoryShortcuts(async (navigation) => {
    const agentSetup = {
      version: 1,
      kind: "settings",
      section: "agents",
    } as const;
    void navigation.open({ version: 1, kind: "home" });
    void navigation.open(agentSetup);
    await vi.waitFor(() => expect(navigation.snapshot().canGoBack).toBe(true));
    render(<RoutedDefaults agents={agents} navigation={navigation} />);
    fireEvent.click(screen.getByRole("button", { name: "Echo, ready" }));
    const dialog = await screen.findByRole("dialog", { name: "Echo" });
    // Install or sign-in starts from the open controls.
    update({ readiness: "ready", blocking: true });
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(dialog).toHaveAttribute("data-navigation-visit");
    const checks = check.mock.calls.length;
    expect(fireEvent.keyDown(dialog, { key: "[", ctrlKey: true })).toBe(false);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Echo" })).toBeNull(),
    );
    expect(navigation.snapshot().entry.target).toEqual(agentSetup);
    // The work continued in the provider, so its controls return still guarded
    // and nothing asked the provider to start over.
    expect(fireEvent.keyDown(document.body, { key: "]", ctrlKey: true })).toBe(
      false,
    );
    expect(await screen.findByRole("dialog", { name: "Echo" })).toHaveAttribute(
      "data-navigation-visit",
    );
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(check).toHaveBeenCalledTimes(checks);
  });
});

it("keeps status-only attention noninteractive and restores the default setup action", async () => {
  const { agents, update } = fixture({
    readiness: "attention",
    attentionLabel: null,
    attentionDescription: "Unavailable for this account",
  });
  render(<AgentDefaults agents={agents} />);
  expect(screen.getByText("Unavailable for this account")).toBeVisible();
  expect(screen.queryByRole("button")).toBeNull();
  update({ readiness: "attention" });
  expect(screen.queryByText("Unavailable for this account")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Set up Echo, attention" }),
  );
  expect(await screen.findByRole("dialog", { name: "Echo" })).toBeVisible();
});

it.each(["Escape", "Close"])(
  "returns focus to the status after in-dialog sign-in without access and %s",
  async (dismissal) => {
    const { agents, update, type } = fixture({
      readiness: "attention",
      attentionLabel: "Log in to Echo",
    });
    type.provider.DialogBody = () => (
      <button
        type="button"
        onClick={() =>
          update({
            readiness: "attention",
            attentionLabel: null,
            attentionDescription: "Unavailable for this account",
          })
        }
      >
        Sign in
      </button>
    );
    const user = userEvent.setup();
    render(<AgentDefaults agents={agents} />);
    await user.click(
      screen.getByRole("button", { name: "Log in to Echo, attention" }),
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    const status = screen.getByText("Unavailable for this account");
    if (dismissal === "Escape") await user.keyboard("{Escape}");
    else await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(status).toHaveFocus());
    expect(status).toHaveAttribute("tabindex", "-1");
    expect(screen.queryByRole("button")).toBeNull();
  },
);

it("keeps the ready provider control and pending readiness check through live locale changes", async () => {
  const { agents, check } = fixture();
  let finish: () => void = () => {
    throw new Error("Missing check gate");
  };
  check.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(<AgentDefaults agents={agents} />);
  const control = screen.getByRole("button", { name: "Echo, ready" });
  control.focus();
  try {
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("button", {
          name: language === "ko" ? "Echo, 준비됨" : "Echo, ready",
        }),
      ).toBe(control);
      expect(control).toHaveTextContent(
        language === "ko" ? "설정 편집" : "Edit configuration",
      );
      expect(
        screen.getByRole("heading", {
          name: language === "ko" ? "하네스 기본값" : "Harness defaults",
        }),
      ).toBeVisible();
      expect(control).toHaveFocus();
      expect(control).toBeEnabled();
      expect(check).toHaveBeenCalledOnce();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
  } finally {
    await act(async () => finish());
  }
});

it.each(["checking", "attention"] as const)(
  "keeps %s raw readiness and contribution captions without rechecking or dispatching an action on locale",
  (readiness) => {
    const { agents, type, check } = fixture({
      readiness,
      attentionLabel: "Edit configuration",
    });
    const attention = vi.fn();
    Object.assign(type.provider, { attentionAction: attention });
    render(<AgentDefaults agents={agents} />);
    const control = screen.getByRole("button", {
      name:
        readiness === "checking"
          ? "Echo, checking"
          : "Edit configuration, attention",
    });
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      const expected =
        readiness === "checking"
          ? language === "ko"
            ? "Echo, 확인 중"
            : "Echo, checking"
          : language === "ko"
            ? "Edit configuration, 확인 필요"
            : "Edit configuration, attention";
      expect(screen.getByRole("button", { name: expected })).toBe(control);
      expect(control).toHaveTextContent(
        readiness === "attention"
          ? "Edit configuration"
          : language === "ko"
            ? "확인 중…"
            : "Checking…",
      );
      expect(control).toHaveProperty("disabled", readiness === "checking");
      expect(type.provider.snapshot().readiness).toBe(readiness);
      expect(check).toHaveBeenCalledOnce();
      expect(attention).not.toHaveBeenCalled();
    }
    if (readiness === "attention") {
      fireEvent.click(control);
      expect(attention).toHaveBeenCalledExactlyOnceWith();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
  },
);

it.each([null, "", undefined])(
  "preserves the attention label %s distinction and raw description tokens",
  (attentionLabel) => {
    const raw = "Default model {provider} \\q 한글";
    const { agents, check } = fixture({
      readiness: "attention",
      attentionDescription: raw,
      ...(attentionLabel === undefined ? {} : { attentionLabel }),
    });
    render(<AgentDefaults agents={agents} />);
    const description = screen.getByText(raw);
    const control = screen.queryByRole("button");
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByText(raw)).toBe(description);
      expect(description.textContent).toBe(raw);
      if (attentionLabel === null)
        expect(screen.queryByRole("button")).toBeNull();
      else {
        const label =
          attentionLabel === ""
            ? ""
            : language === "ko"
              ? "Echo 설정"
              : "Set up Echo";
        expect(
          screen.getByRole("button", {
            name: `${label}, ${language === "ko" ? "확인 필요" : "attention"}`,
          }),
        ).toBe(control);
        expect(control?.textContent).toBe(label);
      }
      expect(check).toHaveBeenCalledOnce();
    }
  },
);

it("retains a focused contribution default control and draft while rechecking and translating only the host caption", () => {
  const { agents, type, update, check } = fixture();
  function RawDefault() {
    const [draft, setDraft] = useState("Edit configuration {label} 한글");
    return (
      <input
        aria-label="Raw default"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    );
  }
  Object.assign(type.provider, { DefaultControl: RawDefault });
  render(<AgentDefaults agents={agents} />);
  const control = screen.getByRole("textbox", { name: "Raw default" });
  expect(control instanceof HTMLInputElement).toBe(true);
  if (!(control instanceof HTMLInputElement)) throw new Error("Missing input");
  fireEvent.change(control, {
    target: { value: "Checking… {label} \\q 한글" },
  });
  control.focus();
  control.setSelectionRange(2, 8);
  update({ readiness: "checking" });
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByText(language === "ko" ? "기본 모델" : "Default model"),
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Raw default" })).toBe(control);
    expect(control).toHaveValue("Checking… {label} \\q 한글");
    expect(control).toHaveFocus();
    expect(control.selectionStart).toBe(2);
    expect(control.selectionEnd).toBe(8);
    expect(type.provider.snapshot().readiness).toBe("checking");
    expect(check).toHaveBeenCalledOnce();
  }
  update({ readiness: "ready" });
  expect(screen.getByRole("textbox", { name: "Raw default" })).toBe(control);
});

it("keeps the raw provider title, real footer portal and focused body draft while blocking work continues across locales", async () => {
  const { agents, type, update, check } = fixture();
  type.title = "Edit configuration";
  function RawBody() {
    const [draft, setDraft] = useState("Checking… {label} 한글");
    return (
      <>
        <input
          aria-label="Harness defaults"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <p role="alert">Provider controls are unavailable.</p>
        <ProviderDialogActions>
          <button type="button">Raw footer action</button>
        </ProviderDialogActions>
      </>
    );
  }
  type.provider.DialogBody = RawBody;
  render(<AgentDefaults agents={agents} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Edit configuration, ready" }),
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Edit configuration",
  });
  const field = screen.getByRole("textbox", { name: "Harness defaults" });
  if (!(field instanceof HTMLInputElement))
    throw new Error("Missing body input");
  const footer = screen.getByRole("button", { name: "Raw footer action" });
  await waitFor(() =>
    expect(footer.closest(".buzz-dialog-actions")).not.toBeNull(),
  );
  field.focus();
  field.setSelectionRange(1, 6);
  update({ readiness: "ready", blocking: true });
  const close = screen.getByRole("button", { name: "Close" });
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(screen.getByRole("dialog", { name: "Edit configuration" })).toBe(
      dialog,
    );
    expect(screen.getByRole("textbox", { name: "Harness defaults" })).toBe(
      field,
    );
    expect(screen.getByRole("button", { name: "Raw footer action" })).toBe(
      footer,
    );
    expect(field).toHaveFocus();
    expect(field).toHaveValue("Checking… {label} 한글");
    expect(field.selectionStart).toBe(1);
    expect(field.selectionEnd).toBe(6);
    expect(screen.getByRole("alert").textContent).toBe(
      "Provider controls are unavailable.",
    );
    expect(close).toBeDisabled();
    expect(check).toHaveBeenCalledOnce();
  }
  update({ readiness: "ready" });
  expect(close).toBeEnabled();
});

it("translates a retained provider-dialog failure without retrying its failed contribution or altering its raw title", async () => {
  const { agents, type, check } = fixture();
  const body = vi.fn(() => {
    throw new Error("Opaque contribution failure");
  });
  type.provider.DialogBody = body;
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(<AgentDefaults agents={agents} />);
  const opener = screen.getByRole("button", { name: "Echo, ready" });
  fireEvent.click(opener);
  const dialog = await screen.findByRole("dialog", { name: "Echo" });
  const alert = screen.getByRole("alert"),
    attempts = body.mock.calls.length;
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(screen.getByRole("dialog", { name: "Echo" })).toBe(dialog);
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent(
      language === "ko"
        ? "공급자 설정을 사용할 수 없습니다."
        : "Provider controls are unavailable.",
    );
    expect(body).toHaveBeenCalledTimes(attempts);
    expect(check).toHaveBeenCalledOnce();
  }
});

it("translates a retained unavailable-defaults boundary and preserves a provider name that matches owned English", () => {
  const { agents, type, check } = fixture();
  type.title = "Harness defaults";
  const snapshot = vi
    .spyOn(type.provider, "snapshot")
    .mockImplementation(() => {
      throw new Error("Opaque snapshot failure");
    });
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(<AgentDefaults agents={agents} />);
  const control = screen.getByRole("button", {
      name: "Harness defaults, unavailable",
    }),
    attempts = snapshot.mock.calls.length;
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("button", {
        name:
          language === "ko"
            ? "Harness defaults, 사용할 수 없음"
            : "Harness defaults, unavailable",
      }),
    ).toBe(control);
    expect(control).toHaveTextContent(
      language === "ko" ? "사용할 수 없음" : "Unavailable",
    );
    expect(control).toBeDisabled();
    expect(snapshot).toHaveBeenCalledTimes(attempts);
    expect(check).toHaveBeenCalledOnce();
  }
});

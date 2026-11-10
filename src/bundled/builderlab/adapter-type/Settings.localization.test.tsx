// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { stubAvatarBrowserApis } from "../../../features/agents/avatar-testing";
import type {
  Agent,
  Agents,
  RegisteredAgentType,
} from "../../../features/agents/service";
import type { Host } from "../../../features/host/service";
import { AgentDetails } from "../../agents/AgentDetails";
import { Button } from "../../../shared/design-system/ui/Button";
import { setLanguage } from "../../../shared/i18n";
import { createAgentClient, type RemoteAgent } from "../agents/client";
import { createTestSession, deferred } from "../test-helpers";
import { createSettingsTab } from "./Instructions";
import { ModelSettings } from "./ModelSettings";
import { SettingsErrorSheet, AccountRecoverySheet } from "./SignInFooter";
import { ToastProvider } from "../../../shared/design-system/ui/Toast";

stubAvatarBrowserApis();
beforeEach(() => {
  setLanguage("en");
  vi.stubEnv("VITE_BUZZ_BUILDERLAB_URL", "https://builderlab.example");
});
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const pubkey = "ab".repeat(32);
const credential = {
  revision: "fixture-only",
  account: {
    subject: "raw-subject",
    email: "Raw {email} 한글@example.test",
    canUseRemoteAgents: true,
    canUseBuilderlabDecisions: false,
  },
};
const agent: Agent = {
  key: pubkey,
  pubkey,
  name: "Raw {name} 한글",
  type: "block.builderlab/builderlab",
  owner: "ef".repeat(32),
  relay: "wss://community.example",
  place: "hosted",
  config: {},
  attention: {},
  skipped: {},
  timers: {},
  attentionEnabled: true,
};
async function fixture() {
  const request = vi.fn<Host["request"]>();
  const acquire = vi.fn(async () => credential);
  const session = createTestSession(acquire, undefined, { request });
  await session.signIn();
  const client = createAgentClient(session);
  const Settings = createSettingsTab(client, session);
  const type: RegisteredAgentType = {
    key: agent.type,
    pluginId: "block.builderlab",
    revision: "fixture",
    id: "builderlab",
    title: "Builderlab",
    defaults: () => ({ config: {} }),
    tabs: [
      {
        id: "settings",
        title: "Identity",
        role: "settings",
        component: Settings,
      },
    ],
  };
  const agents = {
    subscribe: () => () => {},
    snapshot: () => ({ agents: [agent] }),
    configHistory: () => undefined,
    agentSync: () => undefined,
    addedTabs: () => [],
    memberships: () => [],
  } as unknown as Agents;
  return { request, acquire, session, client, Settings, type, agents };
}

it("keeps the actual AgentDetails hosted settings-error region, retry focus and read count across EN→KO→EN", async () => {
  const h = await fixture();
  const held = deferred<readonly RemoteAgent[]>();
  const list = vi.spyOn(h.client, "list").mockReturnValueOnce(held.promise);
  const view = render(
    <AgentDetails
      agents={h.agents}
      agent={agent}
      type={h.type}
      types={[h.type]}
      channels={[]}
      memories={undefined}
      onRemoved={vi.fn()}
      messageAction={() => <Button>Message</Button>}
    />,
  );
  try {
    await waitFor(() => expect(list).toHaveBeenCalledOnce());
    await act(async () => held.reject(new Error("Raw {error} 한글")));
    const sheet = await screen.findByRole("region", {
      name: "Couldn’t load settings",
    });
    const action = within(sheet).getByRole("button", { name: "Retry" });
    const headingId = sheet.getAttribute("aria-labelledby");
    const footer = sheet.parentElement?.parentElement;
    expect(footer).toBeInTheDocument();
    expect(footer?.closest("form")).toBeNull();
    action.focus();
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      const title =
        language === "ko"
          ? "설정을 불러올 수 없습니다"
          : "Couldn’t load settings";
      expect(screen.getByRole("region", { name: title })).toBe(sheet);
      expect(sheet.getAttribute("aria-labelledby")).toBe(headingId);
      expect(
        within(sheet).getByRole("button", {
          name: language === "ko" ? "다시 시도" : "Retry",
        }),
      ).toBe(action);
      expect(action).toHaveFocus();
      expect(within(sheet).getByRole("alert").textContent).toBe(
        "Raw {error} 한글",
      );
      expect(list).toHaveBeenCalledOnce();
      expect(h.acquire).toHaveBeenCalledOnce();
      expect(h.request).not.toHaveBeenCalled();
    }
    const retried = deferred<readonly RemoteAgent[]>();
    list.mockReturnValueOnce(retried.promise);
    fireEvent.click(action);
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(footer).toBeInTheDocument();
    await act(async () => retried.reject(new Error("Raw retry")));
    expect(
      await screen.findByRole("region", { name: "Couldn’t load settings" }),
    ).toHaveTextContent("Raw retry");
  } finally {
    view.unmount();
    await act(async () => held.resolve([]));
    h.session.dispose();
  }
});

const remote: RemoteAgent = {
  id: "raw-agent",
  name: "Raw {name} 한글",
  pubkey,
  status: "Active",
  modelId: "raw-model",
  reasoningEffort: "high",
  modelSelectionStatus: "valid",
  instructions: "Raw {instructions} 한글",
};

it.each([
  "missing",
  "inactive",
  "external-error",
  "external-string",
  "empty-error",
  "non-error",
] as const)(
  "retains %s provenance through the actual settings loader and locale changes",
  async (kind) => {
    const h = await fixture();
    const list = vi.spyOn(h.client, "list");
    const english =
      kind === "missing" ||
      kind === "external-error" ||
      kind === "external-string"
        ? "Agent not found in this Builderlab account."
        : kind === "inactive"
          ? "Only Active agents can have their settings edited."
          : kind === "empty-error"
            ? ""
            : "Could not load model settings.";
    const korean =
      kind === "missing"
        ? "이 Builderlab 계정에서 에이전트를 찾을 수 없습니다."
        : kind === "inactive"
          ? "활성 상태인 에이전트의 설정만 편집할 수 있습니다."
          : kind === "non-error"
            ? "모델 설정을 불러올 수 없습니다."
            : english;
    if (kind === "missing") list.mockResolvedValue([]);
    else if (kind === "inactive")
      list.mockResolvedValue([{ ...remote, status: "Revoked" }]);
    else
      list.mockRejectedValue(
        kind === "external-error"
          ? new Error(english)
          : kind === "empty-error"
            ? new Error("")
            : kind === "external-string"
              ? english
              : {},
      );
    const view = render(
      <h.Settings agent={agent} save={vi.fn()} settingsSection="identity" />,
    );
    try {
      const region = await screen.findByRole("region", {
        name: "Couldn’t load settings",
      });
      const alert = within(region).getByRole("alert");
      expect(alert.textContent).toBe(english);
      const button = within(region).getByRole("button", { name: "Retry" });
      button.focus();
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        expect(within(region).getByRole("alert")).toBe(alert);
        expect(alert.textContent).toBe(language === "ko" ? korean : english);
        expect(
          screen.getByRole("region", {
            name:
              language === "ko"
                ? "설정을 불러올 수 없습니다"
                : "Couldn’t load settings",
          }),
        ).toBe(region);
        expect(button).toHaveFocus();
        expect(list).toHaveBeenCalledOnce();
        expect(h.request).not.toHaveBeenCalled();
      }
    } finally {
      view.unmount();
      h.session.dispose();
    }
  },
);

it("keeps a canonical sheet identity on display changes and replaces it only for a real category transition", async () => {
  const run = vi.fn();
  const view = render(
    <SettingsErrorSheet
      active
      title="Couldn’t load settings"
      titleLabel="설정을 불러올 수 없습니다"
      message="Raw reason"
      action={{ label: "Retry", run }}
    />,
  );
  const first = screen.getByRole("region", {
    name: "설정을 불러올 수 없습니다",
  });
  const button = within(first).getByRole("button", { name: "Retry" });
  button.focus();
  const latest = vi.fn();
  view.rerender(
    <SettingsErrorSheet
      active
      title="Couldn’t load settings"
      titleLabel="Couldn’t load settings"
      message="Raw reason"
      action={{ label: "Retry", run: latest }}
    />,
  );
  expect(screen.getByRole("region", { name: "Couldn’t load settings" })).toBe(
    first,
  );
  expect(button).toHaveFocus();
  fireEvent.click(button);
  expect(latest).toHaveBeenCalledOnce();
  expect(run).not.toHaveBeenCalled();
  view.rerender(
    <SettingsErrorSheet
      active
      title="Couldn’t save changes"
      titleLabel="변경 사항을 저장할 수 없습니다"
      message="Raw reason"
      action={{ label: "Try again", run: latest }}
    />,
  );
  const second = await screen.findByRole("region", {
    name: "변경 사항을 저장할 수 없습니다",
  });
  expect(second).not.toBe(first);
  expect(second.getAttribute("aria-labelledby")).not.toBe(
    first.getAttribute("aria-labelledby"),
  );
});

it.each([undefined, "", "This account can’t access Builderlab agents."])(
  "translates only the owned account fallback and preserves explicit detail (%s)",
  async (detail) => {
    const h = await fixture();
    const openIdentity = vi.fn();
    const view = render(
      <AccountRecoverySheet
        session={h.session}
        active
        mismatch={false}
        {...(detail === undefined ? {} : { detail })}
        openIdentity={openIdentity}
      />,
    );
    try {
      const sheet = screen.getByRole("region", {
        name: "Try another Builderlab account",
      });
      const button = within(sheet).getByRole("button", {
        name: "Identity → Organization sign-in",
      });
      const signOut = vi.spyOn(h.session, "signOut");
      button.focus();
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        expect(
          screen.getByRole("region", {
            name:
              language === "ko"
                ? "다른 Builderlab 계정으로 시도하세요"
                : "Try another Builderlab account",
          }),
        ).toBe(sheet);
        expect(within(sheet).getByRole("alert").textContent).toBe(
          detail ??
            (language === "ko"
              ? "이 계정은 Builderlab 에이전트에 접근할 수 없습니다."
              : "This account can’t access Builderlab agents."),
        );
        expect(
          within(sheet).getByRole("button", {
            name:
              language === "ko"
                ? "신원 → 조직 로그인"
                : "Identity → Organization sign-in",
          }),
        ).toBe(button);
        expect(button).toHaveFocus();
        expect(openIdentity).not.toHaveBeenCalled();
        expect(signOut).not.toHaveBeenCalled();
      }
      fireEvent.click(button);
      expect(openIdentity).toHaveBeenCalledOnce();
      expect(signOut).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      h.session.dispose();
    }
  },
);

it("retains raw account email, broker URL and one original switch action through locale", async () => {
  vi.stubEnv("VITE_BUZZ_LIVE", "1");
  const h = await fixture(),
    switched = vi.fn();
  const signOut = vi.spyOn(h.session, "signOut");
  render(
    <AccountRecoverySheet
      session={h.session}
      active
      mismatch
      email={credential.account.email}
      onSwitchAccount={switched}
    />,
  );
  const sheet = screen.getByRole("region", {
    name: "Different account needed",
  });
  const action = within(sheet).getByRole("button", {
    name: "Use another account",
  });
  expect(action).toHaveAttribute("href", "https://builderlab.example/logout");
  action.focus();
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("region", {
        name:
          language === "ko"
            ? "다른 계정이 필요합니다"
            : "Different account needed",
      }),
    ).toBe(sheet);
    expect(within(sheet).getByRole("alert").textContent).toBe(
      language === "ko"
        ? `이 에이전트를 편집하려면 ${credential.account.email} 계정으로 로그인하세요.`
        : `Sign in as ${credential.account.email} to edit this agent.`,
    );
    expect(action).toHaveFocus();
    expect(action).toHaveAttribute("href", "https://builderlab.example/logout");
    expect(signOut).not.toHaveBeenCalled();
    expect(switched).not.toHaveBeenCalled();
  }
  fireEvent.click(action);
  expect(switched).toHaveBeenCalledOnce();
  expect(signOut).toHaveBeenCalledOnce();
  h.session.dispose();
});

it.each([
  "setup-required",
  "model-unavailable",
  "effort-unsupported",
  "unknown",
] as const)(
  "translates the complete %s guidance without translating saved model/effort values or resetting the draft",
  async (status) => {
    const h = await fixture();
    const catalog = vi.spyOn(h.client, "modelCatalog").mockResolvedValue({
      models: [
        {
          id: "raw-model",
          displayName: "Choose a model",
          supportedReasoningEfforts: ["high"],
        },
      ],
    });
    const view = render(
      <ModelSettings
        client={h.client}
        session={h.session}
        settings={{
          agent: { ...remote, modelSelectionStatus: status },
          subject: credential.account.subject,
        }}
      />,
    );
    try {
      const field = screen.getByRole("textbox", { name: "Instructions" });
      await waitFor(() =>
        expect(
          screen.getByRole("combobox", { name: "Thinking" }),
        ).toBeEnabled(),
      );
      fireEvent.change(field, { target: { value: "Unchanged {draft} 한글" } });
      field.focus();
      if (!(field instanceof HTMLTextAreaElement))
        throw new Error("Missing instructions");
      field.setSelectionRange(3, 11);
      const clauses = {
        "setup-required": [
          "Choose a model and thinking level to finish setup.",
          "설정을 완료하려면 모델과 사고 수준을 선택하세요.",
        ],
        "model-unavailable": [
          "The saved model is no longer available. Choose another model and thinking level.",
          "저장된 모델을 더 이상 사용할 수 없습니다. 다른 모델과 사고 수준을 선택하세요.",
        ],
        "effort-unsupported": [
          "The saved thinking level is no longer supported. Choose a supported level.",
          "저장된 사고 수준이 더 이상 지원되지 않습니다. 지원되는 수준을 선택하세요.",
        ],
        unknown: [
          "The server has not confirmed the saved model selection. Choose a model and thinking level.",
          "서버에서 저장된 모델 선택을 확인하지 않았습니다. 모델과 사고 수준을 선택하세요.",
        ],
      };
      const paragraph = screen.getByText(
        `${clauses[status][0]} Saved model: Choose a model. Saved thinking: High.`,
      );
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        expect(
          screen.getByRole("textbox", {
            name: language === "ko" ? "지침" : "Instructions",
          }),
        ).toBe(field);
        expect(field).toHaveValue("Unchanged {draft} 한글");
        expect([field.selectionStart, field.selectionEnd]).toEqual([3, 11]);
        expect(field).toHaveFocus();
        expect(paragraph.textContent).toBe(
          language === "ko"
            ? `${clauses[status][1]} 저장된 모델: Choose a model. 저장된 사고 수준: High.`
            : `${clauses[status][0]} Saved model: Choose a model. Saved thinking: High.`,
        );
        expect(catalog).toHaveBeenCalledOnce();
        expect(h.request).not.toHaveBeenCalled();
      }
    } finally {
      view.unmount();
      h.session.dispose();
    }
  },
);

it("keeps the raw pending model-save payload and retained success toast live after the editor unmounts", async () => {
  const h = await fixture();
  const update = deferred<Awaited<ReturnType<Host["request"]>>>();
  h.request.mockImplementation(async ({ url }) => {
    if (url.endsWith("/get-model-catalog"))
      return {
        status: 200,
        headers: {},
        body: JSON.stringify({
          models: [
            {
              id: "raw-model",
              display_name: "Raw Model 한글",
              supported_reasoning_efforts: ["high"],
            },
          ],
        }),
      };
    if (url.endsWith("/update-agent")) return update.promise;
    return {
      status: 200,
      headers: {},
      body: JSON.stringify({
        status: 1,
        agents: [
          {
            agent_id: remote.id,
            agent_name: remote.name,
            agent_pubkey: pubkey,
            status: 2,
            model_id: "raw-model",
            reasoning_effort: "high",
            model_selection_status: 1,
          },
        ],
      }),
    };
  });
  const settings = {
    agent: { ...remote, modelSelectionStatus: "setup-required" as const },
    subject: credential.account.subject,
  };
  const view = render(
    <ToastProvider>
      <ModelSettings
        client={h.client}
        session={h.session}
        settings={settings}
      />
    </ToastProvider>,
  );
  try {
    const field = screen.getByRole("textbox", { name: "Instructions" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled(),
    );
    const form = field.closest("form");
    if (!form || !(field instanceof HTMLTextAreaElement))
      throw new Error("Missing save form");
    field.focus();
    field.setSelectionRange(2, 10);
    fireEvent.submit(form);
    await waitFor(() =>
      expect(
        h.request.mock.calls.filter(([r]) => r.url.endsWith("/update-agent")),
      ).toHaveLength(1),
    );
    const count = h.request.mock.calls.length;
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("textbox", {
          name: language === "ko" ? "지침" : "Instructions",
        }),
      ).toBe(field);
      expect(field).toHaveValue(remote.instructions);
      expect([field.selectionStart, field.selectionEnd]).toEqual([2, 10]);
      expect(h.request).toHaveBeenCalledTimes(count);
    }
    const submitted = h.request.mock.calls.find(([r]) =>
      r.url.endsWith("/update-agent"),
    )?.[0];
    expect(JSON.parse(submitted?.body ?? "{}")).toEqual({
      agent_pubkey: pubkey,
      model_id: "raw-model",
      reasoning_effort: "high",
    });
    await act(async () =>
      update.resolve({ status: 200, headers: {}, body: "{}" }),
    );
    const toast = await screen.findByRole("dialog", {
      name: "Model preferences saved",
    });
    view.rerender(<ToastProvider>{null}</ToastProvider>);
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("dialog", {
          name:
            language === "ko"
              ? "모델 기본 설정을 저장했습니다"
              : "Model preferences saved",
        }),
      ).toBe(toast);
    }
    expect(
      h.request.mock.calls.filter(([r]) => r.url.endsWith("/update-agent")),
    ).toHaveLength(1);
    expect(h.acquire).toHaveBeenCalledOnce();
  } finally {
    await act(async () =>
      update.resolve({ status: 200, headers: {}, body: "{}" }),
    );
    view.unmount();
    h.session.dispose();
  }
});

it("translates the runtime/workspace/session prose as whole messages while retaining the Builderlab link and settings content", async () => {
  const h = await fixture();
  render(
    <h.Settings
      agent={agent}
      save={vi.fn()}
      settingsSection="runtime"
      settingsContent={
        <input aria-label="Host content" defaultValue="Raw {content} 한글" />
      }
    />,
  );
  const link = screen.getByRole("link", { name: "Builderlab" });
  const input = screen.getByRole("textbox", { name: "Host content" });
  input.focus();
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByText(language === "ko" ? "런타임" : "Runtime"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        language === "ko" ? "스레드마다 세션 하나" : "One session per thread",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(language === "ko" ? "작업 공간" : "Workspace"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        language === "ko"
          ? "원격 런타임은 기본적으로 이 작업 공간의 다른 에이전트와 공유됩니다. 이 컴퓨터가 꺼져 있어도 계속 작동하며 휴대전화로 대화할 수 있습니다. 이 컴퓨터의 파일은 열 수 없습니다."
          : "Remote runtime shared with your other agents in this workspace by default. Keeps working while this computer is off, and you can chat from your phone. It can’t open files on this computer.",
      ),
    ).toBeInTheDocument();
    expect(link.parentElement?.textContent).toBe(
      language === "ko"
        ? "Builderlab에서 호스팅하고 관리합니다."
        : "Hosted and managed by Builderlab.",
    );
    expect(link).toHaveAttribute("href", "https://builderlab.example");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(input).toHaveFocus();
    expect(input).toHaveValue("Raw {content} 한글");
    expect(h.request).not.toHaveBeenCalled();
  }
  h.session.dispose();
});

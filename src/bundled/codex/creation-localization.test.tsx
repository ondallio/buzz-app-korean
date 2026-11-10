// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Agent } from "../../features/agents/service";
import type { AgentExecutionBinding } from "../../features/agents/execution";
import { setLanguage } from "../../shared/i18n";
import { CodexProvider, createTabs } from "./tabs";
import { defaults, type Config, type Model } from "./config";
import { CodexRuntime } from "./runtime";
import { CodexSetup } from "./setup";
import type { Spawn, Wire } from "./rpc";

beforeEach(() => {
  localStorage.clear();
  setLanguage("en");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.unstubAllGlobals();
});

function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error("Uninitialized fixture gate");
  };
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture(
  models: Model[] = [
    {
      model: "raw-model",
      displayName: "Codex default",
      description: "Raw description {name}",
      isDefault: true,
      defaultReasoningEffort: "low",
      supportedReasoningEfforts: ["low", "high"].map((reasoningEffort) => ({
        reasoningEffort,
        description: "Raw effort description",
      })),
    },
  ],
  control: {
    modelGate?: Promise<void>;
    failure?: string;
    binding?: () => Promise<AgentExecutionBinding | undefined>;
  } = {},
) {
  const modelRequested = deferred<void>();
  const requests: Wire[] = [];
  const spawn = vi.fn<Spawn>(async (id, options) => {
    if (id !== "app-server")
      throw new Error(`Unexpected fixture process: ${id}`);
    const exited = deferred<number | null>();
    return {
      write: async (text) => {
        const wire: Wire = JSON.parse(text);
        if (wire.id == null) return;
        requests.push(wire);
        if (wire.method === "model/list") {
          modelRequested.resolve();
          await control.modelGate;
          if (control.failure !== undefined) {
            options?.onStdout?.(
              `${JSON.stringify({ id: wire.id, error: { code: -1, message: control.failure } })}\n`,
            );
            return;
          }
        }
        const result =
          wire.method === "account/read"
            ? { account: null, requiresOpenaiAuth: false }
            : wire.method === "model/list"
              ? { data: models, nextCursor: null }
              : {};
        options?.onStdout?.(`${JSON.stringify({ id: wire.id, result })}\n`);
      },
      end: vi.fn(async () => {
        exited.resolve(0);
      }),
      kill: vi.fn(async () => {
        exited.resolve(null);
      }),
      exited: exited.promise,
    };
  });
  const provider = new CodexProvider(spawn);
  const setup = new CodexSetup(spawn);
  const runtime = new CodexRuntime(
    spawn,
    () => undefined,
    async () => undefined,
  );
  const tabs = createTabs(provider, runtime, spawn, setup, control.binding);
  return {
    provider,
    tabs,
    requests,
    spawn,
    modelRequested,
    dispose: () => {
      provider.dispose();
      runtime.dispose();
      setup.dispose();
    },
  };
}

it("retains the real Thinking popup, focus, inherited model and exact config through EN/KO/EN", async () => {
  const f = fixture();
  await f.provider.check();
  const changed = vi.fn();
  const config: Config = {
    ...defaults,
    instructions: "Raw Thinking {name}\n한글",
  };
  function Host() {
    const [draft, setDraft] = useState(config);
    return (
      <f.tabs.CreateThinking
        config={draft}
        disabled={false}
        onChange={(next) => {
          changed(next);
          setDraft(next);
        }}
      />
    );
  }
  const view = render(<Host />);
  const user = userEvent.setup();
  try {
    const trigger = screen.getByRole("combobox", { name: "Thinking" });
    expect(trigger).toHaveTextContent("Low · Default");
    await user.click(trigger);
    const high = await screen.findByRole("option", {
      name: "High",
    });
    const low = screen.getByRole("option", { name: "Low" });
    const popup = screen.getByRole("listbox");
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement))
      throw new Error("Missing real popup focus");
    const requestCount = f.requests.length,
      processCount = f.spawn.mock.calls.length;
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("combobox", {
          name: language === "ko" ? "사고" : "Thinking",
        }),
      ).toBe(trigger);
      expect(
        screen.getByRole("option", {
          name: language === "ko" ? "높음" : "High",
        }),
      ).toBe(high);
      expect(
        screen.getByRole("option", {
          name: language === "ko" ? "낮음" : "Low",
        }),
      ).toBe(low);
      expect(screen.getByRole("listbox")).toBe(popup);
      expect(focused).toHaveFocus();
      expect(f.requests).toHaveLength(requestCount);
      expect(f.spawn).toHaveBeenCalledTimes(processCount);
      expect(changed).not.toHaveBeenCalled();
    }
    await user.click(high);
    expect(changed).toHaveBeenCalledExactlyOnceWith({
      ...config,
      effort: "high",
    });
    expect(trigger).toHaveTextContent("High");
  } finally {
    view.unmount();
    f.dispose();
  }
});

function savedAgent(config: Config): Agent<Config> {
  return {
    key: "a".repeat(64),
    pubkey: "b".repeat(64),
    name: "Raw agent 한글",
    type: "buzz.codex/codex",
    owner: "c".repeat(64),
    relay: "https://fixture.test",
    place: "here",
    attention: {},
    skipped: {},
    timers: {},
    attentionEnabled: false,
    config,
  };
}

it("preserves a held model read, raw model name and ready callback while captions change", async () => {
  const gate = deferred<void>();
  const f = fixture(undefined, { modelGate: gate.promise });
  const checked = f.provider.check();
  await f.modelRequested.promise;
  const changed = vi.fn(),
    ready = vi.fn();
  const config = {
    ...defaults,
    instructions: "Raw instructions 한글 {effort}",
  };
  const view = render(
    <>
      <f.tabs.CreateModel
        config={config}
        disabled={false}
        onChange={changed}
        onReadyChange={ready}
      />
      <f.tabs.CreateThinking
        config={config}
        disabled={false}
        onChange={changed}
      />
      <f.tabs.Create config={config} disabled={false} onChange={changed} />
    </>,
  );
  try {
    const model = screen.getByRole("combobox", { name: "Model" });
    const thinking = screen.getByRole("combobox", { name: "Thinking" });
    expect(model).toHaveTextContent("Loading models");
    expect(thinking).toBeDisabled();
    const instructions = screen.getByRole("textbox", { name: /^Instructions/ });
    if (!(instructions instanceof HTMLTextAreaElement))
      throw new Error("Missing real instructions textarea");
    instructions.focus();
    instructions.setSelectionRange(4, 9);
    const requests = f.requests.length;
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("combobox", {
          name: language === "ko" ? "모델" : "Model",
        }),
      ).toBe(model);
      expect(
        screen.getByRole("combobox", {
          name: language === "ko" ? "사고" : "Thinking",
        }),
      ).toBe(thinking);
      expect(model).toHaveTextContent(
        language === "ko" ? "모델 불러오는 중" : "Loading models",
      );
      expect(
        screen.getByRole("textbox", {
          name: language === "ko" ? /^지침/ : /^Instructions/,
        }),
      ).toBe(instructions);
      expect(instructions).toHaveValue(config.instructions);
      expect(instructions).toHaveFocus();
      expect([instructions.selectionStart, instructions.selectionEnd]).toEqual([
        4, 9,
      ]);
      expect(thinking).toHaveTextContent(
        language === "ko" ? "자동 · 기본값" : "Automatic · Default",
      );
      expect(f.requests).toHaveLength(requests);
      expect(ready.mock.calls).toEqual([[false]]);
      expect(changed).not.toHaveBeenCalled();
    }
    await act(async () => {
      gate.resolve();
      await checked;
    });
    expect(model).toHaveTextContent("Codex default");
    expect(ready.mock.calls).toEqual([[false], [true]]);
    await userEvent.setup().click(model);
    const popup = await screen.findByRole("listbox");
    const rawDescription = screen.getByText("Raw description {name}");
    const focus = document.activeElement;
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole("listbox")).toBe(popup);
      expect(rawDescription).toHaveTextContent("Raw description {name}");
      expect(model).toHaveTextContent("Codex default");
      expect(document.activeElement).toBe(focus);
      expect(ready.mock.calls).toEqual([[false], [true]]);
      expect(changed).not.toHaveBeenCalled();
    }
    expect(f.spawn).toHaveBeenCalledOnce();
    expect(
      f.requests.filter((request) => request.method === "model/list"),
    ).toHaveLength(1);
  } finally {
    gate.resolve();
    await checked;
    view.unmount();
    f.dispose();
  }
});

it.each(["", "Codex default", " "])(
  "projects only an absent bound model caption, preserving raw '%s' and the settings action",
  async (model) => {
    const binding = vi.fn(async () => ({ provider: "test/guest" }));
    const f = fixture(undefined, { binding });
    const config = { ...defaults, model, effort: "turbo" };
    const openSettings = vi.fn(),
      changed = vi.fn();
    const agent = savedAgent(config);
    const view = render(
      <>
        <f.tabs.CreateModel
          agent={agent}
          config={config}
          disabled={false}
          onChange={changed}
          openSettings={openSettings}
        />
        <f.tabs.CreateThinking
          agent={agent}
          config={config}
          disabled={false}
          onChange={changed}
        />
      </>,
    );
    try {
      const control = await screen.findByRole("button", {
        name: "Model settings",
      });
      control.focus();
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        expect(
          screen.getByRole("button", {
            name: language === "ko" ? "모델 설정" : "Model settings",
          }),
        ).toBe(control);
        expect(control.textContent).toBe(
          model || (language === "ko" ? "Codex 기본값" : "Codex default"),
        );
        expect(control).toHaveFocus();
        const thinking = screen.getByRole("combobox", {
          name: language === "ko" ? "사고" : "Thinking",
        });
        expect(thinking).toHaveTextContent("Turbo");
        expect(thinking).toBeDisabled();
        expect(changed).not.toHaveBeenCalled();
        expect(f.spawn).not.toHaveBeenCalled();
      }
      await userEvent.setup().click(control);
      expect(openSettings).toHaveBeenCalledOnce();
      expect(binding).toHaveBeenCalledTimes(2);
    } finally {
      view.unmount();
      f.dispose();
    }
  },
);

it("keeps ordered canonical effort values and the exact keyboard selection with translated known labels and raw unknown IDs", async () => {
  const values = [
    "none",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
    "ultra",
    "turbo",
    "High",
  ];
  const f = fixture([
    {
      model: "raw-model",
      displayName: "Raw",
      description: "",
      isDefault: true,
      defaultReasoningEffort: "",
      supportedReasoningEfforts: values.map((reasoningEffort) => ({
        reasoningEffort,
        description: "",
      })),
    },
  ]);
  await f.provider.check();
  const config = { ...defaults, model: "raw-model" };
  const changed = vi.fn();
  const view = render(
    <f.tabs.CreateThinking
      config={config}
      disabled={false}
      onChange={changed}
    />,
  );
  const user = userEvent.setup();
  try {
    const trigger = screen.getByRole("combobox", { name: "Thinking" });
    await user.click(trigger);
    const original = await screen.findAllByRole("option");
    expect(original.map((option) => option.textContent)).toEqual([
      "Automatic · Default",
      "None",
      "Minimal",
      "Low",
      "Medium",
      "High",
      "Extra high",
      "Maximum",
      "Ultra",
      "Turbo",
      "High",
    ]);
    act(() => setLanguage("ko"));
    expect(screen.getAllByRole("option")).toEqual(original);
    expect(original.map((option) => option.textContent)).toEqual([
      "자동 · 기본값",
      "없음",
      "최소",
      "낮음",
      "중간",
      "높음",
      "매우 높음",
      "최대",
      "최고",
      "Turbo",
      "High",
    ]);
    const unknown = screen.getByRole("option", { name: "High" });
    await user.hover(unknown);
    unknown.focus();
    await user.keyboard("{Enter}");
    expect(changed).toHaveBeenCalledExactlyOnceWith({
      ...config,
      effort: "High",
    });
    expect(
      f.requests.filter((request) => request.method === "model/list"),
    ).toHaveLength(1);
  } finally {
    view.unmount();
    f.dispose();
  }
});

it("retains a saved unsupported effort instead of changing config on language changes", async () => {
  const f = fixture();
  await f.provider.check();
  const config = { ...defaults, model: "raw-model", effort: "turbo" };
  const changed = vi.fn();
  const view = render(
    <f.tabs.CreateThinking
      agent={savedAgent(config)}
      config={config}
      disabled={false}
      onChange={changed}
    />,
  );
  try {
    const trigger = screen.getByRole("combobox", { name: "Thinking" });
    await waitFor(() => expect(trigger).not.toBeDisabled());
    await userEvent.setup().click(trigger);
    const unknown = await screen.findByRole("option", {
      name: "Turbo (unavailable)",
    });
    const focus = document.activeElement;
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("option", {
          name: language === "ko" ? "Turbo (사용 불가)" : "Turbo (unavailable)",
        }),
      ).toBe(unknown);
      expect(trigger).toHaveTextContent(
        language === "ko" ? "Turbo (사용 불가)" : "Turbo (unavailable)",
      );
      expect(document.activeElement).toBe(focus);
      expect(changed).not.toHaveBeenCalled();
    }
  } finally {
    view.unmount();
    f.dispose();
  }
});

it("translates the owned missing-model warning while retaining readiness, raw config and exact model selection", async () => {
  const f = fixture();
  await f.provider.check();
  const config = {
    ...defaults,
    model: "opaque-missing",
    effort: "turbo",
    instructions: "Raw 한글",
  };
  const changed = vi.fn(),
    ready = vi.fn();
  const view = render(
    <f.tabs.CreateModel
      config={config}
      disabled={false}
      onChange={changed}
      onReadyChange={ready}
    />,
  );
  try {
    const model = screen.getByRole("combobox", { name: "Model" });
    const status = screen.getByRole("status");
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole("status")).toBe(status);
      expect(status).toHaveTextContent(
        language === "ko"
          ? "이 모델을 사용할 수 없습니다. 계속하려면 다른 모델을 선택하세요."
          : "This model isn’t available. Choose another model to continue.",
      );
      expect(model).toHaveTextContent("opaque-missing");
      expect(ready.mock.calls).toEqual([[false]]);
      expect(changed).not.toHaveBeenCalled();
    }
    await userEvent.setup().click(model);
    await userEvent.setup().click(
      await screen.findByRole("option", {
        name: "Codex default · Default",
      }),
    );
    expect(changed).toHaveBeenCalledExactlyOnceWith({
      ...config,
      model: "",
      effort: "",
    });
  } finally {
    view.unmount();
    f.dispose();
  }
});

it("does not translate a provider failure equal to the owned English unavailable sentence", async () => {
  const failure =
    "This model isn’t available. Choose another model to continue.";
  const f = fixture(undefined, { failure });
  await f.provider.check();
  const changed = vi.fn(),
    ready = vi.fn();
  const view = render(
    <f.tabs.CreateModel
      config={defaults}
      disabled={false}
      onChange={changed}
      onReadyChange={ready}
    />,
  );
  try {
    const error = screen.getByRole("alert");
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole("alert")).toBe(error);
      expect(error).toHaveTextContent(failure);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(ready.mock.calls).toEqual([[false]]);
      expect(changed).not.toHaveBeenCalled();
    }
    expect(
      f.requests.filter((request) => request.method === "model/list"),
    ).toHaveLength(1);
  } finally {
    view.unmount();
    f.dispose();
  }
});

it("shows the owned default description only when no catalog default owns it", async () => {
  const f = fixture([
    {
      model: "raw",
      displayName: "Following the provider's model default",
      description: "",
      isDefault: false,
      defaultReasoningEffort: "",
      supportedReasoningEfforts: [],
    },
  ]);
  await f.provider.check();
  const changed = vi.fn();
  const view = render(
    <f.tabs.CreateModel
      config={defaults}
      disabled={false}
      onChange={changed}
    />,
  );
  try {
    const trigger = screen.getByRole("combobox", { name: "Model" });
    await userEvent.setup().click(trigger);
    await screen.findByRole("listbox");
    const description = screen.getByText(
      "Following the provider's model default",
      { selector: ".buzz-select-option-description" },
    );
    const rawOption = screen.getByRole("option", {
      name: "Following the provider's model default",
    });
    const focus = document.activeElement;
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(description).toHaveTextContent(
        language === "ko"
          ? "공급자의 기본 모델을 따릅니다"
          : "Following the provider's model default",
      );
      expect(
        screen.getByRole("option", {
          name: "Following the provider's model default",
        }),
      ).toBe(rawOption);
      expect(document.activeElement).toBe(focus);
      expect(changed).not.toHaveBeenCalled();
    }
    await userEvent.setup().click(rawOption);
    expect(changed).toHaveBeenCalledExactlyOnceWith({
      ...defaults,
      model: "raw",
      effort: "",
    });
  } finally {
    view.unmount();
    f.dispose();
  }
});

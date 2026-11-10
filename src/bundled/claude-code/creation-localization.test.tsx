// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Agent } from "../../features/agents/service";
import { setLanguage } from "../../shared/i18n";
import { createTabs } from "./tabs";
import { ClaudeDefaults } from "./defaults";
import { ClaudeSetup } from "./setup";
import { ClaudeRuntime, DEFAULT_CONFIG, type Config } from "./runtime";
import type { ClaudeModel, Spawn } from "./claude";

const native = vi.hoisted(() => {
  const state: {
    signedIn: boolean;
    pending: Promise<boolean> | undefined;
    reads: number;
  } = { signedIn: true, pending: undefined, reads: 0 };
  return state;
});
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: async (command: string) => {
    if (command !== "claude_api_key_status")
      throw new Error(`Unexpected fixture command: ${command}`);
    native.reads++;
    return native.pending ?? native.signedIn;
  },
}));
beforeEach(() => {
  localStorage.clear();
  setLanguage("en");
  native.signedIn = true;
  native.pending = undefined;
  native.reads = 0;
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
const MODELS: readonly ClaudeModel[] = [
  {
    value: "default",
    resolvedModel: "raw-model",
    supportsEffort: true,
    supportedEffortLevels: ["low", "high", "xhigh", "max"],
  },
  {
    value: "raw-model",
    displayName: "Automatic",
    description: "Raw description {model}",
    supportsEffort: true,
    supportedEffortLevels: ["low", "high", "xhigh", "max"],
  },
];
function fixture(
  control: {
    models?: readonly ClaudeModel[];
    modelGate?: Promise<void>;
    failure?: string;
  } = {},
) {
  const modelRequested = deferred<void>();
  const wires: {
    type: string;
    request_id: string;
    request: { subtype: string };
  }[] = [];
  const spawn = vi.fn<Spawn>(async (id, options) => {
    if (id !== "claude") throw new Error(`Unexpected fixture process: ${id}`);
    if (options?.args?.[0] === "--version") {
      options.onStdout?.("2.1.312 (Claude Code)\n");
      return {
        write: async () => undefined,
        end: async () => undefined,
        kill: async () => undefined,
        exited: Promise.resolve(0),
      };
    }
    if (control.failure !== undefined) throw new Error(control.failure);
    const exited = deferred<number | null>();
    return {
      write: async (text) => {
        const message: {
          type: string;
          request_id: string;
          request: { subtype: string };
        } = JSON.parse(text);
        wires.push(message);
        if (message.request?.subtype !== "initialize")
          throw new Error("Unexpected fixture request");
        modelRequested.resolve();
        await control.modelGate;
        options?.onStdout?.(
          `${JSON.stringify({ type: "control_response", response: { subtype: "success", request_id: message.request_id, response: { models: control.models ?? MODELS } } })}\n`,
        );
      },
      end: async () => exited.resolve(0),
      kill: async () => exited.resolve(null),
      exited: exited.promise,
    };
  });
  const setup = new ClaudeSetup(spawn);
  const defaults = new ClaudeDefaults();
  const runtime = new ClaudeRuntime(
    { spawn },
    () => undefined,
    async () => undefined,
  );
  const tabs = createTabs({ setup, defaults, runtime });
  return {
    setup,
    defaults,
    tabs,
    spawn,
    wires,
    modelRequested,
    dispose: () => {
      setup.dispose();
      runtime.dispose();
    },
  };
}

it("retains the real Thinking popup and focus through EN/KO/EN and selects one exact inherited Config", async () => {
  const f = fixture();
  await f.setup.check();
  await f.setup.loadModels();
  const config = {
    ...DEFAULT_CONFIG,
    instructions: "Raw Thinking 한글 {name}",
  };
  const changed = vi.fn();
  function Host() {
    const [draft, setDraft] = useState<Config>(config);
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
    expect(trigger).toHaveTextContent("Automatic · Default");
    await user.click(trigger);
    const high = await screen.findByRole("option", { name: "High" });
    expect(screen.queryByRole("option", { name: "Max" })).toBeNull();
    const popup = screen.getByRole("listbox");
    const focused = document.activeElement;
    const calls = f.spawn.mock.calls.length,
      reads = native.reads;
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
      expect(screen.getByRole("listbox")).toBe(popup);
      expect(document.activeElement).toBe(focused);
      expect(f.spawn).toHaveBeenCalledTimes(calls);
      expect(native.reads).toBe(reads);
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

it("keeps credentials and catalog requests pending while the same draft, status and readiness survive language changes", async () => {
  const auth = deferred<boolean>(),
    models = deferred<void>();
  native.pending = auth.promise;
  const f = fixture({ modelGate: models.promise });
  const config = {
    ...DEFAULT_CONFIG,
    instructions: "Raw Instructions 한글 {name}",
  };
  const ready = vi.fn(),
    changed = vi.fn();
  function Host() {
    const [draft, setDraft] = useState<Config>(config);
    const change = (next: Config) => {
      changed(next);
      setDraft(next);
    };
    return (
      <>
        <f.tabs.CreateModel
          config={draft}
          disabled={false}
          onChange={change}
          onReadyChange={ready}
        />
        <f.tabs.CreateThinking
          config={draft}
          disabled={false}
          onChange={change}
        />
        <f.tabs.Create config={draft} disabled={false} onChange={change} />
      </>
    );
  }
  const view = render(<Host />);
  try {
    await waitFor(() => expect(native.reads).toBe(1));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Checking sign-in…");
    const input = screen.getByRole("textbox", { name: /^Instructions/ });
    if (!(input instanceof HTMLTextAreaElement))
      throw new Error("Missing actual instructions textarea");
    await userEvent.setup().type(input, " raw");
    expect(input).toHaveValue(`${config.instructions} raw`);
    input.setSelectionRange(3, 8);
    const changes = changed.mock.calls.length;
    const calls = f.spawn.mock.calls.length;
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole("status")).toBe(status);
      expect(status).toHaveTextContent(
        language === "ko" ? "로그인 확인 중…" : "Checking sign-in…",
      );
      expect(input).toHaveFocus();
      expect(input).toHaveValue(`${config.instructions} raw`);
      expect([input.selectionStart, input.selectionEnd]).toEqual([3, 8]);
      expect(
        screen.getByRole("textbox", {
          name: language === "ko" ? /^지침/ : /^Instructions/,
        }),
      ).toBe(input);
      expect(f.spawn).toHaveBeenCalledTimes(calls);
      expect(native.reads).toBe(1);
      expect(ready.mock.calls).toEqual([[false]]);
      expect(changed).toHaveBeenCalledTimes(changes);
    }
    await act(async () => {
      auth.resolve(true);
      await f.modelRequested.promise;
    });
    const model = screen.getByRole("combobox", { name: "Model" });
    const thinking = screen.getByRole("combobox", { name: "Thinking" });
    expect(model).toHaveTextContent("Loading models");
    expect(thinking).toBeDisabled();
    const before = f.spawn.mock.calls.length;
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
      expect(input).toHaveFocus();
      expect([input.selectionStart, input.selectionEnd]).toEqual([3, 8]);
      expect(f.spawn).toHaveBeenCalledTimes(before);
      expect(native.reads).toBe(1);
      expect(ready.mock.calls).toEqual([[false]]);
      expect(changed).toHaveBeenCalledTimes(changes);
    }
    await act(async () => {
      models.resolve();
      await f.setup.loadModels();
    });
    expect(ready.mock.calls).toEqual([[false], [true]]);
    expect(model).toHaveTextContent("Automatic");
    expect(input).toHaveFocus();
    expect(f.wires).toHaveLength(1);
    expect(f.wires[0]?.request).toEqual({
      subtype: "initialize",
      appendSystemPrompt: "",
    });
    expect(changed).toHaveBeenLastCalledWith({
      ...config,
      instructions: `${config.instructions} raw`,
    });
  } finally {
    await act(async () => {
      auth.resolve(true);
      models.resolve();
      await f.setup.check();
      await f.setup.loadModels();
    });
    view.unmount();
    f.dispose();
  }
});

it("keeps signed-out Configuration controls and raw harness draft without changing admission or starting auth", async () => {
  native.signedIn = false;
  const f = fixture();
  await f.setup.check();
  const ready = vi.fn(),
    changed = vi.fn();
  const harness = (
    <input aria-label="Fixture harness" defaultValue="Raw Model 한글" />
  );
  const view = render(
    <f.tabs.CreateConfiguration
      harnessControl={harness}
      config={DEFAULT_CONFIG}
      disabled={false}
      onChange={changed}
      onReadyChange={ready}
    />,
  );
  try {
    const model = screen.getByRole("combobox", { name: "Model" });
    const thinking = screen.getByRole("combobox", { name: "Thinking" });
    const input = screen.getByRole("textbox", { name: "Fixture harness" });
    if (!(input instanceof HTMLInputElement))
      throw new Error("Missing harness input");
    await userEvent.setup().type(input, " raw");
    input.setSelectionRange(2, 6);
    const calls = f.spawn.mock.calls.length,
      reads = native.reads;
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
      expect(model).toHaveTextContent(language === "ko" ? "기본값" : "Default");
      expect(thinking).toHaveTextContent(
        language === "ko" ? "자동 · 기본값" : "Automatic · Default",
      );
      expect(model).toBeDisabled();
      expect(thinking).toBeDisabled();
      expect(
        screen.getByText(language === "ko" ? "모델" : "Model", {
          selector: ".buzz-preference-row-label",
        }),
      ).toBeVisible();
      expect(
        screen.getByText(language === "ko" ? "사고" : "Thinking", {
          selector: ".buzz-preference-row-label",
        }),
      ).toBeVisible();
      expect(input).toHaveValue("Raw Model 한글 raw");
      expect(input).toHaveFocus();
      expect([input.selectionStart, input.selectionEnd]).toEqual([2, 6]);
      expect(f.spawn).toHaveBeenCalledTimes(calls);
      expect(native.reads).toBe(reads);
      expect(ready.mock.calls).toEqual([[false]]);
      expect(changed).not.toHaveBeenCalled();
    }
    await userEvent.setup().click(model);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(f.wires).toEqual([]);
  } finally {
    view.unmount();
    f.dispose();
  }
});

function savedAgent(config: Config): Agent<Config> {
  return {
    key: "a".repeat(64),
    pubkey: "b".repeat(64),
    owner: "c".repeat(64),
    name: "Raw Claude 한글",
    type: "buzz.claude-code/claude-code",
    relay: "https://fixture.test",
    place: "here",
    attention: {},
    skipped: {},
    timers: {},
    attentionEnabled: false,
    config,
  };
}

it.each(["max", "turbo", "High"])(
  "retains a saved unsupported %s effort and its exact raw value",
  async (effort) => {
    const f = fixture();
    await f.setup.check();
    await f.setup.loadModels();
    const config = { ...DEFAULT_CONFIG, effort };
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
      await userEvent.setup().click(trigger);
      const raw =
        effort === "max" ? "Max" : effort === "turbo" ? "Turbo" : "High";
      const option = await screen.findByRole("option", {
        name: `${raw} (unavailable)`,
      });
      const focused = document.activeElement;
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        const label =
          language === "ko"
            ? `${effort === "max" ? "최대" : raw} (사용 불가)`
            : `${raw} (unavailable)`;
        expect(screen.getByRole("option", { name: label })).toBe(option);
        expect(trigger).toHaveTextContent(label);
        expect(document.activeElement).toBe(focused);
        expect(changed).not.toHaveBeenCalled();
      }
      await userEvent.setup().click(option);
      expect(changed).toHaveBeenCalledExactlyOnceWith(config);
      expect(f.wires).toHaveLength(1);
    } finally {
      view.unmount();
      f.dispose();
    }
  },
);

it("preserves the canonical max filter and repairs an unsupported creation effort exactly once", async () => {
  const f = fixture();
  await f.setup.check();
  await f.setup.loadModels();
  const config = { ...DEFAULT_CONFIG, effort: "max" };
  const changed = vi.fn();
  function Host() {
    const [draft, setDraft] = useState<Config>(config);
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
  try {
    expect(changed).toHaveBeenCalledExactlyOnceWith({ ...config, effort: "" });
    const trigger = screen.getByRole("combobox", { name: "Thinking" });
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("combobox", {
          name: language === "ko" ? "사고" : "Thinking",
        }),
      ).toBe(trigger);
      expect(trigger).toHaveTextContent(
        language === "ko" ? "자동 · 기본값" : "Automatic · Default",
      );
      expect(changed).toHaveBeenCalledOnce();
    }
    await userEvent.setup().click(trigger);
    await screen.findByRole("listbox");
    expect(screen.queryByRole("option", { name: /Max|최대/ })).toBeNull();
  } finally {
    view.unmount();
    f.dispose();
  }
});

it.each(["Following the provider's model default", ""])(
  "preserves an explicit raw catalog description '%s' and a model named Automatic",
  async (description) => {
    const f = fixture({
      models: [
        {
          value: "default",
          resolvedModel: "raw-model",
          supportsEffort: true,
          supportedEffortLevels: ["high"],
        },
        {
          value: "raw-model",
          displayName: "Automatic",
          description,
          supportsEffort: true,
          supportedEffortLevels: ["high"],
        },
      ],
    });
    await f.setup.check();
    await f.setup.loadModels();
    const config = {
      ...DEFAULT_CONFIG,
      effort: "high",
      instructions: "Raw instructions 한글",
    };
    const changed = vi.fn();
    const view = render(
      <f.tabs.CreateModel
        config={config}
        disabled={false}
        onChange={changed}
      />,
    );
    try {
      const trigger = screen.getByRole("combobox", { name: "Model" });
      await userEvent.setup().click(trigger);
      const option = await screen.findByRole("option", {
        name: "Automatic · Default",
      });
      const focus = document.activeElement;
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        expect(
          screen.getByRole("option", {
            name:
              language === "ko" ? "Automatic · 기본값" : "Automatic · Default",
          }),
        ).toBe(option);
        expect(trigger).toHaveTextContent("Automatic");
        if (description)
          expect(
            screen.getByText(description, {
              selector: ".buzz-select-option-description",
            }),
          ).toBeVisible();
        else
          expect(
            option.querySelector(".buzz-select-option-description"),
          ).toBeNull();
        expect(screen.queryByText("공급자의 기본 모델을 따릅니다")).toBeNull();
        expect(document.activeElement).toBe(focus);
        expect(changed).not.toHaveBeenCalled();
      }
      await userEvent.setup().click(option);
      expect(changed).toHaveBeenCalledExactlyOnceWith(config);
      expect(f.wires).toHaveLength(1);
    } finally {
      view.unmount();
      f.dispose();
    }
  },
);

it("translates only the owned default description and preserves an English-like model name and exact selection", async () => {
  const f = fixture({
    models: [
      {
        value: "opaque/model",
        displayName: "Following the provider's model default",
        description: "Raw {name}",
        supportsEffort: true,
        supportedEffortLevels: ["high"],
      },
    ],
  });
  await f.setup.check();
  await f.setup.loadModels();
  const config = {
    ...DEFAULT_CONFIG,
    effort: "high",
    instructions: "Raw config 한글",
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
      expect(screen.getByText("Raw {name}")).toBeVisible();
      expect(document.activeElement).toBe(focus);
      expect(ready.mock.calls).toEqual([[false]]);
      expect(changed).not.toHaveBeenCalled();
    }
    await userEvent.setup().click(rawOption);
    expect(changed).toHaveBeenCalledExactlyOnceWith({
      ...config,
      model: "opaque/model",
    });
  } finally {
    view.unmount();
    f.dispose();
  }
});

it("keeps a provider failure equal to the owned checking caption raw across language changes", async () => {
  const failure = "Checking sign-in…";
  const f = fixture({ failure });
  await f.setup.check();
  await f.setup.loadModels();
  const changed = vi.fn(),
    ready = vi.fn();
  const view = render(
    <f.tabs.CreateModel
      config={DEFAULT_CONFIG}
      disabled={false}
      onChange={changed}
      onReadyChange={ready}
    />,
  );
  try {
    const alert = screen.getByRole("alert");
    const snapshot = f.setup.snapshot();
    expect(snapshot.modelsError).toBe(failure);
    const calls = f.spawn.mock.calls.length,
      reads = native.reads;
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole("alert")).toBe(alert);
      expect(alert).toHaveTextContent(failure);
      expect(f.setup.snapshot()).toBe(snapshot);
      expect(f.spawn).toHaveBeenCalledTimes(calls);
      expect(native.reads).toBe(reads);
      expect(ready.mock.calls).toEqual([[false]]);
      expect(changed).not.toHaveBeenCalled();
    }
  } finally {
    view.unmount();
    f.dispose();
  }
});

it("translates finite known effort IDs without changing order, max exclusion or an unknown keyboard payload", async () => {
  const levels = [
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
  const f = fixture({
    models: [
      { value: "default", supportsEffort: true, supportedEffortLevels: levels },
    ],
  });
  await f.setup.check();
  await f.setup.loadModels();
  const config = { ...DEFAULT_CONFIG, instructions: "Raw Instructions" };
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
    await user.click(screen.getByRole("combobox", { name: "Thinking" }));
    const original = await screen.findAllByRole("option");
    expect(original.map((option) => option.textContent)).toEqual([
      "Automatic · Default",
      "None",
      "Minimal",
      "Low",
      "Medium",
      "High",
      "Extra high",
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
      "최고",
      "Turbo",
      "High",
    ]);
    const raw = screen.getByRole("option", { name: "High" });
    await user.hover(raw);
    raw.focus();
    await user.keyboard("{Enter}");
    expect(changed).toHaveBeenCalledExactlyOnceWith({
      ...config,
      effort: "High",
    });
    expect(f.wires).toHaveLength(1);
  } finally {
    view.unmount();
    f.dispose();
  }
});

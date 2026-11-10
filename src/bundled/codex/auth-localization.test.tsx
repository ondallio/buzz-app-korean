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
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { CodexProvider, createTabs } from "./tabs";
import { CodexRuntime } from "./runtime";
import { CodexSetup, type Request } from "./setup";
import { defaults, type Config } from "./config";
import type { Spawn, Wire } from "./rpc";
import type { HostResponse } from "../../features/host/service";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  setLanguage("en");
  localStorage.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

it("keeps failed setup output raw, retries the same login step and cancels only when the real dialog closes", async () => {
  const f = fixture();
  const run = vi.spyOn(f.setup, "run"),
    cancel = vi.spyOn(f.setup, "cancel");
  try {
    render(
      <f.tabs.CreateModel
        config={defaults}
        disabled={false}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Sign in to Codex",
    });
    await userEvent.click(
      await within(dialog).findByRole("button", { name: "Setup details" }),
    );
    const log = within(dialog).getByRole("log", { name: "Setup output" });
    await act(async () => f.logins[0]?.resolve(1));
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Sign in" }),
      ).not.toHaveAttribute("aria-disabled", "true"),
    );
    expect(log.textContent).toBe(
      "Sign in {count}\nRaw 한글 output\n\nSign-in ended (1).",
    );
    act(() => setLanguage("ko"));
    expect(screen.getByRole("dialog", { name: "Codex 로그인" })).toBe(dialog);
    expect(within(dialog).getByRole("log", { name: "설정 출력" })).toBe(log);
    expect(log.textContent).toBe(
      "Sign in {count}\nRaw 한글 output\n\nSign-in ended (1).",
    );
    expect(cancel).not.toHaveBeenCalled();
    expect(f.logins).toHaveLength(1);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "로그인" }),
    );
    expect(run.mock.calls).toEqual([["login"], ["login"]]);
    expect(f.logins).toHaveLength(2);
    expect(log.textContent).toBe("Sign in {count}\nRaw 한글 output\n");
    const processes = f.spawn.mock.calls.length;
    act(() => setLanguage("en"));
    expect(f.spawn).toHaveBeenCalledTimes(processes);
    expect(cancel).not.toHaveBeenCalled();
    const loginIndex = f.spawn.mock.calls
      .map(([id]) => id)
      .lastIndexOf("login");
    const process = await f.spawn.mock.results[loginIndex]?.value;
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close" }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(cancel).toHaveBeenCalledExactlyOnceWith();
    expect(process?.kill).toHaveBeenCalledExactlyOnceWith();
    expect(f.request).not.toHaveBeenCalled();
    expect(f.requests.filter((wire) => wire.method === "model/list")).toEqual(
      [],
    );
  } finally {
    await f.dispose();
  }
});

it("retains install code and buttons across locale, then shows the real checking gate without starting another install", async () => {
  const f = fixture(false);
  const version = deferred<void>();
  const run = vi.spyOn(f.setup, "run"),
    check = vi.spyOn(f.provider, "check");
  try {
    render(
      <f.tabs.CreateModel
        config={defaults}
        disabled={false}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Install Codex" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Set up Codex" });
    await waitFor(() =>
      expect(f.request).toHaveBeenCalledExactlyOnceWith({
        url: "https://releases.openai.com/codex/channels/latest",
      }),
    );
    const code = dialog.querySelector("code");
    if (!code) throw new Error("Missing command code");
    const paragraph = code.closest("p");
    expect(code).toHaveTextContent("codex");
    expect(paragraph).toHaveTextContent(
      "Downloads Buzz's own copy of Codex (about 130 MB) from releases.openai.com and keeps it on the latest release. It does not change the codex in your terminal, and uses the same sign-in and settings.",
    );
    const install = within(dialog).getByRole("button", {
      name: "Install Codex",
    });
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    cancel.focus();
    const processCount = f.spawn.mock.calls.length,
      checkCount = check.mock.calls.length;
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("dialog", {
          name: language === "ko" ? "Codex 설정" : "Set up Codex",
        }),
      ).toBe(dialog);
      expect(dialog.querySelector("code")).toBe(code);
      expect(code.closest("p")).toBe(paragraph);
      expect(code.textContent).toBe("codex");
      expect(paragraph).toHaveTextContent("130 MB");
      expect(paragraph).toHaveTextContent("releases.openai.com");
      if (language === "ko")
        expect(paragraph).toHaveTextContent(
          "터미널에서 사용하는 codex는 변경하지 않으며, 같은 로그인 정보와 설정을 사용합니다.",
        );
      expect(
        within(dialog).getByRole("button", {
          name: language === "ko" ? "Codex 설치" : "Install Codex",
        }),
      ).toBe(install);
      expect(cancel).toHaveFocus();
      expect(run.mock.calls).toEqual([["install"]]);
      expect(f.spawn).toHaveBeenCalledTimes(processCount);
      expect(check).toHaveBeenCalledTimes(checkCount);
      expect(f.request).toHaveBeenCalledTimes(1);
    }
    f.disk.pauseVersion = version.promise;
    await act(async () =>
      f.releaseRequest.resolve({
        status: 503,
        headers: {},
        body: "Fixture unavailable",
      }),
    );
    await waitFor(() =>
      expect(within(dialog).getByRole("status")).toHaveTextContent(
        "Checking Codex…",
      ),
    );
    act(() => setLanguage("ko"));
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Codex 확인 중…",
    );
    const again = within(dialog).getByRole("button", { name: "다시 확인" });
    expect(again).toHaveAttribute("aria-disabled", "true");
    expect(dialog.querySelector("code")).toBe(code);
    await act(async () => version.resolve());
    await waitFor(() =>
      expect(within(dialog).getByRole("status")).toHaveTextContent(
        "Codex가 설치되어 있지 않습니다.",
      ),
    );
    expect(again).not.toHaveAttribute("aria-disabled", "true");
    const checksBeforeRetry = check.mock.calls.length;
    await userEvent.click(again);
    await waitFor(() =>
      expect(check).toHaveBeenCalledTimes(checksBeforeRetry + 1),
    );
    expect(run.mock.calls).toEqual([["install"]]);
    expect(f.request).toHaveBeenCalledTimes(1);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "설정 세부 정보" }),
    );
    expect(
      within(dialog).getByRole("log", { name: "설정 출력" }),
    ).toHaveTextContent("releases.openai.com answered 503");
  } finally {
    await act(async () => version.resolve());
    await f.dispose();
  }
});
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fixture(installed = true) {
  const disk = {
    installed,
    signedIn: false,
    pauseVersion: undefined as Promise<void> | undefined,
  };
  const requests: Wire[] = [];
  const processes: ReturnType<typeof deferred<number | null>>[] = [];
  const logins: ReturnType<typeof deferred<number | null>>[] = [];
  const releaseRequest = deferred<HostResponse>();
  const request = vi.fn<Request>(() => releaseRequest.promise);
  const spawn = vi.fn<Spawn>(async (id, options) => {
    const exited = deferred<number | null>();
    processes.push(exited);
    const end = vi.fn(async () => {
      exited.resolve(0);
    });
    const kill = vi.fn(async () => {
      exited.resolve(null);
    });
    if (id === "login") {
      logins.push(exited);
      options?.onStdout?.("Sign in {count}\nRaw 한글 output\n");
    } else if (id === "codex") {
      if (options?.args?.join(" ") === "--version") {
        await disk.pauseVersion;
        if (disk.installed) options?.onStdout?.("codex-cli 0.162.1\n");
        exited.resolve(disk.installed ? 0 : 127);
      } else exited.resolve(disk.signedIn ? 0 : 1);
    } else if (id !== "app-server")
      throw new Error(`Unexpected fake process ${id}`);
    return {
      end,
      kill,
      exited: exited.promise,
      write: async (text) => {
        const wire: Wire = JSON.parse(text);
        if (wire.id == null) return;
        requests.push(wire);
        const result =
          wire.method === "account/read"
            ? {
                account: disk.signedIn
                  ? { type: "chatgpt", email: "fixture@example.invalid" }
                  : null,
                requiresOpenaiAuth: true,
              }
            : wire.method === "model/list"
              ? {
                  data: [
                    {
                      model: "model-a",
                      displayName: "Model A",
                      description: "Raw model {name}",
                      isDefault: true,
                      defaultReasoningEffort: "low",
                      supportedReasoningEfforts: [{ reasoningEffort: "low" }],
                    },
                    {
                      model: "model-b",
                      displayName: "Model B",
                      description: "Raw description",
                      isDefault: false,
                      defaultReasoningEffort: "medium",
                      supportedReasoningEfforts: [
                        { reasoningEffort: "medium" },
                      ],
                    },
                  ],
                  nextCursor: null,
                }
              : {};
        options?.onStdout?.(`${JSON.stringify({ id: wire.id, result })}\n`);
      },
    };
  });
  const setup = new CodexSetup(spawn, request);
  const provider = new CodexProvider(spawn, undefined, setup);
  const runtime = new CodexRuntime(
    spawn,
    () => undefined,
    async () => undefined,
  );
  const tabs = createTabs(provider, runtime, spawn, setup);
  return {
    disk,
    requests,
    request,
    releaseRequest,
    processes,
    logins,
    spawn,
    setup,
    provider,
    tabs,
    dispose: async () => {
      await act(async () => {
        releaseRequest.resolve({
          status: 503,
          headers: {},
          body: "Fixture unavailable",
        });
        for (const gate of processes) gate.resolve(null);
        cleanup();
        provider.dispose();
        runtime.dispose();
        setup.dispose();
        await Promise.resolve();
      });
    },
  };
}

it("retains two-card shared login, open details, focus and raw output across locales before one ready transition", async () => {
  const f = fixture();
  const changed = vi.fn();
  const config: Config = {
    ...defaults,
    instructions: "Raw Sign in {name}\n한글",
    workspace: "/tmp/public-fixture",
  };
  const cancel = vi.spyOn(f.setup, "cancel");
  const run = vi.spyOn(f.setup, "run");
  try {
    render(
      <>
        <f.tabs.CreateModel
          config={config}
          disabled={false}
          onChange={changed}
        />
        <f.tabs.CreateModel
          config={config}
          disabled={false}
          onChange={changed}
        />
      </>,
    );
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Sign in" })).toHaveLength(
        2,
      ),
    );
    const buttons = screen.getAllByRole("button", { name: "Sign in" });
    const first = buttons[0],
      second = buttons[1];
    if (!first || !second) throw new Error("Missing sign-in cards");
    fireEvent.click(first);
    fireEvent.click(second);
    const dialog = await screen.findByRole("dialog", {
      name: "Sign in to Codex",
    });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(second).toHaveAttribute("aria-disabled", "true");
    expect(f.logins).toHaveLength(1);
    expect(run).toHaveBeenCalledExactlyOnceWith("login");
    const detail = await within(dialog).findByRole("button", {
      name: "Setup details",
    });
    await userEvent.click(detail);
    const log = within(dialog).getByRole("log", { name: "Setup output" });
    const cancelButton = within(dialog).getByRole("button", { name: "Cancel" });
    cancelButton.focus();
    const processCount = f.spawn.mock.calls.length,
      requestCount = f.requests.length;
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("dialog", {
          name: language === "ko" ? "Codex 로그인" : "Sign in to Codex",
        }),
      ).toBe(dialog);
      expect(dialog).toHaveAccessibleDescription(
        language === "ko"
          ? "브라우저에서 계속해 주세요."
          : "Continue in your browser.",
      );
      expect(
        within(dialog).getByRole("button", {
          name: language === "ko" ? "설정 세부 정보" : "Setup details",
        }),
      ).toBe(detail);
      expect(detail).toHaveAttribute("aria-expanded", "true");
      expect(
        within(dialog).getByRole("log", {
          name: language === "ko" ? "설정 출력" : "Setup output",
        }),
      ).toBe(log);
      expect(log.textContent).toBe("Sign in {count}\nRaw 한글 output\n");
      expect(
        within(dialog).getByRole("button", {
          name: language === "ko" ? "취소" : "Cancel",
        }),
      ).toBe(cancelButton);
      expect(cancelButton).toHaveFocus();
      expect(f.spawn).toHaveBeenCalledTimes(processCount);
      expect(f.requests).toHaveLength(requestCount);
      expect(run).toHaveBeenCalledTimes(1);
      expect(cancel).not.toHaveBeenCalled();
      expect(changed).not.toHaveBeenCalled();
    }
    await act(async () => {
      f.disk.signedIn = true;
      f.logins[0]?.resolve(0);
    });
    await waitFor(() =>
      expect(screen.getAllByRole("combobox", { name: "Model" })).toHaveLength(
        2,
      ),
    );
    for (const model of screen.getAllByRole("combobox", { name: "Model" }))
      expect(model).toHaveTextContent("Model A");
    expect(dialog).not.toBeInTheDocument();
    expect(f.spawn.mock.calls.filter(([id]) => id === "login")).toHaveLength(1);
    expect(
      f.requests.filter((wire) => wire.method === "model/list"),
    ).toHaveLength(1);
    expect(f.request).not.toHaveBeenCalled();
    const firstModel = screen.getAllByRole("combobox", { name: "Model" })[0];
    if (!firstModel) throw new Error("Expected the first ready model control");
    await userEvent.click(firstModel);
    await userEvent.click(
      await screen.findByRole("option", { name: "Model B" }),
    );
    expect(changed).toHaveBeenCalledExactlyOnceWith({
      ...config,
      model: "model-b",
      effort: "medium",
    });
  } finally {
    await f.dispose();
  }
});

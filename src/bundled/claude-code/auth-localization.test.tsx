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
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { ClaudeAuth, Missing, SignIn, SignedIn } from "./auth";
import type { Spawn } from "./claude";
import { ClaudeSetup } from "./setup";

const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: native.invoke,
}));

const DUMMY = "fixture-only-never-real-credential";
type Answer = { ok: true } | { ok: false; error: unknown };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  native.invoke.mockReset();
  localStorage.clear();
  setLanguage("en");
});
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
});

function fixture() {
  const saves: ReturnType<typeof deferred<Answer>>[] = [];
  const order: string[] = [];
  let saved = false;
  native.invoke.mockImplementation(
    async (command: string, args?: { value: string }) => {
      if (command === "claude_api_key_status") {
        order.push("status");
        return saved;
      }
      if (command !== "claude_api_key_set" || !args)
        throw new Error(`Unexpected fake command ${command}`);
      order.push("save");
      const gate = deferred<Answer>();
      saves.push(gate);
      const answer = await gate.promise;
      if (!answer.ok) throw answer.error;
      saved = true;
      return undefined;
    },
  );
  const spawn = vi.fn<Spawn>(async (id, options) => {
    if (id !== "claude" || options?.args?.join(" ") !== "--version")
      throw new Error(`Unexpected fake process ${id}`);
    order.push("version");
    options?.onStdout?.("2.1.292\n");
    return {
      write: async () => undefined,
      end: async () => undefined,
      kill: async () => undefined,
      exited: Promise.resolve(0),
    };
  });
  const auth = new ClaudeAuth(spawn);
  const setup = new ClaudeSetup(spawn, undefined, auth);
  const save = vi.spyOn(auth, "save");
  const check = vi.spyOn(setup, "check");
  return {
    saves,
    order,
    spawn,
    auth,
    setup,
    save,
    check,
    dispose: async () => {
      await act(async () => {
        cleanup();
        for (const gate of saves)
          gate.resolve({ ok: false, error: "Fixture cancelled" });
        setup.dispose();
        await Promise.resolve();
      });
    },
  };
}

function expectMasked(input: HTMLElement) {
  expect(input).toHaveAttribute("type", "password");
  expect(input).toHaveAttribute("autocomplete", "off");
  expect(document.body.textContent).not.toContain(DUMMY);
  for (const node of document.querySelectorAll(
    "[title],[aria-label],[aria-description]",
  )) {
    for (const name of ["title", "aria-label", "aria-description"])
      expect(node.getAttribute(name) ?? "").not.toContain(DUMMY);
  }
}

it("keeps the real shared key form and masked pending draft across languages without another save or check", async () => {
  const f = fixture();
  const onSaved = vi.fn(() => {
    f.order.push("onSaved");
  });
  const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
  const logs = [
    vi.spyOn(console, "log"),
    vi.spyOn(console, "info"),
    vi.spyOn(console, "warn"),
    vi.spyOn(console, "error"),
  ];
  try {
    render(
      <form onSubmit={submit}>
        <SignIn setup={f.setup} onSaved={onSaved} />
      </form>,
    );
    expect(
      screen.getByText(
        /Claude requires an API key to connect to your account\./,
      ),
    ).toBeVisible();
    const input = screen.getByLabelText("Anthropic API key");
    const save = screen.getByRole("button", { name: "Save key" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(input, { target: { value: `  ${DUMMY}  ` } });
    input.focus();
    if (!(input instanceof HTMLInputElement))
      throw new Error("Expected the actual password input");
    input.setSelectionRange(3, 9);
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(f.save).not.toHaveBeenCalled();
    expect(native.invoke).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(f.saves).toHaveLength(1));
    expect(submit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveAttribute("aria-disabled", "true");
    expect(input.closest('[aria-busy="true"]')).not.toBeNull();
    const signal = f.save.mock.calls[0]?.[1];
    expect(signal?.aborted).toBe(false);
    const calls = native.invoke.mock.calls.length;
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByLabelText(
          language === "ko" ? "Anthropic API 키" : "Anthropic API key",
        ),
      ).toBe(input);
      expect(
        screen.getByRole("button", {
          name: language === "ko" ? "키 저장" : "Save key",
        }),
      ).toBe(save);
      expect(input).toHaveValue(`  ${DUMMY}  `);
      expect(input.selectionStart).toBe(3);
      expect(input.selectionEnd).toBe(9);
      expect(input).toHaveFocus();
      expectMasked(input);
      expect(signal?.aborted).toBe(false);
      expect(f.save).toHaveBeenCalledTimes(1);
      expect(f.check).not.toHaveBeenCalled();
      expect(native.invoke).toHaveBeenCalledTimes(calls);
      expect(f.spawn).not.toHaveBeenCalled();
    }
    fireEvent.keyDown(input, { key: "Enter" });
    expect(f.save).toHaveBeenCalledTimes(1);
    expect(native.invoke.mock.calls).toEqual([
      ["claude_api_key_set", { value: DUMMY }],
    ]);
    await act(async () => f.saves[0]?.resolve({ ok: true }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(input).toHaveValue("");
    expect(input).not.toHaveAttribute("readonly");
    expect(input).toHaveFocus();
    expect(f.check).toHaveBeenCalledExactlyOnceWith();
    expect(f.order).toEqual(["save", "version", "status", "onSaved"]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Saved the Anthropic API key.",
    );
    act(() => setLanguage("ko"));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Saved the Anthropic API key.",
    );
    expectMasked(input);
    for (const log of logs)
      expect(JSON.stringify(log.mock.calls)).not.toContain(DUMMY);
  } finally {
    await f.dispose();
  }
});

it("translates replacement guidance on the same field while preserving its masked draft, selection and disabled compact behavior", async () => {
  const f = fixture();
  try {
    const view = render(<SignedIn setup={f.setup} />);
    const input = screen.getByLabelText("Replace API key");
    const label = document.querySelector(`label[for="${input.id}"]`);
    expect(
      screen.getByText("Claude runs with your Anthropic API key."),
    ).toBeVisible();
    expect(input).toHaveAccessibleDescription(
      "Create a key at console.anthropic.com. Buzz keeps it securely on this computer and gives it only to Claude, so commands your Claude agents run can read it.",
    );
    fireEvent.change(input, { target: { value: DUMMY } });
    if (!(input instanceof HTMLInputElement))
      throw new Error("Expected actual replacement password input");
    input.focus();
    input.setSelectionRange(2, 7);
    act(() => setLanguage("ko"));
    expect(screen.getByLabelText("API 키 교체")).toBe(input);
    expect(document.querySelector(`label[for="${input.id}"]`)).toBe(label);
    expect(
      screen.getByText("Claude는 사용자의 Anthropic API 키로 실행됩니다."),
    ).toBeVisible();
    expect(input).toHaveAccessibleDescription(
      "console.anthropic.com에서 키를 만들어 주세요. Buzz는 이 컴퓨터에 키를 안전하게 보관하고 Claude에만 전달합니다. 따라서 Claude 에이전트가 실행하는 명령도 키를 읽을 수 있습니다.",
    );
    expect(input).toHaveValue(DUMMY);
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(7);
    expectMasked(input);
    act(() => setLanguage("en"));
    expect(screen.getByLabelText("Replace API key")).toBe(input);
    expect(input).toHaveFocus();
    expect(native.invoke).not.toHaveBeenCalled();
    expect(f.check).not.toHaveBeenCalled();
    view.unmount();
    render(<SignIn setup={f.setup} disabled variant="compact" />);
    const disabled = screen.getByLabelText("Anthropic API key");
    fireEvent.change(disabled, { target: { value: DUMMY } });
    fireEvent.keyDown(disabled, { key: "Enter" });
    const button = screen.getByRole("button", { name: "Save key" });
    expect(button).toHaveAttribute("data-size", "sm");
    expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(button);
    act(() => setLanguage("ko"));
    expect(screen.getByLabelText("Anthropic API 키")).toBe(disabled);
    expect(
      screen.getByText(
        "Claude를 계정에 연결하려면 API 키가 필요합니다. console.anthropic.com에서 키를 만들어 아래에 붙여 넣어 주세요. 한 번만 설정하면 Buzz가 이 컴퓨터에 안전하게 보관합니다.",
      ),
    ).toBeVisible();
    expect(f.save).not.toHaveBeenCalled();
    expect(native.invoke).not.toHaveBeenCalled();
  } finally {
    await f.dispose();
  }
});

it("keeps the actual inline Settings button and whole missing-key alternatives while locale changes", async () => {
  const openSettings = vi.fn();
  render(
    <>
      <Missing openSettings={openSettings} />
      <Missing />
    </>,
  );
  const button = screen.getByRole("button", { name: "Settings" });
  const paragraph = button.closest("p");
  const originalClass = button.className;
  expect(paragraph?.textContent).toBe(
    "Claude is missing an API key. Head to Settings to add one.",
  );
  expect(
    screen.getByText(
      "Claude is missing an API key. Add one in Settings → Agent setup.",
    ),
  ).toBeVisible();
  button.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "설정" })).toBe(button);
  expect(button.closest("p")).toBe(paragraph);
  expect(paragraph?.textContent).toBe(
    "Claude API 키가 없습니다. 설정에서 키를 추가해 주세요.",
  );
  expect(
    screen.getByText(
      "Claude API 키가 없습니다. 설정 → 에이전트 설정에서 키를 추가해 주세요.",
    ),
  ).toBeVisible();
  expect(button).toHaveFocus();
  expect(button).toHaveAttribute("type", "button");
  expect(button.className).toBe(originalClass);
  expect(openSettings).not.toHaveBeenCalled();
  await userEvent.click(button);
  expect(openSettings).toHaveBeenCalledTimes(1);
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "Settings" })).toBe(button);
  expect(paragraph?.textContent).toBe(
    "Claude is missing an API key. Head to Settings to add one.",
  );
  expect(button).toHaveFocus();
  expect(openSettings).toHaveBeenCalledTimes(1);
});

it.each([
  {
    name: "Error matching a translated caption",
    error: new Error("Save key"),
    text: "Save key",
  },
  {
    name: "string matching a translated sentence",
    error: "Claude runs with your Anthropic API key.",
    text: "Claude runs with your Anthropic API key.",
  },
  { name: "empty string", error: "", text: "" },
])(
  "keeps $name raw through locale and retry without rechecking",
  async ({ error, text }) => {
    const f = fixture();
    const onSaved = vi.fn();
    try {
      render(<SignIn setup={f.setup} onSaved={onSaved} />);
      const input = screen.getByLabelText("Anthropic API key");
      fireEvent.change(input, { target: { value: DUMMY } });
      await userEvent.click(screen.getByRole("button", { name: "Save key" }));
      await waitFor(() => expect(f.saves).toHaveLength(1));
      await act(async () => f.saves[0]?.resolve({ ok: false, error }));
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe(text);
      expect(input).toHaveValue(DUMMY);
      act(() => setLanguage("ko"));
      expect(screen.getByRole("alert")).toBe(alert);
      expect(alert.textContent).toBe(text);
      expect(screen.getByLabelText("Anthropic API 키")).toBe(input);
      expectMasked(input);
      expect(f.check).not.toHaveBeenCalled();
      expect(onSaved).not.toHaveBeenCalled();
      expect(f.save).toHaveBeenCalledTimes(1);
      await userEvent.click(screen.getByRole("button", { name: "키 저장" }));
      await waitFor(() => expect(f.saves).toHaveLength(2));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      act(() => setLanguage("en"));
      expect(f.save).toHaveBeenCalledTimes(2);
      expect(f.check).not.toHaveBeenCalled();
      expect(native.invoke.mock.calls).toEqual([
        ["claude_api_key_set", { value: DUMMY }],
        ["claude_api_key_set", { value: DUMMY }],
      ]);
    } finally {
      await f.dispose();
    }
  },
);

it("aborts the existing form signal on unmount and suppresses a late refusal without another check", async () => {
  const f = fixture();
  const onSaved = vi.fn();
  try {
    const view = render(<SignIn setup={f.setup} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText("Anthropic API key"), {
      target: { value: DUMMY },
    });
    await userEvent.click(screen.getByRole("button", { name: "Save key" }));
    await waitFor(() => expect(f.saves).toHaveLength(1));
    const signal = f.save.mock.calls[0]?.[1];
    expect(signal?.aborted).toBe(false);
    act(() => setLanguage("ko"));
    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () =>
      f.saves[0]?.resolve({ ok: false, error: new Error("Late raw refusal") }),
    );
    expect(onSaved).not.toHaveBeenCalled();
    expect(f.check).not.toHaveBeenCalled();
    expect(f.save).toHaveBeenCalledTimes(1);
    expect(native.invoke).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("Late raw refusal");
  } finally {
    await f.dispose();
  }
});

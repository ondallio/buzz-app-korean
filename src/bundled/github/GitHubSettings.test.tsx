// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, assert, expect, it, vi } from "vitest";
import type { HostProcessOptions } from "../../features/host/service";
import { setLanguage } from "../../shared/i18n";
import { localeStorageKey } from "../../shared/i18n/language";
import { GitHubSettings } from "./GitHubSettings";
import { loadPolicy, POLICY_KEY } from "./authors";
import { gitHubCli } from "./gh";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
});
function heldAccount() {
  let finish: (code: number | null) => void = () => {
    throw new Error("Missing process gate");
  };
  const exited = new Promise<number | null>((resolve) => {
    finish = resolve;
  });
  let callbacks: HostProcessOptions | undefined;
  const input: string[] = [],
    kill = vi.fn(async () => {
      finish(null);
    });
  const spawn = vi.fn(async (_id: string, options?: HostProcessOptions) => {
    callbacks = options;
    return {
      write: async () => {},
      end: async (text = "") => {
        input.push(text);
      },
      kill,
      exited,
    };
  });
  const gh = gitHubCli({ spawn });
  return {
    gh,
    spawn,
    kill,
    input,
    release: (data: unknown, error?: string) => {
      callbacks?.onStdout?.(
        JSON.stringify(
          error
            ? { data: null, errors: [{ type: "FIXTURE", message: error }] }
            : { data },
        ),
      );
      finish(error ? 1 : 0);
    },
  };
}
it("keeps the combined settings and raw draft during a pending account lookup and live language switches", async () => {
  const user = userEvent.setup(),
    account = heldAccount(),
    active = vi.fn(() => true);
  const write = vi.spyOn(Storage.prototype, "setItem");
  render(<GitHubSettings active={active} gh={account.gh} />);
  await waitFor(() => expect(account.input).toHaveLength(1));
  expect(JSON.parse(account.input[0] ?? "")).toEqual({
    query: "query{viewer{login}}",
    variables: {},
  });
  expect(account.spawn).toHaveBeenCalledExactlyOnceWith(
    "graphql",
    expect.any(Object),
  );
  const section = screen.getByRole("region", { name: "GitHub settings" });
  const form = screen.getByRole("form", {
    name: "GitHub comment author rules",
  });
  const rules = screen.getByRole("textbox", { name: /Rules/ });
  assert(rules instanceof HTMLTextAreaElement);
  const toggle = screen.getByRole("switch", {
    name: "Open GitHub links in Buzz",
  });
  const select = screen.getByRole("combobox", { name: "When no rule matches" });
  const raw =
    "deny author:Opaque-Handle prefix:Raw 한글\nallow org:example-org";
  await user.clear(rules);
  await user.type(
    rules,
    "deny author:Opaque-Handle prefix:Raw 한글{Enter}allow org:example-org",
  );
  rules.focus();
  rules.setSelectionRange(2, 9);
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("region", {
        name: language === "ko" ? "GitHub 설정" : "GitHub settings",
      }),
    ).toBe(section);
    expect(
      screen.getByRole("form", {
        name:
          language === "ko"
            ? "GitHub 댓글 작성자 규칙"
            : "GitHub comment author rules",
      }),
    ).toBe(form);
    expect(
      screen.getByRole("textbox", {
        name: language === "ko" ? /규칙/ : /Rules/,
      }),
    ).toBe(rules);
    expect(
      screen.getByRole("switch", {
        name:
          language === "ko"
            ? "Buzz에서 GitHub 링크 열기"
            : "Open GitHub links in Buzz",
      }),
    ).toBe(toggle);
    expect(
      screen.getByRole("combobox", {
        name:
          language === "ko"
            ? "일치하는 규칙이 없을 때"
            : "When no rule matches",
      }),
    ).toBe(select);
    expect(
      screen.getByText(
        language === "ko"
          ? "gh에 로그인한 GitHub 계정을 확인하는 중…"
          : "Checking which GitHub account gh is signed in to…",
      ),
    ).toBeVisible();
    expect(rules).toHaveFocus();
    expect(rules.value).toBe(raw);
    expect(rules.selectionStart).toBe(2);
    expect(rules.selectionEnd).toBe(9);
    expect(account.spawn).toHaveBeenCalledOnce();
    expect(account.kill).not.toHaveBeenCalled();
    expect(active).not.toHaveBeenCalled();
  }
  expect(write.mock.calls.map(([key]) => key)).toEqual([
    localeStorageKey,
    localeStorageKey,
  ]);
  act(() => setLanguage("ko"));
  await act(async () =>
    account.release({ viewer: { login: "Opaque-Handle" } }),
  );
  expect(
    await screen.findByText(
      "gh를 통해 GitHub에 Opaque-Handle 계정으로 로그인했습니다.",
    ),
  ).toBeVisible();
  expect(screen.getByRole("textbox", { name: /규칙/ })).toBe(rules);
  expect(rules).toHaveFocus();
  await user.click(select);
  await user.click(
    await screen.findByRole("option", { name: "작업 재개 안 함" }),
  );
  await user.click(screen.getByRole("button", { name: "저장" }));
  expect(active).toHaveBeenCalledOnce();
  expect(loadPolicy().text).toBe(raw);
  expect(loadPolicy().fallback).toBe("deny");
  expect(write.mock.calls.filter(([key]) => key === POLICY_KEY)).toEqual([
    [POLICY_KEY, JSON.stringify({ version: 2, text: raw, fallback: "deny" })],
  ]);
  const syntax = screen.getByRole("button", { name: "규칙 문법" });
  await user.click(syntax);
  expect(syntax).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText(/author:@me는/)).toHaveTextContent("[bot]");
  expect(screen.getByText(/패턴은 JavaScript/)).toHaveTextContent("\\q");
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "Rule syntax" })).toBe(syntax);
  expect(syntax).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText(/author:@me is/)).toBeVisible();
  expect(account.spawn).toHaveBeenCalledOnce();
  expect(account.kill).not.toHaveBeenCalled();
});
it("retains an opaque same-English gh error and account result while only translating its owned caption", async () => {
  const account = heldAccount(),
    raw = "Your choice could not be saved. Try changing it again.";
  render(<GitHubSettings active={() => true} gh={account.gh} />);
  await waitFor(() => expect(account.input).toHaveLength(1));
  await act(async () => account.release(null, raw));
  const caption = await screen.findByText(
    `gh couldn’t read your GitHub account: ${raw}`,
  );
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByText(
        language === "ko"
          ? `gh에서 GitHub 계정을 확인하지 못했습니다: ${raw}`
          : `gh couldn’t read your GitHub account: ${raw}`,
      ),
    ).toBe(caption);
    expect(account.spawn).toHaveBeenCalledOnce();
    expect(account.kill).not.toHaveBeenCalled();
  }
});

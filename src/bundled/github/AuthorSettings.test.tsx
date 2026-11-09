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
import { afterEach, assert, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { AuthorSettings } from "./AuthorSettings";
import { DEFAULT_RULES, loadPolicy, POLICY_KEY } from "./authors";
import { GhUnavailable, GitHubError, type GitHubCli } from "./gh";

const fallback = () =>
  screen.getByRole("combobox", { name: "When no rule matches" });
const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) => {
  await user.click(fallback());
  await user.click(await screen.findByRole("option", { name }));
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setLanguage("en");
  localStorage.clear();
});

it("shows the default rules, and saves only rules that parse", async () => {
  const user = userEvent.setup();
  render(<AuthorSettings active={() => true} />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Comments from anyone no rule denies can wake your agents.",
  );
  expect(fallback()).toHaveTextContent("Wake the agent");
  const rules = screen.getByRole("textbox", { name: /Rules/ });
  expect(rules).toHaveValue(DEFAULT_RULES);
  const save = screen.getByRole("button", { name: "Save" });
  expect(save).toBeDisabled();
  await user.clear(rules);
  await user.type(rules, "deny author:@me prefix:🤖{Enter}allow author:/(/");
  await user.click(save);
  expect(rules).toBeInvalid();
  expect(rules).toHaveAccessibleDescription(
    expect.stringContaining("Line 2: Invalid regular expression"),
  );
  expect(loadPolicy().text).toBe(DEFAULT_RULES);
  // Editing checks the rules again, so restoring the saved ones clears it.
  await user.clear(rules);
  await user.type(rules, DEFAULT_RULES);
  expect(rules).toBeValid();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(save).toBeDisabled();
  await user.clear(rules);
  await user.type(
    rules,
    "deny author:@me prefix:🤖{Enter}allow org:block{Enter}  allow author:copilot-pull-request-reviewer[[bot]  ",
  );
  await choose(user, "Don’t wake it");
  await user.click(save);
  expect(loadPolicy().text).toBe(
    "deny author:@me prefix:🤖\nallow org:block\nallow author:copilot-pull-request-reviewer[bot]",
  );
  expect(loadPolicy().fallback).toBe("deny");
  expect(rules).toHaveValue(loadPolicy().text);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(save).toBeDisabled();
  await choose(user, "Wake the agent");
  expect(save).toBeEnabled();
  await user.click(save);
  expect(loadPolicy().fallback).toBe("allow");
  expect(screen.getByRole("status")).toBeInTheDocument();
});

it("shows saved rules that no longer parse, with why, until they are fixed", async () => {
  const user = userEvent.setup();
  const text = "allow author:/^(?!eve$)[a-z]+$/";
  localStorage.setItem(
    POLICY_KEY,
    JSON.stringify({ version: 2, text, fallback: "deny" }),
  );
  render(<AuthorSettings active={() => true} />);
  const rules = screen.getByRole("textbox", { name: /Rules/ });
  expect(rules).toHaveValue(text);
  expect(rules).toBeInvalid();
  expect(rules).toHaveAccessibleDescription(
    expect.stringContaining("Line 1: a pattern's groups can only be"),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "no comment or review wakes your agents",
  );
  expect(fallback()).toHaveTextContent("Don’t wake it");
  await user.clear(rules);
  await user.type(rules, "deny author:eve{Enter}allow author:/^[[a-z]+$/");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(loadPolicy().error).toBeUndefined();
  expect(rules).toBeValid();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("names the account gh is signed in to, which author:@me means", async () => {
  const queries: string[] = [];
  const gh = (async (query: string) => {
    queries.push(query);
    return { viewer: { login: "octocat" } };
  }) as GitHubCli;
  render(<AuthorSettings active={() => true} gh={gh} />);
  expect(
    await screen.findByText("Signed in to GitHub as octocat through gh."),
  ).toBeInTheDocument();
  expect(queries).toEqual(["query{viewer{login}}"]);
});

it("says why gh cannot name the account", async () => {
  for (const [error, text] of [
    [
      new GhUnavailable("Processes require an installed desktop plugin"),
      "gh couldn’t read your GitHub account: Processes require an installed desktop plugin",
    ],
    [
      new GitHubError("Bad credentials"),
      "gh couldn’t read your GitHub account: Bad credentials",
    ],
  ] as const) {
    const gh = (async () => {
      throw error;
    }) as GitHubCli;
    render(<AuthorSettings active={() => true} gh={gh} />);
    expect(await screen.findByText(text)).toBeInTheDocument();
    cleanup();
  }
});

it("keeps the rule syntax behind a disclosure", async () => {
  const user = userEvent.setup();
  render(<AuthorSettings active={() => true} />);
  const syntax = screen.getByRole("button", { name: "Rule syntax" });
  expect(syntax).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText(/author:@me is your GitHub account/)).toBeNull();
  await user.click(syntax);
  expect(screen.getByText(/author:@me is your GitHub account/)).toBeVisible();
});

it("retains canonical invalid rules, parse diagnostics and deny selection while translating their surrounding settings", async () => {
  const raw = "deny author:Opaque-Handle\nnot-a-rule author:raw-user",
    stored = JSON.stringify({ version: 2, text: raw, fallback: "deny" });
  localStorage.setItem(POLICY_KEY, stored);
  render(<AuthorSettings active={() => true} />);
  const rules = screen.getByRole("textbox", { name: /Rules/ });
  assert(rules instanceof HTMLTextAreaElement);
  rules.focus();
  rules.setSelectionRange(5, 11);
  const reason = "Line 2: it must start with allow or deny";
  expect(rules).toHaveAccessibleDescription(expect.stringContaining(reason));
  expect(rules).toBeInvalid();
  const select = fallback();
  const notice = screen.getByRole("status");
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("textbox", {
        name: language === "ko" ? /규칙/ : /Rules/,
      }),
    ).toBe(rules);
    expect(rules).toHaveFocus();
    expect(rules.value).toBe(raw);
    expect(rules.selectionStart).toBe(5);
    expect(rules.selectionEnd).toBe(11);
    expect(rules).toBeInvalid();
    expect(rules).toHaveAccessibleDescription(expect.stringContaining(reason));
    expect(
      screen.getByRole("combobox", {
        name:
          language === "ko"
            ? "일치하는 규칙이 없을 때"
            : "When no rule matches",
      }),
    ).toBe(select);
    expect(select).toHaveTextContent(
      language === "ko" ? "작업 재개 안 함" : "Don’t wake it",
    );
    expect(screen.getByRole("status")).toBe(notice);
    expect(notice).toHaveTextContent(
      language === "ko"
        ? "저장된 규칙을 해석할 수 없습니다."
        : "Your saved rules no longer parse",
    );
    expect(localStorage.getItem(POLICY_KEY)).toBe(stored);
  }
});
it("keeps an opaque saved failure across language changes and never saves through an inactive contribution", async () => {
  let active = true;
  const rawError = "Signed in to GitHub as Opaque-Handle through gh.",
    raw = "deny author:Opaque-Handle prefix:Raw 한글";
  render(<AuthorSettings active={() => active} />);
  const rules = screen.getByRole("textbox", { name: /Rules/ });
  fireEvent.change(rules, { target: { value: raw } });
  const original = Storage.prototype.setItem;
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(function (this: Storage, name: string, value: string) {
      if (name === POLICY_KEY) throw new Error(rawError);
      original.call(this, name, value);
    });
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  const alert = screen.getByRole("alert");
  rules.focus();
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent(rawError);
    expect(rules).toHaveFocus();
    expect(rules).toHaveValue(raw);
  }
  expect(write.mock.calls.filter(([key]) => key === POLICY_KEY)).toHaveLength(
    1,
  );
  write.mockRestore();
  active = false;
  act(() => setLanguage("ko"));
  await userEvent.click(screen.getByRole("button", { name: "저장" }));
  expect(localStorage.getItem(POLICY_KEY)).toBeNull();
  expect(screen.getByRole("alert")).toHaveTextContent(rawError);
  active = true;
  await userEvent.click(screen.getByRole("button", { name: "저장" }));
  expect(loadPolicy().text).toBe(raw);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { LinkSettings } from "./LinkSettings";
import type { GitHubCli } from "./gh";
import { GitHubSettings } from "./GitHubSettings";
import {
  openGitHubLinksInBuzz,
  setOpenGitHubLinksInBuzz,
} from "./link-preference";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setLanguage("en");
  localStorage.clear();
});

it("defaults to Buzz and persists browser opening across settings remounts", async () => {
  const user = userEvent.setup();
  const view = render(<LinkSettings active={() => true} />);
  const toggle = screen.getByRole("switch", {
    name: "Open GitHub links in Buzz",
  });
  expect(toggle).toBeChecked();
  await user.click(toggle);
  expect(toggle).not.toBeChecked();
  expect(openGitHubLinksInBuzz()).toBe(false);
  view.unmount();
  render(<LinkSettings active={() => true} />);
  const restored = screen.getByRole("switch");
  expect(restored).not.toBeChecked();
  restored.focus();
  await user.keyboard(" ");
  expect(restored).toBeChecked();
  expect(openGitHubLinksInBuzz()).toBe(true);
});

it("updates mounted controls for another window's saved choice and storage clear", () => {
  render(<LinkSettings active={() => true} />);
  act(() => setOpenGitHubLinksInBuzz(false));
  expect(screen.getByRole("switch")).not.toBeChecked();
  const key = localStorage.key(0);
  if (!key) throw new Error("Preference was not saved");
  act(() => {
    localStorage.setItem(key, "on");
    window.dispatchEvent(
      new StorageEvent("storage", { key, storageArea: localStorage }),
    );
  });
  expect(screen.getByRole("switch")).toBeChecked();
  act(() => setOpenGitHubLinksInBuzz(false));
  act(() => {
    localStorage.clear();
    window.dispatchEvent(
      new StorageEvent("storage", { key: null, storageArea: localStorage }),
    );
  });
  expect(screen.getByRole("switch")).toBeChecked();
});

it("retains the saved choice on write failure and allows retry", async () => {
  render(<LinkSettings active={() => true} />);
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
  await userEvent.click(screen.getByRole("switch"));
  expect(screen.getByRole("switch")).toBeChecked();
  expect(openGitHubLinksInBuzz()).toBe(true);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Your choice could not be saved",
  );
  write.mockRestore();
  await userEvent.click(screen.getByRole("switch"));
  expect(screen.getByRole("switch")).not.toBeChecked();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("does not save through an inactive settings contribution", async () => {
  render(<LinkSettings active={() => false} />);
  await userEvent.click(screen.getByRole("switch"));
  expect(screen.getByRole("switch")).toBeChecked();
  expect(localStorage.length).toBe(0);
});

it("preserves the default when storage cannot be read or has an unknown value", () => {
  setOpenGitHubLinksInBuzz(false);
  const key = localStorage.key(0);
  if (!key) throw new Error("Preference was not saved");
  localStorage.setItem(key, "invalid");
  expect(openGitHubLinksInBuzz()).toBe(true);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Storage unavailable");
  });
  expect(openGitHubLinksInBuzz()).toBe(true);
});

it("groups links and comment authors under a single GitHub heading", async () => {
  render(<GitHubSettings active={() => true} />);
  expect(
    screen.getByRole("heading", { level: 2, name: "GitHub" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { level: 3, name: "Links" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { level: 3, name: "Comment authors" }),
  ).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("switch", { name: "Open GitHub links in Buzz" }),
  );
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
});

it("shows the signed-in account alongside the link setting", async () => {
  const gh = (async () => ({ viewer: { login: "octocat" } })) as GitHubCli;
  render(<GitHubSettings active={() => true} gh={gh} />);
  expect(
    screen.getByRole("switch", { name: "Open GitHub links in Buzz" }),
  ).toBeInTheDocument();
  expect(
    await screen.findByText("Signed in to GitHub as octocat through gh."),
  ).toBeInTheDocument();
});

it("keeps a failed link choice and focused switch while the recovery caption translates, then retries the original storage value", async () => {
  const active = vi.fn(() => true),
    key = "buzz.github.open-links-in-buzz.v1";
  render(<LinkSettings active={active} />);
  const toggle = screen.getByRole("switch", {
    name: "Open GitHub links in Buzz",
  });
  toggle.focus();
  const original = Storage.prototype.setItem;
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(function (this: Storage, name: string, value: string) {
      if (name === key) throw new Error("Opaque storage failure");
      original.call(this, name, value);
    });
  await userEvent.click(toggle);
  const alert = screen.getByRole("alert");
  expect(toggle).toBeChecked();
  expect(active).toHaveBeenCalledOnce();
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("switch", {
        name:
          language === "ko"
            ? "Buzz에서 GitHub 링크 열기"
            : "Open GitHub links in Buzz",
      }),
    ).toBe(toggle);
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent(
      language === "ko"
        ? "선택을 저장하지 못했습니다. 다시 변경해 주세요."
        : "Your choice could not be saved. Try changing it again.",
    );
    expect(toggle).toHaveFocus();
    expect(toggle).toBeChecked();
    expect(active).toHaveBeenCalledOnce();
  }
  expect(write.mock.calls.filter(([name]) => name === key)).toEqual([
    [key, "off"],
  ]);
  write.mockRestore();
  act(() => setLanguage("ko"));
  await userEvent.click(toggle);
  expect(active).toHaveBeenCalledTimes(2);
  expect(toggle).not.toBeChecked();
  expect(localStorage.getItem(key)).toBe("off");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

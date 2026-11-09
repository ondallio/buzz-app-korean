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
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { ContextMenuRoot, MenuPopup } from "../../shared/design-system/ui/Menu";
import { ToastProvider } from "../../shared/design-system/ui/Toast";
import type { ChannelLifecycleCapability } from "../../features/relay/channel-lifecycle";
import { ChannelLifecycleDialog } from "./ChannelLifecycleDialog";
import { ChannelLifecycleMenu } from "./ChannelLifecycleMenu";
import { ChannelSidebarRow } from "./ChannelSidebarRow";
import { NewWorkspaceDialog } from "./SoloChatMenu";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { ChannelPrivacyConfirmation } from "./ChannelPrivacyConfirmation";
import { ChannelCopyLinkMenuItem } from "./ChannelCopyLinkMenuItem";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});

function capability() {
  return {
    available: true,
    load: vi.fn<ChannelLifecycleCapability["load"]>(),
    run: vi.fn<ChannelLifecycleCapability["run"]>(async () => {}),
    snapshot: () => ({ status: "ready", hidden: [] }),
    subscribe: () => () => {},
    observeRemoval: () => () => {},
    refreshVisibility: async () => {},
  } satisfies ChannelLifecycleCapability;
}

it("updates muted/remove names on the same sidebar buttons while preserving literal channel and selection IDs", async () => {
  const select = vi.fn(),
    hide = vi.fn();
  render(
    <ChannelSidebarRow
      channel={{ id: "raw-id", name: "User {name} 한글", channelType: "dm" }}
      icon={<svg />}
      muted
      onSelect={select}
      onPrepare={() => {}}
      onHideDm={hide}
    />,
  );
  const row = screen.getByRole("button", { name: "User {name} 한글Muted" });
  const remove = screen.getByRole("button", {
    name: "Remove User {name} 한글 from DMs",
  });
  remove.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "User {name} 한글음소거됨" })).toBe(
    row,
  );
  expect(
    screen.getByRole("button", { name: "DM에서 User {name} 한글 제거" }),
  ).toBe(remove);
  expect(remove).toHaveFocus();
  act(() => setLanguage("en"));
  expect(
    screen.getByRole("button", { name: "Remove User {name} 한글 from DMs" }),
  ).toBe(remove);
  await userEvent.setup().click(row);
  expect(select).toHaveBeenCalledExactlyOnceWith("raw-id");
  await userEvent.setup().click(remove);
  expect(hide).toHaveBeenCalledExactlyOnceWith("raw-id");
});

it("keeps the same focused lifecycle menu item and canonical action across language changes", async () => {
  const lifecycle = capability();
  const choose = vi.fn();
  const viewer = "a".repeat(64);
  render(
    <ContextMenuRoot open>
      <MenuPopup>
        <ChannelLifecycleMenu
          channel={{
            id: "11111111-1111-4111-8111-111111111111",
            name: "User {name}",
            channelType: "stream",
            viewerRole: "owner",
            owners: [viewer],
            members: [viewer],
          }}
          session={{
            viewer,
            channelLifecycle: lifecycle,
            profiles: {
              snapshot: () => new Map(),
              subscribe: () => () => {},
              ensure: async () => {},
            },
          }}
          choose={choose}
          disabled={false}
          separator={false}
        />
      </MenuPopup>
    </ContextMenuRoot>,
  );
  const item = await screen.findByRole("menuitem", { name: "Delete channel" });
  item.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("menuitem", { name: "채널 삭제" })).toBe(item);
  expect(item).toHaveFocus();
  act(() => setLanguage("en"));
  expect(screen.getByRole("menuitem", { name: "Delete channel" })).toBe(item);
  await userEvent.setup().keyboard("{Enter}");
  expect(choose).toHaveBeenCalledExactlyOnceWith("delete");
  expect(lifecycle.run).not.toHaveBeenCalled();
});

it("keeps the destructive target, focused Cancel and pending write identity while translating the dialog", async () => {
  const lifecycle = capability();
  let finish!: () => void;
  lifecycle.run.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <ToastProvider>
      <ChannelLifecycleDialog
        channelId="raw-id"
        channelName="User {name} 한글"
        action="delete"
        lifecycle={lifecycle}
        close={() => {}}
        completed={() => {}}
      />
    </ToastProvider>,
  );
  const dialog = screen.getByRole("dialog", {
    name: "Delete User {name} 한글?",
  });
  const cancel = screen.getByRole("button", { name: "Cancel" });
  cancel.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("dialog", { name: "User {name} 한글 삭제?" })).toBe(
    dialog,
  );
  expect(screen.getByRole("button", { name: "취소" })).toBe(cancel);
  expect(cancel).toHaveFocus();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "채널 삭제" }));
  expect(lifecycle.run).toHaveBeenCalledExactlyOnceWith(
    "delete",
    "raw-id",
    expect.any(AbortSignal),
  );
  try {
    act(() => setLanguage("en"));
    expect(lifecycle.run).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Deleting channel…")).toBeInTheDocument();
  } finally {
    await act(async () => finish());
  }
});

it("retains a workspace draft, caret and focus and submits the unmodified user name", async () => {
  const create = vi.fn(() => false);
  render(
    <NewWorkspaceDialog
      name="User {name} 한글"
      create={create}
      close={() => {}}
    />,
  );
  const input = screen.getByRole("textbox", { name: "Workspace name" });
  await userEvent.setup().type(input, "Draft {{name} 한글");
  if (!(input instanceof HTMLInputElement))
    throw new Error("Expected workspace input");
  input.setSelectionRange(2, 5);
  act(() => setLanguage("ko"));
  expect(screen.getByRole("textbox", { name: "작업 공간 이름" })).toBe(input);
  expect(input).toHaveValue("Draft {name} 한글");
  expect(input).toHaveFocus();
  expect(input.selectionStart).toBe(2);
  expect(input.selectionEnd).toBe(5);
  expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
    "User {name} 한글 채팅을 Buzz에서 동기화되는 개인 작업 공간으로 이동합니다.",
  );
  const form = input.closest("form");
  if (!form) throw new Error("Expected workspace form");
  fireEvent.submit(form);
  expect(create).toHaveBeenCalledExactlyOnceWith("Draft {name} 한글");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "작업 공간을 사용할 수 없습니다. 이 대화상자를 닫고 다시 시도하세요.",
  );
  act(() => setLanguage("en"));
  expect(screen.getByRole("textbox", { name: "Workspace name" })).toBe(input);
  expect(input).toHaveFocus();
});

it("keeps an archive result and Undo live after its originating dialog has unmounted", async () => {
  const undo = vi.fn();
  function Host() {
    const [open, setOpen] = useState(true);
    return (
      <ToastProvider>
        {open && (
          <ChannelLifecycleDialog
            channelId="raw-id"
            channelName="User {name} 한글"
            noun="chat"
            action="archive"
            lifecycle={capability()}
            close={() => setOpen(false)}
            completed={() => setOpen(false)}
            undo={undo}
          />
        )}
      </ToastProvider>
    );
  }
  render(<Host />);
  expect(
    await screen.findByText("Chat archived: User {name} 한글"),
  ).toBeInTheDocument();
  const dialog = screen.getByRole("dialog");
  const action = screen.getByRole("button", { name: "Undo" });
  act(() => setLanguage("ko"));
  expect(screen.getByText("채팅 보관됨: User {name} 한글")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toBe(dialog);
  expect(screen.getByRole("button", { name: "실행 취소" })).toBe(action);
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "Undo" })).toBe(action);
  fireEvent.click(action);
  expect(undo).toHaveBeenCalledExactlyOnceWith();
});

it("preserves the privacy choice and focused checkbox while its complete consequence changes language", async () => {
  function Host() {
    const [checked, setChecked] = useState(false);
    return (
      <Dialog open onOpenChange={() => {}} title="Privacy fixture">
        <ChannelPrivacyConfirmation
          visibility="public"
          checked={checked}
          onCheckedChange={setChecked}
        />
      </Dialog>
    );
  }
  render(<Host />);
  const choice = screen.getByRole("checkbox", {
    name: "Don’t show me this again",
  });
  await userEvent.setup().click(choice);
  act(() => setLanguage("ko"));
  expect(screen.getByRole("checkbox", { name: "다시 표시하지 않기" })).toBe(
    choice,
  );
  expect(choice).toBeChecked();
  expect(choice).toHaveFocus();
  expect(
    screen.getByText(
      "이 커뮤니티의 모든 사용자가 채널의 전체 기록을 볼 수 있습니다.",
    ),
  ).toBeInTheDocument();
  act(() => setLanguage("en"));
  expect(
    screen.getByRole("checkbox", { name: "Don’t show me this again" }),
  ).toBe(choice);
  expect(choice).toBeChecked();
});

it("copies the canonical raw channel link and keeps its result live after the menu closes", async () => {
  const user = userEvent.setup();
  function Host() {
    const [open, setOpen] = useState(true);
    return (
      <ToastProvider>
        {open && (
          <ContextMenuRoot open onOpenChange={setOpen}>
            <MenuPopup>
              <ChannelCopyLinkMenuItem channelId="User {id}/한글" />
            </MenuPopup>
          </ContextMenuRoot>
        )}
      </ToastProvider>
    );
  }
  render(<Host />);
  const item = await screen.findByRole("menuitem", { name: "Copy link" });
  item.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("menuitem", { name: "링크 복사" })).toBe(item);
  expect(item).toHaveFocus();
  await user.click(item);
  expect(await navigator.clipboard.readText()).toBe(
    "buzz://channel/User%20%7Bid%7D%2F%ED%95%9C%EA%B8%80",
  );
  expect(await screen.findByText("링크를 복사했습니다.")).toBeInTheDocument();
  expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  const toast = screen.getByRole("dialog");
  act(() => setLanguage("en"));
  expect(screen.getByText("Link copied.")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toBe(toast);
});

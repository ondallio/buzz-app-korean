// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { createRelaySession } from "../../features/relay/session";
import { keypair, signed } from "../../features/relay/testing";
import {
  EntityFailure,
  type Entity,
  type EntityDetail,
} from "../../features/repos/destinations";
import { entityHref } from "../../features/repos/routes";
import type { ComposerToolProps } from "../../features/conversation/contracts";
import { setLanguage } from "../../shared/i18n/language";
import { ResourcePicker } from "./ResourcePicker";

const owners: { dispose(): void }[] = [];
afterEach(() => {
  cleanup();
  setLanguage("en");
  for (const owner of owners.splice(0)) owner.dispose();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

function fixture(title = "Issue 사용자 {raw}") {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => {},
  });
  const owner = createRelaySession(null);
  owners.push(owner);
  const signer = keypair();
  const event = signed(signer, {
    kind: 30617,
    created_at: 1,
    content: "",
    tags: [
      ["d", "raw-repo"],
      ["name", "Repo {raw}"],
    ],
  });
  const entity: Entity = {
    type: "repo",
    owner: signer.pubkey,
    dtag: "raw-repo",
    address: `30617:${signer.pubkey}:raw-repo`,
    name: "Repo {raw}",
    description: "",
    event,
  };
  const issue = signed(signer, {
    kind: 1621,
    created_at: 2,
    content: "",
    tags: [["a", entity.address], ...(title ? [["subject", title]] : [])],
  });
  const home = { status: "home", repositories: [entity] } as const;
  vi.spyOn(owner.session.repositories, "peekHome").mockReturnValue({
    ...home,
    repositories: [entity],
  });
  const readHome = vi
    .spyOn(owner.session.repositories, "home")
    .mockResolvedValue({ ...home, repositories: [entity] });
  const load = vi.spyOn(owner.session.repositories, "load").mockImplementation(
    async (route): Promise<EntityDetail> => ({
      entity,
      channels: [],
      activity: [],
      items: "tab" in route && route.tab === "issues" ? [issue] : [],
      ...("id" in route ? { item: issue } : {}),
    }),
  );
  const insert = vi.fn<ComposerToolProps["insertResource"]>(() => true);
  const props: ComposerToolProps = {
    session: owner.session,
    scope: "fixture",
    channelId: "raw-channel",
    disabled: false,
    recipients: [],
    insertText: () => true,
    insertMention: () => true,
    insertMentions: () => true,
    replaceRecipients: () => true,
    insertResource: insert,
    focus() {},
    open: () => true,
    canOpen: () => true,
  };
  const view = render(
    <form>
      <ResourcePicker {...props} />
    </form>,
  );
  return { view, props, entity, issue, load, readHome, insert };
}

it("keeps the open resource picker, raw query and one held validation across languages", async () => {
  const h = fixture();
  const user = userEvent.setup();
  await waitFor(() => expect(h.readHome).toHaveBeenCalledTimes(1));
  await user.click(
    screen.getByRole("button", { name: "Add issue or pull request" }),
  );
  const row = await screen.findByRole("button", {
    name: "Issue 사용자 {raw}, Issue in Repo {raw}",
  });
  const input = screen.getByRole("searchbox", {
    name: "Search issues and pull requests",
  });
  await user.type(input, "사용자");
  const reads = h.load.mock.calls.length;
  act(() => setLanguage("ko"));
  expect(screen.getByRole("searchbox", { name: "이슈 및 PR 검색" })).toBe(
    input,
  );
  expect(input).toHaveValue("사용자");
  expect(input).toHaveFocus();
  expect(
    screen.getByRole("button", {
      name: "Repo {raw}의 이슈: Issue 사용자 {raw}",
    }),
  ).toBe(row);
  expect(
    screen.getByRole("button", { name: "이슈 및 PR 검색 지우기" }),
  ).toBeVisible();
  expect(h.load).toHaveBeenCalledTimes(reads);
  let finish: (value: EntityDetail) => void = () => {
    throw new Error("Missing validation gate");
  };
  h.load.mockImplementationOnce(
    () =>
      new Promise<EntityDetail>((resolve) => {
        finish = resolve;
      }),
  );
  await user.click(row);
  const call = h.load.mock.calls.at(-1);
  const signal = call?.[1];
  try {
    act(() => setLanguage("en"));
    expect(input).toHaveValue("사용자");
    expect(input).toHaveFocus();
    expect(signal?.aborted).toBe(false);
    expect(h.insert).not.toHaveBeenCalled();
    expect(h.load).toHaveBeenCalledTimes(reads + 1);
  } finally {
    await act(async () =>
      finish({
        entity: h.entity,
        channels: [],
        activity: [],
        items: [],
        item: h.issue,
      }),
    );
  }
  await waitFor(() => expect(h.insert).toHaveBeenCalledTimes(1));
  expect(h.insert).toHaveBeenCalledExactlyOnceWith({
    uri: entityHref({
      type: "issue",
      owner: h.entity.owner,
      dtag: h.entity.dtag,
      id: h.issue.id,
    }),
    label: "Issue 사용자 {raw}",
  });
  expect(h.readHome).toHaveBeenCalledTimes(1);
});

it("translates only the untitled fallback while keeping the inserted canonical label", async () => {
  const h = fixture("");
  const user = userEvent.setup();
  await waitFor(() => expect(h.readHome).toHaveBeenCalledTimes(1));
  act(() => setLanguage("ko"));
  await user.click(screen.getByRole("button", { name: "이슈 또는 PR 추가" }));
  const row = await screen.findByRole("button", {
    name: "Repo {raw}의 이슈: 이슈",
  });
  const input = screen.getByRole("searchbox", { name: "이슈 및 PR 검색" });
  await user.type(input, "이슈");
  expect(row).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "이슈 및 PR 검색 지우기" }),
  );
  expect(input).toHaveValue("");
  expect(input).toHaveFocus();
  await user.click(row);
  await waitFor(() => expect(h.insert).toHaveBeenCalledTimes(1));
  expect(h.insert.mock.calls[0]?.[0].label).toBe("Issue");
});

it("keeps an authored title identical to the canonical fallback literal", async () => {
  const h = fixture("Issue");
  const user = userEvent.setup();
  await waitFor(() => expect(h.readHome).toHaveBeenCalledTimes(1));
  act(() => setLanguage("ko"));
  await user.click(screen.getByRole("button", { name: "이슈 또는 PR 추가" }));
  const row = await screen.findByRole("button", {
    name: "Repo {raw}의 이슈: Issue",
  });
  expect(screen.getByText("Issue", { exact: true })).toBeVisible();
  await user.click(row);
  await waitFor(() => expect(h.insert).toHaveBeenCalledTimes(1));
  expect(h.insert.mock.calls[0]?.[0].label).toBe("Issue");
  expect(Object.keys(h.insert.mock.calls[0]?.[0] ?? {}).sort()).toEqual([
    "label",
    "uri",
  ]);
});

it("translates its retained validation failure but preserves an identical opaque host rejection", async () => {
  const h = fixture();
  const user = userEvent.setup();
  await waitFor(() => expect(h.readHome).toHaveBeenCalledTimes(1));
  await user.click(
    screen.getByRole("button", { name: "Add issue or pull request" }),
  );
  const row = await screen.findByRole("button", {
    name: "Issue 사용자 {raw}, Issue in Repo {raw}",
  });
  h.load.mockRejectedValueOnce(new EntityFailure("not-found"));
  await user.click(row);
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("This issue is no longer available.");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("alert")).toBe(alert);
  expect(alert).toHaveTextContent("이 이슈는 더 이상 사용할 수 없습니다.");
  expect(
    screen.getByRole("searchbox", { name: "이슈 및 PR 검색" }),
  ).toHaveFocus();
  expect(h.insert).not.toHaveBeenCalled();
  h.insert.mockReturnValueOnce("This issue is no longer available.");
  await user.click(
    screen.getByRole("button", {
      name: "Repo {raw}의 이슈: Issue 사용자 {raw}",
    }),
  );
  await waitFor(() => expect(h.insert).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "This issue is no longer available.",
  );
  expect(h.insert.mock.calls[0]?.[0].label).toBe("Issue 사용자 {raw}");
  expect(h.readHome).toHaveBeenCalledTimes(1);
});

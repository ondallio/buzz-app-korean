// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { Context } from "@deepseek-ai/cordis";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../shared/i18n/language";
import { createCommunities } from "../features/communities/service";
import {
  readRepositoriesFolder,
  repositoriesKey,
  saveRepositoriesFolder,
} from "../features/communities/repositories";
import { CommunityRepositoriesSettings } from "./CommunityRepositoriesSettings";

const native = vi.hoisted(() => ({ invoke: vi.fn(), desktop: true }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: native.invoke,
  isTauri: () => native.desktop,
}));
const viewer = "a".repeat(64);
const community = "https://community.example";
const roots: Context[] = [];
async function setup() {
  const root = new Context();
  roots.push(root);
  const communities = createCommunities(
    root,
    false,
    undefined,
    "",
    undefined,
    Promise.resolve(viewer),
  );
  await act(async () => {
    await Promise.resolve();
  });
  communities.joined(
    { id: community, name: "Community" },
    { name: "You", picture: "" },
  );
  const view = render(
    <CommunityRepositoriesSettings
      communities={communities}
      community={community}
      viewer={viewer}
    />,
  );
  return { view, communities, user: userEvent.setup() };
}
afterEach(async () => {
  cleanup();
  setLanguage("en");
  for (const root of roots.splice(0)) await root.fiber.dispose();
  localStorage.clear();
  vi.restoreAllMocks();
  native.invoke.mockReset();
  native.desktop = true;
});

it("validates and saves a chosen folder, preserves drafts on failure, and restores the default without touching other accounts", async () => {
  const { user } = await setup();
  saveRepositoriesFolder(community, "b".repeat(64), "/other");
  native.invoke.mockResolvedValueOnce("~/Development");
  await user.click(screen.getByRole("button", { name: "Choose folder…" }));
  expect(screen.getByLabelText("Repositories folder")).toHaveValue(
    "~/Development",
  );
  expect(readRepositoriesFolder(community, viewer)).toBe("");
  native.invoke.mockRejectedValueOnce(
    "The repositories folder is unavailable.",
  );
  await user.click(screen.getByRole("button", { name: "Save folder" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
  expect(screen.getByLabelText("Repositories folder")).toHaveValue(
    "~/Development",
  );
  expect(screen.queryByRole("status")).toBeNull();
  native.invoke.mockResolvedValueOnce("/Users/you/Development");
  await user.click(screen.getByRole("button", { name: "Save folder" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Repositories folder saved on this device. Claude and Goose use it in new sessions; Codex uses it on future turns.",
  );
  expect(readRepositoriesFolder(community, viewer)).toBe(
    "/Users/you/Development",
  );
  await user.click(screen.getByRole("button", { name: "Restore default" }));
  await waitFor(() =>
    expect(localStorage.getItem(repositoriesKey(community, viewer))).toBeNull(),
  );
  expect(readRepositoriesFolder(community, "b".repeat(64))).toBe("/other");
});

it.each(["picker", "typed"])(
  "saves the native home-directory result from a %s selection",
  async (source) => {
    const { user } = await setup();
    const input = screen.getByLabelText("Repositories folder");
    if (source === "picker") {
      native.invoke.mockResolvedValueOnce("~");
      await user.click(screen.getByRole("button", { name: "Choose folder…" }));
    } else {
      await user.type(input, "/Users/you");
    }
    native.invoke.mockResolvedValueOnce("~");
    await user.click(screen.getByRole("button", { name: "Save folder" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "saved on this device",
    );
    expect(input).toHaveValue("~");
    expect(readRepositoriesFolder(community, viewer)).toBe("~");
  },
);

it("blocks a late native result after community removal and keeps dirty drafts through another window’s change", async () => {
  const { user, communities } = await setup();
  const input = screen.getByLabelText("Repositories folder");
  await user.type(input, "/draft");
  act(() => {
    saveRepositoriesFolder(community, viewer, "/other-window");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: repositoriesKey(community, viewer),
        storageArea: localStorage,
      }),
    );
  });
  expect(input).toHaveValue("/draft");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(input).toHaveValue("/other-window");
  await user.clear(input);
  await user.type(input, "/new-draft");
  let release!: (path: string) => void;
  native.invoke.mockReturnValueOnce(
    new Promise<string>((resolve) => {
      release = resolve;
    }),
  );
  await user.click(screen.getByRole("button", { name: "Save folder" }));
  expect(screen.getByRole("button", { name: "Save folder" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  try {
    await act(async () => {
      await communities.leave(community, { purge: false });
    });
  } finally {
    await act(async () => {
      release("/validated");
    });
  }
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "community changed",
  );
  expect(readRepositoriesFolder(community, viewer)).toBe("/other-window");
  expect(input).toHaveValue("/new-draft");
});

it("does not offer unsupported browser filesystem writes", async () => {
  native.desktop = false;
  await setup();
  expect(screen.getByLabelText("Repositories folder")).toHaveAttribute(
    "readonly",
  );
  expect(screen.queryByRole("button", { name: "Save folder" })).toBeNull();
  expect(native.invoke).not.toHaveBeenCalled();
});

it("keeps the same folder draft, selection and native save payload through language changes and retry", async () => {
  const { user } = await setup();
  const input = screen.getByLabelText(
    "Repositories folder",
  ) as HTMLInputElement;
  native.invoke.mockClear();
  await user.type(input, "/Repositories folder");
  input.setSelectionRange(1, 6);
  act(() => setLanguage("ko"));
  expect(screen.getByLabelText("저장소 폴더")).toBe(input);
  expect(input).toHaveFocus();
  expect(input).toHaveValue("/Repositories folder");
  expect([input.selectionStart, input.selectionEnd]).toEqual([1, 6]);
  expect(native.invoke).not.toHaveBeenCalled();
  native.invoke.mockRejectedValueOnce(new Error("Repositories folder"));
  await user.click(screen.getByRole("button", { name: "폴더 저장" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Repositories folder",
  );
  act(() => setLanguage("en"));
  expect(screen.getByLabelText("Repositories folder")).toBe(input);
  expect(input).toHaveValue("/Repositories folder");
  native.invoke.mockResolvedValueOnce("/Repositories folder");
  await user.click(screen.getByRole("button", { name: "Save folder" }));
  expect(native.invoke).toHaveBeenNthCalledWith(
    1,
    "repositories_folder_validate",
    { path: "/Repositories folder" },
  );
  expect(native.invoke).toHaveBeenNthCalledWith(
    2,
    "repositories_folder_validate",
    { path: "/Repositories folder" },
  );
  expect(readRepositoriesFolder(community, viewer)).toBe(
    "/Repositories folder",
  );
  act(() => setLanguage("ko"));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "이 기기에 저장소 폴더를 저장했습니다.",
  );
});

it("retranslates an app-owned folder read error without rereading storage or replacing the input", async () => {
  const source = Storage.prototype.getItem;
  const reads = vi
    .spyOn(Storage.prototype, "getItem")
    .mockImplementation(function (this: Storage, key) {
      if (key === repositoriesKey(community, viewer))
        throw new Error("storage blocked");
      return source.call(this, key);
    });
  await setup();
  const input = screen.getByLabelText("Repositories folder");
  const error = screen.getByRole("alert");
  expect(error).toHaveTextContent(
    "Couldn’t read the repositories folder on this device. Try again.",
  );
  const before = reads.mock.calls.filter(
    ([key]) => key === repositoriesKey(community, viewer),
  ).length;
  input.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByLabelText("저장소 폴더")).toBe(input);
  expect(screen.getByRole("alert")).toBe(error);
  expect(error).toHaveTextContent(
    "이 기기의 저장소 폴더를 읽지 못했습니다. 다시 시도해 주세요.",
  );
  expect(input).toHaveFocus();
  expect(
    reads.mock.calls.filter(
      ([key]) => key === repositoriesKey(community, viewer),
    ),
  ).toHaveLength(before);
  act(() => setLanguage("en"));
  expect(error).toHaveTextContent(
    "Couldn’t read the repositories folder on this device. Try again.",
  );
});

it("keeps an in-flight folder save and focused action intact across EN to KO to EN", async () => {
  const { user } = await setup();
  native.invoke.mockClear();
  const input = screen.getByLabelText("Repositories folder");
  await user.type(input, "/draft-path");
  let complete!: (path: string) => void;
  native.invoke.mockReturnValueOnce(
    new Promise<string>((resolve) => {
      complete = resolve;
    }),
  );
  const action = screen.getByRole("button", { name: "Save folder" });
  await user.click(action);
  expect(action).toHaveFocus();
  act(() => setLanguage("ko"));
  expect(screen.getByLabelText("저장소 폴더")).toBe(input);
  expect(input).toHaveValue("/draft-path");
  expect(screen.getByRole("button", { name: "폴더 저장" })).toBe(action);
  expect(action).toHaveFocus();
  expect(action).toHaveAttribute("aria-busy", "true");
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "Save folder" })).toBe(action);
  expect(action).toHaveFocus();
  expect(native.invoke).toHaveBeenCalledExactlyOnceWith(
    "repositories_folder_validate",
    { path: "/draft-path" },
  );
  await act(async () => complete("/normalized-path"));
  expect(readRepositoriesFolder(community, viewer)).toBe("/normalized-path");
  expect(input).toHaveValue("/normalized-path");
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Repositories folder saved on this device.",
  );
});

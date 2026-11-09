import { localError } from "../../shared/i18n/deferred-message";
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type {
  Agent,
  Agents,
  RegisteredAgentType,
} from "../../features/agents/service";
import { RobotIcon } from "../../shared/design-system/icons";
import { MigrationPreview, useAgentSettingsHost } from "./AgentSettingsHost";

import { setLanguage } from "../../shared/i18n";
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});

function fixture({
  hosted = true,
  anotherLocal = true,
  place = "here",
  remoteSource = false,
  registered = true,
} = {}) {
  const agent = {
    key: "a".repeat(64),
    pubkey: "a".repeat(64),
    name: "Ada",
    place,
    type: remoteSource ? "hosted/builderlab" : "local/echo",
    config: {},
  } as Agent;
  const local = {
    key: "local/echo",
    pluginId: "local",
    revision: "1",
    id: "echo",
    title: "Echo",
    defaults: () => ({ config: {} }),
  } satisfies RegisteredAgentType;
  const remote = {
    ...local,
    key: "hosted/builderlab",
    pluginId: "hosted",
    id: "builderlab",
    title: "Builderlab",
    icon: RobotIcon,
    remote: {
      provision: vi.fn(),
      activate: vi.fn(),
      profile: vi.fn(),
      remove: vi.fn(),
    },
  } satisfies RegisteredAgentType;
  const next = { ...local, key: "local/next", id: "next", title: "Next" };
  const types = [
    local,
    ...(hosted ? [remote] : []),
    ...(anotherLocal ? [next] : []),
    ...(remoteSource
      ? [{ ...next, key: "local/third", id: "third", title: "Third" }]
      : []),
  ];
  const previewRetype = vi.fn(() => ({
    config: {},
    moved: [],
    dropped: [],
    settings: [],
  }));
  const retype = vi.fn();
  const agents = { previewRetype, retype } as unknown as Agents;
  function Host() {
    const host = useAgentSettingsHost({
      agents,
      agent,
      type: registered ? (remoteSource ? remote : local) : undefined,
      types,
    });
    return (
      <>
        {host.settingsHost.typeControl?.(false)}
        <output aria-label="Selected harness">{host.agent.type}</output>
        <output aria-label="Pending change">
          {String(Boolean(host.settingsHost.pendingSave))}
        </output>
      </>
    );
  }
  render(<Host />);
  return { previewRetype, retype, remote };
}

it.each([false, true])(
  "explains hosted choices without staging a migration (another local %s)",
  async (anotherLocal) => {
    const user = userEvent.setup();
    const { previewRetype, retype, remote } = fixture({ anotherLocal });
    await user.click(
      screen.getByRole("button", { name: "Change harness from Echo" }),
    );
    const hosted = await screen.findByRole("menuitemradio", {
      name: "Builderlab",
    });
    expect(screen.getAllByRole("group", { name: /^(Remote|Local)$/ })).toEqual([
      screen.getByRole("group", { name: "Remote" }),
      screen.getByRole("group", { name: "Local" }),
    ]);
    expect(screen.getByRole("group", { name: "Remote" })).toContainElement(
      hosted,
    );
    expect(
      within(screen.getByRole("group", { name: "Local" })).getByRole(
        "menuitemradio",
        { name: "Echo" },
      ),
    ).toBeChecked();
    expect(hosted).toHaveAttribute("aria-disabled", "true");
    expect(hosted).not.toBeChecked();
    expect(hosted.querySelector("svg")).not.toBeNull();
    await user.hover(hosted);
    const help = await screen.findByRole("dialog", {
      name: "Harness availability",
    });
    expect(help).toHaveTextContent(
      "This agent runs on your device. You can’t switch it to Builderlab yet. To run hosted, create a new Builderlab agent.",
    );
    await user.hover(help);
    expect(screen.getByRole("menu")).toBeVisible();
    expect(help).toBeVisible();
    await user.hover(hosted);
    await user.unhover(hosted);
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Harness availability" }),
      ).toBeNull(),
    );
    await user.hover(hosted);
    await user.click(hosted);
    expect(screen.getByRole("menu")).toBeVisible();
    expect(screen.getByLabelText("Selected harness")).toHaveTextContent(
      "local/echo",
    );
    expect(screen.getByLabelText("Pending change")).toHaveTextContent("false");
    expect(previewRetype).not.toHaveBeenCalled();
    expect(retype).not.toHaveBeenCalled();
    expect(remote.remote.provision).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Harness availability" }),
      ).toBeNull(),
    );
    await user.keyboard("{Home}{Enter}");
    expect(hosted).toHaveFocus();
    expect(
      await screen.findByRole("dialog", { name: "Harness availability" }),
    ).toBeVisible();
    expect(hosted).toHaveAccessibleDescription(/runs on your device/);
    await user.keyboard("{ArrowDown}");
    expect(
      screen.getByRole("menuitemradio", {
        name: "Echo",
      }),
    ).toHaveFocus();
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Harness availability" }),
      ).toBeNull(),
    );
    await user.keyboard("{ArrowUp}{Enter}");
    expect(
      await screen.findByRole("dialog", { name: "Harness availability" }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Harness availability" }),
      ).toBeNull(),
    );
    expect(screen.getByRole("menu")).toBeVisible();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("dialog", { name: "Harness availability" }),
    ).toBeVisible();
    expect(previewRetype).not.toHaveBeenCalled();
    expect(retype).not.toHaveBeenCalled();
  },
);

it("keeps the existing local migration flow available", async () => {
  const user = userEvent.setup();
  const { previewRetype, retype } = fixture({ hosted: false });
  await user.click(
    screen.getByRole("button", { name: "Change harness from Echo" }),
  );
  expect(await screen.findByRole("group", { name: "Local" })).toBeVisible();
  expect(
    screen.queryByRole("group", { name: "Remote" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("menuitemradio", { name: "Builderlab" }),
  ).toBeNull();
  await user.click(await screen.findByRole("menuitemradio", { name: "Next" }));
  expect(
    await screen.findByRole("dialog", { name: "Move Ada to Next?" }),
  ).toBeVisible();
  expect(previewRetype).toHaveBeenCalledWith("a".repeat(64), "local/next");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus(),
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByLabelText("Selected harness")).toHaveTextContent(
    "local/next",
  );
  expect(screen.getByLabelText("Pending change")).toHaveTextContent("true");
  expect(retype).not.toHaveBeenCalled();
});

it("does not offer local migration for an agent on another device", () => {
  fixture({ place: "elsewhere" });
  expect(screen.queryByRole("button", { name: /Change harness/ })).toBeNull();
});

it("shows local harnesses as unavailable for a hosted agent and keeps help keyboard accessible", async () => {
  const user = userEvent.setup();
  const { previewRetype, retype } = fixture({
    place: "hosted",
    remoteSource: true,
  });
  const trigger = screen.getByRole("button", {
    name: "Change harness from Builderlab",
  });
  await user.tab();
  expect(trigger).toHaveFocus();
  await user.keyboard("{Enter}");
  const menu = await screen.findByRole("menu");
  await waitFor(() => expect(menu.contains(document.activeElement)).toBe(true));
  await user.keyboard("{Home}{ArrowDown}");
  const local = await screen.findByRole("menuitemradio", { name: "Echo" });
  await waitFor(() => expect(local).toHaveFocus());
  await user.keyboard("{Enter}");
  expect(local).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByRole("menuitemradio", { name: "Next" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  expect(
    screen.getByRole("menuitemradio", { name: "Builderlab" }),
  ).toBeChecked();
  const group = screen.getByRole("group", { name: "Unavailable harnesses" });
  const next = screen.getByRole("menuitemradio", { name: "Next" });
  expect(group).toContainElement(local);
  expect(group).toContainElement(next);
  expect(group).toContainElement(
    screen.getByRole("menuitemradio", { name: "Third" }),
  );
  expect(group).toHaveAttribute("tabindex", "-1");
  const copy =
    "This agent runs on Builderlab. You can’t switch it to a local harness yet. To run locally, create a new agent.";
  expect(
    await screen.findByRole("dialog", { name: "Harness availability" }),
  ).toHaveTextContent(copy);
  expect(local).toHaveAccessibleDescription(copy);
  expect(next).toHaveAccessibleDescription(copy);
  const help = screen.getByRole("dialog", { name: "Harness availability" });
  expect(group).toHaveAttribute("aria-controls", help.id);
  expect(group).toHaveAttribute("aria-haspopup", "false");
  expect(group).not.toHaveAttribute("aria-expanded");
  expect(local).not.toHaveAttribute("aria-haspopup", "dialog");
  expect(next).not.toHaveAttribute("aria-haspopup", "dialog");
  await user.keyboard("{ArrowDown}");
  expect(next).toHaveFocus();
  expect(screen.getByRole("dialog", { name: "Harness availability" })).toBe(
    help,
  );
  await user.keyboard("{ArrowUp}");
  await user.keyboard("{Enter}{Space}");
  expect(screen.getByRole("menu")).toBeVisible();
  expect(screen.getByLabelText("Pending change")).toHaveTextContent("false");
  await user.keyboard("{Escape}");
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Harness availability" }),
    ).toBeNull(),
  );
  expect(screen.getByRole("menu")).toBeVisible();
  await user.hover(group);
  const hoveredHelp = await screen.findByRole("dialog", {
    name: "Harness availability",
  });
  await user.hover(local);
  await user.hover(next);
  expect(screen.getByRole("dialog", { name: "Harness availability" })).toBe(
    hoveredHelp,
  );
  await user.click(local);
  expect(screen.getByRole("menu")).toBeVisible();
  expect(previewRetype).not.toHaveBeenCalled();
  expect(retype).not.toHaveBeenCalled();
});

it("withholds the harness control for a hosted agent whose type is unregistered", () => {
  const { previewRetype, retype } = fixture({
    place: "hosted",
    remoteSource: true,
    hosted: false,
    registered: false,
  });
  expect(screen.queryByRole("button", { name: /Change harness/ })).toBeNull();
  expect(screen.getByLabelText("Pending change")).toHaveTextContent("false");
  expect(previewRetype).not.toHaveBeenCalled();
  expect(retype).not.toHaveBeenCalled();
});

it("keeps harness menu identity and raw choices while changing language", async () => {
  const f = fixture();
  const trigger = screen.getByRole("button", {
    name: "Change harness from Echo",
  });
  await userEvent.setup().click(trigger);
  const menu = await screen.findByRole("menu");
  const echo = screen.getByRole("menuitemradio", { name: "Echo" });
  echo.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "하네스 변경: 현재 Echo" })).toBe(
    trigger,
  );
  expect(screen.getByRole("menu")).toBe(menu);
  expect(screen.getByRole("group", { name: "로컬" })).toContainElement(echo);
  expect(echo).toHaveFocus();
  expect(echo).toBeChecked();
  expect(screen.getByLabelText("Selected harness")).toHaveTextContent(
    "local/echo",
  );
  act(() => setLanguage("en"));
  expect(screen.getByRole("group", { name: "Local" })).toContainElement(echo);
  expect(echo).toHaveFocus();
  expect(f.previewRetype).not.toHaveBeenCalled();
  expect(f.retype).not.toHaveBeenCalled();
});

it("keeps a staged migration dialog and canonical target across languages", async () => {
  const f = fixture({ hosted: false });
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Change harness from Echo" }),
  );
  await user.click(await screen.findByRole("menuitemradio", { name: "Next" }));
  const dialog = await screen.findByRole("dialog", {
    name: "Move Ada to Next?",
  });
  const action = within(dialog).getByRole("button", { name: "Continue" });
  action.focus();
  act(() => setLanguage("ko"));
  expect(
    screen.getByRole("dialog", { name: "Ada을(를) Next(으)로 이동할까요?" }),
  ).toBe(dialog);
  expect(within(dialog).getByRole("button", { name: "계속" })).toBe(action);
  expect(action).toHaveFocus();
  expect(f.previewRetype).toHaveBeenCalledExactlyOnceWith(
    "a".repeat(64),
    "local/next",
  );
  expect(f.retype).not.toHaveBeenCalled();
  act(() => setLanguage("en"));
  expect(screen.getByRole("dialog", { name: "Move Ada to Next?" })).toBe(
    dialog,
  );
  expect(action).toHaveFocus();
  await user.click(action);
  expect(screen.getByLabelText("Selected harness")).toHaveTextContent(
    "local/next",
  );
  expect(screen.getByLabelText("Pending change")).toHaveTextContent("true");
  expect(f.previewRetype).toHaveBeenCalledOnce();
  expect(f.retype).not.toHaveBeenCalled();
});
it("translates carry outcomes but preserves authored harness, setting and warning labels", () => {
  const source = {
    title: "Instructions",
    migrationWarning: "Message",
  } as RegisteredAgentType;
  const target = { title: "Workspace" } as RegisteredAgentType;
  const preview = {
    config: { mode: "reset" },
    moved: ["instructions"],
    dropped: ["workspace"],
    settings: [{ id: "instructions", label: "Instructions", outcome: "reset" }],
  } as ReturnType<Agents["previewRetype"]>;
  const before = JSON.stringify(preview);
  render(
    <MigrationPreview
      source={source}
      target={target}
      preview={preview}
      discardDraft={true}
    />,
  );
  const label = screen.getAllByText("Instructions")[0];
  act(() => setLanguage("ko"));
  expect(screen.getAllByText("Instructions")).toHaveLength(2);
  expect(screen.getAllByText("Instructions")[0]).toBe(label);
  expect(screen.getByText("Workspace")).toBeVisible();
  expect(screen.getByText("지침")).toBeVisible();
  expect(screen.getByText("이동됨")).toBeVisible();
  expect(screen.getByText("제외됨")).toBeVisible();
  expect(screen.getByText("초기화됨")).toBeVisible();
  expect(screen.getByText(/Message$/)).toBeVisible();
  expect(JSON.stringify(preview)).toBe(before);
  act(() => setLanguage("en"));
  expect(screen.getByText("Moves")).toBeVisible();
  expect(screen.getAllByText("Instructions")).toHaveLength(3);
});

it("retains owned preview error provenance across languages and leaves an identical provider diagnostic raw", async () => {
  const f = fixture({ hosted: false });
  f.previewRetype.mockImplementationOnce(() => {
    throw localError("agentsErrors.missingType");
  });
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", {
    name: "Change harness from Echo",
  });
  await user.click(trigger);
  await user.click(await screen.findByRole("menuitemradio", { name: "Next" }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("That agent type is not available");
  trigger.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("alert")).toBe(alert);
  expect(alert).toHaveTextContent("이 에이전트 유형을 사용할 수 없습니다.");
  expect(screen.getByRole("button", { name: "하네스 변경: 현재 Echo" })).toBe(
    trigger,
  );
  expect(trigger).toHaveFocus();
  expect(f.previewRetype).toHaveBeenCalledExactlyOnceWith(
    "a".repeat(64),
    "local/next",
  );
  act(() => setLanguage("en"));
  expect(alert).toHaveTextContent("That agent type is not available");
  f.previewRetype.mockImplementationOnce(() => {
    throw new Error("That agent type is not available");
  });
  act(() => setLanguage("ko"));
  await user.click(trigger);
  await user.click(await screen.findByRole("menuitemradio", { name: "Next" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "That agent type is not available",
  );
  expect(f.previewRetype).toHaveBeenCalledTimes(2);
  expect(f.retype).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Selected harness")).toHaveTextContent(
    "local/echo",
  );
});

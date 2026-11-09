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
import { afterEach, expect, it } from "vitest";
import { AgentsContext } from "../features/agents/react";
import type { Agents } from "../features/agents/service";
import type { PluginManifest } from "../plugins/api";
import {
  PluginAccessReview,
  pluginAccessIncreases,
} from "./PluginAccessReview";
import { setLanguage } from "../shared/i18n";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});

const manifest = (files: boolean): PluginManifest => ({
  id: "example.files",
  name: "File reader",
  apiVersion: 1,
  host: { files },
});

it("discloses native file access in the shared installed/import review", async () => {
  render(<PluginAccessReview manifest={manifest(true)} />);
  fireEvent.click(screen.getByRole("button", { name: /Read your files/ }));
  await waitFor(() =>
    expect(
      screen.getByText(
        /Reads files and resolves folders with your account’s full access/,
      ),
    ).toBeVisible(),
  );
});

it.each([
  [false, true, "Added"],
  [true, false, "Removed"],
] as const)(
  "compares native file access from %s to %s",
  (before, after, change) => {
    render(
      <PluginAccessReview
        manifest={manifest(after)}
        previousManifest={manifest(before)}
      />,
    );
    expect(
      within(
        screen.getByRole("region", { name: `${change} declarations` }),
      ).getByRole("button", { name: /Read your files/ }),
    ).toBeVisible();
  },
);

it("keeps unchanged native file access in the unchanged view", () => {
  const { rerender } = render(
    <PluginAccessReview
      manifest={manifest(true)}
      previousManifest={manifest(true)}
    />,
  );
  expect(screen.getByText("No declared access changes")).toBeVisible();
  expect(screen.queryByRole("button", { name: /Read your files/ })).toBeNull();
  expect(
    screen.getByRole("button", { name: "View unchanged declarations" }),
  ).toBeVisible();
  rerender(
    <PluginAccessReview
      manifest={manifest(true)}
      previousManifest={manifest(true)}
      unchangedOnly
    />,
  );
  expect(screen.getByRole("button", { name: /Read your files/ })).toBeVisible();
});

it.each([
  ["agentHooks", /Observe and influence buzz.pi\/pi/],
  ["agentExecution", /Run buzz.pi\/pi on another host/],
] as const)(
  "discloses %s access as a new permission for each harness",
  (grant, label) => {
    render(
      <PluginAccessReview
        manifest={{
          id: "policy",
          name: "Policy",
          apiVersion: 1,
          host: { [grant]: ["buzz.pi/pi"] },
        }}
        previousManifest={{ id: "policy", name: "Policy", apiVersion: 1 }}
      />,
    );
    expect(
      within(
        screen.getByRole("region", { name: "Added declarations" }),
      ).getByRole("button", { name: label }),
    ).toBeVisible();
  },
);

it("shows a registered harness title while keeping its exact key in details", async () => {
  const types = [{ key: "third/custom", title: "Custom Agent" }];
  const agents = {
    subscribe: () => () => {},
    types: () => types,
  } as unknown as Agents;
  render(
    <AgentsContext value={agents}>
      <PluginAccessReview
        manifest={{
          id: "policy",
          name: "Policy",
          apiVersion: 1,
          host: { agentHooks: ["third/custom"] },
        }}
      />
    </AgentsContext>,
  );
  const trigger = screen.getByRole("button", {
    name: /Observe and influence Custom Agent/,
  });
  expect(trigger).not.toHaveTextContent("third/custom");
  fireEvent.click(trigger);
  await waitFor(() => expect(screen.getByText("third/custom")).toBeVisible());
});

const managed = (managedFiles: boolean): PluginManifest => ({
  ...manifest(false),
  host: { managedFiles },
});
it("discloses managed save limits and retention without implying file-reading authority", async () => {
  render(<PluginAccessReview manifest={managed(true)} />);
  expect(screen.queryByRole("button", { name: /Read your files/ })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: /Save temporary plugin files/ }),
  );
  await waitFor(() =>
    expect(
      screen.getByText(/Shared storage is limited to 64 MiB and 16 files/),
    ).toBeVisible(),
  );
  expect(
    screen.getByText(
      /This does not grant file reading or arbitrary-path writes/,
    ),
  ).toBeVisible();
});
it.each([
  [false, true, "Added"],
  [true, false, "Removed"],
] as const)(
  "compares managed save access from %s to %s",
  (before, after, change) => {
    render(
      <PluginAccessReview
        manifest={managed(after)}
        previousManifest={managed(before)}
      />,
    );
    expect(
      within(
        screen.getByRole("region", { name: `${change} declarations` }),
      ).getByRole("button", { name: /Save temporary plugin files/ }),
    ).toBeVisible();
  },
);
it("uses the existing unchanged disclosure for managed saves", () => {
  const { rerender } = render(
    <PluginAccessReview
      manifest={managed(true)}
      previousManifest={managed(true)}
    />,
  );
  expect(screen.getByText("No declared access changes")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: /Save temporary plugin files/ }),
  ).toBeNull();
  rerender(
    <PluginAccessReview
      manifest={managed(true)}
      previousManifest={managed(true)}
      unchangedOnly
    />,
  );
  expect(
    screen.getByRole("button", { name: /Save temporary plugin files/ }),
  ).toBeVisible();
});

it("retains canonical command access, raw arguments and the same expanded focused item across languages", async () => {
  setLanguage("en");
  const candidate: PluginManifest = {
    id: "raw.plugin-id",
    name: "Raw {plugin} 한글",
    apiVersion: 1,
    host: {
      commands: [
        {
          id: "raw-command",
          program: "/tmp/Raw {program} 한글",
          args: ["--raw", "사용자 {arg}\nline", "--raw"],
          maxInputBytes: 1234,
          maxOutputBytes: 4096,
        },
      ],
    },
  };
  const before: PluginManifest = {
    ...candidate,
    host: {
      commands: [
        {
          id: "raw-command",
          program: "/tmp/Raw {program} 한글",
          args: ["--raw", "사용자 {arg}\nline", "--raw"],
          maxInputBytes: 1234,
          maxOutputBytes: 1024,
        },
      ],
    },
  };
  const serialized = JSON.stringify(candidate);
  render(<PluginAccessReview manifest={candidate} previousManifest={before} />);
  expect(pluginAccessIncreases(candidate, before)).toBe(true);
  expect(pluginAccessIncreases(candidate, candidate)).toBe(false);
  const item = screen.getByRole("button", {
    name: /Run \/tmp\/Raw \{program\} 한글/,
  });
  fireEvent.click(item);
  item.focus();
  const region = await screen.findByRole("region", {
    name: "Command raw-command details",
  });
  expect(region).toHaveTextContent("Input: up to 1234 bytes");
  const args = within(region).getAllByRole("listitem");
  expect(args.map((arg) => arg.textContent)).toEqual([
    "--raw",
    "사용자 {arg}\nline",
    "--raw",
    "--raw",
    "사용자 {arg}\nline",
    "--raw",
  ]);
  act(() => setLanguage("ko"));
  expect(
    screen.getByRole("button", { name: /\/tmp\/Raw \{program\} 한글 실행/ }),
  ).toBe(item);
  expect(item).toHaveFocus();
  expect(item).toHaveAttribute("aria-expanded", "true");
  expect(
    screen.getByRole("region", { name: "명령 raw-command 세부 정보" }),
  ).toBe(region);
  expect(region).toHaveTextContent("입력: 최대 1,234바이트");
  expect(within(region).getAllByRole("listitem")).toEqual(args);
  expect(JSON.stringify(candidate)).toBe(serialized);
  expect(pluginAccessIncreases(candidate, before)).toBe(true);
  expect(pluginAccessIncreases(candidate, candidate)).toBe(false);
  act(() => setLanguage("en"));
  expect(
    screen.getByRole("region", { name: "Command raw-command details" }),
  ).toBe(region);
  expect(
    screen.getByRole("button", { name: /Run \/tmp\/Raw \{program\} 한글/ }),
  ).toBe(item);
  expect(item).toHaveFocus();
});

it("keeps declaration identities and raw harness/program/URL values while every capability label follows language", () => {
  setLanguage("en");
  const value: PluginManifest = {
    id: "raw.capabilities",
    name: "Read your files",
    apiVersion: 1,
    host: {
      agentExecution: ["raw/harness"],
      agentHooks: ["raw/harness"],
      networkOrigins: ["https://raw.example/{path}"],
      processes: [{ id: "raw-worker", program: "raw-worker", args: ["{arg}"] }],
      mcp: true,
      managedFiles: true,
      files: true,
    },
  };
  const raw = JSON.stringify(value);
  render(<PluginAccessReview manifest={value} />);
  const labels = [
    /Run raw\/harness on another host/,
    /Observe and influence raw\/harness/,
    /Connect to https:\/\/raw.example\/\{path\}/,
    /Start raw-worker/,
    /Provide tools to local agents/,
    /Save temporary plugin files/,
    /Read your files/,
  ];
  const items = labels.map((name) => screen.getByRole("button", { name }));
  act(() => setLanguage("ko"));
  const translated = [
    /다른 호스트에서 raw\/harness 실행/,
    /raw\/harness 관찰 및 동작 제어/,
    /https:\/\/raw.example\/\{path\}에 연결/,
    /raw-worker 시작/,
    /로컬 에이전트에 도구 제공/,
    /임시 플러그인 파일 저장/,
    /^파일 읽기/,
  ];
  expect(
    translated.map((name) => screen.getByRole("button", { name })),
  ).toEqual(items);
  expect(JSON.stringify(value)).toBe(raw);
  expect(pluginAccessIncreases(value, value)).toBe(false);
  act(() => setLanguage("en"));
  expect(labels.map((name) => screen.getByRole("button", { name }))).toEqual(
    items,
  );
});

// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { GitHubPanel } from "./index";
import userEvent from "@testing-library/user-event";
import { gitHubCli, type GitHubDiff } from "./gh";
import { PANEL_PULL_FIELDS } from "./pull";
import type { Host } from "../../features/host/service";
import { relativeTimestamp } from "../../shared/relative-timestamp";
import {
  clockPreference,
  setClockPreference,
} from "../../shared/clock-preference";

function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error("Uninitialized fixture gate");
  };
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const unexpectedFetch = vi.fn<typeof fetch>(async () => {
  throw new Error("Unexpected external fetch in the controlled GitHub fixture");
});
beforeEach(() => {
  unexpectedFetch.mockClear();
  vi.stubGlobal("fetch", unexpectedFetch);
  localStorage.clear();
  setLanguage("en");
  setClockPreference({
    hourCycle: "system",
    seconds: false,
    messageTimestamps: "show",
  });
});
afterEach(() => {
  cleanup();
  expect(unexpectedFetch).not.toHaveBeenCalled();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("retains a real pending GitHub read and focused external link through EN KO EN without another request or abort", async () => {
  const read = deferred<Response>();
  const fetch = vi.fn(
    (_url: RequestInfo | URL, _init?: RequestInit) => read.promise,
  );
  vi.stubGlobal("fetch", fetch);
  const view = render(
    <GitHubPanel
      target="https://github.com/example/project"
      close={() => {}}
    />,
  );
  const answer = () =>
    new Response(
      JSON.stringify({
        description: "Raw Repository {author} 한글",
        owner: { login: "Raw-Owner" },
        stargazers_count: 1000,
        language: "Language",
        default_branch: "main",
      }),
    );
  try {
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading from GitHub…");
    const external = screen.getByRole("link", { name: "Open on GitHub" });
    external.focus();
    const signal = fetch.mock.calls[0]?.[1]?.signal;
    if (!(signal instanceof AbortSignal))
      throw new Error("Missing actual read signal");
    expect(fetch.mock.calls[0]?.[0]).toBe(
      "https://api.github.com/repos/example/project",
    );
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole("status")).toBe(status);
      expect(status).toHaveTextContent(
        language === "ko" ? "GitHub에서 불러오는 중…" : "Loading from GitHub…",
      );
      expect(
        screen.getByRole("link", {
          name: language === "ko" ? "GitHub에서 열기" : "Open on GitHub",
        }),
      ).toBe(external);
      expect(external).toHaveAttribute(
        "href",
        "https://github.com/example/project",
      );
      expect(external).toHaveFocus();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(signal.aborted).toBe(false);
    }
    await act(async () => read.resolve(answer()));
    expect(
      await screen.findByRole("heading", { name: "example/project" }),
    ).toBeVisible();
    expect(screen.getByText("Raw Repository {author} 한글")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open on GitHub" })).toBe(external);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(signal.aborted).toBe(false);
  } finally {
    await act(async () => {
      read.resolve(answer());
      await read.promise;
    });
    view.unmount();
  }
});

function pullAnswer(over: Record<string, unknown> = {}) {
  return {
    r0: {
      viewerDefaultMergeMethod: "SQUASH",
      squashMergeAllowed: true,
      mergeCommitAllowed: true,
      rebaseMergeAllowed: false,
      pullRequest: {
        id: "PR_7",
        title: "Changes",
        state: "OPEN",
        isDraft: false,
        body: "Raw body {author} 한글",
        author: { login: "Summary" },
        baseRefName: "main",
        headRefName: "Changes",
        headRefOid: "raw-head-1000",
        headRepository: { nameWithOwner: "example/project" },
        headRepositoryOwner: { login: "example" },
        baseRepository: { nameWithOwner: "example/project" },
        additions: 1000,
        deletions: 1,
        changedFiles: 1000,
        viewerDidAuthor: true,
        mergeStateStatus: "UNKNOWN",
        reviewDecision: null,
        viewerCanUpdate: false,
        viewerCanUpdateBranch: false,
        viewerCanMergeAsAdmin: false,
        viewerCanEnableAutoMerge: false,
        viewerCanDisableAutoMerge: false,
        autoMergeRequest: null,
        reviewRequests: { nodes: [] },
        latestOpinionatedReviews: { nodes: [] },
        reviewThreads: { nodes: [] },
        commits: { nodes: [] },
        ...over,
      },
    },
  };
}
function cliFixture(answer = pullAnswer()) {
  const ready = deferred<void>();
  const bodies: unknown[] = [];
  const kills = vi.fn();
  const spawn = vi.fn<NonNullable<Host["spawn"]>>(async (id, options) => {
    if (id !== "graphql") throw new Error(`Unexpected fixture process ${id}`);
    const exit = deferred<number | null>();
    return {
      write: async () => {},
      end: async (body?: string) => {
        bodies.push(JSON.parse(body ?? "{}"));
        await ready.promise;
        options?.onStdout?.(JSON.stringify({ data: answer }));
        exit.resolve(0);
      },
      kill: async () => {
        kills();
        exit.resolve(null);
      },
      exited: exit.promise,
    };
  });
  const gh = gitHubCli({ spawn });
  if (!gh) throw new Error("Missing real production GitHub client");
  return { ready, bodies, kills, spawn, gh };
}
const patch = `diff --git a/raw-file.ts b/raw-file.ts
index 1111111..2222222 100644
--- a/raw-file.ts
+++ b/raw-file.ts
@@ -1 +1 @@
-Raw old {count}
+Raw new 한글
`;

it("keeps canonical Summary/Changes tabs and the same held diff, author anchor and raw config across live locale switches", async () => {
  const cli = cliFixture();
  const diffGate = deferred<string>();
  const diff = vi.fn<GitHubDiff>(() => diffGate.promise);
  const view = render(
    <GitHubPanel
      target="https://github.com/example/project/pull/7"
      close={() => {}}
      gh={cli.gh}
      diff={diff}
    />,
  );
  const user = userEvent.setup();
  try {
    await waitFor(() => expect(cli.bodies).toHaveLength(1));
    const waiting = screen.getByRole("heading", { name: "Pull request #7" });
    act(() => setLanguage("ko"));
    expect(screen.getByRole("heading", { name: "PR #7" })).toBe(waiting);
    expect(cli.spawn).toHaveBeenCalledTimes(1);
    expect(cli.kills).not.toHaveBeenCalled();
    await act(async () => cli.ready.resolve());
    const title = await screen.findByRole("heading", { name: "Changes #7" });
    const author = screen.getByRole("link", { name: "Summary" });
    expect(author).toHaveAttribute("href", "https://github.com/Summary");
    expect(author.parentElement).toHaveTextContent("Summary 작성");
    expect(screen.getByText("Raw body {author} 한글")).toBeVisible();
    const summary = screen.getByRole("tab", { name: "요약" });
    const changes = screen.getByRole("tab", { name: /^변경 사항/ });
    expect(changes).toHaveTextContent("+1,000 −1");
    const branch = screen.getByRole("link", { name: "Changes" });
    expect(branch).toHaveAttribute(
      "href",
      "https://github.com/example/project/tree/Changes",
    );
    for (const language of ["en", "ko"] as const) {
      author.focus();
      act(() => setLanguage(language));
      expect(screen.getByRole("heading", { name: "Changes #7" })).toBe(title);
      expect(screen.getByRole("link", { name: "Summary" })).toBe(author);
      expect(author).toHaveFocus();
      expect(author.parentElement).toHaveTextContent(
        language === "ko" ? "Summary 작성" : "by Summary",
      );
      expect(
        screen.getByRole("tab", {
          name: language === "ko" ? "요약" : "Summary",
        }),
      ).toBe(summary);
      expect(summary).toHaveAttribute("aria-selected", "true");
      expect(changes).toHaveTextContent(
        language === "ko" ? "+1,000 −1" : "+1000 −1",
      );
      expect(screen.getByRole("link", { name: "Changes" })).toBe(branch);
      expect(cli.spawn).toHaveBeenCalledTimes(1);
      expect(cli.kills).not.toHaveBeenCalled();
      expect(diff).not.toHaveBeenCalled();
    }
    await user.click(changes);
    expect(changes).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(diff).toHaveBeenCalledTimes(1));
    const signal = diff.mock.calls[0]?.[1];
    if (!(signal instanceof AbortSignal))
      throw new Error("Missing real files signal");
    const request = {
      repository: "example/project",
      base: "main",
      head: "raw-head-1000",
      merged: undefined,
    };
    expect(diff).toHaveBeenCalledExactlyOnceWith(request, signal);
    changes.focus();
    act(() => setLanguage("en"));
    expect(screen.getByRole("tab", { name: /^Changes/ })).toBe(changes);
    expect(changes).toHaveFocus();
    expect(changes).toHaveAttribute("aria-selected", "true");
    expect(signal.aborted).toBe(false);
    expect(cli.spawn).toHaveBeenCalledTimes(1);
    expect(diff).toHaveBeenCalledExactlyOnceWith(request, signal);
    await act(async () => {
      diffGate.resolve(patch);
      await diffGate.promise;
    });
    const file = await screen.findByRole("region", { name: "raw-file.ts" });
    expect(file).toHaveTextContent("Raw new 한글");
    await user.click(summary);
    expect(screen.getByRole("heading", { name: "Changes #7" })).toBeVisible();
    expect(file).not.toBeVisible();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("tab", { name: "요약" })).toBe(summary);
    expect(summary).toHaveAttribute("aria-selected", "true");
    await user.click(changes);
    expect(screen.getByRole("region", { name: "raw-file.ts" })).toBe(file);
    expect(file).toBeVisible();
    expect(diff).toHaveBeenCalledExactlyOnceWith(request, signal);
    expect(cli.spawn).toHaveBeenCalledTimes(1);
    expect(cli.kills).not.toHaveBeenCalled();
    expect(cli.bodies).toEqual([
      {
        query: expect.stringContaining(PANEL_PULL_FIELDS),
        variables: { o0: "example", n0: "project", p0: 7 },
      },
    ]);
  } finally {
    await act(async () => {
      cli.ready.resolve();
      diffGate.resolve(patch);
      await diffGate.promise;
    });
    view.unmount();
  }
});

it.each([
  { state: "OPEN", isDraft: false, en: "open", ko: "열림" },
  { state: "OPEN", isDraft: true, en: "Draft", ko: "초안" },
  { state: "CLOSED", isDraft: true, en: "closed", ko: "닫힘" },
  { state: "MERGED", isDraft: false, en: "Merged", ko: "병합됨" },
])(
  "projects only the real $en pull state while preserving its canonical attribute and authored fields",
  async (c) => {
    const cli = cliFixture(
      pullAnswer({
        state: c.state,
        isDraft: c.isDraft,
        title: c.en,
        author: { login: "Draft" },
      }),
    );
    cli.ready.resolve();
    const view = render(
      <GitHubPanel
        target="https://github.com/example/project/pull/7"
        close={() => {}}
        gh={cli.gh}
      />,
    );
    try {
      const title = await screen.findByRole("heading", { name: `${c.en} #7` });
      const state = view.container.querySelector("[data-pr-state]");
      if (!(state instanceof HTMLElement))
        throw new Error("Missing real state display");
      expect(state).toHaveTextContent(c.en);
      const attr = state.getAttribute("data-pr-state");
      expect(attr).toBe(c.en.toLowerCase());
      const unavailable = screen.getByText("Unavailable");
      const author = screen.getByRole("link", { name: "Draft" });
      author.focus();
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        expect(screen.getByRole("heading", { name: `${c.en} #7` })).toBe(title);
        expect(state).toHaveTextContent(language === "ko" ? c.ko : c.en);
        expect(state).toHaveAttribute("data-pr-state", attr);
        expect(
          screen.getByText(
            language === "ko" ? "확인할 수 없음" : "Unavailable",
          ),
        ).toBe(unavailable);
        expect(screen.getByRole("link", { name: "Draft" })).toBe(author);
        expect(author).toHaveFocus();
        expect(cli.spawn).toHaveBeenCalledOnce();
        expect(cli.kills).not.toHaveBeenCalled();
      }
    } finally {
      await act(async () => cli.ready.resolve());
      view.unmount();
    }
  },
);

it("formats only numeric repository facts and keeps string numbers, same-English values and their existing nodes literal", async () => {
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          description: "Raw Description",
          stargazers_count: 1000,
          language: "Changes",
          default_branch: "1000",
          owner: { login: "Language" },
        }),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const view = render(
    <GitHubPanel
      target="https://github.com/example/project"
      close={() => {}}
    />,
  );
  try {
    await screen.findByRole("heading", { name: "example/project" });
    const kind = screen.getByText(/^Repository /, { selector: "strong" });
    const rawKindSuffix = kind.textContent?.slice("Repository".length);
    const facts = Array.from(view.container.querySelectorAll("dl > div"));
    expect(facts).toHaveLength(3);
    const headings = facts.map((item) => item.querySelector("dt"));
    const values = facts.map((item) => item.querySelector("dd"));
    expect(headings.map((item) => item?.textContent)).toEqual([
      "Stars",
      "Language",
      "Default branch",
    ]);
    expect(values.map((item) => item?.textContent)).toEqual([
      "1000",
      "Changes",
      "1000",
    ]);
    const author = screen.getByRole("link", { name: "Language" });
    author.focus();
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByText(language === "ko" ? /^저장소 / : /^Repository /, {
          selector: "strong",
        }),
      ).toBe(kind);
      expect(kind.textContent).toBe(
        `${language === "ko" ? "저장소" : "Repository"}${rawKindSuffix}`,
      );
      expect(Array.from(view.container.querySelectorAll("dl > div"))).toEqual(
        facts,
      );
      expect(headings.map((item) => item?.textContent)).toEqual(
        language === "ko"
          ? ["스타", "언어", "기본 브랜치"]
          : ["Stars", "Language", "Default branch"],
      );
      expect(values.map((item) => item?.textContent)).toEqual(
        language === "ko"
          ? ["1,000", "Changes", "1000"]
          : ["1000", "Changes", "1000"],
      );
      expect(screen.getByRole("link", { name: "Language" })).toBe(author);
      expect(author).toHaveFocus();
      expect(fetch).toHaveBeenCalledOnce();
    }
  } finally {
    view.unmount();
  }
});

it.each([
  {
    url: "https://github.com/example/project/issues/5",
    en: "Issue",
    ko: "이슈",
    body: {
      title: "Issue",
      state: "FutureStatus",
      user: { login: "Comments" },
      comments: 0,
    },
  },
  {
    url: "https://github.com/example/project/commit/abc1234",
    en: "Commit",
    ko: "커밋",
    body: {
      commit: {
        message: "Commit\nRaw body Draft",
        author: { name: "by {author}" },
      },
    },
  },
])(
  "localizes the $en frame while keeping an unknown state and raw unlinked author/content",
  async (c) => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(c.body)));
    vi.stubGlobal("fetch", fetch);
    const view = render(<GitHubPanel target={c.url} close={() => {}} />);
    try {
      const title = await screen.findByRole("heading", { name: c.en });
      const identity = Array.from(
        view.container.querySelectorAll("strong"),
      ).find((item) => item.textContent?.startsWith(`${c.en} `));
      if (!identity) throw new Error("Missing actual kind identity");
      const identityValue = identity.textContent?.slice(c.en.length);
      const body = view.container.textContent;
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        expect(screen.getByRole("heading", { name: c.en })).toBe(title);
        expect(identity.textContent).toBe(
          `${language === "ko" ? c.ko : c.en}${identityValue}`,
        );
        if (c.en === "Issue")
          expect(screen.getByText("FutureStatus")).toBeVisible();
        else {
          expect(screen.getByText("Raw body Draft")).toBeVisible();
          expect(view.container.textContent).toContain(
            language === "ko" ? "by {author} 작성" : "by by {author}",
          );
        }
        expect(fetch).toHaveBeenCalledOnce();
      }
      expect(body).toContain(c.en);
    } finally {
      view.unmount();
    }
  },
);

it("keeps the same unsupported-link fallback without making a read", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(
    <GitHubPanel
      target="https://example.invalid/not-github"
      close={() => {}}
    />,
  );
  const fallback = screen.getByText("Unsupported GitHub link.");
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByText(
        language === "ko"
          ? "지원하지 않는 GitHub 링크입니다."
          : "Unsupported GitHub link.",
      ),
    ).toBe(fallback);
    expect(fetch).not.toHaveBeenCalled();
  }
});

it("formats real last-updated ages at every original boundary without rereading or changing dateTime", async () => {
  const iso = "2024-03-10T06:59:59Z",
    unix = Date.parse(iso) / 1000;
  let now = unix - 60;
  vi.spyOn(Date, "now").mockImplementation(() => now * 1000);
  const cli = cliFixture(pullAnswer({ updatedAt: iso }));
  cli.ready.resolve();
  const view = render(
    <GitHubPanel
      target="https://github.com/example/project/pull/7"
      close={() => {}}
      gh={cli.gh}
    />,
  );
  try {
    await screen.findByRole("heading", { name: "Changes #7" });
    const time = view.container.querySelector("time");
    if (!time) throw new Error("Missing actual updated time");
    const author = screen.getByRole("link", { name: "Summary" });
    author.focus();
    expect(time.textContent).toBe(relativeTimestamp(unix, now));
    for (const [age, korean] of [
      [-60, "방금 전"],
      [59, "방금 전"],
      [60, "1분 전"],
      [3599, "59분 전"],
      [3600, "1시간 전"],
      [86399, "23시간 전"],
      [86400, "1일 전"],
      [604799, "6일 전"],
      [
        604800,
        new Date(iso).toLocaleDateString("ko-KR", {
          month: "short",
          day: "numeric",
        }),
      ],
    ] as const) {
      now = unix + age;
      act(() => setLanguage("ko"));
      expect(view.container.querySelector("time")).toBe(time);
      expect(time.textContent).toBe(korean);
      expect(time).toHaveAttribute("dateTime", iso);
      expect(time).toHaveAttribute(
        "title",
        new Date(iso).toLocaleString("ko-KR"),
      );
      expect(author).toHaveFocus();
      act(() => setLanguage("en"));
      expect(time.textContent).toBe(relativeTimestamp(unix, now));
      expect(time).toHaveAttribute(
        "title",
        new Date(iso).toLocaleString("en-US"),
      );
      expect(cli.spawn).toHaveBeenCalledOnce();
      expect(cli.kills).not.toHaveBeenCalled();
    }
  } finally {
    await act(async () => cli.ready.resolve());
    view.unmount();
  }
});

it.each([
  "2024-03-10T06:59:59Z",
  "2024-03-10T07:00:00Z",
  "2023-12-31T20:30:00Z",
])(
  "formats real last-updated calendar and explicit clock for %s with the OS zone",
  async (iso) => {
    const unix = Date.parse(iso) / 1000;
    vi.spyOn(Date, "now").mockReturnValue((unix + 604800) * 1000);
    const cli = cliFixture(pullAnswer({ updatedAt: iso }));
    cli.ready.resolve();
    const view = render(
      <GitHubPanel
        target="https://github.com/example/project/pull/7"
        close={() => {}}
        gh={cli.gh}
      />,
    );
    try {
      await screen.findByRole("heading", { name: "Changes #7" });
      const time = view.container.querySelector("time");
      if (!time) throw new Error("Missing actual updated time");
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        const locale = language === "ko" ? "ko-KR" : "en-US";
        const date = new Intl.DateTimeFormat(locale, {
          month: "short",
          day: "numeric",
        }).format(new Date(iso));
        expect(time.textContent).toBe(language === "ko" ? date : `on ${date}`);
        expect(time).toHaveAttribute("dateTime", iso);
        act(() => setClockPreference({ hourCycle: "h23" }));
        expect(time).toHaveAttribute(
          "title",
          new Date(iso).toLocaleString(locale, { hourCycle: "h23" }),
        );
        expect(clockPreference().hourCycle).toBe("h23");
        expect(view.container.querySelector("time")).toBe(time);
        expect(cli.spawn).toHaveBeenCalledOnce();
        expect(cli.kills).not.toHaveBeenCalled();
      }
      if (
        Intl.DateTimeFormat().resolvedOptions().timeZone ===
          "America/New_York" &&
        iso.startsWith("2024-03-10")
      ) {
        expect(time.title).toContain(
          iso.includes("06:59") ? "01:59:59" : "03:00:00",
        );
      }
      if (iso.startsWith("2023"))
        expect(time.textContent).not.toContain("2023");
    } finally {
      await act(async () => cli.ready.resolve());
      view.unmount();
    }
  },
);

it.each([
  {
    name: "same-English Error",
    failure: new Error("Loading from GitHub…"),
    text: "Loading from GitHub…",
  },
  { name: "same-English string", failure: "Retry", text: "Retry" },
  { name: "empty Error", failure: new Error(""), text: "" },
])(
  "retains a $name read failure and the same recovery controls without translating provider text",
  async (c) => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(c.failure)
      .mockResolvedValue(
        new Response(JSON.stringify({ description: "Recovered raw body" })),
      );
    vi.stubGlobal("fetch", fetch);
    const view = render(
      <GitHubPanel
        target="https://github.com/example/project"
        close={() => {}}
      />,
    );
    try {
      const alert = await screen.findByRole("alert");
      const raw = alert.querySelector("p");
      expect(raw?.textContent).toBe(c.text);
      const external = withinAlertLink(alert);
      expect(external).toHaveTextContent("Open on Github");
      const retry = screen.getByRole("button", { name: "Retry" });
      retry.focus();
      for (const language of ["ko", "en"] as const) {
        act(() => setLanguage(language));
        expect(screen.getByRole("alert")).toBe(alert);
        expect(alert.querySelector("p")).toBe(raw);
        expect(raw?.textContent).toBe(c.text);
        expect(external).toHaveTextContent(
          language === "ko" ? "GitHub에서 열기" : "Open on Github",
        );
        expect(
          screen.getByRole("button", {
            name: language === "ko" ? "다시 시도" : "Retry",
          }),
        ).toBe(retry);
        expect(retry).toHaveFocus();
        expect(fetch).toHaveBeenCalledOnce();
      }
      await userEvent.click(retry);
      expect(
        await screen.findByRole("heading", { name: "example/project" }),
      ).toBeVisible();
      expect(screen.getByText("Recovered raw body")).toBeVisible();
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      view.unmount();
    }
  },
);
function withinAlertLink(alert: HTMLElement) {
  const link = alert.querySelector("a");
  if (!link) throw new Error("Missing actual read-recovery link");
  expect(link).toHaveAttribute("href", "https://github.com/example/project");
  return link;
}

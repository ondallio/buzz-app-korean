import { finalizeEvent, getPublicKey } from "nostr-tools";
import { test, expect } from "./fixture.mjs";
import { stopRoutes } from "./playwright-test.mjs";
import { open as openConversation } from "./timeline.mjs";
import {
  openPage,
  openSettings,
  selectSettingsSection,
  settleDialogMotion,
  settlePanelMotion,
} from "./navigation.mjs";

test.use({ productionBroker: true, localAgentActivity: true });

async function languageDriver(context, app) {
  const sibling = await context.newPage();
  app.watchPageErrors(sibling);
  await sibling.goto(app.origin);
  await expect(
    sibling.getByRole("button", { name: /^Community switcher:/ }),
  ).toBeVisible();
  return {
    async set(page, language) {
      await sibling.evaluate((language) => {
        localStorage.setItem("buzz-korean-beta.language.v1", language);
      }, language);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
    },
    close: async () => {
      await stopRoutes(context);
      await sibling.close();
    },
  };
}

async function sameNode(locator, prior) {
  expect(await locator.evaluate((node, prior) => node === prior, prior)).toBe(
    true,
  );
}

async function capture(page, info, name, subject) {
  await subject.scrollIntoViewIfNeeded();
  await page.evaluate(async () => {
    await Promise.allSettled(
      document
        .getAnimations()
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished),
    );
  });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expect(subject).toBeInViewport();
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: "image/png" });
}

async function darkAndEnlarge(page) {
  await openSettings(page);
  await selectSettingsSection(page, "Appearance");
  await page.getByRole("combobox", { name: "Mode", exact: true }).click();
  await page.getByRole("option", { name: "Dark", exact: true }).click();
  for (let count = 0; count < 5; count++)
    await page
      .getByRole("button", { name: "Increase interface size", exact: true })
      .click();
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
}

test.describe("Korean Agents app wiring", () => {
  test("keeps the registered agent card and open details across languages and narrow layout", async ({
    page,
    context,
    app,
  }, info) => {
    await page.goto(app.origin);
    await openPage(page, "Agents");
    const card = page.locator(
      '[role="gridcell"][data-agent="79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"]',
    );
    await expect(card).toBeVisible();
    await expect(card).toHaveAccessibleName("Local tester, Bestie");
    const cardNode = await card.elementHandle();
    await card.click();
    await expect(card).toHaveAttribute("aria-selected", "true");
    await card.press("Enter");
    const identity = page.getByRole("complementary", {
      name: "Local tester identity",
      exact: true,
    });
    await expect(identity).toBeVisible();
    const node = await identity.elementHandle();
    await darkAndEnlarge(page);
    const driver = await languageDriver(context, app);
    try {
      await driver.set(page, "ko");
      const translated = page.getByRole("complementary", {
        name: "Local tester 프로필",
        exact: true,
      });
      await sameNode(translated, node);
      await sameNode(card, cardNode);
      await expect(
        page.getByRole("button", { name: "메시지", exact: true }),
      ).toBeVisible();
      await page.setViewportSize({ width: 480, height: 760 });
      await settlePanelMotion(page);
      await capture(page, info, "agents-korean-narrow", translated);
      await driver.set(page, "en");
      await sameNode(identity, node);
      await expect(identity).toContainText("Local tester");
      await sameNode(card, cardNode);
      expect(await card.getAttribute("data-agent")).toBe(
        "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      );
    } finally {
      await driver.close();
    }
  });
});

test.describe("Korean Workflow app wiring", () => {
  const channel = "44444444-4444-4444-8444-444444444444";
  test.use({
    enabledPlugins: ["buzz.workflows"],
    channelIds: [channel],
    channelNames: { [channel]: "Raw workflow channel" },
    historyCounts: { [channel]: 1 },
  });
  test("retains raw scheduled YAML in the registered editor and narrow inspector", async ({
    page,
    context,
    app,
  }, info) => {
    const raw =
      "# Raw {comment} 한글\nname: Raw schedule\nenabled: false\ntrigger:\n  on: schedule\n  cron: 0 9 * * *\nsteps:\n  - id: notify\n    action: send_message\n    text: Raw {message} 한글\n";
    const event = app.sign({
      kind: 30620,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["h", channel],
        ["d", "55555555-5555-4555-8555-555555555555"],
      ],
      content: raw,
    });
    let reads = 0;
    await page.route("**/api/relay/**", async (route) => {
      if (!new URL(route.request().url()).pathname.endsWith("/query"))
        return route.fallback();
      const filters = route.request().postDataJSON();
      if (
        !filters.every(
          (filter) => filter.kinds?.length === 1 && filter.kinds[0] === 30620,
        )
      )
        return route.fallback();
      for (const filter of filters) expect(filter["#h"]).toEqual([channel]);
      reads++;
      return route.fulfill({ json: [event] });
    });
    await page.goto(app.origin);
    await openPage(page, "Workflows");
    await page
      .getByRole("button", { name: "Actions for Raw schedule", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Edit workflow", exact: true })
      .click();
    const editor = page.getByRole("dialog").filter({
      has: page.getByRole("region", { name: "Workflow editor", exact: true }),
    });
    await expect(editor).toBeVisible();
    await settleDialogMotion(editor);
    await page.getByRole("tab", { name: "YAML", exact: true }).click();
    const yaml = page.getByRole("textbox", {
      name: "Workflow YAML",
      exact: true,
    });
    await expect(yaml).toHaveValue(raw);
    const yamlNode = await yaml.elementHandle();
    const editorNode = await editor.elementHandle();
    const driver = await languageDriver(context, app);
    try {
      await driver.set(page, "ko");
      const translatedEditor = page.getByRole("dialog").filter({
        has: page.getByRole("region", {
          name: "워크플로 편집기",
          exact: true,
        }),
      });
      await sameNode(translatedEditor, editorNode);
      const koreanYaml = page.getByRole("textbox", {
        name: "워크플로 YAML",
        exact: true,
      });
      await sameNode(koreanYaml, yamlNode);
      await expect(koreanYaml).toHaveValue(raw);
      await page.getByRole("tab", { name: "폼", exact: true }).click();
      await page.getByRole("button", { name: /^트리거 편집:/ }).click();
      await expect(
        page.getByRole("radio", { name: "매일", exact: true }),
      ).toBeChecked();
      await expect(
        page.getByLabel("실행 시각 (UTC)", { exact: true }),
      ).toHaveValue("09:00");
      await page.setViewportSize({ width: 480, height: 760 });
      const inspector = page.getByRole("dialog", {
        name: "트리거 설정",
        exact: true,
      });
      await expect(inspector).toBeVisible();
      await settleDialogMotion(inspector);
      const close = inspector.getByRole("button", {
        name: "검사기 닫기",
        exact: true,
      });
      await expect(close).toBeVisible();
      await capture(page, info, "workflow-korean-inspector", close);
      await close.focus();
      await page.keyboard.press("Escape");
      await expect(close).toHaveCount(0);
      await expect(translatedEditor).toBeVisible();
      await page.getByRole("tab", { name: "YAML", exact: true }).click();
      await expect(
        page.getByRole("textbox", { name: "워크플로 YAML", exact: true }),
      ).toHaveValue(raw);
      await driver.set(page, "en");
      await sameNode(editor, editorNode);
      expect(reads).toBeGreaterThan(0);
      expect(
        app.report.publications.filter(({ event }) =>
          [30620, 46020, 5].includes(event.kind),
        ),
      ).toHaveLength(0);
    } finally {
      await driver.close();
    }
  });
});

test("keeps checked resources and mention targets literal through Korean portals and repository navigation", async ({
  page,
  context,
  app,
}, info) => {
  const key = new Uint8Array(32).fill(23);
  const owner = getPublicKey(key);
  const repository = finalizeEvent(
    {
      kind: 30617,
      created_at: 1,
      content: "",
      tags: [
        ["d", "game"],
        ["name", "Game repo"],
        ["buzz-channel", "alpha"],
      ],
    },
    key,
  );
  const issue = finalizeEvent(
    {
      kind: 1621,
      created_at: 2,
      content: "Raw issue body {body} 한글",
      tags: [
        ["a", `30617:${owner}:game`],
        ["subject", "Fix login"],
      ],
    },
    key,
  );
  const events = [repository, issue];
  const held = [];
  let validated = false;
  await page.route("**/api/relay/**", async (route) => {
    if (!new URL(route.request().url()).pathname.endsWith("/query"))
      return route.fallback();
    const filters = route.request().postDataJSON();
    if (
      !filters.some(
        (filter) =>
          filter.kinds?.some((kind) => [30617, 1621, 1618].includes(kind)) ||
          filter["#a"]?.some((value) => value.includes(owner)) ||
          filter.ids?.includes(issue.id) ||
          filter["#e"]?.includes(issue.id),
      )
    )
      return route.fallback();
    const json = events.filter((event) =>
      filters.some(
        (filter) =>
          (!filter.kinds || filter.kinds.includes(event.kind)) &&
          (!filter.ids || filter.ids.includes(event.id)) &&
          (!filter.authors || filter.authors.includes(event.pubkey)) &&
          Object.entries(filter).every(
            ([name, wanted]) =>
              !name.startsWith("#") ||
              wanted.some((value) =>
                event.tags.some(
                  ([tag, target]) => tag === name.slice(1) && target === value,
                ),
              ),
          ),
      ),
    );
    if (!validated && filters.some((filter) => filter.ids?.includes(issue.id)))
      return held.push(() => route.fulfill({ json }));
    return route.fulfill({ json });
  });
  await openConversation(page, app);
  const input = page.getByRole("textbox", {
    name: "Message #Alpha",
    exact: true,
  });
  const inputNode = await input.elementHandle();
  const rawDraft = "Raw draft 한글 ";
  await input.fill(rawDraft);
  await page
    .getByRole("button", { name: "Add issue or pull request", exact: true })
    .click();
  const row = page.getByRole("button", {
    name: "Fix login, Issue in Game repo",
    exact: true,
  });
  await row.click();
  await expect.poll(() => held.length).toBe(1);
  await expect(row).toBeDisabled();
  const search = page.getByRole("searchbox", {
    name: "Search issues and pull requests",
    exact: true,
  });
  const searchNode = await search.elementHandle();
  const driver = await languageDriver(context, app);
  try {
    await driver.set(page, "ko");
    const koSearch = page.getByRole("searchbox", {
      name: "이슈 및 PR 검색",
      exact: true,
    });
    await sameNode(koSearch, searchNode);
    await expect(koSearch).toBeFocused();
    await expect(
      page.getByRole("status").filter({ hasText: "선택한 항목 확인 중…" }),
    ).toBeVisible();
    validated = true;
    await held.shift()();
    const koInput = page.getByRole("textbox", {
      name: "#Alpha에 메시지 보내기",
      exact: true,
    });
    await sameNode(koInput, inputNode);
    await expect(koInput).toContainText("Fix login");
    await expect.poll(() => koInput.textContent()).toContain(rawDraft);
    await expect(koInput).toBeFocused();
    await page
      .getByRole("button", { name: "멤버 멘션하기", exact: true })
      .click();
    const popup = page.getByRole("dialog", {
      name: "멤버 또는 에이전트 멘션하기",
      exact: true,
    });
    const choice = popup.locator("[data-mention-choice]").first();
    await expect(choice).toBeEnabled();
    const pubkey = await choice.getAttribute("data-mention-choice");
    expect(pubkey).toMatch(/^[a-f0-9]{64}$/);
    await choice.click();
    await expect(koInput).toBeFocused();
    await koInput.press("Enter");
    const messages = () =>
      app.report.publications.filter(({ event }) => event.kind === 9);
    await expect.poll(() => messages().length).toBe(1);
    const uri = `buzz://issue?id=${issue.id}&owner=${owner}&d=game`;
    const rawPrefix = `${rawDraft}[Fix login](${uri})`;
    expect(messages()[0].event.content.slice(0, rawPrefix.length)).toBe(
      rawPrefix,
    );
    expect(messages()[0].event.content).toContain(uri);
    expect(messages()[0].event.tags).toContainEqual(["p", pubkey]);
    expect(messages()[0].event.tags).toContainEqual(["h", "alpha"]);
    const link = page.locator(`a[href="${uri}"]`).last();
    await link.click();
    await expect(
      page.getByRole("heading", { name: "Fix login", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Raw issue body {body} 한글", { exact: true }),
    ).toBeVisible();
    const issueRegion = page.getByRole("region", { name: "이슈", exact: true });
    await expect(issueRegion.locator("p").first()).toContainText("열림 ·");
    await expect(issueRegion.locator("time")).toHaveText(
      "1970. 1. 1. 오전 12:00:02",
    );
    await page.setViewportSize({ width: 480, height: 760 });
    await capture(
      page,
      info,
      "repository-korean-issue",
      page.getByRole("heading", { name: "Fix login", exact: true }),
    );
    await driver.set(page, "en");
    await expect(
      page
        .getByRole("region", { name: "Issues", exact: true })
        .locator("p")
        .first(),
    ).toContainText("Open ·");
  } finally {
    validated = true;
    for (const release of held) await release();
    await driver.close();
  }
});

test("shows the Korean TypeSafe desktop boundary without exposing terminal or key controls", async ({
  page,
  context,
  app,
}, info) => {
  await page.goto(app.origin);
  await darkAndEnlarge(page);
  await openSettings(page);
  await selectSettingsSection(page, "Decisions API");
  await expect(
    page.getByRole("heading", { name: "TypeSafe", exact: true }),
  ).toBeVisible();
  const status = page.getByText("Open the Buzz desktop app to use TypeSafe.", {
    exact: true,
  });
  await expect(status).toBeVisible();
  const node = await status.elementHandle();
  const driver = await languageDriver(context, app);
  try {
    await driver.set(page, "ko");
    const translated = page.getByText(
      "TypeSafe를 사용하려면 Buzz 데스크톱 앱을 여세요.",
      { exact: true },
    );
    await sameNode(translated, node);
    await expect(
      page.getByRole("textbox", { name: "TypeSafe API 키", exact: true }),
    ).toHaveCount(0);
    const settings = page.getByRole("dialog", { name: "설정", exact: true });
    await expect(
      settings.getByRole("button", { name: "터미널", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Toggle channel terminal",
        exact: true,
      }),
    ).toHaveCount(0);
    await page.setViewportSize({ width: 480, height: 760 });
    await capture(page, info, "typesafe-korean-desktop-boundary", translated);
    await driver.set(page, "en");
    await sameNode(status, node);
    const englishSettings = page.getByRole("dialog", {
      name: "Settings",
      exact: true,
    });
    await expect(englishSettings).toBeVisible();
    await expect(
      englishSettings.getByRole("button", { name: "Terminal", exact: true }),
    ).toHaveCount(0);
  } finally {
    await driver.close();
  }
});

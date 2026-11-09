import { finalizeEvent } from "nostr-tools";
import { npubEncode } from "nostr-tools/nip19";
import { test, expect } from "./fixture.mjs";
import { stopRoutes } from "./playwright-test.mjs";
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
      await sibling.evaluate(
        (language) =>
          localStorage.setItem("buzz-korean-beta.language.v1", language),
        language,
      );
      await expect(page.locator("html")).toHaveAttribute("lang", language);
    },
    async close() {
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
  await expect(subject).toBeInViewport();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: "image/png" });
}
async function darkAndEnlarge(page) {
  await openSettings(page);
  await selectSettingsSection(page, "Appearance");
  await page.getByRole("combobox", { name: "Mode", exact: true }).click();
  await page.getByRole("option", { name: "Dark", exact: true }).click();
  for (let step = 0; step < 5; step++)
    await page
      .getByRole("button", { name: "Increase interface size", exact: true })
      .click();
  await page
    .getByRole("button", { name: "Close Settings", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
}

// This fixture models directory reads, not the DM open/create receipt. No send is attempted.
test("New DM keeps raw recipient, query and draft through the real Korean picker portal", async ({
  page,
  context,
  app,
}, info) => {
  const rawName = "Raw Recipient 한글 {name}";
  const profile = finalizeEvent(
    {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify({ name: rawName }),
    },
    Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 2 : 0)),
  );
  const directoryReads = [];
  await page.route("**/api/relay/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON();
    if (path.endsWith("/profile-search"))
      return route.fulfill({ json: [profile] });
    if (
      path.endsWith("/query") &&
      Array.isArray(body) &&
      body.every(
        (filter) =>
          filter.kinds?.length === 1 &&
          filter.kinds[0] === 0 &&
          (!filter.authors || filter.authors.includes(profile.pubkey)),
      )
    ) {
      if (body.every((filter) => !filter.authors)) directoryReads.push(body);
      return route.fulfill({ json: [profile] });
    }
    return route.fallback();
  });
  await page.goto(app.origin);
  await openPage(page, "Messages");
  const sidebar = page.getByRole("navigation", { name: "Subscribed channels" });
  await sidebar.locator('[data-sidebar-section="dms"] summary').hover();
  await sidebar
    .getByRole("button", { name: "New message", exact: true })
    .click();
  const input = page.getByRole("combobox", {
    name: "Message recipients",
    exact: true,
  });
  await expect(input).toBeFocused();
  await input.fill("Raw Recipient");
  const choice = page.getByRole("option", { name: rawName, exact: true });
  await expect(choice).toBeVisible();
  const inputNode = await input.elementHandle();
  const list = page.getByRole("listbox", { name: "People", exact: true });
  const listNode = await list.elementHandle();
  const driver = await languageDriver(context, app);
  try {
    await input.focus();
    await input.evaluate((node) => node.setSelectionRange(1, 5));
    const before = app.report.publications.length;
    await driver.set(page, "ko");
    const koInput = page.getByRole("combobox", {
      name: "메시지를 받을 사람",
      exact: true,
    });
    await sameNode(koInput, inputNode);
    await sameNode(
      page.getByRole("listbox", { name: "사람", exact: true }),
      listNode,
    );
    await expect(koInput).toHaveValue("Raw Recipient");
    await expect(koInput).toBeFocused();
    expect(
      await koInput.evaluate((node) => [
        node.selectionStart,
        node.selectionEnd,
      ]),
    ).toEqual([1, 5]);
    await expect(choice).toHaveAccessibleName(rawName);
    await expect(choice).toHaveAttribute("data-recipient-key", profile.pubkey);
    await choice.click();
    const chip = page.getByText(rawName, { exact: true }).locator("..");
    await expect(chip).toContainText(rawName);
    const chipNode = await chip.elementHandle();
    const editor = page.locator('form[data-composer-surface] [role="textbox"]');
    await expect(editor).toHaveAccessibleName(`${rawName}에게 메시지`);
    await editor.fill("Raw draft {count} 한글\nsecond line");
    await expect(editor).toBeFocused();
    const editorNode = await editor.elementHandle();
    const draft = await editor.textContent();
    await driver.set(page, "en");
    await sameNode(
      page.getByRole("textbox", { name: `Message ${rawName}`, exact: true }),
      editorNode,
    );
    await sameNode(chip, chipNode);
    await expect(editor).toBeFocused();
    expect(await editor.textContent()).toBe(draft);
    await expect(
      chip.getByRole("button", { name: `Remove ${rawName}`, exact: true }),
    ).toBeVisible();
    const savedRecipients = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(
        (key) =>
          key.startsWith("buzz-view.v1:") &&
          JSON.parse(key.slice("buzz-view.v1:".length))[1] ===
            "direct-message:recipients",
      );
      return key ? JSON.parse(localStorage.getItem(key)) : null;
    });
    expect(savedRecipients).toEqual([
      { pubkey: profile.pubkey, name: rawName },
    ]);
    await driver.set(page, "ko");
    await page.setViewportSize({ width: 480, height: 760 });
    await settlePanelMotion(page);
    await capture(page, info, "dm-korean-draft-narrow", editor);
    expect(await editor.textContent()).toBe(draft);
    expect(app.report.publications.length).toBe(before);
    // A complete one-person directory filters this query locally; no name-search API is needed.
    expect(
      directoryReads
        .flat()
        .some((filter) => filter.page === 1 && filter.limit === 15),
    ).toBe(true);
  } finally {
    await driver.close();
  }
});

// The local tester has one community membership, so a Memory scope badge is correctly absent.
test("Agent Memory uses Korean empty sections without replacing the selected real AgentTabs", async ({
  page,
  context,
  app,
}, info) => {
  await page.goto(app.origin);
  await openPage(page, "Agents");
  const card = page.locator(
    '[role="gridcell"][data-agent="79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"]',
  );
  await expect(card).toHaveAccessibleName("Local tester, Bestie");
  await card.click();
  await card.press("Enter");
  const identity = page.getByRole("complementary", {
    name: "Local tester identity",
    exact: true,
  });
  await expect(identity).toBeVisible();
  await page.getByRole("tab", { name: "Memory", exact: true }).click();
  const core = page.getByRole("region", { name: "Core memories", exact: true });
  await expect(
    core.getByText("No memories yet", { exact: true }),
  ).toBeVisible();
  const coreNode = await core.elementHandle();
  const tab = page.getByRole("tab", { name: "Memory", exact: true });
  const tabNode = await tab.elementHandle();
  await expect(
    page.locator('[role="tab"][data-tab-value="agent:activity"]'),
  ).toHaveAccessibleName("Activity");
  await expect(
    page.getByRole("button", { name: /^Memory scope:/ }),
  ).toHaveCount(0);
  await darkAndEnlarge(page);
  const driver = await languageDriver(context, app);
  try {
    await tab.focus();
    await driver.set(page, "ko");
    const koTab = page.getByRole("tab", { name: "기억", exact: true });
    await sameNode(koTab, tabNode);
    await expect(koTab).toBeFocused();
    await expect(koTab).toHaveAttribute("aria-selected", "true");
    await sameNode(
      page.getByRole("region", { name: "핵심 기억", exact: true }),
      coreNode,
    );
    await expect(
      page.getByText("모든 세션에서 이 에이전트의 맥락에 포함됩니다.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("에이전트가 필요할 때 찾아볼 수 있는 정보입니다.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("아직 기억이 없습니다", { exact: true }),
    ).toHaveCount(2);
    await expect(
      page.locator('[role="tab"][data-tab-value="agent:activity"]'),
    ).toHaveAccessibleName("Activity");
    await expect(page.getByRole("button", { name: /^기억 범위:/ })).toHaveCount(
      0,
    );
    await page.setViewportSize({ width: 480, height: 760 });
    await settlePanelMotion(page);
    await capture(
      page,
      info,
      "memory-korean-dark-150-narrow",
      page.getByRole("region", { name: "핵심 기억", exact: true }),
    );
    await driver.set(page, "en");
    await sameNode(tab, tabNode);
    await sameNode(core, coreNode);
    await expect(card).toHaveAttribute(
      "data-agent",
      "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    );
    await expect(
      core.getByText("No memories yet", { exact: true }),
    ).toBeVisible();
  } finally {
    await driver.close();
  }
});

test.describe("Korean Focus and status", () => {
  test.use({ enabledPlugins: ["buzz.focus"] });
  test("retains Focus preference popup and status draft inside the localized Calendar", async ({
    page,
    context,
    app,
  }, info) => {
    await page.goto(app.origin);
    await openSettings(page);
    await selectSettingsSection(page, "Focus", "Focus settings");
    const select = page.getByRole("combobox", {
      name: "Default length",
      exact: true,
    });
    await select.click();
    await page.getByRole("option", { name: "2 hours", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("buzz-focus-preferences.v1"))
              ?.length,
        ),
      )
      .toBe("7200");
    await select.click();
    const selectNode = await select.elementHandle();
    const popupNode = await page.getByRole("listbox").elementHandle();
    const driver = await languageDriver(context, app);
    try {
      await driver.set(page, "ko");
      const koSelect = page.getByRole("combobox", {
        name: "기본 시간",
        exact: true,
      });
      await sameNode(koSelect, selectNode);
      await sameNode(page.getByRole("listbox"), popupNode);
      await expect(
        page.getByRole("option", { name: "2시간", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await page.keyboard.press("Escape");
      await expect(koSelect).toBeFocused();
      await driver.set(page, "en");
      await page
        .getByRole("button", { name: "Close Settings", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Your profile", exact: true })
        .click();
      await page.getByRole("menuitem", { name: /^Set a status/ }).click();
      const dialog = page.getByRole("dialog", {
        name: "Set a status",
        exact: true,
      });
      const input = page.getByRole("textbox", {
        name: /^(Status message|상태 메시지)$/,
      });
      await input.fill("Raw status {time} 한글");
      await input.evaluate((node) => node.setSelectionRange(2, 7));
      const inputNode = await input.elementHandle();
      await driver.set(page, "ko");
      await sameNode(
        page.getByRole("textbox", { name: "상태 메시지", exact: true }),
        inputNode,
      );
      await expect(input).toBeFocused();
      expect(
        await input.evaluate((node) => [
          node.selectionStart,
          node.selectionEnd,
        ]),
      ).toEqual([2, 7]);
      await page
        .getByRole("button", { name: "기간: 오늘", exact: true })
        .click();
      await page
        .getByRole("menuitemradio", {
          name: "직접 설정",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "상태 만료 날짜", exact: true })
        .click();
      const calendar = page.getByRole("dialog", {
        name: "만료 날짜 선택",
        exact: true,
      });
      await expect(calendar).toBeVisible();
      await expect(
        calendar.getByRole("button", { name: "다음 달로 이동", exact: true }),
      ).toBeVisible();
      const calendarNode = await calendar.elementHandle();
      await page.setViewportSize({ width: 480, height: 760 });
      await capture(page, info, "status-korean-calendar-narrow", calendar);
      await driver.set(page, "en");
      await sameNode(
        page.getByRole("dialog", {
          name: "Choose expiration date",
          exact: true,
        }),
        calendarNode,
      );
      await expect(input).toHaveValue("Raw status {time} 한글");
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Status expiration date",
          exact: true,
        }),
      ).toBeFocused();
      expect(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("buzz-focus-preferences.v1"))
              ?.length,
        ),
      ).toBe("7200");
      expect(
        app.report.publications.filter(({ event }) => event.kind === 30315),
      ).toHaveLength(0);
      await dialog
        .getByRole("button", { name: "Close status editor", exact: true })
        .click();
    } finally {
      await driver.close();
    }
  });
});

// This is the existing HTTP fixture mode, not the production broker's invite policy.
test.describe("Korean administration host", () => {
  test.use({ productionBroker: false });
  // Existing fixture owns signed13534 roster and POST invite; it does not model member mutations.
  test("Membership keeps raw search and one modeled invite across Korean menu portals", async ({
    page,
    context,
    app,
  }, info) => {
    const requests = [];
    const roster = app.membershipSnapshot("owner");
    await page.route("**/api/relay/primary/query", async (route) => {
      const filters = route.request().postDataJSON();
      if (filters.every((filter) => filter.kinds?.includes(13534))) {
        expect(filters).toEqual([
          { authors: [roster.pubkey], kinds: [13534], limit: 1 },
        ]);
        return route.fulfill({ json: [roster] });
      }
      return route.fallback();
    });
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname.endsWith("/invite") &&
        request.method() === "POST"
      )
        requests.push(request.postDataJSON());
    });
    await page.goto(app.origin);
    await openSettings(page);
    await selectSettingsSection(page, "Membership");
    const search = page.getByRole("searchbox", {
      name: /^(Search members|멤버 검색)$/,
    });
    const memberLabel = `Fixture Reader · npub…${npubEncode(roster.tags[0][1]).slice(-3)}`;
    const member = page
      .locator('section[aria-labelledby="community-admin-title"]')
      .getByText(memberLabel, { exact: true });
    await expect(member).toBeVisible();
    const memberNode = await member.elementHandle();
    await search.fill("Fixture");
    await search.evaluate((node) => node.setSelectionRange(1, 4));
    const searchNode = await search.elementHandle();
    const driver = await languageDriver(context, app);
    try {
      await search.focus();
      await driver.set(page, "ko");
      await sameNode(
        page.getByRole("searchbox", { name: "멤버 검색", exact: true }),
        searchNode,
      );
      await expect(search).toHaveValue("Fixture");
      await sameNode(member, memberNode);
      await expect(member).toHaveText(memberLabel);
      await expect(search).toBeFocused();
      expect(
        await search.evaluate((node) => [
          node.selectionStart,
          node.selectionEnd,
        ]),
      ).toEqual([1, 4]);
      await expect(
        page.getByRole("button", { name: "멤버 검색 지우기", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "멤버 초대", exact: true })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "사람 추가 또는 초대",
        exact: true,
      });
      await settleDialogMotion(dialog);
      const link = dialog.getByRole("textbox", {
        name: "커뮤니티 초대 링크",
        exact: true,
      });
      await expect(link).toHaveValue("https://primary.example/invite/fixture");
      await expect.poll(() => requests.length).toBe(1);
      expect(requests).toEqual([{ ttl_secs: 259200, max_uses: null }]);
      await dialog
        .getByRole("button", { name: "초대 만료 기간 선택", exact: true })
        .click();
      const menu = page.getByRole("menu");
      await expect(
        menu.getByRole("menuitemradio", { name: "3일", exact: true }),
      ).toBeChecked();
      const menuNode = await menu.elementHandle();
      const dialogNode = await dialog.elementHandle();
      await driver.set(page, "en");
      const enDialog = page.getByRole("dialog", {
        name: "Add or invite people",
        exact: true,
      });
      await sameNode(enDialog, dialogNode);
      await sameNode(page.getByRole("menu"), menuNode);
      await expect(
        menu.getByRole("menuitemradio", { name: "3 days", exact: true }),
      ).toBeChecked();
      await page.keyboard.press("Escape");
      await expect(
        enDialog.getByRole("button", {
          name: "Choose invite expiry",
          exact: true,
        }),
      ).toBeFocused();
      await expect(
        enDialog.getByRole("textbox", {
          name: "Community invite link",
          exact: true,
        }),
      ).toHaveValue("https://primary.example/invite/fixture");
      await driver.set(page, "ko");
      await page.setViewportSize({ width: 480, height: 760 });
      await capture(page, info, "membership-korean-invite-narrow", dialog);
      expect(requests).toEqual([{ ttl_secs: 259200, max_uses: null }]);
      await dialog.getByRole("button", { name: "닫기", exact: true }).click();
      await expect(
        page.getByRole("searchbox", { name: "멤버 검색", exact: true }),
      ).toHaveValue("Fixture");
    } finally {
      await driver.close();
    }
  });
});

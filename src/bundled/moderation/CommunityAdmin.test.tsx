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
import userEvent from "@testing-library/user-event";
import { npubEncode } from "nostr-tools/nip19";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import type { RelayData } from "../../features/relay/service";
import { mediaUrl } from "../../features/relay/transport";
import { publicKeyLabels } from "../../shared/identity/public-key";
import { allowedActions, membersFromSnapshot } from "./api";
import { CommunityAdmin } from "./CommunityAdmin";

const relayKey = "f".repeat(64);
const owner = "0".repeat(64);
const admin = "1".repeat(64);
const member = "2".repeat(64);
const snapshot = (tags: string[][], pubkey = relayKey) => ({
  id: "e".repeat(64),
  kind: 13534,
  pubkey,
  created_at: 1,
  content: "",
  sig: "",
  tags,
});
const roster = [
  ["-"],
  ["member", owner, "owner"],
  ["member", admin, "admin"],
  ["member", member, "member"],
];

beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  setLanguage("en");
  vi.unstubAllGlobals();
});

it("reads roles only from the relay-signed member list", () => {
  expect(membersFromSnapshot(snapshot(roster), relayKey)).toEqual([
    { pubkey: owner, role: "owner" },
    { pubkey: admin, role: "admin" },
    { pubkey: member, role: "member" },
  ]);
  expect(() =>
    membersFromSnapshot(snapshot(roster, owner), relayKey),
  ).toThrow();
  expect(
    membersFromSnapshot(
      snapshot([
        ["p", admin, "", "owner"],
        ["member", "A".repeat(64), "owner"],
      ]),
      relayKey,
    ),
  ).toEqual([]);
});

it("offers only actions the relay permission matrix allows", () => {
  const m = (role: "owner" | "admin" | "member") => ({ pubkey: member, role });
  expect(allowedActions("owner", m("member"), false)).toEqual([
    "promote",
    "remove",
  ]);
  expect(allowedActions("owner", m("admin"), false)).toEqual([
    "demote",
    "remove",
  ]);
  expect(allowedActions("owner", m("owner"), false)).toEqual([]);
  expect(allowedActions("owner", m("admin"), true)).toEqual([]);
  expect(allowedActions("admin", m("member"), false)).toEqual(["remove"]);
  expect(allowedActions("admin", m("admin"), false)).toEqual([]);
  expect(allowedActions("member", m("member"), false)).toEqual([]);
  expect(allowedActions(undefined, m("member"), false)).toEqual([]);
});

function relay(
  viewer: string,
  events = [snapshot(roster)],
  profiles = new Map<string, { name: string; picture?: string }>(),
  people: { pubkey: string; name: string }[] = [],
) {
  const read = vi.fn(async () => events);
  const session = {
    relayAuthor: relayKey,
    read,
    viewer,
    // The real sizing rewrite behind a pass-through proxy, as the session applies it.
    media: (url: string, size?: "small") =>
      mediaUrl(url, (proxied) => proxied, "https://primary.example", size),
    directMessages: {
      people: async () => ({ people, hasMore: false }),
    },
    profiles: {
      subscribe: () => () => {},
      snapshot: () => profiles,
      ensure: async () => {},
    },
  };
  const value = {
    status: "ready",
    generation: 1,
    scope: `https://primary.example:${viewer}`,
    viewer,
    session,
  };
  return {
    read,
    relay: {
      snapshot: () => value,
      subscribe: () => () => {},
    } as unknown as RelayData,
  };
}

function broker(
  routes: Record<string, (body: unknown) => Response | Promise<Response>>,
) {
  const calls: { route: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const route = String(url).split("/").at(-1) ?? "";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ route, body });
      if (route === "session") return Response.json({ relayAuthor: relayKey });
      // Scoped requests register their community with the broker first.
      if (route === "register") return new Response(null, { status: 204 });
      return routes[route]?.(body) ?? Response.json({}, { status: 404 });
    }),
  );
  return calls;
}

it("gates administration to owners and admins by the verified roster", async () => {
  broker({});
  const { relay: data, read } = relay(member);
  render(<CommunityAdmin relay={data} active={() => true} />);
  expect(
    await screen.findByText(
      "Only community owners and admins can invite people or manage members.",
    ),
  ).toBeVisible();
  expect(read).toHaveBeenCalledWith(
    [{ kinds: [13534], authors: [relayKey], limit: 1 }],
    expect.objectContaining({ fresh: true }),
  );
  expect(screen.queryByRole("button", { name: "Invite members" })).toBeNull();
});

it("treats a roster signed by anyone else as unavailable", async () => {
  broker({});
  const { relay: data } = relay(owner, [snapshot(roster, owner)]);
  render(<CommunityAdmin relay={data} active={() => true} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not load members",
  );
});

it("mints a bounded invite and surfaces relay refusals", async () => {
  const user = userEvent.setup();
  let refuse = false;
  const calls = broker({
    invite: (body) =>
      refuse
        ? Response.json(
            { error: "only relay owners and admins can create invites" },
            { status: 403 },
          )
        : Response.json({
            code: "abc",
            url: "https://primary.example/invite/abc",
            expires_at: 1700003600,
            max_uses: (body as { max_uses: number | null }).max_uses,
            uses_remaining: (body as { max_uses: number | null }).max_uses,
          }),
  });
  const { relay: data } = relay(admin);
  render(<CommunityAdmin relay={data} active={() => true} />);
  await user.click(
    await screen.findByRole("button", { name: "Invite members" }),
  );
  // Opening the dialog creates the link with the default settings.
  expect(
    await screen.findByDisplayValue("https://primary.example/invite/abc"),
  ).toBeVisible();
  expect(calls.filter((c) => c.route === "invite")).toEqual([
    { route: "invite", body: { ttl_secs: 3 * 24 * 60 * 60, max_uses: null } },
  ]);
  // Admins cannot grant admin, so direct addition has no role choice.
  await user.type(
    screen.getByRole("textbox", { name: "Public identity" }),
    "3".repeat(64),
  );
  expect(screen.getByRole("button", { name: "Add member" })).toBeEnabled();
  expect(
    screen.queryByRole("button", { name: "Choose member role" }),
  ).toBeNull();
  refuse = true;
  await user.click(
    screen.getByRole("button", { name: "Choose maximum invite uses" }),
  );
  await user.click(await screen.findByRole("menuitemradio", { name: "1 use" }));
  expect(screen.queryByRole("menuitemradio")).toBeNull();
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "only relay owners and admins can create invites",
    ),
  );
  expect(calls.filter((c) => c.route === "invite").at(-1)?.body).toEqual({
    ttl_secs: 3 * 24 * 60 * 60,
    max_uses: 1,
  });
  expect(
    screen.queryByDisplayValue("https://primary.example/invite/abc"),
  ).toBeNull();
  expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
});

it("confirms member removal and shows the relay's refusal", async () => {
  const user = userEvent.setup();
  const calls = broker({
    member: () =>
      Response.json(
        { error: "invalid: cannot remove the relay owner" },
        { status: 400 },
      ),
  });
  const { relay: data } = relay(owner);
  render(<CommunityAdmin relay={data} active={() => true} />);
  expect(
    screen.queryByRole("button", { name: `Actions for ${owner.slice(0, 8)}` }),
  ).toBeNull();
  const menus = await screen.findAllByRole("button", { name: /^Actions for / });
  expect(menus).toHaveLength(2); // Admin and member; never the viewer/owner.
  await user.click(menus[1] as HTMLElement);
  await user.click(await screen.findByRole("menuitem", { name: "Remove" }));
  expect(calls.some((c) => c.route === "member")).toBe(false);
  await user.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: "Remove",
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "invalid: cannot remove the relay owner",
    ),
  );
  expect(calls.find((c) => c.route === "member")?.body).toEqual({
    action: "remove",
    pubkey: member,
  });
});

it("keeps an accepted removal when the refresh fails and retries read-only", async () => {
  const user = userEvent.setup();
  const calls = broker({
    member: () => Response.json({ accepted: true, message: "" }),
  });
  const { relay: data, read } = relay(owner);
  render(<CommunityAdmin relay={data} active={() => true} />);
  const menus = await screen.findAllByRole("button", { name: /^Actions for / });
  read.mockRejectedValueOnce(new Error("relay unavailable"));
  await user.click(menus[1] as HTMLElement);
  await user.click(await screen.findByRole("menuitem", { name: "Remove" }));
  await user.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: "Remove",
    }),
  );
  expect(
    await screen.findByText("Change accepted by the relay."),
  ).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Could not load members: relay unavailable The list below may be out of date.",
  );
  // A stale list offers no further destructive commands.
  expect(screen.queryAllByRole("button", { name: /^Actions for / })).toEqual(
    [],
  );
  expect(screen.queryByRole("button", { name: "Invite members" })).toBeNull();
  read.mockResolvedValueOnce([
    snapshot([
      ["member", owner, "owner"],
      ["member", admin, "admin"],
    ]),
  ]);
  await user.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(screen.getAllByRole("button", { name: /^Actions for / })).toHaveLength(
    1,
  );
  expect(calls.filter((c) => c.route === "member")).toHaveLength(1);
});

it("picks up a promotion made elsewhere when refreshed", async () => {
  const user = userEvent.setup();
  broker({});
  const { relay: data, read } = relay(member);
  render(<CommunityAdmin relay={data} active={() => true} />);
  await screen.findByText(
    "Only community owners and admins can invite people or manage members.",
  );
  read.mockResolvedValueOnce([
    snapshot([
      ["member", owner, "owner"],
      ["member", member, "admin"],
    ]),
  ]);
  await user.click(screen.getByRole("button", { name: "Refresh" }));
  expect(
    await screen.findByRole("button", { name: "Invite members" }),
  ).toBeVisible();
});

it("recovers from an initial read failure on retry", async () => {
  const user = userEvent.setup();
  broker({});
  const { relay: data, read } = relay(owner);
  read.mockRejectedValueOnce(new Error("offline"));
  render(<CommunityAdmin relay={data} active={() => true} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not load members: offline",
  );
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(
    await screen.findByRole("button", { name: "Invite members" }),
  ).toBeVisible();
  expect(screen.queryByRole("alert")).toBeNull();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

it("disables an open confirmation when a pending refresh fails", async () => {
  const user = userEvent.setup();
  const calls = broker({
    member: () => Response.json({ accepted: true, message: "" }),
  });
  const { relay: data, read } = relay(owner);
  render(<CommunityAdmin relay={data} active={() => true} />);
  const menus = await screen.findAllByRole("button", { name: /^Actions for / });
  await user.click(menus[1] as HTMLElement);
  await user.click(await screen.findByRole("menuitem", { name: "Remove" }));
  const dialog = await screen.findByRole("alertdialog");
  const confirm = within(dialog).getByRole("button", { name: "Remove" });
  expect(confirm).toBeEnabled();
  const held = deferred<ReturnType<typeof snapshot>[]>();
  read.mockReturnValueOnce(held.promise);
  // Refresh stays reachable behind the modal in the browser; drive it directly.
  screen.getByRole("button", { name: "Refresh", hidden: true }).click();
  await waitFor(() => expect(confirm).toBeDisabled());
  held.reject(new Error("relay unavailable"));
  expect(
    await within(dialog).findByText(
      "The member list is out of date. Retry before making changes.",
    ),
  ).toBeVisible();
  expect(confirm).toBeDisabled();
  confirm.click();
  await Promise.resolve();
  expect(calls.filter((c) => c.route === "member")).toHaveLength(0);
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(calls.filter((c) => c.route === "member")).toHaveLength(0);
});

it("locks an open invite dialog after an accepted add whose refresh fails", async () => {
  const user = userEvent.setup();
  const calls = broker({
    member: () => Response.json({ accepted: true, message: "" }),
    invite: () =>
      Response.json({
        code: "abc",
        url: "https://primary.example/invite/abc",
        expires_at: 1700003600,
        max_uses: null,
        uses_remaining: null,
      }),
  });
  const { relay: data, read } = relay(owner);
  render(<CommunityAdmin relay={data} active={() => true} />);
  await user.click(
    await screen.findByRole("button", { name: "Invite members" }),
  );
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByDisplayValue("https://primary.example/invite/abc");
  read.mockRejectedValueOnce(new Error("relay unavailable"));
  // The field resets after a confirmed direct addition.
  const search = () =>
    within(dialog).getByRole("textbox", {
      name: "Public identity",
    });
  await user.type(search(), "3".repeat(64));
  await user.click(within(dialog).getByRole("button", { name: "Add member" }));
  expect(
    await within(dialog).findByText("Member added directly."),
  ).toBeVisible();
  expect(
    await within(dialog).findByText(
      "The member list is out of date. Retry before making changes.",
    ),
  ).toBeVisible();
  await user.type(search(), "4".repeat(64));
  expect(
    within(dialog).getByRole("button", { name: "Add member" }),
  ).toBeDisabled();
  expect(
    within(dialog).getByRole("button", { name: "Choose maximum invite uses" }),
  ).toBeDisabled();
  expect(calls.filter((c) => c.route === "member")).toHaveLength(1);
  expect(calls.filter((c) => c.route === "invite")).toHaveLength(1);
  // Read-only recovery inside the modal re-enables new writes.
  await user.click(within(dialog).getByRole("button", { name: "Retry" }));
  await waitFor(() =>
    expect(
      within(dialog).getByRole("button", { name: "Add member" }),
    ).toBeEnabled(),
  );
  expect(calls.filter((c) => c.route === "member")).toHaveLength(1);
  // Recovery keeps the existing link rather than minting another.
  expect(calls.filter((c) => c.route === "invite")).toHaveLength(1);
});

it.each([
  ["equal", "Bob"],
  ["visually identical", "Bob\u200B"],
])(
  "qualifies %s namesakes through roster actions, confirmation and the write",
  async (_, nameB) => {
    const user = userEvent.setup();
    const bobA = "a".repeat(64);
    const bobB = "b".repeat(64);
    const calls = broker({
      member: () => Response.json({ accepted: true, message: "" }),
    });
    const { relay: data } = relay(
      owner,
      [
        snapshot([
          ["member", owner, "owner"],
          ["member", bobA, "member"],
          ["member", bobB, "member"],
        ]),
      ],
      new Map([
        [
          bobA,
          {
            name: "Bob",
            picture: `https://primary.example/media/${bobA}.png`,
          },
        ],
        [bobB, { name: nameB }],
      ]),
    );
    render(<CommunityAdmin relay={data} active={() => true} />);
    const keys = publicKeyLabels([owner, bobA, bobB]);
    const labelB = `${nameB} · ${keys.get(bobB)}`;
    expect(keys.get(bobA)).not.toBe(keys.get(bobB));
    const actionsA = await screen.findByRole("button", {
      name: `Actions for Bob · ${keys.get(bobA)}`,
    });
    expect(actionsA).toBeVisible();
    // A relay-hosted picture goes through the session proxy as the thumbnail;
    // the raw URL would be an unsigned request the relay refuses.
    expect(actionsA.closest("li")?.querySelector("img")).toHaveAttribute(
      "src",
      `https://primary.example/media/${bobA}.thumb.webp`,
    );
    await user.click(
      screen.getByRole("button", { name: `Actions for ${labelB}` }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Make admin" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(`Make admin: ${labelB}?`);
    await user.click(
      within(dialog).getByRole("button", { name: "Make admin" }),
    );
    await waitFor(() =>
      expect(calls.find((c) => c.route === "member")?.body).toEqual({
        action: "role",
        pubkey: bobB,
        role: "admin",
      }),
    );
  },
);

it("accepts only an exact identity and never searches the people directory", async () => {
  const user = userEvent.setup();
  const calls = broker({
    member: () => Response.json({ accepted: true, message: "" }),
    invite: () =>
      Response.json({
        code: "abc",
        url: "https://primary.example/invite/abc",
        expires_at: 1700003600,
        max_uses: null,
        uses_remaining: null,
      }),
  });
  const people = vi.fn(async () => ({ people: [], hasMore: false }));
  const { relay: data } = relay(owner);
  (
    data.snapshot().session.directMessages as unknown as {
      people: typeof people;
    }
  ).people = people;
  render(<CommunityAdmin relay={data} active={() => true} />);
  await user.click(
    await screen.findByRole("button", { name: "Invite members" }),
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Add or invite people",
  });
  const identity = within(dialog).getByRole("textbox", {
    name: "Public identity",
  });
  const add = within(dialog).getByRole("button", { name: "Add member" });
  await user.type(identity, "Carol");
  expect(add).toBeDisabled();
  expect(people).not.toHaveBeenCalled();
  await user.clear(identity);
  await user.type(identity, "c".repeat(64));
  expect(add).toBeEnabled();
  await user.click(add);
  await waitFor(() =>
    expect(calls.find((call) => call.route === "member")?.body).toEqual({
      action: "add",
      pubkey: "c".repeat(64),
      role: "member",
    }),
  );
  expect(people).not.toHaveBeenCalled();
});

it("adds a member by a nostr: npub and refuses an npub that is not a 32-byte key", async () => {
  const user = userEvent.setup();
  const calls = broker({
    member: () => Response.json({ accepted: true, message: "" }),
  });
  render(<CommunityAdmin relay={relay(owner).relay} active={() => true} />);
  await user.click(
    await screen.findByRole("button", { name: "Invite members" }),
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Add or invite people",
  });
  const identity = within(dialog).getByRole("textbox", {
    name: "Public identity",
  });
  const add = within(dialog).getByRole("button", { name: "Add member" });
  // A valid checksum over a 20-byte payload, which nip19 decodes to 40 hex.
  await user.click(identity);
  await user.paste("npub1qurswpc8qurswpc8qurswpc8qurswpc86nz8sw");
  const refusal = "Enter an npub or 64-character hex public key.";
  expect(within(dialog).getByText(refusal)).toBeVisible();
  expect(add).toBeDisabled();
  await user.keyboard("{Enter}");
  expect(calls.some((call) => call.route === "member")).toBe(false);
  await user.clear(identity);
  await user.paste(`nostr:${npubEncode("3".repeat(64))}`);
  expect(within(dialog).queryByText(refusal)).toBeNull();
  await user.click(add);
  await waitFor(() =>
    expect(calls.find((call) => call.route === "member")?.body).toEqual({
      action: "add",
      pubkey: "3".repeat(64),
      role: "member",
    }),
  );
});

it("membership localization retains its same search, raw names and clear action across languages", async () => {
  const calls = broker({});
  const rawName = "Raw {member} 한글";
  const { relay: data, read } = relay(
    owner,
    [snapshot(roster)],
    new Map([[member, { name: rawName }]]),
  );
  render(
    <CommunityAdmin
      relay={data}
      communityName="Raw {community} 한글"
      active={() => true}
    />,
  );
  const search = await screen.findByRole("searchbox", {
    name: "Search members",
  });
  if (!(search instanceof HTMLInputElement))
    throw new Error("Expected real member search");
  fireEvent.change(search, { target: { value: "Raw {member}" } });
  search.focus();
  search.setSelectionRange(2, 5);
  const reads = read.mock.calls.length,
    writes = [...calls];
  act(() => setLanguage("ko"));
  expect(screen.getByRole("searchbox", { name: "멤버 검색" })).toBe(search);
  expect(search).toHaveValue("Raw {member}");
  expect(search).toHaveFocus();
  expect([search.selectionStart, search.selectionEnd]).toEqual([2, 5]);
  expect(
    screen.getByRole("heading", { name: "멤버 관리", level: 2 }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Raw {community} 한글의 멤버와 접근 권한을 관리합니다."),
  ).toBeInTheDocument();
  expect(
    screen.getByText((text) => text.startsWith(rawName), {
      selector: "span.truncate",
    }),
  ).toBeVisible();
  const clear = screen.getByRole("button", { name: "멤버 검색 지우기" });
  await userEvent.setup().click(clear);
  expect(search).toHaveValue("");
  expect(search).toHaveFocus();
  expect(
    within(screen.getByRole("list", { name: "멤버" })).getAllByRole("listitem"),
  ).toHaveLength(3);
  expect(screen.getByText("소유자 · 나")).toBeInTheDocument();
  act(() => setLanguage("en"));
  expect(screen.getByRole("searchbox", { name: "Search members" })).toBe(
    search,
  );
  expect(search).toHaveFocus();
  expect(read).toHaveBeenCalledTimes(reads);
  expect(calls).toEqual(writes);
});

it.each([owner, admin, member])(
  "membership localization preserves permissions for fixture viewer %s",
  async (viewer) => {
    const calls = broker({});
    render(<CommunityAdmin relay={relay(viewer).relay} active={() => true} />);
    if (viewer === member) {
      await screen.findByText(
        "Only community owners and admins can invite people or manage members.",
      );
      act(() => setLanguage("ko"));
      expect(
        screen.getByText(
          "커뮤니티 소유자와 관리자만 사람들을 초대하거나 멤버를 관리할 수 있습니다.",
        ),
      ).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "멤버 초대" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /작업$/ }),
      ).not.toBeInTheDocument();
    } else {
      const actions = await screen.findAllByRole("button", {
        name: /^Actions for /,
      });
      expect(actions).toHaveLength(viewer === owner ? 2 : 1);
      act(() => setLanguage("ko"));
      expect(screen.getByRole("button", { name: "멤버 초대" })).toBeVisible();
      expect(screen.getAllByRole("button", { name: /작업$/ })).toHaveLength(
        viewer === owner ? 2 : 1,
      );
      const action = actions.at(-1);
      if (!action) throw new Error("Expected permitted member action");
      await userEvent.setup().click(action);
      expect(
        await screen.findByRole("menuitem", { name: "제거" }),
      ).toBeVisible();
      expect(
        screen.queryByRole("menuitem", { name: "관리자로 변경" }) !== null,
      ).toBe(viewer === owner);
    }
    expect(calls.filter((call) => call.route === "member")).toHaveLength(0);
  },
);

it("membership localization retains an exact removal target and accepted result through a stale refresh", async () => {
  const write = deferred<Response>();
  const calls = broker({ member: () => write.promise });
  const rawName = "Bob {target} 한글";
  const { relay: data, read } = relay(
    owner,
    [snapshot(roster)],
    new Map([[member, { name: rawName }]]),
  );
  render(<CommunityAdmin relay={data} active={() => true} />);
  const labels = publicKeyLabels([owner, admin, member]);
  const label = `${rawName} · ${labels.get(member)}`;
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: `Actions for ${label}` }),
  );
  const menu = await screen.findByRole("menu");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("menu")).toBe(menu);
  await user.click(screen.getByRole("menuitem", { name: "제거" }));
  const dialog = screen.getByRole("alertdialog", {
    name: `${label}님을 제거할까요?`,
  });
  const confirm = within(dialog).getByRole("button", { name: "제거" });
  confirm.focus();
  act(() => setLanguage("en"));
  expect(screen.getByRole("alertdialog", { name: `Remove: ${label}?` })).toBe(
    dialog,
  );
  expect(within(dialog).getByRole("button", { name: "Remove" })).toBe(confirm);
  expect(confirm).toHaveFocus();
  try {
    await user.click(confirm);
    await waitFor(() =>
      expect(calls.filter((call) => call.route === "member")).toEqual([
        { route: "member", body: { action: "remove", pubkey: member } },
      ]),
    );
    act(() => setLanguage("ko"));
    expect(confirm).toBeDisabled();
  } finally {
    read.mockRejectedValueOnce(new Error("Change accepted by the relay."));
    write.resolve(Response.json({ accepted: true, message: "" }));
  }
  await screen.findByText("릴레이가 변경을 수락했습니다.");
  const rawRead = "Could not load members: Change accepted by the relay.";
  expect(screen.getByRole("alert").textContent).toBe(
    `${rawRead} 아래 목록이 최신 상태가 아닐 수 있습니다.`,
  );
  expect(
    screen.queryByRole("button", { name: /작업$/ }),
  ).not.toBeInTheDocument();
  const retry = screen.getByRole("button", { name: "다시 시도" });
  const held = deferred<ReturnType<typeof snapshot>[]>();
  read.mockReturnValueOnce(held.promise);
  await user.click(retry);
  try {
    expect(screen.getByRole("button", { name: "새로고침" })).toBe(retry);
    act(() => setLanguage("en"));
    expect(screen.getByRole("button", { name: "Refresh" })).toBe(retry);
    expect(retry).toBeDisabled();
  } finally {
    held.resolve([snapshot(roster)]);
  }
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(calls.filter((call) => call.route === "member")).toHaveLength(1);
});

const rawInviteUrl =
  "https://primary.example/invite/fixture?raw={token}&name=한글";
const inviteReply = () =>
  Response.json({
    code: "fixture",
    url: rawInviteUrl,
    expires_at: 1700003600,
    max_uses: null,
    uses_remaining: null,
  });

it("membership localization retains a held invite, raw identity, settings choices and canonical numbers", async () => {
  const held = deferred<Response>();
  let first = true;
  const calls = broker({
    invite: () => {
      if (first) {
        first = false;
        return held.promise;
      }
      return inviteReply();
    },
  });
  render(<CommunityAdmin relay={relay(owner).relay} active={() => true} />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Invite members" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Add or invite people" });
  const identity = within(dialog).getByRole("textbox", {
    name: "Public identity",
  });
  if (!(identity instanceof HTMLInputElement))
    throw new Error("Expected identity input");
  const rawIdentity = `nostr:${npubEncode("3".repeat(64))}`;
  fireEvent.change(identity, { target: { value: rawIdentity } });
  identity.focus();
  identity.setSelectionRange(3, 9);
  try {
    await waitFor(() =>
      expect(calls.filter((call) => call.route === "invite")).toHaveLength(1),
    );
    act(() => setLanguage("ko"));
    expect(screen.getByRole("dialog", { name: "사람 추가 또는 초대" })).toBe(
      dialog,
    );
    expect(within(dialog).getByRole("textbox", { name: "공개 신원" })).toBe(
      identity,
    );
    expect(identity).toHaveValue(rawIdentity);
    expect(identity).toHaveFocus();
    expect([identity.selectionStart, identity.selectionEnd]).toEqual([3, 9]);
    expect(
      within(dialog).getByRole("button", { name: "초대 만료 기간 선택" }),
    ).toBeDisabled();
    expect(within(dialog).getByLabelText("커뮤니티 초대 링크")).toHaveAttribute(
      "placeholder",
      "초대 링크를 만드는 중…",
    );
  } finally {
    held.resolve(inviteReply());
  }
  const link = await within(dialog).findByDisplayValue(rawInviteUrl);
  expect(calls.filter((call) => call.route === "invite")).toEqual([
    { route: "invite", body: { ttl_secs: 259200, max_uses: null } },
  ]);
  await user.click(
    within(dialog).getByRole("button", { name: "초대 만료 기간 선택" }),
  );
  const expiry = await screen.findByRole("menuitemradio", { name: "30일" });
  const menu = await screen.findByRole("menu");
  act(() => setLanguage("en"));
  expect(screen.getByRole("menu")).toBe(menu);
  expect(screen.getByRole("menuitemradio", { name: "30 days" })).toBe(expiry);
  await user.click(expiry);
  await waitFor(() =>
    expect(calls.filter((call) => call.route === "invite")).toHaveLength(2),
  );
  await waitFor(() =>
    expect(
      within(dialog).getByRole("button", {
        name: "Choose maximum invite uses",
      }),
    ).toBeEnabled(),
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Choose maximum invite uses" }),
  );
  await user.click(
    await screen.findByRole("menuitemradio", { name: "5 uses" }),
  );
  await waitFor(() =>
    expect(calls.filter((call) => call.route === "invite")).toHaveLength(3),
  );
  expect(
    calls.filter((call) => call.route === "invite").map((call) => call.body),
  ).toEqual([
    { ttl_secs: 259200, max_uses: null },
    { ttl_secs: 2592000, max_uses: null },
    { ttl_secs: 2592000, max_uses: 5 },
  ]);
  act(() => setLanguage("ko"));
  expect(within(dialog).getByDisplayValue(rawInviteUrl)).toBe(link);
  expect(identity).toHaveValue(rawIdentity);
  expect(calls.filter((call) => call.route === "invite")).toHaveLength(3);
});

it("membership localization distinguishes local identity validation from identical server text", async () => {
  const raw = "Enter an npub or 64-character hex public key.";
  const calls = broker({
    invite: () => Response.json({ error: raw }, { status: 400 }),
  });
  render(<CommunityAdmin relay={relay(owner).relay} active={() => true} />);
  await userEvent
    .setup()
    .click(await screen.findByRole("button", { name: "Invite members" }));
  const dialog = screen.getByRole("dialog");
  await within(dialog).findByText(raw);
  const identity = within(dialog).getByRole("textbox", {
    name: "Public identity",
  });
  fireEvent.change(identity, { target: { value: "Carol {raw} 한글" } });
  act(() => setLanguage("ko"));
  expect(within(dialog).getByText(raw)).toBeVisible();
  expect(
    within(dialog).getByText("npub 또는 64자리 16진수 공개 키를 입력하세요."),
  ).toBeVisible();
  expect(identity).toHaveValue("Carol {raw} 한글");
  expect(
    within(dialog).getByRole("button", { name: "멤버 추가" }),
  ).toBeDisabled();
  expect(calls.filter((call) => call.route === "member")).toHaveLength(0);
  fireEvent.change(identity, { target: { value: member } });
  expect(
    within(dialog).getByText("이미 커뮤니티 멤버인 사람입니다."),
  ).toBeVisible();
});

it("membership localization keeps the copied timer and raw clipboard value across locales", async () => {
  const user = userEvent.setup();
  broker({ invite: inviteReply });
  render(<CommunityAdmin relay={relay(owner).relay} active={() => true} />);
  await user.click(
    await screen.findByRole("button", { name: "Invite members" }),
  );
  const dialog = screen.getByRole("dialog");
  await within(dialog).findByDisplayValue(rawInviteUrl);
  const copied = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  vi.useFakeTimers();
  try {
    const copy = within(dialog).getByRole("button", { name: "Copy link" });
    fireEvent.click(copy);
    await act(async () => Promise.resolve());
    expect(copied).toHaveBeenCalledExactlyOnceWith(rawInviteUrl);
    expect(within(dialog).getByRole("button", { name: "Copied" })).toBe(copy);
    act(() => setLanguage("ko"));
    expect(within(dialog).getByRole("button", { name: "복사됨" })).toBe(copy);
    expect(within(dialog).getByText("초대 링크를 복사했습니다.")).toBeVisible();
    act(() => vi.advanceTimersByTime(1999));
    expect(within(dialog).getByRole("button", { name: "복사됨" })).toBe(copy);
    act(() => setLanguage("en"));
    act(() => vi.advanceTimersByTime(1));
    expect(within(dialog).getByRole("button", { name: "Copy link" })).toBe(
      copy,
    );
    copied.mockRejectedValueOnce(new Error("opaque clipboard failure"));
    fireEvent.click(copy);
    await act(async () => Promise.resolve());
    const alert = within(dialog).getByRole("alert");
    expect(alert).toHaveTextContent("Could not copy the invite link.");
    act(() => setLanguage("ko"));
    expect(within(dialog).getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent("초대 링크를 복사하지 못했습니다.");
  } finally {
    copied.mockRestore();
    vi.useRealTimers();
  }
});

it("membership localization keeps a direct-add write, role and identity while pending", async () => {
  const held = deferred<Response>();
  const calls = broker({ invite: inviteReply, member: () => held.promise });
  render(<CommunityAdmin relay={relay(owner).relay} active={() => true} />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Invite members" }),
  );
  const dialog = screen.getByRole("dialog");
  await within(dialog).findByDisplayValue(rawInviteUrl);
  const identity = within(dialog).getByRole("textbox", {
    name: "Public identity",
  });
  fireEvent.change(identity, { target: { value: "3".repeat(64) } });
  await user.click(
    within(dialog).getByRole("button", { name: "Choose member role" }),
  );
  await user.click(await screen.findByRole("menuitemradio", { name: "Admin" }));
  const add = within(dialog).getByRole("button", { name: "Add member" });
  await user.click(add);
  try {
    await waitFor(() =>
      expect(calls.filter((call) => call.route === "member")).toHaveLength(1),
    );
    act(() => setLanguage("ko"));
    expect(within(dialog).getByRole("button", { name: "멤버 추가" })).toBe(add);
    expect(add).toBeDisabled();
    expect(identity).toBeDisabled();
    expect(identity).toHaveValue("3".repeat(64));
    expect(calls.filter((call) => call.route === "member")).toEqual([
      {
        route: "member",
        body: { action: "add", pubkey: "3".repeat(64), role: "admin" },
      },
    ]);
  } finally {
    held.resolve(Response.json({ accepted: true, message: "" }));
  }
  await within(dialog).findByText("멤버를 직접 추가했습니다.");
  expect(identity).toHaveValue("");
  act(() => setLanguage("en"));
  expect(within(dialog).getByText("Member added directly.")).toBeVisible();
  expect(calls.filter((call) => call.route === "member")).toHaveLength(1);
});

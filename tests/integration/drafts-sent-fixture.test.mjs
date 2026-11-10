import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseSync } from "rolldown/utils";
import { expect } from "@playwright/test";
import { finalizeEvent, getPublicKey, verifyEvent } from "nostr-tools";
import * as policy from "../browser/policy-relay.mjs";

const key = (seed) =>
  Uint8Array.from({ length: 32 }, (_, i) => (i === 31 ? seed : 0));
const viewer = getPublicKey(key(1));
const signed = (kind, content, tags = [], time = 10, owner = 1) =>
  finalizeEvent({ kind, content, tags, created_at: time }, key(owner));
const root = signed(9, "raw root {name}", [["h", "alpha"]]);
const reply = signed(
  40002,
  "raw reply",
  [
    ["h", "alpha"],
    ["e", root.id],
  ],
  11,
  2,
);
const other = signed(9, "other author", [["h", "alpha"]], 12, 2);
const edit = signed(40003, "raw edit", [["e", root.id]], 13);
const wire = (value) => JSON.parse(JSON.stringify(value));
const tuple = () => [
  { kinds: [9], authors: [viewer], limit: 100 },
  { kinds: [40003, 5, 9005], authors: [viewer], limit: 500 },
];
const context = () => ({
  "#e": [root.id],
  kinds: [40002, 40008, 9],
  limit: 500,
});
const legacy = () =>
  [
    "channel-filter",
    "channel-mutes",
    "channel-sections",
    "channel-sort",
    "channel-stars",
  ].map((id) => ({ kinds: [30078], authors: [viewer], "#d": [id], limit: 1 }));

function request(
  relay,
  filters,
  origin = "https://primary.example",
  path = "/query",
) {
  const url = origin + path;
  const body = JSON.stringify(filters);
  const auth = signed(27235, "", [
    ["u", url],
    ["payload", createHash("sha256").update(body).digest("hex")],
  ]);
  return relay.fetch(url, {
    body,
    headers: {
      Authorization: `Nostr ${Buffer.from(JSON.stringify(auth)).toString("base64")}`,
    },
    signal: new AbortController().signal,
  });
}

// Execute the actual finite opt-in answer branch, without starting Vite/App.
const fixtureSource = readFileSync(
  new URL("../browser/fixture.mjs", import.meta.url),
  "utf8",
);
const parsed = parseSync("fixture.mjs", fixtureSource);
assert.equal(parsed.errors.length, 0);
const answers = [];
function visit(node) {
  if (!node || typeof node !== "object") return;
  if (node.type === "VariableDeclarator" && node.id.name === "answer")
    answers.push(node);
  for (const value of Object.values(node))
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") visit(value);
}
visit(parsed.program);
assert.equal(answers.length, 1);
const branch = answers[0].init.body.body[0];
assert.equal(branch.type, "IfStatement");
const branchSource = fixtureSource.slice(branch.start, branch.end);
assert.match(branchSource, /return draftsSentAnswer\(/);
const fixtureAnswer = new Function(
  "draftsSent",
  "histories",
  "targetEvents",
  "report",
  "viewer",
  "draftsSentAnswer",
  "expect",
  `return (community, filter) => { ${branchSource} throw new Error("Outside opted-in Drafts fixture contract"); };`,
);

function setup(option = true) {
  const report = { unexpected: [], queries: [] };
  const events = new Map([
    ["primary", [root, other, root]],
    ["secondary", [signed(9, "secondary only", [["h", "alpha"]], 20)]],
  ]);
  const answer = fixtureAnswer(
    option === true,
    new Map(
      [...events].map(([community, rows]) => [`${community}/alpha`, rows]),
    ),
    [reply, edit],
    report,
    viewer,
    policy.draftsSentAnswer,
    expect,
  );
  report.publications = [];
  const relay = policy.policyRelay({
    viewer,
    report,
    ...(option === "omitted" ? {} : { draftsSent: option }),
    answer(community, filter) {
      if (filter.kinds[0] === 30078) return [];
      return answer(community, filter);
    },
    acceptPublication(community, event) {
      assert.equal(verifyEvent(event), true);
      assert.equal(event.pubkey, viewer);
      report.publications.push({ community, event });
    },
  });
  return { relay, report, events, answer };
}

test("opt-in actual signed HTTP tuple returns matching originals and accepted sends", async () => {
  const { relay, report, events } = setup();
  const first = await request(relay, tuple());
  assert.deepEqual(await first.json(), wire([root, edit]));
  const next = signed(9, "new accepted raw `code`", [["h", "beta"]], 30);
  await request(relay, next, "https://primary.example", "/events");
  assert.deepEqual(
    await (await request(relay, tuple())).json(),
    wire([next, root, edit]),
  );
  assert.deepEqual(
    await (await request(relay, [context()])).json(),
    wire([reply]),
  );
  assert.deepEqual(
    await (await request(relay, tuple(), "https://secondary.example")).json(),
    wire(events.get("secondary")),
  );
  assert.deepEqual(report.unexpected, []);
  assert.equal(report.queries.length, 7);
});

test("default false and omitted preserve exact legacy five-coordinate admission", async () => {
  for (const option of [false, "omitted"]) {
    const { relay, report } = setup(option);
    assert.deepEqual(await (await request(relay, legacy())).json(), []);
    await assert.rejects(request(relay, tuple()));
    await assert.rejects(request(relay, [context()]));
    const broken = legacy();
    broken[0].authors = [getPublicKey(key(2))];
    await assert.rejects(request(relay, broken));
    assert.equal(report.unexpected.length, 3);
  }
});

const badTuples = [
  [
    "author",
    (filters) => {
      filters[0].authors = [getPublicKey(key(2))];
    },
  ],
  [
    "kind",
    (filters) => {
      filters[0].kinds = [40002];
    },
  ],
  [
    "update kinds",
    (filters) => {
      filters[1].kinds = [5];
    },
  ],
  [
    "limit",
    (filters) => {
      filters[0].limit = 101;
    },
  ],
  [
    "extra scope",
    (filters) => {
      filters[0]["#h"] = ["alpha"];
    },
  ],
  [
    "missing filter",
    (filters) => {
      filters.pop();
    },
  ],
  [
    "extra filter",
    (filters) => {
      filters.push(filters[0]);
    },
  ],
];
for (const [name, change] of badTuples)
  test(`opt-in rejects malformed tuple: ${name}`, async () => {
    const { relay, report } = setup();
    const filters = tuple();
    change(filters);
    await assert.rejects(request(relay, filters));
    assert.equal(report.unexpected.length, 1);
  });

test("opt-in rejects an unknown community even with correctly signed NIP98", async () => {
  const { relay, report, answer } = setup();
  assert.throws(() => answer("unknown", tuple()[0]));
  await assert.rejects(request(relay, tuple(), "https://unknown.example"));
  assert.equal(report.unexpected.length, 1);
});

const badContexts = [
  [
    "kind",
    (filter) => {
      filter.kinds = [9];
    },
  ],
  [
    "limit",
    (filter) => {
      filter.limit = 501;
    },
  ],
  [
    "extra scope",
    (filter) => {
      filter["#h"] = ["alpha"];
    },
  ],
  [
    "unknown root",
    (filter) => {
      filter["#e"] = ["a".repeat(64)];
    },
  ],
  [
    "duplicate root",
    (filter) => {
      filter["#e"] = [root.id, root.id];
    },
  ],
  [
    "invalid root",
    (filter) => {
      filter["#e"] = ["not-hex"];
    },
  ],
  [
    "oversize roots",
    (filter) => {
      filter["#e"] = Array(151).fill(root.id);
    },
  ],
  [
    "empty roots",
    (filter) => {
      filter["#e"] = [];
    },
  ],
  [
    "foreign community root",
    (filter) => {
      filter["#e"] = [setup().events.get("secondary")[0].id];
    },
  ],
];
for (const [name, change] of badContexts)
  test(`actual context matcher rejects: ${name}`, async () => {
    const { relay, report } = setup();
    const filter = context();
    change(filter);
    await assert.rejects(request(relay, [filter]));
    assert.equal(report.unexpected.length, 1);
  });

test("matcher deduplicates, orders signed ties and enforces the declared limit", () => {
  const filter = tuple()[0];
  const events = Array.from({ length: 105 }, (_, i) =>
    signed(9, `event ${i}`, [["h", "alpha"]], Math.floor(i / 2)),
  );
  const expected = events
    .toSorted((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id))
    .slice(0, 100);
  assert.deepEqual(
    policy.draftsSentAnswer(filter, viewer, [...events, events[0], other]),
    expected,
  );
  assert.equal(expected.every(verifyEvent), true);
});

test("context accepts multiple known sorted roots and filters real signed replies", () => {
  const second = signed(9, "second root", [["h", "beta"]]);
  const secondReply = signed(40008, "patch body", [["e", second.id]], 20, 2);
  const unrelated = signed(40002, "unrelated", [["e", other.id]], 21, 2);
  const filter = { ...context(), "#e": [root.id, second.id].sort() };
  assert.deepEqual(
    policy.draftsSentAnswer(filter, viewer, [
      root,
      second,
      reply,
      secondReply,
      unrelated,
    ]),
    [secondReply, reply],
  );
});

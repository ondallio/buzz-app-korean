import { messageTemplate, t, type TranslationKey } from "../../shared/i18n";
import type {
  ChannelMessage,
  MembershipChange,
  Profile,
} from "../relay/contracts";

export type TimelineRow = ChannelMessage & {
  membershipRows?: readonly ChannelMessage[];
};
/** A Solo chat implies the agents its owner started it with; omit the owner's
 * agent additions and removals before the first message once history reaches
 * the chat's start. Later changes, people and agents added by someone else
 * still show. */
export function withoutStartingAgents(
  rows: readonly ChannelMessage[],
  owner: string | undefined,
  agents: ReadonlySet<string>,
  complete: boolean,
): readonly ChannelMessage[] {
  if (!complete || !owner) return rows;
  const first = rows.findIndex((row) => !row.membership);
  const start = first === -1 ? rows.length : first;
  const starting = (row: ChannelMessage) =>
    (row.membership?.type === "member_joined" ||
      row.membership?.type === "member_removed") &&
    row.membership.actor === owner &&
    agents.has(row.membership.target);
  return rows.some((row, index) => index < start && starting(row))
    ? rows.filter((row, index) => index >= start || !starting(row))
    : rows;
}

/** Only explicit additions and removals belong in the conversation. */
const visibleMembership = (change: MembershipChange) =>
  change.type === "member_removed" ||
  (change.type === "member_joined" && change.actor !== change.target);

/** Newest-anchored groups keep loaded keys stable when history is prepended.
 * Every uninterrupted membership run is one row, regardless of elapsed time.
 * A conversation entry (including a huddle) always breaks the group. */
export function membershipRows(
  rows: readonly ChannelMessage[],
): readonly TimelineRow[] {
  rows = rows.filter(
    ({ membership }) => !membership || visibleMembership(membership),
  );
  const result: TimelineRow[] = [];
  for (let end = rows.length - 1; end >= 0; ) {
    const newest = rows[end];
    if (!newest) break;
    let start = end;
    while (newest.membership && start > 0 && rows[start - 1]?.membership)
      start--;
    result.push(
      start === end
        ? newest
        : {
            ...newest,
            createdAt: rows[start]?.createdAt ?? newest.createdAt,
            membershipRows: rows.slice(start, end + 1),
          },
    );
    end = start - 1;
  }
  return result.reverse();
}

/** The index of the row that renders an event. A hidden membership event, such
 * as a reading anchor saved before self-joins were hidden, resolves to the
 * nearest later rendered event, else the nearest earlier one. */
export function renderedRowIndex(
  rows: readonly TimelineRow[],
  events: readonly ChannelMessage[],
  id: string,
) {
  const find = (target: string) =>
    rows.findIndex(
      (row) =>
        row.id === target ||
        row.membershipRows?.some((member) => member.id === target),
    );
  const direct = find(id);
  const at = direct < 0 ? events.findIndex((event) => event.id === id) : -1;
  if (at < 0) return direct;
  for (let index = at + 1; index < events.length; index++) {
    const found = find(events[index]?.id ?? "");
    if (found >= 0) return found;
  }
  for (let index = at - 1; index >= 0; index--) {
    const found = find(events[index]?.id ?? "");
    if (found >= 0) return found;
  }
  return -1;
}

/** A prose segment; `id` marks a member name that may open that profile. */
export type MembershipPart = {
  text: string;
  id?: string;
  preview?: { label: string; members: readonly { id: string; name: string }[] };
};

export function membershipDescription(
  rows: readonly ChannelMessage[],
  profiles: ReadonlyMap<string, Profile>,
  viewer?: string,
  resolveName?: (id: string, fallback: string) => string,
) {
  const latest = new Map<string, MembershipChange>();
  for (const row of rows)
    if (row.membership && visibleMembership(row.membership))
      latest.set(row.membership.target, row.membership);
  const changes = [...latest.values()];
  const first = changes[0];
  if (!first) return { targets: [], parts: [], text: "", title: "" };
  const targets = [...latest.keys()];
  const name = (id: string, subject = false): MembershipPart => ({
    id,
    text:
      id === viewer
        ? subject
          ? t("v1msg.membership.youSubject")
          : t("v1msg.membership.you")
        : (resolveName?.(id, profiles.get(id)?.name ?? id.slice(0, 10)) ??
          profiles.get(id)?.name ??
          id.slice(0, 10)),
  });
  const plain = (text: string): MembershipPart => ({ text });
  // One whole translated sentence; named people stay their own parts.
  const sentence = (
    template: TranslationKey,
    values: Readonly<
      Record<string, MembershipPart | readonly MembershipPart[]>
    >,
  ): MembershipPart[] =>
    messageTemplate(template)
      .split(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)
      .flatMap((part, index) => {
        if (index % 2 === 0) return part ? [plain(part)] : [];
        const value = values[part];
        return value === undefined
          ? []
          : Array.isArray(value)
            ? value
            : [value];
      });
  const list = (items: readonly MembershipPart[]) => {
    let next = 0;
    return new Intl.ListFormat(undefined, { type: "conjunction" })
      .formatToParts(items.map((item) => item.text))
      .map((part) =>
        part.type === "element"
          ? (items[next++] ?? plain(part.value))
          : plain(part.value),
      );
  };
  // Each person appears only under their latest visible action.
  const kinds = new Set(changes.map((change) => change.type));
  if (
    targets.length > 3 ||
    kinds.size > 1 ||
    (first.type === "member_removed" &&
      changes.some((change) => change.actor !== first.actor))
  ) {
    const parts: MembershipPart[] = [];
    for (const type of ["member_joined", "member_removed"] as const) {
      const added = type === "member_joined";
      const people = [
        ...new Set(
          changes
            .filter((change) => change.type === type)
            .map((change) => change.target),
        ),
      ];
      const person = people[0];
      if (!person) continue;
      if (parts.length) parts.push(plain(" · "));
      const subject = name(person, true);
      if (people.length > 1) {
        const others: MembershipPart = {
          text:
            people.length === 2
              ? t("v1msg.membership.oneOther")
              : t("v1msg.membership.others", { count: people.length - 1 }),
          preview: {
            label: added
              ? t("v1msg.membership.previewAdded")
              : t("v1msg.membership.previewRemoved"),
            members: people.map((id) => ({ id, name: name(id, true).text })),
          },
        };
        parts.push(
          ...sentence(
            added
              ? "v1msg.membership.manyAdded"
              : "v1msg.membership.manyRemoved",
            { person: subject, others },
          ),
        );
      } else {
        const you = person === viewer;
        parts.push(
          ...sentence(
            added
              ? you
                ? "v1msg.membership.youAdded"
                : "v1msg.membership.oneAdded"
              : you
                ? "v1msg.membership.youRemoved"
                : "v1msg.membership.oneRemoved",
            { person: subject },
          ),
        );
      }
    }
    const text = parts.map((part) => part.text).join("");
    const detail = changes.map((change) => {
      const values = {
        person: name(change.target, true).text,
        actor: name(change.actor).text,
      };
      const you = change.target === viewer;
      return change.type === "member_removed"
        ? you
          ? t("v1msg.membership.youRemovedBy", values)
          : t("v1msg.membership.oneRemovedBy", values)
        : you
          ? t("v1msg.membership.youAddedByDetail", values)
          : t("v1msg.membership.oneAddedByDetail", values);
    });
    return {
      targets,
      parts,
      text,
      title: [...new Set(detail)].join("; "),
    };
  }
  const lead = name(first.target, true);
  const others = targets.slice(1, 3);
  const rest = list(others.map((id) => name(id)));
  const you = first.target === viewer;
  const along = rest.length > 0;
  let parts: MembershipPart[];
  if (first.type === "member_removed") {
    parts = sentence(
      along
        ? you
          ? "v1msg.membership.youRemovedByAlong"
          : "v1msg.membership.oneRemovedByAlong"
        : you
          ? "v1msg.membership.youRemovedBy"
          : "v1msg.membership.oneRemovedBy",
      { person: lead, actor: name(first.actor), rest },
    );
  } else {
    const sameAdder = changes.every(({ actor }) => actor === first.actor);
    parts = sentence(
      sameAdder
        ? along
          ? you
            ? "v1msg.membership.youAddedByAlong"
            : "v1msg.membership.oneAddedByAlong"
          : you
            ? "v1msg.membership.youAddedBy"
            : "v1msg.membership.oneAddedBy"
        : along
          ? you
            ? "v1msg.membership.youAddedAlong"
            : "v1msg.membership.oneAddedAlong"
          : you
            ? "v1msg.membership.youAdded"
            : "v1msg.membership.oneAdded",
      { person: lead, actor: name(first.actor), rest },
    );
  }
  return {
    targets,
    parts,
    text: parts.map((part) => part.text).join(""),
    title: list(targets.map((id) => name(id)))
      .map((part) => part.text)
      .join(""),
  };
}

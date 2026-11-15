import { t, useLanguage } from "../../shared/i18n";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  CaretLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  GlobeIcon,
  RobotIcon,
} from "../../shared/design-system/icons";
import { Button } from "../../shared/design-system/ui/Button";
import { Header } from "../../shared/design-system/ui/Header";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import type { OverviewSnapshot } from "./overview";
import styles from "./BuilderlabSettings.module.css";

const sections = [
  { id: "agents", icon: RobotIcon },
  { id: "communities", icon: GlobeIcon },
] as const;
type Section = (typeof sections)[number]["id"];
const sectionText = (id: Section) =>
  id === "agents"
    ? {
        title: t("v1id.blab.remoteAgents"),
        description: t("v1id.blab.agentsDescription"),
        action: t("v1id.blab.setUpAgent"),
      }
    : {
        title: t("v1id.blab.communities"),
        description: t("v1id.blab.communitiesDescription"),
        action: t("v1id.blab.createCommunity"),
      };

/** A section keeps navigation beside its heading and outside the heading name. */
export function ManagementHeader({
  navigation,
  title,
  ...props
}: ComponentProps<typeof Header> & { navigation?: ReactNode }) {
  return (
    <div className={styles.managementHeader}>
      {navigation && <div className={styles.navigation}>{navigation}</div>}
      <div className={styles.heading}>
        <Header
          {...props}
          title={<span className={styles.managementTitle}>{title}</span>}
        />
      </div>
    </div>
  );
}

/** Local management views share the Settings contribution's account and lifetime. */
export function BuilderlabSettings({
  active,
  account,
  keepAccountVisible = false,
  initialSection,
  communities,
  agents,
  summaries,
}: {
  active(): boolean;
  account: ReactNode;
  /** Keep sign-in, cancellation and recovery reachable inside either section. */
  keepAccountVisible?: boolean;
  initialSection?: Section | undefined;
  communities(navigation: ReactNode): ReactNode;
  agents: ReactNode;
  summaries?: Record<Section, OverviewSnapshot>;
}) {
  useLanguage();
  const [selected, setSelected] = useState(initialSection);
  const triggers = useRef<Partial<Record<Section, HTMLElement | null>>>({});
  const back = useRef<HTMLButtonElement | null>(null);
  const previous = useRef(selected);
  useLayoutEffect(() => {
    const origin = previous.current;
    if (selected === origin) return;
    previous.current = selected;
    if (selected) back.current?.focus();
    else if (origin) triggers.current[origin]?.focus({ preventScroll: true });
  }, [selected]);
  const section = sections.find(({ id }) => id === selected);
  const hideAccount = !!selected && !keepAccountVisible;
  const agentCount =
    summaries?.agents.kind === "filled"
      ? summaries.agents.items.length
      : undefined;
  const open = (id: Section) => {
    if (active()) setSelected(id);
  };
  const navigation = (
    <IconButton
      ref={back}
      aria-label={t("v1id.blab.back")}
      title={t("v1id.blab.back")}
      hint="familiar"
      icon={<CaretLeftIcon />}
      onClick={() => {
        if (active()) setSelected(undefined);
      }}
    />
  );
  const ordered = [...sections].sort((a, b) => {
    const aEmpty = ["empty", "unavailable"].includes(
      summaries?.[a.id].kind ?? "empty",
    );
    const bEmpty = ["empty", "unavailable"].includes(
      summaries?.[b.id].kind ?? "empty",
    );
    return (
      Number(aEmpty) - Number(bEmpty) ||
      (aEmpty && bEmpty
        ? Number(a.id === "agents") - Number(b.id === "agents")
        : 0)
    );
  });
  return (
    <section aria-label="Builderlab">
      {selected !== "communities" && (
        <ManagementHeader
          navigation={section && navigation}
          id="builderlab-title"
          title={
            selected === "agents"
              ? agentCount === undefined
                ? t("v1id.blab.remoteAgents")
                : t("v1id.blab.remoteAgentsCount", { count: agentCount })
              : "Builderlab"
          }
        />
      )}
      <div className={styles.account} hidden={hideAccount} inert={hideAccount}>
        <SettingsGroup layout="form">{account}</SettingsGroup>
      </div>
      <div hidden={!!selected} inert={!!selected}>
        <div className={styles.grid}>
          {ordered.map(({ id, icon: Icon }) => {
            const { title, description, action } = sectionText(id);
            const state = summaries?.[id] ?? { kind: "empty" };
            return (
              <section
                key={id}
                className={styles.card}
                aria-label={title}
                data-state={state.kind}
              >
                <div className={styles.top}>
                  <h3 className={`${styles.title} text-label-sm`}>
                    <Icon size={24} aria-hidden="true" />
                    {title}
                  </h3>
                  <span className={styles.action}>
                    <IconButton
                      ref={(node) => {
                        triggers.current[id] = node;
                      }}
                      variant="prominent"
                      shape="round"
                      aria-label={t("v1id.blab.open", { title })}
                      icon={<ArrowUpRightIcon size={16} aria-hidden="true" />}
                      onClick={() => open(id)}
                    />
                  </span>
                </div>
                <div className={styles.body}>
                  {state.kind === "empty" || state.kind === "unavailable" ? (
                    <div className={styles.prompt}>
                      <p className="m-0 text-body-sm text-subtle">
                        {state.kind === "unavailable"
                          ? t("v1id.blab.notAvailable")
                          : description}
                      </p>
                      <Button
                        variant="link"
                        size="text"
                        onClick={() => open(id)}
                      >
                        {state.kind === "unavailable"
                          ? t("v1id.blab.learnMore")
                          : action}{" "}
                        <ArrowRightIcon aria-hidden="true" />
                      </Button>
                    </div>
                  ) : state.kind === "filled" ? (
                    <>
                      <ul className={styles.list}>
                        {state.items.slice(0, 3).map((item) => (
                          <li
                            key={item.key}
                            className={`${styles.line} text-body-sm text-subtle`}
                          >
                            {item.label}
                            {item.note ? ` · ${item.note}` : ""}
                          </li>
                        ))}
                      </ul>
                      {state.items.length > 3 && (
                        <p className="m-0 text-caption text-subtle">
                          +{state.items.length - 3} more
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="m-0 text-title">
                      {state.kind === "pending" ? "…" : "—"}
                      {state.kind === "failed" && (
                        <span className="ml-1 text-caption text-subtle">
                          Couldn’t load
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {sections.map(({ id }) => (
        // Mount once on entry: the overview and section share the same reads.
        <div key={id} hidden={selected !== id} inert={selected !== id}>
          {id === "communities"
            ? communities(selected === id ? navigation : undefined)
            : agents}
        </div>
      ))}
    </section>
  );
}

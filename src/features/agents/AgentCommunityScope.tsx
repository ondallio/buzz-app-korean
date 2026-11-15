import { t, useLanguage } from "../../shared/i18n";
import { rich } from "../../shared/i18n/rich";
import { useSyncExternalStore, type ComponentProps } from "react";
import { Avatar } from "../../shared/design-system/ui/Avatar";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { Button } from "../../shared/design-system/ui/Button";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPopup,
} from "../../shared/design-system/ui/Popover";
import { communityPresentation } from "../communities/community-icon";
import type { CommunityReader } from "../communities/service";
import type { Agent, Agents } from "./service";

export type AgentScopeReader = Pick<Agents, "subscribe" | "memberships">;

const noSubscribe = () => () => {};
const descriptions = {
  Agents: {
    description: "agentScope.agentsDescription",
    trigger: "agentScope.agentsTrigger",
    title: "agentScope.agentsTitle",
  },
  Memory: {
    description: "agentScope.memoryDescription",
    trigger: "agentScope.memoryTrigger",
    title: "agentScope.memoryTitle",
  },
  Avatar: {
    description: "agentScope.avatarDescription",
    trigger: "agentScope.onlyIn",
    title: "agentScope.avatarTitle",
  },
} as const;

/** Count remaining memberships, including offline rows, only for local agents.
 * Other agents keep their hints because their full membership set is unknown. */
export function useAgentScopeCommunity(
  agent: Pick<Agent, "pubkey" | "relay" | "place">,
  agents: AgentScopeReader,
  communities: CommunityReader | undefined,
) {
  const several = useSyncExternalStore(
    agents.subscribe,
    () =>
      agents.memberships(agent.pubkey).filter((item) => !item.deleting).length >
      1,
  );
  const known = useSyncExternalStore(
    communities?.subscribe ?? noSubscribe,
    () => communities?.snapshot(),
  );
  return (agent.place !== "here" || several) && agent.relay
    ? communityPresentation(agent.relay, known?.memberships)
    : undefined;
}

export function AgentCommunityScope({
  community,
  scope,
  open,
  onOpenChange,
}: {
  community: ReturnType<typeof communityPresentation> | undefined;
  scope: keyof typeof descriptions;
  open?: boolean | undefined;
  onOpenChange?: ComponentProps<typeof PopoverRoot>["onOpenChange"];
}) {
  useLanguage();
  if (!community) return null;
  const { name, src } = community;
  return (
    <PopoverRoot open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        openOnHover="preview"
        render={
          scope === "Avatar" ? (
            <Button
              variant="plain"
              size="inline"
              aria-label={t("agentScope.onlyIn", { community: name })}
              style={{ maxWidth: "100%" }}
            >
              <span className="flex min-w-0 flex-wrap items-center gap-2 text-subtle">
                {rich("agentScope.onlyIn", {
                  community: (
                    <>
                      <Avatar
                        src={src}
                        alt=""
                        fallback={name}
                        shape="squircle"
                        size="compact"
                      />
                      <span className="min-w-0 break-words">{name}</span>
                    </>
                  ),
                })}
              </span>
            </Button>
          ) : (
            <IconButton
              aria-label={t(descriptions[scope].trigger, { community: name })}
              variant="avatar"
              shape="squircle"
              size="xs"
              icon={
                <span className="inline-flex h-4 w-4">
                  <Avatar
                    src={src}
                    alt=""
                    fallback={name}
                    shape="squircle"
                    size="fill"
                  />
                </span>
              }
            />
          )
        }
      />
      <PopoverPopup
        side={scope === "Avatar" ? "bottom" : "top"}
        align={scope === "Avatar" ? "start" : "center"}
        aria-label={t(descriptions[scope].title)}
      >
        <div className="mb-2 flex items-center gap-2 text-body-sm">
          <Avatar
            src={src}
            alt=""
            fallback={name}
            shape="squircle"
            size="small"
          />
          <span className="min-w-0 break-words">{name}</span>
        </div>
        <p className="m-0 text-body-sm text-subtle">
          {t(descriptions[scope].description)}
        </p>
      </PopoverPopup>
    </PopoverRoot>
  );
}

import { t, useLanguage } from "../../shared/i18n";
import { useSyncExternalStore } from "react";
import type { Context } from "@deepseek-ai/cordis";
import { useListedChannel } from "../../features/relay/listed-channel";
import type { PanelProps } from "../../features/panels/service";
import { usePanelTabTitle } from "../../features/panels/PanelWorkspace";
import { FileTextIcon } from "../../shared/design-system/icons";
import type { ChannelSummary } from "../../features/relay/contracts";
import type { RelaySession } from "../../features/relay/session";
import { buzzLinkTarget } from "../../features/navigation/buzz-links";
import { CanvasEditor } from "./CanvasEditor";
import { canvasReadOnly } from "../../features/channel-templates/capability";

function eligible(channel: ChannelSummary, session: RelaySession) {
  return (
    !channel.cached &&
    (!channel.readOnly || channel.viewerRole === "guest") &&
    !!channel.members?.includes(session.viewer ?? "")
  );
}

// One element keeps the tab identity stable across renders.
const tabIcon = <FileTextIcon size="1rem" />;

export function registerCanvas(ctx: Context) {
  function Panel({ channelContext }: PanelProps) {
    useLanguage();
    usePanelTabTitle(t("channelForms.templates.canvas"), tabIcon);
    const state = useSyncExternalStore(ctx.relay.subscribe, ctx.relay.snapshot);
    const readOnly = useListedChannel(
      state.status === "ready" ? state.session.channels : undefined,
      channelContext?.channelId,
      canvasReadOnly,
    );
    if (
      !channelContext ||
      state.status !== "ready" ||
      state.scope !== channelContext.scope
    )
      return <p role="status">{t("v1shell.canvas.unavailable")}</p>;
    const { origin, viewer } = state;
    const openLink = (url: string) => {
      const target =
        origin &&
        viewer &&
        buzzLinkTarget(url, { viewer, communityOrigin: origin });
      if (!target) return false;
      void ctx.navigation.open(target);
      return true;
    };
    return (
      <CanvasEditor
        key={`${state.scope}:${state.generation}:${channelContext.channelId}`}
        readOnly={readOnly}
        canvas={state.session.canvas}
        profiles={state.session.profiles}
        scope={state.scope}
        channelId={channelContext.channelId}
        openLink={openLink}
        codeBlocks={ctx.conversation.codeBlocks}
      />
    );
  }
  ctx.panels.register({
    id: "canvas",
    title: "Canvas",
    matches: () => false,
    channelMenu: { label: "View canvas", eligible },
    component: Panel,
  });
}

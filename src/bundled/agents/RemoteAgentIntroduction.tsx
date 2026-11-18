import { t, useLanguage } from "../../shared/i18n";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { AvatarCropFrame } from "../../features/profiles/AvatarCrop";
import { useAvatarPreview } from "../../features/profiles/use-avatar-preview";
import { BuilderlabLogoIcon } from "../../shared/design-system/icons";
import type { AvatarSelection } from "./AgentAvatarPicker";
import { AgentPortrait } from "./AgentCard";
import styles from "./AgentCreate.module.css";
import { EmojiSwap } from "./EmojiSwap";

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const endings = [
  "v1agent.remoteIntro.ending1",
  "v1agent.remoteIntro.ending2",
  "v1agent.remoteIntro.ending3",
  "v1agent.remoteIntro.ending4",
  "v1agent.remoteIntro.ending5",
  "v1agent.remoteIntro.ending6",
  "v1agent.remoteIntro.ending7",
  "v1agent.remoteIntro.ending8",
  "v1agent.remoteIntro.ending9",
  "v1agent.remoteIntro.ending10",
] as const;

export function RemoteAgentIntroduction({
  name,
  avatar,
  community,
  builderlab,
}: {
  name: string;
  avatar: AvatarSelection;
  community?: string | undefined;
  builderlab: boolean;
}) {
  useLanguage();
  const [ending] = useState(
    () => endings[Math.floor(Math.random() * endings.length)] ?? endings[0],
  );
  const finish = t(ending);
  // The picture is still the original upload; the crop is painted on save.
  // If it fails to load, the portrait's own fallback and retries take over.
  const [unframed, setUnframed] = useState(false);
  const crop = avatar.kind === "image" && !unframed ? avatar.crop : undefined;
  const framed = useAvatarPreview(
    crop && avatar.kind === "image" ? avatar.picture : "",
    community,
    "small",
  );
  const hello = t("v1agent.remoteIntro.hello", { name });
  const opening = builderlab
    ? t("v1agent.remoteIntro.hostedBefore")
    : t("v1agent.remoteIntro.elsewhere");
  const provider = builderlab ? "Builderlab" : "";
  const ready = builderlab
    ? t("v1agent.remoteIntro.hostedAfter")
    : t("v1agent.remoteIntro.elsewhereEnd");
  const online = builderlab
    ? t("v1agent.remoteIntro.phone")
    : t("v1agent.remoteIntro.availability");
  const files = builderlab ? t("v1agent.remoteIntro.files") : "";
  const openingStart = hello.length;
  const providerStart = openingStart + opening.length;
  const readyStart = providerStart + provider.length;
  const onlineStart = readyStart + ready.length;
  const filesStart = onlineStart + online.length;
  const finishStart = filesStart + files.length;
  const reducedMotion = useReducedMotion();
  const entrance = (at: number) => ({
    initial: { opacity: 0, filter: "blur(0.5px)", scale: 1.05 },
    animate: { opacity: 1, filter: "blur(0px)", scale: 1 },
    transition: {
      duration: 0.18,
      delay: 0.56 + at * 0.0107,
      ease: "easeOut" as const,
    },
  });
  const text = (value: string, start: number, animate: boolean) => {
    if (!animate) return value;
    let offset = start;
    return value.split(/(\s+)/).map((word) => {
      const at = offset;
      offset += word.length;
      if (!word.trim()) return word;
      // Keep words together while each glyph has its own transform box.
      return (
        <span key={at} className={styles.remoteSpeechWord}>
          {Array.from(graphemes.segment(word), ({ segment }, index) => (
            <motion.span
              // biome-ignore lint/suspicious/noArrayIndexKey: immutable prose has a stable character order.
              key={at + index}
              className={styles.remoteSpeechCharacter}
              {...entrance(at + index)}
            >
              {segment}
            </motion.span>
          ))}
        </span>
      );
    });
  };
  const logo = <BuilderlabLogoIcon size="1em" aria-hidden="true" />;
  const copy = (animate: boolean) => (
    <>
      <p>{text(hello, 0, animate)}</p>
      <p>
        {text(opening, openingStart, animate)}
        {builderlab && (
          <span className={`${styles.remoteProvider} text-label-sm`}>
            {animate ? (
              <motion.span
                className={`${styles.remoteSpeechCharacter} ${styles.remoteProviderLogo}`}
                {...entrance(providerStart)}
              >
                {logo}
              </motion.span>
            ) : (
              <span className={styles.remoteProviderLogo}>{logo}</span>
            )}
            {text(provider, providerStart, animate)}
          </span>
        )}
        {text(ready, readyStart, animate)}
      </p>
      <p>
        {text(online, onlineStart, animate)}
        {text(files, filesStart, animate)}
      </p>
      <p>{text(finish, finishStart, animate)}</p>
    </>
  );

  return (
    <div className={styles.remoteIntroduction}>
      <motion.div
        className={`${styles.remoteSpeech} text-body`}
        initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: reducedMotion ? 0 : 0.24,
          delay: reducedMotion ? 0 : 0.28,
          ease: "easeOut",
        }}
      >
        {/* AT gets the full disclosure once, without per-character announcements. */}
        <div className={reducedMotion ? styles.remoteSpeechCopy : "sr-only"}>
          {copy(false)}
        </div>
        {!reducedMotion && (
          <div className={styles.remoteSpeechCopy} aria-hidden="true">
            {/* Every glyph is laid out from the start; only its paint animates. */}
            {copy(true)}
          </div>
        )}
      </motion.div>
      <motion.div
        className={styles.remotePortrait}
        role="img"
        aria-label={t("v1agent.remoteIntro.avatar", { name })}
        initial={reducedMotion ? false : { opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.28, ease: "easeOut" }}
      >
        {avatar.kind === "emoji" ? (
          <div
            data-avatar-shape="squircle"
            className={styles.remoteEmoji}
            style={{ backgroundColor: avatar.color }}
          >
            <EmojiSwap
              emoji={avatar.emoji}
              crop={avatar.crop}
              animate={false}
            />
          </div>
        ) : crop && framed ? (
          <AvatarCropFrame
            src={framed}
            shape="squircle"
            crop={crop}
            onError={() => setUnframed(true)}
          />
        ) : (
          <AgentPortrait
            agent={{ name, picture: avatar.picture }}
            community={community}
          />
        )}
      </motion.div>
    </div>
  );
}

import { useEvent } from "expo";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icons";
import { tapFeedback } from "@/lib/haptics";
import { useHeartbeat } from "@/lib/use_heartbeat";
import { useAppFocused } from "@/lib/use_poll";
import { resolveVideo } from "@/lib/video";
import { colors, radius, spacing, type } from "@/theme/tokens";

type VideoPlayerProps = {
  url: string | null | undefined;
  heartbeatId: string;
  thumbnailUrl?: string;
};

// Direct media plays inline; a YouTube/Vimeo page can only open out, so it gets
// a poster and a hand-off rather than a player that silently stays black.
export function VideoPlayer({ url, heartbeatId, thumbnailUrl }: VideoPlayerProps) {
  const source = resolveVideo(url);

  if (source.type === "file") {
    return <NativeVideo src={source.src} heartbeatId={heartbeatId} />;
  }
  if (source.type === "embed") {
    return <EmbedVideo src={source.src} thumbnailUrl={thumbnailUrl} />;
  }
  return (
    <View style={[styles.frame, styles.placeholder]}>
      <Icon name="video-off" size={22} color={colors.textTertiary} />
      <Text style={styles.placeholderText}>No video attached to this session yet.</Text>
    </View>
  );
}

function NativeVideo({ src, heartbeatId }: { src: string; heartbeatId: string }) {
  const player = useVideoPlayer(src, (p) => {
    p.loop = false;
  });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const focused = useAppFocused();
  useHeartbeat(heartbeatId, isPlaying && focused);

  useEffect(() => {
    player.play();
  }, [player]);

  return (
    <View style={styles.frame}>
      <VideoView player={player} allowsPictureInPicture nativeControls style={styles.video} />
    </View>
  );
}

function EmbedVideo({ src, thumbnailUrl }: { src: string; thumbnailUrl?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Play video in browser"
      onPress={() => {
        tapFeedback();
        void WebBrowser.openBrowserAsync(src);
      }}
      style={({ pressed }) => [styles.frame, styles.embed, pressed && styles.pressed]}
    >
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} contentFit="cover" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={styles.embedScrim} />
      <View style={styles.playDisc}>
        <Icon name="play" size={24} color={colors.paperForeground} style={styles.playGlyph} />
      </View>
      <View style={styles.embedCaption}>
        <Icon name="external-link" size={12} color={colors.mutedForeground} />
        <Text style={styles.embedCaptionText}>Opens in your browser</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  video: {
    aspectRatio: 16 / 9,
  },
  embed: {
    aspectRatio: 16 / 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.85,
  },
  embedScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
  },
  playDisc: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  playGlyph: {
    marginLeft: 3,
  },
  embedCaption: {
    position: "absolute",
    bottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.chipScrim,
    paddingVertical: 5,
    paddingHorizontal: spacing.md - 2,
  },
  embedCaptionText: {
    ...type.micro,
    color: colors.mutedForeground,
  },
  placeholder: {
    aspectRatio: 16 / 9,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  placeholderText: {
    ...type.caption,
    textAlign: "center",
    color: colors.textSecondary,
  },
});

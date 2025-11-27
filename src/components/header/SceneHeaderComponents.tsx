import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LiquidGlass } from "../LiquidGlass";
import HapticPressable from "../ui/HapticPressable";

type IoniconName = keyof typeof Ionicons.glyphMap;

type CharacterHeaderCardProps = {
  name?: string | null;
  relationshipName?: string | null;
  relationshipProgress?: number | null;
  relationshipIconUri?: string | null;
  avatarUri?: string | null;
  onPress?: () => void;
};

export const CharacterHeaderCard: React.FC<CharacterHeaderCardProps> = ({
  name,
  relationshipName,
  relationshipProgress = 0,
  relationshipIconUri,
  avatarUri,
  onPress,
}) => {
  const normalizedProgress = clamp(relationshipProgress ?? 0);
  const label = name?.trim() ?? "";

  if (!label) {
    return <View style={styles.placeholder} />;
  }

  const relationshipLabel = relationshipName?.trim() || "Stranger";

  return (
    <LiquidGlass style={styles.card}>
      <HapticPressable
        accessibilityRole="button"
        accessibilityLabel="Mở thông tin nhân vật"
        style={({ pressed }) => [styles.cardContent, pressed && styles.pressed]}
        onPress={onPress}
      >
        <View style={styles.cardBody}>
          <View style={styles.topRow}>
            <View style={styles.avatarWrapper}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <Ionicons name="person" size={12} color="#fff" />
              )}
            </View>
            <Text numberOfLines={1} style={styles.characterName}>
              {label}
            </Text>
          </View>

          <View style={styles.relationshipRow}>
            <View style={styles.relationshipIcon}>
              {relationshipIconUri ? (
                <Image
                  source={{ uri: relationshipIconUri }}
                  style={styles.relationshipIconImage}
                />
              ) : (
                <Ionicons name="heart" size={10} color="#FF79B0" />
              )}
            </View>
            <Text numberOfLines={1} style={styles.relationshipLabel}>
              {relationshipLabel}
            </Text>
            <View style={styles.progressTrack} accessible accessibilityRole="progressbar">
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, Math.max(0, normalizedProgress * 100))}%` },
                ]}
              />
            </View>
          </View>
        </View>
      </HapticPressable>
    </LiquidGlass>
  );
};

type HeaderIconButtonProps = {
  iconName: IoniconName;
  onPress?: () => void;
  active?: boolean;
  accessibilityLabel?: string;
};

export const HeaderIconButton: React.FC<HeaderIconButtonProps> = ({
  iconName,
  onPress,
  active,
  accessibilityLabel,
}) => {
  return (
    <HapticPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Ionicons name={iconName} size={24} />
    </HapticPressable>
  );
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const styles = StyleSheet.create({
  card: {
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  cardContent: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  cardBody: {
    flexDirection: "column",
    gap: 4,
    maxWidth: 200,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  characterName: {
    fontSize: 13,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  relationshipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  relationshipLabel: {
    fontSize: 10,
    flexShrink: 1,
  },
  progressTrack: {
    width: 28,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.2)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  avatarWrapper: {
    width: 20,
    height: 20,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  iconContainer: {
    borderRadius: 999,
    padding: 6,
  },
  iconContainerActive: {
    backgroundColor: "rgba(255,121,176,0.25)",
  },
  iconButton: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  relationshipIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  relationshipIconImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  placeholder: {
    width: 1,
    height: 1,
    opacity: 0,
  },
  pressed: {
    opacity: 0.8,
  },
});

import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  IconSettings,
  IconVolume,
  IconVolume3, // volume-high equivalent? IconVolume is usually high. IconVolume3 is likely high. Let's check docs or assume IconVolume is fine. Tabler has IconVolume, IconVolume2, IconVolume3. IconVolume is usually speaker with no waves? No, IconVolume is speaker. IconVolume2/3 have waves. Let's use IconVolume for now or IconVolumeOn if available? Tabler: IconVolume, IconVolume2, IconVolume3. Let's use IconVolume for generic "on".
  IconVolumeOff,
  IconLayoutGrid,
  IconPlayerStop,
  IconVideo,
} from "@tabler/icons-react-native";
import { LiquidGlass } from "../LiquidGlass";
import HapticPressable from "../ui/HapticPressable";
import { NotificationDot } from "../ui/NotificationDot";
import Button from "../Button";

type CharacterHeaderCardProps = {
  name?: string | null;
  relationshipName?: string | null;
  relationshipProgress?: number | null;
  relationshipIconUri?: string | null;
  avatarUri?: string | null;
  onPress?: () => void;
  isDarkBackground?: boolean;
};

export const CharacterHeaderCard: React.FC<CharacterHeaderCardProps> = ({
  name,
  relationshipName,
  relationshipProgress = 0,
  relationshipIconUri,
  avatarUri,
  onPress,
  isDarkBackground = true,
}) => {
  const normalizedProgress = clamp(relationshipProgress ?? 0);
  const label = name?.trim() ?? "";

  if (!label) {
    return <View style={styles.placeholder} />;
  }

  const relationshipLabel = relationshipName?.trim() || "Stranger";

  return (
    <LiquidGlass isDarkBackground={isDarkBackground} style={styles.card} onPress={onPress}>
      <View style={styles.cardBody}>
        <View style={styles.topRow}>
          {/* <View style={styles.avatarWrapper}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <Ionicons name="person" size={12} color="#fff" />
            )}
          </View> */}
          <Text
            numberOfLines={1}
            style={[
              styles.characterName,
              { color: isDarkBackground ? "#fff" : "#000" },
            ]}
          >
            {label}
          </Text>
        </View>

        {/* <View style={styles.relationshipRow}> */}
        {/* <View style={styles.relationshipIcon}>
            {relationshipIconUri ? (
              <Image
                source={{ uri: relationshipIconUri }}
                style={styles.relationshipIconImage}
              />
            ) : (
              <Ionicons name="heart" size={10} color="#FF79B0" />
            )}
          </View> */}
        {/* <Text numberOfLines={1} style={styles.relationshipLabel}>
            {relationshipLabel}
          </Text>
          <View style={styles.progressTrack} accessible accessibilityRole="progressbar">
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, Math.max(0, normalizedProgress * 100))}%` },
              ]}
            />
          </View> */}
        {/* </View> */}
      </View>
    </LiquidGlass>
  );
};

type HeaderIconButtonProps = {
  Icon: React.ElementType;
  onPress?: () => void;
  active?: boolean;
  accessibilityLabel?: string;
  iconColor?: string;
  isDarkBackground?: boolean;
};

export const HeaderIconButton: React.FC<HeaderIconButtonProps> = ({
  Icon,
  onPress,
  active,
  accessibilityLabel,
  iconColor = "#fff",
  isDarkBackground,
}) => {
  return (
    <Button
      onPress={onPress}
      variant="liquid"
      isIconOnly
      startIcon={Icon}
      iconColor={iconColor}
      size="lg"
      isDarkBackground={isDarkBackground}
    >
    </Button>
  );
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const styles = StyleSheet.create({
  card: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    height: 30,
    minWidth: 90,
    justifyContent: 'center'
  },
  characterName: {
    fontSize: 16,
    fontWeight: "600",
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sceneHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 100,
  },
  iconButtonContainer: {
    position: 'relative',
  },
});

// Scene Header Left Component
type SceneHeaderLeftProps = {
  onSettingsPress?: () => void;
  onBgmToggle?: () => void;
  isBgmOn?: boolean;
  isDarkBackground?: boolean;
};

export const SceneHeaderLeft: React.FC<SceneHeaderLeftProps> = ({
  onSettingsPress,
  onBgmToggle,
  isBgmOn = false,
  isDarkBackground = true,
}) => {
  const iconColor = isDarkBackground ? '#fff' : '#000';

  return (
    <View style={styles.headerActions}>
      <HeaderIconButton
        Icon={IconSettings}
        onPress={onSettingsPress}
        accessibilityLabel="Open settings"
        iconColor={iconColor}
        isDarkBackground={isDarkBackground}
      />
      <HeaderIconButton
        Icon={isBgmOn ? IconVolume : IconVolumeOff}
        onPress={onBgmToggle}
        accessibilityLabel="Toggle background music"
        active={isBgmOn}
        iconColor={iconColor}
        isDarkBackground={isDarkBackground}
      />
    </View>
  );
};

// Scene Header Right Component
type SceneHeaderRightProps = {
  onCharacterMenuPress?: () => void;
  onCameraToggle?: () => void;
  isCameraModeOn?: boolean;
  isDarkBackground?: boolean;
};

export const SceneHeaderRight: React.FC<SceneHeaderRightProps> = ({
  onCharacterMenuPress,
  onCameraToggle,
  isCameraModeOn = false,
  isDarkBackground = true,
}) => {
  const iconColor = isDarkBackground ? '#fff' : '#000';

  return (
    <View style={styles.headerActions}>
      <HeaderIconButton
        Icon={IconLayoutGrid}
        onPress={onCharacterMenuPress}
        accessibilityLabel="Character menu"
        iconColor={iconColor}
        isDarkBackground={isDarkBackground}
      />
      <HeaderIconButton
        Icon={isCameraModeOn ? IconPlayerStop : IconVideo}
        onPress={onCameraToggle}
        accessibilityLabel="Camera mode"
        active={isCameraModeOn}
        iconColor={iconColor}
        isDarkBackground={isDarkBackground}
      />
    </View>
  );
};

// Full Scene Header Component (positioned absolutely at top)
type SceneHeaderProps = {
  // Character card props
  characterName?: string | null;
  relationshipName?: string | null;
  relationshipProgress?: number | null;
  avatarUri?: string | null;
  onCharacterCardPress?: () => void;
  // Left side props
  onSettingsPress?: () => void;
  // Right side props
  onCharacterMenuPress?: () => void;
  // Common props
  isDarkBackground?: boolean;
};

export const SceneHeader: React.FC<SceneHeaderProps> = ({
  characterName,
  relationshipName,
  relationshipProgress,
  avatarUri,
  onCharacterCardPress,
  onSettingsPress,
  onCharacterMenuPress,
  isDarkBackground = true,
}) => {
  const insets = useSafeAreaInsets();
  const iconColor = isDarkBackground ? '#fff' : '#000';

  return (
    <View style={[styles.sceneHeader, { paddingTop: insets.top + 8 }]}>
      {/* Left */}
      <View style={styles.headerActions}>
        <HeaderIconButton
          Icon={IconSettings}
          onPress={onSettingsPress}
          accessibilityLabel="Open settings"
          iconColor={iconColor}
          isDarkBackground={isDarkBackground}
        />
      </View>

      {/* Center */}
      <CharacterHeaderCard
        name={characterName}
        relationshipName={relationshipName}
        relationshipProgress={relationshipProgress}
        avatarUri={avatarUri}
        onPress={onCharacterCardPress}
        isDarkBackground={isDarkBackground}
      />

      {/* Right */}
      <View style={styles.headerActions}>
        <View style={styles.iconButtonContainer}>
          <HeaderIconButton
            Icon={IconLayoutGrid}
            onPress={onCharacterMenuPress}
            accessibilityLabel="Character menu"
            iconColor={iconColor}
            isDarkBackground={isDarkBackground}
          />
          <NotificationDot />
        </View>
      </View>
    </View>
  );
};

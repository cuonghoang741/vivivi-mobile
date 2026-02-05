import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  IconSettings,
  IconVolume,
  IconVolume3, // volume-high equivalent? IconVolume is usually high. IconVolume3 is likely high. Let's check docs or assume IconVolume is fine. Tabler has IconVolume, IconVolume2, IconVolume3. IconVolume is usually speaker with no waves? No, IconVolume is speaker. IconVolume2/3 have waves. Let's use IconVolume for now or IconVolumeOn if available? Tabler: IconVolume, IconVolume2, IconVolume3. Let's use IconVolume for generic "on".
  IconVolumeOff,
  IconLayoutGrid,
  IconPlayerStop,
  IconVideo,
  IconMovie,
  IconHeart,
  IconPhone,
} from "@tabler/icons-react-native";
import { LiquidGlass } from "../commons/LiquidGlass";
import HapticPressable from "../ui/HapticPressable";
import { NotificationDot } from "../ui/NotificationDot";
import Button from "../commons/Button";

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
  // const normalizedProgress = clamp(relationshipProgress ?? 0);
  const label = name?.trim() ?? "";

  if (!label) {
    return <View style={styles.placeholder} />;
  }

  // const relationshipLabel = relationshipName?.trim() || "Stranger";

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

        {/* <View style={styles.relationshipRow}>
          <View style={styles.relationshipIcon}>
            {relationshipIconUri ? (
              <Image
                source={{ uri: relationshipIconUri }}
                style={styles.relationshipIconImage}
              />
            ) : (
              <IconHeart size={10} color="#FF79B0" />
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
        </View> */}
      </View>
    </LiquidGlass>
  );
};

// Mode Tab Switch Component (2D / 3D)
type ModeTabSwitchProps = {
  mode: '2d' | '3d';
  onModeChange: (mode: '2d' | '3d') => void;
  isPro: boolean;
  isDarkBackground?: boolean;
  onUpgradePress?: () => void;
};

import { IconDiamond } from "@tabler/icons-react-native";
import DiamondPinkIcon from "../../assets/icons/diamond-pink.svg";

export const ModeTabSwitch: React.FC<ModeTabSwitchProps> = ({
  mode,
  onModeChange,
  isPro,
  isDarkBackground = true,
  onUpgradePress,
}) => {
  const handle3DPress = () => {
    if (isPro) {
      onModeChange('3d');
    } else if (onUpgradePress) {
      onUpgradePress();
    }
  };

  return (
    <LiquidGlass
      isDarkBackground={isDarkBackground}
      style={styles.modeTabContainer}
    >
      {/* 2D Tab */}
      <Pressable
        style={[
          styles.modeTab,
          mode === '2d' && { backgroundColor: isDarkBackground ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' },
        ]}
        onPress={() => onModeChange('2d')}
      >
        <Text style={[
          styles.modeTabText,
          { color: isDarkBackground ? '#fff' : '#000' },
          mode === '2d' && { fontWeight: '700' },
        ]}>
          2D
        </Text>
      </Pressable>

      {/* 3D Tab */}
      <Pressable
        style={[
          styles.modeTab,
          mode === '3d' && { backgroundColor: isDarkBackground ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' },
        ]}
        onPress={handle3DPress}
      >
        <View style={styles.modeTabContent}>
          <Text style={[
            styles.modeTabText,
            { color: isDarkBackground ? '#fff' : '#000' },
            mode === '3d' && { fontWeight: '700' },
            !isPro && styles.modeTabTextLocked,
          ]}>
            3D
          </Text>
          {!isPro && (
            <View style={styles.proLabel}>
              <DiamondPinkIcon width={12} height={12} />
              <Text style={[styles.proLabelText, { color: '#FF416C' }]}>PRO</Text>
            </View>
          )}
        </View>
      </Pressable>
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
  size?: 'lg' | 'md' | 'sm';
};

export const HeaderIconButton: React.FC<HeaderIconButtonProps> = ({
  Icon,
  onPress,
  active,
  accessibilityLabel,
  iconColor = "#fff",
  isDarkBackground,
  size = "lg",
}) => {
  return (
    <Button
      onPress={onPress}
      variant="liquid"
      isIconOnly
      startIcon={Icon}
      iconColor={iconColor}
      size={size}
      iconSizeMin={20}
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
    gap: 0,
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
  callButtonWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  callTimeText: {
    fontSize: 10,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // ModeTabSwitch styles
  modeTabContainer: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  modeTabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modeTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modeTabTextActive: {
    opacity: 1,
  },
  modeTabTextLocked: {
    opacity: 0.6,
  },
  proLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255, 92, 168, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  proLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFD700',
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
  // Character card props (kept for backward compatibility)
  characterName?: string | null;
  relationshipName?: string | null;
  relationshipProgress?: number | null;
  avatarUri?: string | null;
  onCharacterCardPress?: () => void;
  // Left side props
  onSettingsPress?: () => void;
  onMediaPress?: () => void;
  // Right side props
  onCharacterMenuPress?: () => void;
  onCallPress?: () => void;
  remainingQuotaSeconds?: number;
  // Mode switch props
  viewMode?: '2d' | '3d';
  onViewModeChange?: (mode: '2d' | '3d') => void;
  isPro?: boolean;
  onUpgradePress?: () => void;
  // Common props
  isDarkBackground?: boolean;
};

export const SceneHeader: React.FC<SceneHeaderProps> = ({
  characterName,
  relationshipName,
  relationshipProgress,
  avatarUri,
  onCharacterCardPress,
  onMediaPress,
  onSettingsPress,
  onCharacterMenuPress,
  onCallPress,
  remainingQuotaSeconds = 0,
  viewMode = '2d',
  onViewModeChange,
  isPro = false,
  onUpgradePress,
  isDarkBackground = true,
}) => {
  const insets = useSafeAreaInsets();
  const iconColor = isDarkBackground ? '#fff' : '#000';

  // Format remaining time
  const formatRemainingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.sceneHeader, { paddingTop: insets.top + 8 }]}>
      {/* Left */}
      <LiquidGlass tintColor={isDarkBackground ? "#000000a7" : "#ffffff50"} style={[styles.headerActions, { borderRadius: 160, height: 44 }]}>
        <HeaderIconButton
          Icon={IconSettings}
          onPress={onSettingsPress}
          accessibilityLabel="Open settings"
          iconColor={iconColor}
          isDarkBackground={isDarkBackground}
          size="md"
        />
        {onMediaPress && (
          <HeaderIconButton
            Icon={IconMovie}
            onPress={onMediaPress}
            accessibilityLabel="Open media"
            iconColor={iconColor}
            isDarkBackground={isDarkBackground}
            size="md"
          />
        )}

      </LiquidGlass>

      {/* Center - Mode Tab Switch */}
      {onViewModeChange ? (
        <ModeTabSwitch
          mode={viewMode}
          onModeChange={onViewModeChange}
          isPro={isPro}
          isDarkBackground={isDarkBackground}
          onUpgradePress={onUpgradePress}
        />
      ) : (
        <CharacterHeaderCard
          name={characterName}
          relationshipName={relationshipName}
          relationshipProgress={relationshipProgress}
          avatarUri={avatarUri}
          onPress={onMediaPress}
          isDarkBackground={isDarkBackground}
        />
      )}

      {/* Right */}
      <LiquidGlass tintColor={isDarkBackground ? "#000000a7" : "#ffffff50"} style={[styles.headerActions, { borderRadius: 160, height: 44 }]}>
        {/* Call button with time display */}
        {onCallPress && (
          <View style={styles.callButtonWrapper}>
            <Button
              onPress={onCallPress}
              variant="liquid"
              isIconOnly
              startIcon={IconVideo}
              iconColor={iconColor}
              iconSizeMin={20}
              size="md"
              isDarkBackground={isDarkBackground}
            />
          </View>
        )}
        <View style={styles.iconButtonContainer}>
          <HeaderIconButton
            Icon={IconLayoutGrid}
            onPress={onCharacterMenuPress}
            accessibilityLabel="Character menu"
            iconColor={iconColor}
            isDarkBackground={isDarkBackground}
            size="md"
          />
          <NotificationDot />
        </View>
      </LiquidGlass>
    </View>
  );
};

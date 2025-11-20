import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LiquidGlass } from '../LiquidGlass';
import HapticPressable from '../ui/HapticPressable';

type IoniconName = keyof typeof Ionicons.glyphMap;

type CharacterHeaderCardProps = {
  name?: string | null;
  relationshipName?: string | null;
  relationshipProgress?: number | null;
  avatarUri?: string | null;
  onPress?: () => void;
};

export const CharacterHeaderCard: React.FC<CharacterHeaderCardProps> = ({
  name,
  relationshipName,
  relationshipProgress = 0,
  avatarUri,
  onPress,
}) => {
  const normalizedProgress = clamp(relationshipProgress ?? 0);
  const label = name ?? 'Chưa có nhân vật';
  const relationshipLabel = relationshipName ?? 'Stranger';

  return (
    <LiquidGlass style={styles.card}>
      <HapticPressable
        accessibilityRole="button"
        accessibilityLabel="Mở thông tin nhân vật"
        style={({ pressed }) => [styles.cardContent, pressed && styles.pressed]}
        onPress={onPress}
      >
        <View style={styles.avatarWrapper}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <Ionicons name="person" size={18} color="#fff" />
          )}
        </View>
        <View style={styles.cardTexts}>
          <Text numberOfLines={1} style={styles.characterName}>
            {label}
          </Text>
          <View style={styles.relationshipRow}>
            <Ionicons name="heart" size={10} color="#FF79B0" />
            <Text numberOfLines={1} style={styles.relationshipLabel}>
              {relationshipLabel}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${normalizedProgress * 100}%` },
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
    <LiquidGlass
      style={[styles.iconContainer, active && styles.iconContainerActive]}
    >
      <HapticPressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      >
        <Ionicons name={iconName} size={16} color="#fff" />
      </HapticPressable>
    </LiquidGlass>
  );
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const styles = StyleSheet.create({
  card: {
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  cardTexts: {
    maxWidth: 180,
  },
  characterName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  relationshipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  relationshipLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    flexShrink: 1,
  },
  progressTrack: {
    width: 30,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF79B0',
  },
  avatarWrapper: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  iconContainer: {
    borderRadius: 999,
    padding: 6,
  },
  iconContainerActive: {
    backgroundColor: 'rgba(255,121,176,0.25)',
  },
  iconButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});
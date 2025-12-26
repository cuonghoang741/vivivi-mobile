import React, { useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CharacterItem } from '../repositories/CharacterRepository';

type CharacterQuickSwitcherProps = {
  characters: CharacterItem[];
  currentIndex: number;
  onCharacterTap: (index: number) => void;
  onAddCharacter: () => void;
  unseenCounts?: Record<string, number>;
  isInputActive?: boolean;
  keyboardHeight?: number;
  isModelLoading?: boolean;
};

export const CharacterQuickSwitcher: React.FC<CharacterQuickSwitcherProps> = ({
  characters,
  currentIndex,
  onCharacterTap,
  onAddCharacter,
  unseenCounts = {},
  isInputActive = false,
  keyboardHeight = 0,
  isModelLoading = false,
}) => {
  const opacityAnim = useRef(new Animated.Value(isModelLoading ? 0.5 : 1.0)).current;
  const offsetXAnim = useRef(new Animated.Value(isInputActive ? 120 : 0)).current;
  const selectionAnim = useRef(new Animated.Value(1)).current;

  // Animate opacity when model loading changes
  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: isModelLoading ? 0.5 : 1.0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isModelLoading, opacityAnim]);

  // Animate offset when input active changes
  useEffect(() => {
    Animated.timing(offsetXAnim, {
      toValue: isInputActive ? 120 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isInputActive, offsetXAnim]);

  // Animate khi đổi nhân vật được chọn (giả lập swipe feedback)
  useEffect(() => {
    selectionAnim.setValue(0);
    Animated.spring(selectionAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start();
  }, [currentIndex, selectionAnim]);

  const displayItems = useMemo(() => {
    if (characters.length === 0) return [];
    
    if (currentIndex < 0 || currentIndex >= characters.length) return [];

    const count = characters.length;
    const current = currentIndex;

    if (count === 1) {
      // Only one character - show just that one
      return [characters[current]];
    } else if (count === 2) {
      // Two characters - show both
      const other = (current + 1) % 2;
      return [characters[current], characters[other]];
    } else {
      // Three or more - show prev, current, next
      const prev = (current - 1 + count) % count;
      const next = (current + 1) % count;
      return [characters[prev], characters[current], characters[next]];
    }
  }, [characters, currentIndex]);

  const bottomPadding = useMemo(() => {
    if (isInputActive) {
      return keyboardHeight + 40;
    }
    return 140;
  }, [isInputActive, keyboardHeight]);

  if (characters.length === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingBottom: bottomPadding,
          paddingRight: 14,
          opacity: opacityAnim,
          transform: [{ translateX: offsetXAnim }],
        },
      ]}
      pointerEvents={isModelLoading || isInputActive ? 'none' : 'auto'}
    >
      {displayItems.map((item) => {
        const itemIndex = characters.findIndex(c => c.id === item.id);
        const isSelected = item.id === characters[currentIndex]?.id;
        const animatedScale = selectionAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1.0],
        });
        const animatedOpacity = selectionAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.7, 1.0],
        });
        const avatarURL = item.avatar || item.thumbnail_url || '';
        const unseenCount = unseenCounts[item.id] || 0;

        return (
          <View key={item.id} style={styles.avatarWrapper}>
            <Animated.View
              style={[
                styles.avatarContainer,
                isSelected
                  ? { opacity: animatedOpacity, transform: [{ scale: animatedScale }] }
                  : { opacity: 0.5, transform: [{ scale: 0.92 }] },
              ]}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (itemIndex !== -1) {
                    onCharacterTap(itemIndex);
                  }
                }}
              >
                {avatarURL ? (
                  <ExpoImage
                    source={{ uri: avatarURL }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.avatarPlaceholder} />
                )}
                <View style={styles.avatarBorder} />
              </Pressable>
            </Animated.View>
            
            {/* Notification badge */}
            {unseenCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unseenCount > 9 ? '9+' : unseenCount.toString()}
                </Text>
              </View>
            )}
          </View>
        );
      })}

      {/* Add Character Button */}
      <Pressable
        style={styles.addButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onAddCharacter();
        }}
      >
        <Ionicons name="add-circle" size={24} color="#fff" style={styles.addIcon} />
        <View style={styles.addButtonBorder} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    alignItems: 'center',
    gap: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  avatarBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF0000',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  addIcon: {
    zIndex: 1,
  },
  addButtonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
});


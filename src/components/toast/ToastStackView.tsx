import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { toastManager, ToastMessage, ToastType } from '../../managers/ToastManager';
import { CurrencyIcon } from '../CurrencyIcon';

const ICON_NAME_MAP: Record<string, string> = {
  'sparkles': 'sparkles',
  'sparkles-outline': 'sparkles',
  'sparkles.fill': 'sparkles',
  'star.fill': 'star',
  'heart.fill': 'heart',
  'heart': 'heart',
  'coloncurrencysign.circle.fill': 'cash',
  'diamond.fill': 'diamond',
  'bolt.fill': 'flash',
  'bolt': 'flash',
  'checkmark.seal.fill': 'checkmark-circle',
  'checkmark.circle.fill': 'checkmark-circle',
  'checkmark.circle': 'checkmark-circle',
  'arrow.up.circle.fill': 'arrow-up-circle',
  'arrow.up.circle': 'arrow-up-circle',
  'star.circle.fill': 'star',
  'star.circle': 'star',
  'bell.fill': 'notifications',
  'target': 'disc',
  'target.fill': 'disc',
  'diamond': 'diamond',
  'coin': 'cash',
  'cash': 'cash',
};

export const ToastStackView: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = toastManager.subscribe(newToasts => {
      setToasts(newToasts);
    });
    return unsubscribe;
  }, []);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map(toast => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </View>
  );
};

const ToastCard: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const translateYAnim = React.useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fadeAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const iconColor = getIconColor(toast.type);
  const iconName = getIconName(toast);

  return (
    <Animated.View
      style={[
        styles.toastCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: translateYAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          {getCurrencyType(toast.type) ? (
            <CurrencyIcon
              type={getCurrencyType(toast.type)!}
              size={20}
            />
          ) : (
            <Ionicons
              name={iconName as any}
              size={14}
              color={iconColor}
              style={styles.icon}
            />
          )}
        </View>

        {/* Text Content */}
        <View style={[
          styles.textContainer,
          !toast.subtitle && toast.progress === undefined && styles.textContainerCenter
        ]}>
          <View style={styles.textContent}>
            <Text style={styles.title} numberOfLines={1}>
              {toast.title}
            </Text>
            {toast.subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {toast.subtitle}
              </Text>
            )}
          </View>

          {/* Progress Bar */}
          {toast.progress !== undefined && toast.target !== undefined && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${(toast.progress * 100).toFixed(0)}%` as any,
                      backgroundColor: iconColor,
                    },
                  ]}
                />
              </View>
              {toast.amount !== undefined && (
                <Text style={styles.progressText}>
                  {toast.amount}/{toast.target}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

// Helper functions
function getIconColor(type: ToastType): string {
  switch (type) {
    case ToastType.XP:
      return '#8C59FF'; // rgb(0.55, 0.35, 1.0)
    case ToastType.BP:
      return '#33B3E6'; // rgb(0.2, 0.7, 0.9)
    case ToastType.RELATIONSHIP:
      return '#FF5A99'; // rgb(1.0, 0.35, 0.6)
    case ToastType.VCOIN:
      return '#FFC42E'; // rgb(1.0, 0.77, 0.18)
    case ToastType.RUBY:
      return '#FA638F'; // rgb(0.98, 0.39, 0.44)
    case ToastType.ENERGY:
      return '#4AC7FA'; // rgb(0.29, 0.78, 0.98)
    case ToastType.QUEST:
      return '#3DD995'; // rgb(0.24, 0.85, 0.58)
    case ToastType.LEVEL_UP:
      return '#FFA14F'; // rgb(1.0, 0.63, 0.31)
    case ToastType.ITEM:
      return '#D194FF'; // rgb(0.82, 0.58, 1.0)
    case ToastType.CUSTOM:
      return '#73A0FF'; // rgb(0.45, 0.62, 1.0)
    default:
      return '#73A0FF';
  }
}

function normalizeIconName(raw?: string): string | undefined {
  if (!raw) return undefined;
  if (ICON_NAME_MAP[raw]) {
    return ICON_NAME_MAP[raw];
  }
  const trimmed = raw.replace('.fill', '').replace('.outline', '');
  if (ICON_NAME_MAP[trimmed]) {
    return ICON_NAME_MAP[trimmed];
  }
  return raw;
}

function getIconName(toast: ToastMessage): string {
  const provided = normalizeIconName(toast.icon);
  if (provided) {
    return provided;
  }
  // Default icons
  switch (toast.type) {
    case ToastType.XP:
      return 'sparkles';
    case ToastType.BP:
      return 'star';
    case ToastType.RELATIONSHIP:
      return 'heart';
    case ToastType.VCOIN:
      return 'cash';
    case ToastType.RUBY:
      return 'diamond';
    case ToastType.ENERGY:
      return 'flash';
    case ToastType.QUEST:
      return 'checkmark-circle';
    case ToastType.LEVEL_UP:
      return 'arrow-up-circle';
    case ToastType.ITEM:
      return 'star';
    case ToastType.CUSTOM:
      return 'notifications';
    default:
      return 'notifications';
  }
}

function getCurrencyType(type: ToastType): 'vcoin' | 'ruby' | null {
  if (type === ToastType.VCOIN) {
      return 'vcoin';
  }
  if (type === ToastType.RUBY) {
      return 'ruby';
  }
      return null;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 130,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10000,
    pointerEvents: 'box-none',
    elevation: 10000, // For Android
  },
  toastCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    minWidth: 100,
    maxWidth: '90%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  icon: {
    width: 20,
    height: 20,
  },
  textContainer: {
    flexShrink: 1,
    gap: 6,
    minWidth: 0,
    justifyContent: 'center',
  },
  textContainerCenter: {
    justifyContent: 'center',
  },
  textContent: {
    gap: 1,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(0, 0, 0, 0.7)',
    flexShrink: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  progressBarBackground: {
    flex: 1,
    minWidth: 80,
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressText: {
    fontSize: 9,
    fontWeight: '500',
    color: 'rgba(0, 0, 0, 0.6)',
    flexShrink: 0,
  },
});


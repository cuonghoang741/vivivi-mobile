import * as Haptics from 'expo-haptics';

export type HapticType =
  | 'none'
  | 'selection'
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error';

export function triggerHaptic(type: HapticType = 'selection') {
  try {
    switch (type) {
      case 'none':
        return;
      case 'selection':
        Haptics.selectionAsync();
        return;
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        return;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      default:
        Haptics.selectionAsync();
    }
  } catch (_) {
    // noop on web or unsupported platforms
  }
}

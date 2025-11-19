import { HapticType, triggerHaptic } from '../../services/haptics';
import React from 'react';
import { Pressable, PressableProps } from 'react-native';

export interface HapticPressableProps extends PressableProps {
  haptic?: HapticType;
}

export const HapticPressable: React.FC<HapticPressableProps> = ({
  haptic = 'selection',
  onPress,
  disabled,
  ...rest
}) => {
  const handlePress = React.useCallback<NonNullable<PressableProps['onPress']>>(
    (event) => {
      triggerHaptic(haptic);
      onPress?.(event);
    },
    [haptic, onPress],
  );

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      // When disabled, allow touches to pass through so parent ScrollView can scroll
      pointerEvents={disabled ? 'none' : 'auto'}
      onPress={handlePress}
    />
  );
};

export default HapticPressable;

import React from 'react';
import { Host, Button, VStack, Text } from '@expo/ui/swift-ui';
import { StyleSheet, View } from 'react-native';

interface SwiftUIButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'default' | 'bordered' | 'borderedProminent' | 'plain' | 'borderless';
  systemImage?: string;
}

/**
 * SwiftUI Button component wrapped in Host
 * This provides native iOS button with liquid glass effect on iOS 26+
 */
export const SwiftUIButton: React.FC<SwiftUIButtonProps> = ({
  title,
  onPress,
  variant = 'default',
  systemImage,
}) => {
  return (
    <Host matchContents>
      <Button
        variant={variant}
        onPress={onPress}
        systemImage={systemImage}
      >
        {title}
      </Button>
    </Host>
  );
};

/**
 * Example of using multiple SwiftUI components together
 */
export const SwiftUIButtonGroup: React.FC<{
  buttons: Array<{ title: string; onPress: () => void; variant?: SwiftUIButtonProps['variant'] }>;
}> = ({ buttons }) => {
  return (
    <Host style={styles.container}>
      <VStack spacing={12}>
        {buttons.map((button, index) => (
          <SwiftUIButton
            key={index}
            title={button.title}
            onPress={button.onPress}
            variant={button.variant}
          />
        ))}
      </VStack>
    </Host>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
});


import React from 'react';
import { Host, BottomSheet, Text, VStack } from '@expo/ui/swift-ui';
import { useWindowDimensions, StyleSheet } from 'react-native';

interface SwiftUIBottomSheetProps {
  isOpened: boolean;
  onIsOpenedChange: (isOpened: boolean) => void;
  children: React.ReactNode;
  title?: string;
}

/**
 * SwiftUI BottomSheet component
 */
export const SwiftUIBottomSheet: React.FC<SwiftUIBottomSheetProps> = ({
  isOpened,
  onIsOpenedChange,
  children,
  title,
}) => {
  const { width } = useWindowDimensions();

  return (
    <Host style={[styles.container, { width }]}>
      <BottomSheet
        isOpened={isOpened}
        onIsOpenedChange={onIsOpenedChange}
      >
        {title && (
          <VStack spacing={8}>
            <Text style={styles.title}>{title}</Text>
          </VStack>
        )}
        {children}
      </BottomSheet>
    </Host>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 16,
  },
});


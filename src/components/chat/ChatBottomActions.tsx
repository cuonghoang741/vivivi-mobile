import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LiquidGlass } from '../commons/LiquidGlass';

type Props = {
  onCapture: () => void;
  onSendPhoto: () => void;
  onDance: () => void;
  isDancing?: boolean;
  isInCall?: boolean;
  isDarkBackground?: boolean;
};

export const ChatBottomActions: React.FC<Props> = ({
  onCapture,
  onSendPhoto,
  onDance,
  isDancing = false,
  isInCall = false,
  isDarkBackground = true,
}) => {
  // When in call mode, hide all action buttons
  if (isInCall) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ActionButton icon="camera-outline" label="Capture" onPress={onCapture} isDarkBackground={isDarkBackground} />
      <ActionButton icon="heart-outline" label="Send photo" onPress={onSendPhoto} isDarkBackground={isDarkBackground} />
      <ActionButton
        icon={isDancing ? "close" : "musical-notes-outline"}
        label={isDancing ? "Dance" : "Dance"}
        onPress={onDance}
        isDarkBackground={isDarkBackground}
      />
    </View>
  );
};

const ActionButton: React.FC<{ icon: string; label: string; onPress: () => void; isDarkBackground: boolean }> = ({
  icon,
  label,
  onPress,
  isDarkBackground,
}) => (
  <LiquidGlass style={styles.button} onPress={onPress} isDarkBackground={isDarkBackground}>
    <Ionicons name={icon as any} size={14} color={isDarkBackground ? "#fff" : "#000"} />
    <Text style={[styles.buttonLabel, { color: isDarkBackground ? "#fff" : "#000" }]}>{label}</Text>
  </LiquidGlass>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

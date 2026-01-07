import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LiquidGlass } from '../LiquidGlass';

type Props = {
  onCapture: () => void;
  onSendPhoto: () => void;
  onDance: () => void;
};

export const ChatBottomActions: React.FC<Props> = ({
  onCapture,
  onSendPhoto,
  onDance,
}) => {
  return (
    <View style={styles.container}>
      <ActionButton icon="camera-outline" label="Capture" onPress={onCapture} />
      <ActionButton icon="heart-outline" label="Send photo" onPress={onSendPhoto} />
      <ActionButton icon="musical-notes-outline" label="Dance" onPress={onDance} />
    </View>
  );
};

const ActionButton: React.FC<{ icon: string; label: string; onPress: () => void }> = ({
  icon,
  label,
  onPress,
}) => (
  <LiquidGlass style={styles.button} onPress={onPress}>
    <Ionicons name={icon as any} size={14} color="#fff" />
    <Text style={styles.buttonLabel}>{label}</Text>
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

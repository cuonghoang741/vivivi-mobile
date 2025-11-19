import React, { useMemo } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { glassButtonStyle } from '../../styles/glass';
import { LiquidGlass } from '../LiquidGlass';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onToggleMic?: () => void;
  placeholder?: string;
  disabled?: boolean;
};

export const ChatInputBar: React.FC<Props> = ({
  value,
  onChangeText,
  onSend,
  onToggleMic,
  placeholder = 'Ask Anything',
  disabled,
}) => {
  const showSend = useMemo(() => value.trim().length > 0, [value]);

  const row = (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.6)"
        editable={!disabled}
        multiline
      />
      <Pressable
        style={({ pressed }) => [
          styles.iconButton,
          pressed && styles.iconPressed,
          disabled && styles.iconDisabled,
        ]}
        onPress={() => {
          if (disabled) return;
          if (showSend) {
            onSend();
          } else {
            onToggleMic?.();
          }
        }}
      >
        <Ionicons
          name={showSend ? 'paper-plane' : 'mic'}
          size={18}
          color="#fff"
        />
      </Pressable>
    </View>
  );

  return (
    <LiquidGlass style={styles.liquidGlass}>
      {row}
    </LiquidGlass>
  );
};

const styles = StyleSheet.create({
  liquidGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    ...glassButtonStyle,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    marginRight: 12,
    maxHeight: 90,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6EA1',
  },
  iconPressed: {
    opacity: 0.8,
  },
  iconDisabled: {
    opacity: 0.4,
  },
});


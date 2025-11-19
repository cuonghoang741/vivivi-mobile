import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChatQuickReply } from '../../types/chat';
import { glassButtonStyle } from '../../styles/glass';

type Props = {
  replies: ChatQuickReply[];
  onSelect: (id: string) => void;
};

export const QuickMessageChips: React.FC<Props> = ({ replies, onSelect }) => {
  if (!replies.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      {replies.map(reply => (
        <Pressable
          key={reply.id}
          onPress={() => onSelect(reply.id)}
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
        >
          <Text style={styles.chipText}>{reply.text}</Text>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    ...glassButtonStyle,
  },
  chipPressed: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  chipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});


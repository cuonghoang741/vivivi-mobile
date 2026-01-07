import React, { useMemo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, Animated } from 'react-native';
import {
  IconMicrophone,
  IconMicrophoneOff,
  IconVideo,
  IconVideoOff,
  IconSend,
} from '@tabler/icons-react-native';
import { glassButtonStyle } from '../../styles/glass';
import { LiquidGlass } from '../LiquidGlass';
import { isLiquidGlassSupported } from '@callstack/liquid-glass';
import Button from '../Button';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onToggleMic?: () => void;
  onVideoCall?: () => void;
  isVideoCallActive?: boolean;
  isMicMuted?: boolean;
  isUserSpeaking?: boolean;
  placeholder?: string;
  disabled?: boolean;
  voiceLoading?: boolean;
};

export const ChatInputBar: React.FC<Props> = ({
  value,
  onChangeText,
  onSend,
  onToggleMic,
  onVideoCall,
  isVideoCallActive = false,
  isMicMuted = false,
  isUserSpeaking = false,
  placeholder = 'Chat',
  disabled,
  voiceLoading,
}) => {
  const showSend = useMemo(() => value.trim().length > 0, [value]);

  // Pulsing animation for user speaking indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isUserSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isUserSpeaking, pulseAnim]);

  return (
    <View style={styles.container}>
      {/* Left side buttons */}
      <View style={styles.leftButtons}>
        {/* Mic Button with speaking indicator */}
        {onToggleMic && (
          <View style={styles.micButtonWrapper}>
            {isUserSpeaking && (
              <Animated.View
                style={[
                  styles.speakingIndicator,
                  { transform: [{ scale: pulseAnim }] }
                ]}
              />
            )}
            <Button
              variant="liquid"
              size="lg"
              isIconOnly
              onPress={onToggleMic}
              disabled={voiceLoading}
              startIcon={isMicMuted ? IconMicrophoneOff : IconMicrophone}
              iconColor={isUserSpeaking ? '#4ADE80' : '#FF6EA1'}
            />
          </View>
        )}

        {/* Video Call Button */}
        {onVideoCall && (
          <Button
            variant="liquid"
            size="lg"
            disabled={voiceLoading}
            isIconOnly
            onPress={onVideoCall}
            startIcon={isVideoCallActive ? IconVideoOff : IconVideo}
            iconColor={"#FF6EA1"}
          />
        )}
      </View>

      {/* Chat Input */}
      <LiquidGlass style={styles.liquidGlass}>
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
          {showSend && (
            <Pressable
              onPress={() => {
                if (disabled) return;
                onSend();
              }}
            >
              <IconSend width={20} height={20} color="#FF6EA1" />
            </Pressable>
          )}
        </View>
      </LiquidGlass>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leftButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  micButtonWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakingIndicator: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#4ADE80',
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  circleButtonMuted: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  circleButtonActive: {
    backgroundColor: '#FF6EA1',
  },
  liquidGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    ...glassButtonStyle,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minHeight: 44,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginRight: 12,
    maxHeight: 90,
    paddingVertical: 4, // Ensure text is breathable
  },
  sendButton: {
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

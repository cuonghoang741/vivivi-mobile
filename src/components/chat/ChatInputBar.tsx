import React, { useMemo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, Animated } from 'react-native';
import {
  IconMicrophone,
  IconMicrophoneOff,
  IconVideo,
  IconVideoOff,
  IconSend,
  IconPhoneOff,
  IconPhoneFilled,
  IconPlayerStopFilled,
  IconSend2,
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
  isVoiceCallActive?: boolean;
  isMicMuted?: boolean;
  isUserSpeaking?: boolean;
  placeholder?: string;
  disabled?: boolean;
  voiceLoading?: boolean;
  isDarkBackground?: boolean;
};

export const ChatInputBar: React.FC<Props> = ({
  value,
  onChangeText,
  onSend,
  onToggleMic,
  onVideoCall,
  isVideoCallActive = false,
  isVoiceCallActive = false,
  isMicMuted = false,
  isUserSpeaking = false,
  placeholder = 'Chat',
  disabled,
  voiceLoading,
  isDarkBackground = true,
}) => {
  const showSend = useMemo(() => value.trim().length > 0, [value]);
  const isCallActive = isVoiceCallActive || isVideoCallActive;
  const textColor = isDarkBackground ? '#fff' : '#000';
  const placeholderColor = isDarkBackground ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';

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
              startIcon={isMicMuted ? IconPlayerStopFilled : IconMicrophone}
              iconColor={isMicMuted ? '#FF6EA1' : textColor}
              isDarkBackground={isDarkBackground}
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
            iconColor={isVideoCallActive ? "#FF6EA1" : textColor}
            isDarkBackground={isDarkBackground}
          />
        )}
      </View>

      {/* Chat Input */}
      <LiquidGlass style={styles.liquidGlass} isDarkBackground={isDarkBackground}>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { color: textColor }]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={placeholderColor}
            editable={!disabled}
            returnKeyType="send"
            onSubmitEditing={onSend}
          />
          <View style={styles.rightActions}>
            {showSend && (
              <Pressable
                style={({ pressed }) => [
                  styles.sendButton,
                  pressed && styles.iconPressed,
                  disabled && styles.iconDisabled
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => {
                  if (disabled) return;
                  onSend();
                }}
              >
                <IconSend2 width={20} height={20} color={textColor} />
              </Pressable>
            )}

            {/* End Call Button (Red Phone Icon) */}
            {/* {!isCallActive && onToggleMic && (
              <Pressable
                style={({ pressed }) => [
                  pressed && styles.iconPressed,
                  disabled && styles.iconDisabled
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={onToggleMic} // Toggling mic during call ends it
              >
                <IconPhoneFilled width={24} height={24} color="#EF4444" />
              </Pressable>
            )} */}
          </View>
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
    paddingLeft: 16,
    paddingRight: 4,
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
    marginRight: 8,
    paddingVertical: 4,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCallButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444', // Red-500
  },
  iconPressed: {
    opacity: 0.8,
  },
  iconDisabled: {
    opacity: 0.4,
  },
});

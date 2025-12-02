import { useConversation, type ConversationStatus } from '@elevenlabs/react-native';
import { Buffer } from 'buffer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

if (!(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}

type VoiceConversationOptions = {
  onAgentResponse?: (text: string) => void;
  onUserTranscription?: (text: string) => void;
  onConnectionChange?: (connected: boolean) => void;
  onBootingChange?: (booting: boolean) => void;
  onAgentVolume?: (volume: number) => void;
  onError?: (message: string) => void;
};

export type StartVoiceConversationOptions = {
  agentId?: string;
  conversationToken?: string;
  tokenFetchUrl?: string;
  userId?: string;
};

export type VoiceConversationState = {
  status: ConversationStatus;
  isConnected: boolean;
  isBooting: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  agentVolume: number;
  callDurationSeconds: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const computeVolumeFromAudio = (audioBase64: string, previous: number) => {
  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    if (buffer.length < 2) {
      return previous * 0.9;
    }

    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const sampleCount = Math.floor(view.byteLength / 2);
    if (sampleCount === 0) {
      return previous * 0.9;
    }

    let sumSquares = 0;
    for (let i = 0; i < sampleCount; i += 1) {
      const sample = view.getInt16(i * 2, true) / 32768;
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / sampleCount);
    const normalized = clamp01(rms * 2);
    // Apply lightweight smoothing so the mouth animation doesn't jitter.
    return clamp01(previous * 0.7 + normalized * 0.3);
  } catch {
    return previous * 0.9;
  }
};

export const useVoiceConversation = (options: VoiceConversationOptions = {}) => {
  const callbacksRef = useRef(options);
  useEffect(() => {
    callbacksRef.current = options;
  }, [options]);

  const [connectionStatus, setConnectionStatus] = useState<ConversationStatus>('disconnected');
  const [isBooting, setIsBooting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [agentVolume, setAgentVolume] = useState(0);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);

  const callStartTimeRef = useRef<number | null>(null);
  const volumeRef = useRef(0);
  const prevConnectedRef = useRef(false);

  const updateBooting = useCallback(
    (next: boolean) => {
      setIsBooting(next);
      callbacksRef.current.onBootingChange?.(next);
    },
    []
  );

  // Memoize conversation callbacks to prevent recreation (like swift-version)
  const conversationCallbacks = useMemo(
    () => ({
      onMessage: ({ message, source }: { message: string; source: string }) => {
        if (!message?.trim()) {
          return;
        }
        if (source === 'ai') {
          callbacksRef.current.onAgentResponse?.(message);
        } else {
          callbacksRef.current.onUserTranscription?.(message);
        }
      },
      onStatusChange: ({ status }: { status: ConversationStatus }) => {
        setConnectionStatus(status);
        if (status === 'connected') {
          callStartTimeRef.current = Date.now();
          updateBooting(false);
        }
        if (status === 'disconnected') {
          callStartTimeRef.current = null;
          setCallDurationSeconds(0);
          setIsMuted(false);
          setAgentVolume(0);
        }
      },
      onModeChange: ({ mode }: { mode: string }) => {
        setIsSpeaking(mode === 'speaking');
      },
      onAudio: (chunk: string) => {
        volumeRef.current = computeVolumeFromAudio(chunk, volumeRef.current);
        setAgentVolume(volumeRef.current);
        callbacksRef.current.onAgentVolume?.(volumeRef.current);
      },
      onError: (message: string) => {
        updateBooting(false);
        callbacksRef.current.onError?.(
          typeof message === 'string' && message.length > 0
            ? message
            : 'Voice session error'
        );
      },
      onDisconnect: (details: { reason: string; message?: string }) => {
        setConnectionStatus('disconnected');
        updateBooting(false);
        if (details.reason === 'error') {
          callbacksRef.current.onError?.(details.message || 'Voice session disconnected');
        }
      },
    }),
    [updateBooting]
  );

  const conversation = useConversation(conversationCallbacks);

  useEffect(() => {
    const connected = connectionStatus === 'connected';
    if (prevConnectedRef.current !== connected) {
      prevConnectedRef.current = connected;
      callbacksRef.current.onConnectionChange?.(connected);
      if (!connected) {
        volumeRef.current = 0;
        setAgentVolume(0);
      }
    }
  }, [connectionStatus]);

  useEffect(() => {
    if (connectionStatus !== 'connected') {
      return;
    }
    const timer = setInterval(() => {
      if (callStartTimeRef.current) {
        const seconds = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
        setCallDurationSeconds(seconds);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [connectionStatus]);

  const startCall = useCallback(
    async ({
      agentId,
      conversationToken,
      tokenFetchUrl,
      userId,
    }: StartVoiceConversationOptions) => {
      if (!agentId && !conversationToken) {
        callbacksRef.current.onError?.('Không tìm thấy agent ElevenLabs để kết nối');
        return;
      }
      // Prevent starting if already connecting or connected (like swift-version)
      if (conversation.status === 'connecting' || conversation.status === 'connected') {
        return;
      }
      // Set booting state before starting (like swift-version)
      updateBooting(true);
      try {
        await conversation.startSession({
          agentId,
          conversationToken,
          tokenFetchUrl,
          userId,
        });
        // Note: booting will be set to false in onStatusChange when connected
      } catch (error) {
        updateBooting(false);
        callbacksRef.current.onError?.(
          error instanceof Error ? error.message : 'Không thể bắt đầu cuộc gọi voice'
        );
        throw error;
      }
    },
    [conversation, updateBooting]
  );

  const endCall = useCallback(async () => {
    updateBooting(false);
    try {
      await conversation.endSession('user');
    } catch (error) {
      callbacksRef.current.onError?.(
        error instanceof Error ? error.message : 'Không thể kết thúc cuộc gọi voice'
      );
    }
  }, [conversation, updateBooting]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    conversation.setMicMuted(next);
  }, [conversation, isMuted]);

  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      conversation.sendUserMessage(trimmed);
    },
    [conversation]
  );

  const voiceState: VoiceConversationState = useMemo(
    () => ({
      status: connectionStatus,
      isConnected: connectionStatus === 'connected',
      isBooting,
      isMuted,
      isSpeaking,
      agentVolume,
      callDurationSeconds,
    }),
    [agentVolume, callDurationSeconds, connectionStatus, isBooting, isMuted, isSpeaking]
  );

  return {
    state: voiceState,
    startCall,
    endCall,
    toggleMute,
    sendText,
  };
};



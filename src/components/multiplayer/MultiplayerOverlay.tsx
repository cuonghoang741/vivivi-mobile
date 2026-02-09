import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    FlatList,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Animated as RNAnimated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    IconSend,
    IconLogout,
    IconCopy,
    IconUsers,
} from '@tabler/icons-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInRight, FadeInUp } from 'react-native-reanimated';
import { useMultiplayer } from '../../context/RoomContext';
import { RoomMessage, RoomParticipant } from '../../services/MultiplayerService';

interface MultiplayerOverlayProps {
    onLeave: () => void;
    onActionReceived?: (action: string, parameters?: Record<string, any>) => void;
}

export const MultiplayerOverlay: React.FC<MultiplayerOverlayProps> = ({
    onLeave,
    onActionReceived,
}) => {
    const insets = useSafeAreaInsets();
    const {
        currentRoom,
        participants,
        messages,
        sendMessage,
        leaveRoom,
        isHost,
        endRoom,
    } = useMultiplayer();

    const [inputText, setInputText] = useState('');
    const [showChat, setShowChat] = useState(true);
    const flatListRef = useRef<FlatList>(null);
    const chatSlideAnim = useRef(new RNAnimated.Value(1)).current;

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (flatListRef.current && messages.length > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages.length]);

    // Animate chat visibility
    useEffect(() => {
        RNAnimated.spring(chatSlideAnim, {
            toValue: showChat ? 1 : 0,
            useNativeDriver: true,
            friction: 8,
        }).start();
    }, [showChat]);

    if (!currentRoom) return null;

    const handleSend = async () => {
        if (!inputText.trim()) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await sendMessage(inputText.trim());
        setInputText('');
    };

    const handleCopyCode = async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await Clipboard.setStringAsync(currentRoom.code);
    };

    const handleLeave = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (isHost) {
            await endRoom();
        } else {
            await leaveRoom();
        }
        onLeave();
    };

    const renderMessage = ({ item, index }: { item: RoomMessage; index: number }) => {
        const isSystem = item.message_type === 'system';
        const isAction = item.message_type === 'action';

        if (isAction) {
            try {
                const actionData = JSON.parse(item.content);
                onActionReceived?.(actionData.action, actionData.parameters);
            } catch { }
            return null;
        }

        return (
            <Animated.View
                entering={FadeInRight.delay(index * 30).springify()}
                style={[styles.messageBubble, isSystem && styles.systemMessage]}
            >
                {!isSystem && (
                    <Text style={styles.messageNickname}>
                        {item.nickname || 'User'}
                    </Text>
                )}
                <Text style={[styles.messageText, isSystem && styles.systemMessageText]}>
                    {item.content}
                </Text>
            </Animated.View>
        );
    };

    const renderParticipant = ({ item }: { item: RoomParticipant }) => (
        <View style={styles.participantAvatar}>
            <Text style={styles.participantInitial}>
                {(item.nickname || 'U').charAt(0).toUpperCase()}
            </Text>
        </View>
    );

    const chatTranslateY = chatSlideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [300, 0],
    });

    return (
        <View style={[styles.container, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            {/* Top Bar */}
            <Animated.View entering={FadeInUp} style={styles.topBar}>
                <BlurView intensity={30} tint="dark" style={styles.roomInfoBar}>
                    <View style={styles.roomInfo}>
                        <Pressable onPress={handleCopyCode} style={styles.codeContainer}>
                            <Text style={styles.roomCode}>{currentRoom.code}</Text>
                            <IconCopy size={14} color="rgba(255,255,255,0.6)" />
                        </Pressable>
                        <View style={styles.participantCount}>
                            <IconUsers size={14} color="#4ade80" />
                            <Text style={styles.participantCountText}>
                                {participants.length}/{currentRoom.max_participants}
                            </Text>
                        </View>
                    </View>

                    <Pressable onPress={handleLeave} style={styles.leaveButton}>
                        <IconLogout size={18} color="#ef4444" />
                        <Text style={styles.leaveText}>{isHost ? 'End' : 'Leave'}</Text>
                    </Pressable>
                </BlurView>
            </Animated.View>

            {/* Participants Row */}
            <Animated.View entering={FadeInUp.delay(100)} style={styles.participantsRow}>
                <FlatList
                    data={participants}
                    renderItem={renderParticipant}
                    keyExtractor={(item) => item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.participantsList}
                />
            </Animated.View>

            {/* Spacer */}
            <View style={{ flex: 1 }} pointerEvents="box-none" />

            {/* Chat Section */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                <RNAnimated.View
                    style={[
                        styles.chatContainer,
                        {
                            transform: [{ translateY: chatTranslateY }],
                            paddingBottom: insets.bottom + 8,
                        },
                    ]}
                >
                    <BlurView intensity={30} tint="dark" style={styles.chatBlur}>
                        {/* Messages */}
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            renderItem={renderMessage}
                            keyExtractor={(item) => item.id}
                            style={styles.messagesList}
                            contentContainerStyle={styles.messagesContent}
                            showsVerticalScrollIndicator={false}
                        />

                        {/* Input */}
                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.textInput}
                                value={inputText}
                                onChangeText={setInputText}
                                placeholder="Say something..."
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                returnKeyType="send"
                                onSubmitEditing={handleSend}
                            />
                            <Pressable
                                onPress={handleSend}
                                style={[
                                    styles.sendButton,
                                    !inputText.trim() && styles.sendButtonDisabled,
                                ]}
                                disabled={!inputText.trim()}
                            >
                                <IconSend size={18} color="#fff" />
                            </Pressable>
                        </View>
                    </BlurView>
                </RNAnimated.View>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
    },
    topBar: {
        paddingHorizontal: 16,
    },
    roomInfoBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    roomInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    codeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    roomCode: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 2,
    },
    participantCount: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    participantCountText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4ade80',
    },
    leaveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
    },
    leaveText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ef4444',
    },
    participantsRow: {
        paddingHorizontal: 16,
        marginTop: 12,
    },
    participantsList: {
        gap: 8,
    },
    participantAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    participantInitial: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    chatContainer: {
        marginHorizontal: 16,
        maxHeight: 280,
    },
    chatBlur: {
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    messagesList: {
        maxHeight: 180,
    },
    messagesContent: {
        padding: 12,
        gap: 8,
    },
    messageBubble: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        alignSelf: 'flex-start',
        maxWidth: '85%',
    },
    systemMessage: {
        backgroundColor: 'transparent',
        alignSelf: 'center',
    },
    messageNickname: {
        fontSize: 11,
        fontWeight: '600',
        color: '#ff6b9d',
        marginBottom: 2,
    },
    messageText: {
        fontSize: 14,
        color: '#fff',
        lineHeight: 18,
    },
    systemMessageText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        fontStyle: 'italic',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    textInput: {
        flex: 1,
        height: 42,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 21,
        paddingHorizontal: 16,
        fontSize: 15,
        color: '#fff',
    },
    sendButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#ff6b9d',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
});

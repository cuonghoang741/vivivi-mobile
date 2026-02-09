import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Pressable,
    Switch,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconX, IconUsers, IconLock, IconWorld } from '@tabler/icons-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useMultiplayer } from '../../context/RoomContext';
import { Room } from '../../services/MultiplayerService';

interface CreateRoomSheetProps {
    visible: boolean;
    characterId?: string;
    backgroundId?: string;
    onClose: () => void;
    onRoomCreated: (room: Room) => void;
}

export const CreateRoomSheet: React.FC<CreateRoomSheetProps> = ({
    visible,
    characterId,
    backgroundId,
    onClose,
    onRoomCreated,
}) => {
    const insets = useSafeAreaInsets();
    const { createRoom, isLoading } = useMultiplayer();

    const [roomName, setRoomName] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [maxParticipants, setMaxParticipants] = useState(4);

    if (!visible) return null;

    const handleClose = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
    };

    const handleCreate = async () => {
        if (!roomName.trim()) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const room = await createRoom(
            roomName.trim(),
            characterId,
            backgroundId,
            isPrivate
        );

        if (room) {
            onRoomCreated(room);
        }
    };

    const canCreate = roomName.trim().length > 0 && !isLoading;

    return (
        <View style={StyleSheet.absoluteFill}>
            {/* Backdrop */}
            <Animated.View
                entering={FadeIn}
                style={styles.backdrop}
            >
                <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
            </Animated.View>

            {/* Sheet */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <Animated.View
                    entering={SlideInDown.springify().damping(15)}
                    style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
                >
                    <BlurView intensity={40} tint="dark" style={styles.sheetBlur}>
                        {/* Handle */}
                        <View style={styles.handleContainer}>
                            <View style={styles.handle} />
                        </View>

                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.title}>Create Room</Text>
                            <Pressable onPress={handleClose} style={styles.closeButton}>
                                <IconX size={20} color="#fff" />
                            </Pressable>
                        </View>

                        {/* Form */}
                        <View style={styles.form}>
                            {/* Room Name */}
                            <View style={styles.field}>
                                <Text style={styles.label}>Room Name</Text>
                                <TextInput
                                    style={styles.input}
                                    value={roomName}
                                    onChangeText={setRoomName}
                                    placeholder="Enter room name..."
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    maxLength={50}
                                    autoFocus
                                />
                            </View>

                            {/* Privacy Toggle */}
                            <View style={styles.toggleField}>
                                <View style={styles.toggleInfo}>
                                    {isPrivate ? (
                                        <IconLock size={20} color="#ff6b9d" />
                                    ) : (
                                        <IconWorld size={20} color="#4ade80" />
                                    )}
                                    <View>
                                        <Text style={styles.toggleLabel}>Private Room</Text>
                                        <Text style={styles.toggleHint}>
                                            {isPrivate
                                                ? 'Only people with the code can join'
                                                : 'Anyone can find and join'}
                                        </Text>
                                    </View>
                                </View>
                                <Switch
                                    value={isPrivate}
                                    onValueChange={setIsPrivate}
                                    trackColor={{ false: '#333', true: '#ff6b9d' }}
                                    thumbColor="#fff"
                                />
                            </View>

                            {/* Max Participants */}
                            <View style={styles.field}>
                                <Text style={styles.label}>Max Participants</Text>
                                <View style={styles.buttonRow}>
                                    {[2, 3, 4].map((num) => (
                                        <Pressable
                                            key={num}
                                            style={[
                                                styles.participantButton,
                                                maxParticipants === num && styles.participantButtonActive,
                                            ]}
                                            onPress={() => setMaxParticipants(num)}
                                        >
                                            <IconUsers
                                                size={16}
                                                color={maxParticipants === num ? '#fff' : 'rgba(255,255,255,0.5)'}
                                            />
                                            <Text
                                                style={[
                                                    styles.participantButtonText,
                                                    maxParticipants === num && styles.participantButtonTextActive,
                                                ]}
                                            >
                                                {num}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        </View>

                        {/* Create Button */}
                        <Pressable
                            onPress={handleCreate}
                            disabled={!canCreate}
                            style={{ opacity: canCreate ? 1 : 0.5 }}
                        >
                            <LinearGradient
                                colors={['#ff6b9d', '#c44569']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.createButton}
                            >
                                <Text style={styles.createButtonText}>
                                    {isLoading ? 'Creating...' : 'Create Room'}
                                </Text>
                            </LinearGradient>
                        </Pressable>
                    </BlurView>
                </Animated.View>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    sheetBlur: {
        padding: 20,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderBottomWidth: 0,
    },
    handleContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    form: {
        gap: 20,
        marginBottom: 24,
    },
    field: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
    },
    input: {
        height: 52,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 14,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#fff',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    toggleField: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 14,
        padding: 16,
    },
    toggleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    toggleLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    toggleHint: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    participantButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 48,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    participantButtonActive: {
        backgroundColor: '#ff6b9d',
        borderColor: '#ff6b9d',
    },
    participantButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.5)',
    },
    participantButtonTextActive: {
        color: '#fff',
    },
    createButton: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    createButtonText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#fff',
    },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    FlatList,
    Pressable,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    IconArrowLeft,
    IconPlus,
    IconUsers,
    IconLock,
    IconWorld,
} from '@tabler/icons-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useMultiplayer } from '../../context/RoomContext';
import { Room } from '../../services/MultiplayerService';

interface RoomLobbyProps {
    onBack: () => void;
    onCreateRoom: () => void;
    onJoinRoom: (room: Room) => void;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({
    onBack,
    onCreateRoom,
    onJoinRoom,
}) => {
    const insets = useSafeAreaInsets();
    const { joinRoom, listPublicRooms, isLoading, error } = useMultiplayer();

    const [joinCode, setJoinCode] = useState('');
    const [publicRooms, setPublicRooms] = useState<Room[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Load public rooms on mount
    useEffect(() => {
        loadRooms();
    }, []);

    const loadRooms = async () => {
        const rooms = await listPublicRooms();
        setPublicRooms(rooms);
    };

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await loadRooms();
        setIsRefreshing(false);
    }, []);

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onBack();
    };

    const handleJoinByCode = async () => {
        if (joinCode.length !== 6) {
            Alert.alert('Invalid Code', 'Please enter a 6-character room code.');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const room = await joinRoom(joinCode.toUpperCase());

        if (room) {
            onJoinRoom(room);
        } else {
            Alert.alert('Unable to Join', 'Room not found or is full.');
        }
    };

    const handleJoinPublicRoom = async (room: Room) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const joinedRoom = await joinRoom(room.code);

        if (joinedRoom) {
            onJoinRoom(joinedRoom);
        } else {
            Alert.alert('Unable to Join', 'Room is full or no longer available.');
        }
    };

    const handleCreateRoom = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onCreateRoom();
    };

    const renderRoomItem = ({ item, index }: { item: Room; index: number }) => (
        <Animated.View entering={FadeInUp.delay(100 + index * 50)}>
            <Pressable
                style={styles.roomCard}
                onPress={() => handleJoinPublicRoom(item)}
            >
                <BlurView intensity={15} tint="dark" style={styles.roomCardBlur}>
                    <View style={styles.roomCardContent}>
                        <View style={styles.roomInfo}>
                            <View style={styles.roomHeader}>
                                {item.is_private ? (
                                    <IconLock size={16} color="#888" />
                                ) : (
                                    <IconWorld size={16} color="#4ade80" />
                                )}
                                <Text style={styles.roomName}>{item.name}</Text>
                            </View>
                            <Text style={styles.roomCode}>Code: {item.code}</Text>
                        </View>
                        <View style={styles.participantsBadge}>
                            <IconUsers size={14} color="#fff" />
                            <Text style={styles.participantsText}>
                                ?/{item.max_participants}
                            </Text>
                        </View>
                    </View>
                </BlurView>
            </Pressable>
        </Animated.View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Background */}
            <LinearGradient
                colors={['#0a0a0f', '#1a1a2e', '#16213e']}
                style={StyleSheet.absoluteFill}
            />

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={handleBack} style={styles.backButton}>
                    <IconArrowLeft size={24} color="#fff" />
                </Pressable>
                <Text style={styles.title}>Rooms</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Join by Code Section */}
            <Animated.View entering={FadeInUp.delay(100)} style={styles.section}>
                <BlurView intensity={20} tint="dark" style={styles.joinCodeCard}>
                    <Text style={styles.sectionTitle}>🔑 Join with Code</Text>
                    <View style={styles.codeInputRow}>
                        <TextInput
                            style={styles.codeInput}
                            value={joinCode}
                            onChangeText={(text) => setJoinCode(text.toUpperCase().slice(0, 6))}
                            placeholder="ABCD12"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            autoCapitalize="characters"
                            maxLength={6}
                        />
                        <Pressable
                            style={[
                                styles.joinButton,
                                joinCode.length !== 6 && styles.joinButtonDisabled,
                            ]}
                            onPress={handleJoinByCode}
                            disabled={joinCode.length !== 6 || isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.joinButtonText}>JOIN</Text>
                            )}
                        </Pressable>
                    </View>
                </BlurView>
            </Animated.View>

            {/* Create Room Button */}
            <Animated.View entering={FadeInUp.delay(200)} style={styles.section}>
                <Pressable onPress={handleCreateRoom}>
                    <LinearGradient
                        colors={['#ff6b9d', '#c44569']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.createButton}
                    >
                        <IconPlus size={20} color="#fff" />
                        <Text style={styles.createButtonText}>Create New Room</Text>
                    </LinearGradient>
                </Pressable>
            </Animated.View>

            {/* Divider */}
            <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>PUBLIC ROOMS</Text>
                <View style={styles.dividerLine} />
            </View>

            {/* Public Rooms List */}
            <FlatList
                data={publicRooms}
                renderItem={renderRoomItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.roomsList}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor="#ff6b9d"
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>
                            No public rooms available.{'\n'}Be the first to create one!
                        </Text>
                    </View>
                }
            />

            {/* Error Toast */}
            {error && (
                <View style={styles.errorToast}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    section: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    joinCodeCard: {
        borderRadius: 16,
        padding: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 12,
    },
    codeInputRow: {
        flexDirection: 'row',
        gap: 12,
    },
    codeInput: {
        flex: 1,
        height: 48,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 4,
        textAlign: 'center',
    },
    joinButton: {
        height: 48,
        paddingHorizontal: 24,
        backgroundColor: '#4ade80',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    joinButtonDisabled: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    joinButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    createButton: {
        flexDirection: 'row',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    createButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginVertical: 16,
        gap: 12,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    dividerText: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: 1,
    },
    roomsList: {
        paddingHorizontal: 16,
        paddingBottom: 100,
    },
    roomCard: {
        marginBottom: 12,
        borderRadius: 16,
        overflow: 'hidden',
    },
    roomCardBlur: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        overflow: 'hidden',
    },
    roomCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    roomInfo: {
        flex: 1,
    },
    roomHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    roomName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    roomCode: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
    },
    participantsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
    },
    participantsText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
    emptyState: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        lineHeight: 22,
    },
    errorToast: {
        position: 'absolute',
        bottom: 100,
        left: 16,
        right: 16,
        backgroundColor: '#ef4444',
        borderRadius: 12,
        padding: 16,
    },
    errorText: {
        fontSize: 14,
        color: '#fff',
        textAlign: 'center',
    },
});

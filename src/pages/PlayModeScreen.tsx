import React, { useState, useCallback } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PlayModeSelector } from '../components/multiplayer/PlayModeSelector';
import { RoomLobby } from '../components/multiplayer/RoomLobby';
import { CreateRoomSheet } from '../components/multiplayer/CreateRoomSheet';
import { useMultiplayer } from '../context/RoomContext';
import { Room } from '../services/MultiplayerService';

type RootStackParamList = {
    Experience: undefined;
    MultiplayerExperience: { roomId: string };
    PlayModeSelect: undefined;
};

type PlayModeScreenProps = {
    onSoloSelected?: () => void;
};

export const PlayModeScreen: React.FC<PlayModeScreenProps> = ({ onSoloSelected }) => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const insets = useSafeAreaInsets();
    const { currentRoom } = useMultiplayer();

    const [view, setView] = useState<'select' | 'lobby'>('select');
    const [showCreateSheet, setShowCreateSheet] = useState(false);

    const handleSelectSolo = useCallback(() => {
        if (onSoloSelected) {
            onSoloSelected();
        } else {
            navigation.navigate('Experience');
        }
    }, [navigation, onSoloSelected]);

    const handleSelectMultiplayer = useCallback(() => {
        setView('lobby');
    }, []);

    const handleBackToSelect = useCallback(() => {
        setView('select');
    }, []);

    const handleCreateRoom = useCallback(() => {
        setShowCreateSheet(true);
    }, []);

    const handleRoomCreated = useCallback((room: Room) => {
        setShowCreateSheet(false);
        // Navigate to multiplayer experience with the room
        navigation.navigate('MultiplayerExperience' as any, { roomId: room.id });
    }, [navigation]);

    const handleJoinRoom = useCallback((room: Room) => {
        // Navigate to multiplayer experience with the room
        navigation.navigate('MultiplayerExperience' as any, { roomId: room.id });
    }, [navigation]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={['#0a0a0f', '#1a1a2e', '#16213e']}
                style={StyleSheet.absoluteFill}
            />

            {view === 'select' ? (
                <PlayModeSelector
                    onSelectSolo={handleSelectSolo}
                    onSelectMultiplayer={handleSelectMultiplayer}
                />
            ) : (
                <RoomLobby
                    onBack={handleBackToSelect}
                    onCreateRoom={handleCreateRoom}
                    onJoinRoom={handleJoinRoom}
                />
            )}

            <CreateRoomSheet
                visible={showCreateSheet}
                onClose={() => setShowCreateSheet(false)}
                onRoomCreated={handleRoomCreated}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0f',
    },
});

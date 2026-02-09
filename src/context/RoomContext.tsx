import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { multiplayerService, Room, RoomParticipant, RoomMessage, RoomEvent } from '../services/MultiplayerService';

// MARK: - Types
interface RoomState {
    currentRoom: Room | null;
    participants: RoomParticipant[];
    messages: RoomMessage[];
    isLoading: boolean;
    error: string | null;
    isHost: boolean;
}

interface RoomContextType extends RoomState {
    createRoom: (name: string, characterId?: string, backgroundId?: string, isPrivate?: boolean) => Promise<Room | null>;
    joinRoom: (code: string) => Promise<Room | null>;
    leaveRoom: () => Promise<void>;
    endRoom: () => Promise<void>;
    sendMessage: (content: string) => Promise<void>;
    syncAction: (action: string, parameters?: Record<string, any>) => Promise<void>;
    refreshParticipants: () => Promise<void>;
    listPublicRooms: () => Promise<Room[]>;
}

const RoomContext = createContext<RoomContextType | null>(null);

// MARK: - Provider
export const RoomProvider: React.FC<{ children: React.ReactNode; userId: string | null }> = ({
    children,
    userId
}) => {
    const [state, setState] = useState<RoomState>({
        currentRoom: null,
        participants: [],
        messages: [],
        isLoading: false,
        error: null,
        isHost: false,
    });

    const eventHandlerRef = useRef<(event: RoomEvent) => void>();

    // Event handler for realtime updates
    useEffect(() => {
        eventHandlerRef.current = (event: RoomEvent) => {
            console.log('[RoomContext] Event received:', event.type);

            switch (event.type) {
                case 'participant_joined':
                    setState((prev) => ({
                        ...prev,
                        participants: [...prev.participants.filter(p => p.id !== event.data.id), event.data],
                    }));
                    break;

                case 'participant_left':
                    setState((prev) => ({
                        ...prev,
                        participants: prev.participants.filter((p) => p.id !== event.data.id),
                    }));
                    break;

                case 'message':
                    setState((prev) => ({
                        ...prev,
                        messages: [...prev.messages, event.data],
                    }));
                    break;

                case 'action':
                    // Actions are forwarded to listeners via a separate mechanism
                    // (e.g., custom event emitter or callback props)
                    console.log('[RoomContext] Action synced:', event.data);
                    break;

                case 'room_ended':
                    setState((prev) => ({
                        ...prev,
                        currentRoom: null,
                        participants: [],
                        messages: [],
                        error: 'Room has ended',
                    }));
                    break;
            }
        };
    }, []);

    // MARK: - Create Room
    const createRoom = useCallback(async (
        name: string,
        characterId?: string,
        backgroundId?: string,
        isPrivate: boolean = false
    ): Promise<Room | null> => {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        try {
            const room = await multiplayerService.createRoom(name, characterId || null, backgroundId || null, isPrivate);

            if (room) {
                // Subscribe to room events
                multiplayerService.subscribeToRoom(room.id, (event) => {
                    eventHandlerRef.current?.(event);
                });

                // Get initial participants
                const participants = await multiplayerService.getRoomParticipants(room.id);

                setState((prev) => ({
                    ...prev,
                    currentRoom: room,
                    participants,
                    messages: [],
                    isLoading: false,
                    isHost: true,
                }));

                return room;
            }

            setState((prev) => ({ ...prev, isLoading: false, error: 'Failed to create room' }));
            return null;
        } catch (error) {
            console.error('[RoomContext] Error creating room:', error);
            setState((prev) => ({ ...prev, isLoading: false, error: String(error) }));
            return null;
        }
    }, []);

    // MARK: - Join Room
    const joinRoom = useCallback(async (code: string): Promise<Room | null> => {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        try {
            const room = await multiplayerService.joinRoomByCode(code);

            if (room) {
                // Subscribe to room events
                multiplayerService.subscribeToRoom(room.id, (event) => {
                    eventHandlerRef.current?.(event);
                });

                // Get initial data
                const [participants, messages] = await Promise.all([
                    multiplayerService.getRoomParticipants(room.id),
                    multiplayerService.getRoomMessages(room.id),
                ]);

                setState((prev) => ({
                    ...prev,
                    currentRoom: room,
                    participants,
                    messages,
                    isLoading: false,
                    isHost: room.host_user_id === userId,
                }));

                return room;
            }

            setState((prev) => ({ ...prev, isLoading: false, error: 'Room not found or full' }));
            return null;
        } catch (error) {
            console.error('[RoomContext] Error joining room:', error);
            setState((prev) => ({ ...prev, isLoading: false, error: String(error) }));
            return null;
        }
    }, [userId]);

    // MARK: - Leave Room
    const leaveRoom = useCallback(async (): Promise<void> => {
        await multiplayerService.leaveRoom();
        setState({
            currentRoom: null,
            participants: [],
            messages: [],
            isLoading: false,
            error: null,
            isHost: false,
        });
    }, []);

    // MARK: - End Room
    const endRoom = useCallback(async (): Promise<void> => {
        await multiplayerService.endRoom();
        setState({
            currentRoom: null,
            participants: [],
            messages: [],
            isLoading: false,
            error: null,
            isHost: false,
        });
    }, []);

    // MARK: - Send Message
    const sendMessage = useCallback(async (content: string): Promise<void> => {
        await multiplayerService.sendMessage(content, 'text');
    }, []);

    // MARK: - Sync Action
    const syncAction = useCallback(async (action: string, parameters?: Record<string, any>): Promise<void> => {
        await multiplayerService.syncAction(action, parameters);
    }, []);

    // MARK: - Refresh Participants
    const refreshParticipants = useCallback(async (): Promise<void> => {
        if (!state.currentRoom) return;
        const participants = await multiplayerService.getRoomParticipants(state.currentRoom.id);
        setState((prev) => ({ ...prev, participants }));
    }, [state.currentRoom]);

    // MARK: - List Public Rooms
    const listPublicRooms = useCallback(async (): Promise<Room[]> => {
        return multiplayerService.listActiveRooms();
    }, []);

    const value: RoomContextType = {
        ...state,
        createRoom,
        joinRoom,
        leaveRoom,
        endRoom,
        sendMessage,
        syncAction,
        refreshParticipants,
        listPublicRooms,
    };

    return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};

// MARK: - Hook
export const useRoom = (): RoomContextType => {
    const context = useContext(RoomContext);
    if (!context) {
        throw new Error('useRoom must be used within a RoomProvider');
    }
    return context;
};

// MARK: - Convenience Hook
export const useMultiplayer = () => {
    const room = useRoom();

    const isInRoom = !!room.currentRoom;
    const roomCode = room.currentRoom?.code || null;
    const participantCount = room.participants.length;
    const maxParticipants = room.currentRoom?.max_participants || 4;

    return {
        ...room,
        isInRoom,
        roomCode,
        participantCount,
        maxParticipants,
    };
};

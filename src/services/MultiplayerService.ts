import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// MARK: - Types
export interface Room {
    id: string;
    code: string;
    name: string;
    host_user_id: string;
    character_id: string | null;
    background_id: string | null;
    max_participants: number;
    is_private: boolean;
    status: 'active' | 'ended';
    created_at: string;
    ended_at: string | null;
}

export interface RoomParticipant {
    id: string;
    room_id: string;
    user_id: string;
    nickname: string | null;
    avatar_url: string | null;
    joined_at: string;
    left_at: string | null;
    is_active: boolean;
}

export interface RoomMessage {
    id: string;
    room_id: string;
    user_id: string | null;
    message_type: 'text' | 'action' | 'system';
    content: string;
    created_at: string;
    // Joined data
    nickname?: string;
}

export type RoomEventType = 'participant_joined' | 'participant_left' | 'message' | 'room_ended' | 'action';

export interface RoomEvent {
    type: RoomEventType;
    data: any;
}

// MARK: - Multiplayer Service
class MultiplayerService {
    private currentRoomId: string | null = null;
    private realtimeChannel: RealtimeChannel | null = null;
    private eventListeners: ((event: RoomEvent) => void)[] = [];

    // MARK: - Room Code Generation
    private generateRoomCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // MARK: - Create Room
    async createRoom(
        name: string,
        characterId: string | null = null,
        backgroundId: string | null = null,
        isPrivate: boolean = false,
        maxParticipants: number = 4
    ): Promise<Room | null> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.error('[MultiplayerService] No authenticated user');
                return null;
            }

            // Generate unique code with retry
            let code = this.generateRoomCode();
            let attempts = 0;
            const maxAttempts = 5;

            while (attempts < maxAttempts) {
                const { data, error } = await supabase
                    .from('rooms')
                    .insert({
                        code,
                        name,
                        host_user_id: user.id,
                        character_id: characterId,
                        background_id: backgroundId,
                        is_private: isPrivate,
                        max_participants: maxParticipants,
                        status: 'active',
                    })
                    .select()
                    .single();

                if (error) {
                    if (error.code === '23505') {
                        // Unique constraint violation, try new code
                        code = this.generateRoomCode();
                        attempts++;
                        continue;
                    }
                    console.error('[MultiplayerService] Failed to create room:', error);
                    return null;
                }

                // Auto-join as host
                await this.joinRoom(data.id, user.id);
                this.currentRoomId = data.id;

                console.log('[MultiplayerService] Room created:', data.code);
                return data as Room;
            }

            console.error('[MultiplayerService] Failed to generate unique room code');
            return null;
        } catch (error) {
            console.error('[MultiplayerService] Error creating room:', error);
            return null;
        }
    }

    // MARK: - Join Room by Code
    async joinRoomByCode(code: string): Promise<Room | null> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.error('[MultiplayerService] No authenticated user');
                return null;
            }

            // Find room by code
            const { data: room, error: findError } = await supabase
                .from('rooms')
                .select('*')
                .eq('code', code.toUpperCase())
                .eq('status', 'active')
                .single();

            if (findError || !room) {
                console.error('[MultiplayerService] Room not found:', code);
                return null;
            }

            // Check participant count
            const { count } = await supabase
                .from('room_participants')
                .select('*', { count: 'exact', head: true })
                .eq('room_id', room.id)
                .eq('is_active', true);

            if (count && count >= room.max_participants) {
                console.error('[MultiplayerService] Room is full');
                return null;
            }

            // Join the room
            await this.joinRoom(room.id, user.id);
            this.currentRoomId = room.id;

            console.log('[MultiplayerService] Joined room:', room.code);
            return room as Room;
        } catch (error) {
            console.error('[MultiplayerService] Error joining room:', error);
            return null;
        }
    }

    // MARK: - Join Room (Internal)
    private async joinRoom(roomId: string, userId: string): Promise<void> {
        // Check if already a participant
        const { data: existing } = await supabase
            .from('room_participants')
            .select('id, is_active')
            .eq('room_id', roomId)
            .eq('user_id', userId)
            .single();

        if (existing) {
            if (!existing.is_active) {
                // Reactivate
                await supabase
                    .from('room_participants')
                    .update({ is_active: true, left_at: null, joined_at: new Date().toISOString() })
                    .eq('id', existing.id);
            }
            return;
        }

        // Add as new participant
        await supabase
            .from('room_participants')
            .insert({
                room_id: roomId,
                user_id: userId,
                is_active: true,
            });
    }

    // MARK: - Leave Room
    async leaveRoom(): Promise<void> {
        if (!this.currentRoomId) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Mark as left
            await supabase
                .from('room_participants')
                .update({
                    is_active: false,
                    left_at: new Date().toISOString(),
                })
                .eq('room_id', this.currentRoomId)
                .eq('user_id', user.id);

            // Unsubscribe from realtime
            this.unsubscribe();

            console.log('[MultiplayerService] Left room');
            this.currentRoomId = null;
        } catch (error) {
            console.error('[MultiplayerService] Error leaving room:', error);
        }
    }

    // MARK: - End Room (Host only)
    async endRoom(): Promise<void> {
        if (!this.currentRoomId) return;

        try {
            await supabase
                .from('rooms')
                .update({
                    status: 'ended',
                    ended_at: new Date().toISOString(),
                })
                .eq('id', this.currentRoomId);

            this.unsubscribe();
            this.currentRoomId = null;

            console.log('[MultiplayerService] Room ended');
        } catch (error) {
            console.error('[MultiplayerService] Error ending room:', error);
        }
    }

    // MARK: - List Active Public Rooms
    async listActiveRooms(): Promise<Room[]> {
        try {
            const { data, error } = await supabase
                .from('rooms')
                .select('*')
                .eq('status', 'active')
                .eq('is_private', false)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('[MultiplayerService] Error listing rooms:', error);
                return [];
            }

            return data as Room[];
        } catch (error) {
            console.error('[MultiplayerService] Error listing rooms:', error);
            return [];
        }
    }

    // MARK: - Get Room Participants
    async getRoomParticipants(roomId: string): Promise<RoomParticipant[]> {
        try {
            const { data, error } = await supabase
                .from('room_participants')
                .select('*')
                .eq('room_id', roomId)
                .eq('is_active', true);

            if (error) {
                console.error('[MultiplayerService] Error getting participants:', error);
                return [];
            }

            return data as RoomParticipant[];
        } catch (error) {
            console.error('[MultiplayerService] Error getting participants:', error);
            return [];
        }
    }

    // MARK: - Send Message
    async sendMessage(content: string, messageType: 'text' | 'action' | 'system' = 'text'): Promise<void> {
        if (!this.currentRoomId) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();

            await supabase.from('room_messages').insert({
                room_id: this.currentRoomId,
                user_id: user?.id,
                message_type: messageType,
                content,
            });
        } catch (error) {
            console.error('[MultiplayerService] Error sending message:', error);
        }
    }

    // MARK: - Sync Action (dance, animation, etc.)
    async syncAction(action: string, parameters?: Record<string, any>): Promise<void> {
        const content = JSON.stringify({ action, parameters });
        await this.sendMessage(content, 'action');
    }

    // MARK: - Subscribe to Room Updates
    subscribeToRoom(roomId: string, onEvent: (event: RoomEvent) => void): void {
        this.eventListeners.push(onEvent);

        if (this.realtimeChannel) {
            this.realtimeChannel.unsubscribe();
        }

        this.realtimeChannel = supabase
            .channel(`room:${roomId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'room_participants',
                    filter: `room_id=eq.${roomId}`,
                },
                (payload) => {
                    this.notifyListeners({ type: 'participant_joined', data: payload.new });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'room_participants',
                    filter: `room_id=eq.${roomId}`,
                },
                (payload) => {
                    if (!(payload.new as RoomParticipant).is_active) {
                        this.notifyListeners({ type: 'participant_left', data: payload.new });
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'room_messages',
                    filter: `room_id=eq.${roomId}`,
                },
                (payload) => {
                    const message = payload.new as RoomMessage;
                    if (message.message_type === 'action') {
                        this.notifyListeners({ type: 'action', data: JSON.parse(message.content) });
                    } else {
                        this.notifyListeners({ type: 'message', data: message });
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'rooms',
                    filter: `id=eq.${roomId}`,
                },
                (payload) => {
                    if ((payload.new as Room).status === 'ended') {
                        this.notifyListeners({ type: 'room_ended', data: payload.new });
                    }
                }
            )
            .subscribe();

        console.log('[MultiplayerService] Subscribed to room:', roomId);
    }

    // MARK: - Unsubscribe
    private unsubscribe(): void {
        if (this.realtimeChannel) {
            this.realtimeChannel.unsubscribe();
            this.realtimeChannel = null;
        }
        this.eventListeners = [];
    }

    // MARK: - Notify Listeners
    private notifyListeners(event: RoomEvent): void {
        this.eventListeners.forEach((listener) => listener(event));
    }

    // MARK: - Get Current Room
    getCurrentRoom(): string | null {
        return this.currentRoomId;
    }

    // MARK: - Get Room Messages History
    async getRoomMessages(roomId: string, limit: number = 50): Promise<RoomMessage[]> {
        try {
            const { data, error } = await supabase
                .from('room_messages')
                .select('*')
                .eq('room_id', roomId)
                .order('created_at', { ascending: true })
                .limit(limit);

            if (error) {
                console.error('[MultiplayerService] Error getting messages:', error);
                return [];
            }

            return data as RoomMessage[];
        } catch (error) {
            console.error('[MultiplayerService] Error getting messages:', error);
            return [];
        }
    }
}

export const multiplayerService = new MultiplayerService();

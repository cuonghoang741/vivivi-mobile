import { ChatMessage } from '../types/chat';
import { MediaItem } from '../repositories/MediaRepository';
import { getSupabaseClient, getAuthenticatedUserId } from './supabase';
import { telegramNotificationService } from './TelegramNotificationService';
import { getTelegramUserInfo } from '../utils/telegramUserHelper';
import { analyticsService } from './AnalyticsService';

type ConversationRow = {
  id: string;
  message: string;
  is_agent: boolean;
  created_at: string;
  media_id?: string;
  medias?: MediaItem | null; // Joined media data
};

type HistoryPart = {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
};

class ChatService {
  private client = getSupabaseClient();

  async fetchRecentConversation(characterId: string, limit = 5): Promise<ChatMessage[]> {
    if (!characterId) {
      return [];
    }
    const userId = await getAuthenticatedUserId();

    let query = this.client
      .from('conversation')
      .select('id,message,is_agent,created_at,media_id,medias(*)')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false })
      .limit(limit);

    query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error || !data) {
      throw new Error(error?.message || 'Failed to load conversation');
    }

    return (data as any).map(mapRowToMessage).reverse();
  }

  async persistConversationMessage(params: {
    text: string;
    isAgent: boolean;
    characterId: string;
    mediaId?: string;
  }) {
    if (!params.characterId || !params.text.trim()) return;

    const userId = await getAuthenticatedUserId();
    const payload: Record<string, any> = {
      message: params.text,
      is_agent: params.isAgent,
      character_id: params.characterId,
      user_id: userId,
    };

    if (params.mediaId) {
      payload.media_id = params.mediaId;
    }

    const { error } = await this.client.from('conversation').insert(payload);
    if (error) {
      console.warn('[ChatService] Failed to persist conversation', error);
    }
  }

  async sendMessageToGemini(params: {
    text: string;
    characterId: string;
    characterName: string;
    history: ChatMessage[];
  }): Promise<string> {
    if (!params.text.trim() || !params.characterId) {
      throw new Error('Missing message or character id');
    }

    const userId = await getAuthenticatedUserId();
    const conversation_history = buildHistoryPayload(params.history);

    // Send Telegram notification for user chat message (fire-and-forget)
    getTelegramUserInfo().then(userInfo => {
      telegramNotificationService.notifyChatMessage(
        userInfo,
        params.characterName,
        params.text
      );
    }).catch(err => console.warn('[ChatService] Failed to send Telegram notification:', err));

    // Track send message analytics
    analyticsService.logSendMessage(params.characterId, params.text.length);

    const { data, error } = await this.client.functions.invoke('gemini-chat', {
      body: {
        message: params.text,
        character_id: params.characterId,
        conversation_history,
        user_id: userId,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    const responseText = (data as any)?.response;
    if (typeof responseText !== 'string' || !responseText.trim()) {
      throw new Error('Empty response from Gemini');
    }

    // Send Telegram notification for AI response
    getTelegramUserInfo().then(userInfo => {
      telegramNotificationService.notifyAIResponse(
        userInfo,
        params.characterName,
        responseText
      );
    }).catch(err => console.warn('[ChatService] Failed to send Telegram notification for AI response:', err));

    return responseText;
  }

  async fetchConversationHistory(
    characterId: string,
    { limit = 20, cursor }: { limit?: number; cursor?: string }
  ): Promise<{ messages: ChatMessage[]; reachedEnd: boolean }> {
    if (!characterId) {
      return { messages: [], reachedEnd: true };
    }

    const userId = await getAuthenticatedUserId();

    let query = this.client
      .from('conversation')
      .select('id,message,is_agent,created_at,media_id,medias(*)')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error || !data) {
      throw new Error(error?.message || 'Failed to load conversation history');
    }

    const messagesDesc = (data as any).map(mapRowToMessage);
    const batch = messagesDesc.reverse();
    return {
      messages: batch,
      reachedEnd: batch.length < limit,
    };
  }
}

const mapRowToMessage = (row: ConversationRow): ChatMessage => {
  // If user has media_id and media details are fetched
  if (row.media_id && row.medias) {
    return {
      id: row.id,
      kind: { type: 'media', mediaItem: row.medias },
      isAgent: row.is_agent,
      createdAt: row.created_at,
    };
  }

  // Fallback to text
  return {
    id: row.id,
    kind: { type: 'text', text: row.message },
    isAgent: row.is_agent,
    createdAt: row.created_at,
  };
};

const buildHistoryPayload = (messages: ChatMessage[]): HistoryPart[] => {
  const recent = messages.slice(-10);
  return recent
    .filter(msg => msg.kind.type === 'text')
    .map(msg => ({
      role: msg.isAgent ? 'model' : 'user',
      parts: [{ text: msg.kind.type === 'text' ? msg.kind.text : '' }],
    }));
};

export const chatService = new ChatService();


import { ChatMessage } from '../types/chat';
import { getSupabaseClient, getAuthIdentifier } from './supabase';

type ConversationRow = {
  id: string;
  message: string;
  is_agent: boolean;
  created_at: string;
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
    const { userId, clientId } = await getAuthIdentifier();

    let query = this.client
      .from('conversation')
      .select('id,message,is_agent,created_at')
      .eq('character_id', characterId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;
    if (error || !data) {
      throw new Error(error?.message || 'Failed to load conversation');
    }

    return data.map(mapRowToMessage);
  }

  async persistConversationMessage(params: { text: string; isAgent: boolean; characterId: string }) {
    if (!params.characterId || !params.text.trim()) return;

    const { userId, clientId } = await getAuthIdentifier();
    const payload: Record<string, any> = {
      message: params.text,
      is_agent: params.isAgent,
      character_id: params.characterId,
    };
    if (userId) payload.user_id = userId;
    if (clientId) payload.client_id = clientId;

    const { error } = await this.client.from('conversation').insert(payload);
    if (error) {
      console.warn('[ChatService] Failed to persist conversation', error);
    }
  }

  async sendMessageToGemini(params: {
    text: string;
    characterId: string;
    history: ChatMessage[];
  }): Promise<string> {
    if (!params.text.trim() || !params.characterId) {
      throw new Error('Missing message or character id');
    }

    const { userId, clientId } = await getAuthIdentifier();
    const conversation_history = buildHistoryPayload(params.history);

    const { data, error } = await this.client.functions.invoke('gemini-chat', {
      body: {
        message: params.text,
        character_id: params.characterId,
        conversation_history,
        user_id: userId,
        client_id: clientId,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    const responseText = (data as any)?.response;
    if (typeof responseText !== 'string' || !responseText.trim()) {
      throw new Error('Empty response from Gemini');
    }
    return responseText;
  }

  async fetchConversationHistory(
    characterId: string,
    { limit = 20, cursor }: { limit?: number; cursor?: string }
  ): Promise<{ messages: ChatMessage[]; reachedEnd: boolean }> {
    if (!characterId) {
      return { messages: [], reachedEnd: true };
    }

    const { userId, clientId } = await getAuthIdentifier();

    let query = this.client
      .from('conversation')
      .select('id,message,is_agent,created_at')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;
    if (error || !data) {
      throw new Error(error?.message || 'Failed to load conversation history');
    }

    const messagesDesc = data.map(mapRowToMessage);
    const batch = messagesDesc.reverse();
    return {
      messages: batch,
      reachedEnd: batch.length < limit,
    };
  }
}

const mapRowToMessage = (row: ConversationRow): ChatMessage => ({
  id: row.id,
  kind: { type: 'text', text: row.message },
  isAgent: row.is_agent,
  createdAt: row.created_at,
});

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


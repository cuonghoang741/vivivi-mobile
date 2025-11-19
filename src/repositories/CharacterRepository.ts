import { BaseRepository } from './BaseRepository';

export interface CharacterItem {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  avatar?: string;
  base_model_url?: string;
  agent_elevenlabs_id?: string;
  tier?: string;
  available?: boolean;
  price_vcoin?: number;
  price_ruby?: number;
  default_costume_id?: string;
}

export class CharacterRepository extends BaseRepository {
  /**
   * Fetch all available characters
   */
  async fetchAllCharacters(): Promise<CharacterItem[]> {
    // Ensure guest mode is set and client ID exists
    const { authManager } = await import('../services/AuthManager');
    if (!authManager.session && !authManager.isGuest) {
      await authManager.continueAsGuest();
    }
    
    // Use PostgREST client directly (simpler and works with RLS)
    // The Supabase JS client handles auth headers automatically
    try {
      const { data, error } = await this.client
        .from('characters')
        .select('id,name,description,thumbnail_url,avatar,base_model_url,agent_elevenlabs_id,tier,available,price_vcoin,price_ruby,default_costume_id')
        .eq('is_public', true)
        .eq('available', true);

      if (error) {
        console.error('❌ [CharacterRepository] PostgREST error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        
        // If permission error, try REST API as fallback
        if (error.code === '42501' || error.message.includes('permission denied')) {
          console.log('⚠️ [CharacterRepository] Trying REST API fallback...');
          const { executeSupabaseRequest } = await import('../utils/supabaseHelpers');
          
          const queryItems: Record<string, string> = {
            select: 'id,name,description,thumbnail_url,avatar,base_model_url,agent_elevenlabs_id,tier,available,price_vcoin,price_ruby,default_costume_id',
            is_public: 'is.true',
            available: 'is.true',
          };
          
          try {
            const restData = await executeSupabaseRequest<CharacterItem[]>(
              '/rest/v1/characters',
              queryItems,
              'GET'
            );
            console.log(`✅ [CharacterRepository] Loaded ${restData.length} characters via REST API`);
            return restData || [];
          } catch (restError: any) {
            console.error('❌ [CharacterRepository] REST API also failed:', restError);
            throw new Error(`Failed to fetch characters: ${error.message}`);
          }
        }
        
        throw new Error(`Failed to fetch characters: ${error.message}`);
      }

      console.log(`✅ [CharacterRepository] Loaded ${data?.length || 0} characters via PostgREST`);
      return data || [];
    } catch (error: any) {
      console.error('❌ [CharacterRepository] Unexpected error:', error);
      throw error;
    }
  }

  /**
   * Fetch a single character by ID
   */
  async fetchCharacter(id: string): Promise<CharacterItem | null> {
    const { data, error } = await this.client
      .from('characters')
      .select('id,name,description,thumbnail_url,avatar,base_model_url,agent_elevenlabs_id,tier,available,price_vcoin,price_ruby,default_costume_id')
      .eq('id', id)
      .eq('available', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch character: ${error.message}`);
    }

    return data;
  }

  /**
   * Fetch agent ID for a character
   */
  async fetchAgentId(characterId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from('characters')
      .select('agent_elevenlabs_id')
      .eq('id', characterId)
      .single();

    if (error || !data?.agent_elevenlabs_id) {
      return null;
    }

    return data.agent_elevenlabs_id;
  }

  /**
   * Fetch free characters for welcome gift (like Swift version)
   * Returns up to 3 free characters ordered by created_at ascending
   */
  async fetchFreeCharacters(): Promise<CharacterItem[]> {
    // Ensure guest mode is set and client ID exists
    const { authManager } = await import('../services/AuthManager');
    if (!authManager.session && !authManager.isGuest) {
      await authManager.continueAsGuest();
    }
    
    try {
      const { data, error } = await this.client
        .from('characters')
        .select('id,name,description,thumbnail_url,avatar,base_model_url,agent_elevenlabs_id,tier,available,price_vcoin,price_ruby,default_costume_id')
        .eq('is_public', true)
        .eq('available', true)
        .eq('tier', 'free')
        .order('created_at', { ascending: true })
        .limit(3);

      if (error) {
        console.error('❌ [CharacterRepository] Error fetching free characters:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(`Failed to fetch free characters: ${error.message}`);
      }

      console.log(`✅ [CharacterRepository] Loaded ${data?.length || 0} free characters`);
      return (data || []).filter((c) => c.available);
    } catch (error: any) {
      console.error('❌ [CharacterRepository] Unexpected error fetching free characters:', error);
      throw error;
    }
  }

  /**
   * Fetch owned character IDs for current user
   */
  async fetchOwnedCharacterIds(): Promise<Set<string>> {
    let query = this.client
      .from('user_character')
      .select('character_id')
      .not('character_id', 'is', null);

    query = await this.addAuthFilters(query);

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch owned characters:', error);
      return new Set();
    }

    return new Set((data || []).map((item: any) => item.character_id).filter(Boolean));
  }
}


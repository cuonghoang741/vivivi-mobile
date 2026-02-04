import { BaseRepository } from './BaseRepository';

export interface CharacterData {
  rounds?: {
    r1?: number;
    r2?: number;
    r3?: number;
  };
  hobbies?: string[];
  height_cm?: number;
  old?: number;
  age?: number;
  occupation?: string;
  characteristics?: string;
  [key: string]: unknown; // Allow additional fields
}

export interface CharacterItem {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  avatar?: string;
  video_url?: string;
  base_model_url?: string;
  agent_elevenlabs_id?: string;
  tier?: string;
  order?: number;
  available?: boolean;
  price_vcoin?: number;
  price_ruby?: number;
  default_costume_id?: string;
  background_default_id?: string;
  default_background?: {
    image?: string;
    thumbnail?: string;
  } | null;
  data?: CharacterData;
  total_dances?: number;
  total_secrets?: number;
  costumes?: {
    id: string;
    thumbnail: string | null;
  }[];
}

export class CharacterRepository extends BaseRepository {
  /**
   * Fetch all available characters
   */
  async fetchAllCharacters(): Promise<CharacterItem[]> {
    try {
      // 1. Fetch characters first
      const { data: characters, error: charError } = await this.client
        .from('characters')
        .select('id,name,description,thumbnail_url,avatar,video_url,base_model_url,agent_elevenlabs_id,tier,available,price_vcoin,price_ruby,default_costume_id,background_default_id,data,order,total_dances,total_secrets,default_background:backgrounds!background_default_id(image,thumbnail)')
        .eq('is_public', true)
        .order('order', { ascending: true });

      if (charError) {
        console.error('❌ [CharacterRepository] PostgREST error:', charError);
        throw new Error(`Failed to fetch characters: ${charError.message}`);
      }

      // 2. Fetch costumes for the fetched characters
      let costumes: any[] = [];
      if (characters && characters.length > 0) {
        const characterIds = characters.map((c: any) => c.id);
        const { data: costumesData, error: costumeError } = await this.client
          .from('character_costumes')
          .select('id,character_id,thumbnail')
          .in('character_id', characterIds)
          .eq('available', true);

        if (costumeError) {
          console.warn('⚠️ [CharacterRepository] Failed to fetch costumes:', costumeError);
        } else {
          costumes = costumesData || [];
        }
      }

      console.log(`✅ [CharacterRepository] Loaded ${characters?.length || 0} characters and ${costumes.length} costumes`);

      // 3. Update Map
      return (characters || []).map((item: any) => ({
        ...item,
        default_background: Array.isArray(item.default_background)
          ? item.default_background[0]
          : item.default_background,
        costumes: costumes.filter((c: any) => c.character_id === item.id)
      }));
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
      .select('id,name,description,thumbnail_url,avatar,video_url,base_model_url,agent_elevenlabs_id,tier,available,price_vcoin,price_ruby,default_costume_id,background_default_id,data, default_background:backgrounds!background_default_id(image,thumbnail)')
      .eq('id', id)
      .eq('available', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch character: ${error.message}`);
    }

    const item: any = data;
    return {
      ...item,
      default_background: Array.isArray(item.default_background)
        ? item.default_background[0]
        : item.default_background
    };
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


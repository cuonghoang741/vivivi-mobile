import { BaseRepository } from './BaseRepository';

export interface CostumeItem {
  id: string;
  character_id: string;
  costume_name: string;
  url?: string;
  thumbnail?: string;
  model_url?: string;
  tier?: string;
  available?: boolean;
  price_vcoin?: number;
  price_ruby?: number;
  created_at?: string;
}

export class CostumeRepository extends BaseRepository {
  /**
   * Fetch costumes for a specific character
   */
  async fetchCostumes(characterId: string): Promise<CostumeItem[]> {
    const { data, error } = await this.client
      .from('character_costumes')
      .select('id,character_id,costume_name,url,thumbnail,model_url,tier,available,price_vcoin,price_ruby,created_at')
      .eq('character_id', characterId)
      .eq('available', true)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch costumes: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Fetch all costumes (for backward compatibility)
   */
  async fetchAllCostumes(): Promise<CostumeItem[]> {
    const { data, error } = await this.client
      .from('character_costumes')
      .select('id,character_id,costume_name,url,thumbnail,model_url,tier,available,price_vcoin,price_ruby,created_at')
      .eq('available', true)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch costumes: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Fetch a single costume by ID
   */
  async fetchCostume(id: string): Promise<CostumeItem | null> {
    const { data, error } = await this.client
      .from('character_costumes')
      .select('id,character_id,costume_name,url,thumbnail,model_url,tier,available,price_vcoin,price_ruby,created_at')
      .eq('id', id)
      .eq('available', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch costume: ${error.message}`);
    }

    return data;
  }
}


import { BaseRepository } from './BaseRepository';

export interface CostumeItemMetadata {
  isLocked?: boolean;
  [key: string]: any;
}

export interface CostumeItem {
  id: string;
  character_id: string;
  costume_name: string;
  url?: string | null;
  video_url?: string | null;
  thumbnail?: string | null;
  model_url?: string | null;
  tier?: string | null;
  available?: boolean | null;
  price_vcoin?: number | null;
  price_ruby?: number | null;
  streak_days?: number | null;
  metadata?: CostumeItemMetadata | null;
  created_at?: string;
}

export class CostumeRepository extends BaseRepository {
  private static DEFAULT_CHARACTER_ID = '74432746-0bab-4972-a205-9169bece07f9';

  async fetchCostumes(characterId?: string | null, includeUnavailable: boolean = false): Promise<CostumeItem[]> {
    const targetCharacterId =
      characterId && characterId.trim().length > 0
        ? characterId
        : CostumeRepository.DEFAULT_CHARACTER_ID;

    let query = this.client
      .from('character_costumes')
      .select(
        'id,character_id,costume_name,url,video_url,thumbnail,model_url,tier,available,price_vcoin,price_ruby,streak_days,metadata,created_at'
      )
      .eq('character_id', targetCharacterId)
      .order('created_at', { ascending: true });

    if (!includeUnavailable) {
      query = query.eq('available', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch costumes: ${error.message}`);
    }

    return data || [];
  }

  async fetchCostumeById(costumeId: string): Promise<CostumeItem | null> {
    const { data, error } = await this.client
      .from('character_costumes')
      .select(
        'id,character_id,costume_name,url,video_url,thumbnail,model_url,tier,available,price_vcoin,price_ruby,streak_days,metadata,created_at'
      )
      .eq('id', costumeId)
      .limit(1);

    if (error) {
      throw new Error(`Failed to fetch costume: ${error.message}`);
    }

    return data && data.length > 0 ? data[0] : null;
  }

  async updateCostumeMetadata(costumeId: string, metadata: CostumeItemMetadata): Promise<void> {
    const { error } = await this.client
      .from('character_costumes')
      .update({ metadata })
      .eq('id', costumeId);

    if (error) {
      console.warn(`[CostumeRepository] Failed to update metadata for costume ${costumeId}:`, error.message);
    }
  }
}



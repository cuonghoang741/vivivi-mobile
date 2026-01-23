import { BaseRepository } from './BaseRepository';

export interface BackgroundItem {
  id: string;
  name: string;
  thumbnail?: string;
  image?: string;
  video_url?: string;
  created_at?: string;
  public?: boolean;
  tier?: string;
  available?: boolean;
  price_vcoin?: number;
  price_ruby?: number;
  is_dark?: boolean;
}

export class BackgroundRepository extends BaseRepository {
  /**
   * Fetch all available backgrounds
   */
  async fetchAllBackgrounds(): Promise<BackgroundItem[]> {
    const { data, error } = await this.client
      .from('backgrounds')
      .select('id,name,thumbnail,image,video_url,created_at,public,tier,available,price_vcoin,price_ruby,is_dark')
      .eq('public', true)
      .eq('available', true)
      .order('tier', { ascending: true }) // Prioritize free tier
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch backgrounds: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Fetch a single background by ID
   */
  async fetchBackground(id: string): Promise<BackgroundItem | null> {
    const { data, error } = await this.client
      .from('backgrounds')
      .select('id,name,thumbnail,image,video_url,created_at,public,tier,available,price_vcoin,price_ruby,is_dark')
      .eq('id', id)
      .eq('available', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch background: ${error.message}`);
    }

    return data;
  }

  /**
   * Fetch owned background IDs for current user
   */
  async fetchOwnedBackgroundIds(): Promise<Set<string>> {
    let query = this.client
      .from('user_background')
      .select('background_id')
      .not('background_id', 'is', null);

    query = await this.addAuthFilters(query);

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch owned backgrounds:', error);
      return new Set();
    }

    return new Set((data || []).map((item: any) => item.background_id).filter(Boolean));
  }
}


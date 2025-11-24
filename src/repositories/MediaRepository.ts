import { BaseRepository } from './BaseRepository';

export type MediaItem = {
  id: string;
  url: string;
  thumbnail?: string | null;
  character_id: string;
  created_at?: string | null;
  tier?: string | null;
  available?: boolean | null;
  price_vcoin?: number | null;
  price_ruby?: number | null;
  media_type?: string | null;
  content_type?: string | null;
  rarity?: string | null;
};

export class MediaRepository extends BaseRepository {
  async fetchAllMedia(characterId: string): Promise<MediaItem[]> {
    try {
      const { data, error } = await this.client
        .from('medias')
        .select(
          [
            'id',
            'url',
            'thumbnail',
            'character_id',
            'created_at',
            'tier',
            'available',
            'price_vcoin',
            'price_ruby',
            'media_type',
            'content_type',
            'rarity',
          ].join(',')
        )
        .eq('character_id', characterId)
        .eq('available', true)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[MediaRepository] Failed to fetch media:', error);
        return [];
      }

      return (data as MediaItem[]) ?? [];
    } catch (error) {
      console.error('[MediaRepository] Error fetching media:', error);
      return [];
    }
  }
}



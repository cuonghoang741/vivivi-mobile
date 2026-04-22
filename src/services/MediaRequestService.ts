import { MediaRepository, MediaItem } from '../repositories/MediaRepository';
// Removed unused subscriptionService import

class MediaRequestService {
    private mediaRepository = new MediaRepository();

    /**
     * Get a random accessible media item of the specified type for the character.
     * Optionally filter by keywords to find specific content.
     */
    async getAccessibleMedia(
        characterId: string,
        type: 'photo' | 'video',
        keywords?: string
    ): Promise<MediaItem | null> {
        try {
            let allMedia: MediaItem[];

            // 1. If keywords provided, search by keywords first
            if (keywords) {
                allMedia = await this.mediaRepository.fetchMediaByKeywords(characterId, keywords);
                console.log(`[MediaRequestService] Found ${allMedia.length} media items matching keyword: "${keywords}"`);

                // If no media found with keyword, fall back to all media
                if (!allMedia || allMedia.length === 0) {
                    console.log('[MediaRequestService] No keyword match, falling back to all media');
                    allMedia = await this.mediaRepository.fetchAllMedia(characterId);
                }
            } else {
                // No keywords, fetch all media
                allMedia = await this.mediaRepository.fetchAllMedia(characterId);
            }

            console.log(allMedia)

            if (!allMedia || allMedia.length === 0) {
                return null;
            }

            // 2. Filter by type
            let typeFiltered = allMedia.filter(item => {
                // Determine type based on item properties if explicit type is passed
                const isVideo = item.content_type?.startsWith('video') || item.url.endsWith('.mp4') || item.url.endsWith('.mov');

                if (type === 'video') return isVideo;
                return !isVideo; // photo
            });

            if (typeFiltered.length === 0) {
                typeFiltered = allMedia;
                // return null;
            }

            // 3. Filter by accessibility logic removed to allow locked preview
            // We now pick random content from ALL media of that type.
            // The UI will handle locking/blurring if user is not Pro.

            const accessibleMedia = typeFiltered;
            console.log(`[MediaRequestService] Filtered by type "${type}": ${accessibleMedia.length} items`);

            if (accessibleMedia.length === 0) {
                console.log('[MediaRequestService] No media found after type filtering');
                return null;
            }

            // 4. Pick a random item
            const randomIndex = Math.floor(Math.random() * accessibleMedia.length);
            const selected = accessibleMedia[randomIndex];
            console.log(`[MediaRequestService] Selected media: ${selected.id} (URL: ${selected.url})`);
            return selected;

        } catch (error) {
            console.warn('[MediaRequestService] Error fetching media:', error);
            return null;
        }
    }
}

export const mediaRequestService = new MediaRequestService();

import { MediaRepository, MediaItem } from '../repositories/MediaRepository';
// Removed unused subscriptionService import

class MediaRequestService {
    private mediaRepository = new MediaRepository();

    /**
     * Get a random accessible media item of the specified type for the character
     */
    async getAccessibleMedia(
        characterId: string,
        type: 'photo' | 'video',
        isPro: boolean
    ): Promise<MediaItem | null> {
        try {
            // 1. Fetch all available media for the character
            const allMedia = await this.mediaRepository.fetchAllMedia(characterId);

            if (!allMedia || allMedia.length === 0) {
                return null;
            }

            // 2. Filter by type
            const typeFiltered = allMedia.filter(item => {
                // Determine type based on item properties if explicit type is passed
                const isVideo = item.content_type?.startsWith('video') || item.url.endsWith('.mp4') || item.url.endsWith('.mov');

                if (type === 'video') return isVideo;
                return !isVideo; // photo
            });

            if (typeFiltered.length === 0) {
                return null;
            }

            // 3. Filter by tier if not Pro
            let accessibleMedia = typeFiltered;
            if (!isPro) {
                console.log('[MediaRequestService] User is not Pro, filtering for free media only');
                accessibleMedia = typeFiltered.filter(item => item.tier === 'free');
            }

            if (accessibleMedia.length === 0) {
                console.log('[MediaRequestService] No media found');
                return null;
            }

            // 4. Pick a random item
            const randomIndex = Math.floor(Math.random() * accessibleMedia.length);
            return accessibleMedia[randomIndex];

        } catch (error) {
            console.warn('[MediaRequestService] Error fetching media:', error);
            return null;
        }
    }
    async getProMedia(
        characterId: string,
        type: 'photo' | 'video'
    ): Promise<MediaItem | null> {
        try {
            // 1. Fetch all available media for the character
            const allMedia = await this.mediaRepository.fetchAllMedia(characterId);

            if (!allMedia || allMedia.length === 0) {
                return null;
            }

            // 2. Filter by type and force tier='pro'
            const filtered = allMedia.filter(item => {
                const isVideo = item.content_type?.startsWith('video') || item.url.endsWith('.mp4') || item.url.endsWith('.mov');
                const matchType = type === 'video' ? isVideo : !isVideo;
                return matchType && item.tier === 'pro';
            });

            if (filtered.length === 0) {
                console.log('[MediaRequestService] No Pro media found for', type);
                return null;
            }

            // 3. Pick a random item
            const randomIndex = Math.floor(Math.random() * filtered.length);
            return filtered[randomIndex];

        } catch (error) {
            console.warn('[MediaRequestService] Error fetching pro media:', error);
            return null;
        }
    }
}

export const mediaRequestService = new MediaRequestService();

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

            // 3. Filter by accessibility logic removed to allow locked preview
            // We now pick random content from ALL media of that type.
            // The UI will handle locking/blurring if user is not Pro.

            const accessibleMedia = typeFiltered;

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
}

export const mediaRequestService = new MediaRequestService();

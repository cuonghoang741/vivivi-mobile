/**
 * VideoCacheService - Preload and cache character videos for instant playback
 * 
 * This service downloads videos to local storage so they can be played
 * immediately when switching between characters without loading delays.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { AVPlaybackSource } from 'expo-av';

// Directory for cached videos
const VIDEO_CACHE_DIR = `${FileSystem.cacheDirectory}videos/`;

// Map to track download progress and cached URIs
type CacheEntry = {
    localUri: string;
    size: number;
    downloadedAt: number;
};

class VideoCacheServiceImpl {
    private cache: Map<string, CacheEntry> = new Map();
    private downloadPromises: Map<string, Promise<string | null>> = new Map();
    private initialized = false;
    private maxCacheSize = 500 * 1024 * 1024; // 500MB max cache size

    /**
     * Initialize the cache directory
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            const dirInfo = await FileSystem.getInfoAsync(VIDEO_CACHE_DIR);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(VIDEO_CACHE_DIR, { intermediates: true });
                //console.log('[VideoCacheService] Created cache directory');
            }

            // Load existing cache entries
            await this.loadExistingCache();
            this.initialized = true;
            //console.log('[VideoCacheService] Initialized with', this.cache.size, 'cached videos');
        } catch (error) {
            console.error('[VideoCacheService] Failed to initialize:', error);
        }
    }

    /**
     * Load existing cached files into memory map
     */
    private async loadExistingCache(): Promise<void> {
        try {
            const files = await FileSystem.readDirectoryAsync(VIDEO_CACHE_DIR);
            for (const filename of files) {
                const filePath = VIDEO_CACHE_DIR + filename;
                const fileInfo = await FileSystem.getInfoAsync(filePath);

                if (fileInfo.exists && 'size' in fileInfo && fileInfo.size) {
                    // Extract original URL from filename (we encode it)
                    const originalUrl = this.filenameToUrl(filename);
                    if (originalUrl) {
                        this.cache.set(originalUrl, {
                            localUri: filePath,
                            size: fileInfo.size,
                            downloadedAt: ('modificationTime' in fileInfo ? fileInfo.modificationTime : Date.now()) as number,
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('[VideoCacheService] Error loading existing cache:', error);
        }
    }

    /**
     * Convert URL to safe filename
     */
    private urlToFilename(url: string): string {
        // Create a hash-like filename from the URL
        const hash = url
            .replace(/[^a-zA-Z0-9]/g, '_')
            .slice(-100); // Keep last 100 chars to avoid too long filenames

        // Get the extension from URL
        const extension = url.match(/\.(mp4|webm|mov)$/i)?.[1] || 'mp4';

        return `${hash}.${extension}`;
    }

    /**
     * Attempt to recover URL from filename (for cache restoration)
     */
    private filenameToUrl(filename: string): string | null {
        // This is a best-effort recovery - we can't fully reverse the hash
        // For now, we'll just validate the file exists and keep it
        return null; // We'll track URLs separately
    }

    /**
     * Check if a video is already cached
     */
    isCached(url: string): boolean {
        return this.cache.has(url);
    }

    /**
     * Get cached URI for a video URL, or null if not cached
     */
    getCachedUri(url: string): string | null {
        const entry = this.cache.get(url);
        return entry?.localUri || null;
    }

    /**
     * Get the best available source for a video URL
     * Returns cached local URI if available, otherwise the remote URL
     */
    getVideoSource(url: string | null): AVPlaybackSource | null {
        if (!url) return null;

        const cachedUri = this.getCachedUri(url);
        if (cachedUri) {
            return { uri: cachedUri };
        }
        return { uri: url };
    }

    /**
     * Preload a single video - downloads in background
     * Returns the local URI when complete, or null if failed
     */
    async preloadVideo(url: string): Promise<string | null> {
        if (!url) return null;

        await this.initialize();

        // Return cached URI if already downloaded
        const cachedUri = this.getCachedUri(url);
        if (cachedUri) {
            //console.log('[VideoCacheService] Video already cached:', url.slice(-50));
            return cachedUri;
        }

        // Return existing download promise if in progress
        const existingPromise = this.downloadPromises.get(url);
        if (existingPromise) {
            //console.log('[VideoCacheService] Download already in progress:', url.slice(-50));
            return existingPromise;
        }

        // Start new download
        const downloadPromise = this.downloadVideo(url);
        this.downloadPromises.set(url, downloadPromise);

        try {
            const result = await downloadPromise;
            return result;
        } finally {
            this.downloadPromises.delete(url);
        }
    }

    /**
     * Download a video to cache
     */
    private async downloadVideo(url: string): Promise<string | null> {
        const filename = this.urlToFilename(url);
        const localUri = VIDEO_CACHE_DIR + filename;

        try {
            //console.log('[VideoCacheService] Starting download:', url.slice(-50));

            // Check cache size before downloading
            await this.ensureCacheSpace();

            const downloadResult = await FileSystem.downloadAsync(url, localUri);

            if (downloadResult.status === 200) {
                const fileInfo = await FileSystem.getInfoAsync(localUri);
                const fileSize = fileInfo.exists && 'size' in fileInfo ? (fileInfo.size || 0) : 0;

                this.cache.set(url, {
                    localUri,
                    size: fileSize,
                    downloadedAt: Date.now(),
                });

                console.log('[VideoCacheService] Downloaded successfully:', url.slice(-50),
                    'Size:', (fileSize / 1024 / 1024).toFixed(2), 'MB');

                return localUri;
            } else {
                console.warn('[VideoCacheService] Download failed with status:', downloadResult.status);
                return null;
            }
        } catch (error) {
            console.error('[VideoCacheService] Download error for', url.slice(-50), ':', error);

            // Clean up partial file if exists
            try {
                await FileSystem.deleteAsync(localUri, { idempotent: true });
            } catch (e) {
                // Ignore cleanup errors
            }

            return null;
        }
    }

    /**
     * Preload multiple videos in parallel
     */
    async preloadVideos(urls: (string | null | undefined)[]): Promise<Map<string, string | null>> {
        const validUrls = urls.filter((url): url is string => !!url);
        const results = new Map<string, string | null>();

        //console.log('[VideoCacheService] Preloading', validUrls.length, 'videos');

        // Download in parallel with a concurrency limit
        const concurrencyLimit = 3;
        const chunks: string[][] = [];

        for (let i = 0; i < validUrls.length; i += concurrencyLimit) {
            chunks.push(validUrls.slice(i, i + concurrencyLimit));
        }

        for (const chunk of chunks) {
            const chunkResults = await Promise.all(
                chunk.map(async (url) => {
                    const localUri = await this.preloadVideo(url);
                    return { url, localUri };
                })
            );

            for (const { url, localUri } of chunkResults) {
                results.set(url, localUri);
            }
        }

        console.log('[VideoCacheService] Preload complete.',
            'Cached:', [...results.values()].filter(v => v !== null).length,
            'Failed:', [...results.values()].filter(v => v === null).length);

        return results;
    }

    /**
     * Ensure we have space in cache by removing old files if necessary
     */
    private async ensureCacheSpace(): Promise<void> {
        let totalSize = 0;
        const entries: Array<{ url: string; entry: CacheEntry }> = [];

        for (const [url, entry] of this.cache.entries()) {
            totalSize += entry.size;
            entries.push({ url, entry });
        }

        // If under limit, no action needed
        if (totalSize < this.maxCacheSize) return;

        // Sort by downloadedAt (oldest first)
        entries.sort((a, b) => a.entry.downloadedAt - b.entry.downloadedAt);

        // Remove oldest entries until we're under 80% of max
        const targetSize = this.maxCacheSize * 0.8;

        while (totalSize > targetSize && entries.length > 0) {
            const oldest = entries.shift();
            if (!oldest) break;

            try {
                await FileSystem.deleteAsync(oldest.entry.localUri, { idempotent: true });
                this.cache.delete(oldest.url);
                totalSize -= oldest.entry.size;
                //console.log('[VideoCacheService] Removed old cache entry:', oldest.entry.localUri.slice(-50));
            } catch (error) {
                console.warn('[VideoCacheService] Failed to remove cache entry:', error);
            }
        }
    }

    /**
     * Clear all cached videos
     */
    async clearCache(): Promise<void> {
        try {
            await FileSystem.deleteAsync(VIDEO_CACHE_DIR, { idempotent: true });
            await FileSystem.makeDirectoryAsync(VIDEO_CACHE_DIR, { intermediates: true });
            this.cache.clear();
            this.downloadPromises.clear();
            //console.log('[VideoCacheService] Cache cleared');
        } catch (error) {
            console.error('[VideoCacheService] Failed to clear cache:', error);
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { count: number; totalSize: number; maxSize: number } {
        let totalSize = 0;
        for (const entry of this.cache.values()) {
            totalSize += entry.size;
        }

        return {
            count: this.cache.size,
            totalSize,
            maxSize: this.maxCacheSize,
        };
    }
}

// Export singleton instance
export const VideoCacheService = new VideoCacheServiceImpl();

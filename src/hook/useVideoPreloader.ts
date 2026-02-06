/**
 * useVideoPreloader - Hook to preload and cache character videos
 * 
 * This hook can be used at the app level or in character list screens
 * to preload videos before the user opens the preview screen.
 */

import { useEffect, useRef, useCallback } from 'react';
import { CharacterItem } from '../repositories/CharacterRepository';
import { CostumeRepository } from '../repositories/CostumeRepository';
import { VideoCacheService } from '../services/VideoCacheService';

interface UseVideoPreloaderOptions {
    /** Characters to preload videos for */
    characters: CharacterItem[];
    /** Whether to start preloading immediately (default: true) */
    autoStart?: boolean;
    /** Priority character IDs to preload first */
    priorityCharacterIds?: string[];
}

interface UseVideoPreloaderReturn {
    /** Manually trigger preloading */
    startPreloading: () => Promise<void>;
    /** Check if a specific character's video is cached */
    isVideoCached: (characterId: string) => boolean;
    /** Get cached video URI for a character */
    getCachedVideoUri: (characterId: string) => string | null;
    /** Preloading status */
    isPreloading: boolean;
    /** Number of videos cached */
    cachedCount: number;
}

/**
 * Hook to preload character videos for instant playback
 */
export function useVideoPreloader(options: UseVideoPreloaderOptions): UseVideoPreloaderReturn {
    const { characters, autoStart = true, priorityCharacterIds = [] } = options;

    const isPreloadingRef = useRef(false);
    const videoUrlMapRef = useRef<Map<string, string>>(new Map());
    const cachedCountRef = useRef(0);

    /**
     * Get video URL for a character (checks character.video_url first, then default costume)
     */
    const getVideoUrlForCharacter = useCallback(async (character: CharacterItem): Promise<string | null> => {
        // 1. Try character video first
        if (character.video_url) {
            return character.video_url;
        }

        // 2. Try default costume video
        if (character.default_costume_id) {
            try {
                const costumeRepo = new CostumeRepository();
                const costume = await costumeRepo.fetchCostumeById(character.default_costume_id);
                if (costume?.video_url) {
                    return costume.video_url;
                }
            } catch (err) {
                console.warn('[useVideoPreloader] Failed to fetch costume for', character.name, err);
            }
        }

        return null;
    }, []);

    /**
     * Start preloading videos for all characters
     */
    const startPreloading = useCallback(async () => {
        if (isPreloadingRef.current || characters.length === 0) return;

        isPreloadingRef.current = true;
        console.log('[useVideoPreloader] Starting video preload for', characters.length, 'characters');

        try {
            // Sort characters to prioritize specific ones
            const sortedCharacters = [...characters].sort((a, b) => {
                const aIsPriority = priorityCharacterIds.includes(a.id);
                const bIsPriority = priorityCharacterIds.includes(b.id);
                if (aIsPriority && !bIsPriority) return -1;
                if (!aIsPriority && bIsPriority) return 1;
                return 0;
            });

            // Collect video URLs
            const videoUrls: string[] = [];
            const characterToUrlMap = new Map<string, string>();

            for (const character of sortedCharacters) {
                const videoUrl = await getVideoUrlForCharacter(character);
                if (videoUrl) {
                    videoUrls.push(videoUrl);
                    characterToUrlMap.set(character.id, videoUrl);
                }
            }

            videoUrlMapRef.current = characterToUrlMap;

            // Preload all videos
            if (videoUrls.length > 0) {
                const results = await VideoCacheService.preloadVideos(videoUrls);
                cachedCountRef.current = [...results.values()].filter(v => v !== null).length;
                console.log('[useVideoPreloader] Preload complete. Cached:', cachedCountRef.current, 'videos');
            }
        } catch (error) {
            console.error('[useVideoPreloader] Preload failed:', error);
        } finally {
            isPreloadingRef.current = false;
        }
    }, [characters, priorityCharacterIds, getVideoUrlForCharacter]);

    /**
     * Check if a character's video is cached
     */
    const isVideoCached = useCallback((characterId: string): boolean => {
        const videoUrl = videoUrlMapRef.current.get(characterId);
        if (!videoUrl) return false;
        return VideoCacheService.isCached(videoUrl);
    }, []);

    /**
     * Get cached video URI for a character
     */
    const getCachedVideoUri = useCallback((characterId: string): string | null => {
        const videoUrl = videoUrlMapRef.current.get(characterId);
        if (!videoUrl) return null;
        return VideoCacheService.getCachedUri(videoUrl);
    }, []);

    // Auto-start preloading when characters change
    useEffect(() => {
        if (autoStart && characters.length > 0) {
            startPreloading();
        }
    }, [autoStart, characters, startPreloading]);

    return {
        startPreloading,
        isVideoCached,
        getCachedVideoUri,
        isPreloading: isPreloadingRef.current,
        cachedCount: cachedCountRef.current,
    };
}

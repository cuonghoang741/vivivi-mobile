import Button from './Button';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import { VRMWebView } from './VRMWebView';
import { LiquidGlass } from './LiquidGlass';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CharacterRepository, CharacterItem } from '../../repositories/CharacterRepository';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
    /** Called when character changes */
    onCharacterChange?: (character: CharacterItem, index: number) => void;
    /** Called when VRM model is ready */
    onModelReady?: () => void;
    /** Show action buttons (Dance, Kiss Me, TikTok, Angry) */
    showActionButtons?: boolean;
    /** Show character navigation (left/right arrows) */
    showNavigation?: boolean;
    /** Initial character index */
    initialIndex?: number;
    /** ID of the character to show initially */
    initialCharacterId?: string;
    /** Custom filter for characters (default: free only) */
    characterFilter?: (character: CharacterItem) => boolean;
};

export const PreviewVRM: React.FC<Props> = ({
    onCharacterChange,
    onModelReady,
    showActionButtons = true,
    showNavigation = true,
    initialIndex = 0,
    initialCharacterId,
    characterFilter,
}) => {
    const insets = useSafeAreaInsets();
    const [characters, setCharacters] = useState<CharacterItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isModelReady, setIsModelReady] = useState(false);
    const [isLoadingCharacters, setIsLoadingCharacters] = useState(true);

    // VRM WebView ref
    const webViewRef = useRef<WebView>(null);

    // Fetch free characters on mount
    useEffect(() => {
        let isMounted = true;
        const fetchCharacters = async () => {
            try {
                setIsLoadingCharacters(true);
                const repo = new CharacterRepository();

                let filteredChars: CharacterItem[] = [];

                if (characterFilter) {
                    const items = await repo.fetchAllCharacters();
                    filteredChars = items.filter(characterFilter);
                } else {
                    // Default: fetch only free characters from DB
                    const items = await repo.fetchFreeCharacters();
                    // Still filter by order just in case
                    filteredChars = items.filter(c => c.order);
                }

                if (isMounted && filteredChars.length > 0) {
                    setCharacters(filteredChars);

                    // Determine start index
                    let startIndex = initialIndex;
                    if (initialCharacterId) {
                        const foundIndex = filteredChars.findIndex(c => c.id === initialCharacterId);
                        if (foundIndex !== -1) {
                            startIndex = foundIndex;
                        }
                    } else {
                        // Safe clamp if just using initialIndex
                        startIndex = Math.min(initialIndex, filteredChars.length - 1);
                    }

                    setCurrentIndex(startIndex);

                    // Notify about initial character
                    if (onCharacterChange) {
                        if (filteredChars[startIndex]) {
                            onCharacterChange(filteredChars[startIndex], startIndex);
                        }
                    }
                }
            } catch (error) {
                console.error('[PreviewVRM] Failed to fetch characters:', error);
            } finally {
                if (isMounted) {
                    setIsLoadingCharacters(false);
                }
            }
        };
        fetchCharacters();
        return () => {
            isMounted = false;
        };
    }, [characterFilter, initialIndex, initialCharacterId]);

    // Load VRM model when character changes
    useEffect(() => {
        if (!isModelReady || characters.length === 0 || !webViewRef.current) return;

        const character = characters[currentIndex];
        if (!character) return;

        let modelUrl = character.base_model_url;
        let modelName = character.base_model_url ? `${character.id}.vrm` : '';

        // Fallback to construction by order if no base_model_url
        if (!modelUrl && character.order) {
            const orderStr = String(character.order).padStart(3, '0');
            modelUrl = `https://pub-6671ed00c8d945b28ff7d8ec392f60b8.r2.dev/CHARACTERS/${orderStr}/${orderStr}_vrm/${orderStr}.vrm`;
            modelName = `${orderStr}.vrm`;
        }

        if (!modelUrl) {
            console.warn('[PreviewVRM] No model URL available for character:', character.name);
            return;
        }

        console.log('[PreviewVRM] Loading character model:', modelName);

        const escapedURL = modelUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const escapedName = modelName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

        let bgScript = '';
        if (character.default_background?.image) {
            const bgUrl = character.default_background.image.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            bgScript = `if (window.setBackgroundImage) { window.setBackgroundImage("${bgUrl}"); }`;
        }

        const js = `
            window.loadModelByURL("${escapedURL}", "${escapedName}");
            ${bgScript}
        `;
        webViewRef.current.injectJavaScript(`(async()=>{try{const r=(function(){${js}})(); if(r&&typeof r.then==='function'){await r;} return 'READY';}catch(e){return 'READY';}})();`);
    }, [currentIndex, isModelReady, characters]);

    // Character navigation
    const handlePrevCharacter = useCallback(() => {
        if (characters.length <= 1) return;
        Haptics.selectionAsync();
        const newIndex = (currentIndex - 1 + characters.length) % characters.length;
        setCurrentIndex(newIndex);
        if (onCharacterChange && characters[newIndex]) {
            onCharacterChange(characters[newIndex], newIndex);
        }
    }, [characters, currentIndex, onCharacterChange]);

    const handleNextCharacter = useCallback(() => {
        if (characters.length <= 1) return;
        Haptics.selectionAsync();
        const newIndex = (currentIndex + 1) % characters.length;
        setCurrentIndex(newIndex);
        if (onCharacterChange && characters[newIndex]) {
            onCharacterChange(characters[newIndex], newIndex);
        }
    }, [characters, currentIndex, onCharacterChange]);

    const handleModelReady = useCallback(() => {
        console.log('[PreviewVRM] VRM Model ready');
        setIsModelReady(true);
        onModelReady?.();
    }, [onModelReady]);

    // Action handlers
    const triggerDance = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Load a random dance animation or next animation
        webViewRef.current?.injectJavaScript(`
            if (window.loadNextAnimation) {
                window.loadNextAnimation();
            }
            true;
        `);
    }, []);

    const triggerKiss = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        webViewRef.current?.injectJavaScript(`
            (async() => {
                try {
                    const fbxUrl = 'https://pub-8b57fd6b30c04b11b3f3a092bdfed0e2.r2.dev/Heart-Flutter%20Pose.fbx';
                    if (window.loadFBX) {
                        window.loadFBX(fbxUrl, 'Heart Flutter');
                    }
                } catch(e) {}
            })(); true;
        `);
    }, []);

    const triggerTikTok = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        webViewRef.current?.injectJavaScript(`
            (async() => {
                try {
                    // Mapped to "Give Your Soul" as requested
                    const fbxUrl = 'https://pub-8b57fd6b30c04b11b3f3a092bdfed0e2.r2.dev/Dance%20-%20Give%20Your%20Soul.fbx';
                    if (window.loadFBX) {
                        window.loadFBX(fbxUrl, 'TikTok Dance');
                    }
                } catch(e) {}
            })(); true;
        `);
    }, []);

    const triggerAngry = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        webViewRef.current?.injectJavaScript(`
      (function() {
        if (!window.currentVrm || !window.currentVrm.expressionManager) return;
        const names = ['angry','Angry','sad','surprised'];
        let t0 = performance.now();
        const dur = 1.2;
        const maxV = 0.5;
        const setVal = (v) => { for (const n of names) { try { window.currentVrm.expressionManager.setValue(n, v); } catch {} } };
        const step = (ts) => {
          const t = (ts - t0) / 1000;
          if (t <= dur) {
            const p = t / dur;
            const v = p < 0.5 ? (maxV * (0.5 * (1 - Math.cos(Math.PI * (p/0.5))))) : (maxV * (1 - 0.5 * (1 - Math.cos(Math.PI * ((p-0.5)/0.5)))));
            setVal(Math.max(0, Math.min(maxV, v)));
            requestAnimationFrame(step);
          } else {
            setVal(0.0);
          }
        };
        requestAnimationFrame(step);
      })(); true;
    `);
    }, []);

    const currentCharacter = characters[currentIndex];

    return (
        <View style={styles.container}>
            {/* VRM WebView */}
            <View style={styles.vrmContainer}>
                {currentCharacter?.default_background?.image && (
                    <Image
                        source={{ uri: currentCharacter.default_background.image }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={500}
                    />
                )}
                <VRMWebView
                    ref={webViewRef}
                    onModelReady={handleModelReady}
                    enableDebug={false}
                />

                {/* Loading overlay */}
                {(isLoadingCharacters || !isModelReady) && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#FF416C" />
                        <Text style={styles.loadingText}>Loading preview...</Text>
                    </View>
                )}
            </View>

            {/* Top section - Character info & navigation */}
            <View style={[styles.topSection, { paddingTop: insets.top }]}>
                {currentCharacter && showNavigation && (
                    <View style={styles.characterInfoRow}>
                        {/* Previous button */}
                        <Button
                            variant="liquid"
                            size="md"
                            isIconOnly
                            startIcon={IconChevronLeft}
                            onPress={handlePrevCharacter}
                            disabled={characters.length <= 1}
                            isDarkBackground
                        />

                        {/* Character name */}
                        <Button
                            variant="liquid"
                            size="md"
                            disabled // Use disabled style effectively or just for display
                            style={styles.characterNameCard}
                            isDarkBackground
                        >
                            <View style={{ alignItems: 'center' }}>
                                <Text style={styles.characterName}>{currentCharacter.name}</Text>
                            </View>
                        </Button>

                        {/* Next button */}
                        <Button
                            variant="liquid"
                            size="md"
                            isIconOnly
                            startIcon={IconChevronRight}
                            onPress={handleNextCharacter}
                            disabled={characters.length <= 1}
                            isDarkBackground
                        />
                    </View>
                )}

                {/* Action buttons row */}
                {isModelReady && showActionButtons && (
                    <View style={styles.actionButtonsRow}>
                        <View style={styles.actionButton}>
                            <Button
                                variant="liquid"
                                fullWidth
                                size="sm"
                                onPress={triggerDance}
                                isDarkBackground
                            >
                                💃 Dance
                            </Button>
                        </View>

                        <View style={[
                            styles.actionButton,
                            {
                                maxWidth: 130
                            }
                        ]}>
                            <Button
                                variant="liquid"
                                fullWidth
                                size="sm"
                                onPress={triggerKiss}
                                isDarkBackground
                                textProps={{ numberOfLines: 1 }}
                            >
                                😘 Kiss Me
                            </Button>
                        </View>

                        <View style={styles.actionButton}>
                            <Button
                                variant="liquid"
                                fullWidth
                                size="sm"
                                onPress={triggerTikTok}
                                isDarkBackground
                            >
                                🎵 TikTok
                            </Button>
                        </View>

                        {/* <View style={styles.actionButton}>
                            <Button
                                variant="liquid"
                                fullWidth
                                size="sm"
                                onPress={triggerAngry}
                                isDarkBackground
                            >
                                😠 Angry
                            </Button>
                        </View> */}
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    vrmContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10, 0, 20, 0.9)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        marginTop: 16,
        fontWeight: '500',
    },
    topSection: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        zIndex: 10,
    },
    characterInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center', // Center everything
        gap: 16, // Increase gap slightly
    },
    navButton: {
        // Removed as we use Button component size
    },
    navButtonInner: {
        // Removed
    },
    characterNameCard: {
        // Removed flex: 1 to fit content
        alignItems: 'center',
        paddingHorizontal: 24,
        minWidth: 160, // Minimum width for stability 
    },
    characterName: {
        fontSize: 17, // Adjusted size to match Button sizing better
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
    },
    characterCount: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 2,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        width: "100%",
        gap: 8,
        marginTop: 16,
        paddingHorizontal: 8,
    },
    actionButton: {
        flex: 1,
        maxWidth: 90,
    },
});

export default PreviewVRM;

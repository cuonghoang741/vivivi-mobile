import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { authManager } from '../services/AuthManager';
import {
  CharacterRepository,
  CharacterItem,
} from '../repositories/CharacterRepository';
import { CostumeRepository, type CostumeItem } from '../repositories/CostumeRepository';
import AssetRepository from '../repositories/AssetRepository';
import { UserPreferencesService } from '../services/UserPreferencesService';
import { UserCharacterPreferenceService } from '../services/UserCharacterPreferenceService';
import { Persistence } from '../utils/persistence';
import { BackgroundRepository } from '../repositories/BackgroundRepository';

type InitialPreference = {
  costumeId?: string;
  backgroundId?: string;
};

type InitialDataState = {
  character: CharacterItem;
  ownedBackgroundIds: string[];
  preference: InitialPreference;
  fetchedAt: number;
};

type CharacterState = {
  id: string;
  name: string;
  avatar?: string;
  relationshipName?: string;
  relationshipProgress?: number;
  relationshipIconUri?: string | null;
  video_url?: string;
};

type AuthState = {
  session: Session | null;
  isLoading: boolean;
  errorMessage: string | null;
  hasRestoredSession: boolean;
};

type VRMContextValue = {
  authState: AuthState;
  initialData: InitialDataState | null;
  initialDataLoading: boolean;
  initialDataError: Error | null;
  refreshInitialData: (skipModelReset?: boolean) => Promise<void>;
  ensureInitialModelApplied: (webViewRef: React.MutableRefObject<any>) => Promise<void>;
  currentCharacter: CharacterState | null;
  setCurrentCharacterState: React.Dispatch<React.SetStateAction<CharacterState | null>>;
  currentCostume: CostumeItem | null;
  setCurrentCostume: React.Dispatch<React.SetStateAction<CostumeItem | null>>;
};

const VRMContext = createContext<VRMContextValue | undefined>(undefined);

export const useVRMContext = (): VRMContextValue => {
  const context = useContext(VRMContext);
  if (!context) {
    throw new Error('useVRMContext phải được dùng bên trong VRMProvider');
  }
  return context;
};

export const VRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authSnapshot, setAuthSnapshot] = useState<AuthState>({
    session: authManager.session,
    isLoading: authManager.isLoading,
    errorMessage: authManager.errorMessage,
    hasRestoredSession: authManager.hasRestoredSession,
  });
  const [initialData, setInitialData] = useState<InitialDataState | null>(null);
  const [initialDataLoading, setInitialDataLoading] = useState(false);
  const [initialDataError, setInitialDataError] = useState<Error | null>(null);
  const [currentCharacterState, setCurrentCharacterState] = useState<CharacterState | null>(
    null
  );
  const [currentCostume, setCurrentCostume] = useState<CostumeItem | null>(null);
  const [hasAppliedInitialModel, setHasAppliedInitialModel] = useState(false);

  useEffect(() => {
    const unsubscribe = authManager.subscribe(() => {
      setAuthSnapshot({
        session: authManager.session,
        isLoading: authManager.isLoading,
        errorMessage: authManager.errorMessage,
        hasRestoredSession: authManager.hasRestoredSession,
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authSnapshot.session) {
      setInitialData(null);
      setInitialDataError(null);
      setHasAppliedInitialModel(false);
      setCurrentCharacterState(null); // Clear character state on logout/delete
    }
  }, [authSnapshot.session]);

  const seedPersistenceSelections = useCallback(
    async (character: CharacterItem, preference: InitialPreference) => {
      try {
        const persistedCostumeSelection = await Persistence.getCharacterCostumeSelection(
          character.id
        );
        if (preference.costumeId) {
          const costumeMeta =
            await UserCharacterPreferenceService.loadCostumeMetadata(preference.costumeId);
          if (costumeMeta) {
            if (costumeMeta.modelURL && costumeMeta.costumeName) {
              await Persistence.setModelName(costumeMeta.costumeName);
              await Persistence.setModelURL(costumeMeta.modelURL);
              await Persistence.setCharacterCostumeSelection(character.id, {
                costumeId: preference.costumeId,
                modelName: costumeMeta.costumeName,
                modelURL: costumeMeta.modelURL,
              });
            } else if (costumeMeta.urlName) {
              const modelName = `${costumeMeta.urlName}.vrm`;
              await Persistence.setModelName(modelName);
              await Persistence.setModelURL('');
              await Persistence.setCharacterCostumeSelection(character.id, {
                costumeId: preference.costumeId,
                modelName,
                modelURL: '',
              });
            } else {
              await Persistence.setModelName(character.name);
              await Persistence.setModelURL(character.base_model_url || '');
              await Persistence.setCharacterCostumeSelection(character.id, {
                costumeId: preference.costumeId,
                modelName: character.name,
                modelURL: character.base_model_url || '',
              });
            }
          } else if (persistedCostumeSelection) {
            await Persistence.setModelName(
              persistedCostumeSelection.modelName || character.name
            );
            await Persistence.setModelURL(
              persistedCostumeSelection.modelURL || character.base_model_url || ''
            );
            await Persistence.setCharacterCostumeSelection(character.id, persistedCostumeSelection);
          } else {
            await Persistence.setModelName(character.name);
            await Persistence.setModelURL(character.base_model_url || '');
            await Persistence.setCharacterCostumeSelection(character.id, {
              costumeId: preference.costumeId,
              modelName: character.name,
              modelURL: character.base_model_url || '',
            });
          }
        } else if (persistedCostumeSelection) {
          await Persistence.setModelName(
            persistedCostumeSelection.modelName || character.name
          );
          await Persistence.setModelURL(
            persistedCostumeSelection.modelURL || character.base_model_url || ''
          );
          await Persistence.setCharacterCostumeSelection(character.id, persistedCostumeSelection);
        } else if (character.default_costume_id) {
          const costumeMeta =
            await UserCharacterPreferenceService.loadCostumeMetadata(
              character.default_costume_id
            );
          if (costumeMeta?.modelURL && costumeMeta.costumeName) {
            await Persistence.setModelName(costumeMeta.costumeName);
            await Persistence.setModelURL(costumeMeta.modelURL);
            await Persistence.setCharacterCostumeSelection(character.id, {
              costumeId: character.default_costume_id,
              modelName: costumeMeta.costumeName,
              modelURL: costumeMeta.modelURL,
            });
          } else {
            await Persistence.setModelName(character.name);
            await Persistence.setModelURL(character.base_model_url || '');
            await Persistence.setCharacterCostumeSelection(character.id, {
              costumeId: character.default_costume_id,
              modelName: character.name,
              modelURL: character.base_model_url || '',
            });
          }
        } else {
          await Persistence.setModelName(character.name);
          await Persistence.setModelURL(character.base_model_url || '');
          await Persistence.setCharacterCostumeSelection(character.id, {
            costumeId: null,
            modelName: character.name,
            modelURL: character.base_model_url || '',
          });
        }

        if (preference.backgroundId) {
          const backgroundRepo = new BackgroundRepository();
          const background = await backgroundRepo.fetchBackground(
            preference.backgroundId
          );
          if (background?.image) {
            await Persistence.setBackgroundURL(background.image);
            await Persistence.setBackgroundName(background.name || '');
            await Persistence.setCharacterBackgroundSelection(character.id, {
              backgroundId: preference.backgroundId,
              backgroundURL: background.image,
              backgroundName: background.name || '',
            });
          }
        } else {
          const persistedSelection = await Persistence.getCharacterBackgroundSelection(
            character.id
          );
          if (persistedSelection?.backgroundURL) {
            await Persistence.setBackgroundURL(persistedSelection.backgroundURL);
            await Persistence.setBackgroundName(persistedSelection.backgroundName || '');
          } else {
            await Persistence.setBackgroundURL('');
            await Persistence.setBackgroundName('');
            await Persistence.setCharacterBackgroundSelection(character.id, null);
          }
        }
      } catch (error) {
        console.warn('[VRMProvider] seedPersistenceSelections error', error);
      }
    },
    []
  );

  const bootstrapInitialData = useCallback(async (skipModelReset?: boolean) => {
    if (!authSnapshot.session) {
      return;
    }

    setInitialDataLoading(true);
    setInitialDataError(null);

    try {
      const characterRepo = new CharacterRepository();
      const assetRepo = new AssetRepository();
      const userPrefsService = new UserPreferencesService();

      const [characters, ownedCharacterIds, ownedBackgroundIds] = await Promise.all([
        characterRepo.fetchAllCharacters(),
        assetRepo.fetchOwnedAssets('character'),
        assetRepo.fetchOwnedAssets('background'),
      ]);

      if (!characters.length) {
        throw new Error('Không tìm thấy nhân vật khả dụng');
      }

      let currentCharacterId = await userPrefsService.loadCurrentCharacterId();
      const ownsCurrent =
        currentCharacterId && ownedCharacterIds.has(currentCharacterId);

      if (!currentCharacterId || !ownsCurrent) {
        const fallbackCharacter =
          characters.find(c => ownedCharacterIds.has(c.id)) ?? characters[0];
        currentCharacterId = fallbackCharacter.id;
        await userPrefsService.saveCurrentCharacterId(currentCharacterId);
      }

      const currentCharacter =
        characters.find(c => c.id === currentCharacterId) ?? characters[0];

      const preference =
        (await UserCharacterPreferenceService.loadUserCharacterPreference(
          currentCharacter.id
        )) || {};

      await seedPersistenceSelections(currentCharacter, preference);

      setInitialData({
        character: currentCharacter,
        ownedBackgroundIds: Array.from(ownedBackgroundIds),
        preference,
        fetchedAt: Date.now(),
      });
      setInitialDataError(null);
      if (!skipModelReset) {
        setHasAppliedInitialModel(false);
      }
    } catch (error) {
      const normalized =
        error instanceof Error ? error : new Error('Không thể tải dữ liệu ban đầu');
      setInitialDataError(normalized);
      setInitialData(null);
    } finally {
      setInitialDataLoading(false);
    }
  }, [authSnapshot.session, seedPersistenceSelections]);

  const refreshInitialData = useCallback(async (skipModelReset?: boolean) => {
    setInitialData(null);
    setInitialDataError(null);
    await bootstrapInitialData(skipModelReset);
  }, [bootstrapInitialData]);

  const ensureInitialModelApplied = useCallback(
    async (webViewRef: React.MutableRefObject<any>) => {
      if (!initialData || hasAppliedInitialModel || !webViewRef.current) {
        return;
      }

      const { character, preference, ownedBackgroundIds } = initialData;
      const ownedBackgroundSet = new Set(ownedBackgroundIds);

      try {
        let backgroundIdToApply = preference.backgroundId;
        if (!backgroundIdToApply) {
          const persistedSelection = await Persistence.getCharacterBackgroundSelection(
            character.id
          );
          backgroundIdToApply = persistedSelection?.backgroundId || undefined;
        }

        // Fallback: if no background preference, use character's default background
        if (!backgroundIdToApply && character.background_default_id) {
          backgroundIdToApply = character.background_default_id;
          console.log('[VRMProvider] No background preference, using character default:', backgroundIdToApply);
        }

        if (backgroundIdToApply) {
          await UserCharacterPreferenceService.applyBackgroundById(
            backgroundIdToApply,
            webViewRef,
            ownedBackgroundSet
          );
        }

        const persistedCostumeSelection = await Persistence.getCharacterCostumeSelection(
          character.id
        );
        let costumeApplied = false;
        let costumeIdToApply =
          preference.costumeId ||
          persistedCostumeSelection?.costumeId ||
          character.default_costume_id ||
          null;

        if (costumeIdToApply) {
          try {
            await UserCharacterPreferenceService.applyCostumeById(
              costumeIdToApply,
              webViewRef,
              character.id
            );

            // Optimize: Fetch and store costume details in context
            const costumeRepo = new CostumeRepository();
            const costumeDetails = await costumeRepo.fetchCostumeById(costumeIdToApply);
            setCurrentCostume(costumeDetails);

            costumeApplied = true;
          } catch (error) {
            console.warn('[VRMProvider] Failed to apply saved costume, will fallback', error);
          }
        }

        if (!costumeApplied) {
          const fallbackName = persistedCostumeSelection?.modelName || character.name;
          const fallbackUrl =
            persistedCostumeSelection?.modelURL || character.base_model_url || null;
          if (fallbackName && fallbackUrl) {
            await UserCharacterPreferenceService.loadFallbackModel(
              fallbackName,
              fallbackUrl,
              webViewRef,
              character.id
            );
            costumeApplied = true;
          }
        }

        if (!costumeApplied && character.base_model_url) {
          await UserCharacterPreferenceService.loadFallbackModel(
            character.name,
            character.base_model_url,
            webViewRef,
            character.id
          );
        }

        setCurrentCharacterState({
          id: character.id,
          name: character.name,
          avatar: character.avatar || character.thumbnail_url,
          relationshipName: 'Stranger',
          relationshipProgress: 0,
          video_url: character.video_url,
        });

        setHasAppliedInitialModel(true);
      } catch (error) {
        console.error('[VRMProvider] Error applying initial model:', error);
        // Không random VRM nữa. Nếu lỗi, cứ để nguyên (giống cách Swift xử lý bảo thủ hơn)
        // WebView sẽ tiếp tục dùng model hiện tại (nếu có) thay vì load random model.
      }
    },
    [initialData, hasAppliedInitialModel]
  );

  useEffect(() => {
    if (
      initialData ||
      initialDataLoading ||
      initialDataError ||
      !authSnapshot.hasRestoredSession ||
      !authSnapshot.session
    ) {
      return;
    }

    bootstrapInitialData();
  }, [
    authSnapshot.hasRestoredSession,
    authSnapshot.session,
    bootstrapInitialData,
    initialData,
    initialDataLoading,
    initialDataError,
  ]);

  const value = useMemo(
    () => ({
      authState: authSnapshot,
      initialData,
      initialDataLoading,
      initialDataError,
      refreshInitialData,
      ensureInitialModelApplied,
      currentCharacter: currentCharacterState,
      setCurrentCharacterState,
      currentCostume,
      setCurrentCostume,
    }),
    [
      authSnapshot,
      initialData,
      initialDataLoading,
      initialDataError,
      refreshInitialData,
      ensureInitialModelApplied,
      currentCharacterState,
      currentCostume,
    ]
  );

  return <VRMContext.Provider value={value}>{children}</VRMContext.Provider>;
};



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
  type CharacterItem,
} from '../repositories/CharacterRepository';
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
  refreshInitialData: () => Promise<void>;
  ensureInitialModelApplied: (webViewRef: React.MutableRefObject<any>) => Promise<void>;
  currentCharacter: CharacterState | null;
  setCurrentCharacterState: React.Dispatch<React.SetStateAction<CharacterState | null>>;
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
    }
  }, [authSnapshot.session]);

  const seedPersistenceSelections = useCallback(
    async (character: CharacterItem, preference: InitialPreference) => {
      try {
        if (preference.costumeId) {
          const costumeMeta =
            await UserCharacterPreferenceService.loadCostumeMetadata(
              preference.costumeId
            );
          if (costumeMeta?.modelURL && costumeMeta.costumeName) {
            await Persistence.setModelName(costumeMeta.costumeName);
            await Persistence.setModelURL(costumeMeta.modelURL);
          } else {
            await Persistence.setModelName(character.name);
            await Persistence.setModelURL(character.base_model_url || '');
          }
        } else {
          await Persistence.setModelName(character.name);
          await Persistence.setModelURL(character.base_model_url || '');
        }

        if (preference.backgroundId) {
          const backgroundRepo = new BackgroundRepository();
          const background = await backgroundRepo.fetchBackground(
            preference.backgroundId
          );
          if (background?.image) {
            await Persistence.setBackgroundURL(background.image);
            await Persistence.setBackgroundName(background.name || '');
          }
        } else {
          await Persistence.setBackgroundURL('');
          await Persistence.setBackgroundName('');
        }
      } catch (error) {
        console.warn('[VRMProvider] seedPersistenceSelections error', error);
      }
    },
    []
  );

  const bootstrapInitialData = useCallback(async () => {
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
      setHasAppliedInitialModel(false);
    } catch (error) {
      const normalized =
        error instanceof Error ? error : new Error('Không thể tải dữ liệu ban đầu');
      setInitialDataError(normalized);
      setInitialData(null);
    } finally {
      setInitialDataLoading(false);
    }
  }, [authSnapshot.session, seedPersistenceSelections]);

  const refreshInitialData = useCallback(async () => {
    setInitialData(null);
    setInitialDataError(null);
    await bootstrapInitialData();
  }, [bootstrapInitialData]);

  const ensureInitialModelApplied = useCallback(
    async (webViewRef: React.MutableRefObject<any>) => {
      if (!initialData || hasAppliedInitialModel || !webViewRef.current) {
        return;
      }

      const { character, preference, ownedBackgroundIds } = initialData;
      const ownedBackgroundSet = new Set(ownedBackgroundIds);

      try {
        if (preference.backgroundId) {
          await UserCharacterPreferenceService.applyBackgroundById(
            preference.backgroundId,
            webViewRef,
            ownedBackgroundSet
          );
        }

        if (preference.costumeId) {
          await UserCharacterPreferenceService.applyCostumeById(
            preference.costumeId,
            webViewRef
          );
        } else {
          UserCharacterPreferenceService.loadFallbackModel(
            character.name,
            character.base_model_url || null,
            webViewRef
          );
        }

        setCurrentCharacterState({
          id: character.id,
          name: character.name,
          avatar: character.avatar || character.thumbnail_url,
          relationshipName: 'Stranger',
          relationshipProgress: 0,
        });

        setHasAppliedInitialModel(true);
      } catch (error) {
        console.error('[VRMProvider] Error applying initial model:', error);
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            (async()=>{
              try {
                await window.loadRandomFiles();
              } catch(e) {
                console.error('Failed to load random model:', e);
              }
            })();
          `);
        }
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
    }),
    [
      authSnapshot,
      initialData,
      initialDataLoading,
      initialDataError,
      refreshInitialData,
      ensureInitialModelApplied,
      currentCharacterState,
    ]
  );

  return <VRMContext.Provider value={value}>{children}</VRMContext.Provider>;
};



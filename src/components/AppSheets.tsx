import React from 'react';
import { QuestSheet } from './sheets/QuestSheet';
import { BackgroundSheet } from './sheets/BackgroundSheet';
import { CharacterSheet } from './sheets/CharacterSheet';
import { CostumeSheet } from './sheets/CostumeSheet';
import { MediaSheet } from './sheets/MediaSheet';
import { EnergySheet } from './sheets/EnergySheet';
import { LevelSheet } from './sheets/LevelSheet';
import { CharacterDetailSheet } from './sheets/CharacterDetailSheet';
import type { useQuests } from '../hooks/useQuests';
import type { CharacterItem } from '../repositories/CharacterRepository';
import type { BackgroundItem } from '../repositories/BackgroundRepository';
import type { CostumeItem } from '../repositories/CostumeRepository';

type AppSheetsProps = {
  // Quest Sheet
  showQuestSheet: boolean;
  setShowQuestSheet: (show: boolean) => void;
  quests: ReturnType<typeof useQuests>;
  questSheetTabRequest?: { tab: 'daily' | 'level'; token: number } | null;
  onRefreshLoginRewards?: () => void;

  // Background Sheet
  showBackgroundSheet: boolean;
  setShowBackgroundSheet: (show: boolean) => void;
  preloadedBackgrounds?: BackgroundItem[];
  preloadedOwnedBackgroundIds?: Set<string>;

  // Character Sheet
  showCharacterSheet: boolean;
  setShowCharacterSheet: (show: boolean) => void;
  preloadedCharacters?: CharacterItem[];
  preloadedOwnedCharacterIds?: Set<string>;

  // Costume Sheet
  showCostumeSheet: boolean;
  setShowCostumeSheet: (show: boolean) => void;
  activeCharacterId?: string;
  streakDays?: number;
  onOpenStreak?: () => void;
  preloadedCostumes?: CostumeItem[];
  preloadedOwnedCostumeIds?: Set<string>;

  // Media Sheet
  showMediaSheet: boolean;
  setShowMediaSheet: (show: boolean) => void;
  characterName?: string;

  // Character Detail Sheet
  showCharacterDetailSheet: boolean;
  setShowCharacterDetailSheet: (show: boolean) => void;
  characterAvatarURL?: string | null;
  characterDescription?: string | null;

  // Level Sheet
  showLevelSheet: boolean;
  setShowLevelSheet: (show: boolean) => void;
  level: number;
  xp: number;
  nextLevelXp: number;

  // Energy Sheet
  showEnergySheet: boolean;
  setShowEnergySheet: (show: boolean) => void;
  energy: number;
  energyMax: number;

  // Subscription
  onOpenSubscription?: () => void;

  // Theme
  isDarkBackground?: boolean;

  // Pro status
  isPro?: boolean;
  currentBackgroundId?: string | null;
};

export const AppSheets: React.FC<AppSheetsProps> = ({
  showQuestSheet,
  setShowQuestSheet,
  quests,
  questSheetTabRequest,
  onRefreshLoginRewards,
  showBackgroundSheet,
  setShowBackgroundSheet,
  showCharacterSheet,
  setShowCharacterSheet,
  showCostumeSheet,
  setShowCostumeSheet,
  activeCharacterId,
  streakDays,
  onOpenStreak,
  showMediaSheet,
  setShowMediaSheet,
  characterName,
  showCharacterDetailSheet,
  setShowCharacterDetailSheet,
  characterAvatarURL,
  characterDescription,
  showLevelSheet,
  setShowLevelSheet,
  level,
  xp,
  nextLevelXp,
  showEnergySheet,
  setShowEnergySheet,
  energy,
  energyMax,
  onOpenSubscription,
  isDarkBackground = true,
  isPro = false,
  currentBackgroundId,
  preloadedCharacters,
  preloadedOwnedCharacterIds,
  preloadedBackgrounds,
  preloadedOwnedBackgroundIds,
  preloadedCostumes,
  preloadedOwnedCostumeIds,
}) => {
  return (
    <>
      <BackgroundSheet
        isOpened={showBackgroundSheet}
        onIsOpenedChange={setShowBackgroundSheet}
        onOpenSubscription={onOpenSubscription}
        isDarkBackground={isDarkBackground}
        isPro={isPro}
        currentBackgroundId={currentBackgroundId}
        preloadedBackgrounds={preloadedBackgrounds}
        preloadedOwnedBackgroundIds={preloadedOwnedBackgroundIds}
      />
      <CharacterSheet
        isOpened={showCharacterSheet}
        onIsOpenedChange={setShowCharacterSheet}
        onOpenSubscription={onOpenSubscription}
        isDarkBackground={true}
        isPro={isPro}
        preloadedCharacters={preloadedCharacters}
        preloadedOwnedCharacterIds={preloadedOwnedCharacterIds}
      />
      <CostumeSheet
        isOpened={showCostumeSheet}
        onIsOpenedChange={setShowCostumeSheet}
        characterId={activeCharacterId}
        onOpenSubscription={onOpenSubscription}
        streakDays={streakDays}
        onOpenStreak={onOpenStreak}
        isDarkBackground={isDarkBackground}
        isPro={isPro}
        preloadedCostumes={preloadedCostumes}
        preloadedOwnedCostumeIds={preloadedOwnedCostumeIds}
      />
      <MediaSheet
        isOpened={showMediaSheet}
        onIsOpenedChange={setShowMediaSheet}
        characterId={activeCharacterId}
        characterName={characterName}
        onOpenSubscription={onOpenSubscription}
        isDarkBackground={isDarkBackground}
        isPro={isPro}
      />
      {activeCharacterId && (
        <CharacterDetailSheet
          isOpened={showCharacterDetailSheet}
          onIsOpenedChange={setShowCharacterDetailSheet}
          characterId={activeCharacterId}
          characterName={characterName || ''}
          characterAvatarURL={characterAvatarURL}
          characterDescription={characterDescription}
          isDarkBackground={isDarkBackground}
        />
      )}

      <EnergySheet
        isOpened={showEnergySheet}
        onIsOpenedChange={setShowEnergySheet}
        energy={energy}
        energyMax={energyMax}
      />
    </>
  );
};

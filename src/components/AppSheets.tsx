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

  // Character Sheet
  showCharacterSheet: boolean;
  setShowCharacterSheet: (show: boolean) => void;

  // Costume Sheet
  showCostumeSheet: boolean;
  setShowCostumeSheet: (show: boolean) => void;
  activeCharacterId?: string;
  streakDays?: number;
  onOpenStreak?: () => void;

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
}) => {
  return (
    <>
      <BackgroundSheet
        isOpened={showBackgroundSheet}
        onIsOpenedChange={setShowBackgroundSheet}
        onOpenSubscription={onOpenSubscription}
        isDarkBackground={isDarkBackground}
        isPro={isPro}
      />
      <CharacterSheet
        isOpened={showCharacterSheet}
        onIsOpenedChange={setShowCharacterSheet}
        onOpenSubscription={onOpenSubscription}
        isDarkBackground={true}
        isPro={isPro}
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
      <LevelSheet
        isOpened={showLevelSheet}
        onIsOpenedChange={setShowLevelSheet}
        level={level}
        xp={xp}
        nextLevelXp={nextLevelXp}
      />
      <EnergySheet
        isOpened={showEnergySheet}
        onIsOpenedChange={setShowEnergySheet}
        energy={energy}
        energyMax={energyMax}
      />
      <QuestSheet
        isOpened={showQuestSheet}
        onIsOpenedChange={setShowQuestSheet}
        dailyState={quests.daily}
        levelState={quests.level}
        onRefreshDaily={quests.refreshDaily}
        onClaimDaily={quests.claimDailyQuest}
        onClaimLevel={quests.claimLevelQuest}
        level={level}
        xp={xp}
        nextLevelXp={nextLevelXp}
        initialTabRequest={questSheetTabRequest ?? undefined}
        onRefreshLoginRewards={onRefreshLoginRewards}
      />
    </>
  );
};

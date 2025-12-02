import React from 'react';
import { QuestSheet } from './sheets/QuestSheet';
import { BackgroundSheet } from './sheets/BackgroundSheet';
import { CharacterSheet } from './sheets/CharacterSheet';
import { CostumeSheet } from './sheets/CostumeSheet';
import { MediaSheet } from './sheets/MediaSheet';
import { EnergySheet } from './sheets/EnergySheet';
import { LevelSheet } from './sheets/LevelSheet';
import { CharacterDetailSheet } from './sheets/CharacterDetailSheet';
import { LoginRewardCalendarModal } from './sheets/LoginRewardCalendarModal';
import type { useQuests } from '../hooks/useQuests';
import type { useLoginRewards } from '../hooks/useLoginRewards';

type AppSheetsProps = {
  // Quest Sheet
  showQuestSheet: boolean;
  setShowQuestSheet: (show: boolean) => void;
  quests: ReturnType<typeof useQuests>;

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

  // Login Rewards
  showLoginRewardsSheet: boolean;
  setShowLoginRewardsSheet: (show: boolean) => void;
  loginRewardState: ReturnType<typeof useLoginRewards>['state'];
  loadLoginRewards: () => Promise<void>;
  claimLoginReward: () => Promise<import('../hooks/useLoginRewards').ClaimResult>;
  isClaimingLoginReward: boolean;
  onClaimLoginReward: () => Promise<void>;
};

export const AppSheets: React.FC<AppSheetsProps> = ({
  showQuestSheet,
  setShowQuestSheet,
  quests,
  showBackgroundSheet,
  setShowBackgroundSheet,
  showCharacterSheet,
  setShowCharacterSheet,
  showCostumeSheet,
  setShowCostumeSheet,
  activeCharacterId,
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
  showLoginRewardsSheet,
  setShowLoginRewardsSheet,
  loginRewardState,
  loadLoginRewards,
  claimLoginReward,
  isClaimingLoginReward,
  onClaimLoginReward,
}) => {
  return (
    <>
      <BackgroundSheet
        isOpened={showBackgroundSheet}
        onIsOpenedChange={setShowBackgroundSheet}
      />
      <CharacterSheet
        isOpened={showCharacterSheet}
        onIsOpenedChange={setShowCharacterSheet}
      />
      <CostumeSheet
        isOpened={showCostumeSheet}
        onIsOpenedChange={setShowCostumeSheet}
        characterId={activeCharacterId}
      />
      <MediaSheet
        isOpened={showMediaSheet}
        onIsOpenedChange={setShowMediaSheet}
        characterId={activeCharacterId}
        characterName={characterName}
      />
      {activeCharacterId && (
        <CharacterDetailSheet
          isOpened={showCharacterDetailSheet}
          onIsOpenedChange={setShowCharacterDetailSheet}
          characterId={activeCharacterId}
          characterName={characterName || ''}
          characterAvatarURL={characterAvatarURL}
          characterDescription={characterDescription}
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
      />
      <LoginRewardCalendarModal
        visible={showLoginRewardsSheet}
        onClose={() => setShowLoginRewardsSheet(false)}
        rewards={loginRewardState.rewards}
        currentDay={loginRewardState.currentDay}
        canClaimToday={loginRewardState.canClaimToday}
        hasClaimedToday={loginRewardState.hasClaimedToday}
        isLoading={loginRewardState.isLoading}
        error={loginRewardState.error}
        onReload={loadLoginRewards}
        onClaim={onClaimLoginReward}
        isClaiming={isClaimingLoginReward}
      />
    </>
  );
};


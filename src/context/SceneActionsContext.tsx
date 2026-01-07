import { createContext, useContext } from 'react';
import type { CharacterItem } from '../repositories/CharacterRepository';
import type { BackgroundItem } from '../repositories/BackgroundRepository';
import type { CostumeItem } from '../repositories/CostumeRepository';

export type SceneActions = {
  selectCharacter: (item: CharacterItem) => Promise<void>;
  selectBackground: (item: BackgroundItem) => Promise<void>;
  selectCostume: (item: CostumeItem) => Promise<void>;
  openSubscription: () => void;
};

const SceneActionsContext = createContext<SceneActions | null>(null);

export const SceneActionsProvider: React.FC<{
  value: SceneActions;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <SceneActionsContext.Provider value={value}>{children}</SceneActionsContext.Provider>
);

export const useSceneActions = (): SceneActions => {
  const ctx = useContext(SceneActionsContext);
  if (!ctx) {
    throw new Error('useSceneActions must be used within SceneActionsProvider');
  }
  return ctx;
};



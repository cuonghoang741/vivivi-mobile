import { CharacterRepository, type CharacterItem } from './CharacterRepository';
import { BackgroundRepository, type BackgroundItem } from './BackgroundRepository';
import { CurrencyRepository, type CurrencyBalance } from './CurrencyRepository';

// Export all repositories
export { BaseRepository } from './BaseRepository';
export { CharacterRepository, type CharacterItem } from './CharacterRepository';
export { BackgroundRepository, type BackgroundItem } from './BackgroundRepository';
export { CurrencyRepository, type CurrencyBalance } from './CurrencyRepository';
export { MediaRepository, type MediaItem } from './MediaRepository';
export {
  UserStatsRepository,
  type UserStatsRow,
  userStatsRepository,
} from './UserStatsRepository';

// Create singleton instances
export const characterRepository = new CharacterRepository();
export const backgroundRepository = new BackgroundRepository();
export const currencyRepository = new CurrencyRepository();


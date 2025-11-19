// Export all repositories
export { BaseRepository } from './BaseRepository';
export { CharacterRepository, type CharacterItem } from './CharacterRepository';
export { BackgroundRepository, type BackgroundItem } from './BackgroundRepository';
export { CurrencyRepository, type CurrencyBalance } from './CurrencyRepository';

// Create singleton instances
export const characterRepository = new CharacterRepository();
export const backgroundRepository = new BackgroundRepository();
export const currencyRepository = new CurrencyRepository();


// Supabase Configuration
// Load from environment variables (EXPO_PUBLIC_* are available in Expo)
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://cjtghurczxqheqwegpiy.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdGdodXJjenhxaGVxd2VncGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzODAwMTAsImV4cCI6MjA3ODk1NjAxMH0.l2IvbVrPipNQpGxQrRNCBRDfxyZCOO756PNFABYPOCQ';

// Persistence Keys (similar to Swift version)
export const PersistKeys = {
  characterId: 'persist.characterId',
  modelName: 'persist.modelName',
  modelURL: 'persist.modelURL',
  backgroundURL: 'persist.backgroundURL',
  backgroundName: 'persist.backgroundName',
  clientId: 'persist.clientId',
  hasRatedApp: 'persist.hasRatedApp',
  lastReviewPromptAt: 'persist.lastReviewPromptAt',
  ageVerified18: 'persist.ageVerified18',
  guestMode: 'persist.guestMode',
  hasCompletedImageOnboarding: 'persist.hasCompletedImageOnboarding',
  hasSeenImageOnboarding: 'persist.hasSeenImageOnboarding',
  hasClaimedWelcomeGift: 'persist.hasClaimedWelcomeGift',
};


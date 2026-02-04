// Supabase Configuration
// Load from environment variables (EXPO_PUBLIC_* are available in Expo)
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://nechphdcnvhzcshytszt.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lY2hwaGRjbnZoemNzaHl0c3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNTkzNzUsImV4cCI6MjA4NDkzNTM3NX0.zd_Fuu5IYxuNimgFJQE9_j1poSfngB3G_o5uQWv0kAY';

export const APP_SCHEME = process.env.EXPO_PUBLIC_APP_SCHEME || 'evee';
export const AUTH_REDIRECT_PATH = 'auth/callback';

// Persistence Keys (similar to Swift version)
export const PersistKeys = {
  characterId: 'persist.characterId',
  modelName: 'persist.modelName',
  modelURL: 'persist.modelURL',
  backgroundURL: 'persist.backgroundURL',
  backgroundName: 'persist.backgroundName',
  backgroundSelections: 'persist.backgroundSelections',
  costumeSelections: 'persist.costumeSelections',
  clientId: 'persist.clientId',
  hasRatedApp: 'persist.hasRatedApp',
  lastReviewPromptAt: 'persist.lastReviewPromptAt',
  ageVerified18: 'persist.ageVerified18',
  hasCompletedOnboardingV2: 'persist.hasCompletedOnboardingV2',
};


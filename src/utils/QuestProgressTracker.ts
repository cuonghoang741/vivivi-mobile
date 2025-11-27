import { QuestService } from '../services/QuestService';

type TrackDelegate = (questType: string, increment?: number) => Promise<void>;

const QUEST_TYPE_MAP = {
  swipe_character: 'swipe_character',
  swipe_background: 'swipe_background',
  video_call: 'video_call',
  voice_call: 'voice_call',
  chat_streak: 'chat_streak',
  unlock_character: 'unlock_character',
  unlock_costume: 'unlock_costume',
  unlock_background: 'unlock_background',
  make_payment: 'make_payment',
  obtain_backgrounds: 'obtain_backgrounds',
  obtain_characters: 'obtain_characters',
  capture_characters: 'capture_characters',
  capture_backgrounds: 'capture_backgrounds',
  dance_character: 'dance_character',
  obtain_media: 'obtain_media',
  reach_relationship: 'reach_relationship',
  login_streak: 'login_streak',
} as const;

export type QuestAction = keyof typeof QUEST_TYPE_MAP;

const COLLECTION_THRESHOLDS = [5, 10];

class QuestProgressTrackerImpl {
  private questService = new QuestService();
  private delegate?: TrackDelegate;

  setDelegate(delegate?: TrackDelegate | null) {
    this.delegate = delegate ?? undefined;
  }

  async track(action: QuestAction, increment = 1) {
    if (increment <= 0) {
      return;
    }
    const questType = QUEST_TYPE_MAP[action];
    await this.trackQuestType(questType, increment);
  }

  async trackMany(actions: QuestAction[], increment = 1) {
    await Promise.all(actions.map(action => this.track(action, increment)));
  }

  async trackQuestType(questType: string, increment = 1) {
    if (!questType || increment <= 0) {
      return;
    }
    try {
      if (this.delegate) {
        await this.delegate(questType, increment);
      } else {
        await this.questService.trackQuestProgress(questType, increment);
      }
    } catch (error) {
      console.warn('[QuestProgressTracker] track failed:', error);
    }
  }

  shouldTrackCollectionMilestone(count: number, thresholds: number[] = COLLECTION_THRESHOLDS) {
    if (!Number.isFinite(count)) {
      return false;
    }
    return thresholds.includes(count);
  }
}

export const QuestProgressTracker = new QuestProgressTrackerImpl();


import { Audio } from 'expo-av';

const MUSIC_URL = 'https://pub-14a49f54cd754145a7362876730a1a52.r2.dev/sensual-escape-139637.mp3';

class BackgroundMusicManager {
  private static instance: BackgroundMusicManager;
  private sound: Audio.Sound | null = null;
  private isPlaying: boolean = false;

  private constructor() {}

  static getInstance(): BackgroundMusicManager {
    if (!BackgroundMusicManager.instance) {
      BackgroundMusicManager.instance = new BackgroundMusicManager();
    }
    return BackgroundMusicManager.instance;
  }

  async ensureSound() {
    if (this.sound) {
      return;
    }

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: MUSIC_URL },
        { shouldPlay: false, isLooping: true, volume: 1.0 }
      );
      this.sound = sound;
    } catch (error) {
      console.warn('[BackgroundMusicManager] Failed to load music:', error);
    }
  }

  async play() {
    try {
      await this.ensureSound();
      if (this.sound) {
        await this.sound.setVolumeAsync(1.0);
        await this.sound.playAsync();
        this.isPlaying = true;
        console.log('🔊 [BackgroundMusicManager] Music started');
      }
    } catch (error) {
      console.warn('[BackgroundMusicManager] Failed to play music:', error);
      this.isPlaying = false;
    }
  }

  async pause() {
    try {
      if (this.sound) {
        await this.sound.pauseAsync();
        this.isPlaying = false;
        console.log('🔇 [BackgroundMusicManager] Music paused');
      }
    } catch (error) {
      console.warn('[BackgroundMusicManager] Failed to pause music:', error);
    }
  }

  async toggle(): Promise<boolean> {
    if (this.isPlaying) {
      await this.pause();
      return false;
    } else {
      await this.play();
      return true;
    }
  }

  getPlaying(): boolean {
    return this.isPlaying;
  }

  async setVolume(volume: number) {
    try {
      if (this.sound) {
        await this.sound.setVolumeAsync(Math.max(0, Math.min(1, volume)));
      }
    } catch (error) {
      console.warn('[BackgroundMusicManager] Failed to set volume:', error);
    }
  }

  async unload() {
    try {
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
        this.isPlaying = false;
      }
    } catch (error) {
      console.warn('[BackgroundMusicManager] Failed to unload music:', error);
    }
  }
}

export const backgroundMusicManager = BackgroundMusicManager.getInstance();


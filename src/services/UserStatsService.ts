
import {
  userStatsRepository,
  type UserStatsRow,
} from '../repositories/UserStatsRepository';

export type UserStats = {
  level: number;
  xp: number;
  nextLevelXp: number;
  energy: number;
  energyMax: number;
  loginStreak: number;
};

const ENERGY_MAX = 100;
const ENERGY_REGEN_MINUTES = 6;

const DEFAULT_STATS: UserStats = {
  level: 1,
  xp: 0,
  nextLevelXp: 100,
  energy: ENERGY_MAX,
  energyMax: ENERGY_MAX,
  loginStreak: 0,
};

class UserStatsService {
  async fetchStats(): Promise<UserStats> {
    try {
      let row = await userStatsRepository.fetchStats();
      if (!row) {
        row = await userStatsRepository.createDefaultStats();
      }

      return await this.mapRowToStats(row);
    } catch (error) {
      console.error('[UserStatsService] Failed to fetch stats:', error);
        return DEFAULT_STATS;
      }
  }

  private async mapRowToStats(row: UserStatsRow): Promise<UserStats> {
    const xp = row.xp ?? DEFAULT_STATS.xp;
    const level = row.level ?? this.calculateLevelFromXp(xp);

    const regenResult = this.regenerateEnergy(row.energy, row.energy_updated_at);
    if (regenResult.shouldPersist) {
      try {
        await userStatsRepository.updateStats({
          energy: regenResult.energy,
          energy_updated_at: regenResult.updatedAt,
        });
      } catch (error) {
        console.warn('[UserStatsService] Unable to persist regenerated energy:', error);
      }
    }

      return {
        level,
        xp,
      nextLevelXp: this.calculateNextLevelXp(level),
      energy: regenResult.energy,
      energyMax: ENERGY_MAX,
      loginStreak: row.login_streak ?? DEFAULT_STATS.loginStreak,
      };
  }

  private regenerateEnergy(
    energyValue: number | null,
    lastUpdatedISO: string | null
  ): { energy: number; updatedAt: string; shouldPersist: boolean } {
    const now = new Date();
    const currentEnergy = this.clamp(energyValue ?? ENERGY_MAX, 0, ENERGY_MAX);

    let shouldPersist = false;
    let updatedAt = lastUpdatedISO ? new Date(lastUpdatedISO) : null;

    if (!updatedAt) {
      updatedAt = now;
      shouldPersist = true;
    }

    let energy = currentEnergy;
    if (energy < ENERGY_MAX && updatedAt) {
      const diffMinutes = Math.floor((now.getTime() - updatedAt.getTime()) / 60000);
      const regenerated = Math.floor(diffMinutes / ENERGY_REGEN_MINUTES);

      if (regenerated > 0) {
        energy = this.clamp(energy + regenerated, 0, ENERGY_MAX);
        updatedAt = now;
        shouldPersist = true;
      }
    }

    return { energy, updatedAt: updatedAt.toISOString(), shouldPersist };
  }

  private calculateLevelFromXp(xp: number): number {
    const safeXp = Math.max(0, xp);
    return Math.floor(Math.sqrt(safeXp / 100)) + 1;
  }

  private calculateNextLevelXp(level: number): number {
    const safeLevel = Math.max(1, level);
    return safeLevel * safeLevel * 100;
    }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * Consume energy - returns true if successful, false if not enough energy
   * Matching Swift version's consumeEnergy
   */
  async consumeEnergy(amount: number): Promise<boolean> {
    try {
      let row = await userStatsRepository.fetchStats();
      if (!row) {
        row = await userStatsRepository.createDefaultStats();
      }

      const regenResult = this.regenerateEnergy(row.energy, row.energy_updated_at);
      const currentEnergy = regenResult.energy;

      if (currentEnergy < amount) {
        console.log(`⚡ Not enough energy: ${currentEnergy}/${amount}`);
        return false;
      }

      const newEnergy = currentEnergy - amount;
      console.log(`⚡ Consuming ${amount} energy (remaining: ${newEnergy})`);

      await userStatsRepository.updateStats({
        energy: newEnergy,
        energy_updated_at: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error('[UserStatsService] Failed to consume energy:', error);
      return false;
    }
  }

  /**
   * Refill energy - adds energy up to max (100)
   * Matching Swift version's refillEnergy
   */
  async refillEnergy(amount: number): Promise<void> {
    try {
      let row = await userStatsRepository.fetchStats();
      if (!row) {
        row = await userStatsRepository.createDefaultStats();
      }

      const regenResult = this.regenerateEnergy(row.energy, row.energy_updated_at);
      const currentEnergy = regenResult.energy;

      const newEnergy = Math.min(ENERGY_MAX, currentEnergy + amount);
      const added = newEnergy - currentEnergy;

      if (added > 0) {
        console.log(`⚡ Refilling ${added} energy (new total: ${newEnergy})`);
        await userStatsRepository.updateStats({
          energy: newEnergy,
          energy_updated_at: new Date().toISOString(),
        });
      } else {
        console.log(`⚡ Energy already at max (${ENERGY_MAX})`);
      }
    } catch (error) {
      console.error('[UserStatsService] Failed to refill energy:', error);
    }
  }
}

export const userStatsService = new UserStatsService();


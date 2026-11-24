import { ActiveRunState } from '../../app/GameState';
import { ECONOMY_CONFIG, getXpRequiredForLevel } from '../config/balance';
import { RUN_BOONS, RunBoonDefinition } from '../config/items';
import { SaveData } from '../persistence/SaveData';
import { computePlayerStats } from '../player/PlayerStats';
import { SeededRandom } from '../world/SeededRandom';

export class RunManager {
  public activeRun: ActiveRunState | null = null;

  startNewRun(save: SaveData, customSeed?: string, startFloor = 1): ActiveRunState {
    const seed =
      customSeed && customSeed.trim().length > 0
        ? customSeed.trim()
        : `SPIRE-${Math.floor(100000 + Math.random() * 900000)}`;

    const stats = computePlayerStats(save, {});
    const clampedFloor = Math.max(1, Math.floor(startFloor));

    this.activeRun = {
      seed,
      floor: clampedFloor,
      endlessMode: clampedFloor > ECONOMY_CONFIG.standardTowerFloors,
      runCoinsEarned: 0,
      runEnemiesDefeated: 0,
      runFloorsCleared: 0,
      runLevel: 1,
      runXp: 0,
      runXpToNext: getXpRequiredForLevel(1),
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      shield: 0,
      extraLives: 0,
      tonicsLeft: save.consumables.sky_tonic ?? 0,
      boonCounts: {},
      pendingBoonChoices: [],
      elapsedSeconds: 0,
      objectiveText: 'Defeat Constructs to unlock the Ascent Gate',
      objectiveProgress: '0 / 1',
      portalUnlocked: false,
    };

    return this.activeRun;
  }

  awardRunXp(xp: number): boolean {
    if (!this.activeRun || xp <= 0) return false;
    this.activeRun.runXp += xp;
    let triggeredBoon = false;

    while (this.activeRun.runXp >= this.activeRun.runXpToNext) {
      this.activeRun.runXp -= this.activeRun.runXpToNext;
      this.activeRun.runLevel += 1;
      this.activeRun.runXpToNext = getXpRequiredForLevel(this.activeRun.runLevel);
      this.rollBoonChoices();
      triggeredBoon = true;
    }

    return triggeredBoon;
  }

  rollBoonChoices(): RunBoonDefinition[] {
    if (!this.activeRun) return [];
    const rng = new SeededRandom(
      `${this.activeRun.seed}::boon_${this.activeRun.runLevel}_${this.activeRun.floor}`
    );
    const shuffled = rng.shuffle(RUN_BOONS);
    this.activeRun.pendingBoonChoices = shuffled.slice(0, 3);
    return this.activeRun.pendingBoonChoices;
  }

  applyBoonChoice(boonId: string, save: SaveData): void {
    if (!this.activeRun) return;
    this.activeRun.boonCounts[boonId] = (this.activeRun.boonCounts[boonId] ?? 0) + 1;
    this.activeRun.pendingBoonChoices = [];

    const prevMax = this.activeRun.maxHp;
    const nextStats = computePlayerStats(save, this.activeRun.boonCounts);
    this.activeRun.maxHp = nextStats.maxHp;

    if (boonId === 'sky_vitality') {
      const gainedMax = Math.max(0, nextStats.maxHp - prevMax);
      this.activeRun.hp = Math.min(this.activeRun.maxHp, this.activeRun.hp + gainedMax + 35);
    } else if (boonId === 'extra_life') {
      this.activeRun.extraLives += 1;
    }
  }

  clearRun(): void {
    this.activeRun = null;
  }
}

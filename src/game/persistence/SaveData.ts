import { ECONOMY_CONFIG } from '../config/balance';
import { SKILLS } from '../config/skills';
import { SKINS, UPGRADES } from '../config/items';

export const CURRENT_SAVE_VERSION = 2;
export const SAVE_STORAGE_KEY = 'cloudspire_ascent_save_v2';
export const LEGACY_SAVE_STORAGE_KEYS = ['cloudspire_ascent_save_v1', 'cloudspire_save'];

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface SaveSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  uiVolume: number;
  mouseSensitivity: number;
  graphicsQuality: GraphicsQuality;
  showFps: boolean;
  screenShake: boolean;
  shakeStrength: number;
  reduceFlashing: boolean;
  uiScale: number;
}

export interface SaveStats {
  runsStarted: number;
  runsCompleted: number;
  floorsCleared: number;
  enemiesDefeated: number;
  totalCurrencyEarned: number;
  highestFloor: number;
  accountLevel: number;
  accountXp: number;
}

export interface SaveData {
  version: number;
  currency: number;
  upgrades: Record<string, number>;
  ownedSkills: string[];
  equippedSkills: string[]; // [slotQ, slotE]
  ownedSkins: string[];
  equippedSkin: string;
  ownedWeapons: string[];
  equippedWeapon: string;
  consumables: Record<string, number>;
  claimedQuests: string[];
  settings: SaveSettings;
  stats: SaveStats;
}

export function createDefaultSaveData(): SaveData {
  const upgrades: Record<string, number> = {};
  for (const id of Object.keys(UPGRADES)) {
    upgrades[id] = 0;
  }

  const starterSkills = Object.values(SKILLS)
    .filter((s) => s.starterOwned)
    .map((s) => s.id);

  const starterSkins = Object.values(SKINS)
    .filter((s) => s.starterOwned)
    .map((s) => s.id);

  return {
    version: CURRENT_SAVE_VERSION,
    currency: ECONOMY_CONFIG.startingCoins,
    upgrades,
    ownedSkills: starterSkills.length > 0 ? starterSkills : ['phase_dash', 'starlight_bolt'],
    equippedSkills: ['phase_dash', 'starlight_bolt'],
    ownedSkins: starterSkins.length > 0 ? starterSkins : ['shadow_runner'],
    equippedSkin: 'shadow_runner',
    ownedWeapons: ['skyblade'],
    equippedWeapon: 'skyblade',
    consumables: { sky_tonic: 1 },
    claimedQuests: [],
    settings: {
      masterVolume: 0.8,
      musicVolume: 0.55,
      sfxVolume: 0.8,
      ambienceVolume: 0.65,
      uiVolume: 0.8,
      mouseSensitivity: 0.8,
      graphicsQuality: 'high',
      showFps: false,
      screenShake: true,
      shakeStrength: 1.0,
      reduceFlashing: false,
      uiScale: 1.0,
    },
    stats: {
      runsStarted: 0,
      runsCompleted: 0,
      floorsCleared: 0,
      enemiesDefeated: 0,
      totalCurrencyEarned: 0,
      highestFloor: 0,
      accountLevel: 1,
      accountXp: 0,
    },
  };
}

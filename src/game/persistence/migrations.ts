import { SKILLS } from '../config/skills';
import { CONSUMABLES, QUESTS, SKINS, UPGRADES, WEAPONS } from '../config/items';
import {
  CURRENT_SAVE_VERSION,
  GraphicsQuality,
  SaveData,
  createDefaultSaveData,
} from './SaveData';

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.min(max, Math.max(min, val));
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  return Math.floor(clampNumber(val, min, max, fallback));
}

/**
 * Upgrades raw parsed JSON from older save schema versions (v0/unversioned, v1)
 * to CURRENT_SAVE_VERSION, then sanitizes every field so malformed saves never crash.
 */
export function migrateAndValidateSave(raw: unknown): SaveData {
  const defaults = createDefaultSaveData();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaults;
  }

  const src = { ...(raw as Record<string, any>) };
  const rawVersion = typeof src.version === 'number' ? src.version : 0;

  if (rawVersion < 1) {
    if (typeof src.coins === 'number' && typeof src.currency !== 'number') {
      src.currency = src.coins;
    }
    if (typeof src.skin === 'string' && typeof src.equippedSkin !== 'string') {
      src.equippedSkin = src.skin;
    }
    src.version = 1;
  }

  if (src.version === 1) {
    if (!src.consumables || typeof src.consumables !== 'object') {
      src.consumables = { sky_tonic: 1 };
    }
    if (!Array.isArray(src.claimedQuests)) {
      src.claimedQuests = [];
    }
    if (src.settings && typeof src.settings === 'object') {
      if (typeof src.settings.musicVolume !== 'number') src.settings.musicVolume = 0.55;
      if (typeof src.settings.sfxVolume !== 'number') src.settings.sfxVolume = 0.8;
      if (typeof src.settings.screenShake !== 'boolean') src.settings.screenShake = true;
    }
    src.version = CURRENT_SAVE_VERSION;
  }

  const currency = clampInt(src.currency, 0, 9_999_999, defaults.currency);

  const upgrades: Record<string, number> = { ...defaults.upgrades };
  if (src.upgrades && typeof src.upgrades === 'object' && !Array.isArray(src.upgrades)) {
    for (const [id, def] of Object.entries(UPGRADES)) {
      upgrades[id] = clampInt(src.upgrades[id], 0, def.maxLevel, 0);
    }
  }

  const validOwnedSkills = new Set<string>(defaults.ownedSkills);
  if (Array.isArray(src.ownedSkills)) {
    for (const item of src.ownedSkills) {
      if (typeof item === 'string' && SKILLS[item]) {
        validOwnedSkills.add(item);
      }
    }
  }
  const ownedSkills = Array.from(validOwnedSkills);

  const equippedSkills: string[] = [];
  if (Array.isArray(src.equippedSkills)) {
    for (const item of src.equippedSkills) {
      if (
        typeof item === 'string' &&
        validOwnedSkills.has(item) &&
        SKILLS[item]?.kind === 'active' &&
        !equippedSkills.includes(item) &&
        equippedSkills.length < 2
      ) {
        equippedSkills.push(item);
      }
    }
  }
  if (!Array.isArray(src.equippedSkills) || (rawVersion < 2 && equippedSkills.length === 0)) {
    for (const fallbackId of defaults.equippedSkills) {
      if (equippedSkills.length >= 2) break;
      if (validOwnedSkills.has(fallbackId) && !equippedSkills.includes(fallbackId)) {
        equippedSkills.push(fallbackId);
      }
    }
  }

  const validOwnedSkins = new Set<string>(defaults.ownedSkins);
  if (Array.isArray(src.ownedSkins)) {
    for (const item of src.ownedSkins) {
      if (typeof item === 'string' && SKINS[item]) {
        validOwnedSkins.add(item);
      }
    }
  }
  const ownedSkins = Array.from(validOwnedSkins);
  const equippedSkin =
    typeof src.equippedSkin === 'string' && validOwnedSkins.has(src.equippedSkin)
      ? src.equippedSkin
      : defaults.equippedSkin;

  const validOwnedWeapons = new Set<string>(defaults.ownedWeapons);
  if (Array.isArray(src.ownedWeapons)) {
    for (const item of src.ownedWeapons) {
      if (typeof item === 'string' && WEAPONS[item]) {
        validOwnedWeapons.add(item);
      }
    }
  }
  const ownedWeapons = Array.from(validOwnedWeapons);
  const equippedWeapon =
    typeof src.equippedWeapon === 'string' && validOwnedWeapons.has(src.equippedWeapon)
      ? src.equippedWeapon
      : defaults.equippedWeapon;

  const consumables: Record<string, number> = { ...defaults.consumables };
  if (src.consumables && typeof src.consumables === 'object' && !Array.isArray(src.consumables)) {
    for (const [id, def] of Object.entries(CONSUMABLES)) {
      consumables[id] = clampInt(src.consumables[id], 0, def.maxCarry, defaults.consumables[id] ?? 0);
    }
  }

  const validQuestIds = new Set(QUESTS.map((q) => q.id));
  const claimedQuests: string[] = [];
  if (Array.isArray(src.claimedQuests)) {
    for (const qId of src.claimedQuests) {
      if (typeof qId === 'string' && validQuestIds.has(qId) && !claimedQuests.includes(qId)) {
        claimedQuests.push(qId);
      }
    }
  }

  const rawSettings =
    src.settings && typeof src.settings === 'object' && !Array.isArray(src.settings)
      ? src.settings
      : {};
  const validQualities: GraphicsQuality[] = ['low', 'medium', 'high'];
  const graphicsQuality: GraphicsQuality = validQualities.includes(rawSettings.graphicsQuality)
    ? rawSettings.graphicsQuality
    : defaults.settings.graphicsQuality;

  const settings = {
    masterVolume: clampNumber(rawSettings.masterVolume, 0, 1, defaults.settings.masterVolume),
    musicVolume: clampNumber(rawSettings.musicVolume, 0, 1, defaults.settings.musicVolume),
    sfxVolume: clampNumber(rawSettings.sfxVolume, 0, 1, defaults.settings.sfxVolume),
    ambienceVolume: clampNumber(rawSettings.ambienceVolume, 0, 1, defaults.settings.ambienceVolume),
    uiVolume: clampNumber(rawSettings.uiVolume, 0, 1, defaults.settings.uiVolume),
    mouseSensitivity: clampNumber(
      rawSettings.mouseSensitivity,
      0.1,
      2.5,
      defaults.settings.mouseSensitivity
    ),
    graphicsQuality,
    showFps: typeof rawSettings.showFps === 'boolean' ? rawSettings.showFps : defaults.settings.showFps,
    screenShake:
      typeof rawSettings.screenShake === 'boolean'
        ? rawSettings.screenShake
        : defaults.settings.screenShake,
    shakeStrength: clampNumber(rawSettings.shakeStrength, 0, 1, defaults.settings.shakeStrength),
    reduceFlashing:
      typeof rawSettings.reduceFlashing === 'boolean'
        ? rawSettings.reduceFlashing
        : defaults.settings.reduceFlashing,
    uiScale: clampNumber(rawSettings.uiScale, 0.85, 1.3, defaults.settings.uiScale),
  };

  const rawStats =
    src.stats && typeof src.stats === 'object' && !Array.isArray(src.stats) ? src.stats : {};
  const stats = {
    runsStarted: clampInt(rawStats.runsStarted, 0, 1_000_000, 0),
    runsCompleted: clampInt(rawStats.runsCompleted, 0, 1_000_000, 0),
    floorsCleared: clampInt(rawStats.floorsCleared, 0, 1_000_000, 0),
    enemiesDefeated: clampInt(rawStats.enemiesDefeated, 0, 10_000_000, 0),
    totalCurrencyEarned: clampInt(rawStats.totalCurrencyEarned, 0, 99_999_999, 0),
    highestFloor: clampInt(rawStats.highestFloor, 0, 10_000, 0),
    accountLevel: clampInt(rawStats.accountLevel, 1, 999, 1),
    accountXp: clampInt(rawStats.accountXp, 0, 9_999_999, 0),
  };

  return {
    version: CURRENT_SAVE_VERSION,
    currency,
    upgrades,
    ownedSkills,
    equippedSkills,
    ownedSkins,
    equippedSkin,
    ownedWeapons,
    equippedWeapon,
    consumables,
    claimedQuests,
    settings,
    stats,
  };
}

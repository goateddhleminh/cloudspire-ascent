export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  icon: 'heart' | 'sword' | 'shoe' | 'clock' | 'magnet';
  accentColor: string;
  basePrice: number;
  priceStep: number;
  maxLevel: number;
  perLevelValue: number;
  unitLabel: string;
}

export interface SkinDefinition {
  id: string;
  name: string;
  description: string;
  price: number;
  starterOwned?: boolean;
  accentColor: string;
  // Visual palette on the 3D blocky character
  torsoColor: string;
  trimColor: string;
  limbColor: string;
  shoeColor: string;
  hairColor: string;
  skinTone: string;
  headgear: 'none' | 'crown' | 'visor' | 'halo' | 'void_horns';
  auraColor?: string;
}

export interface WeaponDefinition {
  id: 'skyblade' | 'storm_katana' | 'sunbreaker' | 'astral_halberd';
  modelKey: 'weapon_skyblade' | 'weapon_storm_katana' | 'weapon_sunbreaker' | 'weapon_astral_halberd';
  name: string;
  description: string;
  price: number;
  starterOwned?: boolean;
  accentColor: string;
  damageBonus: number;
  rangeBonus: number;
  attackSpeedBonus: number;
}

export interface ConsumableDefinition {
  id: string;
  name: string;
  description: string;
  price: number;
  maxCarry: number;
  healAmount: number;
  accentColor: string;
}

export interface RunBoonDefinition {
  id: string;
  name: string;
  subtitle: string;
  icon: 'shoe' | 'shield' | 'crown' | 'sword' | 'magnet' | 'bolt';
  borderColor: string;
  glowColor: string;
}

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  statKey: 'floorsCleared' | 'enemiesDefeated' | 'runsCompleted' | 'highestFloor';
  target: number;
  rewardCoins: number;
}

export interface RivalClimber {
  name: string;
  floor: number;
}

export const UPGRADES: Record<string, UpgradeDefinition> = {
  vitality_core: {
    id: 'vitality_core',
    name: 'Vitality Core',
    description: '+20 Max Health per rank.',
    icon: 'heart',
    accentColor: '#f43f5e',
    basePrice: 120,
    priceStep: 95,
    maxLevel: 5,
    perLevelValue: 20,
    unitLabel: '+20 HP',
  },
  skyblade_edge: {
    id: 'skyblade_edge',
    name: 'Skyblade Edge',
    description: '+15% Primary & Skill Damage per rank.',
    icon: 'sword',
    accentColor: '#38bdf8',
    basePrice: 140,
    priceStep: 110,
    maxLevel: 5,
    perLevelValue: 0.15,
    unitLabel: '+15% DMG',
  },
  tailwind_boots: {
    id: 'tailwind_boots',
    name: 'Tailwind Stride',
    description: '+7% Movement Speed per rank.',
    icon: 'shoe',
    accentColor: '#a855f7',
    basePrice: 110,
    priceStep: 85,
    maxLevel: 5,
    perLevelValue: 0.07,
    unitLabel: '+7% SPD',
  },
  chrono_matrix: {
    id: 'chrono_matrix',
    name: 'Chrono Matrix',
    description: '-8% Skill Cooldown time per rank.',
    icon: 'clock',
    accentColor: '#2dd4bf',
    basePrice: 150,
    priceStep: 115,
    maxLevel: 5,
    perLevelValue: 0.08,
    unitLabel: '-8% CD',
  },
  coin_magnet: {
    id: 'coin_magnet',
    name: 'Golden Magnet',
    description: 'Attract coins from afar & +12% Coin Value per rank.',
    icon: 'magnet',
    accentColor: '#fbbf24',
    basePrice: 130,
    priceStep: 100,
    maxLevel: 5,
    perLevelValue: 1,
    unitLabel: '+Radius & +12% Coins',
  },
};

export const UPGRADE_LIST: UpgradeDefinition[] = Object.values(UPGRADES);

export function getUpgradePrice(def: UpgradeDefinition, currentLevel: number): number {
  return def.basePrice + currentLevel * def.priceStep;
}

export const CONSUMABLES: Record<string, ConsumableDefinition> = {
  sky_tonic: {
    id: 'sky_tonic',
    name: 'Sky Tonic',
    description: 'Consumable [Key C]: Restores 45 HP instantly during a run (Max 3).',
    price: 85,
    maxCarry: 3,
    healAmount: 45,
    accentColor: '#34d399',
  },
};

export const SKINS: Record<string, SkinDefinition> = {
  shadow_runner: {
    id: 'shadow_runner',
    name: 'Shadow Vanguard',
    description: 'Sleek obsidian sky-runner jacket with starlight crest and white kicks.',
    price: 0,
    starterOwned: true,
    accentColor: '#60a5fa',
    torsoColor: '#181c28',
    trimColor: '#38bdf8',
    limbColor: '#141720',
    shoeColor: '#f1f5f9',
    hairColor: '#11131a',
    skinTone: '#f6d2b8',
    headgear: 'none',
  },
  golden_monarch: {
    id: 'golden_monarch',
    name: 'Golden Crown',
    description: 'Royal cobalt tunic crowned with a gleaming sovereign diadem & starlight aura.',
    price: 480,
    accentColor: '#fbbf24',
    torsoColor: '#1e2952',
    trimColor: '#3b82f6',
    limbColor: '#17203f',
    shoeColor: '#f8fafc',
    hairColor: '#161925',
    skinTone: '#f6d2b8',
    headgear: 'crown',
    auraColor: '#fbbf24',
  },
  cyber_pulse: {
    id: 'cyber_pulse',
    name: 'Hyperion Cyber',
    description: 'Neon cyan tech-armor with holographic visor and electric trail.',
    price: 380,
    accentColor: '#22d3ee',
    torsoColor: '#0f293a',
    trimColor: '#22d3ee',
    limbColor: '#0c1f2e',
    shoeColor: '#22d3ee',
    hairColor: '#e2e8f0',
    skinTone: '#f6d2b8',
    headgear: 'visor',
    auraColor: '#22d3ee',
  },
  emerald_warden: {
    id: 'emerald_warden',
    name: 'Canopy Ranger',
    description: 'Verdant sky-isle cloak with floating jade crystal halo.',
    price: 320,
    accentColor: '#4ade80',
    torsoColor: '#143829',
    trimColor: '#4ade80',
    limbColor: '#112920',
    shoeColor: '#fef3c7',
    hairColor: '#3f271d',
    skinTone: '#ecc3a5',
    headgear: 'halo',
    auraColor: '#4ade80',
  },
  astral_void: {
    id: 'astral_void',
    name: 'Astral Sovereign',
    description: 'Nebula-forged obsidian plate with twin void-star horns and violet sparks.',
    price: 600,
    accentColor: '#c084fc',
    torsoColor: '#231438',
    trimColor: '#c084fc',
    limbColor: '#180d29',
    shoeColor: '#e9d5ff',
    hairColor: '#f3e8ff',
    skinTone: '#e2d9f3',
    headgear: 'void_horns',
    auraColor: '#c084fc',
  },
};

export const SKIN_LIST: SkinDefinition[] = Object.values(SKINS);

export const WEAPONS: Record<string, WeaponDefinition> = {
  skyblade: {
    id: 'skyblade',
    modelKey: 'weapon_skyblade',
    name: 'Aether Skyblade',
    description: 'Balanced crystal broadsword forged with a winged golden guard.',
    price: 0,
    starterOwned: true,
    accentColor: '#38bdf8',
    damageBonus: 0,
    rangeBonus: 0,
    attackSpeedBonus: 0,
  },
  storm_katana: {
    id: 'storm_katana',
    modelKey: 'weapon_storm_katana',
    name: 'Tempest Katana',
    description: 'Curved plasma tachi: +18% Swing Speed & +8% Slash Damage.',
    price: 260,
    accentColor: '#22d3ee',
    damageBonus: 0.08,
    rangeBonus: 0.1,
    attackSpeedBonus: 0.18,
  },
  sunbreaker: {
    id: 'sunbreaker',
    modelKey: 'weapon_sunbreaker',
    name: 'Solar Claymore',
    description: 'Heavy sovereign greatsword: +22% Slash & Skill Damage.',
    price: 390,
    accentColor: '#fbbf24',
    damageBonus: 0.22,
    rangeBonus: 0.25,
    attackSpeedBonus: 0,
  },
  astral_halberd: {
    id: 'astral_halberd',
    modelKey: 'weapon_astral_halberd',
    name: 'Starfall Glaive',
    description: 'Celestial crescent polearm: +0.75m Strike Reach & +14% Damage.',
    price: 460,
    accentColor: '#c084fc',
    damageBonus: 0.14,
    rangeBonus: 0.75,
    attackSpeedBonus: 0.06,
  },
};

export const WEAPON_LIST: WeaponDefinition[] = Object.values(WEAPONS);

export const RUN_BOONS: RunBoonDefinition[] = [
  {
    id: 'swift_stride',
    name: '+15% Speed',
    subtitle: 'Move & strafe faster this run',
    icon: 'shoe',
    borderColor: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.35)',
  },
  {
    id: 'sky_vitality',
    name: '+25 Health',
    subtitle: 'Gain +25 Max HP & heal 35 HP',
    icon: 'shield',
    borderColor: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.35)',
  },
  {
    id: 'extra_life',
    name: '+1 Extra Life',
    subtitle: 'Revive once at 60% HP on defeat',
    icon: 'crown',
    borderColor: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.38)',
  },
  {
    id: 'blade_fury',
    name: '+20% Damage',
    subtitle: 'Boost Skyblade & skill power',
    icon: 'sword',
    borderColor: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.35)',
  },
  {
    id: 'golden_fortune',
    name: '+25% Coins',
    subtitle: 'Bonus Sky Coins from all drops',
    icon: 'magnet',
    borderColor: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.35)',
  },
  {
    id: 'storm_capacitor',
    name: '-18% Cooldowns',
    subtitle: 'Recharge active skills faster',
    icon: 'bolt',
    borderColor: '#2dd4bf',
    glowColor: 'rgba(45, 212, 191, 0.35)',
  },
];

export const QUESTS: QuestDefinition[] = [
  {
    id: 'quest_floors_3',
    title: 'Sky Initiate',
    description: 'Clear 3 Tower Floors across runs.',
    statKey: 'floorsCleared',
    target: 3,
    rewardCoins: 150,
  },
  {
    id: 'quest_foes_12',
    title: 'Sentinel Breaker',
    description: 'Defeat 12 Constructs in the Tower.',
    statKey: 'enemiesDefeated',
    target: 12,
    rewardCoins: 180,
  },
  {
    id: 'quest_summit_5',
    title: 'Cloudspire Conqueror',
    description: 'Reach Floor 5 (Solar Summit) or higher.',
    statKey: 'highestFloor',
    target: 5,
    rewardCoins: 300,
  },
  {
    id: 'quest_runs_1',
    title: 'Ascendant Champion',
    description: 'Complete a full 5-Floor Spire Run.',
    statKey: 'runsCompleted',
    target: 1,
    rewardCoins: 400,
  },
  {
    id: 'quest_floors_15',
    title: 'Veteran Climber',
    description: 'Clear 15 total Tower Floors.',
    statKey: 'floorsCleared',
    target: 15,
    rewardCoins: 500,
  },
];

export const RIVAL_CLIMBERS: RivalClimber[] = [
  { name: 'Astral', floor: 24 },
  { name: 'VoidRex', floor: 18 },
  { name: 'Zenith', floor: 14 },
  { name: 'Kaito', floor: 10 },
  { name: 'Dreamer', floor: 6 },
  { name: 'Nova', floor: 3 },
];

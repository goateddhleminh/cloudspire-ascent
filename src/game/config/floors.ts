export type RoomModuleType =
  | 'causeway_straight'
  | 'combat_arena'
  | 'stepping_isles'
  | 'twin_split_bridge'
  | 'laser_gauntlet'
  | 'elevated_terrace'
  | 'sky_garden_courtyard';

export type EnemyArchetypeId = 'striker' | 'sentinel' | 'bulwark' | 'warden_boss';

export interface FloorTheme {
  id: string;
  name: string;
  subtitle: string;
  skyTopColor: string;
  skyBottomColor: string;
  fogColor: string;
  stonePrimary: string;
  stoneSecondary: string;
  neonAccent: string;
  neonSecondary: string;
  foliageColor: string;
  ambientIntensity: number;
  sunColor: string;
}

export interface FloorConfig {
  floorNumber: number;
  theme: FloorTheme;
  moduleCount: number;
  allowedModules: RoomModuleType[];
  enemyPool: EnemyArchetypeId[];
  hasBoss: boolean;
  enemyHealthScale: number;
  enemyDamageScale: number;
  enemyCountBudget: number;
  hazardChance: number;
  coinMultiplier: number;
  requiredKillsRatio: number; // Ratio of floor enemies required to unlock exit portal
}

export const FLOOR_THEMES: FloorTheme[] = [
  {
    id: 'sunlit_causeway',
    name: 'Sunlit Causeway',
    subtitle: 'Reach the Ascent Gate!',
    skyTopColor: '#4889f0',
    skyBottomColor: '#b7d7fb',
    fogColor: '#a8cdf8',
    stonePrimary: '#94a3b8',
    stoneSecondary: '#64748b',
    neonAccent: '#38bdf8',
    neonSecondary: '#4ade80',
    foliageColor: '#4ade80',
    ambientIntensity: 0.85,
    sunColor: '#fff7ed',
  },
  {
    id: 'emerald_canopy',
    name: 'Emerald Sky Isles',
    subtitle: 'Cross the floating gardens!',
    skyTopColor: '#3b82f6',
    skyBottomColor: '#bae6fd',
    fogColor: '#a5d8f3',
    stonePrimary: '#8fa69b',
    stoneSecondary: '#5b7268',
    neonAccent: '#4ade80',
    neonSecondary: '#22d3ee',
    foliageColor: '#22c55e',
    ambientIntensity: 0.85,
    sunColor: '#fef9c3',
  },
  {
    id: 'neon_conduits',
    name: 'Aether Conduits',
    subtitle: 'Evade pulse beams & climb!',
    skyTopColor: '#3b66d4',
    skyBottomColor: '#a5b4fc',
    fogColor: '#9db4f6',
    stonePrimary: '#7c8ba6',
    stoneSecondary: '#475569',
    neonAccent: '#a855f7',
    neonSecondary: '#22d3ee',
    foliageColor: '#34d399',
    ambientIntensity: 0.8,
    sunColor: '#ede9fe',
  },
  {
    id: 'amethyst_sanctum',
    name: 'Twilight Citadel',
    subtitle: 'Break the construct blockade!',
    skyTopColor: '#312e81',
    skyBottomColor: '#93c5fd',
    fogColor: '#818cf8',
    stonePrimary: '#787b9c',
    stoneSecondary: '#4b4e6d',
    neonAccent: '#e879f9',
    neonSecondary: '#fbbf24',
    foliageColor: '#38bdf8',
    ambientIntensity: 0.78,
    sunColor: '#fae8ff',
  },
  {
    id: 'solar_summit',
    name: 'Solar Summit Bastion',
    subtitle: 'Defeat the Spire Warden!',
    skyTopColor: '#2563eb',
    skyBottomColor: '#fde68a',
    fogColor: '#bfdbfe',
    stonePrimary: '#9ca3af',
    stoneSecondary: '#6b7280',
    neonAccent: '#fbbf24',
    neonSecondary: '#c084fc',
    foliageColor: '#facc15',
    ambientIntensity: 0.9,
    sunColor: '#fef08a',
  },
];

export function getFloorConfig(floorNumber: number): FloorConfig {
  const clampedFloor = Math.max(1, Math.floor(floorNumber));
  const themeIndex = (clampedFloor - 1) % FLOOR_THEMES.length;
  const theme = FLOOR_THEMES[themeIndex];
  const isBossFloor = clampedFloor % 5 === 0;

  const moduleCount = isBossFloor
    ? 4
    : Math.min(7, 3 + Math.floor((clampedFloor + 1) / 2));

  const allowedModules: RoomModuleType[] =
    clampedFloor === 1
      ? ['causeway_straight', 'combat_arena', 'sky_garden_courtyard', 'stepping_isles']
      : clampedFloor === 2
        ? ['causeway_straight', 'stepping_isles', 'elevated_terrace', 'twin_split_bridge', 'sky_garden_courtyard']
        : [
            'causeway_straight',
            'combat_arena',
            'stepping_isles',
            'twin_split_bridge',
            'laser_gauntlet',
            'elevated_terrace',
            'sky_garden_courtyard',
          ];

  const enemyPool: EnemyArchetypeId[] =
    clampedFloor === 1
      ? ['striker', 'sentinel']
      : ['striker', 'sentinel', 'bulwark'];

  // Bounded scaling so endless floors remain playable and fair
  const tierSteps = Math.min(18, clampedFloor - 1);
  const enemyHealthScale = Number((1 + tierSteps * 0.16).toFixed(2));
  const enemyDamageScale = Number((1 + Math.min(12, tierSteps) * 0.11).toFixed(2));
  const enemyCountBudget = Math.min(14, 3 + Math.floor(clampedFloor * 1.4));
  const hazardChance = Math.min(0.85, 0.2 + tierSteps * 0.12);
  const coinMultiplier = Number((1 + tierSteps * 0.15).toFixed(2));

  return {
    floorNumber: clampedFloor,
    theme,
    moduleCount,
    allowedModules,
    enemyPool,
    hasBoss: isBossFloor,
    enemyHealthScale,
    enemyDamageScale,
    enemyCountBudget,
    hazardChance,
    coinMultiplier,
    requiredKillsRatio: isBossFloor ? 0.75 : 0.6,
  };
}

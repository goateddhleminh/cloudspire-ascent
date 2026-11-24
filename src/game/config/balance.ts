export const CONTROLLER_CONFIG = {
  baseMoveSpeed: 9.2,
  groundAcceleration: 48.0,
  groundDeceleration: 38.0,
  airAcceleration: 24.0,
  airDeceleration: 10.0,
  gravity: 30.0,
  jumpVelocity: 12.6,
  doubleJumpVelocity: 11.6,
  coyoteTime: 0.14,
  jumpBufferTime: 0.14,
  playerRadius: 0.52,
  playerHeight: 1.9,
  invulnerabilityDuration: 0.65,
  abyssFallY: -14.0,
  abyssRespawnDamageRatio: 0.15,

  // Primary 3-hit melee combo
  primaryBaseDamage: 24,
  primaryRange: 3.15,
  primaryArcDot: -0.15, // Wide generous front arc
  primaryCooldown: 0.30,
  comboResetTime: 0.95,
  comboMultipliers: [1.0, 1.18, 1.45] as const,

  // Camera
  cameraDistance: 7.8,
  cameraHeight: 3.35,
  cameraLookAheadY: 1.35,
  cameraFollowDamping: 14.0,
  cameraPitchMin: -0.25,
  cameraPitchMax: 1.05,

  // Juice / Game Feel
  traumaDecayPerSec: 1.5,
  maxFrameDelta: 0.05,
} as const;

export const ECONOMY_CONFIG = {
  startingCoins: 100,
  standardTowerFloors: 5,
  baseXpToLevel: 80,
  xpGrowthPerLevel: 35,
  floorClearBaseCoins: 65,
  floorClearPerFloorCoins: 30,
  towerCompletionBonusCoins: 220,
  tonicHealAmount: 45,
  maxTonicsCarried: 3,
} as const;

export function getXpRequiredForLevel(level: number): number {
  return ECONOMY_CONFIG.baseXpToLevel + Math.max(0, level - 1) * ECONOMY_CONFIG.xpGrowthPerLevel;
}

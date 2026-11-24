import { CONTROLLER_CONFIG } from '../config/balance';
import { SaveData } from '../persistence/SaveData';
import { SKILLS } from '../config/skills';
import { UPGRADES, WEAPONS } from '../config/items';

export interface ComputedPlayerStats {
  maxHp: number;
  moveSpeed: number;
  damageMultiplier: number;
  cooldownMultiplier: number;
  primaryRangeBonus: number;
  primaryCooldownMultiplier: number;
  pickupRadius: number;
  coinMultiplier: number;
  hasDoubleJump: boolean;
}

export function computePlayerStats(
  save: SaveData,
  boonCounts: Record<string, number> = {}
): ComputedPlayerStats {
  const vitLv = save.upgrades.vitality_core ?? 0;
  const dmgLv = save.upgrades.skyblade_edge ?? 0;
  const spdLv = save.upgrades.tailwind_boots ?? 0;
  const cdLv = save.upgrades.chrono_matrix ?? 0;
  const magLv = save.upgrades.coin_magnet ?? 0;

  const boonVit = boonCounts.sky_vitality ?? 0;
  const boonSpd = boonCounts.swift_stride ?? 0;
  const boonDmg = boonCounts.blade_fury ?? 0;
  const boonCoins = boonCounts.golden_fortune ?? 0;
  const boonCd = boonCounts.storm_capacitor ?? 0;

  const weapon = WEAPONS[save.equippedWeapon] ?? WEAPONS.skyblade;

  const maxHp = Math.min(450, 100 + vitLv * UPGRADES.vitality_core.perLevelValue + boonVit * 25);
  const moveSpeed = Math.min(
    16.5,
    CONTROLLER_CONFIG.baseMoveSpeed *
      (1 + spdLv * UPGRADES.tailwind_boots.perLevelValue + boonSpd * 0.15)
  );
  const damageMultiplier = Math.min(
    3.8,
    1 + dmgLv * UPGRADES.skyblade_edge.perLevelValue + boonDmg * 0.2 + weapon.damageBonus
  );

  const cooldownReduction = Math.min(
    0.62,
    cdLv * UPGRADES.chrono_matrix.perLevelValue + boonCd * 0.18
  );
  const cooldownMultiplier = Number((1 - cooldownReduction).toFixed(3));
  const primaryRangeBonus = weapon.rangeBonus;
  const primaryCooldownMultiplier = Number(
    (1 / (1 + Math.max(0, weapon.attackSpeedBonus))).toFixed(3)
  );

  const pickupRadius = 2.0 + magLv * 1.45;
  const coinMultiplier = Number((1 + magLv * 0.12 + boonCoins * 0.25).toFixed(2));
  const hasDoubleJump = save.ownedSkills.includes('double_jump') && Boolean(SKILLS.double_jump);

  return {
    maxHp,
    moveSpeed,
    damageMultiplier,
    cooldownMultiplier,
    primaryRangeBonus,
    primaryCooldownMultiplier,
    pickupRadius,
    coinMultiplier,
    hasDoubleJump,
  };
}

import { EnemyArchetypeId, FloorConfig, FloorTheme, RoomModuleType } from '../config/floors';
import { SeededRandom } from './SeededRandom';

export interface Vec3Spec {
  x: number;
  y: number;
  z: number;
}

export interface ColliderBox {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  kind: 'platform' | 'obstacle' | 'wall';
  neonTrim?: 'primary' | 'secondary' | 'gold' | 'none';
  stoneVariant?: 'primary' | 'secondary';
}

export interface JumpPadSpec {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  boostVelocityY: number;
  color: string;
}

export interface HazardSpec {
  id: string;
  kind: 'pulse_beam' | 'shock_ring';
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  damage: number;
  cycleSeconds: number;
  activeRatio: number;
  phaseOffset: number;
}

export interface EnemySpawnSpec {
  id: string;
  archetype: EnemyArchetypeId;
  x: number;
  y: number;
  z: number;
  patrolRadius: number;
  isTrainingDummy?: boolean;
}

export interface PickupSpec {
  id: string;
  kind: 'coin' | 'big_coin' | 'heal_orb';
  x: number;
  y: number;
  z: number;
  value: number;
}

export interface InteractableSpec {
  id: string;
  kind: 'portal' | 'chest' | 'shrine' | 'shop_kiosk' | 'armory_kiosk' | 'npc';
  x: number;
  y: number;
  z: number;
  radius: number;
  label: string;
  coinValue?: number;
  rotationY?: number;
  npcId?: 'zephyr' | 'lyra' | 'orin';
  npcName?: string;
  npcRole?: string;
  npcLines?: string[];
  npcAction?: 'shop' | 'inventory' | 'start_run';
}

export interface PropSpec {
  kind: 'sky_tree' | 'pillar' | 'neon_arch' | 'side_island' | 'summit_spire';
  x: number;
  y: number;
  z: number;
  scale?: number;
  rotationY?: number;
  accentColor?: string;
}

export interface SafeCheckpoint {
  x: number;
  y: number;
  z: number;
}

export interface FloorLayout {
  isHub: boolean;
  floorNumber: number;
  seedUsed: string;
  theme: FloorTheme;
  spawnPoint: Vec3Spec;
  exitPortalPos: Vec3Spec;
  requiredKills: number;
  moduleSequence: RoomModuleType[];
  colliders: ColliderBox[];
  jumpPads: JumpPadSpec[];
  hazards: HazardSpec[];
  enemies: EnemySpawnSpec[];
  pickups: PickupSpec[];
  interactables: InteractableSpec[];
  props: PropSpec[];
  checkpoints: SafeCheckpoint[];
}

export interface ModuleBuildContext {
  cursorZ: number;
  cursorY: number;
  rng: SeededRandom;
  config: FloorConfig;
  moduleIndex: number;
  colliders: ColliderBox[];
  jumpPads: JumpPadSpec[];
  hazards: HazardSpec[];
  enemies: EnemySpawnSpec[];
  pickups: PickupSpec[];
  interactables: InteractableSpec[];
  props: PropSpec[];
  checkpoints: SafeCheckpoint[];
}

function makePlatform(
  id: string,
  cx: number,
  topY: number,
  cz: number,
  width: number,
  depth: number,
  thickness = 1.8,
  neonTrim: ColliderBox['neonTrim'] = 'primary',
  stoneVariant: ColliderBox['stoneVariant'] = 'primary'
): ColliderBox {
  return {
    id,
    minX: cx - width / 2,
    maxX: cx + width / 2,
    minY: topY - thickness,
    maxY: topY,
    minZ: cz - depth / 2,
    maxZ: cz + depth / 2,
    kind: 'platform',
    neonTrim,
    stoneVariant,
  };
}

function makeObstacle(
  id: string,
  cx: number,
  bottomY: number,
  cz: number,
  width: number,
  height: number,
  depth: number
): ColliderBox {
  return {
    id,
    minX: cx - width / 2,
    maxX: cx + width / 2,
    minY: bottomY,
    maxY: bottomY + height,
    minZ: cz - depth / 2,
    maxZ: cz + depth / 2,
    kind: 'obstacle',
    neonTrim: 'none',
    stoneVariant: 'secondary',
  };
}

function addCoinLine(
  pickups: PickupSpec[],
  prefix: string,
  x: number,
  y: number,
  zStart: number,
  zEnd: number,
  count: number,
  baseValue: number
): void {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    pickups.push({
      id: `${prefix}_c${i}`,
      kind: 'coin',
      x,
      y: y + 0.95,
      z: zStart + (zEnd - zStart) * t,
      value: baseValue,
    });
  }
}

export function buildRoomModule(
  type: RoomModuleType,
  ctx: ModuleBuildContext
): { nextZ: number; nextY: number } {
  const { rng, config, moduleIndex } = ctx;
  const pfx = `f${config.floorNumber}_m${moduleIndex}`;
  const coinVal = Math.max(5, Math.round(8 * config.coinMultiplier));
  const z = ctx.cursorZ;
  const y = ctx.cursorY;

  if (type === 'causeway_straight') {
    const length = 18;
    const cz = z - length / 2;
    ctx.colliders.push(makePlatform(`${pfx}_main`, 0, y, cz, 8.5, length + 0.8, 1.8, 'primary'));
    ctx.checkpoints.push({ x: 0, y: y + 0.2, z: z - 2 });

    const sideSign = rng.chance(0.5) ? -1 : 1;
    ctx.props.push({
      kind: 'side_island',
      x: sideSign * 11.5,
      y: y - 0.8,
      z: cz,
      scale: 1.05,
    });
    ctx.props.push({
      kind: 'sky_tree',
      x: sideSign * 11.5,
      y: y + 0.4,
      z: cz,
      scale: 1.15,
    });
    ctx.props.push({
      kind: 'neon_arch',
      x: 0,
      y,
      z: cz,
    });

    addCoinLine(ctx.pickups, pfx, rng.range(-1.8, 1.8), y, z - 3, z - length + 3, 4, coinVal);

    ctx.enemies.push({
      id: `${pfx}_e0`,
      archetype: rng.pick(config.enemyPool),
      x: rng.range(-2.0, 2.0),
      y,
      z: cz - 1.5,
      patrolRadius: 3.2,
    });

    return { nextZ: z - length, nextY: y };
  }

  if (type === 'combat_arena') {
    const length = 22;
    const cz = z - length / 2;
    ctx.colliders.push(makePlatform(`${pfx}_arena`, 0, y, cz, 16, length + 0.8, 2.2, 'secondary'));
    ctx.checkpoints.push({ x: 0, y: y + 0.2, z: z - 2.5 });

    for (const sx of [-5.2, 5.2]) {
      for (const sz of [-5.0, 5.0]) {
        ctx.colliders.push(makeObstacle(`${pfx}_cov_${sx}_${sz}`, sx, y, cz + sz, 1.8, 1.6, 1.8));
      }
    }

    const foeCount = rng.int(2, 3);
    for (let i = 0; i < foeCount; i++) {
      ctx.enemies.push({
        id: `${pfx}_e${i}`,
        archetype: rng.pick(config.enemyPool),
        x: (i - (foeCount - 1) / 2) * 4.2,
        y,
        z: cz + rng.range(-3, 2),
        patrolRadius: 4.0,
      });
    }

    if (rng.chance(0.75)) {
      ctx.interactables.push({
        id: `${pfx}_chest`,
        kind: 'chest',
        x: rng.chance(0.5) ? -6.0 : 6.0,
        y,
        z: cz,
        radius: 2.3,
        label: 'Open Sky Chest',
        coinValue: Math.round(38 * config.coinMultiplier),
      });
    }

    return { nextZ: z - length, nextY: y };
  }

  if (type === 'stepping_isles') {
    const length = 23;
    ctx.checkpoints.push({ x: 0, y: y + 0.2, z: z - 1 });
    ctx.colliders.push(makePlatform(`${pfx}_lip_in`, 0, y, z - 2.0, 8, 4.6, 1.6, 'primary'));

    const offsetsX = [0, rng.range(-1.4, 1.4), 0];
    for (let i = 0; i < 3; i++) {
      const iz = z - 6.8 - i * 5.0;
      const iy = y + (i === 1 ? 0.45 : 0);
      ctx.colliders.push(
        makePlatform(`${pfx}_step_${i}`, offsetsX[i], iy, iz, 5.8, 4.0, 1.3, 'secondary')
      );
      ctx.pickups.push({
        id: `${pfx}_stepcoin_${i}`,
        kind: i === 1 ? 'big_coin' : 'coin',
        x: offsetsX[i],
        y: iy + 1.0,
        z: iz,
        value: i === 1 ? coinVal * 3 : coinVal,
      });
    }

    const netY = y - 3.8;
    const netCz = z - length / 2;
    ctx.colliders.push(
      makePlatform(`${pfx}_safetynet`, 0, netY, netCz, 11.5, 16.5, 1.2, 'primary', 'secondary')
    );
    ctx.jumpPads.push({
      id: `${pfx}_netpad_a`,
      x: 0,
      y: netY,
      z: netCz + 3.2,
      radius: 1.8,
      boostVelocityY: 16.2,
      color: '#4ade80',
    });
    ctx.jumpPads.push({
      id: `${pfx}_netpad_b`,
      x: 0,
      y: netY,
      z: netCz - 3.2,
      radius: 1.8,
      boostVelocityY: 16.2,
      color: '#4ade80',
    });

    ctx.colliders.push(
      makePlatform(`${pfx}_lip_out`, 0, y, z - length + 2.0, 8.5, 4.6, 1.6, 'primary')
    );

    return { nextZ: z - length, nextY: y };
  }

  if (type === 'twin_split_bridge') {
    const length = 22;
    const cz = z - length / 2;
    ctx.checkpoints.push({ x: 0, y: y + 0.2, z: z - 1.5 });

    ctx.colliders.push(makePlatform(`${pfx}_merge_in`, 0, y, z - 2.5, 13.5, 5.6, 1.7, 'primary'));
    ctx.colliders.push(
      makePlatform(`${pfx}_merge_out`, 0, y, z - length + 2.5, 13.5, 5.6, 1.7, 'primary')
    );

    ctx.colliders.push(makePlatform(`${pfx}_lane_l`, -4.4, y, cz, 4.6, 13.0, 1.5, 'gold'));
    ctx.hazards.push({
      id: `${pfx}_haz_l`,
      kind: 'pulse_beam',
      x: -4.4,
      y,
      z: cz + 1.5,
      width: 4.2,
      depth: 1.4,
      damage: Math.round(16 * config.enemyDamageScale),
      cycleSeconds: 2.5,
      activeRatio: 0.42,
      phaseOffset: 0.3,
    });
    ctx.interactables.push({
      id: `${pfx}_chest_l`,
      kind: 'chest',
      x: -4.4,
      y,
      z: cz - 2.2,
      radius: 2.2,
      label: 'Open Vault Chest',
      coinValue: Math.round(48 * config.coinMultiplier),
    });

    ctx.colliders.push(makePlatform(`${pfx}_lane_r`, 4.4, y, cz, 4.6, 13.0, 1.5, 'secondary'));
    ctx.enemies.push({
      id: `${pfx}_guard_r`,
      archetype: rng.pick(config.enemyPool),
      x: 4.4,
      y,
      z: cz,
      patrolRadius: 2.6,
    });
    ctx.pickups.push({
      id: `${pfx}_heal_r`,
      kind: 'heal_orb',
      x: 4.4,
      y: y + 1.0,
      z: cz - 3.0,
      value: 25,
    });

    return { nextZ: z - length, nextY: y };
  }

  if (type === 'laser_gauntlet') {
    const length = 20;
    const cz = z - length / 2;
    ctx.colliders.push(
      makePlatform(`${pfx}_gauntlet`, 0, y, cz, 9.5, length + 0.8, 1.8, 'secondary')
    );
    ctx.checkpoints.push({ x: 0, y: y + 0.2, z: z - 2.0 });

    for (let i = 0; i < 2; i++) {
      const hz = z - 6.5 - i * 6.5;
      ctx.hazards.push({
        id: `${pfx}_beam_${i}`,
        kind: 'pulse_beam',
        x: 0,
        y,
        z: hz,
        width: 8.8,
        depth: 1.5,
        damage: Math.round(15 * config.enemyDamageScale),
        cycleSeconds: 2.6,
        activeRatio: 0.4,
        phaseOffset: i * 1.25,
      });
    }

    addCoinLine(ctx.pickups, pfx, 0, y, z - 4, z - length + 4, 5, coinVal);
    ctx.enemies.push({
      id: `${pfx}_sentinel`,
      archetype: 'sentinel',
      x: rng.range(-2.5, 2.5),
      y,
      z: z - length + 3.8,
      patrolRadius: 2.2,
    });

    return { nextZ: z - length, nextY: y };
  }

  if (type === 'elevated_terrace') {
    const length = 21;
    const rise = 3.2;
    ctx.checkpoints.push({ x: 0, y: y + 0.2, z: z - 2.0 });

    ctx.colliders.push(makePlatform(`${pfx}_low`, 0, y, z - 4.8, 11.0, 10.2, 1.8, 'primary'));
    ctx.jumpPads.push({
      id: `${pfx}_pad`,
      x: 0,
      y,
      z: z - 7.4,
      radius: 1.65,
      boostVelocityY: 16.0,
      color: '#22d3ee',
    });

    ctx.colliders.push(
      makePlatform(`${pfx}_midstep`, -3.8, y + rise * 0.5, z - 9.8, 3.4, 3.6, 1.6, 'secondary')
    );

    const upperY = y + rise;
    ctx.colliders.push(makePlatform(`${pfx}_high`, 0, upperY, z - 15.5, 11.5, 11.6, 2.0, 'gold'));

    ctx.enemies.push({
      id: `${pfx}_top_foe`,
      archetype: rng.pick(config.enemyPool),
      x: 1.8,
      y: upperY,
      z: z - 15.5,
      patrolRadius: 3.0,
    });

    addCoinLine(ctx.pickups, pfx, 0, upperY, z - 12.5, z - 18.5, 3, coinVal);

    return { nextZ: z - length, nextY: upperY };
  }

  // 'sky_garden_courtyard'
  const length = 20;
  const cz = z - length / 2;
  ctx.colliders.push(makePlatform(`${pfx}_garden`, 0, y, cz, 14.5, length + 0.8, 2.0, 'primary'));
  ctx.checkpoints.push({ x: 0, y: y + 0.2, z: z - 2.0 });

  ctx.props.push({ kind: 'sky_tree', x: -5.2, y, z: cz - 3.5, scale: 1.1 });
  ctx.props.push({ kind: 'sky_tree', x: 5.2, y, z: cz + 3.5, scale: 0.95 });

  ctx.interactables.push({
    id: `${pfx}_shrine`,
    kind: 'shrine',
    x: -4.2,
    y,
    z: cz + 2.0,
    radius: 2.3,
    label: 'Blessing Shrine (+35 HP & Coins)',
    coinValue: Math.round(22 * config.coinMultiplier),
  });

  ctx.enemies.push({
    id: `${pfx}_g1`,
    archetype: rng.pick(config.enemyPool),
    x: 2.8,
    y,
    z: cz - 1.5,
    patrolRadius: 3.5,
  });

  addCoinLine(ctx.pickups, pfx, 0, y, z - 4, z - length + 4, 4, coinVal);
  return { nextZ: z - length, nextY: y };
}

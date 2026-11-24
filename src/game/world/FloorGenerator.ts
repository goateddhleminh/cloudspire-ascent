import { FLOOR_THEMES, RoomModuleType, getFloorConfig } from '../config/floors';
import { ColliderBox, FloorLayout, buildRoomModule } from './RoomModules';
import { SeededRandom } from './SeededRandom';

function makePlatform(
  id: string,
  cx: number,
  topY: number,
  cz: number,
  width: number,
  depth: number,
  thickness = 2.0,
  neonTrim: ColliderBox['neonTrim'] = 'primary'
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
    stoneVariant: 'primary',
  };
}

/**
 * Generates the interactive 3D Sky Sanctuary Hub featuring:
 * - Master Zephyr (Sky Merchant NPC) at the West Shop Pavilion
 * - Warden Lyra (Quartermaster NPC) at the East Armory Rack + Clockwork Training Dummy
 * - Archivist Orin (Sanctuary Guide NPC) beside the North Ascent Bridge
 */
export function createHubLayout(): FloorLayout {
  const theme = FLOOR_THEMES[0];
  const colliders: ColliderBox[] = [
    makePlatform('hub_plaza', 0, 0, 0, 22, 22, 2.6, 'primary'),
    makePlatform('hub_north_bridge', 0, 0.3, -15.5, 9, 10, 2.2, 'gold'),
    makePlatform('hub_portal_dais', 0, 0.6, -24.0, 12, 8.5, 2.4, 'gold'),
    makePlatform('hub_west_shop', -14.5, 0.2, -2, 8.5, 9.5, 2.0, 'secondary'),
    makePlatform('hub_east_armory', 14.5, 0.2, -2, 8.5, 9.5, 2.0, 'secondary'),
  ];

  return {
    isHub: true,
    floorNumber: 0,
    seedUsed: 'HUB_SANCTUARY',
    theme,
    spawnPoint: { x: 0, y: 0.2, z: 5.5 },
    exitPortalPos: { x: 0, y: 0.6, z: -24.2 },
    requiredKills: 0,
    moduleSequence: [],
    colliders,
    jumpPads: [
      {
        id: 'hub_fun_pad',
        x: -7.5,
        y: 0,
        z: 6.5,
        radius: 1.5,
        boostVelocityY: 15.0,
        color: '#4ade80',
      },
    ],
    hazards: [],
    enemies: [
      {
        id: 'hub_dummy',
        archetype: 'striker',
        x: 15.2,
        y: 0.2,
        z: 1.4,
        patrolRadius: 0,
        isTrainingDummy: true,
      },
    ],
    pickups: [],
    interactables: [
      {
        id: 'hub_portal',
        kind: 'portal',
        x: 0,
        y: 0.6,
        z: -24.2,
        radius: 2.9,
        label: 'Enter Cloudspire Run',
      },
      {
        id: 'hub_shop',
        kind: 'shop_kiosk',
        x: -15.2,
        y: 0.2,
        z: -3.2,
        radius: 2.6,
        rotationY: Math.PI / 2,
        label: 'Browse Sky Bazaar',
      },
      {
        id: 'hub_npc_zephyr',
        kind: 'npc',
        npcId: 'zephyr',
        npcName: 'Master Zephyr',
        npcRole: 'Sky Merchant',
        npcLines: [
          'Fresh Aether forged in the upper currents! Spend your Sky Coins on permanent Core Upgrades before braving Floor 5.',
          'Tip: Sky Wings grant a mid-air Double Jump across every run, and Sky Tonics mend +45 HP instantly with [C]!',
        ],
        npcAction: 'shop',
        x: -12.6,
        y: 0.2,
        z: -1.1,
        rotationY: Math.PI * 0.62,
        radius: 2.6,
        label: 'Talk to Master Zephyr',
      },
      {
        id: 'hub_armory',
        kind: 'armory_kiosk',
        x: 15.2,
        y: 0.2,
        z: -3.8,
        radius: 2.6,
        rotationY: -Math.PI / 2,
        label: 'Inspect Armory Rack',
      },
      {
        id: 'hub_npc_lyra',
        kind: 'npc',
        npcId: 'lyra',
        npcName: 'Warden Lyra',
        npcRole: 'Armory Quartermaster',
        npcLines: [
          'Your Skyblade unleashes a heavy golden Finisher on the 3rd combo strike! Test your timing on my Clockwork Dummy beside us.',
          'Swap your [Q] and [E] skills or equip new Vanguard Skins anytime in the Armory Loadout.',
        ],
        npcAction: 'inventory',
        x: 12.6,
        y: 0.2,
        z: -2.2,
        rotationY: -Math.PI * 0.62,
        radius: 2.6,
        label: 'Talk to Warden Lyra',
      },
      {
        id: 'hub_npc_orin',
        kind: 'npc',
        npcId: 'orin',
        npcName: 'Archivist Orin',
        npcRole: 'Spire Lorekeeper',
        npcLines: [
          'Above us rises the Solar Summit Bastion. Defeat floor constructs to unseal each Ascent Gate—and leap over Aegis Juggernaut shockwaves!',
          'On Floor 5, the Spire Warden awaits. Conquer the summit to unlock Endless Ascent!',
        ],
        npcAction: 'start_run',
        x: -3.4,
        y: 0,
        z: -7.6,
        rotationY: Math.PI * 0.85,
        radius: 2.7,
        label: 'Talk to Archivist Orin',
      },
    ],
    props: [
      { kind: 'sky_tree', x: -8.2, y: 0, z: -7.5, scale: 1.2 },
      { kind: 'sky_tree', x: 8.2, y: 0, z: -7.5, scale: 1.15 },
      { kind: 'sky_tree', x: 7.8, y: 0, z: 7.2, scale: 0.95 },
      { kind: 'neon_arch', x: 0, y: 0.3, z: -12.5 },
      { kind: 'side_island', x: -24, y: -2.5, z: -18, scale: 1.3 },
      { kind: 'sky_tree', x: -24, y: -1.1, z: -18, scale: 1.35 },
      { kind: 'side_island', x: 25, y: -1.8, z: -16, scale: 1.25 },
      { kind: 'summit_spire', x: 0, y: 4, z: -95, scale: 1.5 },
    ],
    checkpoints: [{ x: 0, y: 0.2, z: 5.5 }],
  };
}

export function createFallbackFloorLayout(floorNumber: number, seedUsed = 'FALLBACK'): FloorLayout {
  const config = getFloorConfig(floorNumber);
  return {
    isHub: false,
    floorNumber: config.floorNumber,
    seedUsed,
    theme: config.theme,
    spawnPoint: { x: 0, y: 0.2, z: 0 },
    exitPortalPos: { x: 0, y: 0, z: -38 },
    requiredKills: 1,
    moduleSequence: ['causeway_straight'],
    colliders: [
      makePlatform('fb_spawn', 0, 0, 0, 12, 12, 2.0, 'primary'),
      makePlatform('fb_bridge', 0, 0, -19, 9, 28, 1.8, 'secondary'),
      makePlatform('fb_exit', 0, 0, -38, 13, 12, 2.2, 'gold'),
    ],
    jumpPads: [],
    hazards: [],
    enemies: [
      {
        id: `fb_e1_${floorNumber}`,
        archetype: 'striker',
        x: 0,
        y: 0,
        z: -20,
        patrolRadius: 3,
      },
    ],
    pickups: [
      { id: 'fb_c1', kind: 'coin', x: 0, y: 1, z: -10, value: 10 },
      { id: 'fb_c2', kind: 'coin', x: 0, y: 1, z: -28, value: 10 },
    ],
    interactables: [
      {
        id: `fb_portal_${floorNumber}`,
        kind: 'portal',
        x: 0,
        y: 0,
        z: -38,
        radius: 2.8,
        label: 'Ascend to Next Floor',
      },
    ],
    props: [{ kind: 'summit_spire', x: 0, y: 5, z: -115, scale: 1.4 }],
    checkpoints: [
      { x: 0, y: 0.2, z: 0 },
      { x: 0, y: 0.2, z: -34 },
    ],
  };
}

export function generateFloorLayout(floorNumber: number, runSeed: string): FloorLayout {
  try {
    const config = getFloorConfig(floorNumber);
    const seedKey = `${runSeed}::floor_${config.floorNumber}`;
    const rng = new SeededRandom(seedKey);

    const colliders: ColliderBox[] = [];
    const jumpPads: FloorLayout['jumpPads'] = [];
    const hazards: FloorLayout['hazards'] = [];
    const enemies: FloorLayout['enemies'] = [];
    const pickups: FloorLayout['pickups'] = [];
    const interactables: FloorLayout['interactables'] = [];
    const props: FloorLayout['props'] = [];
    const checkpoints: FloorLayout['checkpoints'] = [];

    colliders.push(makePlatform(`f${floorNumber}_spawn`, 0, 0, -1, 12.5, 12.5, 2.2, 'primary'));
    const spawnPoint = { x: 0, y: 0.2, z: 2.2 };
    checkpoints.push({ ...spawnPoint });

    props.push({ kind: 'sky_tree', x: -4.6, y: 0, z: 3.4, scale: 1.0 });
    props.push({ kind: 'sky_tree', x: 4.6, y: 0, z: 3.4, scale: 0.95 });

    let cursorZ = -7.0;
    let cursorY = 0;
    const moduleSequence: RoomModuleType[] = [];
    let lastModule: RoomModuleType | null = null;

    for (let i = 0; i < config.moduleCount; i++) {
      const candidates = config.allowedModules.filter((m) => m !== lastModule);
      const chosen = rng.pick(candidates.length > 0 ? candidates : config.allowedModules);
      moduleSequence.push(chosen);
      lastModule = chosen;

      const next = buildRoomModule(chosen, {
        cursorZ,
        cursorY,
        rng,
        config,
        moduleIndex: i,
        colliders,
        jumpPads,
        hazards,
        enemies,
        pickups,
        interactables,
        props,
        checkpoints,
      });
      cursorZ = next.nextZ;
      cursorY = next.nextY;
    }

    const sanctumDepth = config.hasBoss ? 24 : 15;
    const sanctumWidth = config.hasBoss ? 20 : 14;
    const sanctumCz = cursorZ - sanctumDepth / 2;

    colliders.push(
      makePlatform(
        `f${floorNumber}_summit`,
        0,
        cursorY,
        sanctumCz,
        sanctumWidth,
        sanctumDepth + 1.0,
        2.5,
        'gold'
      )
    );
    checkpoints.push({ x: 0, y: cursorY + 0.2, z: cursorZ - 2.5 });

    if (config.hasBoss) {
      enemies.push({
        id: `f${floorNumber}_warden_boss`,
        archetype: 'warden_boss',
        x: 0,
        y: cursorY,
        z: sanctumCz + 1.5,
        patrolRadius: 5.5,
      });
    } else {
      enemies.push({
        id: `f${floorNumber}_gatekeeper`,
        archetype: floorNumber >= 2 ? 'bulwark' : 'striker',
        x: 0,
        y: cursorY,
        z: sanctumCz + 2.5,
        patrolRadius: 3.0,
      });
    }

    const exitPortalPos = { x: 0, y: cursorY, z: cursorZ - sanctumDepth + 3.2 };
    interactables.push({
      id: `f${floorNumber}_exit_portal`,
      kind: 'portal',
      x: exitPortalPos.x,
      y: exitPortalPos.y,
      z: exitPortalPos.z,
      radius: 2.8,
      label:
        config.floorNumber === 5
          ? 'Claim Summit Victory!'
          : `Ascend to Floor ${config.floorNumber + 1}`,
    });

    props.push({
      kind: 'summit_spire',
      x: 0,
      y: cursorY + 4,
      z: exitPortalPos.z - 68,
      scale: 1.45,
    });
    for (const side of [-1, 1]) {
      props.push({
        kind: 'side_island',
        x: side * 22,
        y: cursorY - 2,
        z: sanctumCz - 10,
        scale: 1.25,
      });
      props.push({
        kind: 'sky_tree',
        x: side * 22,
        y: cursorY - 0.6,
        z: sanctumCz - 10,
        scale: 1.2,
      });
    }

    const safeRadiusSq = 11 * 11;
    const filteredEnemies = enemies
      .filter((e) => {
        const dx = e.x - spawnPoint.x;
        const dz = e.z - spawnPoint.z;
        return dx * dx + dz * dz >= safeRadiusSq;
      })
      .slice(0, config.enemyCountBudget);

    const filteredHazards = hazards.filter((h) => {
      const dx = h.x - spawnPoint.x;
      const dz = h.z - spawnPoint.z;
      return dx * dx + dz * dz >= safeRadiusSq;
    });

    const requiredKills = config.hasBoss
      ? Math.max(1, filteredEnemies.length)
      : Math.max(1, Math.ceil(filteredEnemies.length * config.requiredKillsRatio));

    if (colliders.length < 2) {
      return createFallbackFloorLayout(floorNumber, seedKey);
    }

    return {
      isHub: false,
      floorNumber: config.floorNumber,
      seedUsed: seedKey,
      theme: config.theme,
      spawnPoint,
      exitPortalPos,
      requiredKills,
      moduleSequence,
      colliders,
      jumpPads,
      hazards: filteredHazards,
      enemies: filteredEnemies,
      pickups,
      interactables,
      props,
      checkpoints,
    };
  } catch {
    return createFallbackFloorLayout(floorNumber, `${runSeed}::fallback`);
  }
}

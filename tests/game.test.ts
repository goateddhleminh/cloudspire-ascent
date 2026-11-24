import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/app/events';
import {
  MODEL_PATHS,
  PARTICLE_PATHS,
  assetRegistry,
} from '../src/game/assets/AssetRegistry';
import { WEAPON_LIST } from '../src/game/config/items';
import {
  CURRENT_SAVE_VERSION,
  SAVE_STORAGE_KEY,
} from '../src/game/persistence/SaveData';
import { SaveManager, StorageLike } from '../src/game/persistence/SaveManager';
import { migrateAndValidateSave } from '../src/game/persistence/migrations';
import { computePlayerStats } from '../src/game/player/PlayerStats';
import { ProgressionSystem } from '../src/game/systems/ProgressionSystem';
import {
  createFallbackFloorLayout,
  createHubLayout,
  generateFloorLayout,
} from '../src/game/world/FloorGenerator';
import { SeededRandom } from '../src/game/world/SeededRandom';

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe('SeededRandom', () => {
  it('produces identical sequences for identical seeds and differs for distinct seeds', () => {
    const a = new SeededRandom('SPIRE-42');
    const b = new SeededRandom('SPIRE-42');
    const c = new SeededRandom('SPIRE-99');

    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    const seqC = Array.from({ length: 8 }, () => c.next());

    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });
});

describe('SaveManager & migrations', () => {
  it('migrates legacy v0/v1 save schemas and clamps invalid fields safely', () => {
    const migrated = migrateAndValidateSave({
      coins: 750,
      skin: 'golden_monarch',
      ownedSkins: ['shadow_runner', 'golden_monarch', 'nonexistent_skin'],
      upgrades: { vitality_core: 99, skyblade_edge: -3 },
      ownedSkills: ['phase_dash', 'bogus_skill'],
      equippedSkills: ['bogus_skill'],
      settings: { masterVolume: 5, mouseSensitivity: -2, graphicsQuality: 'ultra' },
    });

    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.currency).toBe(750);
    expect(migrated.equippedSkin).toBe('golden_monarch');
    expect(migrated.upgrades.vitality_core).toBe(5);
    expect(migrated.upgrades.skyblade_edge).toBe(0);
    expect(migrated.ownedSkills).toContain('phase_dash');
    expect(migrated.ownedSkills).not.toContain('bogus_skill');
    expect(migrated.equippedSkills.length).toBe(2);
    expect(migrated.settings.masterVolume).toBe(1);
    expect(migrated.settings.mouseSensitivity).toBe(0.1);
    expect(migrated.settings.graphicsQuality).toBe('high');
  });

  it('recovers from malformed JSON in localStorage without crashing and supports reset', () => {
    const mem = new MemoryStorage();
    mem.setItem(SAVE_STORAGE_KEY, '{not-valid-json:::');
    const events = new EventBus();
    const sm = new SaveManager(events, mem);

    expect(sm.getData().version).toBe(CURRENT_SAVE_VERSION);
    expect(sm.getData().currency).toBeGreaterThanOrEqual(0);

    sm.update((d) => {
      d.currency = 999;
    });
    expect(sm.getData().currency).toBe(999);

    sm.reset();
    expect(sm.getData().currency).toBe(100);
  });

  it('continues in memory and emits storage_warning when storage is unavailable', () => {
    const events = new EventBus();
    let warned = false;
    events.on('storage_warning', () => {
      warned = true;
    });

    const sm = new SaveManager(events, null);
    expect(warned).toBe(true);
    expect(sm.isStorageHealthy()).toBe(false);
    sm.update((d) => {
      d.currency = 450;
    });
    expect(sm.getData().currency).toBe(450);
  });
});

describe('ProgressionSystem & PlayerStats', () => {
  it('enforces currency checks, purchases, rank caps, and stat calculations', () => {
    const mem = new MemoryStorage();
    const events = new EventBus();
    const sm = new SaveManager(events, mem);
    const prog = new ProgressionSystem(sm, events);

    // Insufficient funds initially (100 coins < 350 for Solar Nova)
    const failBuy = prog.buySkill('solar_nova');
    expect(failBuy.ok).toBe(false);
    expect(failBuy.reason).toContain('Need');

    prog.grantCurrency(2500);
    expect(prog.buySkill('solar_nova').ok).toBe(true);
    expect(prog.buySkill('double_jump').ok).toBe(true);
    expect(prog.equipActiveSkill('solar_nova', 1).ok).toBe(true);
    expect(sm.getData().equippedSkills[1]).toBe('solar_nova');

    for (let i = 0; i < 5; i++) {
      expect(prog.buyUpgrade('vitality_core').ok).toBe(true);
    }
    // 6th rank must be blocked at cap
    const overCap = prog.buyUpgrade('vitality_core');
    expect(overCap.ok).toBe(false);
    expect(overCap.reason).toContain('Maximum');

    const stats = computePlayerStats(sm.getData(), { swift_stride: 1 });
    expect(stats.maxHp).toBe(200);
    expect(stats.hasDoubleJump).toBe(true);
    expect(stats.moveSpeed).toBeGreaterThan(10);
  });

  it('supports purchasing, equipping, and stat modifiers for melee weapons', () => {
    const mem = new MemoryStorage();
    const events = new EventBus();
    const sm = new SaveManager(events, mem);
    const prog = new ProgressionSystem(sm, events);

    expect(WEAPON_LIST.length).toBe(4);
    expect(sm.getData().equippedWeapon).toBe('skyblade');
    expect(sm.getData().ownedWeapons).toContain('skyblade');

    // Cannot equip unowned weapon or buy with insufficient coins
    expect(prog.equipWeapon('sunbreaker').ok).toBe(false);
    expect(prog.buyWeapon('astral_halberd').ok).toBe(false);

    const baseStats = computePlayerStats(sm.getData(), {});
    prog.grantCurrency(2000);

    expect(prog.buyWeapon('storm_katana').ok).toBe(true);
    expect(prog.buyWeapon('storm_katana').ok).toBe(false); // duplicate blocked
    expect(prog.equipWeapon('storm_katana').ok).toBe(true);
    expect(sm.getData().equippedWeapon).toBe('storm_katana');

    const katanaStats = computePlayerStats(sm.getData(), {});
    expect(katanaStats.damageMultiplier).toBeGreaterThan(baseStats.damageMultiplier);
    expect(katanaStats.primaryCooldownMultiplier).toBeLessThan(1);

    expect(prog.buyWeapon('astral_halberd').ok).toBe(true);
    expect(prog.equipWeapon('astral_halberd').ok).toBe(true);
    const halberdStats = computePlayerStats(sm.getData(), {});
    expect(halberdStats.damageMultiplier).toBeGreaterThan(katanaStats.damageMultiplier);
    expect(halberdStats.primaryRangeBonus).toBeGreaterThan(0);
  });
});

describe('AssetRegistry, Asset Manifest & Extended Save Settings', () => {
  it('registers all 31 Blender GLB models and 6 RGBA particle textures with safe fallback', () => {
    expect(Object.keys(MODEL_PATHS).length).toBe(31);
    expect(Object.keys(PARTICLE_PATHS).length).toBe(6);
    expect(assetRegistry.cloneModel('vanguard_hero')).toBeNull();
    expect(assetRegistry.getTexture('fx_spark_star')).toBeNull();
  });

  it('verifies every shipped .glb, .png, and .wav in docs/asset-manifest.json exists on disk', async () => {
    const fsMod: any = await import(/* @vite-ignore */ 'node:' + 'fs');
    const urlMod: any = await import(/* @vite-ignore */ 'node:' + 'url');
    const pathMod: any = await import(/* @vite-ignore */ 'node:' + 'path');
    const projectRoot = pathMod.resolve(
      pathMod.dirname(urlMod.fileURLToPath(import.meta.url)),
      '..'
    );
    const publicDir = pathMod.join(projectRoot, 'public');
    const manifestPath = pathMod.join(projectRoot, 'docs', 'asset-manifest.json');
    expect(fsMod.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fsMod.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.total_assets).toBe(81);
    expect(manifest.assets.length).toBe(81);

    for (const entry of manifest.assets) {
      const rel = String(entry.path).replace(/^\/+/, '');
      const fullPath = pathMod.join(publicDir, rel);
      expect(fsMod.existsSync(fullPath)).toBe(true);
      expect(entry.technical_checks_passed).toBe(true);
    }
  });

  it('clamps audio bus, UI scale, camera shake, and flashing settings on migration', () => {
    const migrated = migrateAndValidateSave({
      ownedWeapons: ['sunbreaker', 'invalid_sword'],
      equippedWeapon: 'invalid_sword',
      settings: {
        ambienceVolume: 4,
        uiVolume: -1,
        shakeStrength: 3,
        reduceFlashing: true,
        uiScale: 9,
      },
    });
    expect(migrated.ownedWeapons).toEqual(['skyblade', 'sunbreaker']);
    expect(migrated.equippedWeapon).toBe('skyblade');
    expect(migrated.settings.ambienceVolume).toBe(1);
    expect(migrated.settings.uiVolume).toBe(0);
    expect(migrated.settings.shakeStrength).toBe(1);
    expect(migrated.settings.reduceFlashing).toBe(true);
    expect(migrated.settings.uiScale).toBe(1.3);
  });
});

describe('FloorGenerator', () => {
  it('generates deterministic, safe, navigable layouts with exit portals and boss floors', () => {
    const f1a = generateFloorLayout(1, 'SEED-ALPHA');
    const f1b = generateFloorLayout(1, 'SEED-ALPHA');
    expect(f1a.moduleSequence).toEqual(f1b.moduleSequence);
    expect(f1a.exitPortalPos).toEqual(f1b.exitPortalPos);

    // Spawn safety check: no enemies or hazards within 11m of spawnPoint
    for (const enemy of f1a.enemies) {
      const dist = Math.hypot(enemy.x - f1a.spawnPoint.x, enemy.z - f1a.spawnPoint.z);
      expect(dist).toBeGreaterThanOrEqual(11);
    }
    for (const haz of f1a.hazards) {
      const dist = Math.hypot(haz.x - f1a.spawnPoint.x, haz.z - f1a.spawnPoint.z);
      expect(dist).toBeGreaterThanOrEqual(11);
    }

    // Floor 5 has Spire Warden boss and exit portal
    const f5 = generateFloorLayout(5, 'SEED-ALPHA');
    expect(f5.enemies.some((e) => e.archetype === 'warden_boss')).toBe(true);
    expect(f5.interactables.some((i) => i.kind === 'portal')).toBe(true);

    // Hub & Fallback layouts are valid, including Hub NPCs
    const hub = createHubLayout();
    expect(hub.isHub).toBe(true);
    expect(hub.interactables.some((i) => i.kind === 'shop_kiosk')).toBe(true);
    const npcs = hub.interactables.filter((i) => i.kind === 'npc');
    expect(npcs.map((n) => n.npcId)).toEqual(['zephyr', 'lyra', 'orin']);

    const fb = createFallbackFloorLayout(2);
    expect(fb.colliders.length).toBeGreaterThanOrEqual(3);
  });
});

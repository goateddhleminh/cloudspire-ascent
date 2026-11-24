import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type ModelKey =
  | 'vanguard_hero'
  | 'headgear_crown'
  | 'headgear_visor'
  | 'headgear_halo'
  | 'headgear_void_horns'
  | 'wings_aether'
  | 'weapon_skyblade'
  | 'weapon_sunbreaker'
  | 'weapon_storm_katana'
  | 'weapon_astral_halberd'
  | 'proj_starlight_lance'
  | 'proj_void_orb'
  | 'npc_shopkeeper'
  | 'npc_armorer'
  | 'npc_guide'
  | 'npc_training_dummy'
  | 'enemy_crimson_striker'
  | 'enemy_prism_sentinel'
  | 'enemy_aegis_juggernaut'
  | 'enemy_spire_warden_boss'
  | 'prop_ascent_portal'
  | 'prop_sky_chest'
  | 'prop_blessing_shrine'
  | 'prop_shop_kiosk'
  | 'prop_armory_kiosk'
  | 'prop_sky_coin'
  | 'prop_heal_orb'
  | 'prop_jump_pad'
  | 'prop_laser_pylon'
  | 'prop_sky_tree'
  | 'prop_summit_spire';

export type ParticleTexKey =
  | 'fx_spark_star'
  | 'fx_slash_crescent'
  | 'fx_hit_ring'
  | 'fx_smoke_puff'
  | 'fx_rune_mote'
  | 'fx_crit_flare';

export const MODEL_PATHS: Record<ModelKey, string> = {
  vanguard_hero: '/assets/models/characters/vanguard_hero.glb',
  headgear_crown: '/assets/models/characters/headgear_crown.glb',
  headgear_visor: '/assets/models/characters/headgear_visor.glb',
  headgear_halo: '/assets/models/characters/headgear_halo.glb',
  headgear_void_horns: '/assets/models/characters/headgear_void_horns.glb',
  wings_aether: '/assets/models/characters/wings_aether.glb',
  weapon_skyblade: '/assets/models/weapons/weapon_skyblade.glb',
  weapon_sunbreaker: '/assets/models/weapons/weapon_sunbreaker.glb',
  weapon_storm_katana: '/assets/models/weapons/weapon_storm_katana.glb',
  weapon_astral_halberd: '/assets/models/weapons/weapon_astral_halberd.glb',
  proj_starlight_lance: '/assets/models/weapons/proj_starlight_lance.glb',
  proj_void_orb: '/assets/models/weapons/proj_void_orb.glb',
  npc_shopkeeper: '/assets/models/npcs/npc_shopkeeper.glb',
  npc_armorer: '/assets/models/npcs/npc_armorer.glb',
  npc_guide: '/assets/models/npcs/npc_guide.glb',
  npc_training_dummy: '/assets/models/npcs/npc_training_dummy.glb',
  enemy_crimson_striker: '/assets/models/enemies/enemy_crimson_striker.glb',
  enemy_prism_sentinel: '/assets/models/enemies/enemy_prism_sentinel.glb',
  enemy_aegis_juggernaut: '/assets/models/enemies/enemy_aegis_juggernaut.glb',
  enemy_spire_warden_boss: '/assets/models/enemies/enemy_spire_warden_boss.glb',
  prop_ascent_portal: '/assets/models/props/prop_ascent_portal.glb',
  prop_sky_chest: '/assets/models/props/prop_sky_chest.glb',
  prop_blessing_shrine: '/assets/models/props/prop_blessing_shrine.glb',
  prop_shop_kiosk: '/assets/models/props/prop_shop_kiosk.glb',
  prop_armory_kiosk: '/assets/models/props/prop_armory_kiosk.glb',
  prop_sky_coin: '/assets/models/props/prop_sky_coin.glb',
  prop_heal_orb: '/assets/models/props/prop_heal_orb.glb',
  prop_jump_pad: '/assets/models/props/prop_jump_pad.glb',
  prop_laser_pylon: '/assets/models/props/prop_laser_pylon.glb',
  prop_sky_tree: '/assets/models/props/prop_sky_tree.glb',
  prop_summit_spire: '/assets/models/props/prop_summit_spire.glb',
};

export const PARTICLE_PATHS: Record<ParticleTexKey, string> = {
  fx_spark_star: '/assets/particles/fx_spark_star.png',
  fx_slash_crescent: '/assets/particles/fx_slash_crescent.png',
  fx_hit_ring: '/assets/particles/fx_hit_ring.png',
  fx_smoke_puff: '/assets/particles/fx_smoke_puff.png',
  fx_rune_mote: '/assets/particles/fx_rune_mote.png',
  fx_crit_flare: '/assets/particles/fx_crit_flare.png',
};

class AssetRegistry {
  private models = new Map<ModelKey, THREE.Group>();
  private textures = new Map<ParticleTexKey, THREE.Texture>();
  private ready = false;
  private loadingPromise: Promise<void> | null = null;

  isReady(): boolean {
    return this.ready;
  }

  async preloadAll(onProgress?: (loaded: number, total: number, label: string) => void): Promise<void> {
    if (this.ready) return;
    if (this.loadingPromise) return this.loadingPromise;
    if (typeof window === 'undefined') return;

    this.loadingPromise = (async () => {
      const gltfLoader = new GLTFLoader();
      const texLoader = new THREE.TextureLoader();

      const modelEntries = Object.entries(MODEL_PATHS) as [ModelKey, string][];
      const texEntries = Object.entries(PARTICLE_PATHS) as [ParticleTexKey, string][];
      const total = modelEntries.length + texEntries.length;
      let done = 0;

      const modelJobs = modelEntries.map(async ([key, url]) => {
        try {
          const gltf = await gltfLoader.loadAsync(url);
          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          this.models.set(key, gltf.scene);
        } catch (err) {
          console.warn(`[AssetRegistry] Fallback used for model ${key}:`, err);
        } finally {
          done += 1;
          onProgress?.(done, total, key);
        }
      });

      const texJobs = texEntries.map(async ([key, url]) => {
        try {
          const tex = await texLoader.loadAsync(url);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          this.textures.set(key, tex);
        } catch (err) {
          console.warn(`[AssetRegistry] Fallback used for texture ${key}:`, err);
        } finally {
          done += 1;
          onProgress?.(done, total, key);
        }
      });

      await Promise.all([...modelJobs, ...texJobs]);
      this.ready = true;
    })();

    return this.loadingPromise;
  }

  hasModel(key: ModelKey): boolean {
    return this.models.has(key);
  }

  /**
   * Clones a loaded .glb scene graph. When `cloneMaterials` is true, each Mesh gets
   * independent material instances so per-entity hit flashes or skin recolors never bleed.
   */
  cloneModel(key: ModelKey, cloneMaterials = false): THREE.Group | null {
    const template = this.models.get(key);
    if (!template) return null;

    const root = template.clone(true);
    if (cloneMaterials) {
      const clonedMap = new Map<THREE.Material, THREE.Material>();
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material = obj.material.map((m) => {
              const existing = clonedMap.get(m);
              if (existing) return existing;
              const cloned = m.clone() as THREE.Material;
              clonedMap.set(m, cloned);
              return cloned;
            });
          } else {
            const orig = obj.material as THREE.Material;
            let cm = clonedMap.get(orig);
            if (!cm) {
              const cloned = orig.clone() as THREE.Material;
              clonedMap.set(orig, cloned);
              cm = cloned;
            }
            obj.material = cm;
          }
          obj.userData.ownMaterial = true;
        }
      });
    }
    return root;
  }

  getTexture(key: ParticleTexKey): THREE.Texture | null {
    return this.textures.get(key) ?? null;
  }
}

export const assetRegistry = new AssetRegistry();

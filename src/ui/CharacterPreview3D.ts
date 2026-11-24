import * as THREE from 'three';
import { assetRegistry, ModelKey } from '../game/assets/AssetRegistry';
import { SkinDefinition, WEAPONS } from '../game/config/items';
import { PlayerAvatar } from '../game/player/PlayerAvatar';

const NPC_MODEL_KEYS: Record<'zephyr' | 'lyra' | 'orin', ModelKey> = {
  zephyr: 'npc_shopkeeper',
  lyra: 'npc_armorer',
  orin: 'npc_guide',
};

/**
 * Dedicated lightweight Three.js studio renderer for:
 * 1. Interactive 3D Character + Weapon + Wings Turntable in Shop & Inventory modals
 * 2. Cached transparent 3D Bust Portraits for Player Skins, Weapons, & Sanctuary NPCs
 */
export class CharacterPreview3D {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30);
  private avatar = new PlayerAvatar();
  private propInspectGroup = new THREE.Group();
  private pedestalGroup = new THREE.Group();
  private pedestalRingMat = new THREE.MeshBasicMaterial({ color: '#818cf8' });

  private portraitCache = new Map<string, string>();
  private weaponThumbCache = new Map<string, string>();
  private npcPortraitCache = new Map<string, string>();

  private activeContainer: HTMLElement | null = null;
  private rafId = 0;
  private lastMs = 0;
  private idleTime = 0;
  private manualYawOffset = 0;
  private hasWingsPreview = false;
  private dragging = false;
  private dragLastX = 0;
  private failed = false;

  constructor() {
    const hemi = new THREE.HemisphereLight('#f0f7ff', '#1e1b4b', 1.3);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#fff7ed', 1.7);
    keyLight.position.set(2.6, 4.4, 3.8);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#a855f7', 1.15);
    rimLight.position.set(-3.0, 2.8, -2.5);
    this.scene.add(rimLight);

    const discGeo = new THREE.CylinderGeometry(0.95, 1.08, 0.14, 28);
    const discMat = new THREE.MeshStandardMaterial({
      color: '#1e2946',
      roughness: 0.35,
      metalness: 0.4,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.set(0, -0.07, 0);
    this.pedestalGroup.add(disc);

    const ringGeo = new THREE.TorusGeometry(0.98, 0.035, 10, 36);
    ringGeo.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, this.pedestalRingMat);
    ring.position.set(0, 0.01, 0);
    this.pedestalGroup.add(ring);

    this.scene.add(this.pedestalGroup);
    this.scene.add(this.avatar.root);
    this.scene.add(this.propInspectGroup);
    this.propInspectGroup.visible = false;
  }

  /**
   * Clears cached snapshots once Blender `.glb` models finish preloading so all
   * portraits & thumbnails re-render using the sculpted 3D meshes.
   */
  public invalidateCachesForGlbUpgrade(): void {
    this.avatar.refreshFromRegistry();
    this.portraitCache.clear();
    this.weaponThumbCache.clear();
    this.npcPortraitCache.clear();
  }

  private ensureRenderer(): THREE.WebGLRenderer | null {
    if (this.failed) return null;
    if (this.renderer) return this.renderer;
    try {
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.12;
      this.renderer.domElement.className = 'showcase-3d-canvas';

      this.renderer.domElement.addEventListener('pointerdown', (e) => {
        this.dragging = true;
        this.dragLastX = e.clientX;
        this.renderer?.domElement.setPointerCapture?.(e.pointerId);
      });
      this.renderer.domElement.addEventListener('pointermove', (e) => {
        if (!this.dragging) return;
        const dx = e.clientX - this.dragLastX;
        this.dragLastX = e.clientX;
        this.manualYawOffset += dx * 0.018;
      });
      const endDrag = () => {
        this.dragging = false;
      };
      this.renderer.domElement.addEventListener('pointerup', endDrag);
      this.renderer.domElement.addEventListener('pointercancel', endDrag);

      return this.renderer;
    } catch {
      this.failed = true;
      return null;
    }
  }

  getPortraitDataUrl(skin: SkinDefinition): string {
    const cacheKey = `${skin.id}_${assetRegistry.isReady() ? 'glb' : 'proc'}`;
    const cached = this.portraitCache.get(cacheKey);
    if (cached) return cached;

    const r = this.ensureRenderer();
    if (!r) return '';

    const wasMounted = this.activeContainer !== null;
    this.pedestalGroup.visible = false;
    this.propInspectGroup.visible = false;
    this.avatar.root.visible = true;
    this.avatar.refreshFromRegistry();
    this.avatar.applySkin(skin);
    this.avatar.update(0.016, 0, true, false, false, false);
    this.avatar.root.rotation.y = Math.PI - 0.28;

    r.setPixelRatio(2);
    r.setSize(96, 96, false);
    this.camera.aspect = 1;
    this.camera.fov = 30;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0.18, 2.02, 2.38);
    this.camera.lookAt(0, 1.86, 0);

    r.clear();
    r.render(this.scene, this.camera);
    const url = r.domElement.toDataURL('image/png');
    this.portraitCache.set(cacheKey, url);

    this.pedestalGroup.visible = true;
    if (wasMounted && this.activeContainer) {
      this.resizeToContainer();
    }
    return url;
  }

  getWeaponThumbnailUrl(weaponId: string): string {
    const wep = WEAPONS[weaponId];
    if (!wep || !assetRegistry.hasModel(wep.modelKey)) return '';

    const cached = this.weaponThumbCache.get(weaponId);
    if (cached) return cached;

    const r = this.ensureRenderer();
    if (!r) return '';

    const model = assetRegistry.cloneModel(wep.modelKey, false);
    if (!model) return '';

    const wasMounted = this.activeContainer !== null;
    this.pedestalGroup.visible = false;
    this.avatar.root.visible = false;
    this.propInspectGroup.clear();
    this.propInspectGroup.visible = true;

    model.rotation.set(0.18, 0.45, -Math.PI / 4);
    this.propInspectGroup.add(model);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(center);

    r.setPixelRatio(2);
    r.setSize(112, 112, false);
    this.camera.aspect = 1;
    this.camera.fov = 32;
    this.camera.updateProjectionMatrix();
    const maxSpan = Math.max(size.x, size.y, 0.8);
    const dist = (maxSpan * 0.58) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
    this.camera.position.set(0, 0, dist);
    this.camera.lookAt(0, 0, 0);

    r.clear();
    r.render(this.scene, this.camera);
    const url = r.domElement.toDataURL('image/png');
    this.weaponThumbCache.set(weaponId, url);

    this.propInspectGroup.clear();
    this.propInspectGroup.visible = false;
    this.avatar.root.visible = true;
    this.pedestalGroup.visible = true;
    if (wasMounted && this.activeContainer) {
      this.resizeToContainer();
    }
    return url;
  }

  getNpcPortraitUrl(npcId: 'zephyr' | 'lyra' | 'orin'): string {
    const modelKey = NPC_MODEL_KEYS[npcId];
    if (!assetRegistry.hasModel(modelKey)) return '';

    const cached = this.npcPortraitCache.get(npcId);
    if (cached) return cached;

    const r = this.ensureRenderer();
    if (!r) return '';

    const npcModel = assetRegistry.cloneModel(modelKey, false);
    if (!npcModel) return '';

    const wasMounted = this.activeContainer !== null;
    this.pedestalGroup.visible = false;
    this.avatar.root.visible = false;
    this.propInspectGroup.clear();
    this.propInspectGroup.visible = true;

    npcModel.rotation.y = Math.PI - 0.3;
    this.propInspectGroup.add(npcModel);

    r.setPixelRatio(2);
    r.setSize(112, 112, false);
    this.camera.aspect = 1;
    this.camera.fov = 32;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0.22, 1.88, 2.45);
    this.camera.lookAt(0, 1.72, 0);

    r.clear();
    r.render(this.scene, this.camera);
    const url = r.domElement.toDataURL('image/png');
    this.npcPortraitCache.set(npcId, url);

    this.propInspectGroup.clear();
    this.propInspectGroup.visible = false;
    this.avatar.root.visible = true;
    this.pedestalGroup.visible = true;
    if (wasMounted && this.activeContainer) {
      this.resizeToContainer();
    }
    return url;
  }

  mountShowcase(
    container: HTMLElement,
    skin: SkinDefinition,
    weaponId = 'skyblade',
    hasWings = false
  ): void {
    const r = this.ensureRenderer();
    if (!r) return;

    this.activeContainer = container;
    container.innerHTML = '';
    container.appendChild(r.domElement);

    this.avatar.refreshFromRegistry();
    this.setPreviewLoadout(skin, weaponId, hasWings);
    this.propInspectGroup.visible = false;
    this.avatar.root.visible = true;
    this.pedestalGroup.visible = true;
    this.resizeToContainer();

    if (!this.rafId) {
      this.lastMs = performance.now();
      const loop = (now: number) => {
        if (!this.activeContainer) {
          this.rafId = 0;
          return;
        }
        this.rafId = requestAnimationFrame(loop);
        const dt = Math.min(0.05, Math.max(0.001, (now - this.lastMs) / 1000));
        this.lastMs = now;

        if (!this.dragging) {
          this.idleTime += dt;
        }
        this.avatar.root.rotation.y =
          Math.PI + Math.sin(this.idleTime * 1.05) * 0.44 + this.manualYawOffset;
        this.avatar.update(dt, 0, true, false, false, this.hasWingsPreview);

        this.camera.position.set(0, 1.35, 5.25);
        this.camera.lookAt(0, 1.12, 0);
        r.render(this.scene, this.camera);
      };
      this.rafId = requestAnimationFrame(loop);
    }
  }

  setPreviewLoadout(skin: SkinDefinition, weaponId = 'skyblade', hasWings = false): void {
    this.hasWingsPreview = hasWings;
    this.avatar.applyWeapon(weaponId);
    this.avatar.applySkin(skin);
    const wep = WEAPONS[weaponId];
    this.pedestalRingMat.color.set(
      weaponId !== 'skyblade' && wep ? wep.accentColor : skin.accentColor
    );
  }

  private resizeToContainer(): void {
    if (!this.renderer || !this.activeContainer) return;
    const w = Math.max(160, this.activeContainer.clientWidth || 200);
    const h = Math.max(200, this.activeContainer.clientHeight || 240);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = 35;
    this.camera.updateProjectionMatrix();
  }

  unmountShowcase(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    if (this.renderer?.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.activeContainer = null;
  }

  dispose(): void {
    this.unmountShowcase();
    this.renderer?.dispose();
    this.renderer = null;
  }
}

import * as THREE from 'three';
import { assetRegistry, ModelKey } from '../assets/AssetRegistry';
import { SKINS, SkinDefinition, WEAPONS } from '../config/items';

const HEADGEAR_MODEL_MAP: Record<Exclude<SkinDefinition['headgear'], 'none'>, ModelKey> = {
  crown: 'headgear_crown',
  visor: 'headgear_visor',
  halo: 'headgear_halo',
  void_horns: 'headgear_void_horns',
};

/**
 * Articulated Sky-Vanguard character rig powered by Blender 5.3 `.glb` models
 * (`vanguard_hero.glb`, `weapon_skyblade.glb`, `headgear_*.glb`, `wings_aether.glb`)
 * with dynamic PBR skin material recoloring, blade-trail sockets, wing flapping,
 * squash-and-stretch physics juice, and automatic procedural fallback for headless tests.
 */
export class PlayerAvatar {
  public readonly root = new THREE.Group();
  private bodyPivot = new THREE.Group();
  private headPivot: THREE.Object3D = new THREE.Group();
  private leftArmPivot: THREE.Object3D = new THREE.Group();
  private rightArmPivot: THREE.Object3D = new THREE.Group();
  private leftLegPivot: THREE.Object3D = new THREE.Group();
  private rightLegPivot: THREE.Object3D = new THREE.Group();
  private headgearSocket: THREE.Object3D = new THREE.Group();
  private backSocket: THREE.Object3D = new THREE.Group();
  private weaponSocket: THREE.Object3D = new THREE.Group();

  private bladeBaseNode: THREE.Object3D | null = null;
  private bladeTipNode: THREE.Object3D | null = null;
  private leftWingPivot: THREE.Object3D | null = null;
  private rightWingPivot: THREE.Object3D | null = null;
  private wingsGroup: THREE.Group | null = null;

  private headgearGroup = new THREE.Group();
  private auraGroup = new THREE.Group();
  private shieldMesh: THREE.Mesh;

  private torsoMats: THREE.MeshStandardMaterial[] = [];
  private trimMats: THREE.MeshStandardMaterial[] = [];
  private limbMats: THREE.MeshStandardMaterial[] = [];
  private shoeMats: THREE.MeshStandardMaterial[] = [];
  private hairMats: THREE.MeshStandardMaterial[] = [];
  private skinMats: THREE.MeshStandardMaterial[] = [];
  private bladeGlowMats: THREE.Material[] = [];

  private currentSkin: SkinDefinition = SKINS.shadow_runner;
  private currentWeaponId = 'skyblade';
  private usingGlbHero = false;

  private walkCycle = 0;
  private swingTimer = 0;
  private swingCombo = 0;
  private hurtFlashTimer = 0;
  private spinAngle = 0;
  private wingFlapTimer = 0;
  private squashScale = new THREE.Vector3(1, 1, 1);

  private boxGeo = new THREE.BoxGeometry(1, 1, 1);

  constructor() {
    this.root.add(this.auraGroup);

    this.shieldMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.25, 2),
      new THREE.MeshBasicMaterial({
        color: '#4ade80',
        transparent: true,
        opacity: 0.22,
        wireframe: true,
      })
    );
    this.shieldMesh.position.set(0, 1.1, 0);
    this.shieldMesh.visible = false;
    this.root.add(this.shieldMesh);

    this.rebuildRig();
  }

  /**
   * Upgrades the rig to the preloaded `.glb` hero + weapon + wings once AssetRegistry completes.
   */
  public refreshFromRegistry(): void {
    if (!this.usingGlbHero && assetRegistry.hasModel('vanguard_hero')) {
      this.rebuildRig();
    }
  }

  private rebuildRig(): void {
    if (this.bodyPivot.parent === this.root) {
      this.root.remove(this.bodyPivot);
    }

    this.torsoMats = [];
    this.trimMats = [];
    this.limbMats = [];
    this.shoeMats = [];
    this.hairMats = [];
    this.skinMats = [];
    this.bladeGlowMats = [];
    this.bladeBaseNode = null;
    this.bladeTipNode = null;
    this.leftWingPivot = null;
    this.rightWingPivot = null;
    this.wingsGroup = null;

    const glbHero = assetRegistry.cloneModel('vanguard_hero', true);
    if (glbHero) {
      this.usingGlbHero = true;
      this.bodyPivot = new THREE.Group();
      this.bodyPivot.add(glbHero);
      this.root.add(this.bodyPivot);

      this.headPivot = glbHero.getObjectByName('HeadPivot') ?? new THREE.Group();
      this.leftArmPivot = glbHero.getObjectByName('LeftArmPivot') ?? new THREE.Group();
      this.rightArmPivot = glbHero.getObjectByName('RightArmPivot') ?? new THREE.Group();
      this.leftLegPivot = glbHero.getObjectByName('LeftLegPivot') ?? new THREE.Group();
      this.rightLegPivot = glbHero.getObjectByName('RightLegPivot') ?? new THREE.Group();
      this.headgearSocket = glbHero.getObjectByName('HeadgearSocket') ?? this.headPivot;
      this.backSocket = glbHero.getObjectByName('BackSocket') ?? this.bodyPivot;
      this.weaponSocket = glbHero.getObjectByName('WeaponSocket') ?? this.rightArmPivot;

      this.headgearGroup = new THREE.Group();
      this.headgearSocket.add(this.headgearGroup);

      glbHero.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
          const m = obj.material;
          if (m.name.startsWith('Mat_Torso')) this.torsoMats.push(m);
          else if (m.name.startsWith('Mat_Trim')) this.trimMats.push(m);
          else if (m.name.startsWith('Mat_Limb')) this.limbMats.push(m);
          else if (m.name.startsWith('Mat_Shoe')) this.shoeMats.push(m);
          else if (m.name.startsWith('Mat_Hair')) this.hairMats.push(m);
          else if (m.name.startsWith('Mat_Skin')) this.skinMats.push(m);
        }
      });

      // Attach equipped 3D weapon .glb into right-hand WeaponSocket
      this.attachEquippedWeaponMesh();

      // Attach Aether Sky Wings .glb onto BackSocket (shown once Sky Wings passive is unlocked)
      const wingsGlb = assetRegistry.cloneModel('wings_aether', true);
      if (wingsGlb) {
        this.wingsGroup = wingsGlb;
        this.wingsGroup.visible = false;
        this.backSocket.add(this.wingsGroup);
        this.leftWingPivot = wingsGlb.getObjectByName('LeftWingPivot') ?? null;
        this.rightWingPivot = wingsGlb.getObjectByName('RightWingPivot') ?? null;
      }
    } else {
      this.buildProceduralFallbackRig();
    }

    this.applySkin(this.currentSkin);
  }

  private attachEquippedWeaponMesh(): void {
    if (!this.usingGlbHero) return;
    this.weaponSocket.clear();
    this.bladeGlowMats = [];
    this.bladeBaseNode = null;
    this.bladeTipNode = null;

    const wepDef = WEAPONS[this.currentWeaponId] ?? WEAPONS.skyblade;
    const bladeGlb =
      assetRegistry.cloneModel(wepDef.modelKey, true) ??
      assetRegistry.cloneModel('weapon_skyblade', true);

    if (bladeGlb) {
      this.weaponSocket.add(bladeGlb);
      this.bladeBaseNode = bladeGlb.getObjectByName('BladeBase') ?? null;
      this.bladeTipNode = bladeGlb.getObjectByName('BladeTip') ?? null;
      bladeGlb.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material) {
          const mat = obj.material as THREE.Material;
          if (mat.name.startsWith('Mat_BladeGlow')) {
            this.bladeGlowMats.push(mat);
          }
        }
      });
    }
  }

  applyWeapon(weaponId: string): void {
    const cleanId = WEAPONS[weaponId] ? weaponId : 'skyblade';
    if (this.currentWeaponId === cleanId && this.weaponSocket.children.length > 0) return;
    this.currentWeaponId = cleanId;
    if (this.usingGlbHero) {
      this.attachEquippedWeaponMesh();
    }
  }

  private buildProceduralFallbackRig(): void {
    this.usingGlbHero = false;
    this.bodyPivot = new THREE.Group();
    this.root.add(this.bodyPivot);

    const torsoMat = new THREE.MeshStandardMaterial({ roughness: 0.55 });
    const trimMat = new THREE.MeshStandardMaterial({ roughness: 0.35, emissiveIntensity: 0.35 });
    const limbMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
    const shoeMat = new THREE.MeshStandardMaterial({ roughness: 0.45 });
    const hairMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ roughness: 0.65 });
    const bladeGlow = new THREE.MeshBasicMaterial({ color: '#38bdf8' });

    this.torsoMats = [torsoMat];
    this.trimMats = [trimMat];
    this.limbMats = [limbMat];
    this.shoeMats = [shoeMat];
    this.hairMats = [hairMat];
    this.skinMats = [skinMat];
    this.bladeGlowMats = [bladeGlow];

    const torso = new THREE.Mesh(this.boxGeo, torsoMat);
    torso.scale.set(0.86, 0.92, 0.46);
    torso.position.set(0, 1.12, 0);
    this.bodyPivot.add(torso);

    const headPiv = new THREE.Group();
    headPiv.position.set(0, 1.6, 0);
    const head = new THREE.Mesh(this.boxGeo, skinMat);
    head.scale.set(0.58, 0.58, 0.58);
    head.position.set(0, 0.3, 0);
    headPiv.add(head);

    this.headgearGroup = new THREE.Group();
    this.headgearGroup.position.set(0, 0.68, 0);
    headPiv.add(this.headgearGroup);
    this.bodyPivot.add(headPiv);
    this.headPivot = headPiv;
    this.headgearSocket = this.headgearGroup;

    const lArmPiv = new THREE.Group();
    lArmPiv.position.set(-0.62, 1.5, 0);
    const lArm = new THREE.Mesh(this.boxGeo, limbMat);
    lArm.scale.set(0.34, 0.72, 0.36);
    lArm.position.set(0, -0.32, 0);
    lArmPiv.add(lArm);
    this.bodyPivot.add(lArmPiv);
    this.leftArmPivot = lArmPiv;

    const rArmPiv = new THREE.Group();
    rArmPiv.position.set(0.62, 1.5, 0);
    const rArm = new THREE.Mesh(this.boxGeo, limbMat);
    rArm.scale.set(0.34, 0.72, 0.36);
    rArm.position.set(0, -0.32, 0);
    rArmPiv.add(rArm);

    const swordGroup = new THREE.Group();
    swordGroup.position.set(0, -0.74, -0.2);
    swordGroup.rotation.x = -Math.PI * 0.32;
    const blade = new THREE.Mesh(this.boxGeo, bladeGlow);
    blade.scale.set(0.11, 1.35, 0.22);
    blade.position.set(0, 0.85, 0);
    swordGroup.add(blade);

    const baseEmpty = new THREE.Object3D();
    baseEmpty.position.set(0, 0.2, 0);
    const tipEmpty = new THREE.Object3D();
    tipEmpty.position.set(0, 1.52, 0);
    swordGroup.add(baseEmpty, tipEmpty);
    this.bladeBaseNode = baseEmpty;
    this.bladeTipNode = tipEmpty;

    rArmPiv.add(swordGroup);
    this.bodyPivot.add(rArmPiv);
    this.rightArmPivot = rArmPiv;

    const lLegPiv = new THREE.Group();
    lLegPiv.position.set(-0.23, 0.68, 0);
    const lLeg = new THREE.Mesh(this.boxGeo, limbMat);
    lLeg.scale.set(0.38, 0.54, 0.4);
    lLeg.position.set(0, -0.27, 0);
    lLegPiv.add(lLeg);
    this.bodyPivot.add(lLegPiv);
    this.leftLegPivot = lLegPiv;

    const rLegPiv = new THREE.Group();
    rLegPiv.position.set(0.23, 0.68, 0);
    const rLeg = new THREE.Mesh(this.boxGeo, limbMat);
    rLeg.scale.set(0.38, 0.54, 0.4);
    rLeg.position.set(0, -0.27, 0);
    rLegPiv.add(rLeg);
    this.bodyPivot.add(rLegPiv);
    this.rightLegPivot = rLegPiv;
  }

  applySkin(skin: SkinDefinition): void {
    this.currentSkin = skin;

    for (const m of this.torsoMats) m.color.set(skin.torsoColor);
    for (const m of this.trimMats) {
      m.color.set(skin.trimColor);
      m.emissive.set(skin.trimColor);
      m.emissiveIntensity = 0.48;
    }
    for (const m of this.limbMats) m.color.set(skin.limbColor);
    for (const m of this.shoeMats) m.color.set(skin.shoeColor);
    for (const m of this.hairMats) m.color.set(skin.hairColor);
    for (const m of this.skinMats) m.color.set(skin.skinTone);
    // Keep weapon's signature plasma hue unless starter skyblade adapts to skin
    if (this.currentWeaponId === 'skyblade') {
      for (const m of this.bladeGlowMats) {
        if ('color' in m && m.color instanceof THREE.Color) {
          m.color.set(skin.accentColor);
        }
        if ('emissive' in m && m.emissive instanceof THREE.Color) {
          m.emissive.set(skin.accentColor);
        }
      }
    }

    this.headgearGroup.clear();
    this.auraGroup.clear();

    if (skin.headgear !== 'none') {
      const hgKey = HEADGEAR_MODEL_MAP[skin.headgear];
      const hgModel = assetRegistry.cloneModel(hgKey, true);
      if (hgModel) {
        this.headgearGroup.add(hgModel);
      } else {
        const fallbackMat = new THREE.MeshBasicMaterial({ color: skin.accentColor });
        const crown = new THREE.Mesh(this.boxGeo, fallbackMat);
        crown.scale.set(0.5, 0.16, 0.5);
        this.headgearGroup.add(crown);
      }
    }

    if (skin.auraColor) {
      const auraMat = new THREE.MeshBasicMaterial({ color: skin.auraColor });
      const gemGeo = new THREE.OctahedronGeometry(0.09, 0);
      for (let i = 0; i < 4; i++) {
        const m = new THREE.Mesh(gemGeo, auraMat);
        const a = (i / 4) * Math.PI * 2;
        m.position.set(Math.cos(a) * 0.88, 0.92 + (i % 2) * 0.36, Math.sin(a) * 0.88);
        this.auraGroup.add(m);
      }
    }
  }

  triggerAttackPose(comboIndex: number): void {
    this.swingTimer = 0.25;
    this.swingCombo = comboIndex;
    this.triggerSquashStretch(1.08, 0.94, 1.08);
  }

  triggerJumpStretch(isDouble: boolean): void {
    this.triggerSquashStretch(0.84, 1.2, 0.84);
    this.wingFlapTimer = isDouble ? 0.55 : 0.25;
    if (isDouble) {
      this.spinAngle = Math.PI * 2;
    }
  }

  triggerLandSquash(): void {
    this.triggerSquashStretch(1.18, 0.82, 1.18);
  }

  triggerDoubleJumpSpin(): void {
    this.triggerJumpStretch(true);
  }

  triggerSquashStretch(sx: number, sy: number, sz: number): void {
    this.squashScale.set(sx, sy, sz);
  }

  triggerHurtFlash(): void {
    this.hurtFlashTimer = 0.22;
    this.triggerSquashStretch(1.14, 0.86, 1.14);
  }

  isSwinging(): boolean {
    return this.swingTimer > 0.02;
  }

  /**
   * Returns world-space base & tip positions of the held Skyblade for continuous 3D trail ribbons.
   */
  getBladeSegmentWorld(outBase: THREE.Vector3, outTip: THREE.Vector3): boolean {
    if (!this.bladeBaseNode || !this.bladeTipNode) return false;
    this.root.updateMatrixWorld(true);
    this.bladeBaseNode.getWorldPosition(outBase);
    this.bladeTipNode.getWorldPosition(outTip);
    return true;
  }

  update(
    dt: number,
    speedRatio: number,
    grounded: boolean,
    dashing: boolean,
    hasShield: boolean,
    hasWings = false
  ): void {
    this.refreshFromRegistry();

    this.shieldMesh.visible = hasShield;
    if (hasShield) {
      this.shieldMesh.rotation.y += dt * 1.6;
    }

    if (this.wingsGroup) {
      this.wingsGroup.visible = hasWings;
      if (hasWings) {
        if (this.wingFlapTimer > 0) {
          this.wingFlapTimer = Math.max(0, this.wingFlapTimer - dt);
        }
        const flap =
          this.wingFlapTimer > 0
            ? Math.sin(this.wingFlapTimer * 26) * 0.55
            : Math.sin(this.walkCycle * 0.65) * 0.14;
        if (this.leftWingPivot) this.leftWingPivot.rotation.y = -0.22 - flap;
        if (this.rightWingPivot) this.rightWingPivot.rotation.y = 0.22 + flap;
      }
    }

    if (this.auraGroup.children.length > 0) {
      this.auraGroup.rotation.y += dt * 2.0;
    }

    // Hurt emissive flash
    if (this.hurtFlashTimer > 0) {
      this.hurtFlashTimer = Math.max(0, this.hurtFlashTimer - dt);
      for (const m of this.torsoMats) {
        m.emissive.set('#ef4444');
        m.emissiveIntensity = 0.85;
      }
    } else {
      for (const m of this.torsoMats) {
        m.emissive.set('#000000');
        m.emissiveIntensity = 0;
      }
    }

    // Smoothly spring squash-and-stretch back to exact rest (1,1,1)
    const springLerp = Math.min(1, dt * 15);
    this.squashScale.lerp(new THREE.Vector3(1, 1, 1), springLerp);
    if (this.squashScale.distanceToSquared(new THREE.Vector3(1, 1, 1)) < 0.0002) {
      this.squashScale.set(1, 1, 1);
    }
    this.bodyPivot.scale.copy(this.squashScale);

    // Midair spin on double jump
    if (this.spinAngle > 0) {
      const step = Math.min(this.spinAngle, dt * 18);
      this.spinAngle -= step;
      this.bodyPivot.rotation.y = this.spinAngle;
    } else {
      this.bodyPivot.rotation.y = 0;
    }

    // Forward lean when running or dashing
    const targetLean = dashing ? 0.36 : grounded ? speedRatio * 0.15 : -0.06;
    this.bodyPivot.rotation.x = THREE.MathUtils.lerp(this.bodyPivot.rotation.x, targetLean, dt * 14);

    if (grounded && speedRatio > 0.06) {
      this.walkCycle += dt * (8.5 + speedRatio * 5.8);
      const swing = Math.sin(this.walkCycle) * 0.78 * speedRatio;
      this.leftLegPivot.rotation.x = swing;
      this.rightLegPivot.rotation.x = -swing;
      this.leftArmPivot.rotation.x = -swing * 0.85;
      this.bodyPivot.position.y = Math.abs(Math.cos(this.walkCycle)) * 0.08 * speedRatio;
    } else if (!grounded) {
      this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(this.leftLegPivot.rotation.x, 0.38, dt * 12);
      this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(this.rightLegPivot.rotation.x, -0.28, dt * 12);
      this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -0.5, dt * 12);
      this.bodyPivot.position.y = 0;
    } else {
      this.walkCycle += dt * 2.2;
      this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(this.leftLegPivot.rotation.x, 0, dt * 14);
      this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(this.rightLegPivot.rotation.x, 0, dt * 14);
      this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(
        this.leftArmPivot.rotation.x,
        Math.sin(this.walkCycle) * 0.05,
        dt * 10
      );
      this.bodyPivot.position.y = Math.sin(this.walkCycle) * 0.03;
    }

    // Right arm weapon swing override
    if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - dt);
      const p = 1 - this.swingTimer / 0.25;
      const eased = 1 - Math.pow(1 - p, 2.4);
      const slashAngle = -1.85 + eased * 2.75;
      this.rightArmPivot.rotation.x = slashAngle;
      this.rightArmPivot.rotation.z =
        this.swingCombo === 1 ? -0.52 : this.swingCombo === 2 ? 0.12 : 0.42;
    } else {
      const restArm =
        grounded && speedRatio > 0.06 ? Math.sin(this.walkCycle) * 0.62 * speedRatio : -0.15;
      this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
        this.rightArmPivot.rotation.x,
        restArm,
        dt * 14
      );
      this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, 0, dt * 14);
    }
  }
}

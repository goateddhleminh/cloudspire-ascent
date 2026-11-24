import * as THREE from 'three';
import { assetRegistry, ModelKey } from '../assets/AssetRegistry';
import { EnemyArchetypeId, FloorConfig } from '../config/floors';
import { EnemySpawnSpec } from '../world/RoomModules';

export interface EnemyArchetypeStats {
  name: string;
  baseHp: number;
  baseDamage: number;
  moveSpeed: number;
  radius: number;
  detectRange: number;
  attackRange: number;
  attackCooldown: number;
  windupDuration: number;
  coinReward: number;
  xpReward: number;
  bodyColor: string;
  accentColor: string;
  scale: number;
}

export const ENEMY_ARCHETYPES: Record<EnemyArchetypeId, EnemyArchetypeStats> = {
  striker: {
    name: 'Crimson Striker',
    baseHp: 58,
    baseDamage: 14,
    moveSpeed: 5.4,
    radius: 0.65,
    detectRange: 14.5,
    attackRange: 2.15,
    attackCooldown: 1.35,
    windupDuration: 0.42,
    coinReward: 16,
    xpReward: 24,
    bodyColor: '#272036',
    accentColor: '#f43f5e',
    scale: 1.0,
  },
  sentinel: {
    name: 'Prism Sentinel',
    baseHp: 46,
    baseDamage: 12,
    moveSpeed: 3.4,
    radius: 0.62,
    detectRange: 18.0,
    attackRange: 13.5,
    attackCooldown: 2.1,
    windupDuration: 0.52,
    coinReward: 19,
    xpReward: 28,
    bodyColor: '#1e293b',
    accentColor: '#a855f7',
    scale: 0.96,
  },
  bulwark: {
    name: 'Aegis Juggernaut',
    baseHp: 105,
    baseDamage: 20,
    moveSpeed: 4.1,
    radius: 0.88,
    detectRange: 15.5,
    attackRange: 3.6,
    attackCooldown: 2.3,
    windupDuration: 0.68,
    coinReward: 30,
    xpReward: 42,
    bodyColor: '#334155',
    accentColor: '#fbbf24',
    scale: 1.28,
  },
  warden_boss: {
    name: 'Spire Warden',
    baseHp: 340,
    baseDamage: 24,
    moveSpeed: 4.4,
    radius: 1.35,
    detectRange: 24.0,
    attackRange: 15.0,
    attackCooldown: 2.2,
    windupDuration: 0.72,
    coinReward: 135,
    xpReward: 120,
    bodyColor: '#1e1b4b',
    accentColor: '#fbbf24',
    scale: 1.72,
  },
};

const ARCHETYPE_MODEL_KEY: Record<EnemyArchetypeId, ModelKey> = {
  striker: 'enemy_crimson_striker',
  sentinel: 'enemy_prism_sentinel',
  bulwark: 'enemy_aegis_juggernaut',
  warden_boss: 'enemy_spire_warden_boss',
};

export interface EnemyAttackAction {
  kind: 'melee' | 'projectile' | 'shockwave' | 'boss_volley';
  damage: number;
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  radius?: number;
}

export class Enemy {
  public readonly id: string;
  public readonly archetype: EnemyArchetypeId;
  public readonly stats: EnemyArchetypeStats;
  public readonly isTrainingDummy: boolean;
  public readonly isBoss: boolean;

  public readonly position: THREE.Vector3;
  public readonly homePos: THREE.Vector3;
  public readonly knockbackVel = new THREE.Vector3();
  public readonly mesh = new THREE.Group();

  public hp: number;
  public maxHp: number;
  public damage: number;
  public coinReward: number;
  public xpReward: number;
  public dead = false;
  public justStartedWindup = false;

  private bodyRoot = new THREE.Group();
  private bodyMats: THREE.MeshStandardMaterial[] = [];
  private dummyPivot: THREE.Object3D | null = null;
  private innerRing: THREE.Object3D | null = null;
  private outerRing: THREE.Object3D | null = null;
  private haloRing: THREE.Object3D | null = null;
  private leftArmPivot: THREE.Object3D | null = null;
  private rightArmPivot: THREE.Object3D | null = null;
  private usingGlb = false;

  private telegraphRing: THREE.Mesh;
  private hpBarBg: THREE.Mesh;
  private hpBarFill: THREE.Mesh;
  private floatPhase = Math.random() * Math.PI * 2;
  private patrolAngle = Math.random() * Math.PI * 2;
  private patrolRadius: number;
  private cooldownTimer = 0.8;
  private windupTimer = 0;
  private windingUp = false;
  private hitFlashTimer = 0;
  private dummyWobbleTimer = 0;
  private dummyWobbleDir = new THREE.Vector2(0, 1);
  private squashVec = new THREE.Vector3(1, 1, 1);
  private bossCycle = 0;

  constructor(
    spec: EnemySpawnSpec,
    floorConfig: FloorConfig,
    private sharedBoxGeo: THREE.BoxGeometry
  ) {
    this.id = spec.id;
    this.archetype = spec.archetype;
    this.stats = ENEMY_ARCHETYPES[spec.archetype];
    this.isTrainingDummy = Boolean(spec.isTrainingDummy);
    this.isBoss = spec.archetype === 'warden_boss';
    this.patrolRadius = spec.patrolRadius;

    this.position = new THREE.Vector3(spec.x, spec.y, spec.z);
    this.homePos = this.position.clone();

    this.maxHp = this.isTrainingDummy
      ? 200
      : Math.round(this.stats.baseHp * floorConfig.enemyHealthScale);
    this.hp = this.maxHp;
    this.damage = this.isTrainingDummy
      ? 0
      : Math.round(this.stats.baseDamage * floorConfig.enemyDamageScale);
    this.coinReward = Math.round(this.stats.coinReward * floorConfig.coinMultiplier);
    this.xpReward = this.stats.xpReward;

    this.mesh.add(this.bodyRoot);
    this.buildVisualMesh();

    // Ground telegraph ring when winding up an attack
    const ringGeo = new THREE.RingGeometry(0.7, 0.98, 28);
    ringGeo.rotateX(-Math.PI / 2);
    this.telegraphRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: '#fb923c',
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      })
    );
    this.telegraphRing.position.y = 0.08;
    this.telegraphRing.visible = false;
    this.telegraphRing.userData.ownGeometry = true;
    this.mesh.add(this.telegraphRing);

    const barScale = this.stats.scale;
    this.hpBarBg = new THREE.Mesh(
      sharedBoxGeo,
      new THREE.MeshBasicMaterial({ color: '#0f172a' })
    );
    this.hpBarBg.scale.set(1.28 * barScale, 0.13, 0.06);
    this.hpBarBg.position.set(0, 2.48 * barScale, 0);
    this.hpBarBg.visible = this.isTrainingDummy;
    this.mesh.add(this.hpBarBg);

    this.hpBarFill = new THREE.Mesh(
      sharedBoxGeo,
      new THREE.MeshBasicMaterial({ color: this.isTrainingDummy ? '#38bdf8' : '#ef4444' })
    );
    this.hpBarFill.scale.set(1.2 * barScale, 0.09, 0.08);
    this.hpBarFill.position.set(0, 2.48 * barScale, 0);
    this.hpBarFill.visible = this.isTrainingDummy;
    this.mesh.add(this.hpBarFill);

    this.mesh.position.copy(this.position);
  }

  private buildVisualMesh(): void {
    this.bodyRoot.clear();
    this.bodyMats = [];
    const modelKey: ModelKey = this.isTrainingDummy
      ? 'npc_training_dummy'
      : ARCHETYPE_MODEL_KEY[this.archetype];

    const glb = assetRegistry.cloneModel(modelKey, true);
    if (glb) {
      this.usingGlb = true;
      glb.scale.setScalar(this.stats.scale);
      this.bodyRoot.add(glb);

      this.dummyPivot = glb.getObjectByName('DummyBodyPivot') ?? null;
      this.innerRing = glb.getObjectByName('InnerRing') ?? null;
      this.outerRing = glb.getObjectByName('OuterRing') ?? null;
      this.haloRing = glb.getObjectByName('HaloRing') ?? null;
      this.leftArmPivot = glb.getObjectByName('LeftArmPivot') ?? null;
      this.rightArmPivot = glb.getObjectByName('RightArmPivot') ?? null;

      glb.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
          if (
            obj.material.name.startsWith('Mat_EnemyBody') ||
            obj.material.name.startsWith('Mat_EnemyPlate') ||
            obj.material.name.startsWith('Mat_DummyWood')
          ) {
            this.bodyMats.push(obj.material);
          }
        }
      });
      return;
    }

    // Headless / test procedural fallback
    this.usingGlb = false;
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.isTrainingDummy ? '#78350f' : this.stats.bodyColor,
      roughness: 0.5,
      metalness: 0.2,
    });
    const accentMat = new THREE.MeshBasicMaterial({
      color: this.isTrainingDummy ? '#38bdf8' : this.stats.accentColor,
    });
    this.bodyMats = [bodyMat];

    const g = new THREE.Group();
    g.scale.setScalar(this.stats.scale);
    const torso = new THREE.Mesh(this.sharedBoxGeo, bodyMat);
    torso.scale.set(0.95, 1.15, 0.65);
    torso.position.set(0, 1.0, 0);
    g.add(torso);
    const visor = new THREE.Mesh(this.sharedBoxGeo, accentMat);
    visor.scale.set(0.5, 0.16, 0.72);
    visor.position.set(0, 1.45, 0);
    g.add(visor);
    this.bodyRoot.add(g);
  }

  takeDamage(amount: number, knockDir?: THREE.Vector3): boolean {
    if (this.dead) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlashTimer = 0.15;
    this.squashVec.set(1.22, 0.80, 1.22);

    if (knockDir) {
      if (this.isTrainingDummy) {
        this.dummyWobbleTimer = 0.75;
        this.dummyWobbleDir.set(knockDir.x, knockDir.z).normalize();
      } else {
        const resist = this.isBoss ? 0.25 : this.archetype === 'bulwark' ? 0.55 : 1.0;
        this.knockbackVel.addScaledVector(knockDir, 7.8 * resist);
      }
    }

    if (this.isTrainingDummy && this.hp <= 0) {
      this.hp = this.maxHp;
    }

    const ratio = Math.max(0.02, this.hp / this.maxHp);
    this.hpBarBg.visible = ratio < 0.999 || this.isTrainingDummy;
    this.hpBarFill.visible = this.hpBarBg.visible;
    this.hpBarFill.scale.x = 1.2 * this.stats.scale * ratio;

    if (!this.isTrainingDummy && this.hp <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    cameraQuat: THREE.Quaternion,
    reduceFlashing = false
  ): EnemyAttackAction | null {
    if (this.dead) return null;
    this.justStartedWindup = false;

    const modelKey: ModelKey = this.isTrainingDummy
      ? 'npc_training_dummy'
      : ARCHETYPE_MODEL_KEY[this.archetype];
    if (!this.usingGlb && assetRegistry.hasModel(modelKey)) {
      this.buildVisualMesh();
    }

    this.floatPhase += dt * 3.2;

    // Squash recoil recovery
    this.squashVec.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 14));
    this.bodyRoot.scale.copy(this.squashVec);

    // Hit / Windup emissive flash
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
      for (const m of this.bodyMats) {
        m.emissive.set(reduceFlashing ? '#94a3b8' : '#ffffff');
        m.emissiveIntensity = reduceFlashing ? 0.35 : 0.75;
      }
    } else if (this.windingUp) {
      for (const m of this.bodyMats) {
        m.emissive.set('#f97316');
        m.emissiveIntensity = 0.5;
      }
    } else {
      for (const m of this.bodyMats) {
        m.emissive.set('#000000');
        m.emissiveIntensity = 0;
      }
    }

    // Animated sub-parts (Sentinel Gyro Rings, Boss Halo, Arms, Dummy Spring Wobble)
    if (this.innerRing) {
      this.innerRing.rotation.y += dt * 2.4;
      this.innerRing.rotation.x += dt * 1.1;
    }
    if (this.outerRing) {
      this.outerRing.rotation.y -= dt * 1.8;
      this.outerRing.rotation.z += dt * 0.9;
    }
    if (this.haloRing) {
      this.haloRing.rotation.z += dt * 1.25;
    }
    if (this.leftArmPivot && this.rightArmPivot) {
      const armTarget = this.windingUp ? -1.15 : Math.sin(this.floatPhase * 1.4) * 0.16;
      this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, armTarget, dt * 12);
      this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, armTarget, dt * 12);
    }

    if (this.hpBarBg.visible) {
      this.hpBarBg.quaternion.copy(cameraQuat);
      this.hpBarFill.quaternion.copy(cameraQuat);
    }

    if (this.isTrainingDummy) {
      if (this.dummyWobbleTimer > 0) {
        this.dummyWobbleTimer = Math.max(0, this.dummyWobbleTimer - dt);
        const amp = (this.dummyWobbleTimer / 0.75) * 0.42;
        const osc = Math.sin((0.75 - this.dummyWobbleTimer) * 28) * amp;
        if (this.dummyPivot) {
          this.dummyPivot.rotation.x = osc * this.dummyWobbleDir.y;
          this.dummyPivot.rotation.z = -osc * this.dummyWobbleDir.x;
        }
      } else if (this.dummyPivot) {
        this.dummyPivot.rotation.x = 0;
        this.dummyPivot.rotation.z = 0;
      }
      this.mesh.position.copy(this.position);
      return null;
    }

    if (this.knockbackVel.lengthSq() > 0.01) {
      this.position.x += this.knockbackVel.x * dt;
      this.position.z += this.knockbackVel.z * dt;
      this.knockbackVel.multiplyScalar(Math.max(0, 1 - dt * 10));
    }

    const toPlayer = new THREE.Vector3(
      playerPos.x - this.position.x,
      0,
      playerPos.z - this.position.z
    );
    const dist = toPlayer.length();
    const yDiff = Math.abs(playerPos.y - this.position.y);

    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    }

    if (this.windingUp) {
      this.windupTimer -= dt;
      const pulse = 1 + (1 - Math.max(0, this.windupTimer) / this.stats.windupDuration) * 1.4;
      this.telegraphRing.visible = true;
      this.telegraphRing.scale.setScalar(
        this.archetype === 'bulwark' || this.isBoss ? pulse * 2.1 : pulse
      );

      if (this.windupTimer <= 0) {
        this.windingUp = false;
        this.telegraphRing.visible = false;
        this.cooldownTimer = this.stats.attackCooldown;
        this.squashVec.set(1.18, 0.84, 1.18);

        const dir = dist > 0.01 ? toPlayer.clone().normalize() : new THREE.Vector3(0, 0, 1);
        const origin = this.position.clone().add(new THREE.Vector3(0, 1.15 * this.stats.scale, 0));

        if (this.isBoss) {
          this.bossCycle++;
          if (this.bossCycle % 2 === 0) {
            return {
              kind: 'shockwave',
              damage: this.damage,
              origin: this.position.clone(),
              dir,
              radius: 5.2,
            };
          }
          return {
            kind: 'boss_volley',
            damage: Math.round(this.damage * 0.85),
            origin,
            dir,
          };
        }

        if (this.archetype === 'sentinel') {
          return { kind: 'projectile', damage: this.damage, origin, dir };
        }
        if (this.archetype === 'bulwark') {
          return {
            kind: 'shockwave',
            damage: this.damage,
            origin: this.position.clone(),
            dir,
            radius: 3.9,
          };
        }
        return { kind: 'melee', damage: this.damage, origin: this.position.clone(), dir, radius: 2.4 };
      }

      this.syncMesh();
      return null;
    }

    this.telegraphRing.visible = false;

    if (dist <= this.stats.detectRange && yDiff < 4.5) {
      if (dist > 0.05) {
        const yaw = Math.atan2(toPlayer.x, toPlayer.z) + Math.PI;
        this.mesh.rotation.y = yaw;
      }

      if (dist <= this.stats.attackRange && this.cooldownTimer <= 0) {
        this.windingUp = true;
        this.justStartedWindup = true;
        this.windupTimer = this.stats.windupDuration;
      } else if (this.archetype === 'sentinel' && dist < 5.5) {
        const away = toPlayer.clone().normalize().multiplyScalar(-this.stats.moveSpeed * 0.65 * dt);
        this.moveClampedToHome(away.x, away.z);
      } else if (dist > (this.archetype === 'sentinel' ? 9.5 : this.stats.attackRange * 0.82)) {
        const step = toPlayer.clone().normalize().multiplyScalar(this.stats.moveSpeed * dt);
        this.moveClampedToHome(step.x, step.z);
      }
    } else if (this.patrolRadius > 0.2) {
      this.patrolAngle += dt * 0.9;
      const tx = this.homePos.x + Math.cos(this.patrolAngle) * this.patrolRadius * 0.75;
      const tz = this.homePos.z + Math.sin(this.patrolAngle) * this.patrolRadius * 0.75;
      const dx = tx - this.position.x;
      const dz = tz - this.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.1) {
        this.position.x += (dx / d) * Math.min(d, this.stats.moveSpeed * 0.45 * dt);
        this.position.z += (dz / d) * Math.min(d, this.stats.moveSpeed * 0.45 * dt);
        this.mesh.rotation.y = Math.atan2(dx, dz) + Math.PI;
      }
    }

    this.syncMesh();
    return null;
  }

  private moveClampedToHome(dx: number, dz: number): void {
    const maxLeash = Math.max(4.2, this.patrolRadius + 3.2);
    const nx = this.position.x + dx;
    const nz = this.position.z + dz;
    const offX = nx - this.homePos.x;
    const offZ = nz - this.homePos.z;
    const distFromHome = Math.hypot(offX, offZ);
    if (distFromHome <= maxLeash) {
      this.position.x = nx;
      this.position.z = nz;
    } else {
      const s = maxLeash / distFromHome;
      this.position.x = this.homePos.x + offX * s;
      this.position.z = this.homePos.z + offZ * s;
    }
  }

  private syncMesh(): void {
    const bob =
      this.archetype === 'sentinel' || this.isBoss ? Math.sin(this.floatPhase) * 0.16 : 0;
    this.mesh.position.set(this.position.x, this.position.y + bob, this.position.z);
  }

  dispose(): void {
    for (const m of this.bodyMats) m.dispose();
    this.telegraphRing.geometry.dispose();
    (this.telegraphRing.material as THREE.Material).dispose();
    (this.hpBarBg.material as THREE.Material).dispose();
    (this.hpBarFill.material as THREE.Material).dispose();
  }
}

import * as THREE from 'three';
import { EventBus } from '../../app/events';
import { assetRegistry } from '../assets/AssetRegistry';
import { AudioManager } from '../audio/AudioManager';
import { CONTROLLER_CONFIG } from '../config/balance';
import { getFloorConfig } from '../config/floors';
import { SKILLS, SkillDefinition } from '../config/skills';
import { Enemy } from '../entities/Enemy';
import { PlayerController } from '../player/PlayerController';
import { ComputedPlayerStats } from '../player/PlayerStats';
import { CameraRig } from '../rendering/CameraRig';
import { EffectsManager } from '../rendering/Effects';
import { ColliderBox, EnemySpawnSpec } from '../world/RoomModules';

interface ActiveProjectile {
  fromPlayer: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  damage: number;
  life: number;
  piercing: boolean;
  hitIds: Set<string>;
  mesh: THREE.Object3D;
}

const MAX_PROJECTILES = 36;
const STREAK_DECAY_SECONDS = 5.5;

export class CombatSystem {
  private enemyGroup = new THREE.Group();
  private projectileGroup = new THREE.Group();
  private sharedBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  private sharedSphereGeo = new THREE.OctahedronGeometry(0.28, 1);
  private playerProjMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
  private enemyProjMat = new THREE.MeshBasicMaterial({ color: '#e879f9' });

  public enemies: Enemy[] = [];
  private projectiles: ActiveProjectile[] = [];

  private primaryCooldownTimer = 0;
  private comboStep = 0;
  private comboWindowTimer = 0;
  private skillCooldowns: Record<string, number> = {};

  public hitStreak = 0;
  public hitStreakTimer = 0;
  private trailAccent = '#38bdf8';
  private tmpBase = new THREE.Vector3();
  private tmpTip = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    private events: EventBus,
    private audio: AudioManager,
    private effects: EffectsManager,
    private cameraRig: CameraRig
  ) {
    scene.add(this.enemyGroup);
    scene.add(this.projectileGroup);
  }

  spawnEnemies(specs: EnemySpawnSpec[], floorNumber: number): void {
    this.clear();
    const cfg = getFloorConfig(Math.max(1, floorNumber));
    for (const spec of specs) {
      const enemy = new Enemy(spec, cfg, this.sharedBoxGeo);
      this.enemies.push(enemy);
      this.enemyGroup.add(enemy.mesh);
    }
  }

  resetCooldowns(): void {
    this.primaryCooldownTimer = 0;
    this.comboStep = 0;
    this.comboWindowTimer = 0;
    this.hitStreak = 0;
    this.hitStreakTimer = 0;
    this.skillCooldowns = {};
  }

  getStreakRatio(): number {
    return this.hitStreak > 0 ? Math.max(0, this.hitStreakTimer / STREAK_DECAY_SECONDS) : 0;
  }

  getSkillCooldownRemaining(skillId: string): number {
    return Math.max(0, this.skillCooldowns[skillId] ?? 0);
  }

  getEffectiveSkillCooldown(skill: SkillDefinition, stats: ComputedPlayerStats): number {
    return Number((skill.cooldown * stats.cooldownMultiplier).toFixed(2));
  }

  tryPrimaryAttack(
    player: PlayerController,
    stats: ComputedPlayerStats,
    skinAccent: string
  ): boolean {
    if (this.primaryCooldownTimer > 0) return false;

    if (this.comboWindowTimer <= 0) {
      this.comboStep = 0;
    }
    const step = this.comboStep;
    this.comboStep = (this.comboStep + 1) % 3;
    this.comboWindowTimer = CONTROLLER_CONFIG.comboResetTime;
    this.primaryCooldownTimer =
      CONTROLLER_CONFIG.primaryCooldown * stats.primaryCooldownMultiplier;

    const isFinisher = step === 2;
    this.trailAccent = isFinisher ? '#fbbf24' : skinAccent;

    player.avatar.triggerAttackPose(step);
    this.audio.playSlash(step);
    this.events.emit('player_attack', { comboIndex: step });

    const forward = player.getForwardVector();
    if (player.grounded && !player.isDashing()) {
      player.velocity.x += forward.x * (isFinisher ? 4.2 : 3.4);
      player.velocity.z += forward.z * (isFinisher ? 4.2 : 3.4);
    }

    this.effects.spawnSlashArc(player.position, player.facingYaw, this.trailAccent, step);

    const mult = CONTROLLER_CONFIG.comboMultipliers[step];
    const streakBonus = 1 + Math.min(0.25, Math.floor(this.hitStreak / 4) * 0.05);
    const rawDamage = Math.round(
      CONTROLLER_CONFIG.primaryBaseDamage * mult * stats.damageMultiplier * streakBonus
    );

    let hitAny = false;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.position.x - player.position.x;
      const dz = enemy.position.z - player.position.z;
      const dy = Math.abs(enemy.position.y - player.position.y);
      const dist = Math.hypot(dx, dz);

      const reach =
        CONTROLLER_CONFIG.primaryRange + stats.primaryRangeBonus + enemy.stats.radius;
      if (dist <= reach && dy < 2.6) {
        const dot = dist < 0.85 ? 1 : (dx / dist) * forward.x + (dz / dist) * forward.z;
        if (dot >= CONTROLLER_CONFIG.primaryArcDot) {
          hitAny = true;
          const knockDir =
            dist > 0.05 ? new THREE.Vector3(dx / dist, 0, dz / dist) : forward.clone();
          this.damageEnemy(enemy, rawDamage, isFinisher, knockDir, this.trailAccent);
        }
      }
    }

    if (hitAny) {
      this.cameraRig.addTrauma(isFinisher ? 0.36 : 0.16);
    }
    return true;
  }

  tryUseSkill(
    skillId: string,
    player: PlayerController,
    stats: ComputedPlayerStats,
    moveWorldDir: THREE.Vector3,
    callbacks: {
      grantShieldAndHeal: (shield: number, heal: number) => void;
    }
  ): boolean {
    const skill = SKILLS[skillId];
    if (!skill || skill.kind !== 'active') return false;
    if (this.getSkillCooldownRemaining(skillId) > 0) return false;

    const cd = this.getEffectiveSkillCooldown(skill, stats);
    this.skillCooldowns[skillId] = cd;
    this.audio.playSkill(skillId);
    this.events.emit('skill_used', { skillId });

    const baseDmg = CONTROLLER_CONFIG.primaryBaseDamage * stats.damageMultiplier;

    if (skillId === 'phase_dash') {
      player.startDash(skill.dashSpeed ?? 24, skill.dashDuration ?? 0.22, moveWorldDir);
      this.effects.spawnRing(player.position, skill.accentColor, 2.5, 0.26);
      this.effects.spawnDustPuff(player.position, 6, 0.65);
      this.effects.spawnRuneSwirl(player.position, skill.accentColor, 8);
      this.cameraRig.addTrauma(0.2);

      const dashDmg = Math.round(baseDmg * (skill.damageMultiplier ?? 0.9));
      const dashFwd = player.getForwardVector();
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        const toE = new THREE.Vector3(
          enemy.position.x - player.position.x,
          0,
          enemy.position.z - player.position.z
        );
        const along = toE.dot(dashFwd);
        const perp = toE.clone().addScaledVector(dashFwd, -along).length();
        if (along >= -0.8 && along <= 5.6 && perp <= 1.6 + enemy.stats.radius) {
          this.damageEnemy(enemy, dashDmg, false, dashFwd, skill.accentColor);
        }
      }
      return true;
    }

    if (skillId === 'starlight_bolt') {
      const forward = this.findAutoAimDirection(player);
      const speed = skill.projectileSpeed ?? 28;
      const dmg = Math.round(baseDmg * (skill.damageMultiplier ?? 1.25));
      this.spawnProjectile({
        fromPlayer: true,
        pos: player.position
          .clone()
          .add(new THREE.Vector3(0, 1.15, 0))
          .addScaledVector(forward, 0.8),
        vel: forward.multiplyScalar(speed),
        damage: dmg,
        life: 1.4,
        piercing: true,
      });
      player.avatar.triggerAttackPose(1);
      return true;
    }

    if (skillId === 'solar_nova') {
      const radius = skill.radius ?? 5.4;
      const dmg = Math.round(baseDmg * (skill.damageMultiplier ?? 1.85));
      this.effects.spawnRing(player.position, skill.accentColor, radius, 0.42);
      this.effects.spawnRuneSwirl(player.position, '#fde047', 16);
      this.effects.spawnBurst(player.position, skill.accentColor, 20, 8.5, 1.15);
      this.cameraRig.addTrauma(0.46);

      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        const dx = enemy.position.x - player.position.x;
        const dz = enemy.position.z - player.position.z;
        const dist = Math.hypot(dx, dz);
        if (
          dist <= radius + enemy.stats.radius &&
          Math.abs(enemy.position.y - player.position.y) < 3.0
        ) {
          const knock =
            dist > 0.05
              ? new THREE.Vector3(dx / dist, 0, dz / dist).multiplyScalar(1.45)
              : new THREE.Vector3(0, 0, -1);
          this.damageEnemy(enemy, dmg, true, knock, skill.accentColor);
        }
      }
      return true;
    }

    if (skillId === 'aegis_shield') {
      callbacks.grantShieldAndHeal(skill.shieldAmount ?? 45, skill.healAmount ?? 20);
      this.effects.spawnRing(player.position, skill.accentColor, 3.0, 0.38);
      this.effects.spawnRuneSwirl(player.position, skill.accentColor, 14);
      this.effects.spawnFloatingText(player.position, '+SHIELD & +20 HP', '#4ade80');
      return true;
    }

    return false;
  }

  private findAutoAimDirection(player: PlayerController): THREE.Vector3 {
    const forward = player.getForwardVector();
    let bestTarget: Enemy | null = null;
    let bestScore = Infinity;

    for (const e of this.enemies) {
      if (e.dead) continue;
      const toE = new THREE.Vector3(
        e.position.x - player.position.x,
        e.position.y - player.position.y,
        e.position.z - player.position.z
      );
      const dist = toE.length();
      if (dist > 20 || dist < 0.2) continue;
      const dirXZ = new THREE.Vector3(toE.x, 0, toE.z).normalize();
      const dot = dirXZ.dot(forward);
      if (dot > 0.45) {
        const score = dist - dot * 4;
        if (score < bestScore) {
          bestScore = score;
          bestTarget = e;
        }
      }
    }

    if (bestTarget) {
      return new THREE.Vector3(
        bestTarget.position.x - player.position.x,
        bestTarget.position.y - player.position.y,
        bestTarget.position.z - player.position.z
      ).normalize();
    }
    return forward;
  }

  private spawnProjectile(opts: {
    fromPlayer: boolean;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    damage: number;
    life: number;
    piercing: boolean;
  }): void {
    if (this.projectiles.length >= MAX_PROJECTILES) {
      const old = this.projectiles.shift();
      if (old) this.projectileGroup.remove(old.mesh);
    }

    const glbProj = assetRegistry.cloneModel(
      opts.fromPlayer ? 'proj_starlight_lance' : 'proj_void_orb',
      false
    );
    let mesh: THREE.Object3D;
    if (glbProj) {
      mesh = glbProj;
      const dir = opts.vel.clone().normalize();
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    } else {
      const m = new THREE.Mesh(
        this.sharedSphereGeo,
        opts.fromPlayer ? this.playerProjMat : this.enemyProjMat
      );
      m.scale.setScalar(opts.fromPlayer ? 1.25 : 1.05);
      mesh = m;
    }

    mesh.position.copy(opts.pos);
    this.projectileGroup.add(mesh);

    this.projectiles.push({
      ...opts,
      hitIds: new Set(),
      mesh,
    });
  }

  private damageEnemy(
    enemy: Enemy,
    damage: number,
    crit: boolean,
    knockDir: THREE.Vector3,
    hitColor = '#38bdf8'
  ): void {
    const defeated = enemy.takeDamage(damage, knockDir);
    this.hitStreak += 1;
    this.hitStreakTimer = STREAK_DECAY_SECONDS;

    this.audio.playHit(crit, enemy.isTrainingDummy);
    this.effects.spawnMobHitVfx(
      enemy.position,
      knockDir,
      crit ? '#fbbf24' : hitColor,
      crit
    );
    this.effects.spawnFloatingText(
      enemy.position,
      crit ? `${damage}!` : `${damage}`,
      crit ? '#fbbf24' : '#f8fafc',
      crit
    );

    this.events.emit('enemy_hit', {
      damage,
      crit,
      worldPos: { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z },
    });

    if (defeated) {
      this.audio.playEnemyDefeat();
      this.effects.spawnDustPuff(enemy.position, 8, 0.85);
      this.effects.spawnRuneSwirl(enemy.position, enemy.stats.accentColor, 10);
      this.effects.spawnBurst(enemy.position, enemy.stats.accentColor, 16, 7.5, 1.1);
      this.effects.spawnRing(enemy.position, enemy.stats.accentColor, 3.0, 0.34);
      this.enemyGroup.remove(enemy.mesh);
      enemy.dispose();
      this.events.emit('enemy_defeated', {
        enemyType: enemy.archetype,
        reward: enemy.coinReward,
        xp: enemy.xpReward,
        worldPos: { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z },
      });
    }
  }

  update(
    dt: number,
    player: PlayerController,
    cameraQuat: THREE.Quaternion,
    colliders: ColliderBox[],
    onDamagePlayer: (amount: number) => void,
    reduceFlashing = false
  ): void {
    if (this.primaryCooldownTimer > 0) {
      this.primaryCooldownTimer = Math.max(0, this.primaryCooldownTimer - dt);
    }
    if (this.comboWindowTimer > 0) {
      this.comboWindowTimer = Math.max(0, this.comboWindowTimer - dt);
    }
    if (this.hitStreakTimer > 0) {
      this.hitStreakTimer = Math.max(0, this.hitStreakTimer - dt);
      if (this.hitStreakTimer <= 0) {
        this.hitStreak = 0;
      }
    }
    for (const k of Object.keys(this.skillCooldowns)) {
      if (this.skillCooldowns[k] > 0) {
        this.skillCooldowns[k] = Math.max(0, this.skillCooldowns[k] - dt);
      }
    }

    // Feed 3D Sword Ribbon Trail while swinging or dashing
    if (
      (player.avatar.isSwinging() || player.isDashing()) &&
      player.avatar.getBladeSegmentWorld(this.tmpBase, this.tmpTip)
    ) {
      this.effects.pushBladeTrailSample(
        this.tmpBase,
        this.tmpTip,
        player.isDashing() ? '#fbbf24' : this.trailAccent
      );
    }

    // Update enemies & resolve attacks
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const atk = enemy.update(dt, player.position, cameraQuat, reduceFlashing);
      if (enemy.justStartedWindup) {
        this.audio.playEnemyWindup();
      }
      if (!atk) continue;

      if (atk.kind === 'melee') {
        this.audio.playSlash(0);
        const dist = Math.hypot(
          player.position.x - atk.origin.x,
          player.position.z - atk.origin.z
        );
        if (dist <= (atk.radius ?? 2.4) && Math.abs(player.position.y - atk.origin.y) < 2.2) {
          onDamagePlayer(atk.damage);
        }
      } else if (atk.kind === 'shockwave') {
        const rad = atk.radius ?? 3.9;
        this.audio.playEnemyShockwave();
        this.effects.spawnRing(atk.origin, '#fb923c', rad, 0.36);
        this.effects.spawnDustPuff(atk.origin, 8, 0.8);
        this.cameraRig.addTrauma(0.28);
        const dist = Math.hypot(
          player.position.x - atk.origin.x,
          player.position.z - atk.origin.z
        );
        if (dist <= rad && player.position.y - atk.origin.y < 1.05) {
          onDamagePlayer(atk.damage);
        }
      } else if (atk.kind === 'projectile') {
        this.audio.playEnemyShoot();
        this.spawnProjectile({
          fromPlayer: false,
          pos: atk.origin,
          vel: atk.dir.clone().multiplyScalar(13.5),
          damage: atk.damage,
          life: 2.2,
          piercing: false,
        });
      } else if (atk.kind === 'boss_volley') {
        this.audio.playEnemyShoot();
        for (const angleOffset of [-0.32, 0, 0.32]) {
          const c = Math.cos(angleOffset);
          const s = Math.sin(angleOffset);
          const d = new THREE.Vector3(
            atk.dir.x * c - atk.dir.z * s,
            0,
            atk.dir.x * s + atk.dir.z * c
          ).normalize();
          this.spawnProjectile({
            fromPlayer: false,
            pos: atk.origin.clone(),
            vel: d.multiplyScalar(14.5),
            damage: atk.damage,
            life: 2.4,
            piercing: false,
          });
        }
      }
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.projectileGroup.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.z += dt * 9;

      let hitWall = false;
      for (const box of colliders) {
        if (box.kind !== 'obstacle') continue;
        if (
          p.pos.x >= box.minX &&
          p.pos.x <= box.maxX &&
          p.pos.y >= box.minY &&
          p.pos.y <= box.maxY &&
          p.pos.z >= box.minZ &&
          p.pos.z <= box.maxZ
        ) {
          hitWall = true;
          break;
        }
      }
      if (hitWall) {
        this.effects.spawnBurst(p.pos, '#e2e8f0', 4, 3.2, 0.6);
        this.projectileGroup.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.fromPlayer) {
        let removeProj = false;
        for (const enemy of this.enemies) {
          if (enemy.dead || p.hitIds.has(enemy.id)) continue;
          const dx = enemy.position.x - p.pos.x;
          const dz = enemy.position.z - p.pos.z;
          const dy = Math.abs(enemy.position.y + 1.0 - p.pos.y);
          if (Math.hypot(dx, dz) <= enemy.stats.radius + 0.55 && dy < 1.6) {
            p.hitIds.add(enemy.id);
            this.damageEnemy(
              enemy,
              p.damage,
              false,
              p.vel.clone().setY(0).normalize(),
              '#38bdf8'
            );
            if (!p.piercing) {
              removeProj = true;
              break;
            }
          }
        }
        if (removeProj) {
          this.projectileGroup.remove(p.mesh);
          this.projectiles.splice(i, 1);
        }
      } else {
        const dx = player.position.x - p.pos.x;
        const dz = player.position.z - p.pos.z;
        const dy = Math.abs(player.position.y + 1.0 - p.pos.y);
        if (Math.hypot(dx, dz) <= CONTROLLER_CONFIG.playerRadius + 0.35 && dy < 1.3) {
          onDamagePlayer(p.damage);
          this.projectileGroup.remove(p.mesh);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  getActiveBoss(): Enemy | null {
    return this.enemies.find((e) => e.isBoss && !e.dead) ?? null;
  }

  clear(): void {
    for (const e of this.enemies) {
      this.enemyGroup.remove(e.mesh);
      e.dispose();
    }
    this.enemies = [];
    for (const p of this.projectiles) {
      this.projectileGroup.remove(p.mesh);
    }
    this.projectiles = [];
  }

  dispose(): void {
    this.clear();
    this.sharedBoxGeo.dispose();
    this.sharedSphereGeo.dispose();
    this.playerProjMat.dispose();
    this.enemyProjMat.dispose();
  }
}

import * as THREE from 'three';
import { CONTROLLER_CONFIG } from '../config/balance';
import { ColliderBox, JumpPadSpec, Vec3Spec } from '../world/RoomModules';
import { PlayerAvatar } from './PlayerAvatar';
import { ComputedPlayerStats } from './PlayerStats';

export interface PlayerStepEvents {
  jumped: boolean;
  doubleJumped: boolean;
  landed: boolean;
  stepped: boolean;
  hitJumpPad: JumpPadSpec | null;
  fellInAbyss: boolean;
}

export class PlayerController {
  public readonly position = new THREE.Vector3(0, 0.2, 0);
  public readonly velocity = new THREE.Vector3(0, 0, 0);
  public facingYaw = Math.PI;
  public grounded = false;
  public invulnTimer = 0;

  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private airJumpsUsed = 0;
  private dashTimer = 0;
  private dashDir = new THREE.Vector3(0, 0, -1);
  private dashSpeed = 24;
  private jumpPadCooldown = 0;
  private stepCadenceTimer = 0;
  public lastSafePos = new THREE.Vector3(0, 0.5, 0);

  public readonly avatar = new PlayerAvatar();

  constructor(scene: THREE.Scene) {
    scene.add(this.avatar.root);
  }

  spawnAt(pos: Vec3Spec): void {
    this.position.set(pos.x, pos.y, pos.z);
    this.velocity.set(0, 0, 0);
    this.lastSafePos.set(pos.x, pos.y + 0.3, pos.z);
    this.facingYaw = Math.PI;
    this.grounded = true;
    this.airJumpsUsed = 0;
    this.dashTimer = 0;
    this.invulnTimer = 0.5;
    this.syncVisualPosition();
  }

  startDash(speed: number, duration: number, moveInputWorld?: THREE.Vector3): void {
    this.dashSpeed = speed;
    this.dashTimer = duration;
    this.invulnTimer = Math.max(this.invulnTimer, duration + 0.16);
    if (moveInputWorld && moveInputWorld.lengthSq() > 0.04) {
      this.dashDir.copy(moveInputWorld).normalize();
      this.facingYaw = Math.atan2(this.dashDir.x, this.dashDir.z);
    } else {
      this.dashDir.set(Math.sin(this.facingYaw), 0, Math.cos(this.facingYaw)).normalize();
    }
    this.velocity.y = Math.max(0, this.velocity.y * 0.25);
    this.avatar.triggerSquashStretch(0.82, 0.9, 1.24);
  }

  isDashing(): boolean {
    return this.dashTimer > 0;
  }

  getForwardVector(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.facingYaw), 0, Math.cos(this.facingYaw));
  }

  step(
    dt: number,
    moveAxes: { x: number; z: number },
    jumpPressed: boolean,
    cameraYaw: number,
    stats: ComputedPlayerStats,
    colliders: ColliderBox[],
    jumpPads: JumpPadSpec[],
    hasShield: boolean
  ): PlayerStepEvents {
    const out: PlayerStepEvents = {
      jumped: false,
      doubleJumped: false,
      landed: false,
      stepped: false,
      hitJumpPad: null,
      fellInAbyss: false,
    };

    const wasGrounded = this.grounded;
    const prevVelY = this.velocity.y;

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.jumpPadCooldown > 0) this.jumpPadCooldown = Math.max(0, this.jumpPadCooldown - dt);

    if (jumpPressed) {
      this.jumpBufferTimer = CONTROLLER_CONFIG.jumpBufferTime;
    } else if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);

    const wishX = rightX * moveAxes.x + forwardX * -moveAxes.z;
    const wishZ = rightZ * moveAxes.x + forwardZ * -moveAxes.z;
    const wishLen = Math.hypot(wishX, wishZ);

    if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      this.velocity.x = this.dashDir.x * this.dashSpeed;
      this.velocity.z = this.dashDir.z * this.dashSpeed;
    } else {
      const mag = Math.min(1, wishLen);
      const targetVx = wishLen > 0.01 ? (wishX / wishLen) * stats.moveSpeed * mag : 0;
      const targetVz = wishLen > 0.01 ? (wishZ / wishLen) * stats.moveSpeed * mag : 0;
      const accel =
        wishLen > 0.01
          ? this.grounded
            ? CONTROLLER_CONFIG.groundAcceleration
            : CONTROLLER_CONFIG.airAcceleration
          : this.grounded
            ? CONTROLLER_CONFIG.groundDeceleration
            : CONTROLLER_CONFIG.airDeceleration;

      this.velocity.x = THREE.MathUtils.lerp(
        this.velocity.x,
        targetVx,
        Math.min(1, accel * dt * 0.18)
      );
      this.velocity.z = THREE.MathUtils.lerp(
        this.velocity.z,
        targetVz,
        Math.min(1, accel * dt * 0.18)
      );

      if (wishLen > 0.05) {
        const desiredYaw = Math.atan2(wishX, wishZ);
        let diff = desiredYaw - this.facingYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.facingYaw += diff * Math.min(1, dt * 16);
      }
    }

    if (this.grounded) {
      this.coyoteTimer = CONTROLLER_CONFIG.coyoteTime;
      this.airJumpsUsed = 0;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.jumpBufferTimer > 0) {
      if (this.coyoteTimer > 0) {
        this.velocity.y = CONTROLLER_CONFIG.jumpVelocity;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.avatar.triggerJumpStretch(false);
        out.jumped = true;
      } else if (stats.hasDoubleJump && this.airJumpsUsed < 1) {
        this.velocity.y = CONTROLLER_CONFIG.doubleJumpVelocity;
        this.airJumpsUsed += 1;
        this.jumpBufferTimer = 0;
        this.avatar.triggerJumpStretch(true);
        out.doubleJumped = true;
      }
    }

    if (this.dashTimer <= 0) {
      this.velocity.y = Math.max(-36, this.velocity.y - CONTROLLER_CONFIG.gravity * dt);
    }

    const prevY = this.position.y;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.resolveHorizontalCollisions(colliders);

    this.position.y += this.velocity.y * dt;
    this.grounded = false;
    const r = CONTROLLER_CONFIG.playerRadius;

    for (const box of colliders) {
      const overlapsXZ =
        this.position.x + r > box.minX &&
        this.position.x - r < box.maxX &&
        this.position.z + r > box.minZ &&
        this.position.z - r < box.maxZ;

      if (!overlapsXZ) continue;

      if (
        this.velocity.y <= 0 &&
        prevY >= box.maxY - 0.55 &&
        this.position.y <= box.maxY + 0.08
      ) {
        this.position.y = box.maxY;
        this.velocity.y = 0;
        this.grounded = true;

        const margin = 1.1;
        if (
          box.kind === 'platform' &&
          this.position.x > box.minX + margin &&
          this.position.x < box.maxX - margin &&
          this.position.z > box.minZ + margin &&
          this.position.z < box.maxZ - margin
        ) {
          this.lastSafePos.set(this.position.x, box.maxY + 0.25, this.position.z);
        }
      } else if (
        this.velocity.y > 0 &&
        prevY + CONTROLLER_CONFIG.playerHeight <= box.minY + 0.2 &&
        this.position.y + CONTROLLER_CONFIG.playerHeight > box.minY
      ) {
        this.position.y = box.minY - CONTROLLER_CONFIG.playerHeight;
        this.velocity.y = 0;
      }
    }

    if (!wasGrounded && this.grounded && prevVelY < -3.5) {
      this.avatar.triggerLandSquash();
      out.landed = true;
    }

    if (this.jumpPadCooldown <= 0) {
      for (const pad of jumpPads) {
        const dx = this.position.x - pad.x;
        const dz = this.position.z - pad.z;
        const dy = Math.abs(this.position.y - pad.y);
        if (dx * dx + dz * dz <= (pad.radius + 0.35) ** 2 && dy < 1.2) {
          this.velocity.y = pad.boostVelocityY;
          this.grounded = false;
          this.airJumpsUsed = 0;
          this.jumpPadCooldown = 0.28;
          this.avatar.triggerJumpStretch(true);
          out.hitJumpPad = pad;
          break;
        }
      }
    }

    if (this.position.y < CONTROLLER_CONFIG.abyssFallY) {
      this.position.copy(this.lastSafePos);
      this.velocity.set(0, 0, 0);
      this.invulnTimer = 1.1;
      out.fellInAbyss = true;
    }

    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const speedRatio = Math.min(1.2, horizSpeed / Math.max(1, stats.moveSpeed));

    if (this.grounded && speedRatio > 0.32 && this.dashTimer <= 0) {
      this.stepCadenceTimer -= dt * (0.9 + speedRatio * 0.55);
      if (this.stepCadenceTimer <= 0) {
        this.stepCadenceTimer = 0.33;
        out.stepped = true;
      }
    } else {
      this.stepCadenceTimer = 0.14;
    }

    this.syncVisualPosition();
    this.avatar.update(
      dt,
      speedRatio,
      this.grounded,
      this.dashTimer > 0,
      hasShield,
      stats.hasDoubleJump
    );

    return out;
  }

  private resolveHorizontalCollisions(colliders: ColliderBox[]): void {
    const r = CONTROLLER_CONFIG.playerRadius;
    const footY = this.position.y + 0.45;
    const headY = this.position.y + CONTROLLER_CONFIG.playerHeight;

    for (const box of colliders) {
      if (headY <= box.minY || footY >= box.maxY) continue;

      const closestX = Math.max(box.minX, Math.min(this.position.x, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(this.position.z, box.maxZ));
      const dx = this.position.x - closestX;
      const dz = this.position.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < r * r) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const overlap = r - dist;
          this.position.x += (dx / dist) * overlap;
          this.position.z += (dz / dist) * overlap;
        } else {
          this.position.z += r;
        }
      }
    }
  }

  private syncVisualPosition(): void {
    this.avatar.root.position.copy(this.position);
    this.avatar.root.rotation.y = this.facingYaw + Math.PI;
  }
}

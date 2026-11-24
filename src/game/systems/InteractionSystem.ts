import * as THREE from 'three';
import { LiveInteractable, World } from '../world/World';

export interface InteractionResult {
  coinsCollected: number;
  healCollected: number;
  hazardDamageTaken: number;
  nearestInteractable: LiveInteractable | null;
  autoPortalTriggered: LiveInteractable | null;
}

export class InteractionSystem {
  private hazardHitCooldown = 0;
  private portalGraceTimer = 0;

  resetFloorGrace(): void {
    this.portalGraceTimer = 1.2;
    this.hazardHitCooldown = 0;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    pickupRadius: number,
    coinMultiplier: number,
    world: World,
    portalUnlocked: boolean
  ): InteractionResult {
    if (this.hazardHitCooldown > 0) this.hazardHitCooldown = Math.max(0, this.hazardHitCooldown - dt);
    if (this.portalGraceTimer > 0) this.portalGraceTimer = Math.max(0, this.portalGraceTimer - dt);

    let coinsCollected = 0;
    let healCollected = 0;
    let hazardDamageTaken = 0;

    // 1. Coin Magnet pull & pickup collection
    for (const p of world.pickups) {
      if (p.collected) continue;
      const dx = playerPos.x - p.mesh.position.x;
      const dz = playerPos.z - p.mesh.position.z;
      const dy = playerPos.y + 0.85 - p.mesh.position.y;
      const dist = Math.hypot(dx, dy, dz);

      if (dist <= pickupRadius + 1.8 && p.spec.kind !== 'heal_orb') {
        const pullSpeed = Math.min(18, 6 + (pickupRadius + 1.8 - dist) * 3.5);
        p.mesh.position.x += (dx / Math.max(0.01, dist)) * pullSpeed * dt;
        p.mesh.position.z += (dz / Math.max(0.01, dist)) * pullSpeed * dt;
        p.spec.y += (dy / Math.max(0.01, dist)) * pullSpeed * 0.5 * dt;
      }

      if (dist <= 1.25) {
        p.collected = true;
        p.mesh.visible = false;
        if (p.spec.kind === 'heal_orb') {
          healCollected += p.spec.value;
        } else {
          coinsCollected += Math.max(1, Math.round(p.spec.value * coinMultiplier));
        }
      }
    }

    // 2. Pulsing laser beam hazards
    if (this.hazardHitCooldown <= 0) {
      for (const haz of world.hazards) {
        if (!haz.active) continue;
        const withinX = Math.abs(playerPos.x - haz.spec.x) <= haz.spec.width / 2;
        const withinZ = Math.abs(playerPos.z - haz.spec.z) <= haz.spec.depth / 2 + 0.35;
        const withinY =
          playerPos.y >= haz.spec.y - 0.3 && playerPos.y <= haz.spec.y + 1.15;

        if (withinX && withinZ && withinY) {
          hazardDamageTaken = haz.spec.damage;
          this.hazardHitCooldown = 0.75;
          break;
        }
      }
    }

    // 3. Nearest interactable prompt & automatic portal step-in when unlocked
    let nearestInteractable: LiveInteractable | null = null;
    let nearestDist = Infinity;
    let autoPortalTriggered: LiveInteractable | null = null;

    for (const inter of world.interactables) {
      if (inter.used) continue;
      const dx = playerPos.x - inter.spec.x;
      const dz = playerPos.z - inter.spec.z;
      const dy = Math.abs(playerPos.y - inter.spec.y);
      const dist = Math.hypot(dx, dz);

      if (dist <= inter.spec.radius && dy < 2.5 && dist < nearestDist) {
        nearestDist = dist;
        nearestInteractable = inter;
      }

      if (
        inter.spec.kind === 'portal' &&
        portalUnlocked &&
        this.portalGraceTimer <= 0 &&
        dist <= 1.55 &&
        dy < 2.2
      ) {
        autoPortalTriggered = inter;
      }
    }

    return {
      coinsCollected,
      healCollected,
      hazardDamageTaken,
      nearestInteractable,
      autoPortalTriggered,
    };
  }
}

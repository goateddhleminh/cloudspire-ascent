import * as THREE from 'three';
import { CONTROLLER_CONFIG } from '../config/balance';
import { ColliderBox } from '../world/RoomModules';

function intersectSegmentAABB(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  box: ColliderBox
): number | null {
  let tmin = 0;
  let tmax = 1;
  const pad = 0.28;

  const bounds: [number, number, number, number][] = [
    [ox, dx, box.minX - pad, box.maxX + pad],
    [oy, dy, box.minY - pad, box.maxY + pad],
    [oz, dz, box.minZ - pad, box.maxZ + pad],
  ];

  for (const [o, d, bmin, bmax] of bounds) {
    if (Math.abs(d) < 1e-6) {
      if (o < bmin || o > bmax) return null;
    } else {
      let t1 = (bmin - o) / d;
      let t2 = (bmax - o) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }

  return tmin > 0.02 ? tmin : null;
}

export class CameraRig {
  public yaw = 0;
  public pitch = 0.34;
  private focusPos = new THREE.Vector3(0, 1.5, 0);
  private currentDist: number = CONTROLLER_CONFIG.cameraDistance;
  private trauma = 0;
  private shakeClock = 0;
  public shakeEnabled = true;
  public shakeStrength = 1.0;

  resetBehindTarget(targetPos: { x: number; y: number; z: number }, yaw = 0): void {
    this.yaw = yaw;
    this.pitch = 0.34;
    this.currentDist = CONTROLLER_CONFIG.cameraDistance;
    this.focusPos.set(targetPos.x, targetPos.y + CONTROLLER_CONFIG.cameraLookAheadY, targetPos.z);
  }

  addTrauma(amount: number): void {
    if (!this.shakeEnabled || this.shakeStrength <= 0.01) return;
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  applyLookInput(
    dx: number,
    dy: number,
    keyboardSpin: number,
    sensitivity: number,
    dt: number
  ): void {
    const sensScale = 0.0026 * sensitivity;
    this.yaw -= dx * sensScale;
    this.yaw += keyboardSpin * 2.2 * dt;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + dy * sensScale * 0.85,
      CONTROLLER_CONFIG.cameraPitchMin,
      CONTROLLER_CONFIG.cameraPitchMax
    );
  }

  update(
    camera: THREE.PerspectiveCamera,
    targetPos: THREE.Vector3,
    realDt: number,
    colliders: ColliderBox[] = []
  ): void {
    const desiredFocus = new THREE.Vector3(
      targetPos.x,
      targetPos.y + CONTROLLER_CONFIG.cameraLookAheadY,
      targetPos.z
    );
    const alpha = 1 - Math.exp(-CONTROLLER_CONFIG.cameraFollowDamping * realDt);
    this.focusPos.lerp(desiredFocus, alpha);

    const maxDist = CONTROLLER_CONFIG.cameraDistance;
    const dirX = Math.sin(this.yaw) * Math.cos(this.pitch);
    const dirY = Math.sin(this.pitch) + 0.11;
    const dirZ = Math.cos(this.yaw) * Math.cos(this.pitch);
    const dirLen = Math.hypot(dirX, dirY, dirZ) || 1;
    const nx = dirX / dirLen;
    const ny = dirY / dirLen;
    const nz = dirZ / dirLen;

    let minHitFraction = 1.0;
    const segDx = nx * maxDist;
    const segDy = ny * maxDist;
    const segDz = nz * maxDist;

    for (const box of colliders) {
      const hitT = intersectSegmentAABB(
        this.focusPos.x,
        this.focusPos.y,
        this.focusPos.z,
        segDx,
        segDy,
        segDz,
        box
      );
      if (hitT !== null && hitT < minHitFraction) {
        minHitFraction = hitT;
      }
    }

    const targetDist = Math.max(1.9, maxDist * minHitFraction);
    const distRate = targetDist < this.currentDist ? 24 : 9;
    this.currentDist = THREE.MathUtils.lerp(
      this.currentDist,
      targetDist,
      1 - Math.exp(-distRate * realDt)
    );

    const camX = this.focusPos.x + nx * this.currentDist;
    const camY = this.focusPos.y + ny * this.currentDist;
    const camZ = this.focusPos.z + nz * this.currentDist;

    let shakeX = 0;
    let shakeY = 0;
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - CONTROLLER_CONFIG.traumaDecayPerSec * realDt);
      this.shakeClock += realDt * 32;
      const mag =
        this.trauma *
        this.trauma *
        (this.shakeEnabled ? 0.38 * Math.max(0, Math.min(1, this.shakeStrength)) : 0);
      shakeX = Math.sin(this.shakeClock * 1.7) * mag;
      shakeY = Math.sin(this.shakeClock * 2.3) * mag * 0.75;
    }

    camera.position.set(camX + shakeX, camY + shakeY, camZ);
    camera.lookAt(this.focusPos.x, this.focusPos.y + 0.15, this.focusPos.z);
  }
}

import * as THREE from 'three';
import { assetRegistry, ParticleTexKey } from '../assets/AssetRegistry';

interface CubeParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  startScale: number;
}

interface BillboardParticle {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  startScale: number;
  endScale: number;
  spinSpeed: number;
}

interface RingWave {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  maxRadius: number;
}

interface TrailKnot {
  base: THREE.Vector3;
  tip: THREE.Vector3;
  age: number;
}

export interface FloatingNumberItem {
  id: number;
  worldPos: THREE.Vector3;
  velX: number;
  velY: number;
  life: number;
  maxLife: number;
  el: HTMLDivElement;
}

const MAX_PARTICLES = 90;
const MAX_SPRITES = 110;
const MAX_RINGS = 20;
const MAX_TRAIL_KNOTS = 14;
const TRAIL_MAX_AGE = 0.16;

/**
 * Upgraded High-Impact VFX & Particle Manager:
 * - Textured additive star-sparks, rune motes, crit cross-flares, and soft cloud/dust puffs
 * - Textured crescent sword-slash wave meshes
 * - Continuous 3D Weapon Blade Ribbon Trail
 * - Pop-animated 3D-projected floating combat numbers
 */
export class EffectsManager {
  private group = new THREE.Group();
  private sharedBoxGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  private sharedPlaneGeo = new THREE.PlaneGeometry(2.0, 2.0);
  private sharedRingGeo = new THREE.RingGeometry(0.65, 0.98, 28);
  private sharedSlashGeo = new THREE.RingGeometry(1.1, 2.65, 24, 1, -Math.PI * 0.45, Math.PI * 0.9);

  private particles: CubeParticle[] = [];
  private sprites: BillboardParticle[] = [];
  private rings: RingWave[] = [];
  private floatingNumbers: FloatingNumberItem[] = [];
  private nextFloatId = 1;
  private floatContainer: HTMLDivElement;

  // Continuous 3D Sword Ribbon Trail
  private trailKnots: TrailKnot[] = [];
  private trailGeo = new THREE.BufferGeometry();
  private trailMat: THREE.MeshBasicMaterial;
  private trailMesh: THREE.Mesh;
  private trailPosAttr: THREE.BufferAttribute;

  public reduceFlashing = false;

  constructor(scene: THREE.Scene, uiLayer: HTMLElement) {
    this.sharedPlaneGeo.rotateX(-Math.PI / 2);
    this.sharedRingGeo.rotateX(-Math.PI / 2);
    this.sharedSlashGeo.rotateX(-Math.PI / 2);
    scene.add(this.group);

    // Preallocate ribbon trail buffers
    const maxVerts = MAX_TRAIL_KNOTS * 2;
    const positions = new Float32Array(maxVerts * 3);
    const uvs = new Float32Array(maxVerts * 2);
    const indices: number[] = [];
    for (let i = 0; i < MAX_TRAIL_KNOTS - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
    this.trailPosAttr = new THREE.BufferAttribute(positions, 3);
    this.trailPosAttr.setUsage(THREE.DynamicDrawUsage);
    this.trailGeo.setAttribute('position', this.trailPosAttr);
    this.trailGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.trailGeo.setIndex(indices);
    this.trailGeo.setDrawRange(0, 0);

    this.trailMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.trailMesh = new THREE.Mesh(this.trailGeo, this.trailMat);
    this.trailMesh.frustumCulled = false;
    this.group.add(this.trailMesh);

    this.floatContainer = document.createElement('div');
    this.floatContainer.className = 'floating-numbers-layer';
    uiLayer.appendChild(this.floatContainer);
  }

  private spawnSpriteParticle(opts: {
    texKey: ParticleTexKey;
    pos: { x: number; y: number; z: number };
    vel: THREE.Vector3;
    colorHex: string;
    startScale: number;
    endScale: number;
    life: number;
    gravity?: number;
    additive?: boolean;
    spinSpeed?: number;
  }): void {
    if (this.sprites.length >= MAX_SPRITES) {
      const old = this.sprites.shift();
      if (old) {
        this.group.remove(old.sprite);
        old.mat.dispose();
      }
    }

    const map = assetRegistry.getTexture(opts.texKey);
    const mat = new THREE.SpriteMaterial({
      map: map ?? undefined,
      color: opts.colorHex,
      transparent: true,
      opacity: this.reduceFlashing && opts.additive ? 0.65 : 0.96,
      blending: opts.additive !== false ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(opts.pos.x, opts.pos.y, opts.pos.z);
    sprite.scale.setScalar(opts.startScale);
    this.group.add(sprite);

    this.sprites.push({
      sprite,
      mat,
      vel: opts.vel,
      life: opts.life,
      maxLife: opts.life,
      gravity: opts.gravity ?? 0,
      startScale: opts.startScale,
      endScale: opts.endScale,
      spinSpeed: opts.spinSpeed ?? 0,
    });
  }

  /**
   * Signature Mob Hit VFX: directional star-sparks + impact flare + ripple ring + shard burst!
   */
  spawnMobHitVfx(
    pos: { x: number; y: number; z: number },
    knockDir: { x: number; y: number; z: number },
    colorHex: string,
    crit = false
  ): void {
    const hitCenter = { x: pos.x, y: pos.y + 1.05, z: pos.z };

    // 1. Instant impact cross-flare at strike contact
    if (!this.reduceFlashing) {
      this.spawnSpriteParticle({
        texKey: 'fx_crit_flare',
        pos: hitCenter,
        vel: new THREE.Vector3(0, 0.2, 0),
        colorHex: crit ? '#fef08a' : colorHex,
        startScale: crit ? 2.45 : 1.45,
        endScale: 0.2,
        life: crit ? 0.22 : 0.14,
        additive: true,
        spinSpeed: crit ? 4.5 : 2.5,
      });
    }

    // 2. Directional spray of glowing star sparks
    const sparkCount = crit ? 14 : 8;
    for (let i = 0; i < sparkCount; i++) {
      const spreadA = (Math.random() - 0.5) * 1.9;
      const cos = Math.cos(spreadA);
      const sin = Math.sin(spreadA);
      const dx = knockDir.x * cos - knockDir.z * sin;
      const dz = knockDir.x * sin + knockDir.z * cos;
      const spd = (crit ? 6.8 : 4.8) * (0.55 + Math.random() * 0.85);
      this.spawnSpriteParticle({
        texKey: 'fx_spark_star',
        pos: hitCenter,
        vel: new THREE.Vector3(dx * spd, 2.2 + Math.random() * 4.5, dz * spd),
        colorHex: i % 2 === 0 ? '#ffffff' : colorHex,
        startScale: crit ? 0.68 : 0.48,
        endScale: 0.04,
        life: 0.24 + Math.random() * 0.18,
        gravity: 13.5,
        additive: true,
        spinSpeed: (Math.random() - 0.5) * 10,
      });
    }

    // 3. Expanding ground/air impact ring + 3D construct shards
    this.spawnRing(pos, crit ? '#fbbf24' : colorHex, crit ? 2.5 : 1.65, 0.24);
    this.spawnBurst(pos, colorHex, crit ? 8 : 4, 4.8, crit ? 0.95 : 0.75);
  }

  /**
   * Soft stylized cloud/dust puff for footsteps, jump takeoffs, landings, and enemy shatter.
   */
  spawnDustPuff(pos: { x: number; y: number; z: number }, count = 4, scale = 0.55): void {
    for (let i = 0; i < count; i++) {
      const a = (i / Math.max(1, count)) * Math.PI * 2 + Math.random() * 0.6;
      const out = 0.9 + Math.random() * 1.8;
      this.spawnSpriteParticle({
        texKey: 'fx_smoke_puff',
        pos: {
          x: pos.x + Math.cos(a) * 0.22,
          y: pos.y + 0.18,
          z: pos.z + Math.sin(a) * 0.22,
        },
        vel: new THREE.Vector3(Math.cos(a) * out, 0.65 + Math.random() * 0.9, Math.sin(a) * out),
        colorHex: '#e2e8f0',
        startScale: scale * (0.75 + Math.random() * 0.4),
        endScale: scale * 1.55,
        life: 0.28 + Math.random() * 0.16,
        gravity: -0.5,
        additive: false,
        spinSpeed: (Math.random() - 0.5) * 3,
      });
    }
  }

  /**
   * Rising diamond rune motes for heals, shrines, chests, and level-up blessings.
   */
  spawnRuneSwirl(pos: { x: number; y: number; z: number }, colorHex: string, count = 10): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const rad = 0.55 + Math.random() * 0.75;
      this.spawnSpriteParticle({
        texKey: 'fx_rune_mote',
        pos: {
          x: pos.x + Math.cos(a) * rad,
          y: pos.y + 0.35 + Math.random() * 0.6,
          z: pos.z + Math.sin(a) * rad,
        },
        vel: new THREE.Vector3(
          Math.cos(a + 1.2) * 1.2,
          2.6 + Math.random() * 2.2,
          Math.sin(a + 1.2) * 1.2
        ),
        colorHex,
        startScale: 0.46,
        endScale: 0.06,
        life: 0.55 + Math.random() * 0.28,
        gravity: 0,
        additive: true,
        spinSpeed: 3.5,
      });
    }
  }

  pushBladeTrailSample(base: THREE.Vector3, tip: THREE.Vector3, colorHex: string): void {
    this.trailMat.color.set(colorHex);
    this.trailMat.opacity = this.reduceFlashing ? 0.38 : 0.72;
    this.trailKnots.unshift({
      base: base.clone(),
      tip: tip.clone(),
      age: 0,
    });
    if (this.trailKnots.length > MAX_TRAIL_KNOTS) {
      this.trailKnots.pop();
    }
  }

  spawnBurst(
    pos: { x: number; y: number; z: number },
    colorHex: string,
    count = 10,
    speed = 5.5,
    scale = 1.0
  ): void {
    const allowed = Math.min(count, MAX_PARTICLES - this.particles.length);
    if (allowed <= 0) return;

    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    for (let i = 0; i < allowed; i++) {
      const mesh = new THREE.Mesh(this.sharedBoxGeo, mat);
      mesh.position.set(pos.x, pos.y + 0.5, pos.z);
      const angle = Math.random() * Math.PI * 2;
      const up = 1.8 + Math.random() * speed * 0.75;
      const out = (0.35 + Math.random() * 0.75) * speed;
      const maxLife = 0.32 + Math.random() * 0.28;
      this.group.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * out, up, Math.sin(angle) * out),
        life: maxLife,
        maxLife,
        gravity: 14,
        startScale: scale * (0.75 + Math.random() * 0.6),
      });
    }
  }

  spawnRing(
    pos: { x: number; y: number; z: number },
    colorHex: string,
    maxRadius = 3.5,
    duration = 0.36
  ): void {
    if (this.rings.length >= MAX_RINGS) {
      const oldest = this.rings.shift();
      if (oldest) {
        this.group.remove(oldest.mesh);
        oldest.mat.dispose();
      }
    }

    const ringTex = assetRegistry.getTexture('fx_hit_ring');
    const mat = new THREE.MeshBasicMaterial({
      map: ringTex ?? undefined,
      color: colorHex,
      transparent: true,
      opacity: this.reduceFlashing ? 0.55 : 0.9,
      blending: ringTex ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(ringTex ? this.sharedPlaneGeo : this.sharedRingGeo, mat);
    mesh.position.set(pos.x, pos.y + 0.14, pos.z);
    mesh.scale.setScalar(0.2);
    this.group.add(mesh);
    this.rings.push({
      mesh,
      mat,
      life: duration,
      maxLife: duration,
      maxRadius,
    });
  }

  spawnSlashArc(
    pos: { x: number; y: number; z: number },
    yaw: number,
    colorHex: string,
    comboStep: number
  ): void {
    const slashTex = assetRegistry.getTexture('fx_slash_crescent');
    const mat = new THREE.MeshBasicMaterial({
      map: slashTex ?? undefined,
      color: colorHex,
      transparent: true,
      opacity: this.reduceFlashing ? 0.6 : 0.95,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(slashTex ? this.sharedPlaneGeo : this.sharedSlashGeo, mat);
    mesh.position.set(pos.x, pos.y + 1.05, pos.z);
    mesh.rotation.y = slashTex ? yaw + Math.PI : yaw + Math.PI / 2;
    mesh.rotation.z = comboStep === 1 ? 0.28 : comboStep === 2 ? 0 : -0.24;
    const scale = comboStep === 2 ? 2.45 : 1.95;
    mesh.scale.setScalar(scale * 0.65);
    this.group.add(mesh);

    this.rings.push({
      mesh,
      mat,
      life: 0.2,
      maxLife: 0.2,
      maxRadius: scale,
    });
  }

  spawnFloatingText(
    pos: { x: number; y: number; z: number },
    text: string,
    color = '#ffffff',
    isCrit = false
  ): void {
    if (this.floatingNumbers.length > 26) {
      const old = this.floatingNumbers.shift();
      old?.el.remove();
    }
    const el = document.createElement('div');
    el.className = isCrit || text.endsWith('!') ? 'floating-number crit' : 'floating-number';
    el.textContent = text;
    el.style.color = color;
    this.floatContainer.appendChild(el);

    this.floatingNumbers.push({
      id: this.nextFloatId++,
      worldPos: new THREE.Vector3(
        pos.x + (Math.random() - 0.5) * 0.45,
        pos.y + 1.65,
        pos.z + (Math.random() - 0.5) * 0.45
      ),
      velX: (Math.random() - 0.5) * 0.8,
      velY: isCrit ? 2.3 : 1.55,
      life: isCrit ? 0.95 : 0.82,
      maxLife: isCrit ? 0.95 : 0.82,
      el,
    });
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    // 1. Update 3D Sword Ribbon Trail
    for (let i = this.trailKnots.length - 1; i >= 0; i--) {
      this.trailKnots[i].age += dt;
      if (this.trailKnots[i].age > TRAIL_MAX_AGE) {
        this.trailKnots.splice(i, 1);
      }
    }
    if (this.trailKnots.length >= 2) {
      const arr = this.trailPosAttr.array as Float32Array;
      for (let i = 0; i < this.trailKnots.length; i++) {
        const k = this.trailKnots[i];
        const fade = Math.max(0, 1 - k.age / TRAIL_MAX_AGE);
        // Taper base toward tip as trail ages for sleek pointed ribbon tail
        const bx = THREE.MathUtils.lerp(k.tip.x, k.base.x, fade);
        const by = THREE.MathUtils.lerp(k.tip.y, k.base.y, fade);
        const bz = THREE.MathUtils.lerp(k.tip.z, k.base.z, fade);
        const vi = i * 6;
        arr[vi] = bx;
        arr[vi + 1] = by;
        arr[vi + 2] = bz;
        arr[vi + 3] = k.tip.x;
        arr[vi + 4] = k.tip.y;
        arr[vi + 5] = k.tip.z;
      }
      this.trailPosAttr.needsUpdate = true;
      this.trailGeo.setDrawRange(0, (this.trailKnots.length - 1) * 6);
      this.trailMesh.visible = true;
    } else {
      this.trailMesh.visible = false;
    }

    // 2. Update 3D Cube Shards
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.group.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 7;
      p.mesh.rotation.y += dt * 6;
      const t = Math.max(0.01, p.life / p.maxLife);
      p.mesh.scale.setScalar(p.startScale * t);
    }

    // 3. Update Textured Billboard Sprites
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const sp = this.sprites[i];
      sp.life -= dt;
      if (sp.life <= 0) {
        this.group.remove(sp.sprite);
        sp.mat.dispose();
        this.sprites.splice(i, 1);
        continue;
      }
      sp.vel.y -= sp.gravity * dt;
      sp.sprite.position.addScaledVector(sp.vel, dt);
      sp.mat.rotation += sp.spinSpeed * dt;
      const prog = 1 - sp.life / sp.maxLife;
      const s = THREE.MathUtils.lerp(sp.startScale, sp.endScale, prog);
      sp.sprite.scale.setScalar(Math.max(0.01, s));
      sp.mat.opacity = Math.max(0, (1 - prog * prog) * (this.reduceFlashing ? 0.62 : 0.96));
    }

    // 4. Update Rings & Slash Waves
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.group.remove(r.mesh);
        r.mat.dispose();
        this.rings.splice(i, 1);
        continue;
      }
      const progress = 1 - r.life / r.maxLife;
      const eased = 1 - Math.pow(1 - progress, 3);
      r.mesh.scale.setScalar(0.25 + eased * r.maxRadius);
      r.mat.opacity = (1 - progress) * (this.reduceFlashing ? 0.55 : 0.88);
    }

    // 5. Update Floating Combat Text
    const tempV = new THREE.Vector3();
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = this.floatingNumbers.length - 1; i >= 0; i--) {
      const fn = this.floatingNumbers[i];
      fn.life -= dt;
      if (fn.life <= 0) {
        fn.el.remove();
        this.floatingNumbers.splice(i, 1);
        continue;
      }
      fn.worldPos.x += fn.velX * dt;
      fn.worldPos.y += fn.velY * dt;
      fn.velY = Math.max(0.4, fn.velY - dt * 1.8);

      tempV.copy(fn.worldPos).project(camera);
      if (tempV.z > 1) {
        fn.el.style.opacity = '0';
        continue;
      }
      const sx = (tempV.x * 0.5 + 0.5) * w;
      const sy = (-tempV.y * 0.5 + 0.5) * h;
      const prog = 1 - fn.life / fn.maxLife;
      const pop = prog < 0.16 ? 0.75 + (prog / 0.16) * 0.42 : Math.max(0.92, 1.17 - prog * 0.25);
      const alpha = Math.min(1, (fn.life / fn.maxLife) * 1.55);
      fn.el.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) scale(${pop.toFixed(2)})`;
      fn.el.style.opacity = alpha.toFixed(2);
    }
  }

  clear(): void {
    for (const p of this.particles) this.group.remove(p.mesh);
    this.particles = [];
    for (const s of this.sprites) {
      this.group.remove(s.sprite);
      s.mat.dispose();
    }
    this.sprites = [];
    for (const r of this.rings) {
      this.group.remove(r.mesh);
      r.mat.dispose();
    }
    this.rings = [];
    this.trailKnots = [];
    this.trailMesh.visible = false;
    for (const fn of this.floatingNumbers) fn.el.remove();
    this.floatingNumbers = [];
  }

  dispose(): void {
    this.clear();
    this.sharedBoxGeo.dispose();
    this.sharedPlaneGeo.dispose();
    this.sharedRingGeo.dispose();
    this.sharedSlashGeo.dispose();
    this.trailGeo.dispose();
    this.trailMat.dispose();
    this.floatContainer.remove();
  }
}

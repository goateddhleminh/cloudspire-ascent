import * as THREE from 'three';
import { assetRegistry, ModelKey } from '../assets/AssetRegistry';
import { FloorTheme } from '../config/floors';
import { FloorLayout, HazardSpec, InteractableSpec, PickupSpec } from './RoomModules';

export interface LivePickup {
  spec: PickupSpec;
  mesh: THREE.Object3D;
  collected: boolean;
}

export interface LiveInteractable {
  spec: InteractableSpec;
  group: THREE.Group;
  used: boolean;
  lidMesh?: THREE.Object3D;
  lidOpenPositive?: boolean;
  portalInnerRing?: THREE.Object3D;
  portalRingMaterials?: THREE.Material[];
  portalBeacon?: THREE.Object3D;
  portalBeamMat?: THREE.MeshBasicMaterial;
  npcBodyPivot?: THREE.Object3D;
  npcRightArm?: THREE.Object3D;
  npcPhase?: number;
}

export interface LiveHazard {
  spec: HazardSpec;
  beamMesh: THREE.Mesh;
  beamMat: THREE.MeshBasicMaterial;
  active: boolean;
  warning: boolean;
}

function createStoneTileTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#dce4ef';
  ctx.fillRect(0, 0, 256, 256);

  const cells = 4;
  const step = 256 / cells;
  for (let gx = 0; gx < cells; gx++) {
    for (let gy = 0; gy < cells; gy++) {
      const shade = (gx + gy) % 2 === 0 ? '#e2e8f0' : '#d5deeb';
      ctx.fillStyle = shade;
      ctx.fillRect(gx * step + 2, gy * step + 2, step - 4, step - 4);

      ctx.fillStyle = 'rgba(255,255,255,0.34)';
      ctx.fillRect(gx * step + 2, gy * step + 2, step - 4, 3);
      ctx.fillStyle = 'rgba(30,41,59,0.16)';
      ctx.fillRect(gx * step + 2, (gy + 1) * step - 4, step - 4, 2);
    }
  }

  ctx.strokeStyle = 'rgba(51, 65, 85, 0.34)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= cells; i++) {
    const p = i * step;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(256, p);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const NPC_MODEL_MAP: Record<NonNullable<InteractableSpec['npcId']>, ModelKey> = {
  zephyr: 'npc_shopkeeper',
  lyra: 'npc_armorer',
  orin: 'npc_guide',
};

export class World {
  private rootGroup = new THREE.Group();
  private floorGroup = new THREE.Group();
  private skyMesh: THREE.Mesh;
  private skyUniforms: {
    topColor: { value: THREE.Color };
    bottomColor: { value: THREE.Color };
  };
  private cloudGroup = new THREE.Group();
  private stoneTexture: THREE.CanvasTexture;

  private unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  private coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.14, 16);
  private orbGeo = new THREE.OctahedronGeometry(0.42, 0);
  private padGeo = new THREE.CylinderGeometry(1, 1.12, 0.25, 20);
  private torusGeo = new THREE.TorusGeometry(1.9, 0.16, 12, 32);

  public currentLayout: FloorLayout | null = null;
  public pickups: LivePickup[] = [];
  public interactables: LiveInteractable[] = [];
  public hazards: LiveHazard[] = [];
  private spireRings: THREE.Object3D[] = [];
  private elapsedTime = 0;

  constructor(private scene: THREE.Scene) {
    this.coinGeo.rotateX(Math.PI / 2);
    this.stoneTexture = createStoneTileTexture();

    this.skyUniforms = {
      topColor: { value: new THREE.Color('#4889f0') },
      bottomColor: { value: new THREE.Color('#c7e0fc') },
    };
    const skyGeo = new THREE.SphereGeometry(260, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp(normalize(vWorldPos).y * 0.85 + 0.35, 0.0, 1.0);
          vec3 col = mix(bottomColor, topColor, pow(h, 0.85));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.rootGroup.add(this.skyMesh);

    this.buildCloudSea();
    this.rootGroup.add(this.cloudGroup);
    this.rootGroup.add(this.floorGroup);
    this.scene.add(this.rootGroup);
  }

  private buildCloudSea(): void {
    const cloudMat = new THREE.MeshLambertMaterial({
      color: '#f8fafc',
      emissive: '#cbd5e1',
      emissiveIntensity: 0.28,
    });

    const positions = [
      [-28, -9, -15, 9],
      [30, -10, -24, 11],
      [-35, -8, -55, 12],
      [36, -11, -68, 10],
      [0, -13, -45, 15],
      [-24, -10, -95, 13],
      [26, -9, -105, 12],
      [-18, -11, 18, 9],
      [22, -10, 16, 10],
    ];

    const sphereGeo = new THREE.DodecahedronGeometry(0.68, 1);
    for (const [cx, cy, cz, scale] of positions) {
      const cluster = new THREE.Group();
      cluster.position.set(cx, cy, cz);

      const puffs = [
        [0, 0, 0, 1.45, 0.45, 1.15],
        [-0.72, -0.08, 0.2, 0.95, 0.36, 0.85],
        [0.75, -0.08, -0.15, 1.0, 0.38, 0.9],
      ];
      for (const [px, py, pz, sx, sy, sz] of puffs) {
        const m = new THREE.Mesh(sphereGeo, cloudMat);
        m.position.set(px * scale, py * scale, pz * scale);
        m.scale.set(sx * scale, sy * scale, sz * scale);
        cluster.add(m);
      }
      this.cloudGroup.add(cluster);
    }
  }

  loadLayout(layout: FloorLayout, sunLight: THREE.DirectionalLight): void {
    this.clearFloor();
    this.currentLayout = layout;
    this.elapsedTime = 0;

    this.applyTheme(layout.theme, sunLight);

    const trimColors: Record<string, string> = {
      primary: layout.theme.neonAccent,
      secondary: layout.theme.neonSecondary,
      gold: '#fbbf24',
    };

    // 1. Platforms & Obstacles
    for (const box of layout.colliders) {
      const w = box.maxX - box.minX;
      const h = box.maxY - box.minY;
      const d = box.maxZ - box.minZ;
      const cx = (box.minX + box.maxX) / 2;
      const cy = (box.minY + box.maxY) / 2;
      const cz = (box.minZ + box.maxZ) / 2;

      const tex = this.stoneTexture.clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(d / 4)));

      const mat = new THREE.MeshStandardMaterial({
        color:
          box.stoneVariant === 'secondary'
            ? layout.theme.stoneSecondary
            : layout.theme.stonePrimary,
        map: tex,
        roughness: 0.72,
        metalness: 0.08,
      });

      const mesh = new THREE.Mesh(this.unitBoxGeo, mat);
      mesh.scale.set(w, h, d);
      mesh.position.set(cx, cy, cz);
      mesh.receiveShadow = true;
      mesh.castShadow = box.kind === 'obstacle';
      mesh.userData.ownMaterial = true;
      mesh.userData.ownTexture = tex;
      this.floorGroup.add(mesh);

      if (box.kind === 'platform' && box.neonTrim && box.neonTrim !== 'none') {
        const trimColor = trimColors[box.neonTrim] ?? layout.theme.neonAccent;
        const trimMat = new THREE.MeshBasicMaterial({ color: trimColor });
        const trimMesh = new THREE.Mesh(this.unitBoxGeo, trimMat);
        trimMesh.scale.set(w + 0.14, 0.16, d + 0.14);
        trimMesh.position.set(cx, box.maxY - 0.16, cz);
        trimMesh.userData.ownMaterial = true;
        this.floorGroup.add(trimMesh);
      }
    }

    // 2. Jump Pads (.glb model!)
    for (const pad of layout.jumpPads) {
      const padGroup = new THREE.Group();
      padGroup.position.set(pad.x, pad.y, pad.z);

      const glbPad = assetRegistry.cloneModel('prop_jump_pad', true);
      if (glbPad) {
        glbPad.scale.set(pad.radius, 1, pad.radius);
        glbPad.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
            if (obj.material.name.startsWith('Mat_PadGlow')) {
              obj.material.color.set(pad.color);
              obj.material.emissive.set(pad.color);
            }
          }
        });
        padGroup.add(glbPad);
      } else {
        const glowMat = new THREE.MeshBasicMaterial({ color: pad.color });
        const glow = new THREE.Mesh(this.padGeo, glowMat);
        glow.position.y = 0.14;
        glow.scale.set(pad.radius, 1, pad.radius);
        glow.userData.ownMaterial = true;
        padGroup.add(glow);
      }
      this.floorGroup.add(padGroup);
    }

    // 3. Hazards (Laser Pylon .glb + Pulse Beam)
    for (const haz of layout.hazards) {
      const group = new THREE.Group();
      group.position.set(haz.x, haz.y, haz.z);

      for (const side of [-1, 1]) {
        const glbPylon = assetRegistry.cloneModel('prop_laser_pylon', false);
        if (glbPylon) {
          glbPylon.position.set(side * (haz.width / 2 - 0.2), 0, 0);
          group.add(glbPylon);
        } else {
          const pylonMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4 });
          const pylon = new THREE.Mesh(this.unitBoxGeo, pylonMat);
          pylon.scale.set(0.5, 1.5, 0.5);
          pylon.position.set(side * (haz.width / 2 - 0.2), 0.75, 0);
          pylon.userData.ownMaterial = true;
          group.add(pylon);
        }
      }

      const beamMat = new THREE.MeshBasicMaterial({
        color: '#f43f5e',
        transparent: true,
        opacity: 0.85,
      });
      const beamMesh = new THREE.Mesh(this.unitBoxGeo, beamMat);
      beamMesh.scale.set(haz.width - 0.5, 0.34, 0.34);
      beamMesh.position.set(0, 0.68, 0);
      beamMesh.userData.ownMaterial = true;
      group.add(beamMesh);

      this.floorGroup.add(group);
      this.hazards.push({
        spec: haz,
        beamMesh,
        beamMat,
        active: false,
        warning: false,
      });
    }

    // 4. Pickups (Sky Coin .glb & Heal Orb .glb)
    for (const p of layout.pickups) {
      const isHeal = p.kind === 'heal_orb';
      const glbPick = assetRegistry.cloneModel(isHeal ? 'prop_heal_orb' : 'prop_sky_coin', false);
      let mesh: THREE.Object3D;

      if (glbPick) {
        mesh = glbPick;
      } else {
        const mat = new THREE.MeshStandardMaterial({
          color: isHeal ? '#4ade80' : '#fbbf24',
          emissive: isHeal ? '#22c55e' : '#f59e0b',
          emissiveIntensity: 0.5,
        });
        const m = new THREE.Mesh(isHeal ? this.orbGeo : this.coinGeo, mat);
        m.userData.ownMaterial = true;
        mesh = m;
      }

      mesh.position.set(p.x, p.y, p.z);
      if (p.kind === 'big_coin') {
        mesh.scale.setScalar(1.48);
      }
      this.floorGroup.add(mesh);
      this.pickups.push({ spec: p, mesh, collected: false });
    }

    // 5. Interactables (Portals, Chests, Shrines, Kiosks, Sanctuary NPCs)
    for (const inter of layout.interactables) {
      this.buildInteractable(inter, layout);
    }

    // 6. Scenery Props (Sky Trees, Side Islands, Neon Arches, Horizon Spire)
    for (const prop of layout.props) {
      this.buildProp(prop, layout.theme);
    }
  }

  private buildInteractable(spec: InteractableSpec, layout: FloorLayout): void {
    const group = new THREE.Group();
    group.position.set(spec.x, spec.y, spec.z);
    if (spec.rotationY) {
      group.rotation.y = spec.rotationY;
    }

    // Sanctuary NPC Actors!
    if (spec.kind === 'npc' && spec.npcId) {
      const npcKey = NPC_MODEL_MAP[spec.npcId];
      const npcGlb = assetRegistry.cloneModel(npcKey, false);
      let bodyPiv: THREE.Object3D | undefined;
      let rArm: THREE.Object3D | undefined;

      if (npcGlb) {
        group.add(npcGlb);
        bodyPiv = npcGlb.getObjectByName('BodyPivot') ?? undefined;
        rArm = npcGlb.getObjectByName('RightArmPivot') ?? undefined;
      } else {
        const m = new THREE.Mesh(
          this.unitBoxGeo,
          new THREE.MeshStandardMaterial({ color: '#38bdf8' })
        );
        m.scale.set(0.8, 1.8, 0.5);
        m.position.y = 0.9;
        m.userData.ownMaterial = true;
        group.add(m);
      }

      // Floating golden quest/talk diamond above NPC head
      const markerMat = new THREE.MeshBasicMaterial({
        color: spec.npcId === 'zephyr' ? '#fbbf24' : spec.npcId === 'lyra' ? '#38bdf8' : '#c084fc',
      });
      const marker = new THREE.Mesh(this.orbGeo, markerMat);
      marker.scale.set(0.45, 0.72, 0.45);
      marker.position.set(0, 2.78, 0);
      marker.userData.ownMaterial = true;
      group.add(marker);

      this.floorGroup.add(group);
      this.interactables.push({
        spec,
        group,
        used: false,
        portalBeacon: marker,
        npcBodyPivot: bodyPiv,
        npcRightArm: rArm,
        npcPhase: Math.random() * Math.PI * 2,
      });
      return;
    }

    if (spec.kind === 'portal') {
      const beamMat = new THREE.MeshBasicMaterial({
        color: layout.isHub ? '#38bdf8' : '#c084fc',
        transparent: true,
        opacity: 0.26,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 12, 18, 1, true), beamMat);
      beam.position.set(0, 6, 0);
      beam.userData.ownGeometry = true;
      beam.userData.ownMaterial = true;
      group.add(beam);

      const glbPortal = assetRegistry.cloneModel('prop_ascent_portal', true);
      if (glbPortal) {
        group.add(glbPortal);
        const ringNode = glbPortal.getObjectByName('PortalRing') ?? undefined;
        const beaconNode = glbPortal.getObjectByName('PortalBeacon') ?? undefined;
        const ringMats: THREE.Material[] = [];
        glbPortal.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.material) {
            const mat = obj.material as THREE.Material;
            if (mat.name.startsWith('Mat_PortalRing')) ringMats.push(mat);
          }
        });

        this.floorGroup.add(group);
        this.interactables.push({
          spec,
          group,
          used: false,
          portalInnerRing: ringNode,
          portalRingMaterials: ringMats,
          portalBeacon: beaconNode,
          portalBeamMat: beamMat,
        });
        return;
      }

      const ringMat = new THREE.MeshBasicMaterial({ color: layout.isHub ? '#38bdf8' : '#a855f7' });
      const ring = new THREE.Mesh(this.torusGeo, ringMat);
      ring.position.set(0, 2.4, 0);
      ring.userData.ownMaterial = true;
      group.add(ring);
      this.floorGroup.add(group);
      this.interactables.push({
        spec,
        group,
        used: false,
        portalInnerRing: ring,
        portalRingMaterials: [ringMat],
        portalBeamMat: beamMat,
      });
      return;
    }

    if (spec.kind === 'chest') {
      const glbChest = assetRegistry.cloneModel('prop_sky_chest', false);
      if (glbChest) {
        group.add(glbChest);
        const lidNode = glbChest.getObjectByName('ChestLid') ?? undefined;
        this.floorGroup.add(group);
        this.interactables.push({
          spec,
          group,
          used: false,
          lidMesh: lidNode,
          lidOpenPositive: true,
        });
        return;
      }

      const base = new THREE.Mesh(
        this.unitBoxGeo,
        new THREE.MeshStandardMaterial({ color: '#78350f' })
      );
      base.scale.set(1.35, 0.75, 0.95);
      base.position.set(0, 0.38, 0);
      base.userData.ownMaterial = true;
      group.add(base);
      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, 0.75, -0.45);
      group.add(lidPivot);
      this.floorGroup.add(group);
      this.interactables.push({ spec, group, used: false, lidMesh: lidPivot });
      return;
    }

    const kioskKey: ModelKey =
      spec.kind === 'shop_kiosk'
        ? 'prop_shop_kiosk'
        : spec.kind === 'armory_kiosk'
          ? 'prop_armory_kiosk'
          : 'prop_blessing_shrine';

    const glbKiosk = assetRegistry.cloneModel(kioskKey, false);
    if (glbKiosk) {
      group.add(glbKiosk);
      const beacon = glbKiosk.getObjectByName('PortalBeacon') ?? undefined;
      this.floorGroup.add(group);
      this.interactables.push({ spec, group, used: false, portalBeacon: beacon });
      return;
    }

    const ped = new THREE.Mesh(
      this.padGeo,
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.55 })
    );
    ped.scale.set(1.35, 2.2, 1.35);
    ped.position.set(0, 0.28, 0);
    ped.userData.ownMaterial = true;
    group.add(ped);
    this.floorGroup.add(group);
    this.interactables.push({ spec, group, used: false });
  }

  private buildProp(prop: FloorLayout['props'][number], theme: FloorTheme): void {
    const scale = prop.scale ?? 1;
    const g = new THREE.Group();
    g.position.set(prop.x, prop.y, prop.z);
    g.scale.setScalar(scale);

    if (prop.kind === 'sky_tree') {
      const glbTree = assetRegistry.cloneModel('prop_sky_tree', true);
      if (glbTree) {
        glbTree.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
            if (obj.material.name.startsWith('Mat_Foliage')) {
              obj.material.color.set(theme.foliageColor);
            }
          }
        });
        g.add(glbTree);
        this.floorGroup.add(g);
        return;
      }
    }

    if (prop.kind === 'summit_spire') {
      const glbSpire = assetRegistry.cloneModel('prop_summit_spire', false);
      if (glbSpire) {
        g.add(glbSpire);
        const r1 = glbSpire.getObjectByName('SpireRing1');
        const r2 = glbSpire.getObjectByName('SpireRing2');
        if (r1) this.spireRings.push(r1);
        if (r2) this.spireRings.push(r2);
        this.floorGroup.add(g);
        return;
      }
    }

    if (prop.kind === 'side_island') {
      const rockMat = new THREE.MeshStandardMaterial({
        color: theme.stoneSecondary,
        roughness: 0.8,
      });
      const topMat = new THREE.MeshStandardMaterial({ color: theme.stonePrimary, roughness: 0.7 });

      const top = new THREE.Mesh(this.unitBoxGeo, topMat);
      top.scale.set(7.5, 1.4, 7.5);
      top.position.set(0, 0.5, 0);
      top.userData.ownMaterial = true;
      g.add(top);

      const lower = new THREE.Mesh(this.unitBoxGeo, rockMat);
      lower.scale.set(5.0, 3.2, 5.0);
      lower.position.set(0, -1.6, 0);
      lower.userData.ownMaterial = true;
      g.add(lower);

      const tip = new THREE.Mesh(this.unitBoxGeo, rockMat);
      tip.scale.set(2.6, 2.8, 2.6);
      tip.position.set(0, -4.2, 0);
      g.add(tip);

      this.floorGroup.add(g);
      return;
    }

    if (prop.kind === 'neon_arch') {
      const stoneMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.6 });
      const glowMat = new THREE.MeshBasicMaterial({ color: theme.neonAccent });

      for (const s of [-1, 1]) {
        const col = new THREE.Mesh(this.unitBoxGeo, stoneMat);
        col.scale.set(0.65, 4.8, 0.65);
        col.position.set(s * 3.8, 2.4, 0);
        if (s === -1) col.userData.ownMaterial = true;
        g.add(col);
      }
      const bar = new THREE.Mesh(this.unitBoxGeo, glowMat);
      bar.scale.set(8.2, 0.25, 0.3);
      bar.position.set(0, 4.8, 0);
      bar.userData.ownMaterial = true;
      g.add(bar);

      this.floorGroup.add(g);
    }
  }

  private applyTheme(theme: FloorTheme, sunLight: THREE.DirectionalLight): void {
    this.skyUniforms.topColor.value.set(theme.skyTopColor);
    this.skyUniforms.bottomColor.value.set(theme.skyBottomColor);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.set(theme.fogColor);
    }
    sunLight.color.set(theme.sunColor);
  }

  update(dt: number, playerPos: THREE.Vector3, portalUnlocked: boolean): void {
    this.elapsedTime += dt;
    this.skyMesh.position.copy(playerPos);
    this.cloudGroup.position.z = playerPos.z * 0.45;

    for (const p of this.pickups) {
      if (p.collected) continue;
      p.mesh.rotation.y += dt * 2.8;
      p.mesh.position.y = p.spec.y + Math.sin(this.elapsedTime * 3.4 + p.spec.x) * 0.14;
    }

    for (const inter of this.interactables) {
      if (inter.portalInnerRing) {
        inter.portalInnerRing.rotation.z += dt * (portalUnlocked ? 2.4 : 0.7);
      }
      if (inter.portalRingMaterials) {
        const col = portalUnlocked ? '#4ade80' : '#f59e0b';
        for (const m of inter.portalRingMaterials) {
          if ('color' in m && m.color instanceof THREE.Color) m.color.set(col);
          if ('emissive' in m && m.emissive instanceof THREE.Color) m.emissive.set(col);
        }
      }
      if (inter.portalBeamMat) {
        inter.portalBeamMat.color.set(portalUnlocked ? '#38bdf8' : '#f59e0b');
        inter.portalBeamMat.opacity = portalUnlocked
          ? 0.28 + Math.sin(this.elapsedTime * 4) * 0.08
          : 0.11;
      }
      if (inter.portalBeacon && !inter.used) {
        inter.portalBeacon.rotation.y += dt * 2.1;
      }
      if (inter.used && inter.lidMesh) {
        const target = inter.lidOpenPositive ? 1.18 : -1.25;
        inter.lidMesh.rotation.x = THREE.MathUtils.lerp(inter.lidMesh.rotation.x, target, dt * 8);
      }
      // Sanctuary NPC breathing + friendly wave when player approaches
      if (inter.spec.kind === 'npc') {
        const ph = (inter.npcPhase ?? 0) + this.elapsedTime * 2.4;
        if (inter.npcBodyPivot) {
          inter.npcBodyPivot.position.y = Math.sin(ph) * 0.035;
        }
        const dist = Math.hypot(playerPos.x - inter.spec.x, playerPos.z - inter.spec.z);
        if (inter.npcRightArm) {
          const wave = dist < 4.5 ? -0.85 + Math.sin(this.elapsedTime * 7.5) * 0.32 : -0.08;
          inter.npcRightArm.rotation.x = THREE.MathUtils.lerp(
            inter.npcRightArm.rotation.x,
            wave,
            dt * 8
          );
        }
      }
    }

    for (const haz of this.hazards) {
      const cyclePos =
        ((this.elapsedTime + haz.spec.phaseOffset) % haz.spec.cycleSeconds) /
        haz.spec.cycleSeconds;
      const activeStart = 1 - haz.spec.activeRatio;
      const warnStart = Math.max(0, activeStart - 0.22);

      haz.active = cyclePos >= activeStart;
      haz.warning = !haz.active && cyclePos >= warnStart;

      if (haz.active) {
        haz.beamMesh.visible = true;
        haz.beamMesh.scale.y = 0.42;
        haz.beamMesh.scale.z = 0.42;
        haz.beamMat.color.set('#f43f5e');
        haz.beamMat.opacity = 0.92;
      } else if (haz.warning) {
        haz.beamMesh.visible = true;
        haz.beamMesh.scale.y = 0.14;
        haz.beamMesh.scale.z = 0.14;
        haz.beamMat.color.set('#fbbf24');
        haz.beamMat.opacity = 0.65;
      } else {
        haz.beamMesh.visible = false;
      }
    }

    for (const r of this.spireRings) {
      r.rotation.y += dt * 0.35;
    }
  }

  clearFloor(): void {
    this.floorGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj.userData.ownGeometry) {
          obj.geometry.dispose();
        }
        if (obj.userData.ownTexture instanceof THREE.Texture) {
          obj.userData.ownTexture.dispose();
        }
        if (obj.userData.ownMaterial) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      }
    });
    this.floorGroup.clear();
    this.pickups = [];
    this.interactables = [];
    this.hazards = [];
    this.spireRings = [];
    this.currentLayout = null;
  }

  dispose(): void {
    this.clearFloor();
    this.stoneTexture.dispose();
    this.unitBoxGeo.dispose();
    this.coinGeo.dispose();
    this.orbGeo.dispose();
    this.padGeo.dispose();
    this.torusGeo.dispose();
    this.skyMesh.geometry.dispose();
    (this.skyMesh.material as THREE.Material).dispose();
  }
}

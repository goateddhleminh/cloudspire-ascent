import * as THREE from 'three';
import { GraphicsQuality } from '../persistence/SaveData';

export class Renderer {
  public readonly webgl: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly sunLight: THREE.DirectionalLight;
  public readonly hemiLight: THREE.HemisphereLight;

  private quality: GraphicsQuality = 'high';

  constructor(canvas: HTMLCanvasElement) {
    this.webgl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.08;
    this.webgl.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#6ca6f5');
    this.scene.fog = new THREE.FogExp2('#a8cdf8', 0.0068);

    this.camera = new THREE.PerspectiveCamera(
      58,
      Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight),
      0.15,
      360
    );

    this.hemiLight = new THREE.HemisphereLight('#e0f2fe', '#64748b', 0.95);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fffbeb', 1.55);
    this.sunLight.position.set(26, 48, 28);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 150;
    const d = 38;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0006;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.applyQuality('high');
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  }

  applyQuality(quality: GraphicsQuality): void {
    this.quality = quality;
    const maxDpr = quality === 'low' ? 1.0 : quality === 'medium' ? 1.35 : 1.75;
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));

    if (quality === 'low') {
      this.webgl.shadowMap.enabled = false;
      this.sunLight.castShadow = false;
    } else {
      this.webgl.shadowMap.enabled = true;
      this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;
      this.sunLight.castShadow = true;
      const mapSize = quality === 'high' ? 2048 : 1024;
      if (this.sunLight.shadow.mapSize.width !== mapSize) {
        this.sunLight.shadow.mapSize.set(mapSize, mapSize);
        this.sunLight.shadow.map?.dispose();
        this.sunLight.shadow.map = null;
      }
    }
    this.handleResize();
  }

  updateShadowFocus(playerPos: THREE.Vector3): void {
    if (!this.sunLight.castShadow) return;
    this.sunLight.target.position.set(playerPos.x, playerPos.y, playerPos.z - 6);
    this.sunLight.position.set(playerPos.x + 24, playerPos.y + 44, playerPos.z + 22);
    this.sunLight.target.updateMatrixWorld();
  }

  handleResize = (): void => {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.webgl.setSize(w, h, false);
  };

  render(): void {
    this.webgl.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    this.sunLight.shadow.map?.dispose();
    this.webgl.dispose();
  }
}

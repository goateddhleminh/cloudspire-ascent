# Cloudspire Ascent — Art Direction & Technical Asset Brief

## 1. Technical Frame

| Property | Specification |
| :--- | :--- |
| **Engine & Runtime** | TypeScript + Vite + Three.js (`r0.169`), `ACESFilmicToneMapping`, `SRGBColorSpace` |
| **Camera & View** | Third-person damped orbit (`FOV 58°`, distance `7.8m`, height `3.35m`, pitch `-0.25..1.05 rad`) |
| **Reference Display** | `1920×1080` responsive expand (`1280×720` laptop, `2560×1080` ultrawide, `390×844` mobile) |
| **World Scale & Axes** | `1 unit = 1 meter`, `+Y` Up, `-Z` Forward in local entity space, origin `(0,0,0)` at ground contact |
| **3D Interchange** | Binary glTF 2.0 (`.glb`) authored in Blender 5.3 (`export_yup=True`), clean quad/bevel topology |
| **Triangle Budgets** | Hero/Boss: `1,200–3,500 tris` · Enemies/NPCs: `800–2,200 tris` · Weapons/Props: `180–1,200 tris` |
| **Raster VFX & UI** | Power-of-two RGBA PNGs (`128×128`, `256×256`), premultiplied-safe RGB edge bleed, true alpha |
| **Audio Spec** | `44.1 kHz`, `16-bit PCM .wav`, peak `≤ -1.5 dBTP`, routed via `Master ← Music/MusicDuck/SFX/Ambience/UI` |

---

## 2. Visual System: "Celestial Toybox Bastion"

- **Shape Language**: Chiseled, beveled stylized forms inspired by high-craft sky-citadel action RPGs. Every asset reads first through bold primary proportions (heroic broad shoulders, oversized weapon fuller, flared cloak hems, floating rune rings), second through crisp `3–5 cm` chamfers that catch directional sunlight, and third through glowing emissive Aether cores.
- **Silhouette Priorities**:
  - **Player Vanguard**: Compact athletic silhouette (`1.9m` tall) with spiky anime hair, flared collar, back star-crest, and oversized right-hand Skyblade so facing and swing arcs read effortlessly from behind.
  - **Sanctuary NPCs**: Immediately distinguishable from combat constructs through warm cloth silhouettes—wide merchant astro-hat (*Master Zephyr*), winged forge-circlet & anvil apron (*Warden Lyra*), and scholar hood & tome (*Archivist Orin*).
  - **Enemy Constructs**:
    - *Crimson Striker*: Forward-leaning predator stance with twin crimson wrist-scythes (melee rush threat).
    - *Prism Sentinel*: Levitating diamond obelisk framed by counter-rotating brass gyro-rings (ranged sniper threat).
    - *Aegis Juggernaut*: Wide, top-heavy fortress silhouette with oversized seismic gauntlets (ground-slam AoE threat).
    - *Spire Warden (Boss)*: Towering `3.4m` Celestial Archon with four floating seraph blade-wings and a 6-point solar halo.
- **Palette Roles**:
  - **Structural Grounds**: Celestial Slate (`#1e293b`, `#334155`), Sunlit Marble (`#dce4ef`), Obsidian Jacket (`#181c28`).
  - **Player & Friendly Aether**: Sky Cyan (`#38bdf8`), Sovereign Gold (`#fbbf24`), Mend Emerald (`#34d399`).
  - **Hostile Construct Signals**: Striker Crimson (`#f43f5e`), Sentinel Violet (`#a855f7`), Telegraph Amber (`#fb923c`).
- **Material & Lighting Rules**:
  - PBR `MeshStandardMaterial` across all `.glb` slots: matte cloth (`roughness 0.62, metalness 0.05`), brushed bastion stone (`roughness 0.72, metalness 0.08`), forged gold/brass (`roughness 0.26, metalness 0.72`), and emissive Aether crystals (`emissiveIntensity 1.2–2.0`).
  - Named material slots on `vanguard_hero.glb` (`Mat_Torso`, `Mat_Trim`, `Mat_Limb`, `Mat_Shoe`, `Mat_Hair`, `Mat_Skin`, `Mat_Eye`, `Mat_EyeShine`) allow instant cosmetic skin swapping without duplicating rigs.
- **Motion & Game Feel Character**:
  - Snappy anticipation into overshoot settle: melee swings trail a glowing crescent ribbon, mob hits trigger directional star-sparks + white emissive flash + squash recoil + pitched sample variation, and jumps/landings kick up stylized cloud-dust rings.

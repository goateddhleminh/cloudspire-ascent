import sys
import os
import math

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from blender_common import (
    reset_scene,
    make_pbr_mat,
    create_empty,
    add_beveled_box,
    add_cylinder_part,
    add_sphere_part,
    add_torus_part,
    add_octa_crystal,
    add_blade_mesh,
    add_lofted_horn,
    export_glb_and_render,
)

ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
MODELS_DIR = os.path.join(ROOT, "public", "assets", "models", "props")
RENDERS_DIR = os.path.join(SCRIPT_DIR, "renders")


def build_ascent_portal():
    reset_scene()
    mat_stone = make_pbr_mat("Mat_PortalStone", "#475569", roughness=0.62, metallic=0.12)
    mat_marble = make_pbr_mat("Mat_PortalMarble", "#cbd5e1", roughness=0.45, metallic=0.10)
    mat_gold = make_pbr_mat("Mat_PortalGold", "#fbbf24", roughness=0.25, metallic=0.82)
    mat_rune = make_pbr_mat("Mat_PortalRing", "#38bdf8", roughness=0.12, emission_hex="#38bdf8", emission_strength=2.0)

    root = create_empty("AscentPortalRoot")
    add_cylinder_part("PortalDais", 2.95, 2.75, 0.24, vertices=24, loc=(0, 0, 0.12), mat=mat_stone, parent=root)
    add_torus_part("FloorRuneCircle", 2.15, 0.05, loc=(0, 0, 0.25), mat=mat_rune, parent=root)

    for s in (-1, 1):
        add_beveled_box(f"PillarBase_{s}", size=(1.05, 1.05, 0.65), loc=(s * 2.2, 0, 0.45), bevel=0.05, mat=mat_stone, parent=root)
        add_beveled_box(f"PillarShaft_{s}", size=(0.76, 0.76, 3.8), loc=(s * 2.2, 0, 2.55), bevel=0.05, taper_top_x=0.88, taper_top_y=0.88, mat=mat_marble, parent=root)
        add_beveled_box(f"PillarRune_{s}", size=(0.16, 0.80, 2.9), loc=(s * 2.2, 0, 2.55), bevel=0.02, mat=mat_rune, parent=root)
        add_beveled_box(f"PillarCap_{s}", size=(1.02, 1.02, 0.40), loc=(s * 2.2, 0, 4.55), bevel=0.04, mat=mat_gold, parent=root)
        add_octa_crystal(f"BrazierFlame_{s}", radius=0.22, height=0.55, sides=5, loc=(s * 2.2, 0, 5.10), mat=mat_gold, parent=root)

    add_beveled_box("PortalLintel", size=(5.6, 0.96, 0.68), loc=(0, 0, 4.92), bevel=0.06, taper_top_x=1.08, mat=mat_stone, parent=root)
    add_beveled_box("LintelGoldTrim", size=(5.75, 1.02, 0.16), loc=(0, 0, 5.30), bevel=0.025, mat=mat_gold, parent=root)

    ring_piv = create_empty("PortalRing", (0, 0, 2.55), parent=root)
    add_torus_part("InnerGateRing", 1.88, 0.13, major_seg=32, minor_seg=12, loc=(0, 0, 0), rot=(math.radians(90), 0, 0), mat=mat_rune, parent=ring_piv)
    for i in range(8):
        a = (i / 8) * math.tau
        add_octa_crystal(
            f"RingTooth_{i}",
            radius=0.10,
            height=0.32,
            sides=4,
            loc=(math.cos(a) * 1.92, 0, math.sin(a) * 1.92),
            rot=(0, -a, 0),
            mat=mat_gold,
            parent=ring_piv,
        )

    beacon_piv = create_empty("PortalBeacon", (0, 0, 6.15), parent=root)
    add_octa_crystal("SummitStar", radius=0.38, height=0.95, sides=4, loc=(0, 0, 0), mat=mat_gold, parent=beacon_piv)

    export_glb_and_render(
        os.path.join(MODELS_DIR, "prop_ascent_portal.glb"),
        os.path.join(RENDERS_DIR, "prop_ascent_portal.png"),
        cam_pos=(5.2, 7.6, 4.2),
        look_at=(0, 0, 2.8),
    )


def build_sky_chest():
    reset_scene()
    mat_wood = make_pbr_mat("Mat_ChestBody", "#1e3a8a", roughness=0.45, metallic=0.25)
    mat_gold = make_pbr_mat("Mat_ChestGold", "#fbbf24", roughness=0.24, metallic=0.85, emission_hex="#d97706", emission_strength=0.25)
    mat_gem = make_pbr_mat("Mat_ChestGem", "#38bdf8", roughness=0.12, emission_hex="#38bdf8", emission_strength=1.8)

    root = create_empty("SkyChestRoot")
    base = create_empty("ChestBase", (0, 0, 0), parent=root)
    add_beveled_box("CofferBox", size=(1.32, 0.92, 0.72), loc=(0, 0, 0.36), bevel=0.04, taper_top_x=1.06, taper_top_y=1.04, mat=mat_wood, parent=base)
    for sx in (-0.48, 0.48):
        add_beveled_box(f"BaseBand_{sx}", size=(0.14, 0.98, 0.75), loc=(sx, 0, 0.37), bevel=0.02, mat=mat_gold, parent=base)
    add_beveled_box("BaseRim", size=(1.40, 0.98, 0.10), loc=(0, 0, 0.70), bevel=0.02, mat=mat_gold, parent=base)

    # Hinged at back: y_blender = -0.45 -> z_three = +0.45? Wait: front of chest faces +Y_blender (-Z_three),
    # so back hinge is at y_blender = -0.44, z_blender = 0.74!
    lid_piv = create_empty("ChestLid", (0, -0.44, 0.74), parent=root)
    add_cylinder_part("LidVault", 0.48, 0.48, 1.34, vertices=16, loc=(0, 0.44, 0.04), rot=(0, math.radians(90), 0), mat=mat_wood, parent=lid_piv)
    for sx in (-0.48, 0.0, 0.48):
        add_cylinder_part(f"LidStrap_{sx}", 0.51, 0.51, 0.13, vertices=16, loc=(sx, 0.44, 0.04), rot=(0, math.radians(90), 0), mat=mat_gold, parent=lid_piv)
    add_beveled_box("LockPlate", size=(0.24, 0.10, 0.26), loc=(0, 0.92, -0.02), bevel=0.02, mat=mat_gold, parent=lid_piv)
    add_octa_crystal("LockStar", radius=0.075, height=0.16, sides=4, loc=(0, 0.96, -0.02), rot=(math.radians(90), 0, 0), mat=mat_gem, parent=lid_piv)

    export_glb_and_render(
        os.path.join(MODELS_DIR, "prop_sky_chest.glb"),
        os.path.join(RENDERS_DIR, "prop_sky_chest.png"),
        cam_pos=(1.95, 2.45, 1.45),
        look_at=(0, 0, 0.55),
    )


def build_shrine_and_kiosks():
    # 1. Sanctuary Blessing Shrine
    reset_scene()
    mat_marble = make_pbr_mat("Mat_ShrineMarble", "#e2e8f0", roughness=0.40, metallic=0.08)
    mat_gold = make_pbr_mat("Mat_ShrineGold", "#fbbf24", roughness=0.25, metallic=0.82)
    mat_emerald = make_pbr_mat("Mat_ShrineGem", "#4ade80", roughness=0.12, emission_hex="#22c55e", emission_strength=2.0)

    root = create_empty("BlessingShrineRoot")
    add_cylinder_part("Step1", 1.35, 1.25, 0.20, vertices=8, loc=(0, 0, 0.10), mat=mat_marble, parent=root, smooth=False)
    add_cylinder_part("Step2", 0.95, 0.82, 0.26, vertices=8, loc=(0, 0, 0.32), mat=mat_marble, parent=root, smooth=False)
    add_cylinder_part("Column", 0.46, 0.58, 0.78, vertices=12, loc=(0, 0, 0.82), mat=mat_marble, parent=root)
    add_cylinder_part("BasinRim", 0.72, 0.86, 0.18, vertices=16, loc=(0, 0, 1.24), mat=mat_gold, parent=root)

    crystal_piv = create_empty("PortalBeacon", (0, 0, 2.05), parent=root)
    add_octa_crystal("BlessingCrystal", radius=0.38, height=1.08, sides=6, loc=(0, 0, 0), mat=mat_emerald, parent=crystal_piv)
    add_torus_part("ShrineHalo", 0.58, 0.032, loc=(0, 0, 0), rot=(math.radians(24), math.radians(18), 0), mat=mat_gold, parent=crystal_piv)

    export_glb_and_render(
        os.path.join(MODELS_DIR, "prop_blessing_shrine.glb"),
        os.path.join(RENDERS_DIR, "prop_blessing_shrine.png"),
        cam_pos=(2.6, 3.6, 2.1),
        look_at=(0, 0, 1.25),
    )

    # 2. Sky Bazaar Shop Kiosk
    reset_scene()
    mat_wood = make_pbr_mat("Mat_StallWood", "#78350f", roughness=0.68, metallic=0.06)
    mat_silk_b = make_pbr_mat("Mat_CanopyBlue", "#1d4ed8", roughness=0.55)
    mat_silk_w = make_pbr_mat("Mat_CanopyGold", "#fef3c7", roughness=0.55)
    mat_gold2 = make_pbr_mat("Mat_ShopGold", "#fbbf24", roughness=0.24, metallic=0.85, emission_hex="#f59e0b", emission_strength=0.6)
    mat_tonic = make_pbr_mat("Mat_BottleEmerald", "#34d399", roughness=0.14, emission_hex="#34d399", emission_strength=1.5)

    root = create_empty("ShopKioskRoot")
    add_beveled_box("CounterBase", size=(2.6, 1.05, 0.92), loc=(0, 0.25, 0.46), bevel=0.04, mat=mat_wood, parent=root)
    add_beveled_box("CounterTop", size=(2.76, 1.20, 0.12), loc=(0, 0.25, 0.95), bevel=0.025, mat=mat_gold2, parent=root)
    for sx in (-1.18, 1.18):
        for sy in (-0.38, 0.68):
            add_cylinder_part(f"Post_{sx}_{sy}", 0.075, 0.075, 2.55, vertices=10, loc=(sx, sy, 1.28), mat=mat_wood, parent=root)

    # Striped Awning Canopy
    for i in range(5):
        cx = -1.08 + i * 0.54
        add_beveled_box(
            f"CanopyStripe_{i}",
            size=(0.55, 1.65, 0.14),
            loc=(cx, 0.18, 2.58),
            rot=(math.radians(14), 0, 0),
            bevel=0.02,
            mat=mat_silk_b if i % 2 == 0 else mat_silk_w,
            parent=root,
        )

    # Tonic bottles on counter + floating Coin Sign Beacon
    for i, bx in enumerate([-0.75, -0.48, 0.65]):
        add_cylinder_part(f"Bottle_{i}", 0.09, 0.07, 0.24, vertices=10, loc=(bx, 0.35, 1.12), mat=mat_tonic, parent=root)

    sign_piv = create_empty("PortalBeacon", (0, 0.18, 3.25), parent=root)
    add_cylinder_part("ShopCoinSign", 0.42, 0.42, 0.12, vertices=16, loc=(0, 0, 0), rot=(math.radians(90), 0, 0), mat=mat_gold2, parent=sign_piv)

    export_glb_and_render(
        os.path.join(MODELS_DIR, "prop_shop_kiosk.glb"),
        os.path.join(RENDERS_DIR, "prop_shop_kiosk.png"),
        cam_pos=(3.3, 4.4, 2.55),
        look_at=(0, 0.15, 1.45),
    )

    # 3. Vanguard Armory Kiosk
    reset_scene()
    mat_slate = make_pbr_mat("Mat_ArmorySlate", "#1e293b", roughness=0.45, metallic=0.55)
    mat_steel = make_pbr_mat("Mat_ArmorySteel", "#cbd5e1", roughness=0.25, metallic=0.85)
    mat_cyan = make_pbr_mat("Mat_ArmoryCyan", "#38bdf8", roughness=0.12, emission_hex="#38bdf8", emission_strength=1.8)
    mat_gold3 = make_pbr_mat("Mat_ArmoryGold", "#fbbf24", roughness=0.25, metallic=0.82)

    root = create_empty("ArmoryKioskRoot")
    add_cylinder_part("ArmoryPlinth", 1.55, 1.42, 0.28, vertices=8, loc=(0, 0, 0.14), mat=mat_slate, parent=root, smooth=False)
    add_beveled_box("WeaponRackBack", size=(2.2, 0.26, 2.35), loc=(0, -0.45, 1.35), bevel=0.04, mat=mat_slate, parent=root)
    add_beveled_box("WeaponRackRim", size=(2.32, 0.32, 0.16), loc=(0, -0.45, 2.52), bevel=0.025, mat=mat_gold3, parent=root)

    # Twin crossed display Skyblades + Shield Crest
    for s in (-1, 1):
        add_blade_mesh(f"RackBlade_{s}", length=1.45, width=0.20, thickness=0.05, loc=(s * 0.45, -0.26, 0.85), rot=(0, s * math.radians(-26), 0), mat=mat_cyan, parent=root)
    add_octa_crystal("ShieldEmblem", radius=0.36, height=0.72, sides=6, loc=(0, -0.22, 1.55), rot=(math.radians(90), 0, 0), mat=mat_gold3, parent=root)

    # Front Holo-Anvil Pad + Floating Blade Beacon
    add_cylinder_part("HoloProjector", 0.56, 0.48, 0.52, vertices=12, loc=(0, 0.42, 0.50), mat=mat_steel, parent=root)
    beacon = create_empty("PortalBeacon", (0, 0.42, 1.48), parent=root)
    add_octa_crystal("HoloCrystal", radius=0.28, height=0.75, sides=4, loc=(0, 0, 0), mat=mat_cyan, parent=beacon)

    export_glb_and_render(
        os.path.join(MODELS_DIR, "prop_armory_kiosk.glb"),
        os.path.join(RENDERS_DIR, "prop_armory_kiosk.png"),
        cam_pos=(3.1, 4.2, 2.35),
        look_at=(0, 0, 1.30),
    )


def build_pickups_hazards_and_scenery():
    # 1. Sky Coin
    reset_scene()
    mat_gold = make_pbr_mat("Mat_CoinGold", "#fbbf24", roughness=0.20, metallic=0.88, emission_hex="#f59e0b", emission_strength=0.45)
    mat_star = make_pbr_mat("Mat_CoinStar", "#fef9c3", roughness=0.18, metallic=0.6, emission_hex="#fde047", emission_strength=0.8)
    root = create_empty("SkyCoinRoot")
    add_cylinder_part("CoinDisc", 0.42, 0.42, 0.12, vertices=12, loc=(0, 0, 0), rot=(math.radians(90), 0, 0), bevel=0.02, mat=mat_gold, parent=root, smooth=False)
    add_torus_part("CoinRim", 0.38, 0.042, major_seg=12, minor_seg=8, loc=(0, 0, 0), rot=(math.radians(90), 0, 0), mat=mat_gold, parent=root)
    for sy in (-0.065, 0.065):
        add_octa_crystal(f"Star_{sy}", radius=0.18, height=0.06, sides=4, loc=(0, sy, 0), rot=(math.radians(90), 0, 0), mat=mat_star, parent=root)
    export_glb_and_render(
        os.path.join(MODELS_DIR, "prop_sky_coin.glb"),
        os.path.join(RENDERS_DIR, "prop_sky_coin.png"),
        cam_pos=(0.95, 1.25, 0.55),
        look_at=(0, 0, 0),
    )

    # 2. Heal Orb
    reset_scene()
    mat_heal = make_pbr_mat("Mat_HealEmerald", "#4ade80", roughness=0.12, emission_hex="#22c55e", emission_strength=2.0)
    mat_band = make_pbr_mat("Mat_HealGold", "#fef08a", roughness=0.22, metallic=0.8)
    root = create_empty("HealOrbRoot")
    add_octa_crystal("HealGem", radius=0.32, height=0.72, sides=6, loc=(0, 0, 0), mat=mat_heal, parent=root)
    add_torus_part("HealOrbit", 0.44, 0.026, loc=(0, 0, 0), rot=(math.radians(55), math.radians(25), 0), mat=mat_band, parent=root)
    export_glb_and_render(
        os.path.join(MODELS_DIR, "prop_heal_orb.glb"),
        os.path.join(RENDERS_DIR, "prop_heal_orb.png"),
        cam_pos=(1.0, 1.35, 0.55),
        look_at=(0, 0, 0),
    )

    # 3. Jump Pad (Unit radius=1.0 so World.ts scales by pad.radius!)
    reset_scene()
    mat_base = make_pbr_mat("Mat_PadBase", "#1e293b", roughness=0.38, metallic=0.65)
    mat_glow = make_pbr_mat("Mat_PadGlow", "#4ade80", roughness=0.12, emission_hex="#4ade80", emission_strength=1.8)
    root = create_empty("JumpPadRoot")
    add_cylinder_part("PadChassis", 1.05, 0.94, 0.22, vertices=16, loc=(0, 0, 0.11), mat=mat_base, parent=root)
    add_cylinder_part("PadEmitter", 0.76, 0.72, 0.08, vertices=16, loc=(0, 0, 0.23), mat=mat_glow, parent=root)
    add_torus_part("PadRing", 0.86, 0.045, loc=(0, 0, 0.22), mat=mat_glow, parent=root)
    export_glb_and_render(
        os.path.join(MODELS_DIR, "prop_jump_pad.glb"),
        os.path.join(RENDERS_DIR, "prop_jump_pad.png"),
        cam_pos=(1.9, 2.35, 1.45),
        look_at=(0, 0, 0.15),
    )

    # 4. Laser Pylon Emitter
    reset_scene()
    mat_pylon = make_pbr_mat("Mat_PylonSteel", "#1e293b", roughness=0.35, metallic=0.72)
    mat_lens = make_pbr_mat("Mat_PylonRuby", "#f43f5e", roughness=0.12, emission_hex="#f43f5e", emission_strength=2.0)
    root = create_empty("LaserPylonRoot")
    add_beveled_box("PylonBase", size=(0.62, 0.62, 0.32), loc=(0, 0, 0.16), bevel=0.03, mat=mat_pylon, parent=root)
    add_beveled_box("PylonTower", size=(0.44, 0.44, 1.22), loc=(0, 0, 0.88), bevel=0.035, taper_top_x=0.82, taper_top_y=0.82, mat=mat_pylon, parent=root)
    add_sphere_part("EmitterLens", 0.18, loc=(0, 0, 0.68), mat=mat_lens, parent=root)
    add_octa_crystal("TopCap", radius=0.14, height=0.28, sides=4, loc=(0, 0, 1.58), mat=mat_lens, parent=root)
    export_glb_and_render(
        os.path.join(MODELS_DIR, "prop_laser_pylon.glb"),
        os.path.join(RENDERS_DIR, "prop_laser_pylon.png"),
        cam_pos=(1.8, 2.3, 1.35),
        look_at=(0, 0, 0.80),
    )

    # 5. Stylized Sky Tree (Mat_Foliage named so World.ts can tint per FloorTheme!)
    reset_scene()
    mat_bark = make_pbr_mat("Mat_Bark", "#7c4a2d", roughness=0.82, metallic=0.02)
    mat_leaf = make_pbr_mat("Mat_Foliage", "#4ade80", roughness=0.58, metallic=0.02)
    mat_mote = make_pbr_mat("Mat_TreeFruit", "#fef08a", roughness=0.15, emission_hex="#fbbf24", emission_strength=1.5)
    root = create_empty("SkyTreeRoot")
    add_lofted_horn(
        "TreeTrunk",
        [(0, 0, 0, 0.46), (0.06, -0.04, 1.1, 0.34), (-0.05, 0.05, 2.2, 0.26), (0, 0, 3.1, 0.14)],
        sides=8,
        mat=mat_bark,
        parent=root,
    )
    crowns = [
        (0.0, 0.0, 3.15, 1.48, 0.92),
        (-0.88, 0.48, 2.68, 0.96, 0.72),
        (0.92, -0.42, 2.82, 0.92, 0.72),
        (0.0, 0.05, 4.05, 0.98, 0.78),
    ]
    for idx, (cx, cy, cz, rad, hgt) in enumerate(crowns):
        add_sphere_part(f"Canopy_{idx}", rad, scale=(1.0, 1.0, hgt / rad), segments=12, rings=8, loc=(cx, cy, cz), mat=mat_leaf, parent=root, smooth=False)
    for idx, (fx, fy, fz) in enumerate([(-0.85, 0.75, 2.35), (0.85, 0.65, 2.55), (0.15, 1.15, 3.15)]):
        add_octa_crystal(f"SkyBerry_{idx}", radius=0.10, height=0.22, sides=4, loc=(fx, fy, fz), mat=mat_mote, parent=root)

    export_glb_and_render(
        os.path.join(MODELS_DIR, "prop_sky_tree.glb"),
        os.path.join(RENDERS_DIR, "prop_sky_tree.png"),
        cam_pos=(4.2, 5.6, 3.2),
        look_at=(0, 0, 2.35),
    )

    # 6. Horizon Celestial Citadel Spire
    reset_scene()
    mat_citadel = make_pbr_mat("Mat_CitadelStone", "#64748b", roughness=0.65, metallic=0.15, emission_hex="#3b82f6", emission_strength=0.18)
    mat_ring_g = make_pbr_mat("Mat_SpireGold", "#fbbf24", roughness=0.22, emission_hex="#fbbf24", emission_strength=1.4)
    mat_ring_m = make_pbr_mat("Mat_SpireViolet", "#e879f9", roughness=0.22, emission_hex="#e879f9", emission_strength=1.4)

    root = create_empty("SummitSpireRoot")
    add_octa_crystal("FloatingIslandRoot", radius=13.5, height=18.0, sides=8, waist_ratio=0.82, loc=(0, 0, -4.0), mat=mat_citadel, parent=root)
    add_cylinder_part("Tier1Keep", 10.5, 9.2, 16.0, vertices=8, loc=(0, 0, 8.0), mat=mat_citadel, parent=root, smooth=False)
    add_cylinder_part("Tier2Keep", 6.8, 5.6, 18.0, vertices=8, loc=(0, 0, 22.0), mat=mat_citadel, parent=root, smooth=False)
    add_octa_crystal("CrownSpire", radius=4.2, height=20.0, sides=6, waist_ratio=0.18, loc=(0, 0, 38.0), mat=mat_citadel, parent=root)
    for s in (-1, 1):
        add_cylinder_part(f"FlankTower_{s}", 3.2, 2.8, 19.0, vertices=6, loc=(s * 10.8, 3.5, 12.0), mat=mat_citadel, parent=root, smooth=False)
        add_octa_crystal(f"FlankRoof_{s}", radius=3.4, height=7.5, sides=6, waist_ratio=0.15, loc=(s * 10.8, 3.5, 24.5), mat=mat_ring_g, parent=root)

    r1 = create_empty("SpireRing1", (0, 0, 22.0), parent=root)
    add_torus_part("OrbitalRing1", 13.5, 0.38, loc=(0, 0, 0), rot=(math.radians(14), 0, 0), mat=mat_ring_g, parent=r1)
    r2 = create_empty("SpireRing2", (0, 0, 33.0), parent=root)
    add_torus_part("OrbitalRing2", 9.8, 0.30, loc=(0, 0, 0), rot=(math.radians(-16), 0, 0), mat=mat_ring_m, parent=r2)

    export_glb_and_render(
        os.path.join(MODELS_DIR, "prop_summit_spire.glb"),
        os.path.join(RENDERS_DIR, "prop_summit_spire.png"),
        cam_pos=(38.0, 56.0, 28.0),
        look_at=(0, 0, 18.0),
    )


if __name__ == "__main__":
    build_ascent_portal()
    build_sky_chest()
    build_shrine_and_kiosks()
    build_pickups_hazards_and_scenery()
    print("SUCCESS: Built all 11 world props, kiosks, pickups & portals.")

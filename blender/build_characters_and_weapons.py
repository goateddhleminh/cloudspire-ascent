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
MODELS_DIR = os.path.join(ROOT, "public", "assets", "models")
RENDERS_DIR = os.path.join(SCRIPT_DIR, "renders")


def build_vanguard_hero():
    """
    Convention:
    Blender +X = Right, +Y = Front (maps to Three.js -Z!), +Z = Up (maps to Three.js +Y!).
    Named pivots & material slots match PlayerAvatar.ts!
    """
    reset_scene()

    mat_torso = make_pbr_mat("Mat_Torso", "#181c28", roughness=0.50, metallic=0.12)
    mat_trim = make_pbr_mat("Mat_Trim", "#38bdf8", roughness=0.28, metallic=0.25, emission_hex="#38bdf8", emission_strength=0.9)
    mat_limb = make_pbr_mat("Mat_Limb", "#141720", roughness=0.56, metallic=0.10)
    mat_shoe = make_pbr_mat("Mat_Shoe", "#f1f5f9", roughness=0.38, metallic=0.12)
    mat_hair = make_pbr_mat("Mat_Hair", "#11131a", roughness=0.62, metallic=0.05)
    mat_skin = make_pbr_mat("Mat_Skin", "#f6d2b8", roughness=0.60, metallic=0.02)
    mat_gold = make_pbr_mat("Mat_Buckle", "#fbbf24", roughness=0.26, metallic=0.78)
    mat_eye = make_pbr_mat("Mat_Eye", "#0f172a", roughness=0.20, metallic=0.0)
    mat_shine = make_pbr_mat("Mat_EyeShine", "#ffffff", roughness=0.1, emission_hex="#ffffff", emission_strength=1.2)

    root = create_empty("VanguardRoot", (0, 0, 0))
    body_pivot = create_empty("BodyPivot", (0, 0, 0), parent=root)

    # Sculpted Heroic Torso + Jacket Coattails + Pauldrons
    add_beveled_box(
        "TorsoCore",
        size=(0.82, 0.44, 0.88),
        loc=(0, 0, 1.13),
        bevel=0.055,
        taper_top_x=1.10,
        taper_top_y=1.06,
        mat=mat_torso,
        parent=body_pivot,
    )
    # Waist belt & golden buckle
    add_beveled_box("WaistBelt", size=(0.86, 0.47, 0.11), loc=(0, 0, 0.75), bevel=0.02, mat=mat_limb, parent=body_pivot)
    add_beveled_box("BeltBuckle", size=(0.18, 0.06, 0.13), loc=(0, 0.24, 0.75), bevel=0.015, mat=mat_gold, parent=body_pivot)

    # Flared Sky-Runner Jacket Tails on back/sides
    for side in (-1, 1):
        add_beveled_box(
            f"CoatTail_{side}",
            size=(0.36, 0.10, 0.34),
            loc=(side * 0.21, -0.22, 0.62),
            rot=(math.radians(-14), 0, side * math.radians(5)),
            bevel=0.02,
            taper_top_x=0.88,
            mat=mat_torso,
            parent=body_pivot,
        )
        # Heroic Shoulder Pauldrons with neon trim
        add_beveled_box(
            f"Pauldron_{side}",
            size=(0.30, 0.44, 0.18),
            loc=(side * 0.50, 0, 1.49),
            rot=(0, side * math.radians(14), 0),
            bevel=0.035,
            mat=mat_torso,
            parent=body_pivot,
        )
        add_beveled_box(
            f"PauldronTrim_{side}",
            size=(0.32, 0.46, 0.05),
            loc=(side * 0.51, 0, 1.42),
            rot=(0, side * math.radians(14), 0),
            bevel=0.012,
            mat=mat_trim,
            parent=body_pivot,
        )

    # High Flared Vanguard Collar + Front Neon Placket + Back Starlight Crest
    add_beveled_box("Collar", size=(0.86, 0.50, 0.16), loc=(0, -0.01, 1.56), bevel=0.03, taper_top_x=1.08, mat=mat_trim, parent=body_pivot)
    add_beveled_box("FrontZip", size=(0.09, 0.05, 0.78), loc=(0, 0.23, 1.15), bevel=0.012, mat=mat_trim, parent=body_pivot)
    add_octa_crystal("BackCrest", radius=0.19, height=0.40, sides=4, loc=(0, -0.24, 1.18), rot=(math.radians(90), math.radians(45), 0), mat=mat_trim, parent=body_pivot)
    create_empty("BackSocket", (0, -0.25, 1.24), parent=body_pivot)

    # HeadPivot + Stylized Beveled Head + Expressive Anime Eyes + Layered Spiky Hair
    head_pivot = create_empty("HeadPivot", (0, 0, 1.60), parent=body_pivot)
    add_beveled_box("Head", size=(0.58, 0.56, 0.58), loc=(0, 0, 0.30), bevel=0.09, segments=3, mat=mat_skin, parent=head_pivot)

    for side in (-1, 1):
        add_beveled_box(f"Ear_{side}", size=(0.08, 0.12, 0.15), loc=(side * 0.30, -0.02, 0.28), bevel=0.025, mat=mat_skin, parent=head_pivot)
        add_beveled_box(f"Eye_{side}", size=(0.09, 0.03, 0.13), loc=(side * 0.135, 0.278, 0.275), bevel=0.01, mat=mat_eye, parent=head_pivot)
        add_beveled_box(f"EyeShine_{side}", size=(0.036, 0.032, 0.042), loc=(side * 0.135 - 0.018, 0.286, 0.308), bevel=0.005, mat=mat_shine, parent=head_pivot)
        add_beveled_box(
            f"Brow_{side}",
            size=(0.13, 0.035, 0.036),
            loc=(side * 0.135, 0.282, 0.372),
            rot=(0, side * math.radians(-10), 0),
            bevel=0.008,
            mat=mat_hair,
            parent=head_pivot,
        )

    # Confident smirk
    add_beveled_box("Smile", size=(0.11, 0.028, 0.026), loc=(0.02, 0.278, 0.165), rot=(0, math.radians(6), 0), bevel=0.005, mat=mat_eye, parent=head_pivot)

    # Sculpted Spiky Hair Cap + Swept Anime Spikes
    add_beveled_box("HairCap", size=(0.64, 0.64, 0.26), loc=(0, -0.02, 0.52), bevel=0.07, mat=mat_hair, parent=head_pivot)
    add_beveled_box("HairBack", size=(0.60, 0.20, 0.36), loc=(0, -0.25, 0.36), bevel=0.05, taper_top_x=1.05, mat=mat_hair, parent=head_pivot)

    spike_specs = [
        # Crown spikes
        [(0.0, 0.06, 0.56, 0.14), (0.0, 0.16, 0.78, 0.07), (0.02, 0.22, 0.90, 0.0)],
        [(-0.18, 0.0, 0.54, 0.13), (-0.30, 0.05, 0.74, 0.06), (-0.36, 0.08, 0.84, 0.0)],
        [(0.18, 0.0, 0.54, 0.13), (0.30, 0.05, 0.75, 0.06), (0.37, 0.08, 0.85, 0.0)],
        # Front bangs
        [(-0.16, 0.22, 0.52, 0.10), (-0.21, 0.32, 0.42, 0.05), (-0.23, 0.35, 0.34, 0.0)],
        [(0.14, 0.22, 0.52, 0.10), (0.19, 0.32, 0.42, 0.05), (0.21, 0.35, 0.35, 0.0)],
        [(0.0, 0.24, 0.54, 0.11), (0.03, 0.34, 0.45, 0.05), (0.05, 0.37, 0.38, 0.0)],
        # Back swept spikes
        [(-0.16, -0.20, 0.48, 0.12), (-0.26, -0.36, 0.56, 0.06), (-0.32, -0.44, 0.60, 0.0)],
        [(0.16, -0.20, 0.48, 0.12), (0.26, -0.36, 0.56, 0.06), (0.32, -0.44, 0.60, 0.0)],
    ]
    for idx, pts in enumerate(spike_specs):
        add_lofted_horn(f"HairSpike_{idx}", pts, sides=6, mat=mat_hair, parent=head_pivot, smooth=True)

    create_empty("HeadgearSocket", (0, 0, 0.68), parent=head_pivot)

    # Left & Right Arms + Armored Gauntlet Cuffs + Hands
    for side, prefix in [(-1, "Left"), (1, "Right")]:
        arm_piv = create_empty(f"{prefix}ArmPivot", (side * 0.58, 0, 1.48), parent=body_pivot)
        add_beveled_box(f"{prefix}UpperArm", size=(0.30, 0.32, 0.42), loc=(0, 0, -0.20), bevel=0.04, mat=mat_limb, parent=arm_piv)
        add_beveled_box(f"{prefix}Gauntlet", size=(0.33, 0.35, 0.30), loc=(0, 0, -0.50), bevel=0.035, mat=mat_torso, parent=arm_piv)
        add_beveled_box(f"{prefix}CuffTrim", size=(0.35, 0.37, 0.06), loc=(0, 0, -0.38), bevel=0.015, mat=mat_trim, parent=arm_piv)
        add_beveled_box(f"{prefix}Hand", size=(0.27, 0.29, 0.20), loc=(0, 0.01, -0.71), bevel=0.045, mat=mat_skin, parent=arm_piv)
        if side == 1:
            # Weapon socket in right hand pointing forward-up
            create_empty("WeaponSocket", (0, 0.18, -0.72), rot=(math.radians(-58), 0, 0), parent=arm_piv)

    # Left & Right Legs + Knee Greaves + High-Top Sky Sneakers
    for side, prefix in [(-1, "Left"), (1, "Right")]:
        leg_piv = create_empty(f"{prefix}LegPivot", (side * 0.22, 0, 0.68), parent=body_pivot)
        add_beveled_box(f"{prefix}Leg", size=(0.35, 0.37, 0.48), loc=(0, 0, -0.25), bevel=0.04, mat=mat_limb, parent=leg_piv)
        add_beveled_box(f"{prefix}KneePad", size=(0.24, 0.08, 0.15), loc=(0, 0.18, -0.26), bevel=0.02, mat=mat_trim, parent=leg_piv)
        add_beveled_box(f"{prefix}ShoeUpper", size=(0.38, 0.48, 0.18), loc=(0, 0.05, -0.55), bevel=0.035, mat=mat_shoe, parent=leg_piv)
        add_beveled_box(f"{prefix}ShoeSole", size=(0.40, 0.52, 0.07), loc=(0, 0.05, -0.645), bevel=0.02, mat=mat_trim, parent=leg_piv)

    export_glb_and_render(
        os.path.join(MODELS_DIR, "characters", "vanguard_hero.glb"),
        os.path.join(RENDERS_DIR, "vanguard_hero.png"),
        cam_pos=(1.95, 2.95, 1.55),
        look_at=(0.0, 0.0, 1.12),
    )


def build_headgear_variants():
    # 1. Sovereign Crown
    reset_scene()
    mat_gold = make_pbr_mat("Mat_CrownGold", "#fbbf24", roughness=0.22, metallic=0.85, emission_hex="#f59e0b", emission_strength=0.35)
    mat_gem_b = make_pbr_mat("Mat_CrownSapphire", "#38bdf8", roughness=0.12, emission_hex="#38bdf8", emission_strength=1.5)
    mat_gem_r = make_pbr_mat("Mat_CrownRuby", "#f43f5e", roughness=0.12, emission_hex="#f43f5e", emission_strength=1.4)

    root = create_empty("CrownRoot")
    add_cylinder_part("CrownBand", 0.29, 0.31, 0.13, vertices=8, loc=(0, 0, 0.06), bevel=0.015, mat=mat_gold, parent=root, smooth=False)
    for i in range(6):
        ang = (i / 6) * math.tau + math.pi / 2
        h = 0.24 if i == 0 else 0.17
        px = math.cos(ang) * 0.28
        py = math.sin(ang) * 0.28
        add_octa_crystal(f"Spire_{i}", radius=0.065, height=h, sides=4, loc=(px, py, 0.16), mat=mat_gold, parent=root)
    add_octa_crystal("CenterGem", radius=0.055, height=0.12, sides=4, loc=(0, 0.31, 0.08), rot=(math.radians(90), 0, 0), mat=mat_gem_b, parent=root)
    for s in (-1, 1):
        add_octa_crystal(f"SideGem_{s}", radius=0.04, height=0.09, sides=4, loc=(s * 0.24, 0.16, 0.08), mat=mat_gem_r, parent=root)

    export_glb_and_render(
        os.path.join(MODELS_DIR, "characters", "headgear_crown.glb"),
        os.path.join(RENDERS_DIR, "headgear_crown.png"),
        cam_pos=(0.85, 1.15, 0.55),
        look_at=(0, 0, 0.12),
    )

    # 2. Hyperion Cyber Visor
    reset_scene()
    mat_frame = make_pbr_mat("Mat_VisorFrame", "#0f172a", roughness=0.32, metallic=0.65)
    mat_lens = make_pbr_mat("Mat_VisorNeon", "#22d3ee", roughness=0.12, emission_hex="#22d3ee", emission_strength=1.9)
    root = create_empty("VisorRoot")
    # Positioned relative to HeadgearSocket (z=0.68 on HeadPivot -> eyes are around z=-0.38 below socket!)
    add_beveled_box("VisorShield", size=(0.66, 0.18, 0.15), loc=(0, 0.24, -0.38), bevel=0.035, mat=mat_lens, parent=root)
    add_beveled_box("VisorBrow", size=(0.68, 0.22, 0.05), loc=(0, 0.23, -0.30), bevel=0.015, mat=mat_frame, parent=root)
    for s in (-1, 1):
        add_beveled_box(f"EarPod_{s}", size=(0.09, 0.24, 0.22), loc=(s * 0.34, 0.04, -0.36), bevel=0.025, mat=mat_frame, parent=root)
        add_lofted_horn(
            f"Fin_{s}",
            [(s * 0.35, 0.0, -0.30, 0.04), (s * 0.40, -0.14, -0.10, 0.025), (s * 0.43, -0.24, 0.08, 0.0)],
            sides=4,
            mat=mat_lens,
            parent=root,
            smooth=False,
        )
    export_glb_and_render(
        os.path.join(MODELS_DIR, "characters", "headgear_visor.glb"),
        os.path.join(RENDERS_DIR, "headgear_visor.png"),
        cam_pos=(0.95, 1.25, -0.10),
        look_at=(0, 0.08, -0.32),
    )

    # 3. Canopy Jade Crystal Halo
    reset_scene()
    mat_jade = make_pbr_mat("Mat_JadeHalo", "#4ade80", roughness=0.16, emission_hex="#4ade80", emission_strength=1.6)
    mat_gold2 = make_pbr_mat("Mat_HaloGold", "#fef08a", roughness=0.25, metallic=0.75, emission_hex="#fbbf24", emission_strength=0.5)
    root = create_empty("HaloRoot")
    add_torus_part("HaloRing", 0.36, 0.038, major_seg=28, minor_seg=8, loc=(0, 0, 0.22), mat=mat_jade, parent=root)
    for i in range(4):
        a = (i / 4) * math.tau + math.pi / 4
        add_octa_crystal(
            f"HaloLeaf_{i}",
            radius=0.055,
            height=0.16,
            sides=4,
            loc=(math.cos(a) * 0.36, math.sin(a) * 0.36, 0.22),
            mat=mat_gold2,
            parent=root,
        )
    export_glb_and_render(
        os.path.join(MODELS_DIR, "characters", "headgear_halo.glb"),
        os.path.join(RENDERS_DIR, "headgear_halo.png"),
        cam_pos=(0.95, 1.25, 0.62),
        look_at=(0, 0, 0.22),
    )

    # 4. Astral Void Horns
    reset_scene()
    mat_void = make_pbr_mat("Mat_VoidHorn", "#3b0764", roughness=0.30, metallic=0.45, emission_hex="#a855f7", emission_strength=0.55)
    mat_star = make_pbr_mat("Mat_VoidStar", "#e879f9", roughness=0.15, emission_hex="#e879f9", emission_strength=2.0)
    root = create_empty("VoidHornsRoot")
    for s in (-1, 1):
        pts = [
            (s * 0.20, 0.04, -0.06, 0.085),
            (s * 0.34, 0.08, 0.08, 0.068),
            (s * 0.42, 0.02, 0.26, 0.045),
            (s * 0.32, -0.06, 0.44, 0.022),
            (s * 0.22, -0.10, 0.54, 0.0),
        ]
        add_lofted_horn(f"VoidHorn_{s}", pts, sides=7, mat=mat_void, parent=root)
    add_octa_crystal("VoidCoreStar", radius=0.075, height=0.22, sides=4, loc=(0, 0.12, 0.24), mat=mat_star, parent=root)
    export_glb_and_render(
        os.path.join(MODELS_DIR, "characters", "headgear_void_horns.glb"),
        os.path.join(RENDERS_DIR, "headgear_void_horns.png"),
        cam_pos=(1.05, 1.35, 0.52),
        look_at=(0, 0, 0.20),
    )

    # 5. Sky Wings (Back-mounted articulated Aether Wings!)
    reset_scene()
    mat_wing_gold = make_pbr_mat("Mat_WingGold", "#fbbf24", roughness=0.28, metallic=0.78, emission_hex="#f59e0b", emission_strength=0.4)
    mat_wing_aether = make_pbr_mat("Mat_WingFeather", "#60a5fa", roughness=0.18, emission_hex="#38bdf8", emission_strength=1.5)
    root = create_empty("WingsRoot")
    add_octa_crystal("BackMountGem", radius=0.09, height=0.24, sides=4, loc=(0, 0, 0), mat=mat_wing_gold, parent=root)

    for s, pfx in [(-1, "Left"), (1, "Right")]:
        wpiv = create_empty(f"{pfx}WingPivot", (s * 0.10, -0.02, 0.04), parent=root)
        add_lofted_horn(
            f"{pfx}WingArch",
            [
                (0, 0, 0, 0.05),
                (s * 0.32, -0.04, 0.22, 0.045),
                (s * 0.68, -0.08, 0.34, 0.032),
                (s * 0.92, -0.12, 0.26, 0.0),
            ],
            sides=6,
            mat=mat_wing_gold,
            parent=wpiv,
        )
        feathers = [
            (0.26, 0.12, 0.44, -22),
            (0.46, 0.18, 0.52, -32),
            (0.66, 0.20, 0.56, -42),
            (0.82, 0.14, 0.46, -52),
        ]
        for fi, (fx, fz, flen, fang) in enumerate(feathers):
            add_blade_mesh(
                f"{pfx}Feather_{fi}",
                length=flen,
                width=0.13,
                thickness=0.03,
                loc=(s * fx, -0.07, fz),
                rot=(0, math.radians(180 + s * fang), 0),
                mat=mat_wing_aether,
                parent=wpiv,
            )

    export_glb_and_render(
        os.path.join(MODELS_DIR, "characters", "wings_aether.glb"),
        os.path.join(RENDERS_DIR, "wings_aether.png"),
        cam_pos=(1.6, 2.2, 0.65),
        look_at=(0, 0, 0.12),
    )


def build_weapons_and_projectiles():
    # 1. Signature Skyblade Greatsword
    reset_scene()
    mat_steel = make_pbr_mat("Mat_BladeCore", "#e0f2fe", roughness=0.18, metallic=0.55)
    mat_edge = make_pbr_mat("Mat_BladeGlow", "#38bdf8", roughness=0.12, emission_hex="#38bdf8", emission_strength=1.8)
    mat_gold = make_pbr_mat("Mat_HiltGold", "#fbbf24", roughness=0.25, metallic=0.85)
    mat_grip = make_pbr_mat("Mat_GripWrap", "#1e1b4b", roughness=0.72, metallic=0.05)

    root = create_empty("SkybladeRoot")
    # Grip sits around z=-0.16..+0.08 so hand holds origin (0,0,0), blade extends +Z (which becomes +Y in weapon local space matching original PlayerAvatar!)
    add_cylinder_part("Grip", 0.042, 0.046, 0.28, vertices=12, loc=(0, 0, -0.02), mat=mat_grip, parent=root)
    add_octa_crystal("Pommel", radius=0.075, height=0.15, sides=6, loc=(0, 0, -0.20), mat=mat_gold, parent=root)
    add_octa_crystal("PommelGem", radius=0.045, height=0.09, sides=4, loc=(0, 0, -0.25), mat=mat_edge, parent=root)

    # Swept Winged Crossguard + Center Rune Gem
    add_beveled_box("GuardCenter", size=(0.14, 0.22, 0.11), loc=(0, 0, 0.14), bevel=0.02, mat=mat_gold, parent=root)
    for s in (-1, 1):
        add_lofted_horn(
            f"GuardWing_{s}",
            [(0, s * 0.08, 0.14, 0.055), (0, s * 0.24, 0.18, 0.042), (0, s * 0.34, 0.26, 0.0)],
            sides=6,
            mat=mat_gold,
            parent=root,
        )
    add_octa_crystal("GuardCore", radius=0.058, height=0.12, sides=4, loc=(0.065, 0, 0.14), rot=(0, math.radians(90), 0), mat=mat_edge, parent=root)
    add_octa_crystal("GuardCoreBack", radius=0.058, height=0.12, sides=4, loc=(-0.065, 0, 0.14), rot=(0, math.radians(90), 0), mat=mat_edge, parent=root)

    # Outer glowing energy edge + inner steel fuller spine
    add_blade_mesh("BladePlasmaEdge", length=1.42, width=0.25, thickness=0.055, tip_ratio=0.24, loc=(0, 0, 0.18), mat=mat_edge, parent=root)
    add_blade_mesh("BladeFuller", length=1.18, width=0.13, thickness=0.082, tip_ratio=0.20, loc=(0, 0, 0.18), mat=mat_steel, parent=root)

    create_empty("BladeBase", (0, 0, 0.20), parent=root)
    create_empty("BladeTip", (0, 0, 1.60), parent=root)

    export_glb_and_render(
        os.path.join(MODELS_DIR, "weapons", "weapon_skyblade.glb"),
        os.path.join(RENDERS_DIR, "weapon_skyblade.png"),
        cam_pos=(1.55, 1.65, 0.95),
        look_at=(0, 0, 0.68),
    )

    # 2. Starlight Lance Projectile (oriented along +Y forward -> -Z in Three.js!)
    reset_scene()
    mat_lance = make_pbr_mat("Mat_Starlight", "#7dd3fc", roughness=0.10, emission_hex="#38bdf8", emission_strength=2.2)
    mat_lance_core = make_pbr_mat("Mat_StarCore", "#ffffff", roughness=0.05, emission_hex="#e0f2fe", emission_strength=2.6)
    root = create_empty("StarlightLanceRoot")
    add_blade_mesh("LanceShaft", length=1.15, width=0.16, thickness=0.16, tip_ratio=0.35, loc=(0, -0.45, 0), rot=(math.radians(-90), 0, 0), mat=mat_lance, parent=root)
    add_octa_crystal("LanceStar", radius=0.18, height=0.42, sides=4, loc=(0, 0.10, 0), rot=(math.radians(-90), math.radians(45), 0), mat=mat_lance_core, parent=root)
    add_torus_part("LanceHalo", 0.20, 0.022, loc=(0, -0.08, 0), rot=(math.radians(90), 0, 0), mat=mat_lance, parent=root)
    export_glb_and_render(
        os.path.join(MODELS_DIR, "weapons", "proj_starlight_lance.glb"),
        os.path.join(RENDERS_DIR, "proj_starlight_lance.png"),
        cam_pos=(1.1, 1.1, 0.55),
        look_at=(0, 0.1, 0),
    )

    # 3. Enemy Void Plasma Orb
    reset_scene()
    mat_orb = make_pbr_mat("Mat_VoidOrb", "#e879f9", roughness=0.12, emission_hex="#d946ef", emission_strength=2.2)
    mat_ring = make_pbr_mat("Mat_VoidRing", "#fbbf24", roughness=0.22, metallic=0.7, emission_hex="#f59e0b", emission_strength=1.1)
    root = create_empty("VoidOrbRoot")
    add_octa_crystal("OrbCore", radius=0.24, height=0.48, sides=6, loc=(0, 0, 0), mat=mat_orb, parent=root)
    add_torus_part("OrbRingA", 0.31, 0.026, loc=(0, 0, 0), rot=(math.radians(35), math.radians(25), 0), mat=mat_ring, parent=root)
    export_glb_and_render(
        os.path.join(MODELS_DIR, "weapons", "proj_void_orb.glb"),
        os.path.join(RENDERS_DIR, "proj_void_orb.png"),
        cam_pos=(0.95, 1.05, 0.45),
        look_at=(0, 0, 0),
    )


if __name__ == "__main__":
    build_vanguard_hero()
    build_headgear_variants()
    build_weapons_and_projectiles()
    print("SUCCESS: Built character, headgear, wings, weapons & projectiles.")

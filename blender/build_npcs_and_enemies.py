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


def _build_npc_base(
    root_name: str,
    robe_hex: str,
    trim_hex: str,
    skin_hex: str,
    hair_hex: str,
    boot_hex: str = "#1e293b",
):
    mat_robe = make_pbr_mat("Mat_NpcRobe", robe_hex, roughness=0.58, metallic=0.08)
    mat_trim = make_pbr_mat("Mat_NpcTrim", trim_hex, roughness=0.28, metallic=0.65, emission_hex=trim_hex, emission_strength=0.45)
    mat_skin = make_pbr_mat("Mat_NpcSkin", skin_hex, roughness=0.60, metallic=0.02)
    mat_hair = make_pbr_mat("Mat_NpcHair", hair_hex, roughness=0.65, metallic=0.04)
    mat_boot = make_pbr_mat("Mat_NpcBoot", boot_hex, roughness=0.50, metallic=0.20)
    mat_eye = make_pbr_mat("Mat_NpcEye", "#0f172a", roughness=0.2)

    root = create_empty(root_name)
    body = create_empty("BodyPivot", (0, 0, 0), parent=root)

    # Robed / armored tunic + boots
    add_beveled_box("LowerRobe", size=(0.82, 0.52, 0.62), loc=(0, 0, 0.44), bevel=0.05, taper_top_x=0.82, taper_top_y=0.82, mat=mat_robe, parent=body)
    add_beveled_box("UpperTorso", size=(0.78, 0.44, 0.68), loc=(0, 0, 1.06), bevel=0.05, taper_top_x=1.08, mat=mat_robe, parent=body)
    add_beveled_box("SashBelt", size=(0.82, 0.48, 0.12), loc=(0, 0, 0.74), bevel=0.02, mat=mat_trim, parent=body)
    for s in (-1, 1):
        add_beveled_box(f"Boot_{s}", size=(0.28, 0.38, 0.16), loc=(s * 0.20, 0.05, 0.08), bevel=0.03, mat=mat_boot, parent=body)

    head_piv = create_empty("HeadPivot", (0, 0, 1.46), parent=body)
    add_beveled_box("Head", size=(0.54, 0.52, 0.54), loc=(0, 0, 0.28), bevel=0.08, mat=mat_skin, parent=head_piv)
    for s in (-1, 1):
        add_beveled_box(f"Eye_{s}", size=(0.08, 0.03, 0.11), loc=(s * 0.13, 0.26, 0.26), bevel=0.008, mat=mat_eye, parent=head_piv)

    l_arm = create_empty("LeftArmPivot", (-0.52, 0, 1.34), parent=body)
    r_arm = create_empty("RightArmPivot", (0.52, 0, 1.34), parent=body)
    for piv, pfx in [(l_arm, "L"), (r_arm, "R")]:
        add_beveled_box(f"{pfx}Sleeve", size=(0.28, 0.30, 0.58), loc=(0, 0, -0.26), bevel=0.04, taper_top_x=0.9, mat=mat_robe, parent=piv)
        add_beveled_box(f"{pfx}Cuff", size=(0.30, 0.32, 0.08), loc=(0, 0, -0.50), bevel=0.015, mat=mat_trim, parent=piv)
        add_beveled_box(f"{pfx}Hand", size=(0.23, 0.24, 0.18), loc=(0, 0, -0.62), bevel=0.04, mat=mat_skin, parent=piv)

    return root, body, head_piv, l_arm, r_arm, mat_robe, mat_trim, mat_hair


def build_npcs():
    # 1. Master Zephyr — Sky Merchant NPC (Shopkeeper)
    reset_scene()
    root, body, head_piv, l_arm, r_arm, mat_robe, mat_trim, mat_hair = _build_npc_base(
        "NpcShopkeeper", "#1e3a8a", "#fbbf24", "#f5cba7", "#f8fafc"
    )
    mat_pack = make_pbr_mat("Mat_PackLeather", "#78350f", roughness=0.68, metallic=0.08)
    mat_tonic = make_pbr_mat("Mat_TonicGlow", "#34d399", roughness=0.14, emission_hex="#34d399", emission_strength=1.7)

    # White merchant beard + Wide Star-Brimmed Merchant Hat
    add_beveled_box("Beard", size=(0.34, 0.16, 0.26), loc=(0, 0.24, 0.10), bevel=0.04, taper_top_x=1.2, mat=mat_hair, parent=head_piv)
    add_cylinder_part("HatBrim", 0.62, 0.58, 0.06, vertices=18, loc=(0, -0.02, 0.54), rot=(math.radians(-8), 0, 0), mat=mat_robe, parent=head_piv)
    add_cylinder_part("HatBand", 0.34, 0.32, 0.10, vertices=16, loc=(0, -0.02, 0.60), mat=mat_trim, parent=head_piv)
    add_lofted_horn(
        "HatCone",
        [(0, -0.02, 0.62, 0.32), (0, -0.06, 0.88, 0.18), (0, -0.18, 1.12, 0.07), (0, -0.28, 1.22, 0.0)],
        sides=12,
        mat=mat_robe,
        parent=head_piv,
    )

    # Merchant Backpack + Tonic Flask + Golden Coin Staff in Right Hand
    add_beveled_box("MerchantPack", size=(0.62, 0.34, 0.66), loc=(0, -0.36, 1.08), bevel=0.05, mat=mat_pack, parent=body)
    add_cylinder_part("PackScroll", 0.08, 0.08, 0.68, vertices=12, loc=(0, -0.36, 1.46), rot=(0, math.radians(90), 0), mat=mat_trim, parent=body)
    add_octa_crystal("PackTonic", radius=0.10, height=0.26, sides=6, loc=(-0.34, -0.32, 1.12), mat=mat_tonic, parent=body)

    add_cylinder_part("CoinStaff", 0.038, 0.045, 1.85, vertices=10, loc=(0, 0.18, -0.15), mat=mat_pack, parent=r_arm)
    add_torus_part("StaffAstrolabe", 0.20, 0.028, loc=(0, 0.18, 0.85), rot=(math.radians(90), 0, 0), mat=mat_trim, parent=r_arm)
    add_octa_crystal("StaffGem", radius=0.09, height=0.22, sides=4, loc=(0, 0.18, 0.85), mat=mat_tonic, parent=r_arm)

    export_glb_and_render(
        os.path.join(MODELS_DIR, "npcs", "npc_shopkeeper.glb"),
        os.path.join(RENDERS_DIR, "npc_shopkeeper.png"),
        cam_pos=(2.0, 2.9, 1.55),
        look_at=(0, 0, 1.15),
    )

    # 2. Warden Lyra — Armory Quartermaster NPC
    reset_scene()
    root, body, head_piv, l_arm, r_arm, mat_robe, mat_trim, mat_hair = _build_npc_base(
        "NpcArmorer", "#1e293b", "#38bdf8", "#f3d0b8", "#c084fc"
    )
    mat_steel = make_pbr_mat("Mat_ValkSteel", "#cbd5e1", roughness=0.26, metallic=0.82)
    mat_cape = make_pbr_mat("Mat_ValkCape", "#312e81", roughness=0.65, metallic=0.05)

    # Cuirass breastplate + Valkyrie Cape + Winged Circlet + Forge Hammer
    add_beveled_box("Cuirass", size=(0.82, 0.48, 0.56), loc=(0, 0.02, 1.12), bevel=0.05, mat=mat_steel, parent=body)
    add_octa_crystal("ChestStar", radius=0.09, height=0.20, sides=4, loc=(0, 0.27, 1.16), rot=(math.radians(90), 0, 0), mat=mat_trim, parent=body)
    add_beveled_box("Cape", size=(0.74, 0.08, 1.18), loc=(0, -0.26, 0.84), rot=(math.radians(-8), 0, 0), bevel=0.02, taper_top_x=0.85, mat=mat_cape, parent=body)
    for s in (-1, 1):
        add_beveled_box(f"Pauldron_{s}", size=(0.30, 0.40, 0.20), loc=(s * 0.48, 0, 1.38), rot=(0, s * math.radians(15), 0), bevel=0.035, mat=mat_steel, parent=body)
        add_blade_mesh(f"HeadWing_{s}", length=0.34, width=0.14, thickness=0.04, loc=(s * 0.28, 0.02, 0.42), rot=(math.radians(-28), s * math.radians(22), 0), mat=mat_trim, parent=head_piv)

    add_beveled_box("HairBun", size=(0.58, 0.58, 0.28), loc=(0, -0.04, 0.48), bevel=0.07, mat=mat_hair, parent=head_piv)
    add_beveled_box("Ponytail", size=(0.24, 0.24, 0.48), loc=(0, -0.32, 0.22), rot=(math.radians(-18), 0, 0), bevel=0.05, mat=mat_hair, parent=head_piv)

    # Forge Warhammer in Right Hand
    add_cylinder_part("HammerShaft", 0.04, 0.04, 1.35, vertices=10, loc=(0, 0.16, -0.30), mat=mat_robe, parent=r_arm)
    add_beveled_box("HammerHead", size=(0.36, 0.56, 0.30), loc=(0, 0.16, 0.36), bevel=0.04, mat=mat_steel, parent=r_arm)
    add_beveled_box("HammerCore", size=(0.38, 0.16, 0.32), loc=(0, 0.16, 0.36), bevel=0.02, mat=mat_trim, parent=r_arm)

    export_glb_and_render(
        os.path.join(MODELS_DIR, "npcs", "npc_armorer.glb"),
        os.path.join(RENDERS_DIR, "npc_armorer.png"),
        cam_pos=(2.0, 2.85, 1.50),
        look_at=(0, 0, 1.05),
    )

    # 3. Archivist Orin — Sanctuary Guide NPC
    reset_scene()
    root, body, head_piv, l_arm, r_arm, mat_robe, mat_trim, mat_hair = _build_npc_base(
        "NpcGuide", "#134e4a", "#a855f7", "#ecc3a5", "#fde68a"
    )
    mat_gold = make_pbr_mat("Mat_GuideGold", "#fbbf24", roughness=0.25, metallic=0.8, emission_hex="#fbbf24", emission_strength=0.4)
    mat_pages = make_pbr_mat("Mat_BookPages", "#fef3c7", roughness=0.7)

    # Hooded scholar mantle + floating Star Tome in front
    add_beveled_box("ScholarMantle", size=(0.90, 0.56, 0.26), loc=(0, 0, 1.34), bevel=0.05, mat=mat_gold, parent=body)
    add_beveled_box("ScholarHood", size=(0.64, 0.62, 0.58), loc=(0, -0.04, 0.32), bevel=0.09, mat=mat_robe, parent=head_piv)
    add_torus_part("AstrolabeHalo", 0.42, 0.025, loc=(0, -0.14, 0.42), rot=(math.radians(72), 0, 0), mat=mat_gold, parent=head_piv)

    tome_piv = create_empty("FloatingTome", (0, 0.52, 1.18), parent=body)
    for s in (-1, 1):
        add_beveled_box(f"TomeCover_{s}", size=(0.24, 0.32, 0.04), loc=(s * 0.11, 0, 0), rot=(0, s * math.radians(-22), 0), bevel=0.008, mat=mat_trim, parent=tome_piv)
        add_beveled_box(f"TomePage_{s}", size=(0.21, 0.29, 0.045), loc=(s * 0.10, 0, 0.025), rot=(0, s * math.radians(-22), 0), bevel=0.006, mat=mat_pages, parent=tome_piv)
    add_octa_crystal("TomeRune", radius=0.07, height=0.18, sides=4, loc=(0, 0, 0.22), mat=mat_gold, parent=tome_piv)

    export_glb_and_render(
        os.path.join(MODELS_DIR, "npcs", "npc_guide.glb"),
        os.path.join(RENDERS_DIR, "npc_guide.png"),
        cam_pos=(1.95, 2.8, 1.48),
        look_at=(0, 0, 1.02),
    )

    # 4. Construct Training Dummy (Spring-mounted clockwork target!)
    reset_scene()
    mat_wood = make_pbr_mat("Mat_DummyWood", "#92400e", roughness=0.72, metallic=0.05)
    mat_straw = make_pbr_mat("Mat_DummyStraw", "#fbbf24", roughness=0.82, metallic=0.02)
    mat_iron = make_pbr_mat("Mat_DummyIron", "#334155", roughness=0.38, metallic=0.75)
    mat_glow = make_pbr_mat("Mat_DummyGlow", "#38bdf8", roughness=0.15, emission_hex="#38bdf8", emission_strength=1.6)
    mat_red = make_pbr_mat("Mat_Bullseye", "#f43f5e", roughness=0.45)
    mat_white = make_pbr_mat("Mat_TargetWhite", "#f8fafc", roughness=0.45)

    root = create_empty("TrainingDummyRoot")
    add_cylinder_part("BasePedestal", 0.68, 0.58, 0.22, vertices=16, loc=(0, 0, 0.11), mat=mat_iron, parent=root)
    for i in range(4):
        add_torus_part(f"SpringCoil_{i}", 0.16, 0.035, loc=(0, 0, 0.26 + i * 0.07), mat=mat_iron, parent=root)

    dummy_piv = create_empty("DummyBodyPivot", (0, 0, 0.52), parent=root)
    add_cylinder_part("CenterPost", 0.11, 0.11, 1.35, vertices=12, loc=(0, 0, 0.58), mat=mat_wood, parent=dummy_piv)
    add_cylinder_part("PaddedTorso", 0.42, 0.38, 0.86, vertices=14, loc=(0, 0, 0.56), mat=mat_wood, parent=dummy_piv)
    add_cylinder_part("StrawCollar", 0.45, 0.46, 0.14, vertices=14, loc=(0, 0, 0.98), mat=mat_straw, parent=dummy_piv)
    add_cylinder_part("CrossArmBar", 0.08, 0.08, 1.48, vertices=10, loc=(0, 0, 0.82), rot=(0, math.radians(90), 0), mat=mat_wood, parent=dummy_piv)
    for s in (-1, 1):
        add_cylinder_part(f"ArmPad_{s}", 0.15, 0.15, 0.28, vertices=12, loc=(s * 0.56, 0, 0.82), rot=(0, math.radians(90), 0), mat=mat_straw, parent=dummy_piv)

    # Bullseye Shield on Front (+Y)
    add_cylinder_part("ShieldOuter", 0.34, 0.34, 0.06, vertices=18, loc=(0, 0.41, 0.58), rot=(math.radians(90), 0, 0), mat=mat_red, parent=dummy_piv)
    add_cylinder_part("ShieldMid", 0.22, 0.22, 0.07, vertices=18, loc=(0, 0.42, 0.58), rot=(math.radians(90), 0, 0), mat=mat_white, parent=dummy_piv)
    add_cylinder_part("ShieldCore", 0.10, 0.10, 0.08, vertices=16, loc=(0, 0.43, 0.58), rot=(math.radians(90), 0, 0), mat=mat_glow, parent=dummy_piv)

    # Bucket Knight Helm with glowing visor
    add_cylinder_part("DummyHelm", 0.28, 0.26, 0.44, vertices=12, loc=(0, 0, 1.30), mat=mat_iron, parent=dummy_piv)
    add_beveled_box("DummyVisor", size=(0.36, 0.10, 0.09), loc=(0, 0.24, 1.32), bevel=0.015, mat=mat_glow, parent=dummy_piv)

    export_glb_and_render(
        os.path.join(MODELS_DIR, "npcs", "npc_training_dummy.glb"),
        os.path.join(RENDERS_DIR, "npc_training_dummy.png"),
        cam_pos=(1.9, 2.75, 1.45),
        look_at=(0, 0, 1.0),
    )


def build_enemies_and_boss():
    # 1. Crimson Striker (Agile Melee Construct)
    reset_scene()
    mat_body = make_pbr_mat("Mat_EnemyBody", "#272036", roughness=0.38, metallic=0.55)
    mat_plate = make_pbr_mat("Mat_EnemyPlate", "#3f2e56", roughness=0.32, metallic=0.62)
    mat_accent = make_pbr_mat("Mat_EnemyAccent", "#f43f5e", roughness=0.14, emission_hex="#f43f5e", emission_strength=2.0)

    root = create_empty("CrimsonStrikerRoot")
    body = create_empty("BodyPivot", (0, 0, 0), parent=root)

    # Forward-angled raptor knight chassis + reverse-joint legs + twin crimson mantis scythes
    add_beveled_box("Torso", size=(0.76, 0.54, 0.72), loc=(0, 0.04, 1.08), rot=(math.radians(-10), 0, 0), bevel=0.05, taper_top_x=1.22, mat=mat_body, parent=body)
    add_octa_crystal("ChestCore", radius=0.13, height=0.28, sides=4, loc=(0, 0.32, 1.10), rot=(math.radians(80), 0, 0), mat=mat_accent, parent=body)
    add_beveled_box("ThrusterPack", size=(0.48, 0.28, 0.46), loc=(0, -0.28, 1.14), bevel=0.035, mat=mat_plate, parent=body)

    head = add_beveled_box("Helm", size=(0.48, 0.56, 0.44), loc=(0, 0.12, 1.66), bevel=0.05, taper_top_x=0.88, mat=mat_plate, parent=body)
    add_beveled_box("VisorSlit", size=(0.42, 0.12, 0.10), loc=(0, 0.26, 0.02), bevel=0.015, mat=mat_accent, parent=head)
    for s in (-1, 1):
        add_lofted_horn(
            f"StrikerHorn_{s}",
            [(s * 0.18, 0.02, 0.16, 0.06), (s * 0.28, -0.18, 0.34, 0.04), (s * 0.32, -0.38, 0.48, 0.0)],
            sides=5,
            mat=mat_accent,
            parent=head,
            smooth=False,
        )
        # Legs
        add_beveled_box(f"Thigh_{s}", size=(0.24, 0.28, 0.44), loc=(s * 0.26, 0.04, 0.56), rot=(math.radians(16), 0, 0), bevel=0.03, mat=mat_body, parent=body)
        add_beveled_box(f"Shin_{s}", size=(0.20, 0.24, 0.44), loc=(s * 0.26, -0.04, 0.22), rot=(math.radians(-12), 0, 0), bevel=0.025, mat=mat_plate, parent=body)
        add_beveled_box(f"ClawFoot_{s}", size=(0.24, 0.38, 0.10), loc=(s * 0.26, 0.08, 0.05), bevel=0.02, mat=mat_body, parent=body)

        # Articulated Blade Arms
        pfx = "Left" if s == -1 else "Right"
        apiv = create_empty(f"{pfx}ArmPivot", (s * 0.54, 0.06, 1.28), parent=body)
        add_beveled_box(f"{pfx}Shoulder", size=(0.28, 0.34, 0.28), loc=(0, 0, 0), bevel=0.035, mat=mat_plate, parent=apiv)
        add_beveled_box(f"{pfx}Forearm", size=(0.20, 0.38, 0.20), loc=(s * 0.04, 0.18, -0.22), rot=(math.radians(-35), 0, 0), bevel=0.025, mat=mat_body, parent=apiv)
        add_blade_mesh(
            f"{pfx}Scythe",
            length=0.88,
            width=0.20,
            thickness=0.045,
            loc=(s * 0.05, 0.24, -0.26),
            rot=(math.radians(-78), 0, 0),
            mat=mat_accent,
            parent=apiv,
        )

    export_glb_and_render(
        os.path.join(MODELS_DIR, "enemies", "enemy_crimson_striker.glb"),
        os.path.join(RENDERS_DIR, "enemy_crimson_striker.png"),
        cam_pos=(2.05, 2.85, 1.55),
        look_at=(0, 0, 1.02),
    )

    # 2. Prism Sentinel (Levitating Obelisk Turret)
    reset_scene()
    mat_obs = make_pbr_mat("Mat_EnemyBody", "#1e293b", roughness=0.30, metallic=0.65)
    mat_prism = make_pbr_mat("Mat_EnemyAccent", "#a855f7", roughness=0.10, emission_hex="#a855f7", emission_strength=2.1)
    mat_gold = make_pbr_mat("Mat_SentinelGold", "#fbbf24", roughness=0.25, metallic=0.80)

    root = create_empty("PrismSentinelRoot")
    body = create_empty("BodyPivot", (0, 0, 1.28), parent=root)

    add_octa_crystal("SentinelCore", radius=0.44, height=1.36, sides=4, loc=(0, 0, 0), mat=mat_obs, parent=body)
    add_sphere_part("EyeSocket", 0.24, loc=(0, 0.34, 0.04), mat=mat_gold, parent=body)
    add_sphere_part("PrismEye", 0.17, loc=(0, 0.42, 0.04), mat=mat_prism, parent=body)

    inner_ring = create_empty("InnerRing", (0, 0, 0), parent=body)
    add_torus_part("GyroRingInner", 0.62, 0.036, loc=(0, 0, 0), rot=(math.radians(65), math.radians(20), 0), mat=mat_gold, parent=inner_ring)

    outer_ring = create_empty("OuterRing", (0, 0, 0), parent=body)
    add_torus_part("GyroRingOuter", 0.80, 0.030, loc=(0, 0, 0), rot=(math.radians(-40), math.radians(35), 0), mat=mat_prism, parent=outer_ring)

    for s in (-1, 1):
        add_octa_crystal(f"WingShard_{s}", radius=0.14, height=0.92, sides=4, loc=(s * 0.78, -0.05, 0.06), rot=(0, s * math.radians(-14), 0), mat=mat_prism, parent=body)

    export_glb_and_render(
        os.path.join(MODELS_DIR, "enemies", "enemy_prism_sentinel.glb"),
        os.path.join(RENDERS_DIR, "enemy_prism_sentinel.png"),
        cam_pos=(2.15, 2.85, 1.65),
        look_at=(0, 0, 1.25),
    )

    # 3. Aegis Juggernaut (Heavy Siege Golem)
    reset_scene()
    mat_armor = make_pbr_mat("Mat_EnemyBody", "#334155", roughness=0.42, metallic=0.68)
    mat_dark = make_pbr_mat("Mat_GolemUnder", "#0f172a", roughness=0.55, metallic=0.4)
    mat_core = make_pbr_mat("Mat_EnemyAccent", "#fbbf24", roughness=0.15, emission_hex="#f59e0b", emission_strength=2.0)

    root = create_empty("AegisJuggernautRoot")
    body = create_empty("BodyPivot", (0, 0, 0), parent=root)

    # Broad Fortress Torso + Reactor Core + Sunken Bastion Helm + Massive Gauntlets
    add_beveled_box("Pelvis", size=(0.86, 0.62, 0.34), loc=(0, 0, 0.62), bevel=0.04, mat=mat_dark, parent=body)
    add_beveled_box("FortressChest", size=(1.22, 0.84, 0.88), loc=(0, 0.04, 1.18), bevel=0.07, taper_top_x=1.18, mat=mat_armor, parent=body)
    add_cylinder_part("ReactorRing", 0.26, 0.26, 0.12, vertices=16, loc=(0, 0.44, 1.20), rot=(math.radians(90), 0, 0), mat=mat_dark, parent=body)
    add_octa_crystal("ReactorCore", radius=0.18, height=0.22, sides=6, loc=(0, 0.48, 1.20), rot=(math.radians(90), 0, 0), mat=mat_core, parent=body)

    add_beveled_box("BastionHelm", size=(0.56, 0.54, 0.44), loc=(0, 0.12, 1.72), bevel=0.05, mat=mat_armor, parent=body)
    add_beveled_box("HelmVisor", size=(0.44, 0.10, 0.11), loc=(0, 0.38, 1.72), bevel=0.015, mat=mat_core, parent=body)
    for s in (-1, 1):
        add_lofted_horn(
            f"BullHorn_{s}",
            [(s * 0.26, 0.12, 1.78, 0.08), (s * 0.46, 0.24, 1.92, 0.055), (s * 0.50, 0.38, 2.08, 0.0)],
            sides=6,
            mat=mat_core,
            parent=body,
        )
        # Pillar legs
        add_beveled_box(f"PillarLeg_{s}", size=(0.40, 0.48, 0.56), loc=(s * 0.32, 0, 0.28), bevel=0.045, mat=mat_armor, parent=body)

        # Colossal Smash Gauntlet Arms
        pfx = "Left" if s == -1 else "Right"
        apiv = create_empty(f"{pfx}ArmPivot", (s * 0.78, 0.04, 1.42), parent=body)
        add_beveled_box(f"{pfx}FortPauldron", size=(0.46, 0.62, 0.42), loc=(s * 0.06, 0, 0.08), rot=(0, s * math.radians(12), 0), bevel=0.05, mat=mat_armor, parent=apiv)
        add_beveled_box(f"{pfx}SmashFist", size=(0.48, 0.56, 0.68), loc=(s * 0.10, 0.12, -0.58), bevel=0.06, taper_top_x=0.82, mat=mat_armor, parent=apiv)
        add_beveled_box(f"{pfx}KnuckleGlow", size=(0.42, 0.10, 0.16), loc=(s * 0.10, 0.39, -0.76), bevel=0.02, mat=mat_core, parent=apiv)

    export_glb_and_render(
        os.path.join(MODELS_DIR, "enemies", "enemy_aegis_juggernaut.glb"),
        os.path.join(RENDERS_DIR, "enemy_aegis_juggernaut.png"),
        cam_pos=(2.5, 3.35, 1.85),
        look_at=(0, 0, 1.05),
    )

    # 4. Spire Warden — Summit Boss (Regal Celestial Archon)
    reset_scene()
    mat_obsidian = make_pbr_mat("Mat_EnemyBody", "#1e1b4b", roughness=0.28, metallic=0.68)
    mat_sovereign = make_pbr_mat("Mat_WardenGold", "#fbbf24", roughness=0.20, metallic=0.88, emission_hex="#f59e0b", emission_strength=0.45)
    mat_aether = make_pbr_mat("Mat_EnemyAccent", "#e879f9", roughness=0.10, emission_hex="#e879f9", emission_strength=2.2)
    mat_cyan = make_pbr_mat("Mat_WardenCyan", "#38bdf8", roughness=0.10, emission_hex="#38bdf8", emission_strength=2.0)

    root = create_empty("SpireWardenBossRoot")
    body = create_empty("BodyPivot", (0, 0, 0), parent=root)

    # Hovering armored greaves + majestic archon robe-armor + glowing open core
    add_octa_crystal("HoverSkirt", radius=0.52, height=0.95, sides=6, waist_ratio=0.75, loc=(0, 0, 0.56), mat=mat_obsidian, parent=body)
    add_beveled_box("ArchonChest", size=(1.08, 0.66, 0.88), loc=(0, 0, 1.32), bevel=0.06, taper_top_x=1.24, mat=mat_obsidian, parent=body)
    add_beveled_box("GoldPlastron", size=(0.68, 0.70, 0.72), loc=(0, 0.02, 1.34), bevel=0.04, taper_top_x=1.18, mat=mat_sovereign, parent=body)
    add_octa_crystal("ArchonHeart", radius=0.20, height=0.42, sides=4, loc=(0, 0.36, 1.34), mat=mat_aether, parent=body)

    # Crowned Archon Head + Floating 6-Star Solar Halo
    head = create_empty("HeadPivot", (0, 0, 1.82), parent=body)
    add_beveled_box("ArchonHelm", size=(0.54, 0.54, 0.58), loc=(0, 0, 0.28), bevel=0.06, mat=mat_obsidian, parent=head)
    add_octa_crystal("FaceMask", radius=0.18, height=0.42, sides=4, loc=(0, 0.26, 0.26), mat=mat_sovereign, parent=head)
    add_beveled_box("ArchonEyes", size=(0.42, 0.12, 0.09), loc=(0, 0.27, 0.32), bevel=0.015, mat=mat_cyan, parent=head)
    for s in (-1, 1):
        add_lofted_horn(
            f"CrownHorn_{s}",
            [(s * 0.22, 0, 0.50, 0.07), (s * 0.38, -0.05, 0.78, 0.05), (s * 0.30, -0.10, 1.06, 0.0)],
            sides=6,
            mat=mat_sovereign,
            parent=head,
        )

    halo = create_empty("HaloRing", (0, -0.28, 2.22), parent=body)
    add_torus_part("SolarHalo", 0.78, 0.045, loc=(0, 0, 0), rot=(math.radians(90), 0, 0), mat=mat_sovereign, parent=halo)
    for i in range(6):
        a = (i / 6) * math.tau
        add_octa_crystal(
            f"HaloRay_{i}",
            radius=0.08,
            height=0.34,
            sides=4,
            loc=(math.cos(a) * 0.92, 0, math.sin(a) * 0.92),
            rot=(0, -a + math.pi / 2, 0),
            mat=mat_aether if i % 2 == 0 else mat_cyan,
            parent=halo,
        )

    # 4 Levitating Seraph Blade-Wings + Twin Archon Scepter-Blades
    wing_Root = create_empty("SeraphWings", (0, -0.32, 1.52), parent=body)
    for s in (-1, 1):
        for tier, (z_off, ang, ln) in enumerate([(0.32, 32, 1.35), (-0.18, 62, 1.15)]):
            add_blade_mesh(
                f"SeraphWing_{s}_{tier}",
                length=ln,
                width=0.24,
                thickness=0.06,
                loc=(s * 0.45, 0, z_off),
                rot=(0, s * math.radians(ang), 0),
                mat=mat_sovereign if tier == 0 else mat_cyan,
                parent=wing_Root,
            )

        pfx = "Left" if s == -1 else "Right"
        apiv = create_empty(f"{pfx}ArmPivot", (s * 0.72, 0.04, 1.58), parent=body)
        add_beveled_box(f"{pfx}Pauldron", size=(0.38, 0.48, 0.34), loc=(0, 0, 0.06), bevel=0.04, mat=mat_sovereign, parent=apiv)
        add_beveled_box(f"{pfx}Arm", size=(0.26, 0.28, 0.56), loc=(0, 0.08, -0.32), rot=(math.radians(-22), 0, 0), bevel=0.03, mat=mat_obsidian, parent=apiv)
        add_blade_mesh(
            f"{pfx}ArchonGlaive",
            length=1.18,
            width=0.22,
            thickness=0.05,
            loc=(0, 0.26, -0.48),
            rot=(math.radians(-68), 0, 0),
            mat=mat_aether if s == -1 else mat_cyan,
            parent=apiv,
        )

    export_glb_and_render(
        os.path.join(MODELS_DIR, "enemies", "enemy_spire_warden_boss.glb"),
        os.path.join(RENDERS_DIR, "enemy_spire_warden_boss.png"),
        cam_pos=(2.9, 3.85, 2.25),
        look_at=(0, 0, 1.38),
    )


if __name__ == "__main__":
    build_npcs()
    build_enemies_and_boss()
    print("SUCCESS: Built all 4 NPCs/Dummy and all 4 Enemy/Boss constructs.")

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
    add_torus_part,
    add_octa_crystal,
    add_blade_mesh,
    add_lofted_horn,
    export_glb_and_render,
)

ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
WEAPONS_DIR = os.path.join(ROOT, "public", "assets", "models", "weapons")
RENDERS_DIR = os.path.join(SCRIPT_DIR, "renders")


def build_sunbreaker_claymore():
    """Heavy Sovereign Greatsword: broad solar-gold plasma blade with sun-burst guard."""
    reset_scene()
    mat_gold = make_pbr_mat("Mat_SunHilt", "#f59e0b", roughness=0.22, metallic=0.88)
    mat_obsidian = make_pbr_mat("Mat_SunSpine", "#1e1b4b", roughness=0.36, metallic=0.62)
    mat_blade = make_pbr_mat(
        "Mat_BladeGlow",
        "#fbbf24",
        roughness=0.14,
        metallic=0.35,
        emission_hex="#f59e0b",
        emission_strength=1.9,
    )
    mat_ruby = make_pbr_mat(
        "Mat_SunGem",
        "#f43f5e",
        roughness=0.10,
        emission_hex="#fb7185",
        emission_strength=2.1,
    )

    root = create_empty("SunbreakerRoot")

    # Long two-handed claymore grip + sunburst pommel
    add_cylinder_part("Grip", 0.046, 0.052, 0.34, vertices=12, loc=(0, 0, -0.05), mat=mat_obsidian, parent=root)
    add_torus_part("GripRingA", 0.052, 0.012, loc=(0, 0, -0.04), mat=mat_gold, parent=root)
    add_torus_part("GripRingB", 0.052, 0.012, loc=(0, 0, 0.05), mat=mat_gold, parent=root)
    add_octa_crystal("SunPommel", radius=0.095, height=0.18, sides=8, loc=(0, 0, -0.26), mat=mat_gold, parent=root)

    # Heavy Sun-Crest Crossguard
    add_beveled_box("GuardBlock", size=(0.18, 0.34, 0.14), loc=(0, 0, 0.16), bevel=0.025, mat=mat_gold, parent=root)
    for s in (-1, 1):
        add_lofted_horn(
            f"SunHorn_{s}",
            [
                (0, s * 0.14, 0.16, 0.07),
                (0, s * 0.34, 0.22, 0.052),
                (0, s * 0.46, 0.34, 0.02),
                (0, s * 0.50, 0.42, 0.0),
            ],
            sides=6,
            mat=mat_gold,
            parent=root,
        )
        add_octa_crystal(
            f"SunCore_{s}",
            radius=0.072,
            height=0.14,
            sides=6,
            loc=(s * 0.085, 0, 0.16),
            rot=(0, math.radians(90), 0),
            mat=mat_ruby,
            parent=root,
        )

    # Broad heavy claymore blade + dark fuller spine + ricasso collar
    add_beveled_box("Ricasso", size=(0.11, 0.28, 0.24), loc=(0, 0, 0.30), bevel=0.02, taper_top_y=0.92, mat=mat_obsidian, parent=root)
    add_blade_mesh(
        "SolarBladeEdge",
        length=1.52,
        width=0.36,
        thickness=0.068,
        tip_ratio=0.22,
        loc=(0, 0, 0.24),
        mat=mat_blade,
        parent=root,
    )
    add_blade_mesh(
        "SolarFuller",
        length=1.22,
        width=0.16,
        thickness=0.095,
        tip_ratio=0.18,
        loc=(0, 0, 0.28),
        mat=mat_obsidian,
        parent=root,
    )

    create_empty("BladeBase", (0, 0, 0.22), parent=root)
    create_empty("BladeTip", (0, 0, 1.76), parent=root)

    export_glb_and_render(
        os.path.join(WEAPONS_DIR, "weapon_sunbreaker.glb"),
        os.path.join(RENDERS_DIR, "weapon_sunbreaker.png"),
        cam_pos=(1.68, 1.78, 1.02),
        look_at=(0, 0, 0.76),
    )


def build_storm_katana():
    """Agile Cyber-Aether Katana: sleek curved blade, octagonal tsuba guard, electric cyan edge."""
    reset_scene()
    mat_wrap = make_pbr_mat("Mat_KatanaWrap", "#0f172a", roughness=0.62, metallic=0.15)
    mat_brass = make_pbr_mat("Mat_KatanaGold", "#38bdf8", roughness=0.22, metallic=0.80)
    mat_spine = make_pbr_mat("Mat_KatanaSpine", "#cbd5e1", roughness=0.18, metallic=0.88)
    mat_edge = make_pbr_mat(
        "Mat_BladeGlow",
        "#22d3ee",
        roughness=0.10,
        emission_hex="#22d3ee",
        emission_strength=2.2,
    )

    root = create_empty("StormKatanaRoot")

    # Tsuka Grip with diamond menuki studs + octagonal Tsuba handguard
    add_beveled_box("TsukaGrip", size=(0.065, 0.095, 0.34), loc=(0, 0, -0.04), bevel=0.018, mat=mat_wrap, parent=root)
    for i in range(3):
        add_octa_crystal(
            f"Menuki_{i}",
            radius=0.028,
            height=0.08,
            sides=4,
            loc=(0, 0, -0.14 + i * 0.09),
            rot=(0, math.radians(90), 0),
            mat=mat_edge,
            parent=root,
        )
    add_cylinder_part("KashiraCap", 0.045, 0.040, 0.06, vertices=8, loc=(0, 0, -0.23), mat=mat_brass, parent=root, smooth=False)
    add_cylinder_part("TsubaGuard", 0.16, 0.15, 0.032, vertices=8, loc=(0, 0, 0.14), mat=mat_brass, parent=root, smooth=False)
    add_torus_part("TsubaHalo", 0.175, 0.014, major_seg=24, minor_seg=8, loc=(0, 0, 0.14), mat=mat_edge, parent=root)
    add_beveled_box("HabakiCollar", size=(0.068, 0.11, 0.09), loc=(0, 0, 0.19), bevel=0.01, mat=mat_brass, parent=root)

    # Graceful slightly-curved single-edged plasma katana blade (curves gently toward +Y front!)
    curve_stations_edge = [
        (0, 0.015, 0.21, 0.062),
        (0, 0.028, 0.62, 0.058),
        (0, 0.052, 1.06, 0.052),
        (0, 0.088, 1.46, 0.038),
        (0, 0.118, 1.68, 0.0),
    ]
    add_lofted_horn("KatanaPlasmaEdge", curve_stations_edge, sides=4, mat=mat_edge, parent=root, smooth=False)

    curve_stations_spine = [
        (0, -0.025, 0.21, 0.044),
        (0, -0.012, 0.62, 0.040),
        (0, 0.012, 1.05, 0.035),
        (0, 0.048, 1.42, 0.024),
        (0, 0.085, 1.60, 0.0),
    ]
    add_lofted_horn("KatanaSteelSpine", curve_stations_spine, sides=4, mat=mat_spine, parent=root, smooth=False)

    create_empty("BladeBase", (0, 0.01, 0.20), parent=root)
    create_empty("BladeTip", (0, 0.11, 1.68), parent=root)

    export_glb_and_render(
        os.path.join(WEAPONS_DIR, "weapon_storm_katana.glb"),
        os.path.join(RENDERS_DIR, "weapon_storm_katana.png"),
        cam_pos=(1.58, 1.68, 0.96),
        look_at=(0, 0.04, 0.72),
    )


def build_astral_halberd():
    """Long-reach Celestial Starfall Glaive: ornate shaft, crescent moon wings, void-star spearhead."""
    reset_scene()
    mat_shaft = make_pbr_mat("Mat_GlaiveShaft", "#1e1b4b", roughness=0.40, metallic=0.55)
    mat_gold = make_pbr_mat("Mat_GlaiveGold", "#fbbf24", roughness=0.24, metallic=0.86)
    mat_void = make_pbr_mat(
        "Mat_BladeGlow",
        "#c084fc",
        roughness=0.12,
        emission_hex="#d946ef",
        emission_strength=2.1,
    )
    mat_star = make_pbr_mat(
        "Mat_StarCore",
        "#fae8ff",
        roughness=0.08,
        emission_hex="#f5d0fe",
        emission_strength=2.4,
    )

    root = create_empty("AstralHalberdRoot")

    # Extended pole-glaive shaft
    add_cylinder_part("PoleShaft", 0.038, 0.042, 0.92, vertices=12, loc=(0, 0, 0.12), mat=mat_shaft, parent=root)
    add_octa_crystal("TailSpike", radius=0.065, height=0.22, sides=6, loc=(0, 0, -0.38), mat=mat_gold, parent=root)
    for z_ring in (-0.18, 0.18, 0.52):
        add_torus_part(f"ShaftBand_{z_ring}", 0.048, 0.011, loc=(0, 0, z_ring), mat=mat_gold, parent=root)

    # Astrolabe Crescent Collar at z=0.62
    add_torus_part("AstrolabeRing", 0.18, 0.022, loc=(0, 0, 0.64), rot=(0, math.radians(90), 0), mat=mat_gold, parent=root)
    add_octa_crystal("AstrolabeStar", radius=0.075, height=0.18, sides=4, loc=(0, 0, 0.64), mat=mat_star, parent=root)

    # Twin Crescent Halberd Side-Blades
    for s in (-1, 1):
        add_lofted_horn(
            f"CrescentWing_{s}",
            [
                (0, s * 0.06, 0.62, 0.055),
                (0, s * 0.26, 0.72, 0.065),
                (0, s * 0.34, 0.92, 0.042),
                (0, s * 0.24, 1.12, 0.0),
            ],
            sides=4,
            mat=mat_void,
            parent=root,
            smooth=False,
        )

    # Soaring Central Void-Crystal Spearblade
    add_blade_mesh(
        "SpearMainBlade",
        length=1.18,
        width=0.24,
        thickness=0.062,
        tip_ratio=0.34,
        loc=(0, 0, 0.70),
        mat=mat_void,
        parent=root,
    )
    add_blade_mesh(
        "SpearCoreSpine",
        length=0.92,
        width=0.10,
        thickness=0.082,
        tip_ratio=0.30,
        loc=(0, 0, 0.72),
        mat=mat_gold,
        parent=root,
    )

    create_empty("BladeBase", (0, 0, 0.56), parent=root)
    create_empty("BladeTip", (0, 0, 1.88), parent=root)

    export_glb_and_render(
        os.path.join(WEAPONS_DIR, "weapon_astral_halberd.glb"),
        os.path.join(RENDERS_DIR, "weapon_astral_halberd.png"),
        cam_pos=(1.78, 1.88, 0.88),
        look_at=(0, 0, 0.78),
    )


if __name__ == "__main__":
    build_sunbreaker_claymore()
    build_storm_katana()
    build_astral_halberd()
    print("SUCCESS: Built 3 additional Blender 5.3 melee weapons.")

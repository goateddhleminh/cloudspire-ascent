import bpy
import bmesh
import math
import os
from mathutils import Vector, Euler, Matrix


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0


def make_pbr_mat(
    name: str,
    color_hex: str,
    roughness: float = 0.52,
    metallic: float = 0.08,
    emission_hex: str | None = None,
    emission_strength: float = 0.0,
    alpha: float = 1.0,
):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf is None:
        nodes.clear()
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")
        out = nodes.new("ShaderNodeOutputMaterial")
        mat.node_tree.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    rgba = hex_to_linear_rgba(color_hex, alpha)
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = alpha
    if alpha < 0.999 and hasattr(mat, "blend_method"):
        mat.blend_method = 'BLEND'

    if emission_hex and emission_strength > 0.0:
        em_rgba = hex_to_linear_rgba(emission_hex, 1.0)
        em_key = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
        if em_key in bsdf.inputs:
            bsdf.inputs[em_key].default_value = em_rgba
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength

    return mat


def srgb_to_linear(c: float) -> float:
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear_rgba(hex_str: str, alpha: float = 1.0):
    h = hex_str.lstrip("#")
    r = srgb_to_linear(int(h[0:2], 16) / 255.0)
    g = srgb_to_linear(int(h[2:4], 16) / 255.0)
    b = srgb_to_linear(int(h[4:6], 16) / 255.0)
    return (r, g, b, alpha)


def create_empty(name: str, loc=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 0.0), parent=None):
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = 'PLAIN_AXES'
    empty.empty_display_size = 0.15
    bpy.context.collection.objects.link(empty)
    empty.location = loc
    empty.rotation_euler = rot
    if parent is not None:
        empty.parent = parent
    return empty


def _finish_mesh_obj(name: str, bm: bmesh.types.BMesh, loc, rot, mat, parent, smooth=False):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm.to_mesh(mesh)
    bm.free()

    for poly in mesh.polygons:
        poly.use_smooth = smooth

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    if mat is not None:
        obj.data.materials.append(mat)
    if parent is not None:
        obj.parent = parent
    return obj


def add_beveled_box(
    name: str,
    size=(1.0, 1.0, 1.0),
    loc=(0.0, 0.0, 0.0),
    rot=(0.0, 0.0, 0.0),
    bevel: float = 0.03,
    segments: int = 2,
    taper_top_x: float = 1.0,
    taper_top_y: float = 1.0,
    offset=(0.0, 0.0, 0.0),
    mat=None,
    parent=None,
    smooth: bool = True,
):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = size
    ox, oy, oz = offset

    for v in bm.verts:
        is_top = v.co.z > 0
        tx = taper_top_x if is_top else 1.0
        ty = taper_top_y if is_top else 1.0
        v.co.x = v.co.x * sx * tx + ox
        v.co.y = v.co.y * sy * ty + oy
        v.co.z = v.co.z * sz + oz

    if bevel > 0.0005:
        max_b = min(sx, sy, sz) * 0.36
        bmesh.ops.bevel(
            bm,
            geom=list(bm.edges),
            offset=min(bevel, max_b),
            segments=segments,
            profile=0.5,
            affect='EDGES',
        )

    return _finish_mesh_obj(name, bm, loc, rot, mat, parent, smooth=smooth)


def add_cylinder_part(
    name: str,
    r1: float,
    r2: float,
    depth: float,
    vertices: int = 16,
    loc=(0.0, 0.0, 0.0),
    rot=(0.0, 0.0, 0.0),
    offset=(0.0, 0.0, 0.0),
    bevel: float = 0.015,
    mat=None,
    parent=None,
    smooth: bool = True,
):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=vertices,
        radius1=r1,
        radius2=r2,
        depth=depth,
    )
    ox, oy, oz = offset
    if ox != 0 or oy != 0 or oz != 0:
        bmesh.ops.translate(bm, verts=bm.verts, vec=(ox, oy, oz))

    if bevel > 0.0005:
        cap_edges = [e for e in bm.edges if len(e.link_faces) == 2 and abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-4]
        if cap_edges:
            bmesh.ops.bevel(
                bm,
                geom=cap_edges,
                offset=min(bevel, min(r1, r2, depth) * 0.3),
                segments=2,
                affect='EDGES',
            )
    return _finish_mesh_obj(name, bm, loc, rot, mat, parent, smooth=smooth)


def add_sphere_part(
    name: str,
    radius: float,
    scale=(1.0, 1.0, 1.0),
    segments: int = 18,
    rings: int = 12,
    loc=(0.0, 0.0, 0.0),
    rot=(0.0, 0.0, 0.0),
    offset=(0.0, 0.0, 0.0),
    mat=None,
    parent=None,
    smooth: bool = True,
):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    sx, sy, sz = scale
    ox, oy, oz = offset
    for v in bm.verts:
        v.co.x = v.co.x * sx + ox
        v.co.y = v.co.y * sy + oy
        v.co.z = v.co.z * sz + oz
    return _finish_mesh_obj(name, bm, loc, rot, mat, parent, smooth=smooth)


def add_torus_part(
    name: str,
    major_r: float,
    minor_r: float,
    major_seg: int = 28,
    minor_seg: int = 10,
    loc=(0.0, 0.0, 0.0),
    rot=(0.0, 0.0, 0.0),
    mat=None,
    parent=None,
):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_r,
        minor_radius=minor_r,
        major_segments=major_seg,
        minor_segments=minor_seg,
        location=loc,
        rotation=rot,
    )
    obj = bpy.context.active_object
    obj.name = name
    for p in obj.data.polygons:
        p.use_smooth = True
    if mat is not None:
        obj.data.materials.append(mat)
    if parent is not None:
        obj.parent = parent
    return obj


def add_octa_crystal(
    name: str,
    radius: float = 0.35,
    height: float = 0.9,
    sides: int = 6,
    waist_ratio: float = 0.45,
    loc=(0.0, 0.0, 0.0),
    rot=(0.0, 0.0, 0.0),
    offset=(0.0, 0.0, 0.0),
    mat=None,
    parent=None,
):
    bm = bmesh.new()
    ox, oy, oz = offset
    bot = bm.verts.new((ox, oy, oz - height * 0.5))
    top = bm.verts.new((ox, oy, oz + height * 0.5))
    wz = oz + (waist_ratio - 0.5) * height

    ring = []
    for i in range(sides):
        a = (i / sides) * math.tau
        ring.append(bm.verts.new((ox + math.cos(a) * radius, oy + math.sin(a) * radius, wz)))

    for i in range(sides):
        v1 = ring[i]
        v2 = ring[(i + 1) % sides]
        bm.faces.new((v1, v2, top))
        bm.faces.new((v2, v1, bot))

    return _finish_mesh_obj(name, bm, loc, rot, mat, parent, smooth=False)


def add_blade_mesh(
    name: str,
    length: float = 1.45,
    width: float = 0.24,
    thickness: float = 0.075,
    tip_ratio: float = 0.24,
    loc=(0.0, 0.0, 0.0),
    rot=(0.0, 0.0, 0.0),
    offset=(0.0, 0.0, 0.0),
    mat=None,
    parent=None,
):
    """Creates a crisp 4-faceted diamond cross-section sword blade extending along +Z."""
    bm = bmesh.new()
    ox, oy, oz = offset
    z_base = oz
    z_shoulder = oz + length * (1.0 - tip_ratio)
    z_tip = oz + length

    hw = width * 0.5
    ht = thickness * 0.5

    # Base diamond ring (4 verts: +X edge, +Y ridge, -X edge, -Y ridge)
    b0 = [
        bm.verts.new((ox + ht, oy, z_base)),
        bm.verts.new((ox, oy + hw, z_base)),
        bm.verts.new((ox - ht, oy, z_base)),
        bm.verts.new((ox, oy - hw, z_base)),
    ]
    # Shoulder diamond ring (slight heroic flare!)
    b1 = [
        bm.verts.new((ox + ht * 0.85, oy, z_shoulder)),
        bm.verts.new((ox, oy + hw * 1.12, z_shoulder)),
        bm.verts.new((ox - ht * 0.85, oy, z_shoulder)),
        bm.verts.new((ox, oy - hw * 1.12, z_shoulder)),
    ]
    tip = bm.verts.new((ox, oy, z_tip))

    bm.faces.new((b0[3], b0[2], b0[1], b0[0]))
    for i in range(4):
        ni = (i + 1) % 4
        bm.faces.new((b0[i], b0[ni], b1[ni], b1[i]))
        bm.faces.new((b1[i], b1[ni], tip))

    return _finish_mesh_obj(name, bm, loc, rot, mat, parent, smooth=False)


def add_lofted_horn(
    name: str,
    points_and_radii: list[tuple[float, float, float, float]],
    sides: int = 8,
    loc=(0.0, 0.0, 0.0),
    rot=(0.0, 0.0, 0.0),
    mat=None,
    parent=None,
    smooth: bool = True,
):
    """Lofts a curved horn, branch, or tentacle through (x, y, z, radius) stations."""
    bm = bmesh.new()
    rings = []
    n = len(points_and_radii)
    for idx, (px, py, pz, r) in enumerate(points_and_radii):
        if r <= 0.001:
            rings.append([bm.verts.new((px, py, pz))])
            continue
        p_curr = Vector((px, py, pz))
        if idx < n - 1:
            p_next = Vector(points_and_radii[idx + 1][:3])
            tangent = (p_next - p_curr).normalized()
        else:
            p_prev = Vector(points_and_radii[idx - 1][:3])
            tangent = (p_curr - p_prev).normalized()

        up_ref = Vector((0, 1, 0)) if abs(tangent.dot(Vector((0, 1, 0)))) < 0.9 else Vector((1, 0, 0))
        side_a = tangent.cross(up_ref).normalized()
        side_b = side_a.cross(tangent).normalized()

        ring = []
        for s in range(sides):
            ang = (s / sides) * math.tau
            pt = p_curr + side_a * (math.cos(ang) * r) + side_b * (math.sin(ang) * r)
            ring.append(bm.verts.new(pt))
        rings.append(ring)

    # Cap base if ring
    if len(rings[0]) > 2:
        bm.faces.new(list(reversed(rings[0])))

    for i in range(len(rings) - 1):
        rA = rings[i]
        rB = rings[i + 1]
        if len(rB) == 1:
            tip = rB[0]
            for s in range(len(rA)):
                ns = (s + 1) % len(rA)
                bm.faces.new((rA[s], rA[ns], tip))
        elif len(rA) == len(rB):
            for s in range(len(rA)):
                ns = (s + 1) % len(rA)
                bm.faces.new((rA[s], rA[ns], rB[ns], rB[s]))

    return _finish_mesh_obj(name, bm, loc, rot, mat, parent, smooth=smooth)


def export_glb_and_render(
    glb_path: str,
    preview_png_path: str | None = None,
    cam_pos=(2.3, 3.3, 1.9),
    look_at=(0.0, 0.0, 0.95),
    res: int = 384,
):
    os.makedirs(os.path.dirname(glb_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        export_yup=True,
        export_apply=True,
    )

    if not preview_png_path:
        return

    os.makedirs(os.path.dirname(preview_png_path), exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 20
    scene.cycles.use_denoising = False
    scene.render.resolution_x = res
    scene.render.resolution_y = res
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'

    # World soft sky ambient
    world = bpy.data.worlds.new("PreviewWorld")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.16, 0.22, 0.36, 1.0)
        bg.inputs[1].default_value = 0.95
    scene.world = world

    # 3-Point Studio Lights (+Y is Front in our Blender convention -> z_gltf = -y_blender)
    def add_sun(name, energy, color, rot_deg):
        ldata = bpy.data.lights.new(name=name, type='SUN')
        ldata.energy = energy
        ldata.color = color
        lobj = bpy.data.objects.new(name=name, object_data=ldata)
        bpy.context.collection.objects.link(lobj)
        lobj.rotation_euler = tuple(math.radians(a) for a in rot_deg)

    add_sun("KeySun", 3.6, (1.0, 0.96, 0.88), (-48, 22, 145))
    add_sun("FillSun", 1.4, (0.68, 0.84, 1.0), (-35, -30, -140))
    add_sun("RimSun", 2.4, (0.76, 0.58, 1.0), (52, 15, 25))

    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_data.lens = 48
    cam_obj = bpy.data.objects.new("PreviewCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    cam_obj.location = Vector(cam_pos)
    direction = Vector(look_at) - cam_obj.location
    cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam_obj

    scene.render.filepath = preview_png_path
    bpy.ops.render.render(write_still=True)

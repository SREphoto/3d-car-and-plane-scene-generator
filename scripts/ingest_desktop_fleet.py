#!/usr/bin/env python3
"""
Batch ingestion, stage-clutter stripping, dual-variant splitting, showcase extraction,
and Draco/WebP optimization for the Desktop/Cars fleet and 2026-F1-Nimble-Car Monaco track.

Preserves /Users/Samuel/Desktop/Cars 100% untouched (read-only).
Guarantees every exported .glb in the repository is < 80 MB, grounded at Y = 0.000,
centered horizontally at (0, 0), and oriented with Forward = -Z (Blender +Y).
"""

import os
import sys
import math
import shutil
import zipfile
import tempfile
import bpy
import bmesh
import mathutils

DESKTOP_CARS_DIR = "/Users/Samuel/Desktop/Cars"
NIMBLE_TRACKS_DIR = "/Users/Samuel/2026-F1-Nimble-Car/2026-F1-Nimble-Car/assets/models/tracks"
REPO_ROOT = "/Users/Samuel/AGapps/3D Car and Plane Scene Generator"
ASSETS_ROOT = os.path.join(REPO_ROOT, "3D Car and Plane Scene Creator")


def reset_blender():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def point_to_segment_dist_2d(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    c1 = vx * wx + vy * wy
    if c1 <= 0:
        return math.hypot(px - ax, py - ay)
    c2 = vx * vx + vy * vy
    if c2 <= c1:
        return math.hypot(px - bx, py - by)
    b = c1 / c2
    pbx, pby = ax + b * vx, ay + b * vy
    return math.hypot(px - pbx, py - pby)


def strip_materials_from_bmesh(bm, mat_list, should_strip_fn):
    """Remove faces whose assigned material matches should_strip_fn(mat_name)."""
    to_del = []
    for f in bm.faces:
        mname = ""
        if 0 <= f.material_index < len(mat_list) and mat_list[f.material_index]:
            mname = mat_list[f.material_index].name
        if should_strip_fn(mname):
            to_del.append(f)
    if to_del:
        bmesh.ops.delete(bm, geom=to_del, context='FACES')
    # Clean isolated verts/edges
    iso_edges = [e for e in bm.edges if not e.link_faces]
    if iso_edges:
        bmesh.ops.delete(bm, geom=iso_edges, context='EDGES')
    iso_verts = [v for v in bm.verts if not v.link_faces]
    if iso_verts:
        bmesh.ops.delete(bm, geom=iso_verts, context='VERTS')


def filter_bmesh_islands_by_cluster(bm, keep_cluster_fn):
    """Keep only connected vertex islands where keep_cluster_fn(centroid_vec3_blender) is True."""
    bm.verts.ensure_lookup_table()
    visited = set()
    del_verts = []
    for v in bm.verts:
        if v.index in visited:
            continue
        # BFS connected component via edges
        comp = []
        stack = [v]
        visited.add(v.index)
        while stack:
            cur = stack.pop()
            comp.append(cur)
            for e in cur.link_edges:
                nb = e.other_vert(cur)
                if nb.index not in visited:
                    visited.add(nb.index)
                    stack.append(nb)
        if not comp:
            continue
        cx = sum(p.co.x for p in comp) / len(comp)
        cy = sum(p.co.y for p in comp) / len(comp)
        cz = sum(p.co.z for p in comp) / len(comp)
        if not keep_cluster_fn((cx, cy, cz)):
            del_verts.extend(comp)
    if del_verts:
        bmesh.ops.delete(bm, geom=del_verts, context='VERTS')


def cap_images(max_dim=2048):
    for img in bpy.data.images:
        try:
            w, h = img.size[0], img.size[1]
            if w > max_dim or h > max_dim:
                scale = max_dim / float(max(w, h))
                nw = max(4, int(round(w * scale)))
                nh = max(4, int(round(h * scale)))
                img.scale(nw, nh)
        except Exception as e:
            print(f"  [warn] image scale skipped on {img.name}: {e}")


def build_clean_baked_objects(
    should_skip_obj_fn=None,
    should_strip_mat_fn=None,
    island_filter_fn=None,
):
    """
    Evaluates all visible MESH objects into world-space static meshes (removing armatures/empties/lights/cameras),
    applies optional object/material/island filters, and returns list of clean Blender MESH objects.
    """
    depsgraph = bpy.context.evaluated_depsgraph_get()
    orig_meshes = [
        o for o in list(bpy.context.scene.objects)
        if o.type == 'MESH' and not o.name.startswith('Icosphere')
    ]
    clean_col = bpy.data.collections.new("CleanExport")
    bpy.context.scene.collection.children.link(clean_col)

    created = []
    for idx, obj in enumerate(orig_meshes):
        oname = obj.name
        parent_names = []
        p = obj.parent
        while p:
            parent_names.append(p.name)
            p = p.parent
        full_obj_label = "/".join(reversed(parent_names + [oname]))
        if should_skip_obj_fn and should_skip_obj_fn(oname, full_obj_label):
            continue

        obj_eval = obj.evaluated_get(depsgraph)
        try:
            new_mesh = bpy.data.meshes.new_from_object(obj_eval)
        except Exception:
            continue
        if not new_mesh or len(new_mesh.vertices) == 0:
            if new_mesh:
                bpy.data.meshes.remove(new_mesh)
            continue

        new_mesh.transform(obj.matrix_world)
        # Ensure normal orientation stays positive if negative determinant scale existed
        if obj.matrix_world.determinant() < 0:
            new_mesh.flip_normals()

        mat_list = list(new_mesh.materials)
        if should_strip_mat_fn or island_filter_fn:
            bm = bmesh.new()
            bm.from_mesh(new_mesh)
            if should_strip_mat_fn:
                strip_materials_from_bmesh(bm, mat_list, should_strip_mat_fn)
            if island_filter_fn and len(bm.verts) > 0:
                filter_bmesh_islands_by_cluster(bm, island_filter_fn)
            if len(bm.verts) == 0 or len(bm.faces) == 0:
                bm.free()
                bpy.data.meshes.remove(new_mesh)
                continue
            bm.to_mesh(new_mesh)
            bm.free()

        new_mesh.update()
        new_obj = bpy.data.objects.new(oname, new_mesh)
        clean_col.objects.link(new_obj)
        created.append(new_obj)

    # Remove all old objects (armatures, empties, cameras, lights, raw meshes)
    keep_set = set(created)
    for o in list(bpy.data.objects):
        if o not in keep_set:
            bpy.data.objects.remove(o, do_unlink=True)

    return created


def normalize_and_orient_objects(objs, front_gltf_xz, target_size=None):
    """
    Rotates objects around Blender +Z (glTF +Y) so glTF vector (fx_g, fz_g) aligns with glTF -Z (Blender +Y),
    scales longest horizontal/overall span to target_size (if provided), centers (X, Y_bl) at (0, 0),
    and grounds min_Z_bl at 0.000000 (glTF Y = 0.000).
    """
    fx_g, fz_g = front_gltf_xz
    fx_b, fy_b = fx_g, -fz_g
    rz = math.pi / 2.0 - math.atan2(fy_b, fx_b)
    rot_mat = mathutils.Matrix.Rotation(rz, 4, 'Z')

    for o in objs:
        o.data.transform(rot_mat)
        o.data.update()

    # Compute world bounds in Blender space
    min_v = [1e18, 1e18, 1e18]
    max_v = [-1e18, -1e18, -1e18]
    for o in objs:
        for v in o.data.vertices:
            co = v.co
            if co.x < min_v[0]: min_v[0] = co.x
            if co.y < min_v[1]: min_v[1] = co.y
            if co.z < min_v[2]: min_v[2] = co.z
            if co.x > max_v[0]: max_v[0] = co.x
            if co.y > max_v[1]: max_v[1] = co.y
            if co.z > max_v[2]: max_v[2] = co.z

    span = [max_v[i] - min_v[i] for i in range(3)]
    max_span = max(span)
    scale = (target_size / max_span) if (target_size and max_span > 1e-6) else 1.0

    cx = 0.5 * (min_v[0] + max_v[0]) * scale
    cy = 0.5 * (min_v[1] + max_v[1]) * scale
    min_z = min_v[2] * scale

    S = mathutils.Matrix.Scale(scale, 4)
    T = mathutils.Matrix.Translation((-cx, -cy, -min_z))
    M = T @ S

    for o in objs:
        o.data.transform(M)
        o.data.update()

    # Final exact ground snap check
    final_min_z = min(v.co.z for o in objs for v in o.data.vertices)
    if abs(final_min_z) > 1e-6:
        Tz = mathutils.Matrix.Translation((0.0, 0.0, -final_min_z))
        for o in objs:
            o.data.transform(Tz)
            o.data.update()

    fmin = [min(v.co[i] for o in objs for v in o.data.vertices) for i in range(3)]
    fmax = [max(v.co[i] for o in objs for v in o.data.vertices) for i in range(3)]
    fspan_gltf = [round(fmax[0] - fmin[0], 3), round(fmax[2] - fmin[2], 3), round(fmax[1] - fmin[1], 3)]
    return fspan_gltf, round(fmin[2], 5)


def strip_empty_gltf_texture_refs(glb_path):
    """Removes material textureInfo slots pointing to empty 0x0 WebP texture placeholders."""
    import struct
    with open(glb_path, 'rb') as fh:
        buf = fh.read()
    magic, version, _total, j_len, j_type = struct.unpack_from('<IIIII', buf, 0)
    j = json.loads(buf[20:20 + j_len].decode('utf-8'))
    rest = buf[20 + j_len:]
    imgs = j.get('images') or []
    bad = set()
    for idx, t in enumerate(j.get('textures') or []):
        src = t.get('source')
        if src is None:
            src = (t.get('extensions') or {}).get('EXT_texture_webp', {}).get('source')
        if src is None or src >= len(imgs):
            bad.add(idx)
    if not bad:
        return

    def _clean(obj):
        if isinstance(obj, list):
            for item in obj:
                _clean(item)
        elif isinstance(obj, dict):
            for k in list(obj.keys()):
                v = obj[k]
                if isinstance(v, dict) and isinstance(v.get('index'), int) and 'texture' in k.lower():
                    if v['index'] in bad:
                        del obj[k]
                        continue
                _clean(v)

    _clean(j.get('materials') or [])
    j_bytes = json.dumps(j, separators=(',', ':')).encode('utf-8')
    pad = (4 - (len(j_bytes) % 4)) % 4
    if pad:
        j_bytes += b' ' * pad
    total_len = 20 + len(j_bytes) + len(rest)
    header = struct.pack('<IIIII', magic, version, total_len, len(j_bytes), j_type)
    with open(glb_path, 'wb') as fh:
        fh.write(header + j_bytes + rest)


def export_glb(out_path, use_webp=False, max_tex_dim=None, use_draco=False):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    if max_tex_dim:
        cap_images(max_tex_dim)
    kwargs = dict(
        filepath=out_path,
        export_format='GLB',
        export_yup=True,
        export_apply=False,
        export_cameras=False,
        export_lights=False,
        export_image_format='WEBP' if use_webp else 'AUTO',
        export_draco_mesh_compression_enable=use_draco,
    )
    if use_webp:
        kwargs['export_image_quality'] = 88
    if use_draco:
        kwargs['export_draco_mesh_compression_level'] = 6
    bpy.ops.export_scene.gltf(**kwargs)
    strip_empty_gltf_texture_refs(out_path)
    sz_mb = os.path.getsize(out_path) / (1024 * 1024)
    return sz_mb


def process_vehicle_job(job):
    reset_blender()
    src = job['src']
    out = os.path.join(ASSETS_ROOT, job['out'])
    print(f"\n>>> Processing {job['id']} -> {job['out']}")
    bpy.ops.import_scene.gltf(filepath=src)

    objs = build_clean_baked_objects(
        should_skip_obj_fn=job.get('skip_obj'),
        should_strip_mat_fn=job.get('strip_mat'),
        island_filter_fn=job.get('island_filter'),
    )
    if not objs:
        raise RuntimeError(f"Zero meshes remained for {job['id']}!")

    span_gltf, ground_y = normalize_and_orient_objects(
        objs,
        front_gltf_xz=job['front_xz'],
        target_size=job['target_size'],
    )
    sz_mb = export_glb(
        out,
        use_webp=job.get('use_webp', False),
        max_tex_dim=job.get('max_tex_dim'),
        use_draco=job.get('use_draco', False),
    )
    print(f"    OK {job['id']}: {sz_mb:.2f} MB | span(X,Y,Z)={span_gltf} | groundY={ground_y}")
    if sz_mb >= 79.5:
        raise RuntimeError(f"Asset {job['id']} exceeded 80 MB ({sz_mb:.2f} MB)!")


def extract_velvet_showroom():
    reset_blender()
    src = os.path.join(DESKTOP_CARS_DIR, "lamborghini_murcielago_vt_2001.glb")
    out = os.path.join(ASSETS_ROOT, "Locations/velvet_curtain_showroom.glb")
    print("\n>>> Extracting Velvet Curtain Collector Showroom -> Locations/velvet_curtain_showroom.glb")
    bpy.ops.import_scene.gltf(filepath=src)

    showroom_mats = {
        'ARCblackmatte', 'ARCblackplastic', 'ARClogo', 'ARCmetall',
        'Ceiling', 'Red_curtain', 'floor'
    }
    objs = build_clean_baked_objects(
        should_strip_mat_fn=lambda mname: mname not in showroom_mats
    )
    # Center horizontally and ground floor at Y=0 without rescaling (already real-world 17.8m x 17.8m x 3.04m!)
    span_gltf, ground_y = normalize_and_orient_objects(objs, front_gltf_xz=(0.0, -1.0), target_size=None)
    sz_mb = export_glb(out, use_webp=False, use_draco=False)
    print(f"    OK velvet_curtain_showroom: {sz_mb:.2f} MB | span(X,Y,Z)={span_gltf} | groundY={ground_y}")


def compress_monaco_and_copy_marina_bay():
    # 1. Monaco (89.75 MB -> Draco compressed < 35 MB, keeping exact coordinates & 337 WebP textures)
    monaco_src = os.path.join(NIMBLE_TRACKS_DIR, "monaco.glb")
    monaco_out = os.path.join(ASSETS_ROOT, "Locations/monaco_circuit.glb")
    if os.path.exists(monaco_src):
        reset_blender()
        print("\n>>> Compressing Circuit de Monaco -> Locations/monaco_circuit.glb")
        bpy.ops.import_scene.gltf(filepath=monaco_src)
        sz_mb = export_glb(monaco_out, use_webp=False, use_draco=True)
        print(f"    OK monaco_circuit.glb: {sz_mb:.2f} MB")
        if sz_mb >= 79.5:
            raise RuntimeError(f"monaco_circuit.glb exceeded 80 MB ({sz_mb:.2f} MB)!")

    # 2. Marina Bay Singapore Night Street Circuit (51.54 MB — already < 80 MB, direct byte-exact copy!)
    marina_src = os.path.join(NIMBLE_TRACKS_DIR, "marina_bay.glb")
    marina_out = os.path.join(ASSETS_ROOT, "Locations/marina_bay_circuit.glb")
    if os.path.exists(marina_src):
        print("\n>>> Copying Marina Bay Street Circuit -> Locations/marina_bay_circuit.glb")
        shutil.copy2(marina_src, marina_out)
        print(f"    OK marina_bay_circuit.glb: {os.path.getsize(marina_out)/(1024*1024):.2f} MB")


def main():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Extract Raptor R from zip to temp dir (leaving Desktop/Cars untouched)
        raptor_zip = os.path.join(DESKTOP_CARS_DIR, "2024-ford-f-150-raptor-r.zip")
        raptor_glb = os.path.join(tmpdir, "2024_ford_f-150_raptor_r.glb")
        with zipfile.ZipFile(raptor_zip, 'r') as zf:
            with open(raptor_glb, 'wb') as out_f:
                out_f.write(zf.read("source/2024_ford_f-150_raptor_r.glb"))

        # Helper centerline segments in Blender (X_b = X_g, Y_b = -Z_g) for Porsche Carrera GT split:
        # Midnight Blue CGT: glTF ctr=(-0.964, -0.912) -> Blender (-0.964, +0.912), axis_g=(-0.7122, +0.7020) -> Blender (-0.7122, -0.7020)
        cgt_blue_a = (-0.964 - 2.0 * (-0.7122), 0.912 - 2.0 * (-0.7020))
        cgt_blue_b = (-0.964 + 2.0 * (-0.7122), 0.912 + 2.0 * (-0.7020))
        # GT Silver CGT: glTF ctr=(+0.761, +1.299) -> Blender (+0.761, -1.299), axis_g=(-0.5734, +0.8193) -> Blender (-0.5734, -0.8193)
        cgt_silver_a = (0.761 - 2.0 * (-0.5734), -1.299 - 2.0 * (-0.8193))
        cgt_silver_b = (0.761 + 2.0 * (-0.5734), -1.299 + 2.0 * (-0.8193))

        def is_cgt_blue_island(co_bl):
            px, py, _ = co_bl
            d_blue = point_to_segment_dist_2d(px, py, cgt_blue_a[0], cgt_blue_a[1], cgt_blue_b[0], cgt_blue_b[1])
            d_silv = point_to_segment_dist_2d(px, py, cgt_silver_a[0], cgt_silver_a[1], cgt_silver_b[0], cgt_silver_b[1])
            return d_blue < d_silv

        def is_cgt_silver_island(co_bl):
            return not is_cgt_blue_island(co_bl)

        murcielago_showroom_mats = {
            'ARCblackmatte', 'ARCblackplastic', 'ARClogo', 'ARCmetall',
            'Ceiling', 'Red_curtain', 'floor', 'carshadow'
        }

        jobs = [
            # --- 1. In-Place Upgrade: 2026 Audi R26 F1 ---
            {
                'id': 'audi-r26-concept',
                'src': os.path.join(DESKTOP_CARS_DIR, '2026-audi-r26/source/f1_2026_r26.glb'),
                'out': 'Cars/2026-audi-r26/f1_2026_r26.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 5.60,
                'use_webp': True,
                'use_draco': True,
            },
            # --- 2. 23 New Cars / Trucks (incl. split Carrera GT x2 & EB110 SS x2) ---
            {
                'id': '1967-shelby-gt500',
                'src': os.path.join(DESKTOP_CARS_DIR, '1967_ford_mustang_shelby_cobra_gt500.glb'),
                'out': 'Cars/1967-shelby-gt500/shelby_gt500_1967.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 4.75,
            },
            {
                'id': '2010-audi-a4-allroad',
                'src': os.path.join(DESKTOP_CARS_DIR, '2010_audi_a4_allroad_b8.glb'),
                'out': 'Cars/2010-audi-a4-allroad/audi_a4_allroad_2010.glb',
                'front_xz': (11.499, -4.185),
                'target_size': 4.72,
                'use_webp': True,
                'use_draco': True,
            },
            {
                'id': '2011-audi-rs5-coupe',
                'src': os.path.join(DESKTOP_CARS_DIR, '2011_audi_rs5_coupe.glb'),
                'out': 'Cars/2011-audi-rs5-coupe/audi_rs5_coupe_2011.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 4.65,
            },
            {
                'id': '2012-dodge-charger-rt',
                'src': os.path.join(DESKTOP_CARS_DIR, '2012_dodge_charger_rt_sedan_4d.glb'),
                'out': 'Cars/2012-dodge-charger-rt/dodge_charger_rt_2012.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 5.08,
            },
            {
                'id': '2015-mclaren-650s-gt3',
                'src': os.path.join(DESKTOP_CARS_DIR, '2015_mclaren_650s_gt3.glb'),
                'out': 'Cars/2015-mclaren-650s-gt3/mclaren_650s_gt3_2015.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 4.63,
            },
            {
                'id': '2017-ferrari-j50',
                'src': os.path.join(DESKTOP_CARS_DIR, '2017_ferrari_j50.glb'),
                'out': 'Cars/2017-ferrari-j50/ferrari_j50_2017.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 4.66,
                'use_webp': True,
                'use_draco': True,
            },
            {
                'id': '2018-audi-etron-gt-concept',
                'src': os.path.join(DESKTOP_CARS_DIR, '2018_audi_e-tron_gt_concept.glb'),
                'out': 'Cars/2018-audi-etron-gt-concept/audi_etron_gt_2018.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 4.96,
            },
            {
                'id': '2021-alfa-romeo-giulia-gtam',
                'src': os.path.join(DESKTOP_CARS_DIR, '2021_alfa_romeo_giulia_gtam.glb'),
                'out': 'Cars/2021-alfa-romeo-giulia-gtam/alfa_giulia_gtam_2021.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 4.65,
            },
            {
                'id': '2024-ford-f150-raptor-r',
                'src': raptor_glb,
                'out': 'Cars/2024-ford-f150-raptor-r/ford_f150_raptor_r_2024.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 5.91,
                'use_webp': True,
                'use_draco': True,
            },
            {
                'id': '2026-bmw-m3-touring-24h',
                'src': os.path.join(DESKTOP_CARS_DIR, '2026-bmw-m3-touring-24h-shell-helix/source/bmw_m4_touring_nh_24h.glb'),
                'out': 'Cars/2026-bmw-m3-touring-24h/bmw_m3_touring_24h_2026.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 4.80,
                'use_webp': True,
                'use_draco': True,
            },
            {
                'id': 'audi-a4-b8-sedan',
                'src': os.path.join(DESKTOP_CARS_DIR, 'audi_a4_b8.glb'),
                'out': 'Cars/audi-a4-b8-sedan/audi_a4_b8.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 4.70,
                'strip_mat': lambda m: m == 'COLIDER__0',
            },
            {
                'id': '2018-bmw-m6-gt3',
                'src': os.path.join(DESKTOP_CARS_DIR, 'bmw_m6_gt3_2018.glb'),
                'out': 'Cars/2018-bmw-m6-gt3/bmw_m6_gt3_2018.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 4.98,
                'strip_mat': lambda m: m in ('floor', 'carshadow'),
            },
            {
                'id': 'bugatti-eb110-ss-blue',
                'src': os.path.join(DESKTOP_CARS_DIR, 'bugatti_eb110_ss.glb'),
                'out': 'Cars/bugatti-eb110-ss-blue/bugatti_eb110_ss_blue.glb',
                'front_xz': (0.0028, 1.0),
                'target_size': 4.38,
                'strip_mat': lambda m: m in ('floor', 'Smoke', 'material_13', 'Bugatti_gray'),
                'island_filter': lambda co_bl: co_bl[0] > 0.0,
            },
            {
                'id': 'bugatti-eb110-ss-silver',
                'src': os.path.join(DESKTOP_CARS_DIR, 'bugatti_eb110_ss.glb'),
                'out': 'Cars/bugatti-eb110-ss-silver/bugatti_eb110_ss_silver.glb',
                'front_xz': (0.0960, -0.9954),
                'target_size': 4.38,
                'strip_mat': lambda m: m in ('floor', 'Smoke', 'material_13', 'Bugatti_blue'),
                'island_filter': lambda co_bl: co_bl[0] < 0.0,
            },
            {
                'id': 'porsche-carrera-gt-concept-silver',
                'src': os.path.join(DESKTOP_CARS_DIR, 'porsche_carrera_gt_concept_2000_replica.glb'),
                'out': 'Cars/porsche-carrera-gt-concept-silver/porsche_carrera_gt_silver.glb',
                'front_xz': (0.5734, -0.8193),
                'target_size': 4.61,
                'strip_mat': lambda m: m in ('floor', 'carSHADOW', 'Porsche_Carrera_GT_Concept_2000_Replica_By_Alex_Ka'),
                'island_filter': is_cgt_silver_island,
            },
            {
                'id': 'porsche-carrera-gt-concept-blue',
                'src': os.path.join(DESKTOP_CARS_DIR, 'porsche_carrera_gt_concept_2000_replica.glb'),
                'out': 'Cars/porsche-carrera-gt-concept-blue/porsche_carrera_gt_midnight_blue.glb',
                'front_xz': (0.7122, -0.7020),
                'target_size': 4.61,
                'strip_mat': lambda m: m in ('floor', 'carSHADOW', 'Porsche_Carrera_GT_Concept_2000_Replica_By_Alex_Ka_2'),
                'island_filter': is_cgt_blue_island,
            },
            {
                'id': 'dodge-challenger-srt-hellcat',
                'src': os.path.join(DESKTOP_CARS_DIR, 'dodge-challenger-srt-hellcat/source/dodge_challenger_srt_hellcat.glb'),
                'out': 'Cars/dodge-challenger-srt-hellcat/dodge_challenger_srt_hellcat.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 5.02,
                'use_webp': True,
                'max_tex_dim': 2048,
                'use_draco': True,
            },
            {
                'id': '2026-dodge-charger-daytona-ev',
                'src': os.path.join(DESKTOP_CARS_DIR, 'dodge-charger-daytona-ev-2026/source/Dodge_Charger_Daytona_EV_2026_Sketchfab.glb'),
                'out': 'Cars/2026-dodge-charger-daytona-ev/dodge_charger_daytona_ev_2026.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 5.25,
                'skip_obj': lambda name, full: 'shadow' in name.lower() or 'reflector_box' in full.lower(),
                'strip_mat': lambda m: m == 'Shadow',
                'use_webp': True,
                'use_draco': True,
            },
            {
                'id': 'ferrari-296-gt3-verstappen',
                'src': os.path.join(DESKTOP_CARS_DIR, 'ferrari-296-gt3-verstappencom-racing/source/ferrari_296_gt3_verstappen__www_vecarz_com.glb'),
                'out': 'Cars/ferrari-296-gt3-verstappen/ferrari_296_gt3_verstappen.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 4.65,
                'use_webp': True,
                'max_tex_dim': 2048,
                'use_draco': True,
            },
            {
                'id': '2001-lamborghini-murcielago',
                'src': os.path.join(DESKTOP_CARS_DIR, 'lamborghini_murcielago_vt_2001.glb'),
                'out': 'Cars/2001-lamborghini-murcielago/lamborghini_murcielago_2001.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 4.58,
                'strip_mat': lambda m: m in murcielago_showroom_mats,
            },
            {
                'id': 'mercedes-amg-gt3-red-bull',
                'src': os.path.join(DESKTOP_CARS_DIR, 'mercedes-amg-gt3-red-bull-racing/source/mercedes_benz_amg_gt3_red_bull.glb'),
                'out': 'Cars/mercedes-amg-gt3-red-bull/mercedes_amg_gt3_red_bull.glb',
                'front_xz': (1.0, 0.0),
                'target_size': 4.75,
                'use_webp': True,
                'max_tex_dim': 2048,
                'use_draco': True,
            },
            {
                'id': 'punisher-mrap-armored',
                'src': os.path.join(DESKTOP_CARS_DIR, 'punisher_mrap_v1.glb'),
                'out': 'Cars/punisher-mrap-armored/punisher_mrap_v1.glb',
                'front_xz': (0.0, -1.0),
                'target_size': 6.20,
                'skip_obj': lambda name, full: '.col_' in full.lower(),
            },
            {
                'id': '2001-honda-s2000-suki',
                'src': os.path.join(DESKTOP_CARS_DIR, 'sukis_s2000_from_2fast_2furious.glb'),
                'out': 'Cars/2001-honda-s2000-suki/sukis_s2000_2f2f.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 4.13,
            },
            # --- 3. 4 New Aircraft / Helicopters ---
            {
                'id': 'boeing-c17-globemaster-iii',
                'src': os.path.join(DESKTOP_CARS_DIR, 'boeing_c-17b_globemaster_iii.glb'),
                'out': 'Planes/boeing-c17-globemaster-iii/boeing_c17_globemaster_iii.glb',
                'front_xz': (1.0, 0.0),
                'target_size': 32.0,
            },
            {
                'id': 'boeing-ch47-chinook',
                'src': os.path.join(DESKTOP_CARS_DIR, 'boeing_ch-47_chinook.glb'),
                'out': 'Planes/boeing-ch47-chinook/boeing_ch47_chinook.glb',
                'front_xz': (1.0, 0.0),
                'target_size': 18.5,
                'use_webp': True,
                'max_tex_dim': 2048,
                'use_draco': True,
            },
            {
                'id': 'sukhoi-su33-flanker-d',
                'src': os.path.join(DESKTOP_CARS_DIR, 'su-33_flanker-d.glb'),
                'out': 'Planes/sukhoi-su33-flanker-d/su33_flanker_d.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 21.2,
                'strip_mat': lambda m: m in ('Smoke', 'Su33shadow', 'floor'),
            },
            {
                'id': 'sukhoi-su47-berkut',
                'src': os.path.join(DESKTOP_CARS_DIR, 'su-47__berkut.glb'),
                'out': 'Planes/sukhoi-su47-berkut/su47_berkut.glb',
                'front_xz': (0.0, 1.0),
                'target_size': 22.6,
                'strip_mat': lambda m: m in ('Smoke', 'shadow', 'floor'),
            },
        ]

        for j in jobs:
            process_vehicle_job(j)

        extract_velvet_showroom()
        compress_monaco_and_copy_marina_bay()

    print("\n=== ALL FLEET, SHOWCASE, AND CIRCUIT EXPORTS COMPLETED SUCCESSFULLY ===")


if __name__ == '__main__':
    main()

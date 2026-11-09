import os
import sys
import shutil
import zipfile
import tempfile
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "3D Car and Plane Scene Creator"))

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def relink_missing_textures(search_dirs):
    """Find any image in bpy.data.images that doesn't exist at its filepath and relink from search_dirs."""
    file_map = {}
    for d in search_dirs:
        if not os.path.exists(d):
            continue
        for root, _, files in os.walk(d):
            for f in files:
                if f.lower().endswith(('.png', '.jpg', '.jpeg', '.tga', '.bmp', '.webp')):
                    file_map[f.lower()] = os.path.join(root, f)
                    stem = os.path.splitext(f.lower())[0]
                    file_map[stem] = os.path.join(root, f)

    for img in bpy.data.images:
        if img.source == 'FILE':
            raw_path = bpy.path.abspath(img.filepath)
            if not os.path.exists(raw_path):
                bname = os.path.basename(img.filepath.replace('\\', '/')).lower()
                stem = os.path.splitext(bname)[0]
                if bname in file_map:
                    img.filepath = file_map[bname]
                    img.reload()
                elif stem in file_map:
                    img.filepath = file_map[stem]
                    img.reload()

def remove_cameras_and_lights():
    for obj in list(bpy.data.objects):
        if obj.type in {'CAMERA', 'LIGHT'}:
            bpy.data.objects.remove(obj, do_unlink=True)

def export_glb(out_path):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    remove_cameras_and_lights()
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
    )
    print(f"[OK] Exported GLB -> {out_path} ({os.path.getsize(out_path) / (1024*1024):.2f} MB)")

def convert_wind_tunnel():
    blend_path = os.path.join(ROOT, "Locations", "wind-tunnel", "source", "Tunnel a vent.blend")
    tex_dir = os.path.join(ROOT, "Locations", "wind-tunnel", "textures")
    out_path = os.path.join(ROOT, "Locations", "wind-tunnel", "wind_tunnel.glb")
    if os.path.exists(out_path):
        print(f"[SKIP] {out_path} already exists")
        return
    print(f"[CONVERT] Wind Tunnel: {blend_path}")
    bpy.ops.wm.open_mainfile(filepath=blend_path)
    relink_missing_textures([tex_dir, os.path.dirname(blend_path)])
    export_glb(out_path)

def convert_bmw_m4_gt325():
    car_dir = os.path.join(ROOT, "Cars", "2025-bmw-m4-gt3-evo-g82")
    zip_path = os.path.join(car_dir, "source", "FINAL_MODEL_GT325.zip")
    out_path = os.path.join(car_dir, "source", "2025_bmw_m4_gt3_evo_g82.glb")
    if os.path.exists(out_path):
        print(f"[SKIP] {out_path} already exists")
        return
    print(f"[CONVERT] 2025 BMW M4 GT3 EVO G82: {zip_path}")
    with tempfile.TemporaryDirectory() as tmpdir:
        with zipfile.ZipFile(zip_path, 'r') as z:
            z.extractall(tmpdir)
        fbx_path = os.path.join(tmpdir, "FINAL_MODEL_GT325.fbx")
        clear_scene()
        bpy.ops.import_scene.fbx(filepath=fbx_path)
        relink_missing_textures([tmpdir, os.path.join(car_dir, "textures")])
        export_glb(out_path)

def convert_mclaren_p1():
    car_dir = os.path.join(ROOT, "Cars", "mclaren-p1-wwwvecarzcom")
    zip_path = os.path.join(car_dir, "source", "mclaren-p1.zip")
    out_path = os.path.join(car_dir, "source", "mclaren_p1.glb")
    if os.path.exists(out_path):
        print(f"[SKIP] {out_path} already exists")
        return
    print(f"[CONVERT] McLaren P1: {zip_path}")
    with tempfile.TemporaryDirectory() as tmpdir:
        with zipfile.ZipFile(zip_path, 'r') as z1:
            z1.extractall(tmpdir)
        nested1 = os.path.join(tmpdir, "source", "ac-mclaren-p1.zip")
        if os.path.exists(nested1):
            with zipfile.ZipFile(nested1, 'r') as z2:
                z2.extractall(tmpdir)
        nested2 = os.path.join(tmpdir, "source", "mclaren_p1_c4d.zip")
        if os.path.exists(nested2):
            with zipfile.ZipFile(nested2, 'r') as z3:
                z3.extractall(tmpdir)
        fbx_path = os.path.join(tmpdir, "mclaren_p1.c4d.fbx")
        clear_scene()
        bpy.ops.import_scene.fbx(filepath=fbx_path)
        relink_missing_textures([tmpdir, os.path.join(car_dir, "textures")])
        export_glb(out_path)

def convert_catwalk():
    zip_path = os.path.join(ROOT, "3d", "low-poly-catwalk.zip")
    out_path = os.path.join(ROOT, "Locations", "catwalk.glb")
    if os.path.exists(out_path):
        print(f"[SKIP] {out_path} already exists")
        return
    print(f"[CONVERT] Catwalk Hall: {zip_path}")
    with tempfile.TemporaryDirectory() as tmpdir:
        with zipfile.ZipFile(zip_path, 'r') as z1:
            z1.extractall(tmpdir)
        nested = os.path.join(tmpdir, "source", "Catwalk.zip")
        if os.path.exists(nested):
            with zipfile.ZipFile(nested, 'r') as z2:
                z2.extractall(tmpdir)
        fbx_path = os.path.join(tmpdir, "Catwalk", "Catwalk.fbx")
        clear_scene()
        bpy.ops.import_scene.fbx(filepath=fbx_path)
        relink_missing_textures([tmpdir])
        export_glb(out_path)

def convert_interior_7():
    zip_path = os.path.join(ROOT, "3d", "interior-7.zip")
    out_path = os.path.join(ROOT, "Locations", "interior_7.glb")
    if os.path.exists(out_path):
        print(f"[SKIP] {out_path} already exists")
        return
    print(f"[CONVERT] Interior 7 Hall: {zip_path}")
    with tempfile.TemporaryDirectory() as tmpdir:
        with zipfile.ZipFile(zip_path, 'r') as z1:
            z1.extractall(tmpdir)
        fbx_candidates = []
        for r, _, files in os.walk(tmpdir):
            for f in files:
                if f.lower().endswith('.fbx'):
                    fbx_candidates.append(os.path.join(r, f))
        if fbx_candidates:
            clear_scene()
            bpy.ops.import_scene.fbx(filepath=fbx_candidates[0])
            relink_missing_textures([tmpdir])
            export_glb(out_path)

if __name__ == "__main__":
    convert_wind_tunnel()
    convert_bmw_m4_gt325()
    convert_mclaren_p1()
    convert_catwalk()
    convert_interior_7()
    print("=== ALL ASSET CONVERSIONS COMPLETE ===")

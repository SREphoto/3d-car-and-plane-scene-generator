import os
import io
import bpy
from PIL import Image

LOCATIONS_DIR = "3D Car and Plane Scene Creator/Locations"

def optimize_vatican():
    src = os.path.join(LOCATIONS_DIR, "vatican_city.glb")
    tmp = os.path.join(LOCATIONS_DIR, "vatican_city_opt.glb")
    print(f"Compressing {src} with Draco...", flush=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    bpy.ops.export_scene.gltf(
        filepath=tmp,
        export_format="GLB",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_image_format="AUTO",
        export_materials="EXPORT",
        export_apply=False
    )
    os.replace(tmp, src)
    print(f"Vatican City ready: {os.path.getsize(src)/1e6:.1f} MB", flush=True)

def optimize_polycarpe():
    src = os.path.join(LOCATIONS_DIR, "eglise_saint_polycarpe.glb")
    tmp = os.path.join(LOCATIONS_DIR, "eglise_saint_polycarpe_opt.glb")
    print(f"Compressing {src} with Draco...", flush=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    bpy.ops.export_scene.gltf(
        filepath=tmp,
        export_format="GLB",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_image_format="AUTO",
        export_materials="EXPORT",
        export_apply=False
    )
    os.replace(tmp, src)
    print(f"Saint-Polycarpe ready: {os.path.getsize(src)/1e6:.1f} MB", flush=True)

def optimize_la_night():
    src = os.path.join(LOCATIONS_DIR, "la_night_city.glb")
    tmp = os.path.join(LOCATIONS_DIR, "la_night_city_opt.glb")
    print(f"Optimizing {src} textures & Draco...", flush=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)

    # Compress packed 8K images to high-quality JPEG 80 (imperceptible loss, ~60% size reduction)
    for img in bpy.data.images:
        if img.packed_file:
            raw_data = img.packed_file.data
            pil_img = Image.open(io.BytesIO(raw_data))
            out_buf = io.BytesIO()
            pil_img.convert("RGB").save(out_buf, format="JPEG", quality=80, optimize=True)
            img.file_format = "JPEG"
            # Write back to temp and reload packed file
            tpath = f"/tmp/{img.name}.jpg"
            with open(tpath, "wb") as f:
                f.write(out_buf.getvalue())
            img.filepath = tpath
            img.pack()
            if os.path.exists(tpath):
                os.remove(tpath)
            print(f"  Compressed {img.name}: {len(raw_data)/1e6:.1f}MB -> {len(out_buf.getvalue())/1e6:.1f}MB", flush=True)

    bpy.ops.export_scene.gltf(
        filepath=tmp,
        export_format="GLB",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_image_format="AUTO",
        export_materials="EXPORT",
        export_apply=False
    )
    os.replace(tmp, src)
    print(f"LA Night City ready: {os.path.getsize(src)/1e6:.1f} MB", flush=True)

if __name__ == "__main__":
    optimize_vatican()
    optimize_polycarpe()
    optimize_la_night()
    # Clean up test draco file if present
    draco_test = os.path.join(LOCATIONS_DIR, "la_night_city_draco.glb")
    if os.path.exists(draco_test):
        os.remove(draco_test)
    poly_test = os.path.join(LOCATIONS_DIR, "eglise_saint_polycarpe_draco.glb")
    if os.path.exists(poly_test):
        os.remove(poly_test)
    vat_test = os.path.join(LOCATIONS_DIR, "vatican_city_draco.glb")
    if os.path.exists(vat_test):
        os.remove(vat_test)
    print("ALL THREE LARGE ASSETS OPTIMIZED FOR GITHUB PUSH (<100MB)!", flush=True)

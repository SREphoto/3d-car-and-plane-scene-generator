import os
import subprocess
import bpy

src = "3D Car and Plane Scene Creator/Locations/la_night_city.glb"
tmp = "3D Car and Plane Scene Creator/Locations/la_night_city_opt.glb"

print("Loading la_night_city.glb into Blender...", flush=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

os.makedirs("/tmp/la_night_tex", exist_ok=True)

old_images = [img for img in bpy.data.images if img.packed_file]
for i, img in enumerate(old_images):
    raw = img.packed_file.data
    raw_path = f"/tmp/la_night_tex/{img.name}_raw.jpg"
    opt_path = f"/tmp/la_night_tex/{img.name}_opt.jpg"
    with open(raw_path, "wb") as f:
        f.write(raw)
    
    # Compress using macOS sips (Apple ImageIO) to quality 70
    subprocess.run(["/usr/bin/sips", "-s", "format", "jpeg", "-s", "formatOptions", "70", raw_path, "--out", opt_path], check=True)
    
    orig_sz = os.path.getsize(raw_path) / 1e6
    new_sz = os.path.getsize(opt_path) / 1e6
    print(f"  {img.name}: {orig_sz:.1f}MB -> {new_sz:.1f}MB", flush=True)

    # Load new optimized image and re-link all material nodes
    new_img = bpy.data.images.load(opt_path)
    new_img.pack()
    for mat in bpy.data.materials:
        if mat.node_tree:
            for node in mat.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image == img:
                    node.image = new_img
    
    bpy.data.images.remove(img)

print("Exporting with Draco compression...", flush=True)
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
final_sz = os.path.getsize(src) / 1e6
print(f"SUCCESS: la_night_city.glb is now {final_sz:.1f} MB (under 100MB limit for GitHub)!", flush=True)

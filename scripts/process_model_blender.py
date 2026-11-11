"""
scripts/process_model_blender.py
Invoked by Blender headless to import a downloaded Sketchfab model (glTF/OBJ),
bind PBR textures from textures/ folder, center and scale, ground datum at Z = 0,
and export a clean self-contained binary .glb.

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/process_model_blender.py -- <source_gltf_or_folder> <target_glb_path> <model_type> <target_size>
"""

import os
import sys
import glob
import math
import bpy
import mathutils

def process():
    argv = sys.argv
    if "--" not in argv:
        print("[-] Missing '--' argument delimiter")
        sys.exit(1)

    args = argv[argv.index("--") + 1:]
    if len(args) < 2:
        print("[-] Usage: Blender --background --python scripts/process_model_blender.py -- <source_gltf_or_dir> <target_glb> [type] [target_size]")
        sys.exit(1)

    source_path = os.path.abspath(args[0])
    target_glb = os.path.abspath(args[1])
    model_type = args[2] if len(args) > 2 else "part"
    target_size = float(args[3]) if len(args) > 3 and args[3] != "None" else None

    # Reset scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Locate source glTF/OBJ
    if os.path.isdir(source_path):
        candidates = [os.path.join(source_path, f) for f in os.listdir(source_path) if f.lower().endswith(('.gltf', '.glb', '.obj'))]
        if not candidates:
            print(f"[-] No gltf/glb/obj in directory: {source_path}")
            sys.exit(1)
        import_file = candidates[0]
        tex_dir = os.path.join(source_path, "textures")
    else:
        import_file = source_path
        tex_dir = os.path.join(os.path.dirname(source_path), "textures")

    print(f"[+] Importing: {import_file}")
    if import_file.lower().endswith((".gltf", ".glb")):
        bpy.ops.import_scene.gltf(filepath=import_file)
    elif import_file.lower().endswith(".obj"):
        bpy.ops.wm.obj_import(filepath=import_file)

    # Gather mesh objects
    mesh_objs = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    if not mesh_objs:
        print("[-] No mesh objects imported!")
        sys.exit(1)

    print(f"[+] Imported {len(mesh_objs)} mesh objects")

    # If textures directory exists and materials don't have textures, bind textures
    if os.path.isdir(tex_dir):
        # Look for texture maps
        def find_tex(pattern_list):
            for p in pattern_list:
                found = glob.glob(os.path.join(tex_dir, f"*{p}*"))
                if found:
                    return found[0]
            return None

        base_color = find_tex(["BaseColor", "basecolor", "diffuse", "Diffuse", "albedo", "Albedo", "Color", "color", "tex_body"])
        normal_map = find_tex(["Normal", "normal", "norm", "Norm"])
        metallic = find_tex(["Metallic", "metallic", "metal", "Metal"])
        roughness = find_tex(["Roughness", "roughness", "rough", "Rough"])

        # Check if existing materials lack image textures
        needs_pbr = True
        for mat in bpy.data.materials:
            if mat.use_nodes and any(n.type == 'TEX_IMAGE' for n in mat.node_tree.nodes):
                needs_pbr = False
                break

        if needs_pbr and (base_color or normal_map or metallic or roughness):
            print(f"[+] Binding detected PBR textures from {tex_dir}")
            mat = bpy.data.materials.new(name="ImportedPBRMaterial")
            mat.use_nodes = True
            nodes = mat.node_tree.nodes
            links = mat.node_tree.links
            bsdf = nodes.get("Principled BSDF")

            if base_color:
                t = nodes.new("ShaderNodeTexImage")
                t.image = bpy.data.images.load(base_color)
                links.new(t.outputs["Color"], bsdf.inputs["Base Color"])

            if normal_map:
                n = nodes.new("ShaderNodeNormalMap")
                t = nodes.new("ShaderNodeTexImage")
                t.image = bpy.data.images.load(normal_map)
                t.image.colorspace_settings.name = "Non-Color"
                links.new(t.outputs["Color"], n.inputs["Color"])
                links.new(n.outputs["Normal"], bsdf.inputs["Normal"])

            if metallic:
                t = nodes.new("ShaderNodeTexImage")
                t.image = bpy.data.images.load(metallic)
                t.image.colorspace_settings.name = "Non-Color"
                links.new(t.outputs["Color"], bsdf.inputs["Metallic"])

            if roughness:
                t = nodes.new("ShaderNodeTexImage")
                t.image = bpy.data.images.load(roughness)
                t.image.colorspace_settings.name = "Non-Color"
                links.new(t.outputs["Color"], bsdf.inputs["Roughness"])

            for obj in mesh_objs:
                if len(obj.data.materials) == 0:
                    obj.data.materials.append(mat)
                else:
                    for i in range(len(obj.data.materials)):
                        if obj.data.materials[i] is None:
                            obj.data.materials[i] = mat

    # Calculate bounding box in world space
    bpy.context.view_layer.update()
    min_x = min_y = min_z = float('inf')
    max_x = max_y = max_z = float('-inf')

    for obj in mesh_objs:
        for corner in obj.bound_box:
            world_pos = obj.matrix_world @ mathutils.Vector(corner)
            min_x = min(min_x, world_pos.x)
            max_x = max(max_x, world_pos.x)
            min_y = min(min_y, world_pos.y)
            max_y = max(max_y, world_pos.y)
            min_z = min(min_z, world_pos.z)
            max_z = max(max_z, world_pos.z)

    cur_dx = max_x - min_x
    cur_dy = max_y - min_y
    cur_dz = max_z - min_z
    max_span = max(cur_dx, cur_dy, cur_dz)
    print(f"[+] Current dimensions: dx={cur_dx:.2f}, dy={cur_dy:.2f}, dz={cur_dz:.2f}, max_span={max_span:.2f}")

    # Scale to target size if requested
    scale_factor = 1.0
    if target_size and max_span > 0:
        scale_factor = target_size / max_span
        print(f"[+] Applying scale factor {scale_factor:.4f} to achieve targetSize {target_size:.2f}m")

    # Center horizontally and ground at Z = 0
    center_x = (min_x + max_x) / 2.0
    center_y = (min_y + max_y) / 2.0
    floor_z = min_z

    for obj in bpy.data.objects:
        if obj.parent is None:
            obj.location.x -= center_x
            obj.location.y -= center_y
            obj.location.z -= floor_z
            obj.scale *= scale_factor

    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='SELECT')
    if mesh_objs:
        bpy.context.view_layer.objects.active = mesh_objs[0]
        bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)

    # Create target directory
    os.makedirs(os.path.dirname(target_glb), exist_ok=True)

    # Export GLB
    print(f"[+] Exporting to GLB: {target_glb}")
    bpy.ops.export_scene.gltf(filepath=target_glb, export_format='GLB')
    size_mb = os.path.getsize(target_glb) / (1024 * 1024)
    print(f"[✓] Successfully exported {target_glb} ({size_mb:.2f} MB)")

if __name__ == "__main__":
    process()

"""
scripts/convert_locations.py
Headless conversion and procedural generation script for Milestone 1 Environment Locations.
Converts or builds 10 self-contained binary .glb location containers with embedded PBR materials,
centered staging areas, and normalized floor datums (ground level Y = 0.000).

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/convert_locations.py
"""

import os
import sys
import math
import zipfile
import tempfile
import bpy
import mathutils

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS_ROOT = os.path.join(REPO_ROOT, "3D Car and Plane Scene Creator", "Locations")
STAGING_DIR = os.path.join(REPO_ROOT, "tmp", "sketchfab_zips", "locations")

LOCATION_MODELS = [
    {"id": "underground_garage", "uid": "6380fc0dcb814a22b8ecf0fd33b151b5", "title": "Underground garage door", "targetSpan": 30.0, "category": "garages"},
    {"id": "desert_workshop_garage", "uid": "ef8bb81713814d688487a81ae2467a51", "title": "Car Garage | Desert Garage Environment", "targetSpan": 32.0, "category": "garages"},
    {"id": "cyberpunk_garage", "uid": "d4be52b3be4a49a699dd22886bc4c801", "title": "Spatial_ Garage/Garaje Espacial", "targetSpan": 28.0, "category": "garages"},
    {"id": "detailed_parking_garage", "uid": "84e1b7b134d14b438cf3ff9655f4625b", "title": "Detailed Parking Garage", "targetSpan": 35.0, "category": "garages"},
    {"id": "city_street_asphalt", "uid": "d9df5cfa079f4da8a18ef1372c00d01c", "title": "Modular City Road Pack", "targetSpan": 50.0, "category": "streets"},
    {"id": "cyberpunk_night_street", "uid": "98b48acc4bb549e0b9cd32317805b992", "title": "Cyberpunk Night Scene", "targetSpan": 45.0, "category": "streets"},
    {"id": "car_showroom_dealership", "uid": "71626d177d04404d84593f8ae5e27ba6", "title": "Car Showroom", "targetSpan": 30.0, "category": "showcases"},
    {"id": "architectural_exhibition_hall", "uid": "4e47944b4b6b4ef4913e3352b31a781d", "title": "Exhibition Hall", "targetSpan": 34.0, "category": "showcases"},
    {"id": "car_studio_cyclorama", "uid": "c59d07c5a49341fcad85cc47afa1996d", "title": "Studio Scan with Cyclorama", "targetSpan": 28.0, "category": "showcases"},
    {"id": "vehicle_display_podium", "uid": "615ed0481a5a4a1f97fd62d0b14e0d41", "title": "Car Display Platform Podium", "targetSpan": 28.0, "category": "showcases"},
]

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def strip_unwanted_entities():
    for obj in list(bpy.data.objects):
        if obj.type in {'CAMERA', 'LIGHT'}:
            bpy.data.objects.remove(obj, do_unlink=True)

def relink_and_pack_textures(search_root):
    image_map = {}
    for root, _, files in os.walk(search_root):
        for f in files:
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.tga', '.bmp')):
                image_map[f.lower()] = os.path.join(root, f)
                stem = os.path.splitext(f.lower())[0]
                image_map[stem] = os.path.join(root, f)

    for img in bpy.data.images:
        if img.source == 'FILE':
            raw_path = bpy.path.abspath(img.filepath)
            if not os.path.exists(raw_path):
                base = os.path.basename(img.filepath.replace('\\', '/')).lower()
                stem = os.path.splitext(base)[0]
                if base in image_map:
                    img.filepath = image_map[base]
                    img.reload()
                elif stem in image_map:
                    img.filepath = image_map[stem]
                    img.reload()
        try:
            img.pack()
        except Exception:
            pass

def normalize_floor_and_center():
    mesh_objs = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    if not mesh_objs:
        return

    # 1. Update dependency graph before evaluating bounds
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

    center_x = (min_x + max_x) / 2.0
    center_y = (min_y + max_y) / 2.0
    floor_z = min_z

    for obj in bpy.data.objects:
        if obj.parent is None:
            obj.location.x -= center_x
            obj.location.y -= center_y
            obj.location.z -= floor_z

    # 2. Update view layer before applying transforms
    bpy.context.view_layer.update()

    bpy.ops.object.select_all(action='SELECT')
    if mesh_objs:
        bpy.context.view_layer.objects.active = mesh_objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.context.view_layer.update()

    # 3. Defensive assertion verifying ground datum contact
    final_min_z = min(
        (obj.matrix_world @ mathutils.Vector(corner)).z
        for obj in mesh_objs
        for corner in obj.bound_box
    )
    assert abs(final_min_z) < 1e-4, f"Location ground datum failed: final_min_z = {final_min_z}"

def create_pbr_material(name, color_rgba, metallic=0.0, roughness=0.5, emission=None):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color_rgba
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if emission:
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = emission
                bsdf.inputs["Emission Strength"].default_value = 3.0
            elif "Emission" in bsdf.inputs:
                bsdf.inputs["Emission"].default_value = emission
    return mat

def build_procedural_location(loc_meta):
    loc_id = loc_meta["id"]
    reset_scene()

    mat_concrete = create_pbr_material(f"{loc_id}_concrete", (0.35, 0.36, 0.38, 1.0), metallic=0.05, roughness=0.85)
    mat_asphalt = create_pbr_material(f"{loc_id}_asphalt", (0.12, 0.12, 0.13, 1.0), metallic=0.05, roughness=0.90)
    mat_wet_asphalt = create_pbr_material(f"{loc_id}_wet_asphalt", (0.05, 0.05, 0.06, 1.0), metallic=0.3, roughness=0.15)
    mat_white_tile = create_pbr_material(f"{loc_id}_tile", (0.92, 0.92, 0.95, 1.0), metallic=0.1, roughness=0.15)
    mat_epoxy = create_pbr_material(f"{loc_id}_epoxy", (0.08, 0.09, 0.11, 1.0), metallic=0.2, roughness=0.20)
    mat_metal = create_pbr_material(f"{loc_id}_metal", (0.75, 0.78, 0.80, 1.0), metallic=0.9, roughness=0.30)
    mat_dark_metal = create_pbr_material(f"{loc_id}_dark_metal", (0.15, 0.16, 0.18, 1.0), metallic=0.85, roughness=0.40)
    mat_wood = create_pbr_material(f"{loc_id}_wood", (0.45, 0.28, 0.15, 1.0), metallic=0.0, roughness=0.75)
    mat_yellow_stripe = create_pbr_material(f"{loc_id}_yellow", (0.95, 0.75, 0.05, 1.0), metallic=0.0, roughness=0.50)
    mat_white_stripe = create_pbr_material(f"{loc_id}_white_paint", (0.90, 0.90, 0.90, 1.0), metallic=0.0, roughness=0.50)
    mat_neon_cyan = create_pbr_material(f"{loc_id}_neon_cyan", (0.1, 0.8, 1.0, 1.0), metallic=0.0, roughness=0.1, emission=(0.1, 0.8, 1.0, 1.0))
    mat_neon_pink = create_pbr_material(f"{loc_id}_neon_pink", (1.0, 0.1, 0.7, 1.0), metallic=0.0, roughness=0.1, emission=(1.0, 0.1, 0.7, 1.0))
    mat_warm_light = create_pbr_material(f"{loc_id}_warm_light", (1.0, 0.9, 0.7, 1.0), metallic=0.0, roughness=0.1, emission=(1.0, 0.9, 0.7, 1.0))
    mat_red_sprinkler = create_pbr_material(f"{loc_id}_red_sprinkler", (0.85, 0.1, 0.1, 1.0), metallic=0.5, roughness=0.3)
    mat_glass = create_pbr_material(f"{loc_id}_glass", (0.8, 0.9, 0.95, 0.3), metallic=0.1, roughness=0.05)

    if loc_id == "underground_garage":
        # 1. Thin concrete floor slab (0.04m height, bottom at Z=0.00)
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.02))
        floor = bpy.context.active_object
        floor.scale = (30.0, 24.0, 0.04)
        floor.data.materials.append(mat_concrete)

        # Parking stall lines
        for px in [-10.0, -5.0, 5.0, 10.0]:
            for py in [-7.0, 7.0]:
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(px, py, 0.042))
                stripe = bpy.context.active_object
                stripe.scale = (0.12, 5.0, 0.004)
                stripe.data.materials.append(mat_white_stripe)

        # 4 Heavy concrete support columns with hazard chevrons and safety bollards
        for cx in [-8.0, 8.0]:
            for cy in [-6.0, 6.0]:
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cx, cy, 2.54))
                col = bpy.context.active_object
                col.scale = (0.9, 0.9, 5.0)
                col.data.materials.append(mat_concrete)

                # Yellow hazard base
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cx, cy, 0.44))
                base = bpy.context.active_object
                base.scale = (0.96, 0.96, 0.8)
                base.data.materials.append(mat_yellow_stripe)

                # Corner steel safety bollards
                for bx, by in [(-0.65, -0.65), (0.65, -0.65), (-0.65, 0.65), (0.65, 0.65)]:
                    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.8, location=(cx + bx, cy + by, 0.44))
                    bollard = bpy.context.active_object
                    bollard.data.materials.append(mat_yellow_stripe)

        # Concrete back wall & heavy rolling shutter door
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 11.8, 2.54))
        back_wall = bpy.context.active_object
        back_wall.scale = (30.0, 0.4, 5.0)
        back_wall.data.materials.append(mat_concrete)

        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 11.5, 1.84))
        door = bpy.context.active_object
        door.scale = (6.0, 0.2, 3.6)
        door.data.materials.append(mat_dark_metal)

        # Electric motor box for shutter
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(3.4, 11.5, 3.7))
        motor = bpy.context.active_object
        motor.scale = (0.4, 0.3, 0.5)
        motor.data.materials.append(mat_metal)

        # Concrete ceiling slab
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 5.14))
        ceiling = bpy.context.active_object
        ceiling.scale = (30.0, 24.0, 0.20)
        ceiling.data.materials.append(mat_concrete)

        # 4 Transverse structural steel I-beams
        for by in [-9.0, -3.0, 3.0, 9.0]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, by, 4.9))
            ibeam = bpy.context.active_object
            ibeam.scale = (29.5, 0.35, 0.3)
            ibeam.data.materials.append(mat_dark_metal)

        # Dual galvanized metal HVAC ducts with ceiling hangers
        for dy in [-4.0, 4.0]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, dy, 4.5))
            duct = bpy.context.active_object
            duct.scale = (28.0, 0.8, 0.45)
            duct.data.materials.append(mat_metal)

            for hx in [-10.0, 0.0, 10.0]:
                bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=0.5, location=(hx, dy, 4.8))
                hanger = bpy.context.active_object
                hanger.data.materials.append(mat_metal)

        # Red fire sprinkler pipe run
        bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=28.0, location=(0, 0, 4.65))
        sprinkler = bpy.context.active_object
        sprinkler.rotation_euler = (0, math.radians(90), 0)
        sprinkler.data.materials.append(mat_red_sprinkler)

        # 8 Suspended fluorescent troffers
        for lx in [-8.0, -2.5, 2.5, 8.0]:
            for ly in [-5.0, 5.0]:
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(lx, ly, 4.85))
                light = bpy.context.active_object
                light.scale = (0.25, 2.8, 0.08)
                light.data.materials.append(mat_warm_light)

    elif loc_id == "desert_workshop_garage":
        # 1. Weathered concrete floor slab
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.02))
        floor = bpy.context.active_object
        floor.scale = (32.0, 24.0, 0.04)
        floor.data.materials.append(mat_concrete)

        # Side and back corrugated steel walls
        for side, sx in [(-1, -15.8), (1, 15.8)]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx, 0, 3.02))
            wall = bpy.context.active_object
            wall.scale = (0.4, 24.0, 6.0)
            wall.data.materials.append(mat_dark_metal)

        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 11.8, 3.02))
        back = bpy.context.active_object
        back.scale = (32.0, 0.4, 6.0)
        back.data.materials.append(mat_dark_metal)

        # Heavy timber post & roof trusses with gusset plates
        for ty in [-8.0, -2.0, 4.0, 10.0]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, ty, 5.8))
            truss = bpy.context.active_object
            truss.scale = (31.0, 0.35, 0.4)
            truss.data.materials.append(mat_wood)

            # Diagonal knee braces
            for kx, kdir in [(-13.0, 1), (13.0, -1)]:
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(kx, ty, 5.0))
                brace = bpy.context.active_object
                brace.scale = (1.5, 0.25, 0.25)
                brace.rotation_euler = (0, math.radians(45 * kdir), 0)
                brace.data.materials.append(mat_wood)

        # Heavy maple-top mechanic workbench with shelf & vise
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 10.5, 0.52))
        bench = bpy.context.active_object
        bench.scale = (12.0, 1.2, 1.0)
        bench.data.materials.append(mat_wood)

        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(4.5, 10.5, 1.15))
        vise = bpy.context.active_object
        vise.scale = (0.35, 0.25, 0.3)
        vise.data.materials.append(mat_dark_metal)

        # Red multi-drawer tool chests
        for bx in [-8.0, 8.0]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(bx, 10.5, 0.64))
            cab = bpy.context.active_object
            cab.scale = (1.8, 0.8, 1.2)
            cab.data.materials.append(mat_yellow_stripe)

        # 55-gallon steel oil drums
        for ox in [-12.0, -13.0]:
            bpy.ops.mesh.primitive_cylinder_add(radius=0.32, depth=0.9, location=(ox, 9.0, 0.49))
            drum = bpy.context.active_object
            drum.data.materials.append(mat_dark_metal)

        # 4 Suspended vintage enamel barn pendant lamps
        for lx in [-6.0, 6.0]:
            for ly in [-4.0, 4.0]:
                bpy.ops.mesh.primitive_cylinder_add(radius=0.35, depth=0.2, location=(lx, ly, 5.2))
                lamp = bpy.context.active_object
                lamp.data.materials.append(mat_dark_metal)

                bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12, location=(lx, ly, 5.05))
                bulb = bpy.context.active_object
                bulb.data.materials.append(mat_warm_light)

    elif loc_id == "cyberpunk_garage":
        # 1. Mirror-gloss epoxy floor slab
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.02))
        floor = bpy.context.active_object
        floor.scale = (28.0, 24.0, 0.04)
        floor.data.materials.append(mat_epoxy)

        # Acoustic walls with recessed neon light channels
        for side, sx in [(-1, -13.8), (1, 13.8)]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx, 0, 3.02))
            wall = bpy.context.active_object
            wall.scale = (0.4, 24.0, 6.0)
            wall.data.materials.append(mat_dark_metal)

            for ny in [-8.0, -3.0, 3.0, 8.0]:
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx + (side * -0.22), ny, 3.02))
                neon = bpy.context.active_object
                neon.scale = (0.05, 0.15, 4.0)
                neon.data.materials.append(mat_neon_cyan if ny > 0 else mat_neon_pink)

        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 11.8, 3.02))
        back = bpy.context.active_object
        back.scale = (28.0, 0.4, 6.0)
        back.data.materials.append(mat_dark_metal)

        # Holographic ultrawide diagnostic monitor
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 11.5, 3.2))
        screen = bpy.context.active_object
        screen.scale = (8.0, 0.1, 2.5)
        screen.data.materials.append(mat_neon_cyan)

        # Server rack towers
        for rx in [-10.5, 10.5]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(rx, 9.5, 1.24))
            rack = bpy.context.active_object
            rack.scale = (1.2, 0.9, 2.4)
            rack.data.materials.append(mat_dark_metal)

        # Ceiling slab & hexagonal honeycomb luminaires
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 6.02))
        ceil = bpy.context.active_object
        ceil.scale = (28.0, 24.0, 0.2)
        ceil.data.materials.append(mat_dark_metal)

        for hx in [-6.0, 0.0, 6.0]:
            for hy in [-5.0, 5.0]:
                bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=2.2, depth=0.08, location=(hx, hy, 5.85))
                hex_light = bpy.context.active_object
                hex_light.data.materials.append(mat_neon_cyan)

    elif loc_id == "detailed_parking_garage":
        # 1. Troweled concrete floor slab
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.02))
        floor = bpy.context.active_object
        floor.scale = (35.0, 26.0, 0.04)
        floor.data.materials.append(mat_concrete)

        # Parking bays
        for px in [-12.0, -8.0, -4.0, 4.0, 8.0, 12.0]:
            for py in [-7.0, 7.0]:
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(px, py, 0.043))
                stripe = bpy.context.active_object
                stripe.scale = (0.15, 5.0, 0.005)
                stripe.data.materials.append(mat_white_stripe)

        # Drive lanes
        for dy in [-1.5, 1.5]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, dy, 0.043))
            lane = bpy.context.active_object
            lane.scale = (32.0, 0.12, 0.005)
            lane.data.materials.append(mat_yellow_stripe)

        # Rubber speed bumps with yellow chevrons
        for bx in [-6.0, 6.0]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(bx, 0, 0.065))
            bump = bpy.context.active_object
            bump.scale = (0.35, 6.0, 0.05)
            bump.data.materials.append(mat_yellow_stripe)

        # Cylindrical support pillars with bumper wraps
        for cx in [-10.0, 0.0, 10.0]:
            for cy in [-5.0, 5.0]:
                bpy.ops.mesh.primitive_cylinder_add(radius=0.45, depth=5.0, location=(cx, cy, 2.54))
                col = bpy.context.active_object
                col.data.materials.append(mat_concrete)

                bpy.ops.mesh.primitive_cylinder_add(radius=0.52, depth=1.0, location=(cx, cy, 0.54))
                guard = bpy.context.active_object
                guard.data.materials.append(mat_yellow_stripe)

        # Waffle coffer ceiling slab & integrated LEDs
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 5.14))
        ceil = bpy.context.active_object
        ceil.scale = (35.0, 26.0, 0.20)
        ceil.data.materials.append(mat_concrete)

        for lx in [-8.0, 0.0, 8.0]:
            for ly in [-3.0, 3.0]:
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(lx, ly, 4.95))
                led = bpy.context.active_object
                led.scale = (0.3, 4.0, 0.08)
                led.data.materials.append(mat_warm_light)

        # Overhead directional signage
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 4.4))
        sign = bpy.context.active_object
        sign.scale = (2.4, 0.1, 0.6)
        sign.data.materials.append(mat_neon_cyan)

    elif loc_id == "city_street_asphalt":
        # 1. Fine-aggregate asphalt roadway slab
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.02))
        road = bpy.context.active_object
        road.scale = (50.0, 10.0, 0.04)
        road.data.materials.append(mat_asphalt)

        # Dual yellow center divider
        for cy in [-0.15, 0.15]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, cy, 0.043))
            c_line = bpy.context.active_object
            c_line.scale = (50.0, 0.12, 0.005)
            c_line.data.materials.append(mat_yellow_stripe)

        # Dashed white lane lines
        for sx in range(-20, 24, 6):
            for ly in [-2.5, 2.5]:
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx, ly, 0.043))
                stripe = bpy.context.active_object
                stripe.scale = (3.5, 0.15, 0.005)
                stripe.data.materials.append(mat_white_stripe)

        # Storm drain grates along gutters
        for gx in [-12.0, 0.0, 12.0]:
            for gy in [-4.5, 4.5]:
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(gx, gy, 0.043))
                grate = bpy.context.active_object
                grate.scale = (1.2, 0.6, 0.005)
                grate.data.materials.append(mat_dark_metal)

        # Sidewalks, curbs, streetlights
        for side, sy in [(-1, -6.6), (1, 6.6)]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, sy, 0.10))
            walk = bpy.context.active_object
            walk.scale = (50.0, 3.2, 0.16)
            walk.data.materials.append(mat_concrete)

            # Curved cobra-head streetlights
            for lx in [-16.0, 0.0, 16.0]:
                bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=5.5, location=(lx, sy + (side * 0.8), 2.85))
                pole = bpy.context.active_object
                pole.data.materials.append(mat_dark_metal)

                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(lx, sy + (side * 0.2), 5.6))
                lamp = bpy.context.active_object
                lamp.scale = (0.35, 0.9, 0.15)
                lamp.data.materials.append(mat_warm_light)

        # Red municipal fire hydrant
        bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=0.75, location=(8.0, 6.0, 0.55))
        hydrant = bpy.context.active_object
        hydrant.data.materials.append(mat_red_sprinkler)

        # Modular concrete Jersey crash barriers
        for jx in [-18.0, -14.0, 14.0, 18.0]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(jx, -4.8, 0.45))
            barrier = bpy.context.active_object
            barrier.scale = (3.2, 0.45, 0.8)
            barrier.data.materials.append(mat_concrete)

    elif loc_id == "cyberpunk_night_street":
        # 1. Wet-look asphalt road slab
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.02))
        road = bpy.context.active_object
        road.scale = (45.0, 12.0, 0.04)
        road.data.materials.append(mat_wet_asphalt)

        # Glowing LED cat's-eye road studs
        for rx in range(-20, 22, 4):
            bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.03, location=(rx, 0, 0.05))
            stud = bpy.context.active_object
            stud.data.materials.append(mat_neon_cyan)

        # Neon-flanked dark curbs
        for side, sy in [(-1, -6.2), (1, 6.2)]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, sy, 0.10))
            curb = bpy.context.active_object
            curb.scale = (45.0, 0.4, 0.16)
            curb.data.materials.append(mat_dark_metal)

            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, sy + (side * -0.22), 0.10))
            neon = bpy.context.active_object
            neon.scale = (45.0, 0.05, 0.08)
            neon.data.materials.append(mat_neon_cyan if side == -1 else mat_neon_pink)

            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, sy + (side * 1.5), 0.10))
            walk = bpy.context.active_object
            walk.scale = (45.0, 2.6, 0.16)
            walk.data.materials.append(mat_epoxy)

            # Holographic billboard pylons
            for bx in [-12.0, 12.0]:
                bpy.ops.mesh.primitive_cylinder_add(radius=0.1, depth=5.0, location=(bx, sy + (side * 2.2), 2.5))
                pylon = bpy.context.active_object
                pylon.data.materials.append(mat_dark_metal)

                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(bx, sy + (side * 2.2), 3.8))
                billboard = bpy.context.active_object
                billboard.scale = (4.0, 0.15, 2.5)
                billboard.data.materials.append(mat_neon_pink if side == -1 else mat_neon_cyan)

        # Overhead traffic surveillance gantry
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 6.2))
        gantry = bpy.context.active_object
        gantry.scale = (0.8, 14.0, 0.6)
        gantry.data.materials.append(mat_dark_metal)

    elif loc_id == "car_showroom_dealership":
        # 1. Polished white porcelain tile floor slab
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.02))
        floor = bpy.context.active_object
        floor.scale = (30.0, 24.0, 0.04)
        floor.data.materials.append(mat_white_tile)

        # Glass curtain walls with aluminum mullions
        for side, sx in [(-1, -14.8), (1, 14.8)]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx, 0, 3.02))
            glass = bpy.context.active_object
            glass.scale = (0.1, 24.0, 6.0)
            glass.data.materials.append(mat_glass)

        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -11.8, 3.02))
        front_glass = bpy.context.active_object
        front_glass.scale = (30.0, 0.1, 6.0)
        front_glass.data.materials.append(mat_glass)

        # Architectural walnut wood accent feature wall behind showcase
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 11.8, 3.02))
        back = bpy.context.active_object
        back.scale = (30.0, 0.4, 6.0)
        back.data.materials.append(mat_wood)

        # Acoustic ceiling slab with 16 gimbal spotlights
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 6.02))
        ceil = bpy.context.active_object
        ceil.scale = (30.0, 24.0, 0.20)
        ceil.data.materials.append(mat_white_tile)

        for sx in [-8.0, -2.5, 2.5, 8.0]:
            for sy in [-6.0, -2.0, 2.0, 6.0]:
                bpy.ops.mesh.primitive_cylinder_add(radius=0.4, depth=0.06, location=(sx, sy, 5.9))
                spot = bpy.context.active_object
                spot.data.materials.append(mat_warm_light)

        # Minimalist reception desk pod
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-8.0, 8.0, 0.52))
        desk = bpy.context.active_object
        desk.scale = (4.0, 1.2, 0.95)
        desk.data.materials.append(mat_white_tile)

        # Stanchion posts
        for px, py in [(-4.0, -4.0), (4.0, -4.0), (-4.0, 4.0), (4.0, 4.0)]:
            bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=0.9, location=(px, py, 0.49))
            stanchion = bpy.context.active_object
            stanchion.data.materials.append(mat_metal)

    elif loc_id == "architectural_exhibition_hall":
        # 1. Honed terrazzo floor slab
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.02))
        floor = bpy.context.active_object
        floor.scale = (34.0, 26.0, 0.04)
        floor.data.materials.append(mat_concrete)

        # 4 Monumental parabolic arches with cross-ties
        for ay in [-9.0, -3.0, 3.0, 9.0]:
            bpy.ops.mesh.primitive_torus_add(major_radius=13.0, minor_radius=0.45, location=(0, ay, 4.0))
            arch = bpy.context.active_object
            arch.scale = (1.2, 0.3, 0.7)
            arch.data.materials.append(mat_white_stripe)

            # Arch uplight wells
            for ux in [-12.0, 12.0]:
                bpy.ops.mesh.primitive_cylinder_add(radius=0.3, depth=0.06, location=(ux, ay, 0.05))
                uplight = bpy.context.active_object
                uplight.data.materials.append(mat_warm_light)

        # Floating mezzanine balcony with frameless glass balustrade
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 10.5, 3.02))
        mezz = bpy.context.active_object
        mezz.scale = (34.0, 4.0, 0.3)
        mezz.data.materials.append(mat_concrete)

        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 8.5, 3.65))
        railing = bpy.context.active_object
        railing.scale = (34.0, 0.05, 0.9)
        railing.data.materials.append(mat_glass)

        # Apex skylight frame
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 8.5))
        skylight = bpy.context.active_object
        skylight.scale = (10.0, 24.0, 0.15)
        skylight.data.materials.append(mat_glass)

    elif loc_id == "car_studio_cyclorama":
        # 1. Satin white infinity cyclorama floor slab
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -2.0, 0.02))
        floor = bpy.context.active_object
        floor.scale = (28.0, 18.0, 0.04)
        floor.data.materials.append(mat_white_tile)

        # Smooth curved cyclorama cove radius fillet
        bpy.ops.mesh.primitive_cylinder_add(radius=3.0, depth=28.0, location=(0, 7.0, 3.02))
        cove = bpy.context.active_object
        cove.rotation_euler = (0, math.radians(90), 0)
        cove.scale = (1.0, 1.0, 1.0)
        cove.data.materials.append(mat_white_tile)

        # Vertical seamless back wall
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 10.0, 6.02))
        back_wall = bpy.context.active_object
        back_wall.scale = (28.0, 0.3, 6.0)
        back_wall.data.materials.append(mat_white_tile)

        # Massive overhead suspended softbox bank with black baffles
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 7.5))
        softbox = bpy.context.active_object
        softbox.scale = (14.0, 7.0, 0.25)
        softbox.data.materials.append(mat_warm_light)

        # Dual vertical stripbanks
        for side, sx in [(-1, -11.0), (1, 11.0)]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx, 0, 3.5))
            strip = bpy.context.active_object
            strip.scale = (0.35, 0.3, 5.0)
            strip.data.materials.append(mat_warm_light)

    elif loc_id == "vehicle_display_podium":
        # 1. Dark epoxy floor base slab
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.02))
        floor = bpy.context.active_object
        floor.scale = (28.0, 28.0, 0.04)
        floor.data.materials.append(mat_epoxy)

        # Elevated 8m diameter circular turntable
        bpy.ops.mesh.primitive_cylinder_add(radius=4.0, depth=0.16, location=(0, 0, 0.12))
        podium = bpy.context.active_object
        podium.data.materials.append(mat_dark_metal)

        # Titanium beveled perimeter edge
        bpy.ops.mesh.primitive_torus_add(major_radius=4.0, minor_radius=0.03, location=(0, 0, 0.20))
        edge = bpy.context.active_object
        edge.data.materials.append(mat_metal)

        # Concentric recessed cyan halo under-glow ring
        bpy.ops.mesh.primitive_torus_add(major_radius=4.15, minor_radius=0.03, location=(0, 0, 0.06))
        ring = bpy.context.active_object
        ring.data.materials.append(mat_neon_cyan)

        # Overhead 10m diameter circular box-truss rig
        bpy.ops.mesh.primitive_torus_add(major_radius=5.0, minor_radius=0.12, location=(0, 0, 6.5))
        truss = bpy.context.active_object
        truss.data.materials.append(mat_metal)

        # 4 Diagonal steel rigging cables
        for i in range(4):
            ang = i * (math.pi / 2) + math.pi / 4
            bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=2.0, location=(math.cos(ang)*3.5, math.sin(ang)*3.5, 7.5))
            cable = bpy.context.active_object
            cable.data.materials.append(mat_metal)

        # 12 Motorized moving-head spotlights clamped around the truss rig
        for i in range(12):
            angle = i * (2 * math.pi / 12)
            bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=0.45, location=(math.cos(angle)*5.0, math.sin(angle)*5.0, 6.2))
            spot = bpy.context.active_object
            spot.rotation_euler = (math.sin(angle)*0.35, -math.cos(angle)*0.35, 0)
            spot.data.materials.append(mat_warm_light)

    else:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.02))
        floor = bpy.context.active_object
        floor.scale = (loc_meta["targetSpan"], loc_meta["targetSpan"], 0.04)
        floor.data.materials.append(mat_concrete)

    normalize_floor_and_center()

def export_glb_file(out_path):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False
    )
    sz = os.path.getsize(out_path)
    print(f"[OK] Exported GLB -> {out_path} ({sz / 1024:.1f} KB)")

def main():
    print("=== STARTING MILESTONE 1 ENVIRONMENT LOCATIONS CONVERSION (10 LOCATIONS) ===")
    os.makedirs(ASSETS_ROOT, exist_ok=True)

    for meta in LOCATION_MODELS:
        loc_id = meta["id"]
        out_glb = os.path.join(ASSETS_ROOT, f"{loc_id}.glb")
        zip_path = os.path.join(STAGING_DIR, f"{loc_id}.zip")

        if os.path.exists(zip_path):
            print(f"[CONVERT] Found staging archive for {loc_id}: {zip_path}")
            with tempfile.TemporaryDirectory() as tmpdir:
                with zipfile.ZipFile(zip_path, 'r') as zf:
                    zf.extractall(tmpdir)
                candidates = []
                for root, _, files in os.walk(tmpdir):
                    for f in files:
                        if f.lower().endswith(('.gltf', '.glb', '.fbx', '.obj')):
                            candidates.append(os.path.join(root, f))
                if candidates:
                    reset_scene()
                    c = candidates[0]
                    if c.lower().endswith('.fbx'):
                        bpy.ops.import_scene.fbx(filepath=c)
                    elif c.lower().endswith(('.gltf', '.glb')):
                        bpy.ops.import_scene.gltf(filepath=c)
                    elif c.lower().endswith('.obj'):
                        bpy.ops.wm.obj_import(filepath=c)
                    relink_and_pack_textures(tmpdir)
                    strip_unwanted_entities()
                    normalize_floor_and_center()
                    export_glb_file(out_glb)
                    continue

        print(f"[GENERATE] Building procedural PBR location for {loc_id} ({meta['title']})...")
        build_procedural_location(meta)
        export_glb_file(out_glb)

    print("\n=== VERIFYING 10/10 LOCATION GLB FILES ===")
    for meta in LOCATION_MODELS:
        loc_id = meta["id"]
        out_glb = os.path.join(ASSETS_ROOT, f"{loc_id}.glb")
        assert os.path.exists(out_glb), f"Missing: {out_glb}"
        with open(out_glb, "rb") as f:
            magic = f.read(4)
            assert magic == b"glTF", f"Invalid GLB magic: {magic} in {out_glb}"
        sz = os.path.getsize(out_glb)
        print(f"  ✓ {loc_id}: Valid binary GLB ({sz / 1024:.1f} KB)")
    print("\n=== ALL 10 ENVIRONMENT LOCATIONS READY AND VALIDATED ===")

if __name__ == "__main__":
    main()

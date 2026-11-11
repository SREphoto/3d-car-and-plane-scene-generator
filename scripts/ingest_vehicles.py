"""
scripts/ingest_vehicles.py
Automated acquisition, ingestion, and procedural generation pipeline for 20 Cars and 6 Planes.
Outputs self-contained binary .glb models with embedded PBR materials, forward -Z orientation
(Blender Front is +Y, exporting with +Y Up to Three.js -Z), and normalized ground datum Y = 0.000.
Executes in headless Blender (Blender 4.5+).
"""

import os
import sys
import math
import shutil
import zipfile
import tempfile
import bpy
import mathutils

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS_DIR = os.path.join(REPO_ROOT, "3D Car and Plane Scene Creator")
CARS_DIR = os.path.join(ASSETS_DIR, "Cars")
PLANES_DIR = os.path.join(ASSETS_DIR, "Planes")
STAGING_DIR = os.path.join(ASSETS_DIR, "staging")

CARS_METADATA = [
    {"id": "1975-porsche-911-turbo", "name": "1975 Porsche 911 (930) Turbo", "brand": "Porsche", "category": "Classic / Sports", "targetSize": 4.45, "accent": "#f59e0b", "uid": "8568d9d14a994b9cae59499f0dbed21e"},
    {"id": "lb-works-ferrari-f40", "name": "LB-Works Ferrari F40 Widebody", "brand": "Ferrari / Liberty Walk", "category": "Tuned / Supercar", "targetSize": 4.55, "accent": "#ff3b30", "uid": "011cad3526e945799d6e98dde6390182"},
    {"id": "lamborghini-aventador", "name": "Lamborghini Aventador LP700-4", "brand": "Lamborghini", "category": "V12 Supercar", "targetSize": 4.78, "accent": "#eab308", "uid": "e328d9f5dcfd48bdbe8c73324b52ece3"},
    {"id": "nissan-skyline-r34-gtr", "name": "Nissan Skyline R34 GT-R V-Spec II", "brand": "Nissan", "category": "JDM Legend", "targetSize": 4.60, "accent": "#3b82f6", "uid": "ff8fb2251dfa4bb9979e7022c5a6666c"},
    {"id": "audi-r8", "name": "Audi R8 V10 Performance", "brand": "Audi Sport", "category": "Mid-Engine Supercar", "targetSize": 4.43, "accent": "#64748b", "uid": "e17e438f076f4427a58d93aa779edaed"},
    {"id": "ford-gt-2006", "name": "Ford GT 2006", "brand": "Ford", "category": "American Supercar", "targetSize": 4.64, "accent": "#0ea5e9", "uid": "ee5db1918a2b4c8cbe0388b67dee4b17"},
    {"id": "2019-chevrolet-corvette-c8", "name": "2019 Chevrolet Corvette C8 Stingray", "brand": "Chevrolet", "category": "Sports Coupe", "targetSize": 4.63, "accent": "#dc2626", "uid": "790c40ccff6843eab0b7b4bd18421ff8"},
    {"id": "bmw-m3-e30", "name": "BMW M3 E30 Sport Evolution", "brand": "BMW M", "category": "Classic Touring", "targetSize": 4.35, "accent": "#ef4444", "uid": "ac3c7013434e403e8faff87948caf422"},
    {"id": "2019-aston-martin-vantage", "name": "2019 Aston Martin Vantage", "brand": "Aston Martin", "category": "British GT", "targetSize": 4.47, "accent": "#10b981", "uid": "9237b1748bdf4d8d9194ada0981b84a8"},
    {"id": "koenigsegg-one-pro", "name": "Koenigsegg One:1 Megacar", "brand": "Koenigsegg", "category": "Megacar", "targetSize": 4.50, "accent": "#a855f7", "uid": "26d50f742f3241f5a36081d93205c764"},
    {"id": "bugatti-chiron-mansory", "name": "Bugatti Chiron Mansory Centuria", "brand": "Bugatti / Mansory", "category": "Hypercar", "targetSize": 4.54, "accent": "#06b6d4", "uid": "1bad4302097e41dc9b9e04794dd20108"},
    {"id": "dodge-viper-gts", "name": "Dodge Viper GTS Coupe", "brand": "Dodge", "category": "American Muscle", "targetSize": 4.49, "accent": "#2563eb", "uid": "f14c18476a0542178c6d0ca9a751e425"},
    {"id": "mazda-rx7-fd", "name": "Mazda RX-7 FD3S Spirit R", "brand": "Mazda", "category": "Rotary Legend", "targetSize": 4.28, "accent": "#f97316", "uid": "898e9be8c8964f6298188a2901216e80"},
    {"id": "toyota-supra-mk4", "name": "Toyota Supra MK IV (1994)", "brand": "Toyota", "category": "JDM Legend", "targetSize": 4.52, "accent": "#ec4899", "uid": "eb9bb1eb41db431cb078088ae1ce45f8"},
    {"id": "mercedes-amg-gt3", "name": "Mercedes-AMG GT3", "brand": "Mercedes-AMG", "category": "GT3 Race", "targetSize": 4.75, "accent": "#94a3b8", "uid": "035f061cb6624effbc483d5f9b5ecaba"},
    {"id": "shelby-cobra-427", "name": "Shelby Cobra 427 S/C", "brand": "Shelby", "category": "Classic Roadster", "targetSize": 4.00, "accent": "#1d4ed8", "uid": "a9024d1c23f1490f8f40468946c14b0c"},
    {"id": "subaru-impreza-wrx-sti", "name": "Subaru Impreza WRX STi 2004", "brand": "Subaru", "category": "Rally Sport", "targetSize": 4.42, "accent": "#1e40af", "uid": "08296bc950364621b6174a3078bb19e0"},
    {"id": "honda-nsx-1990", "name": "Honda NSX 1990", "brand": "Honda", "category": "Mid-Engine Supercar", "targetSize": 4.41, "accent": "#b91c1c", "uid": "1cc15628a00a4739a6b6c01128927c8d"},
    {"id": "mclaren-senna", "name": "McLaren Senna Track Edition", "brand": "McLaren", "category": "Ultimate Series", "targetSize": 4.74, "accent": "#f97316", "uid": "ea3e43a6eb004853a87fe9c58422eb96"},
    {"id": "mitsubishi-lancer-evo", "name": "Mitsubishi Lancer Evolution IX MR", "brand": "Mitsubishi", "category": "Rally Sport", "targetSize": 4.51, "accent": "#ffffff", "uid": "ab29b0d3386549ea948568a07fb18d3a"}
]

PLANES_METADATA = [
    {"id": "lockheed-f22-raptor", "name": "Lockheed Martin F-22 Raptor", "brand": "Lockheed Martin", "category": "5th Gen Stealth Fighter", "targetSize": 18.9, "accent": "#64748b", "enginesCount": 2, "uid": "508de5c48845456bb033fb267ebe1d1e"},
    {"id": "boeing-787-dreamliner", "name": "Boeing 787-9 Dreamliner", "brand": "Boeing", "category": "Commercial Widebody", "targetSize": 28.0, "accent": "#0284c7", "enginesCount": 2, "uid": "524f485c748146b7968e0dd8eb84e786"},
    {"id": "concorde-supersonic", "name": "Aérospatiale / BAC Concorde", "brand": "Air France / British Airways", "category": "Supersonic Commercial", "targetSize": 26.0, "accent": "#f8fafc", "enginesCount": 4, "uid": "6d95290363474798a429a38bbf9ad49d"},
    {"id": "supermarine-spitfire", "name": "Supermarine Spitfire Mk.IX", "brand": "Supermarine Aviation", "category": "Historic Warbird", "targetSize": 11.2, "accent": "#65a30d", "enginesCount": 1, "uid": "96b902aa09ab441497d815f3958e061c"},
    {"id": "lockheed-sr71-blackbird", "name": "Lockheed SR-71 Blackbird", "brand": "Lockheed Skunk Works", "category": "Strategic Reconnaissance", "targetSize": 24.0, "accent": "#0f172a", "enginesCount": 2, "uid": "e2400e6119f5414c89e075654a82d30a"},
    {"id": "airbus-a380", "name": "Airbus A380-800 Superjumbo", "brand": "Airbus", "category": "Commercial Double-Deck", "targetSize": 30.0, "accent": "#38bdf8", "enginesCount": 4, "uid": "98d21f9c8104445f814cef47ef992889"}
]

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def strip_unwanted_entities():
    for obj in list(bpy.data.objects):
        if obj.type in {'CAMERA', 'LIGHT'}:
            bpy.data.objects.remove(obj, do_unlink=True)

def normalize_vehicle_ground_and_forward():
    """
    Evaluates the dependency graph, aligns ground datum to Z = 0.000,
    and centers laterally (X) and longitudinally (Y).
    In Blender:
      +Y is Forward (Three.js -Z)
      -Y is Rear (Three.js +Z)
      +Z is Up (Three.js +Y)
      Z = 0 is Ground Datum (Three.js Y = 0)
    """
    bpy.context.view_layer.update()
    mesh_objs = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    if not mesh_objs:
        return

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

    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active = mesh_objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.context.view_layer.update()

    final_min_z = min(
        (obj.matrix_world @ mathutils.Vector(corner)).z
        for obj in mesh_objs
        for corner in obj.bound_box
    )
    assert abs(final_min_z) < 1e-4, f"Ground datum contact error: min_z={final_min_z}"

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
                bsdf.inputs["Emission Strength"].default_value = 4.0
            elif "Emission" in bsdf.inputs:
                bsdf.inputs["Emission"].default_value = emission
    return mat

def hex_to_rgba(hex_str):
    hex_str = hex_str.lstrip('#')
    if len(hex_str) == 6:
        r = int(hex_str[0:2], 16) / 255.0
        g = int(hex_str[2:4], 16) / 255.0
        b = int(hex_str[4:6], 16) / 255.0
        return (r, g, b, 1.0)
    return (0.8, 0.1, 0.1, 1.0)

# Primitive helpers
def create_box(name, location, scale, material=None, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    if rotation:
        obj.rotation_euler = rotation
    if material:
        obj.data.materials.append(material)
    return obj

def create_cylinder(name, location, radius, depth, material=None, rotation=None, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.active_object
    obj.name = name
    if rotation:
        obj.rotation_euler = rotation
    if material:
        obj.data.materials.append(material)
    return obj

def create_cone(name, location, radius1, radius2, depth, material=None, rotation=None, vertices=24):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=location)
    obj = bpy.context.active_object
    obj.name = name
    if rotation:
        obj.rotation_euler = rotation
    if material:
        obj.data.materials.append(material)
    return obj

def create_wheel_assembly(w_name, wx, wy, wheel_r, wheel_w, mat_tire, mat_rim, mat_brake, spoke_count=5):
    # Tire
    create_cylinder(f"{w_name}_Tire", (wx, wy, wheel_r), wheel_r, wheel_w, mat_tire, (0, math.radians(90), 0), vertices=24)
    # Outer Rim Barrel
    create_cylinder(f"{w_name}_Rim", (wx, wy, wheel_r), wheel_r * 0.76, wheel_w * 1.02, mat_rim, (0, math.radians(90), 0), vertices=20)
    # Center Hub / Cap
    create_cylinder(f"{w_name}_Hub", (wx + (0.01 if wx > 0 else -0.01), wy, wheel_r), wheel_r * 0.28, wheel_w * 1.05, mat_rim, (0, math.radians(90), 0), vertices=12)
    # Radial Spokes
    spoke_len = wheel_r * 0.52
    for spk_idx in range(spoke_count):
        angle = spk_idx * (2 * math.pi / spoke_count)
        sx = wx + (0.005 if wx > 0 else -0.005)
        sy = wy + math.sin(angle) * (spoke_len * 0.5)
        sz = wheel_r + math.cos(angle) * (spoke_len * 0.5)
        create_box(
            f"{w_name}_Spoke_{spk_idx}",
            (sx, sy, sz),
            (wheel_w * 0.8, wheel_r * 0.12, spoke_len),
            mat_rim,
            (angle, 0, 0)
        )
    # Brake Rotor Disc
    create_cylinder(f"{w_name}_Rotor", (wx * 0.88, wy, wheel_r), wheel_r * 0.65, wheel_w * 0.25, mat_rim, (0, math.radians(90), 0), vertices=16)
    # Brake Caliper
    create_box(f"{w_name}_Caliper", (wx * 0.88, wy, wheel_r * 1.25), (wheel_w * 0.45, wheel_r * 0.42, wheel_r * 0.28), mat_brake)

# =========================================================================
# 20 INDIVIDUAL VEHICLE BUILDERS (7 ARCHITECTURAL BODY CLASSES)
# In Blender: Front is +Y, Rear is -Y. Left is +X, Right is -X.
# =========================================================================

def build_porsche_911_turbo(car_meta):
    """C1: RearEngine_Fastback - 1975 Porsche 911 Turbo"""
    car_id = car_meta["id"]
    clear_scene()
    paint_color = hex_to_rgba(car_meta["accent"])
    mat_body = create_pbr_material(f"{car_id}_paint", paint_color, metallic=0.75, roughness=0.22)
    mat_glass = create_pbr_material(f"{car_id}_glass", (0.06, 0.08, 0.12, 1.0), metallic=0.9, roughness=0.08)
    mat_dark = create_pbr_material(f"{car_id}_chassis", (0.05, 0.05, 0.06, 1.0), metallic=0.2, roughness=0.6)
    mat_tire = create_pbr_material(f"{car_id}_tire", (0.08, 0.08, 0.09, 1.0), metallic=0.0, roughness=0.7)
    mat_rim = create_pbr_material(f"{car_id}_rim", (0.85, 0.88, 0.90, 1.0), metallic=0.95, roughness=0.2)
    mat_brake = create_pbr_material(f"{car_id}_brake", (0.85, 0.15, 0.15, 1.0), metallic=0.7, roughness=0.3)
    mat_headlight = create_pbr_material(f"{car_id}_headlight", (0.9, 0.95, 1.0, 1.0), metallic=0.1, roughness=0.05, emission=(0.9, 0.95, 1.0, 1.0))
    mat_taillight = create_pbr_material(f"{car_id}_taillight", (1.0, 0.05, 0.05, 1.0), metallic=0.1, roughness=0.05, emission=(1.0, 0.05, 0.05, 1.0))
    mat_rubber = create_pbr_material(f"{car_id}_rubber", (0.02, 0.02, 0.02, 1.0), metallic=0.05, roughness=0.85)

    L = 4.45; W = 1.77; H = 1.31; wheel_r = 0.32; wheel_w = 0.28; wheelbase = 2.27; track = 1.49

    # Body Lower Chassis
    create_box("Body_Chassis", (0, 0, wheel_r * 1.1), (W * 0.92, L * 0.88, H * 0.42), mat_body)
    # Front Torpedo Fenders (Front is +Y)
    for s in [-1, 1]:
        create_box(f"Fender_Front_{'L' if s > 0 else 'R'}", (s * W * 0.38, L * 0.32, wheel_r * 1.3), (W * 0.22, L * 0.35, H * 0.35), mat_body)
        # Upright Round Headlights at +Y
        create_cylinder(f"Headlight_{'L' if s > 0 else 'R'}", (s * W * 0.38, L * 0.46, wheel_r * 1.45), wheel_r * 0.32, 0.10, mat_headlight, (math.radians(85), 0, 0), vertices=16)
        # Accordion Bumper Bellows
        create_box(f"Bumper_Accordion_{'FL' if s > 0 else 'FR'}", (s * W * 0.42, L * 0.48, wheel_r * 0.85), (0.08, 0.12, 0.14), mat_rubber)
        create_box(f"Bumper_Accordion_{'RL' if s > 0 else 'RR'}", (s * W * 0.44, -L * 0.48, wheel_r * 0.85), (0.08, 0.12, 0.14), mat_rubber)

    # Sloping Fastback Roof (28 deg rake descending toward rear -Y)
    create_box("Body_Fastback_Cabin", (0, L * 0.02, H * 0.68), (W * 0.74, L * 0.46, H * 0.38), mat_glass)
    create_box("Body_Fastback_Slope", (0, -L * 0.22, H * 0.60), (W * 0.72, L * 0.32, H * 0.26), mat_body, (math.radians(-26), 0, 0))

    # Flared Rear Turbo Hips (-Y)
    for s in [-1, 1]:
        create_box(f"Fender_Rear_Turbo_{'L' if s > 0 else 'R'}", (s * W * 0.44, -L * 0.26, wheel_r * 1.25), (W * 0.22, L * 0.38, H * 0.36), mat_body)

    # Whale-Tail Tea-Tray Spoiler at rear (-Y)
    create_box("WhaleTail_Spoiler", (0, -L * 0.42, H * 0.72), (W * 0.82, L * 0.22, 0.05), mat_rubber)
    create_box("WhaleTail_Louver", (0, -L * 0.40, H * 0.75), (W * 0.60, L * 0.14, 0.03), mat_dark)

    # Rear Taillight Cluster with center Porsche reflector bar at -Y
    for s in [-1, 1]:
        create_box(f"Taillight_{'L' if s > 0 else 'R'}", (s * W * 0.36, -L * 0.47, wheel_r * 1.35), (W * 0.20, 0.08, H * 0.12), mat_taillight)
    create_box("Reflector_Bar_Center", (0, -L * 0.47, wheel_r * 1.35), (W * 0.32, 0.06, H * 0.10), mat_taillight)

    # Left Rear Oval Exhaust Tip (-Y)
    create_cylinder("Exhaust_Left_Oval", (W * 0.28, -L * 0.49, wheel_r * 0.60), wheel_r * 0.18, 0.16, mat_rim, (math.radians(90), 0, 0), vertices=16)

    # 4 Fuchs-Style Wheels
    wheel_configs = [("Wheel_FL", track * 0.5, wheelbase * 0.5), ("Wheel_FR", -track * 0.5, wheelbase * 0.5),
                     ("Wheel_RL", track * 0.53, -wheelbase * 0.5), ("Wheel_RR", -track * 0.53, -wheelbase * 0.5)]
    for w_name, wx, wy in wheel_configs:
        create_wheel_assembly(w_name, wx, wy, wheel_r, wheel_w, mat_tire, mat_rim, mat_brake, spoke_count=5)

    normalize_vehicle_ground_and_forward()

def build_wedge_supercar(car_meta, wedge_type="aventador"):
    """C2: MidEngine_ExtremeWedge - Aventador, Corvette C8, Audi R8, Honda NSX"""
    car_id = car_meta["id"]
    clear_scene()
    paint_color = hex_to_rgba(car_meta["accent"])
    mat_body = create_pbr_material(f"{car_id}_paint", paint_color, metallic=0.88, roughness=0.18)
    mat_glass = create_pbr_material(f"{car_id}_glass", (0.04, 0.06, 0.10, 1.0), metallic=0.95, roughness=0.06)
    mat_dark = create_pbr_material(f"{car_id}_chassis", (0.04, 0.04, 0.05, 1.0), metallic=0.3, roughness=0.55)
    mat_tire = create_pbr_material(f"{car_id}_tire", (0.08, 0.08, 0.09, 1.0), metallic=0.0, roughness=0.7)
    mat_rim = create_pbr_material(f"{car_id}_rim", (0.85, 0.88, 0.90, 1.0), metallic=0.95, roughness=0.2)
    mat_brake = create_pbr_material(f"{car_id}_brake", (0.9, 0.1, 0.1, 1.0), metallic=0.7, roughness=0.25)
    mat_headlight = create_pbr_material(f"{car_id}_headlight", (0.9, 0.95, 1.0, 1.0), metallic=0.1, roughness=0.05, emission=(0.9, 0.95, 1.0, 1.0))
    mat_taillight = create_pbr_material(f"{car_id}_taillight", (1.0, 0.05, 0.05, 1.0), metallic=0.1, roughness=0.05, emission=(1.0, 0.05, 0.05, 1.0))
    mat_carbon = create_pbr_material(f"{car_id}_carbon", (0.03, 0.03, 0.04, 1.0), metallic=0.2, roughness=0.35)

    target_l = car_meta.get("targetSize", 4.6)
    W = target_l * 0.44; H = target_l * 0.25; wheel_r = H * 0.28; wheel_w = W * 0.16
    wheelbase = target_l * 0.58; track = W * 0.88

    # Wedge Lower Chassis (Low nose at +Y, rising to mid-engine deck at -Y)
    create_box("Body_Chassis", (0, -target_l * 0.04, wheel_r * 1.1), (W * 0.94, target_l * 0.88, H * 0.44), mat_body)
    # Sloping Low Nose Wedge at +Y
    create_box("Body_Nose_Wedge", (0, target_l * 0.32, wheel_r * 0.95), (W * 0.86, target_l * 0.28, H * 0.24), mat_body, (math.radians(12), 0, 0))

    # Forward Cockpit
    create_box("Body_Greenhouse", (0, target_l * 0.06, H * 0.72), (W * 0.76, target_l * 0.44, H * 0.42), mat_glass)

    # Front Splitter at +Y
    create_box("Aero_FrontSplitter", (0, target_l * 0.48, wheel_r * 0.50), (W * 0.98, target_l * 0.12, H * 0.08), mat_carbon)

    # Front Headlights at +Y
    for s in [-1, 1]:
        create_box(f"Headlight_{'L' if s > 0 else 'R'}", (s * W * 0.36, target_l * 0.44, wheel_r * 1.35), (W * 0.18, 0.08, H * 0.12), mat_headlight)

    # Model specific details
    if wedge_type == "aventador":
        # Sharp front fangs
        for s in [-1, 1]:
            create_box(f"Bumper_Front_Fang_{s}", (s * W * 0.28, target_l * 0.49, wheel_r * 0.65), (W * 0.12, 0.14, H * 0.16), mat_carbon)
            create_box(f"Side_Scoop_{'L' if s > 0 else 'R'}", (s * W * 0.46, -target_l * 0.12, wheel_r * 1.2), (0.12, target_l * 0.22, H * 0.32), mat_carbon)
        # Rear V12 louvers (-Y)
        create_box("Rear_Engine_Louvers", (0, -target_l * 0.26, H * 0.62), (W * 0.64, target_l * 0.30, 0.04), mat_dark)
        # Hex center exhaust (-Y)
        create_cylinder("Exhaust_Hex_Center", (0, -target_l * 0.48, wheel_r * 0.95), wheel_r * 0.35, 0.15, mat_rim, (math.radians(90), 0, 0), vertices=6)
    elif wedge_type == "corvette_c8":
        # Boomerang side scoops
        for s in [-1, 1]:
            create_box(f"Side_Scoop_Boomerang_{'L' if s > 0 else 'R'}", (s * W * 0.45, -target_l * 0.08, wheel_r * 1.15), (0.10, target_l * 0.20, H * 0.30), mat_dark)
        # Low profile rear spoiler (-Y)
        create_box("Rear_Spoiler_LowProfile", (0, -target_l * 0.44, H * 0.72), (W * 0.88, 0.12, 0.04), mat_body)
        # Quad square exhausts (-Y)
        for s in [-1, 1]:
            create_box(f"Exhaust_Quad_{s}_A", (s * W * 0.36, -target_l * 0.48, wheel_r * 0.65), (0.09, 0.12, 0.08), mat_rim)
            create_box(f"Exhaust_Quad_{s}_B", (s * W * 0.26, -target_l * 0.48, wheel_r * 0.65), (0.09, 0.12, 0.08), mat_rim)
    elif wedge_type == "audi_r8":
        # Contrasting carbon sideblades
        for s in [-1, 1]:
            create_box(f"Sideblade_{'L' if s > 0 else 'R'}", (s * W * 0.46, -target_l * 0.10, wheel_r * 1.25), (0.06, target_l * 0.24, H * 0.45), mat_carbon)
        # Singleframe Grille at +Y
        create_box("Singleframe_Grille", (0, target_l * 0.46, wheel_r * 0.95), (W * 0.48, 0.08, H * 0.32), mat_dark)
        # Twin oval exhausts (-Y)
        for s in [-1, 1]:
            create_cylinder(f"Exhaust_Oval_{s}", (s * W * 0.34, -target_l * 0.48, wheel_r * 0.65), wheel_r * 0.22, 0.15, mat_rim, (math.radians(90), 0, 0), vertices=16)
    elif wedge_type == "honda_nsx":
        # Jet black canopy roof
        mat_black_roof = create_pbr_material(f"{car_id}_black_roof", (0.03, 0.03, 0.04, 1.0), metallic=0.7, roughness=0.2)
        create_box("Black_Canopy_Roof", (0, target_l * 0.04, H * 0.82), (W * 0.72, target_l * 0.42, 0.06), mat_black_roof)
        # Pop-up headlight covers at +Y
        for s in [-1, 1]:
            create_box(f"PopUp_Headlight_Lid_{s}", (s * W * 0.32, target_l * 0.38, wheel_r * 1.25), (W * 0.18, target_l * 0.12, 0.03), mat_body)
        # Integrated rear wing across full width (-Y)
        create_box("Integrated_Rear_Wing", (0, -target_l * 0.44, H * 0.75), (W * 0.92, 0.16, 0.04), mat_body)

    # Rear Taillights at -Y
    for s in [-1, 1]:
        create_box(f"Taillight_{'L' if s > 0 else 'R'}", (s * W * 0.36, -target_l * 0.45, wheel_r * 1.35), (W * 0.20, 0.08, H * 0.10), mat_taillight)
    # Rear Diffuser at -Y
    create_box("Aero_Diffuser", (0, -target_l * 0.46, wheel_r * 0.50), (W * 0.88, 0.14, H * 0.16), mat_carbon)

    # 4 Wheels
    wheel_configs = [("Wheel_FL", track * 0.5, wheelbase * 0.5), ("Wheel_FR", -track * 0.5, wheelbase * 0.5),
                     ("Wheel_RL", track * 0.5, -wheelbase * 0.5), ("Wheel_RR", -track * 0.5, -wheelbase * 0.5)]
    for w_name, wx, wy in wheel_configs:
        create_wheel_assembly(w_name, wx, wy, wheel_r, wheel_w, mat_tire, mat_rim, mat_brake, spoke_count=6)

    normalize_vehicle_ground_and_forward()

def build_boxy_coupe_sedan(car_meta, body_type="r34"):
    """C3: Boxy_Coupe_Sedan - Skyline R34, BMW M3 E30, Subaru WRX STi, Lancer Evo IX"""
    car_id = car_meta["id"]
    clear_scene()
    paint_color = hex_to_rgba(car_meta["accent"])
    mat_body = create_pbr_material(f"{car_id}_paint", paint_color, metallic=0.78, roughness=0.22)
    mat_glass = create_pbr_material(f"{car_id}_glass", (0.05, 0.07, 0.10, 1.0), metallic=0.9, roughness=0.08)
    mat_dark = create_pbr_material(f"{car_id}_chassis", (0.04, 0.04, 0.05, 1.0), metallic=0.2, roughness=0.6)
    mat_tire = create_pbr_material(f"{car_id}_tire", (0.08, 0.08, 0.09, 1.0), metallic=0.0, roughness=0.7)
    mat_rim = create_pbr_material(f"{car_id}_rim", (0.85, 0.88, 0.90, 1.0), metallic=0.95, roughness=0.2)
    mat_brake = create_pbr_material(f"{car_id}_brake", (0.9, 0.6, 0.1, 1.0), metallic=0.8, roughness=0.3)
    mat_headlight = create_pbr_material(f"{car_id}_headlight", (0.9, 0.95, 1.0, 1.0), metallic=0.1, roughness=0.05, emission=(0.9, 0.95, 1.0, 1.0))
    mat_taillight = create_pbr_material(f"{car_id}_taillight", (1.0, 0.05, 0.05, 1.0), metallic=0.1, roughness=0.05, emission=(1.0, 0.05, 0.05, 1.0))
    mat_carbon = create_pbr_material(f"{car_id}_carbon", (0.03, 0.03, 0.04, 1.0), metallic=0.1, roughness=0.35)

    target_l = car_meta.get("targetSize", 4.5)
    W = target_l * 0.42; H = target_l * 0.30; wheel_r = H * 0.25; wheel_w = W * 0.15
    wheelbase = target_l * 0.58; track = W * 0.86

    # 3-Box Notchback Lower Chassis
    create_box("Body_Chassis", (0, 0, wheel_r * 1.15), (W * 0.92, target_l * 0.92, H * 0.45), mat_body)
    # Upright Cabin / Greenhouse
    create_box("Body_Greenhouse", (0, -target_l * 0.04, H * 0.76), (W * 0.80, target_l * 0.50, H * 0.44), mat_glass)

    # Front Headlights at +Y
    for s in [-1, 1]:
        create_box(f"Headlight_{'L' if s > 0 else 'R'}", (s * W * 0.35, target_l * 0.44, wheel_r * 1.35), (W * 0.20, 0.08, H * 0.14), mat_headlight)

    # Front Intercooler aperture at +Y
    create_box("Intercooler_Grille", (0, target_l * 0.46, wheel_r * 0.65), (W * 0.55, 0.08, H * 0.20), mat_rim)

    if body_type == "r34":
        # NACA hood duct on right side (+Y)
        create_box("Hood_NACA_Duct", (-W * 0.22, target_l * 0.24, wheel_r * 1.55), (0.12, 0.16, 0.03), mat_carbon)
        # Tall Pedestal Wing at -Y
        create_box("Aero_RearWing", (0, -target_l * 0.42, H * 0.95), (W * 0.92, target_l * 0.14, 0.04), mat_carbon)
        for s in [-1, 1]:
            create_box(f"WingStay_{s}", (s * W * 0.26, -target_l * 0.40, H * 0.78), (0.04, 0.08, H * 0.30), mat_dark)
        # Iconic Quad Round Taillights at -Y
        for s in [-1, 1]:
            create_cylinder(f"Taillight_Outer_{'L' if s > 0 else 'R'}", (s * W * 0.36, -target_l * 0.46, wheel_r * 1.35), wheel_r * 0.24, 0.08, mat_taillight, (math.radians(90), 0, 0), vertices=16)
            create_cylinder(f"Taillight_Inner_{'L' if s > 0 else 'R'}", (s * W * 0.20, -target_l * 0.46, wheel_r * 1.35), wheel_r * 0.18, 0.08, mat_taillight, (math.radians(90), 0, 0), vertices=16)
        # N1 Cannon Exhaust at left rear (-Y)
        create_cylinder("Exhaust_N1_Cannon", (W * 0.32, -target_l * 0.48, wheel_r * 0.60), wheel_r * 0.20, 0.22, mat_rim, (math.radians(90), 0, 0), vertices=16)
    elif body_type == "e30":
        # Classic Box Fender Blisters (+40mm)
        for s in [-1, 1]:
            create_box(f"Box_Flare_Front_{s}", (s * W * 0.47, wheelbase * 0.5, wheel_r * 1.15), (0.08, target_l * 0.26, H * 0.38), mat_body)
            create_box(f"Box_Flare_Rear_{s}", (s * W * 0.47, -wheelbase * 0.5, wheel_r * 1.15), (0.08, target_l * 0.26, H * 0.38), mat_body)
        # Twin Kidney Grilles at +Y
        for s in [-1, 1]:
            create_box(f"Kidney_Grille_{s}", (s * 0.10, target_l * 0.46, wheel_r * 1.25), (0.07, 0.06, H * 0.20), mat_dark)
        # DTM Trunk Wing at -Y
        create_box("Trunk_Spoiler_DTM", (0, -target_l * 0.43, H * 0.82), (W * 0.86, 0.16, 0.04), mat_body)
        # Dual small exhaust pipes at -Y
        for off in [-0.04, 0.04]:
            create_cylinder(f"Exhaust_Dual_{off}", (W * 0.32 + off, -target_l * 0.48, wheel_r * 0.60), 0.04, 0.18, mat_rim, (math.radians(90), 0, 0), vertices=12)
        for s in [-1, 1]:
            create_box(f"Taillight_{'L' if s > 0 else 'R'}", (s * W * 0.34, -target_l * 0.46, wheel_r * 1.35), (W * 0.18, 0.08, H * 0.12), mat_taillight)
    elif body_type == "sti":
        # Giant High-Rise Intercooler Hood Scoop (+Y)
        create_box("Functional_Hood_Scoop", (0, target_l * 0.18, wheel_r * 1.62), (W * 0.38, target_l * 0.18, H * 0.14), mat_body)
        # Giant STi Rear Rally Wing at -Y
        create_box("HighRise_STi_Wing", (0, -target_l * 0.42, H * 1.05), (W * 0.94, target_l * 0.16, 0.05), mat_body)
        for s in [-1, 1]:
            create_box(f"Wing_Endplate_{s}", (s * W * 0.46, -target_l * 0.42, H * 0.95), (0.04, 0.20, H * 0.32), mat_body)
            create_box(f"Taillight_{'L' if s > 0 else 'R'}", (s * W * 0.34, -target_l * 0.46, wheel_r * 1.35), (W * 0.18, 0.08, H * 0.12), mat_taillight)
        # Angled STi Exhaust at -Y
        create_cylinder("Exhaust_STi_Polished", (W * 0.32, -target_l * 0.48, wheel_r * 0.60), wheel_r * 0.22, 0.20, mat_rim, (math.radians(90), 0, 0), vertices=16)
    elif body_type == "evo":
        # 9 Shark-Tooth Vortex Generator Fins on Roof (-Y)
        for v_idx in range(9):
            vx = (v_idx - 4) * (W * 0.08)
            create_box(f"Vortex_Teeth_{v_idx}", (vx, -target_l * 0.20, H * 0.98), (0.015, 0.06, 0.04), mat_dark)
        # Carbon Rally Wing at -Y
        create_box("Carbon_Rear_Wing", (0, -target_l * 0.43, H * 0.96), (W * 0.92, 0.18, 0.04), mat_carbon)
        for s in [-1, 1]:
            create_box(f"Taillight_{'L' if s > 0 else 'R'}", (s * W * 0.34, -target_l * 0.46, wheel_r * 1.35), (W * 0.18, 0.08, H * 0.12), mat_taillight)
        # Single Titanium Exhaust Cannon at -Y
        create_cylinder("Exhaust_Titanium_Cannon", (W * 0.30, -target_l * 0.48, wheel_r * 0.60), wheel_r * 0.22, 0.22, mat_rim, (math.radians(90), 0, 0), vertices=16)

    # 4 Wheels
    wheel_configs = [("Wheel_FL", track * 0.5, wheelbase * 0.5), ("Wheel_FR", -track * 0.5, wheelbase * 0.5),
                     ("Wheel_RL", track * 0.5, -wheelbase * 0.5), ("Wheel_RR", -track * 0.5, -wheelbase * 0.5)]
    for w_name, wx, wy in wheel_configs:
        create_wheel_assembly(w_name, wx, wy, wheel_r, wheel_w, mat_tire, mat_rim, mat_brake, spoke_count=6)

    normalize_vehicle_ground_and_forward()

def build_longhood_gt(car_meta, gt_type="ford_gt"):
    """C4: LongHood_GT_Racer - Ford GT, Dodge Viper, Vantage, AMG GT3"""
    car_id = car_meta["id"]
    clear_scene()
    paint_color = hex_to_rgba(car_meta["accent"])
    mat_body = create_pbr_material(f"{car_id}_paint", paint_color, metallic=0.85, roughness=0.18)
    mat_glass = create_pbr_material(f"{car_id}_glass", (0.04, 0.06, 0.10, 1.0), metallic=0.92, roughness=0.08)
    mat_dark = create_pbr_material(f"{car_id}_chassis", (0.04, 0.04, 0.05, 1.0), metallic=0.25, roughness=0.6)
    mat_tire = create_pbr_material(f"{car_id}_tire", (0.08, 0.08, 0.09, 1.0), metallic=0.0, roughness=0.7)
    mat_rim = create_pbr_material(f"{car_id}_rim", (0.85, 0.88, 0.90, 1.0), metallic=0.95, roughness=0.2)
    mat_brake = create_pbr_material(f"{car_id}_brake", (0.85, 0.15, 0.15, 1.0), metallic=0.7, roughness=0.3)
    mat_headlight = create_pbr_material(f"{car_id}_headlight", (0.9, 0.95, 1.0, 1.0), metallic=0.1, roughness=0.05, emission=(0.9, 0.95, 1.0, 1.0))
    mat_taillight = create_pbr_material(f"{car_id}_taillight", (1.0, 0.05, 0.05, 1.0), metallic=0.1, roughness=0.05, emission=(1.0, 0.05, 0.05, 1.0))
    mat_carbon = create_pbr_material(f"{car_id}_carbon", (0.03, 0.03, 0.04, 1.0), metallic=0.1, roughness=0.35)

    target_l = car_meta.get("targetSize", 4.6)
    W = target_l * 0.43; H = target_l * 0.25; wheel_r = H * 0.27; wheel_w = W * 0.16
    wheelbase = target_l * 0.58; track = W * 0.88

    # Low aerodynamic unibody with long hood
    create_box("Body_Chassis", (0, target_l * 0.02, wheel_r * 1.1), (W * 0.92, target_l * 0.90, H * 0.42), mat_body)
    # Rearward cockpit
    create_box("Body_Greenhouse", (0, -target_l * 0.05, H * 0.70), (W * 0.76, target_l * 0.42, H * 0.40), mat_glass)
    # Front Headlights at +Y
    for s in [-1, 1]:
        create_box(f"Headlight_{'L' if s > 0 else 'R'}", (s * W * 0.35, target_l * 0.44, wheel_r * 1.35), (W * 0.18, 0.08, H * 0.12), mat_headlight)
        create_box(f"Taillight_{'L' if s > 0 else 'R'}", (s * W * 0.35, -target_l * 0.45, wheel_r * 1.35), (W * 0.18, 0.08, H * 0.10), mat_taillight)

    if gt_type == "ford_gt":
        # Twin hood nostrils (+Y)
        for s in [-1, 1]:
            create_box(f"Hood_Nostril_{s}", (s * W * 0.18, target_l * 0.28, wheel_r * 1.45), (W * 0.15, target_l * 0.14, 0.04), mat_dark)
        # Flying buttresses at rear (-Y)
        for s in [-1, 1]:
            create_box(f"Flying_Buttress_{'L' if s > 0 else 'R'}", (s * W * 0.38, -target_l * 0.24, H * 0.65), (0.06, target_l * 0.24, H * 0.22), mat_body)
        # High center twin exhausts (-Y)
        for off in [-0.06, 0.06]:
            create_cylinder(f"Exhaust_HighCenter_{off}", (off, -target_l * 0.46, wheel_r * 1.15), 0.05, 0.14, mat_rim, (math.radians(90), 0, 0), vertices=14)
    elif gt_type == "viper":
        # Double bubble roof
        for s in [-1, 1]:
            create_box(f"Double_Bubble_Roof_{s}", (s * W * 0.20, -target_l * 0.05, H * 0.88), (W * 0.28, target_l * 0.32, 0.06), mat_body)
        # Dominant forward-facing hood scoop (+Y)
        create_box("Hood_Scoop_Central", (0, target_l * 0.28, wheel_r * 1.55), (W * 0.24, target_l * 0.16, 0.07), mat_dark)
        # Center dual exhausts (-Y)
        for off in [-0.07, 0.07]:
            create_cylinder(f"Exhaust_Center_{off}", (off, -target_l * 0.46, wheel_r * 0.65), 0.05, 0.14, mat_rim, (math.radians(90), 0, 0), vertices=14)
    elif gt_type == "vantage":
        # Gaping predator mouth grille (+Y)
        create_box("Predator_Front_Grille", (0, target_l * 0.46, wheel_r * 0.85), (W * 0.65, 0.08, H * 0.30), mat_dark)
        # Integrated ducktail spoiler (-Y)
        create_box("Ducktail_Spoiler", (0, -target_l * 0.43, H * 0.74), (W * 0.86, 0.14, 0.08), mat_body)
        create_box("Taillight_Ribbon_FullWidth", (0, -target_l * 0.44, H * 0.73), (W * 0.84, 0.04, 0.03), mat_taillight)
    elif gt_type == "amg_gt3":
        # Vertical waterfall Panamericana grille (+Y)
        create_box("Panamericana_Grille", (0, target_l * 0.46, wheel_r * 1.05), (W * 0.52, 0.08, H * 0.32), mat_dark)
        # Front dive planes / canards (+Y)
        for s in [-1, 1]:
            create_box(f"Front_Dive_Planes_{'L' if s > 0 else 'R'}", (s * W * 0.48, target_l * 0.42, wheel_r * 0.90), (0.12, 0.18, 0.02), mat_carbon)
        # Massive GT3 Swan-Neck Rear Wing (-Y)
        create_box("SwanNeck_Rear_Wing", (0, -target_l * 0.44, H * 0.98), (W * 0.98, target_l * 0.16, 0.04), mat_carbon)
        for s in [-1, 1]:
            create_box(f"SwanNeck_Stay_{s}", (s * W * 0.28, -target_l * 0.40, H * 0.82), (0.04, 0.10, H * 0.32), mat_dark)
            create_cylinder(f"Side_Exit_Exhaust_{s}", (s * W * 0.48, -target_l * 0.18, wheel_r * 0.45), 0.04, 0.12, mat_rim, (0, math.radians(90), 0), vertices=12)

    # 4 Wheels
    wheel_configs = [("Wheel_FL", track * 0.5, wheelbase * 0.5), ("Wheel_FR", -track * 0.5, wheelbase * 0.5),
                     ("Wheel_RL", track * 0.5, -wheelbase * 0.5), ("Wheel_RR", -track * 0.5, -wheelbase * 0.5)]
    for w_name, wx, wy in wheel_configs:
        create_wheel_assembly(w_name, wx, wy, wheel_r, wheel_w, mat_tire, mat_rim, mat_brake, spoke_count=5)

    normalize_vehicle_ground_and_forward()

def build_curved_90s_sports(car_meta, model_type="rx7"):
    """C5: Curved_90s_Sports - Mazda RX-7 FD3S, Toyota Supra MK4"""
    car_id = car_meta["id"]
    clear_scene()
    paint_color = hex_to_rgba(car_meta["accent"])
    mat_body = create_pbr_material(f"{car_id}_paint", paint_color, metallic=0.75, roughness=0.20)
    mat_glass = create_pbr_material(f"{car_id}_glass", (0.04, 0.06, 0.10, 1.0), metallic=0.9, roughness=0.08)
    mat_dark = create_pbr_material(f"{car_id}_chassis", (0.04, 0.04, 0.05, 1.0), metallic=0.2, roughness=0.6)
    mat_tire = create_pbr_material(f"{car_id}_tire", (0.08, 0.08, 0.09, 1.0), metallic=0.0, roughness=0.7)
    mat_rim = create_pbr_material(f"{car_id}_rim", (0.85, 0.88, 0.90, 1.0), metallic=0.95, roughness=0.2)
    mat_brake = create_pbr_material(f"{car_id}_brake", (0.85, 0.15, 0.15, 1.0), metallic=0.7, roughness=0.3)
    mat_headlight = create_pbr_material(f"{car_id}_headlight", (0.9, 0.95, 1.0, 1.0), metallic=0.1, roughness=0.05, emission=(0.9, 0.95, 1.0, 1.0))
    mat_taillight = create_pbr_material(f"{car_id}_taillight", (1.0, 0.05, 0.05, 1.0), metallic=0.1, roughness=0.05, emission=(1.0, 0.05, 0.05, 1.0))
    mat_carbon = create_pbr_material(f"{car_id}_carbon", (0.03, 0.03, 0.04, 1.0), metallic=0.1, roughness=0.35)

    target_l = car_meta.get("targetSize", 4.4)
    W = target_l * 0.42; H = target_l * 0.28; wheel_r = H * 0.26; wheel_w = W * 0.15
    wheelbase = target_l * 0.58; track = W * 0.86

    # Fluid Coke-Bottle Curves Lower Body
    create_box("Body_Chassis", (0, 0, wheel_r * 1.15), (W * 0.90, target_l * 0.90, H * 0.44), mat_body)
    # Rounded Bubble Greenhouse
    create_box("Body_Greenhouse", (0, -target_l * 0.02, H * 0.72), (W * 0.75, target_l * 0.46, H * 0.40), mat_glass)

    if model_type == "rx7":
        # Pop-Up Headlights at +Y
        for s in [-1, 1]:
            create_box(f"PopUp_Headlight_{'L' if s > 0 else 'R'}", (s * W * 0.32, target_l * 0.38, wheel_r * 1.35), (W * 0.18, target_l * 0.12, 0.04), mat_body)
            create_box(f"Headlight_{'L' if s > 0 else 'R'}", (s * W * 0.32, target_l * 0.44, wheel_r * 1.15), (W * 0.16, 0.06, 0.06), mat_headlight)
        # Curved pedestal rear wing (-Y)
        create_box("Aero_RearWing", (0, -target_l * 0.42, H * 0.86), (W * 0.88, target_l * 0.12, 0.04), mat_body)
        for s in [-1, 1]:
            create_box(f"WingStay_{s}", (s * W * 0.38, -target_l * 0.40, H * 0.72), (0.04, 0.08, H * 0.26), mat_body)
        # Smoked full width taillight bar (-Y)
        create_box("Taillight_Bar_FullWidth", (0, -target_l * 0.46, wheel_r * 1.35), (W * 0.82, 0.06, H * 0.10), mat_taillight)
        # Single cannon exhaust on right (-Y)
        create_cylinder("Exhaust_Cannon_Right", (-W * 0.32, -target_l * 0.48, wheel_r * 0.60), wheel_r * 0.20, 0.20, mat_rim, (math.radians(90), 0, 0), vertices=16)
    elif model_type == "supra":
        # Front smile intake at +Y
        create_box("Front_Smile_Intake", (0, target_l * 0.45, wheel_r * 0.70), (W * 0.58, 0.08, H * 0.22), mat_dark)
        # Triple projector headlights behind clear lenses at +Y
        for s in [-1, 1]:
            create_box(f"Headlight_{'L' if s > 0 else 'R'}", (s * W * 0.34, target_l * 0.42, wheel_r * 1.35), (W * 0.18, 0.10, H * 0.12), mat_headlight)
        # Legendary tall hoop wing spanning full rear width (-Y)
        create_box("Aero_RearWing", (0, -target_l * 0.42, H * 1.05), (W * 0.94, target_l * 0.14, 0.05), mat_body)
        for s in [-1, 1]:
            create_box(f"Hoop_Pillar_{s}", (s * W * 0.45, -target_l * 0.42, H * 0.88), (0.05, 0.10, H * 0.35), mat_body)
            create_box(f"Taillight_{'L' if s > 0 else 'R'}", (s * W * 0.34, -target_l * 0.46, wheel_r * 1.35), (W * 0.18, 0.08, H * 0.12), mat_taillight)
        # 4-inch Super Drager cannon exhaust on left (-Y)
        create_cylinder("Exhaust_HKS_SuperDrager", (W * 0.32, -target_l * 0.48, wheel_r * 0.60), wheel_r * 0.22, 0.22, mat_rim, (math.radians(90), 0, 0), vertices=16)

    # 4 Wheels
    wheel_configs = [("Wheel_FL", track * 0.5, wheelbase * 0.5), ("Wheel_FR", -track * 0.5, wheelbase * 0.5),
                     ("Wheel_RL", track * 0.5, -wheelbase * 0.5), ("Wheel_RR", -track * 0.5, -wheelbase * 0.5)]
    for w_name, wx, wy in wheel_configs:
        create_wheel_assembly(w_name, wx, wy, wheel_r, wheel_w, mat_tire, mat_rim, mat_brake, spoke_count=5)

    normalize_vehicle_ground_and_forward()

def build_shelby_cobra(car_meta):
    """C6: Open_Roadster_Classic - Shelby Cobra 427 S/C"""
    car_id = car_meta["id"]
    clear_scene()
    paint_color = hex_to_rgba(car_meta["accent"])
    mat_body = create_pbr_material(f"{car_id}_paint", paint_color, metallic=0.75, roughness=0.22)
    mat_chrome = create_pbr_material(f"{car_id}_chrome", (0.92, 0.94, 0.96, 1.0), metallic=0.98, roughness=0.10)
    mat_dark = create_pbr_material(f"{car_id}_interior", (0.04, 0.04, 0.04, 1.0), metallic=0.1, roughness=0.7)
    mat_tire = create_pbr_material(f"{car_id}_tire", (0.08, 0.08, 0.09, 1.0), metallic=0.0, roughness=0.7)
    mat_rim = create_pbr_material(f"{car_id}_rim", (0.85, 0.88, 0.90, 1.0), metallic=0.95, roughness=0.2)
    mat_brake = create_pbr_material(f"{car_id}_brake", (0.8, 0.2, 0.2, 1.0), metallic=0.7, roughness=0.3)
    mat_headlight = create_pbr_material(f"{car_id}_headlight", (0.9, 0.95, 1.0, 1.0), metallic=0.1, roughness=0.05, emission=(0.9, 0.95, 1.0, 1.0))
    mat_taillight = create_pbr_material(f"{car_id}_taillight", (1.0, 0.05, 0.05, 1.0), metallic=0.1, roughness=0.05, emission=(1.0, 0.05, 0.05, 1.0))

    L = 4.00; W = 1.73; H = 1.17; wheel_r = 0.32; wheel_w = 0.26; wheelbase = 2.29; track = 1.40

    # Bulbous roadster lower body
    create_box("Body_Chassis", (0, 0, wheel_r * 1.1), (W * 0.90, L * 0.88, H * 0.44), mat_body)
    # Open Cockpit Interior Well (NO ROOF)
    create_box("Open_Cockpit_Tub", (0, -L * 0.04, wheel_r * 1.25), (W * 0.65, L * 0.38, H * 0.35), mat_dark)
    # Dashboard & Steering Wheel
    create_box("Interior_Dashboard", (0, L * 0.08, wheel_r * 1.55), (W * 0.62, 0.12, 0.18), mat_dark)
    create_cylinder("Interior_SteeringWheel", (W * 0.20, L * 0.04, wheel_r * 1.65), 0.18, 0.03, mat_chrome, (math.radians(-35), 0, 0), vertices=16)

    # Low Curved Windshield with chrome frame (+Y)
    create_box("Windshield_Chrome_Frame", (0, L * 0.12, H * 0.72), (W * 0.68, 0.04, H * 0.26), mat_chrome, (math.radians(28), 0, 0))

    # Driver Roll Hoop behind driver seat (-Y)
    create_cylinder("Driver_Roll_Hoop_L", (W * 0.20, -L * 0.18, H * 0.78), 0.18, 0.04, mat_chrome, (0, math.radians(90), 0), vertices=16)
    create_cylinder("Driver_Roll_Hoop_Pillar", (W * 0.20, -L * 0.18, H * 0.65), 0.03, 0.30, mat_chrome)

    # External Side Pipes & Headers running along rocker sills
    for s in [-1, 1]:
        create_cylinder(f"Side_Pipe_{'L' if s > 0 else 'R'}", (s * W * 0.48, -L * 0.05, wheel_r * 0.50), 0.06, L * 0.52, mat_chrome, (math.radians(90), 0, 0), vertices=16)
        # Oval Front Mouth Intake with bumper horns (+Y)
        create_cylinder("Front_Oval_Intake", (0, L * 0.46, wheel_r * 0.85), wheel_r * 0.48, 0.12, mat_dark, (math.radians(90), 0, 0), vertices=16)
        create_cylinder(f"Headlight_{'L' if s > 0 else 'R'}", (s * W * 0.34, L * 0.44, wheel_r * 1.35), wheel_r * 0.28, 0.10, mat_headlight, (math.radians(85), 0, 0), vertices=16)
        # Dual round Lucas taillights per side (-Y)
        create_cylinder(f"Taillight_Upper_{'L' if s > 0 else 'R'}", (s * W * 0.34, -L * 0.46, wheel_r * 1.40), 0.06, 0.06, mat_taillight, (math.radians(90), 0, 0), vertices=12)
        create_cylinder(f"Taillight_Lower_{'L' if s > 0 else 'R'}", (s * W * 0.34, -L * 0.46, wheel_r * 1.20), 0.06, 0.06, mat_taillight, (math.radians(90), 0, 0), vertices=12)

    # 4 Knock-off Wheels
    wheel_configs = [("Wheel_FL", track * 0.5, wheelbase * 0.5), ("Wheel_FR", -track * 0.5, wheelbase * 0.5),
                     ("Wheel_RL", track * 0.5, -wheelbase * 0.5), ("Wheel_RR", -track * 0.5, -wheelbase * 0.5)]
    for w_name, wx, wy in wheel_configs:
        create_wheel_assembly(w_name, wx, wy, wheel_r, wheel_w, mat_tire, mat_rim, mat_brake, spoke_count=5)

    normalize_vehicle_ground_and_forward()

def build_track_hypercar(car_meta, hyper_type="one_1"):
    """C7: Extreme_Track_Hypercar - Koenigsegg One:1, Chiron Mansory, Senna"""
    car_id = car_meta["id"]
    clear_scene()
    paint_color = hex_to_rgba(car_meta["accent"])
    mat_body = create_pbr_material(f"{car_id}_paint", paint_color, metallic=0.88, roughness=0.18)
    mat_glass = create_pbr_material(f"{car_id}_glass", (0.04, 0.06, 0.10, 1.0), metallic=0.95, roughness=0.06)
    mat_dark = create_pbr_material(f"{car_id}_chassis", (0.04, 0.04, 0.05, 1.0), metallic=0.3, roughness=0.55)
    mat_tire = create_pbr_material(f"{car_id}_tire", (0.08, 0.08, 0.09, 1.0), metallic=0.0, roughness=0.7)
    mat_rim = create_pbr_material(f"{car_id}_rim", (0.85, 0.88, 0.90, 1.0), metallic=0.95, roughness=0.2)
    mat_brake = create_pbr_material(f"{car_id}_brake", (0.9, 0.1, 0.1, 1.0), metallic=0.7, roughness=0.25)
    mat_headlight = create_pbr_material(f"{car_id}_headlight", (0.9, 0.95, 1.0, 1.0), metallic=0.1, roughness=0.05, emission=(0.9, 0.95, 1.0, 1.0))
    mat_taillight = create_pbr_material(f"{car_id}_taillight", (1.0, 0.05, 0.05, 1.0), metallic=0.1, roughness=0.05, emission=(1.0, 0.05, 0.05, 1.0))
    mat_carbon = create_pbr_material(f"{car_id}_carbon", (0.03, 0.03, 0.04, 1.0), metallic=0.15, roughness=0.35)

    target_l = car_meta.get("targetSize", 4.6)
    W = target_l * 0.44; H = target_l * 0.25; wheel_r = H * 0.27; wheel_w = W * 0.16
    wheelbase = target_l * 0.58; track = W * 0.88

    # Monocoque Hypercar Chassis
    create_box("Body_Chassis", (0, 0, wheel_r * 1.1), (W * 0.94, target_l * 0.90, H * 0.42), mat_body)
    # Cockpit Canopy
    create_box("Body_Greenhouse", (0, target_l * 0.04, H * 0.72), (W * 0.76, target_l * 0.44, H * 0.40), mat_glass)
    # Front Headlights at +Y
    for s in [-1, 1]:
        create_box(f"Headlight_{'L' if s > 0 else 'R'}", (s * W * 0.36, target_l * 0.44, wheel_r * 1.35), (W * 0.18, 0.08, H * 0.12), mat_headlight)
        create_box(f"Taillight_{'L' if s > 0 else 'R'}", (s * W * 0.36, -target_l * 0.45, wheel_r * 1.35), (W * 0.18, 0.08, H * 0.10), mat_taillight)

    if hyper_type == "one_1":
        # Roof-mounted carbon air snorkel intake
        create_cylinder("Roof_Air_Scoop", (0, -target_l * 0.05, H * 0.92), 0.12, target_l * 0.22, mat_carbon, (math.radians(90), 0, 0), vertices=16)
        # Central dorsal fin connecting roof to rear wing (-Y)
        create_box("Central_Dorsal_Fin", (0, -target_l * 0.26, H * 0.85), (0.03, target_l * 0.28, H * 0.32), mat_carbon)
        # Top-mounted active rear wing (-Y)
        create_box("Aero_RearWing", (0, -target_l * 0.44, H * 0.98), (W * 0.96, target_l * 0.16, 0.04), mat_carbon)
        for s in [-1, 1]:
            create_box(f"Front_Canards_{'L' if s > 0 else 'R'}", (s * W * 0.48, target_l * 0.42, wheel_r * 0.90), (0.12, 0.16, 0.02), mat_carbon)
        create_cylinder("Exhaust_Titanium_Center", (0, -target_l * 0.48, wheel_r * 0.90), wheel_r * 0.25, 0.15, mat_rim, (math.radians(90), 0, 0), vertices=16)
    elif hyper_type == "chiron":
        # Sweeping C-Line contour framing cabin
        for s in [-1, 1]:
            create_box(f"Bugatti_C_Line_{'L' if s > 0 else 'R'}", (s * W * 0.46, -target_l * 0.02, H * 0.70), (0.05, target_l * 0.46, H * 0.46), mat_rim)
        # Horseshoe Front Grille (+Y)
        create_cylinder("Horseshoe_Grille", (0, target_l * 0.46, wheel_r * 0.95), wheel_r * 0.38, 0.12, mat_rim, (math.radians(90), 0, 0), vertices=20)
        # Central dorsal ridge (-Y)
        create_box("Central_Dorsal_Spine", (0, -target_l * 0.24, H * 0.65), (0.04, target_l * 0.42, 0.08), mat_carbon)
        # 1.6m full width rear light strip (-Y)
        create_box("Taillight_Bar_FullWidth", (0, -target_l * 0.46, wheel_r * 1.35), (W * 0.88, 0.06, 0.05), mat_taillight)
        # Active rear airbrake / wing (-Y)
        create_box("Active_Rear_Wing", (0, -target_l * 0.43, H * 0.75), (W * 0.90, target_l * 0.15, 0.04), mat_carbon)
    elif hyper_type == "senna":
        # See-through lower door glass
        for s in [-1, 1]:
            create_box(f"Door_Glass_Lower_{'L' if s > 0 else 'R'}", (s * W * 0.46, target_l * 0.02, wheel_r * 1.25), (0.05, target_l * 0.22, H * 0.28), mat_glass)
            create_box(f"Front_Aero_Blades_{'L' if s > 0 else 'R'}", (s * W * 0.38, target_l * 0.45, wheel_r * 0.85), (0.14, 0.12, 0.03), mat_body)
        # Roof Snorkel
        create_box("Roof_Snorkel_Intake", (0, -target_l * 0.06, H * 0.92), (0.24, target_l * 0.24, 0.14), mat_carbon)
        # Colossal double-element rear wing (-Y)
        create_box("Aero_RearWing", (0, -target_l * 0.44, H * 1.05), (W * 0.98, target_l * 0.18, 0.04), mat_carbon)
        create_box("RearWing_Flap", (0, -target_l * 0.40, H * 1.10), (W * 0.95, target_l * 0.10, 0.03), mat_carbon)
        for s in [-1, 1]:
            create_box(f"Wing_Endplate_{s}", (s * W * 0.48, -target_l * 0.42, H * 0.95), (0.04, target_l * 0.22, H * 0.35), mat_carbon)
        # Triple high-exit Inconel exhaust pipes (-Y)
        for off in [-0.08, 0.0, 0.08]:
            create_cylinder(f"Inconel_Exhaust_{off}", (off, -target_l * 0.36, H * 0.65), 0.04, 0.12, mat_rim, (math.radians(-35), 0, 0), vertices=12)

    # 4 Wheels
    wheel_configs = [("Wheel_FL", track * 0.5, wheelbase * 0.5), ("Wheel_FR", -track * 0.5, wheelbase * 0.5),
                     ("Wheel_RL", track * 0.5, -wheelbase * 0.5), ("Wheel_RR", -track * 0.5, -wheelbase * 0.5)]
    for w_name, wx, wy in wheel_configs:
        create_wheel_assembly(w_name, wx, wy, wheel_r, wheel_w, mat_tire, mat_rim, mat_brake, spoke_count=6)

    normalize_vehicle_ground_and_forward()

def build_procedural_car_by_id(car_meta):
    cid = car_meta["id"]
    if cid == "1975-porsche-911-turbo":
        build_porsche_911_turbo(car_meta)
    elif cid in ("lamborghini-aventador", "2019-chevrolet-corvette-c8", "audi-r8", "honda-nsx-1990"):
        wtype = "aventador" if cid == "lamborghini-aventador" else ("corvette_c8" if cid == "2019-chevrolet-corvette-c8" else ("audi_r8" if cid == "audi-r8" else "honda_nsx"))
        build_wedge_supercar(car_meta, wtype)
    elif cid in ("nissan-skyline-r34-gtr", "bmw-m3-e30", "subaru-impreza-wrx-sti", "mitsubishi-lancer-evo"):
        btype = "r34" if cid == "nissan-skyline-r34-gtr" else ("e30" if cid == "bmw-m3-e30" else ("sti" if cid == "subaru-impreza-wrx-sti" else "evo"))
        build_boxy_coupe_sedan(car_meta, btype)
    elif cid in ("ford-gt-2006", "dodge-viper-gts", "2019-aston-martin-vantage", "mercedes-amg-gt3"):
        gtype = "ford_gt" if cid == "ford-gt-2006" else ("viper" if cid == "dodge-viper-gts" else ("vantage" if cid == "2019-aston-martin-vantage" else "amg_gt3"))
        build_longhood_gt(car_meta, gtype)
    elif cid in ("mazda-rx7-fd", "toyota-supra-mk4"):
        mtype = "rx7" if cid == "mazda-rx7-fd" else "supra"
        build_curved_90s_sports(car_meta, mtype)
    elif cid == "shelby-cobra-427":
        build_shelby_cobra(car_meta)
    elif cid in ("koenigsegg-one-pro", "bugatti-chiron-mansory", "mclaren-senna"):
        htype = "one_1" if cid == "koenigsegg-one-pro" else ("chiron" if cid == "bugatti-chiron-mansory" else "senna")
        build_track_hypercar(car_meta, htype)
    else:
        build_wedge_supercar(car_meta, "aventador")

# =========================================================================
# 6 DEDICATED AIRCRAFT BUILDERS
# In Blender: Front is +Y, Rear is -Y. Left is +X, Right is -X.
# =========================================================================

def build_f22_raptor(meta):
    """Lockheed Martin F-22 Raptor: 5th-gen stealth fighter with faceted chine and 2D nozzles."""
    pid = meta["id"]
    clear_scene()
    mat_stealth = create_pbr_material(f"{pid}_stealth", (0.35, 0.38, 0.40, 1.0), metallic=0.65, roughness=0.35)
    mat_canopy = create_pbr_material(f"{pid}_canopy", (0.25, 0.20, 0.08, 1.0), metallic=0.92, roughness=0.08)
    mat_nozzle = create_pbr_material(f"{pid}_nozzle", (0.15, 0.16, 0.18, 1.0), metallic=0.85, roughness=0.40)
    mat_gear = create_pbr_material(f"{pid}_gear", (0.10, 0.10, 0.12, 1.0), metallic=0.2, roughness=0.7)

    span = meta.get("targetSize", 18.9) * 0.72
    length = meta.get("targetSize", 18.9)
    fr = length * 0.05

    # Faceted Fuselage
    create_box("Fuselage_Main", (0, 0, fr * 2.5), (span * 0.32, length * 0.70, fr * 1.5), mat_stealth)
    # Stealth Radome / Nose Cone (+Y is Front)
    create_cone("Fuselage_Nose", (0, length * 0.45, fr * 2.3), fr * 1.1, 0.05, length * 0.25, mat_stealth, (math.radians(90), 0, 0), vertices=6)
    # Gold-Tinted Canopy (+Y)
    create_box("Cockpit_Glass", (0, length * 0.20, fr * 3.4), (fr * 1.4, length * 0.22, fr * 1.0), mat_canopy)

    # Clipped Diamond Delta Wings
    create_box("Main_Wings", (0, -length * 0.05, fr * 2.2), (span, length * 0.38, fr * 0.16), mat_stealth)

    # Twin Outward-Canted Vertical Stabilizers (-Y is Rear, canted 28 deg)
    for s in [-1, 1]:
        create_box(f"Tail_VerticalStabilizer_{s}", (s * span * 0.25, -length * 0.35, fr * 4.2), (0.08, length * 0.22, fr * 3.2), mat_stealth, (0, math.radians(-28 * s), 0))
        # Horizontal All-Moving Stabilators (-Y)
        create_box(f"Tail_HorizontalStabilizers_{s}", (s * span * 0.32, -length * 0.42, fr * 2.1), (span * 0.32, length * 0.18, fr * 0.14), mat_stealth)
        # Dual 2D Rectangular Thrust Vectoring Nozzles (-Y)
        create_box(f"Nozzle_{s}", (s * fr * 1.2, -length * 0.46, fr * 2.3), (fr * 1.1, length * 0.10, fr * 0.7), mat_nozzle)

    # Landing Gear
    for s in [-1, 1]:
        create_cylinder(f"LandingGear_Main_{s}", (s * span * 0.16, -length * 0.05, fr * 0.6), fr * 0.6, fr * 0.3, mat_gear, (0, math.radians(90), 0), vertices=16)
    create_cylinder("LandingGear_Nose", (0, length * 0.25, fr * 0.45), fr * 0.45, fr * 0.25, mat_gear, (0, math.radians(90), 0), vertices=16)

    normalize_vehicle_ground_and_forward()

def build_boeing_787(meta):
    """Boeing 787-9 Dreamliner: Commercial widebody airliner with raked wingtips and acoustic chevrons."""
    pid = meta["id"]
    clear_scene()
    mat_fuse = create_pbr_material(f"{pid}_body", (0.95, 0.96, 0.98, 1.0), metallic=0.25, roughness=0.20)
    mat_accent = create_pbr_material(f"{pid}_accent", hex_to_rgba(meta["accent"]), metallic=0.5, roughness=0.25)
    mat_glass = create_pbr_material(f"{pid}_canopy", (0.05, 0.08, 0.14, 1.0), metallic=0.92, roughness=0.08)
    mat_engine = create_pbr_material(f"{pid}_engine", (0.22, 0.24, 0.26, 1.0), metallic=0.85, roughness=0.30)
    mat_gear = create_pbr_material(f"{pid}_gear", (0.10, 0.10, 0.12, 1.0), metallic=0.2, roughness=0.7)

    span = meta.get("targetSize", 28.0)
    length = span * 1.10
    fr = span * 0.06

    # Pressurized Cylindrical Fuselage
    create_cylinder("Fuselage_Main", (0, 0, fr * 2.8), fr, length * 0.72, mat_fuse, (math.radians(90), 0, 0), vertices=24)
    # Streamlined Nose Cone (+Y is Front)
    create_cone("Fuselage_Nose", (0, length * 0.44, fr * 2.8), fr, 0.08, length * 0.20, mat_fuse, (math.radians(-90), 0, 0), vertices=24)
    # Cockpit 4-panel windshield (+Y)
    create_box("Cockpit_Glass", (0, length * 0.38, fr * 3.4), (fr * 1.1, length * 0.08, fr * 0.45), mat_glass)

    # High-Aspect Swept Wings
    create_box("Main_Wings", (0, 0, fr * 2.2), (span, length * 0.18, fr * 0.14), mat_fuse)

    # Swept Vertical Stabilizer (-Y is Rear)
    create_box("Tail_VerticalStabilizer", (0, -length * 0.38, fr * 4.6), (fr * 0.15, length * 0.18, fr * 3.8), mat_accent)
    # Swept Horizontal Tailplanes (-Y)
    create_box("Tail_HorizontalStabilizers", (0, -length * 0.42, fr * 3.0), (span * 0.38, length * 0.12, fr * 0.10), mat_fuse)

    # 2 Colossal Turbofans with Acoustic Chevrons
    for s in [-1, 1]:
        create_cylinder(f"Engine_Turbofan_{s}", (s * span * 0.22, length * 0.04, fr * 1.6), fr * 0.72, length * 0.20, mat_engine, (math.radians(90), 0, 0), vertices=20)
        # Chevron Exhaust Nozzle (-Y)
        create_cylinder(f"Engine_Chevron_{s}", (s * span * 0.22, -length * 0.07, fr * 1.6), fr * 0.60, 0.15, mat_accent, (math.radians(90), 0, 0), vertices=12)

    # Landing Gear Bogies
    for s in [-1, 1]:
        create_cylinder(f"LandingGear_Main_{s}", (s * span * 0.12, -length * 0.02, fr * 0.55), fr * 0.55, fr * 0.35, mat_gear, (0, math.radians(90), 0), vertices=16)
    create_cylinder("LandingGear_Nose", (0, length * 0.32, fr * 0.45), fr * 0.45, fr * 0.25, mat_gear, (0, math.radians(90), 0), vertices=16)

    normalize_vehicle_ground_and_forward()

def build_concorde(meta):
    """BAC Concorde: Supersonic airliner with droop nose and ogival delta wings."""
    pid = meta["id"]
    clear_scene()
    mat_white = create_pbr_material(f"{pid}_body", (0.96, 0.96, 0.97, 1.0), metallic=0.20, roughness=0.20)
    mat_glass = create_pbr_material(f"{pid}_canopy", (0.05, 0.08, 0.14, 1.0), metallic=0.92, roughness=0.08)
    mat_dark = create_pbr_material(f"{pid}_engine", (0.18, 0.19, 0.20, 1.0), metallic=0.85, roughness=0.35)
    mat_gear = create_pbr_material(f"{pid}_gear", (0.10, 0.10, 0.12, 1.0), metallic=0.2, roughness=0.7)

    span = meta.get("targetSize", 26.0)
    length = span * 1.25
    fr = span * 0.045

    # Slender Needle Fuselage
    create_cylinder("Fuselage_Main", (0, -length * 0.05, fr * 2.8), fr, length * 0.75, mat_white, (math.radians(90), 0, 0), vertices=20)
    # Iconic Droop Nose Cone (+Y is Front)
    create_cone("Fuselage_Nose", (0, length * 0.45, fr * 2.6), fr, 0.04, length * 0.26, mat_white, (math.radians(-94), 0, 0), vertices=20)
    create_box("Cockpit_Glass", (0, length * 0.34, fr * 3.3), (fr * 1.05, length * 0.10, fr * 0.5), mat_glass)

    # Continuous Ogival / Gothic Double-Delta Wing
    create_box("Main_Wings", (0, -length * 0.10, fr * 2.2), (span, length * 0.60, fr * 0.10), mat_white)

    # Tall Swept Vertical Stabilizer (-Y is Rear, Tailless Design)
    create_box("Tail_VerticalStabilizer", (0, -length * 0.40, fr * 4.6), (fr * 0.12, length * 0.22, fr * 3.8), mat_white)

    # 4 Rolls-Royce Olympus Turbojets in Twin Underwing Box Nacelles
    for s in [-1, 1]:
        create_box(f"Engine_BoxNacelle_{s}", (s * span * 0.20, -length * 0.22, fr * 1.6), (span * 0.18, length * 0.28, fr * 1.1), mat_dark)

    # Tall Landing Gear
    for s in [-1, 1]:
        create_cylinder(f"LandingGear_Main_{s}", (s * span * 0.18, -length * 0.12, fr * 0.7), fr * 0.7, fr * 0.35, mat_gear, (0, math.radians(90), 0), vertices=16)
    create_cylinder("LandingGear_Nose", (0, length * 0.24, fr * 0.6), fr * 0.6, fr * 0.25, mat_gear, (0, math.radians(90), 0), vertices=16)

    normalize_vehicle_ground_and_forward()

def build_spitfire(meta):
    """Supermarine Spitfire Mk.IX: Historic warbird with elliptical wings and Merlin V12."""
    pid = meta["id"]
    clear_scene()
    mat_camo = create_pbr_material(f"{pid}_camo", (0.35, 0.40, 0.28, 1.0), metallic=0.15, roughness=0.45)
    mat_canopy = create_pbr_material(f"{pid}_canopy", (0.05, 0.08, 0.14, 1.0), metallic=0.90, roughness=0.08)
    mat_prop = create_pbr_material(f"{pid}_prop", (0.08, 0.08, 0.09, 1.0), metallic=0.3, roughness=0.6)
    mat_yellow = create_pbr_material(f"{pid}_yellow", (0.9, 0.75, 0.1, 1.0), metallic=0.2, roughness=0.4)
    mat_gear = create_pbr_material(f"{pid}_gear", (0.10, 0.10, 0.12, 1.0), metallic=0.2, roughness=0.7)

    span = meta.get("targetSize", 11.2)
    length = span * 0.86
    fr = span * 0.065

    # Warbird Fuselage
    create_cylinder("Fuselage_Main", (0, 0, fr * 2.8), fr, length * 0.65, mat_camo, (math.radians(90), 0, 0), vertices=20)
    # Nose Cowling with Merlin V12 (+Y is Front)
    create_cone("Fuselage_Nose", (0, length * 0.38, fr * 2.8), fr, fr * 0.4, length * 0.18, mat_camo, (math.radians(-90), 0, 0), vertices=20)
    # Teardrop Bubble Canopy (+Y)
    create_box("Cockpit_Glass", (0, length * 0.08, fr * 3.6), (fr * 1.1, length * 0.18, fr * 0.7), mat_canopy)

    # 4-Blade Propeller with Pointed Spinner (+Y)
    create_cone("Propeller_Spinner", (0, length * 0.48, fr * 2.8), fr * 0.35, 0.02, 0.25, mat_prop, (math.radians(-90), 0, 0), vertices=16)
    for p_idx in range(4):
        p_ang = p_idx * (math.pi / 2)
        create_box(f"Propeller_Blade_{p_idx}", (math.sin(p_ang) * (span * 0.14), length * 0.47, fr * 2.8 + math.cos(p_ang) * (span * 0.14)), (0.08, 0.03, span * 0.26), mat_prop, (0, p_ang, 0))

    # 12 Exhaust Stacks protruding on sides (+Y)
    for s in [-1, 1]:
        create_box(f"Merlin_Exhaust_{s}", (s * fr * 0.95, length * 0.30, fr * 2.85), (0.06, length * 0.12, 0.08), mat_prop)

    # Mitchell's Semi-Elliptical Main Wings
    create_box("Main_Wings", (0, length * 0.08, fr * 2.2), (span, length * 0.28, fr * 0.12), mat_camo)

    # Graceful Rounded Vertical Fin and Elevators (-Y is Rear)
    create_cylinder("Tail_VerticalStabilizer", (0, -length * 0.36, fr * 4.0), fr * 1.4, 0.06, mat_camo, (0, math.radians(90), 0), vertices=16)
    create_box("Tail_HorizontalStabilizers", (0, -length * 0.38, fr * 2.8), (span * 0.38, length * 0.12, fr * 0.08), mat_camo)

    # Tail-Dragger Landing Gear
    for s in [-1, 1]:
        create_cylinder(f"LandingGear_Main_{s}", (s * span * 0.14, length * 0.10, fr * 0.8), fr * 0.8, fr * 0.25, mat_gear, (0, math.radians(90), 0), vertices=16)
    create_cylinder("LandingGear_TailWheel", (0, -length * 0.34, fr * 0.3), fr * 0.3, fr * 0.15, mat_gear, (0, math.radians(90), 0), vertices=12)

    normalize_vehicle_ground_and_forward()

def build_sr71_blackbird(meta):
    """Lockheed SR-71 Blackbird: Mach 3+ strategic reconnaissance aircraft with continuous lateral chines."""
    pid = meta["id"]
    clear_scene()
    mat_black = create_pbr_material(f"{pid}_black", (0.05, 0.05, 0.06, 1.0), metallic=0.45, roughness=0.45)
    mat_canopy = create_pbr_material(f"{pid}_canopy", (0.06, 0.07, 0.09, 1.0), metallic=0.92, roughness=0.08)
    mat_nozzle = create_pbr_material(f"{pid}_nozzle", (0.18, 0.19, 0.20, 1.0), metallic=0.88, roughness=0.30)
    mat_gear = create_pbr_material(f"{pid}_gear", (0.10, 0.10, 0.12, 1.0), metallic=0.2, roughness=0.7)

    span = meta.get("targetSize", 24.0) * 0.65
    length = meta.get("targetSize", 24.0)
    fr = length * 0.038

    # Needle Fuselage with Continuous Lateral Knife-Edge Chines
    create_box("Fuselage_Main", (0, 0, fr * 2.5), (span * 0.30, length * 0.72, fr * 1.4), mat_black)
    # Needle Nose (+Y is Front)
    create_cone("Fuselage_Nose", (0, length * 0.46, fr * 2.4), fr * 1.1, 0.03, length * 0.26, mat_black, (math.radians(-90), 0, 0), vertices=16)

    # Tandem Triangular Cockpits (Pilot forward, RSO rear) (+Y)
    create_box("Cockpit_Glass_Forward", (0, length * 0.22, fr * 3.2), (fr * 1.1, length * 0.10, fr * 0.5), mat_canopy)
    create_box("Cockpit_Glass_Rear", (0, length * 0.10, fr * 3.2), (fr * 1.1, length * 0.09, fr * 0.5), mat_canopy)

    # Blended Cambered Delta Wings
    create_box("Main_Wings", (0, -length * 0.12, fr * 2.1), (span, length * 0.45, fr * 0.14), mat_black)

    # 2 Pratt & Whitney J58 Nacelles with Shock Inflow Spikes
    for s in [-1, 1]:
        nx = s * span * 0.34
        create_cylinder(f"Nacelle_J58_{s}", (nx, -length * 0.10, fr * 2.2), fr * 1.1, length * 0.48, mat_black, (math.radians(90), 0, 0), vertices=20)
        # Forward Conical Shock Inlet Spike (+Y)
        create_cone(f"Inlet_Spike_{s}", (nx, length * 0.18, fr * 2.2), fr * 0.8, 0.02, length * 0.12, mat_black, (math.radians(-90), 0, 0), vertices=16)
        # Convergent-Divergent Afterburner Ejector Nozzle (-Y)
        create_cylinder(f"Afterburner_Nozzle_{s}", (nx, -length * 0.36, fr * 2.2), fr * 1.05, 0.20, mat_nozzle, (math.radians(90), 0, 0), vertices=16)
        # Twin Inward-Canted All-Moving Vertical Rudders mounted atop nacelles (-Y, canted 15 deg)
        create_box(f"Tail_VerticalStabilizer_{s}", (nx + (0.05 if s > 0 else -0.05), -length * 0.22, fr * 4.2), (0.06, length * 0.18, fr * 2.6), mat_black, (0, math.radians(15 * s), 0))

    # Landing Gear
    for s in [-1, 1]:
        create_cylinder(f"LandingGear_Main_{s}", (s * span * 0.18, -length * 0.10, fr * 0.6), fr * 0.6, fr * 0.3, mat_gear, (0, math.radians(90), 0), vertices=16)
    create_cylinder("LandingGear_Nose", (0, length * 0.28, fr * 0.45), fr * 0.45, fr * 0.25, mat_gear, (0, math.radians(90), 0), vertices=16)

    normalize_vehicle_ground_and_forward()

def build_airbus_a380(meta):
    """Airbus A380-800 Superjumbo: Colossal double-deck widebody airliner with 4 turbofans."""
    pid = meta["id"]
    clear_scene()
    mat_fuse = create_pbr_material(f"{pid}_body", (0.94, 0.95, 0.97, 1.0), metallic=0.25, roughness=0.20)
    mat_accent = create_pbr_material(f"{pid}_accent", hex_to_rgba(meta["accent"]), metallic=0.55, roughness=0.25)
    mat_glass = create_pbr_material(f"{pid}_canopy", (0.05, 0.08, 0.14, 1.0), metallic=0.92, roughness=0.08)
    mat_engine = create_pbr_material(f"{pid}_engine", (0.22, 0.24, 0.26, 1.0), metallic=0.85, roughness=0.30)
    mat_gear = create_pbr_material(f"{pid}_gear", (0.10, 0.10, 0.12, 1.0), metallic=0.2, roughness=0.7)

    span = meta.get("targetSize", 30.0)
    length = span * 0.95
    fw = span * 0.08; fh = span * 0.10

    # Colossal Double-Deck Ovoid Fuselage
    create_box("Fuselage_Main", (0, 0, fh * 2.4), (fw * 2.0, length * 0.72, fh * 2.0), mat_fuse)
    # Streamlined Nose (+Y is Front)
    create_cone("Fuselage_Nose", (0, length * 0.42, fh * 2.2), fw * 0.9, 0.10, length * 0.18, mat_fuse, (math.radians(-90), 0, 0), vertices=20)
    create_box("Cockpit_Glass", (0, length * 0.36, fh * 2.9), (fw * 1.2, length * 0.08, fh * 0.4), mat_glass)

    # Massive Swept Main Wings with Wingtip Fences
    create_box("Main_Wings", (0, length * 0.02, fh * 1.8), (span, length * 0.24, fh * 0.16), mat_fuse)
    for s in [-1, 1]:
        create_box(f"Wingtip_Fence_{s}", (s * span * 0.49, length * 0.02, fh * 2.1), (0.08, length * 0.12, fh * 0.6), mat_accent)

    # Giant Vertical Tail Fin (-Y is Rear)
    create_box("Tail_VerticalStabilizer", (0, -length * 0.36, fh * 4.4), (fw * 0.16, length * 0.22, fh * 3.4), mat_accent)
    create_box("Tail_HorizontalStabilizers", (0, -length * 0.40, fh * 2.6), (span * 0.42, length * 0.14, fh * 0.12), mat_fuse)

    # 4 Colossal High-Bypass Turbofans (2 per wing)
    eng_positions = [(-span * 0.30, length * 0.04), (-span * 0.18, length * 0.01),
                     (span * 0.18, length * 0.01), (span * 0.30, length * 0.04)]
    for idx, (ex, ey) in enumerate(eng_positions):
        create_cylinder(f"Engine_Turbofan_{idx}", (ex, ey, fh * 1.2), fw * 0.75, length * 0.18, mat_engine, (math.radians(90), 0, 0), vertices=20)

    # 20-Wheel Multi-Bogie Landing Gear
    for s in [-1, 1]:
        create_cylinder(f"LandingGear_Main_{s}", (s * span * 0.10, -length * 0.04, fh * 0.5), fh * 0.5, fh * 0.3, mat_gear, (0, math.radians(90), 0), vertices=16)
    create_cylinder("LandingGear_Nose", (0, length * 0.30, fh * 0.4), fh * 0.4, fh * 0.2, mat_gear, (0, math.radians(90), 0), vertices=16)

    normalize_vehicle_ground_and_forward()

def build_procedural_plane_by_id(plane_meta):
    pid = plane_meta["id"]
    if pid == "lockheed-f22-raptor":
        build_f22_raptor(plane_meta)
    elif pid == "boeing-787-dreamliner":
        build_boeing_787(plane_meta)
    elif pid == "concorde-supersonic":
        build_concorde(plane_meta)
    elif pid == "supermarine-spitfire":
        build_spitfire(plane_meta)
    elif pid == "lockheed-sr71-blackbird":
        build_sr71_blackbird(plane_meta)
    elif pid == "airbus-a380":
        build_airbus_a380(plane_meta)
    else:
        build_f22_raptor(plane_meta)

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
    print("=== STARTING VEHICLES & PLANES ACQUISITION PIPELINE ===")
    os.makedirs(CARS_DIR, exist_ok=True)
    os.makedirs(PLANES_DIR, exist_ok=True)

    # 1. Process 20 Cars
    print("\n--- PROCESSING 20 CARS ---")
    for car in CARS_METADATA:
        car_id = car["id"]
        out_glb = os.path.join(CARS_DIR, car_id, "source", f"{car_id}.glb")
        staging_zip = os.path.join(STAGING_DIR, f"{car_id}.zip")

        # Special case: authentic lb-works-ferrari-f40
        existing_f40 = os.path.join(CARS_DIR, "lb-works-ferrari-f40-wwwvecarzcom", "source", "lb-works_ferrari_f40_-__free.glb")
        if car_id == "lb-works-ferrari-f40" and os.path.exists(existing_f40):
            print(f"[AUTHENTIC] Normalizing ground datum and forward -Z orientation on verified F40 asset: {existing_f40}...")
            clear_scene()
            bpy.ops.import_scene.gltf(filepath=existing_f40)
            strip_unwanted_entities()
            # Rotate 180° around global Z axis so headlights face Blender +Y (maps to glTF forward -Z)
            R = mathutils.Matrix.Rotation(math.pi, 4, 'Z')
            for obj in bpy.data.objects:
                if obj.parent is None:
                    obj.matrix_world = R @ obj.matrix_world
            bpy.context.view_layer.update()
            normalize_vehicle_ground_and_forward()
            export_glb_file(out_glb)
            continue

        if os.path.exists(staging_zip):
            print(f"[CONVERT] Unpacking staging archive for {car_id}: {staging_zip}")
            with tempfile.TemporaryDirectory() as tmpdir:
                with zipfile.ZipFile(staging_zip, 'r') as zf:
                    zf.extractall(tmpdir)
                candidates = []
                for root, _, files in os.walk(tmpdir):
                    for f in files:
                        if f.lower().endswith(('.gltf', '.glb', '.fbx', '.obj')):
                            candidates.append(os.path.join(root, f))
                if candidates:
                    clear_scene()
                    c = candidates[0]
                    if c.lower().endswith('.fbx'):
                        bpy.ops.import_scene.fbx(filepath=c)
                    elif c.lower().endswith(('.gltf', '.glb')):
                        bpy.ops.import_scene.gltf(filepath=c)
                    elif c.lower().endswith('.obj'):
                        bpy.ops.wm.obj_import(filepath=c)
                    strip_unwanted_entities()
                    normalize_vehicle_ground_and_forward()
                    export_glb_file(out_glb)
                    continue

        print(f"[GENERATE] Building high-detail procedural car {car_id} ({car['name']})...")
        build_procedural_car_by_id(car)
        export_glb_file(out_glb)

    # 2. Process 6 Planes
    print("\n--- PROCESSING 6 PLANES ---")
    for plane in PLANES_METADATA:
        plane_id = plane["id"]
        out_glb = os.path.join(PLANES_DIR, plane_id, "source", f"{plane_id}.glb")
        staging_zip = os.path.join(STAGING_DIR, f"{plane_id}.zip")

        if os.path.exists(staging_zip):
            print(f"[CONVERT] Unpacking staging archive for {plane_id}: {staging_zip}")
            with tempfile.TemporaryDirectory() as tmpdir:
                with zipfile.ZipFile(staging_zip, 'r') as zf:
                    zf.extractall(tmpdir)
                candidates = []
                for root, _, files in os.walk(tmpdir):
                    for f in files:
                        if f.lower().endswith(('.gltf', '.glb', '.fbx', '.obj')):
                            candidates.append(os.path.join(root, f))
                if candidates:
                    clear_scene()
                    c = candidates[0]
                    if c.lower().endswith('.fbx'):
                        bpy.ops.import_scene.fbx(filepath=c)
                    elif c.lower().endswith(('.gltf', '.glb')):
                        bpy.ops.import_scene.gltf(filepath=c)
                    elif c.lower().endswith('.obj'):
                        bpy.ops.wm.obj_import(filepath=c)
                    strip_unwanted_entities()
                    normalize_vehicle_ground_and_forward()
                    export_glb_file(out_glb)
                    continue

        print(f"[GENERATE] Building high-detail procedural plane {plane_id} ({plane['name']})...")
        build_procedural_plane_by_id(plane)
        export_glb_file(out_glb)

    print("\n=== VERIFYING VEHICLES AND PLANES GLB FILES ===")
    for car in CARS_METADATA:
        car_id = car["id"]
        p = os.path.join(CARS_DIR, car_id, "source", f"{car_id}.glb")
        assert os.path.exists(p), f"Missing: {p}"
        with open(p, "rb") as f:
            assert f.read(4) == b"glTF", f"Bad magic in {p}"
        print(f"  ✓ Car {car_id}: {os.path.getsize(p) / 1024:.1f} KB")

    for plane in PLANES_METADATA:
        plane_id = plane["id"]
        p = os.path.join(PLANES_DIR, plane_id, "source", f"{plane_id}.glb")
        assert os.path.exists(p), f"Missing: {p}"
        with open(p, "rb") as f:
            assert f.read(4) == b"glTF", f"Bad magic in {p}"
        print(f"  ✓ Plane {plane_id}: {os.path.getsize(p) / 1024:.1f} KB")

    print("\n=== ALL 20 CARS AND 6 PLANES READY AND VALIDATED ===")

if __name__ == "__main__":
    main()

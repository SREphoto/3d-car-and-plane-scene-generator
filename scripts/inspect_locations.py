import bpy, os

def check(name, path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if not os.path.exists(path):
        print("Missing:", path)
        return
    bpy.ops.import_scene.gltf(filepath=path)
    print(f"\n==================== {name} ====================")
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            z_vals = [(o.matrix_world @ v.co).z for v in o.data.vertices]
            if z_vals:
                min_z = min(z_vals)
                max_z = max(z_vals)
                # Check bounding box center and dimensions
                dims = o.dimensions
                print(f"  Mesh '{o.name}': min_Z={min_z:.3f}, max_Z={max_z:.3f}, dims=({dims.x:.2f}, {dims.y:.2f}, {dims.z:.2f})")

check("interior_7", "3D Car and Plane Scene Creator/Locations/interior_7.glb")
check("car_garage", "3D Car and Plane Scene Creator/Locations/car_garage.glb")

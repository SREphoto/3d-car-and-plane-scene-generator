#!/usr/bin/env python3
"""
scripts/batch_ingest_sketchfab.py
Automated pipeline to download authentic 3D models from Sketchfab using
tools/sketchfab-cli, convert them in headless Blender with PBR textures,
normalized scale, and ground datum contact (Z = 0), and export them as binary .glb.

Usage:
  python3 scripts/batch_ingest_sketchfab.py --category parts
  python3 scripts/batch_ingest_sketchfab.py --category planes
  python3 scripts/batch_ingest_sketchfab.py --category locations
  python3 scripts/batch_ingest_sketchfab.py --category cars
  python3 scripts/batch_ingest_sketchfab.py --all
"""

import os
import sys
import glob
import json
import shutil
import subprocess
import argparse

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS_ROOT = os.path.join(REPO_ROOT, "3D Car and Plane Scene Creator")
STAGING_DIR = os.path.join(REPO_ROOT, "tmp", "sf_staging")
SKETCHFAB_CLI_DIR = "/Users/Samuel/2026-F1-Nimble-Car/2026-F1-Nimble-Car/tools/sketchfab-cli"
BLENDER_BIN = "/Applications/Blender.app/Contents/MacOS/Blender"
PROCESSOR_SCRIPT = os.path.join(REPO_ROOT, "scripts", "process_model_blender.py")

CAR_PARTS = [
    {"id": "v8-engine", "uid": "90c115119767433fbf6f33dda1302893", "name": "V8 Performance Engine Block", "category": "Engine & Powertrain", "targetSize": 0.95},
    {"id": "car-turbocharger", "uid": "086dde202cd7436cbae2ba77c2a4549b", "name": "Twin-Scroll Billet Turbocharger", "category": "Forced Induction", "targetSize": 0.35},
    {"id": "bbs-rs16-wheel-rim", "uid": "4e50d45e5ff04d00927a50c150e088c1", "name": "BBS RS16 3-Piece Tuner Wheel", "category": "Wheels & Brakes", "targetSize": 0.58},
    {"id": "brembo-brake-caliper", "uid": "34922927f45f4d56b72f4c7569ee12fb", "name": "Brembo 6-Piston Monobloc Caliper", "category": "Wheels & Brakes", "targetSize": 0.36},
    {"id": "recaro-speed-racing-seat", "uid": "aee04f6cc4304e689559e121f87b24f6", "name": "Recaro Speed Carbon Bucket Seat", "category": "Interior & Cockpit", "targetSize": 0.72},
    {"id": "race-steering-wheel-essenza", "uid": "7fd7543c58994fd09344d761978eecfa", "name": "Essenza SCV12 Racing Steering Wheel", "category": "Interior & Cockpit", "targetSize": 0.34},
    {"id": "bmw-m2-carbon-spoiler", "uid": "8cfd37cb5dd14596b88037f88293a96d", "name": "ADRO Carbon Fiber GT Wing & Aero Kit", "category": "Aerodynamics", "targetSize": 1.20},
    {"id": "exhaust-manifold-header", "uid": "e207a050afef44b8805e88acfa439cd7", "name": "Equal-Length Tubular Exhaust Header", "category": "Exhaust System", "targetSize": 0.65},
    {"id": "supercharged-sbc-v8-blower", "uid": "582d3f69b0f7460ea0e7d091bdf1f778", "name": "Roots 6-71 Supercharger Blower", "category": "Forced Induction", "targetSize": 0.62},
    {"id": "car-engine-alternator", "uid": "e94842c63e6b4557a20f5751779c7e7f", "name": "High-Output 220A Alternator", "category": "Electrical & Ignition", "targetSize": 0.28},
    {"id": "manual-transmission-gearbox", "uid": "d48d46543d844857b31475e56f941410", "name": "6-Speed Sequential Manual Gearbox", "category": "Engine & Powertrain", "targetSize": 0.88},
    {"id": "rim-tg002-forged-wheel", "uid": "1d9f3ca0323b4d528cdf37705b9f8769", "name": "TG002 Luftrotor Forged Aero Wheel", "category": "Wheels & Brakes", "targetSize": 0.55},
    {"id": "blue-coilovers-suspension", "uid": "942e15e4902f4d2ea98c9c9f79e15339", "name": "3-Way Adjustable Coilover Strut", "category": "Suspension & Steering", "targetSize": 0.65},
    {"id": "sbc-v8-intake-manifold", "uid": "9bdb8ebcdfaa4a5e9708bc77e3c78709", "name": "High-Rise Aluminum Intake Manifold", "category": "Engine & Powertrain", "targetSize": 0.58},
    {"id": "volvo-intercooler", "uid": "5da23008dd4b400a924a74da76c2725f", "name": "Bar & Plate Front Mount Intercooler", "category": "Forced Induction", "targetSize": 0.78},
    {"id": "rotor-disc-brake", "uid": "eb0797ba7c964063ac863686487a820e", "name": "Carbon-Ceramic 380mm Rotor Disc", "category": "Wheels & Brakes", "targetSize": 0.42},
    {"id": "nos-nitrous-bottle", "uid": "653db48eeaf543f3abec580e5f59fdbc", "name": "10lb High-Pressure NOS Bottle", "category": "Forced Induction", "targetSize": 0.55},
    {"id": "round-projector-headlight", "uid": "bc80e954ac954a149486d5547c42c3f0", "name": "7-Inch Bi-LED Projector Headlight", "category": "Electrical & Ignition", "targetSize": 0.26},
    {"id": "bosch-12v-battery", "uid": "68c36c21b1be4fdb830b534187b48f92", "name": "Bosch S6 AGM 12V Car Battery", "category": "Electrical & Ignition", "targetSize": 0.35},
    {"id": "f1-steering-wheel-w11", "uid": "97e6f81365714a78a784c4bc92903b7b", "name": "Mercedes-AMG F1 W11 Steering Wheel", "category": "Interior & Cockpit", "targetSize": 0.32},
]

PLANES = [
    {"id": "lockheed-f22-raptor", "uid": "508de5c48845456bb033fb267ebe1d1e", "name": "Lockheed Martin F-22 Raptor", "category": "5th Gen Stealth Fighter", "targetSize": 18.9},
    {"id": "boeing-787-dreamliner", "uid": "524f485c748146b7968e0dd8eb84e786", "name": "Boeing 787-9 Dreamliner", "category": "Commercial Widebody", "targetSize": 28.0},
    {"id": "concorde-supersonic", "uid": "6d95290363474798a429a38bbf9ad49d", "name": "Aérospatiale / BAC Concorde", "category": "Supersonic Commercial", "targetSize": 26.0},
    {"id": "supermarine-spitfire", "uid": "96b902aa09ab441497d815f3958e061c", "name": "Supermarine Spitfire Mk.IX", "category": "Historic Warbird", "targetSize": 11.2},
    {"id": "lockheed-sr71-blackbird", "uid": "e2400e6119f5414c89e075654a82d30a", "name": "Lockheed SR-71 Blackbird", "category": "Strategic Reconnaissance", "targetSize": 24.0},
    {"id": "airbus-a380", "uid": "98d21f9c8104445f814cef47ef992889", "name": "Airbus A380-800 Superjumbo", "category": "Commercial Double-Deck", "targetSize": 30.0},
]

LOCATIONS = [
    {"id": "underground_garage", "uid": "6380fc0dcb814a22b8ecf0fd33b151b5", "title": "Underground Parking Facility", "targetSpan": 30.0, "category": "garages"},
    {"id": "desert_workshop_garage", "uid": "ef8bb81713814d688487a81ae2467a51", "title": "Desert Speed Workshop Garage", "targetSpan": 32.0, "category": "garages"},
    {"id": "cyberpunk_garage", "uid": "d4be52b3be4a49a699dd22886bc4c801", "title": "Cyberpunk Neon Bay", "targetSpan": 28.0, "category": "garages"},
    {"id": "detailed_parking_garage", "uid": "84e1b7b134d14b438cf3ff9655f4625b", "title": "Concrete Multi-Level Garage", "targetSpan": 35.0, "category": "garages"},
    {"id": "city_street_asphalt", "uid": "d9df5cfa079f4da8a18ef1372c00d01c", "title": "Downtown Asphalt Boulevard", "targetSpan": 50.0, "category": "streets"},
    {"id": "cyberpunk_night_street", "uid": "98b48acc4bb549e0b9cd32317805b992", "title": "Neon District Wet Alley", "targetSpan": 45.0, "category": "streets"},
    {"id": "car_showroom_dealership", "uid": "71626d177d04404d84593f8ae5e27ba6", "title": "Luxury Glass Pavilion Showroom", "targetSpan": 30.0, "category": "showcases"},
    {"id": "architectural_exhibition_hall", "uid": "4e47944b4b6b4ef4913e3352b31a781d", "title": "Grand Modernist Exhibition Hall", "targetSpan": 34.0, "category": "showcases"},
    {"id": "car_studio_cyclorama", "uid": "c59d07c5a49341fcad85cc47afa1996d", "title": "Curved Seamless Studio Cyclorama", "targetSpan": 28.0, "category": "showcases"},
    {"id": "vehicle_display_podium", "uid": "615ed0481a5a4a1f97fd62d0b14e0d41", "title": "Circular Halo Display Podium", "targetSpan": 28.0, "category": "showcases"},
]

CARS = [
    {"id": "1975-porsche-911-turbo", "uid": "8568d9d14a994b9cae59499f0dbed21e", "name": "1975 Porsche 911 (930) Turbo", "brand": "Porsche", "targetSize": 4.45},
    {"id": "lamborghini-aventador", "uid": "e328d9f5dcfd48bdbe8c73324b52ece3", "name": "Lamborghini Aventador LP700-4", "brand": "Lamborghini", "targetSize": 4.78},
    {"id": "nissan-skyline-r34-gtr", "uid": "ff8fb2251dfa4bb9979e7022c5a6666c", "name": "Nissan Skyline R34 GT-R V-Spec II", "brand": "Nissan", "targetSize": 4.60},
    {"id": "audi-r8", "uid": "e17e438f076f4427a58d93aa779edaed", "name": "Audi R8 V10 Performance", "brand": "Audi Sport", "targetSize": 4.43},
    {"id": "ford-gt-2006", "uid": "ee5db1918a2b4c8cbe0388b67dee4b17", "name": "Ford GT 2006", "brand": "Ford", "targetSize": 4.64},
    {"id": "2019-chevrolet-corvette-c8", "uid": "790c40ccff6843eab0b7b4bd18421ff8", "name": "2019 Chevrolet Corvette C8 Stingray", "brand": "Chevrolet", "targetSize": 4.63},
    {"id": "bmw-m3-e30", "uid": "ac3c7013434e403e8faff87948caf422", "name": "BMW M3 E30 Sport Evolution", "brand": "BMW M", "targetSize": 4.35},
    {"id": "2019-aston-martin-vantage", "uid": "9237b1748bdf4d8d9194ada0981b84a8", "name": "2019 Aston Martin Vantage", "brand": "Aston Martin", "targetSize": 4.47},
    {"id": "koenigsegg-one-pro", "uid": "26d50f742f3241f5a36081d93205c764", "name": "Koenigsegg One:1 Megacar", "brand": "Koenigsegg", "targetSize": 4.50},
    {"id": "bugatti-chiron-mansory", "uid": "1bad4302097e41dc9b9e04794dd20108", "name": "Bugatti Chiron Mansory Centuria", "brand": "Bugatti / Mansory", "targetSize": 4.54},
    {"id": "dodge-viper-gts", "uid": "f14c18476a0542178c6d0ca9a751e425", "name": "Dodge Viper GTS Coupe", "brand": "Dodge", "targetSize": 4.49},
    {"id": "mazda-rx7-fd", "uid": "898e9be8c8964f6298188a2901216e80", "name": "Mazda RX-7 FD3S Spirit R", "brand": "Mazda", "targetSize": 4.28},
    {"id": "toyota-supra-mk4", "uid": "eb9bb1eb41db431cb078088ae1ce45f8", "name": "Toyota Supra MK IV (1994)", "brand": "Toyota", "targetSize": 4.52},
    {"id": "mercedes-amg-gt3", "uid": "035f061cb6624effbc483d5f9b5ecaba", "name": "Mercedes-AMG GT3", "brand": "Mercedes-AMG", "targetSize": 4.75},
    {"id": "shelby-cobra-427", "uid": "a9024d1c23f1490f8f40468946c14b0c", "name": "Shelby Cobra 427 S/C", "brand": "Shelby", "targetSize": 4.00},
    {"id": "subaru-impreza-wrx-sti", "uid": "08296bc950364621b6174a3078bb19e0", "name": "Subaru Impreza WRX STi 2004", "brand": "Subaru", "targetSize": 4.42},
    {"id": "honda-nsx-1990", "uid": "1cc15628a00a4739a6b6c01128927c8d", "name": "Honda NSX 1990", "brand": "Honda", "targetSize": 4.41},
    {"id": "mclaren-senna", "uid": "ea3e43a6eb004853a87fe9c58422eb96", "name": "McLaren Senna Track Edition", "brand": "McLaren", "targetSize": 4.74},
    {"id": "mitsubishi-lancer-evo", "uid": "ab29b0d3386549ea948568a07fb18d3a", "name": "Mitsubishi Lancer Evolution IX MR", "brand": "Mitsubishi", "targetSize": 4.51},
    {"id": "audi-r26-concept", "uid": "32bf22824ea44445bb5ae2361680196d", "name": "2026 Audi R26 Concept", "brand": "Audi Sport", "targetSize": 5.20},
]

def download_and_process_item(item, subfolder, target_size, model_type="part"):
    item_id = item["id"]
    uid = item["uid"]
    name = item.get("name") or item.get("title", item_id)
    target_glb = os.path.join(ASSETS_ROOT, subfolder, item_id, "source", f"{item_id}.glb")

    print(f"\n=======================================================")
    print(f"[>] Processing {subfolder.upper()}: {name} ({item_id})")
    print(f"    UID: {uid}")
    print(f"    Destination: {target_glb}")

    # Check if target GLB exists and is >1MB with real textures
    if os.path.isfile(target_glb) and os.path.getsize(target_glb) > 1000000:
        print(f"[+] Already downloaded and processed ({os.path.getsize(target_glb) / 1024 / 1024:.2f} MB). Skipping.")
        return True

    # 1. Download via sketchfab-cli
    os.makedirs(STAGING_DIR, exist_ok=True)
    item_staging = os.path.join(STAGING_DIR, f"{item_id}_{uid[:8]}")
    os.makedirs(item_staging, exist_ok=True)

    cmd = [
        "python3",
        os.path.join(SKETCHFAB_CLI_DIR, "main.py"),
        "-o", item_staging,
        "-q",
        uid
    ]
    print(f"[+] Downloading from Sketchfab via sketchfab-cli...")
    try:
        proc = subprocess.run(cmd, cwd=SKETCHFAB_CLI_DIR, capture_output=True, text=True, timeout=180)
        if proc.returncode != 0:
            print(f"[-] Download returned code {proc.returncode}")
            print(f"[-] Stderr: {proc.stderr[:400]}")
    except Exception as e:
        print(f"[-] Download failed: {e}")
        return False

    # Find the downloaded folder
    subdirs = [os.path.join(item_staging, d) for d in os.listdir(item_staging) if os.path.isdir(os.path.join(item_staging, d))]
    if not subdirs:
        print(f"[-] No model directory found in staging: {item_staging}")
        return False

    downloaded_dir = subdirs[0]
    print(f"[+] Downloaded folder: {downloaded_dir}")

    # 2. Process via Blender
    blender_cmd = [
        BLENDER_BIN,
        "--background",
        "--python", PROCESSOR_SCRIPT,
        "--",
        downloaded_dir,
        target_glb,
        model_type,
        str(target_size)
    ]
    print(f"[+] Ingesting & exporting binary GLB via Blender...")
    try:
        bproc = subprocess.run(blender_cmd, capture_output=True, text=True, timeout=120)
        if bproc.returncode != 0:
            print(f"[-] Blender processing failed: {bproc.returncode}")
            print(bproc.stdout[-500:])
            return False
        else:
            print(f"[✓] Blender export complete!")
    except Exception as e:
        print(f"[-] Blender invocation error: {e}")
        return False

    # Clean up staging to preserve space
    try:
        shutil.rmtree(item_staging)
    except Exception:
        pass

    if os.path.isfile(target_glb) and os.path.getsize(target_glb) > 100000:
        print(f"[✓] SUCCESS: {target_glb} ({os.path.getsize(target_glb) / 1024 / 1024:.2f} MB)")
        return True
    else:
        print(f"[-] Exported file missing or too small")
        return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--category", choices=["parts", "planes", "locations", "cars", "all"], default="parts")
    args = parser.parse_args()

    success_count = 0
    fail_count = 0

    if args.category in ("parts", "all"):
        print("\n=== INGESTING 20 CAR PARTS ===")
        for item in CAR_PARTS:
            if download_and_process_item(item, "Parts", item.get("targetSize", 0.5), "part"):
                success_count += 1
            else:
                fail_count += 1

    if args.category in ("planes", "all"):
        print("\n=== INGESTING 6 PLANES ===")
        for item in PLANES:
            if download_and_process_item(item, "Planes", item.get("targetSize", 20.0), "plane"):
                success_count += 1
            else:
                fail_count += 1

    if args.category in ("locations", "all"):
        print("\n=== INGESTING 10 LOCATIONS ===")
        for item in LOCATIONS:
            if download_and_process_item(item, "Locations", item.get("targetSpan", 35.0), "location"):
                success_count += 1
            else:
                fail_count += 1

    if args.category in ("cars", "all"):
        print("\n=== INGESTING 20 CARS ===")
        for item in CARS:
            if download_and_process_item(item, "Cars", item.get("targetSize", 4.6), "car"):
                success_count += 1
            else:
                fail_count += 1

    print(f"\n=======================================================")
    print(f"[✓] Pipeline batch complete: {success_count} succeeded, {fail_count} failed")

if __name__ == "__main__":
    main()

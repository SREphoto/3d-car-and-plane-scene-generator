import * as THREE from 'three';

/**
 * Generates tailored high-dynamic-range HDR reflection environments for each 3D location:
 * - Architectural Loft Penthouse: High-key daylight sky, panoramic skyscraper silhouettes, warm floor bounce.
 * - Underground Performance Garage: Concrete ceiling, dual parallel overhead fluorescent strip tubes, industrial dark walls.
 * - Abandoned Concrete VR Gallery: Brutalist weathered concrete walls, open overhead skylight shafts with warm sun ingress.
 * - Aero Wind Tunnel Facility: Cylindrical metallic tunnel, glowing circular turbine ring, aerodynamic cyan rim lines.
 * - Obsidian Blackout Stage: Signature high-contrast automotive softboxes & sculpted rim kickers.
 */

// 1. Signature Obsidian Automotive Blackout Studio
export function createAutomotiveStudioScene() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#020306');

  // Main High-Intensity Overhead Softbox
  const mainSoftbox = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 28),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(8.0, 8.0, 8.0), side: THREE.DoubleSide })
  );
  mainSoftbox.rotation.x = Math.PI / 2;
  mainSoftbox.position.set(0, 9.5, 0);
  envScene.add(mainSoftbox);

  // Secondary Off-Axis Overhead Strip
  const strip2 = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 4.8, 5.2), side: THREE.DoubleSide })
  );
  strip2.rotation.x = Math.PI / 2;
  strip2.position.set(4.2, 8.8, 0);
  envScene.add(strip2);

  // Left & Right Rim Light Strips
  const leftRim = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 4.5, 6.0), side: THREE.DoubleSide })
  );
  leftRim.position.set(-9.5, 3.2, 0);
  leftRim.rotation.y = Math.PI / 2;
  envScene.add(leftRim);

  const rightRim = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(5.5, 5.2, 4.8), side: THREE.DoubleSide })
  );
  rightRim.position.set(9.5, 3.2, 0);
  rightRim.rotation.y = -Math.PI / 2;
  envScene.add(rightRim);

  // Front & Rear Diffuser Kickers
  const frontKicker = new THREE.Mesh(
    new THREE.PlaneGeometry(7.0, 1.8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 3.8, 4.2), side: THREE.DoubleSide })
  );
  frontKicker.position.set(0, 2.2, 12.5);
  frontKicker.rotation.y = Math.PI;
  envScene.add(frontKicker);

  const rearKicker = new THREE.Mesh(
    new THREE.PlaneGeometry(7.0, 2.0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(4.2, 3.5, 3.2), side: THREE.DoubleSide })
  );
  rearKicker.position.set(0, 2.5, -12.5);
  envScene.add(rearKicker);

  return envScene;
}

// 2. Architectural Loft Penthouse (Natural Daylight + City Skyline Reflections)
export function createLoftEnvironmentScene() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#384659'); // Natural sky blue/grey

  // Massive panoramic window light source coming from -X and -Z (where the loft windows are!)
  const windowLightGeo = new THREE.PlaneGeometry(36, 16);
  const windowLightMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(6.5, 7.5, 9.0), // High-intensity daylight
    side: THREE.DoubleSide,
  });
  const windowLight = new THREE.Mesh(windowLightGeo, windowLightMat);
  windowLight.position.set(-18, 7, -10);
  windowLight.rotation.y = Math.PI * 0.35;
  envScene.add(windowLight);

  // Secondary panoramic skyline window on -Z
  const windowLight2 = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(5.5, 6.5, 8.0), side: THREE.DoubleSide })
  );
  windowLight2.position.set(0, 7, -18);
  envScene.add(windowLight2);

  // Skyscraper building silhouette blocks outside (creates realistic skyscraper reflection breaks on car paint & glass)
  const towerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 1.0, 1.4) });
  const towerPositions = [
    [-14, 10, -22, 6, 24, 6],
    [-24, 12, -14, 8, 30, 8],
    [-8, 8, -26, 5, 18, 5],
    [-20, 14, 4, 7, 28, 7],
  ];
  towerPositions.forEach(([x, y, z, w, h, d]) => {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), towerMat);
    tower.position.set(x, y, z);
    envScene.add(tower);
  });

  // Warm interior penthouse ceiling & wall bounce (natural luxury architectural feel)
  const interiorWall = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 1.2), side: THREE.DoubleSide })
  );
  interiorWall.position.set(12, 6, 0);
  interiorWall.rotation.y = -Math.PI / 2;
  envScene.add(interiorWall);

  // Soft wood/polished concrete floor bounce
  const floorBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.75, 0.7), side: THREE.DoubleSide })
  );
  floorBounce.rotation.x = -Math.PI / 2;
  floorBounce.position.set(0, -0.2, 0);
  envScene.add(floorBounce);

  return envScene;
}

// 3. Underground Performance Garage (Fluorescent Tubes + Concrete Bays)
export function createGarageEnvironmentScene() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#0a0d14'); // Dark concrete underground ambiance

  // Overhead Fluorescent Strip Light Bank 1 (directly over car)
  const tubeMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(7.0, 7.5, 8.5), // Cool 5000K fluorescent white
    side: THREE.DoubleSide,
  });
  const tube1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 18), tubeMat);
  tube1.rotation.x = Math.PI / 2;
  tube1.position.set(-1.6, 5.2, 0);
  envScene.add(tube1);

  // Overhead Fluorescent Strip Light Bank 2
  const tube2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 18), tubeMat);
  tube2.rotation.x = Math.PI / 2;
  tube2.position.set(1.6, 5.2, 0);
  envScene.add(tube2);

  // Overhead Center Soft Diffuser Panel
  const centerDiffuser = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.5, 3.0), side: THREE.DoubleSide })
  );
  centerDiffuser.rotation.x = Math.PI / 2;
  centerDiffuser.position.set(0, 5.4, 0);
  envScene.add(centerDiffuser);

  // Concrete side walls with subtle amber worklight bounce
  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.4, 0.5), side: THREE.DoubleSide })
  );
  leftWall.position.set(-8.5, 3, 0);
  leftWall.rotation.y = Math.PI / 2;
  envScene.add(leftWall);

  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 0.42, 0.48), side: THREE.DoubleSide })
  );
  rightWall.position.set(8.5, 3, 0);
  rightWall.rotation.y = -Math.PI / 2;
  envScene.add(rightWall);

  // Dark oily/wet concrete pavement bounce
  const floorBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 22),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.18, 0.22, 0.28), side: THREE.DoubleSide })
  );
  floorBounce.rotation.x = -Math.PI / 2;
  floorBounce.position.set(0, -0.1, 0);
  envScene.add(floorBounce);

  return envScene;
}

// 4. Abandoned Concrete VR Gallery (Dramatic Skylight Aperture + Weathered Concrete)
export function createGalleryEnvironmentScene() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#0d1117'); // Deep brutalist interior shadow

  // Main Open Skylight Aperture in the Ceiling (warm direct sun shaft)
  const sunSkylightMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(9.5, 8.2, 6.5), // High-intensity warm sunlight pouring through roof
    side: THREE.DoubleSide,
  });
  const skylight = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 9.0), sunSkylightMat);
  skylight.rotation.x = Math.PI / 2;
  skylight.position.set(1.5, 6.2, -1.0);
  envScene.add(skylight);

  // Secondary Skylight Slit
  const skylight2 = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 8.0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(5.5, 6.0, 7.2), side: THREE.DoubleSide })
  );
  skylight2.rotation.x = Math.PI / 2;
  skylight2.position.set(-3.5, 6.2, 3.0);
  envScene.add(skylight2);

  // Weathered brutalist concrete wall bounces
  const concreteMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.5, 0.55, 0.62),
    side: THREE.DoubleSide,
  });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), concreteMat);
  backWall.position.set(0, 3.5, -9.0);
  envScene.add(backWall);

  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 7), concreteMat);
  sideWall.position.set(6.5, 3.5, 0);
  sideWall.rotation.y = -Math.PI / 2;
  envScene.add(sideWall);

  // Raw textured concrete floor bounce
  const floorBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 0.24, 0.27), side: THREE.DoubleSide })
  );
  floorBounce.rotation.x = -Math.PI / 2;
  floorBounce.position.set(0, -0.1, 0);
  envScene.add(floorBounce);

  return envScene;
}

// 5. Aero Wind Tunnel Facility (Curved Metal Walls + Glowing Turbine Ring)
export function createWindTunnelEnvironmentScene() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#03060f'); // Aerospace facility dark blue

  // Glowing Turbine Intake Ring behind car (-Z)
  const ringGeo = new THREE.TorusGeometry(8.5, 0.45, 16, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(2.5, 6.5, 9.0), // Glowing aerodynamic cyan/blue ring
  });
  const turbineRing = new THREE.Mesh(ringGeo, ringMat);
  turbineRing.position.set(0, 5.0, -22);
  envScene.add(turbineRing);

  // Overhead Linear Testing Floodlights
  const floodGeo = new THREE.PlaneGeometry(4.0, 22);
  const floodMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(5.5, 6.0, 6.5),
    side: THREE.DoubleSide,
  });
  const flood = new THREE.Mesh(floodGeo, floodMat);
  flood.rotation.x = Math.PI / 2;
  flood.position.set(0, 8.5, 0);
  envScene.add(flood);

  // Aerodynamic Lateral Rim Strips (sculpting airfoils & spoilers)
  const leftCyanRim = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 22),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 5.5, 7.5), side: THREE.DoubleSide })
  );
  leftCyanRim.position.set(-8.5, 2.5, 0);
  leftCyanRim.rotation.y = Math.PI / 2;
  envScene.add(leftCyanRim);

  const rightRim = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 22),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 4.5, 5.0), side: THREE.DoubleSide })
  );
  rightRim.position.set(8.5, 2.5, 0);
  rightRim.rotation.y = -Math.PI / 2;
  envScene.add(rightRim);

  // Turntable circular floor bounce
  const tableBounce = new THREE.Mesh(
    new THREE.CircleGeometry(12, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.25, 0.32), side: THREE.DoubleSide })
  );
  tableBounce.rotation.x = -Math.PI / 2;
  tableBounce.position.set(0, -0.1, 0);
  envScene.add(tableBounce);

  return envScene;
}

/**
 * Returns the matching environment scene for any given scene ID.
 */
export function getEnvironmentSceneForSceneId(sceneId) {
  switch (sceneId) {
    case 'interior_7':
      return createLoftEnvironmentScene();
    case 'car_garage':
      return createGarageEnvironmentScene();
    case 'abandoned_vr_gallery':
      return createGalleryEnvironmentScene();
    case 'wind_tunnel':
      return createWindTunnelEnvironmentScene();
    case 'dark_void':
    case 'wet_studio':
    default:
      return createAutomotiveStudioScene();
  }
}

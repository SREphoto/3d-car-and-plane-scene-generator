import * as THREE from 'three';

/**
 * Generates tailored high-dynamic-range HDR reflection environments & sky domes for each location,
 * working both standalone (procedural stages) and as realistic sky/horizon backing when capturing
 * live 360° CubeCamera scene probes inside photogrammetry cities and garages.
 */

export function createSkyGradientTexture(topHex, horizonHex, groundHex, sunColor = null, sunDir = null) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, topHex);
  grad.addColorStop(0.48, horizonHex);
  grad.addColorStop(0.53, horizonHex);
  grad.addColorStop(1.0, groundHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  if (sunColor && sunDir) {
    const dir = sunDir.clone().normalize();
    const u = 0.5 + Math.atan2(dir.z, dir.x) / (Math.PI * 2);
    const v = 0.5 - Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) / Math.PI;
    const sx = ((u % 1) + 1) % 1 * 512;
    const sy = v * 256;
    const sGrad = ctx.createRadialGradient(sx, sy, 2, sx, sy, 56);
    sGrad.addColorStop(0.0, '#ffffff');
    sGrad.addColorStop(0.25, sunColor);
    sGrad.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = sGrad;
    ctx.fillRect(0, 0, 512, 256);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 1. Signature Obsidian Automotive Blackout Studio
export function createAutomotiveStudioScene() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#020306');

  const mainSoftbox = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 28),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(7.5, 7.5, 7.8), side: THREE.DoubleSide })
  );
  mainSoftbox.rotation.x = Math.PI / 2;
  mainSoftbox.position.set(0, 9.5, 0);
  envScene.add(mainSoftbox);

  const strip2 = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(4.2, 4.5, 5.0), side: THREE.DoubleSide })
  );
  strip2.rotation.x = Math.PI / 2;
  strip2.position.set(4.2, 8.8, 0);
  envScene.add(strip2);

  const leftRim = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 4.2, 5.4), side: THREE.DoubleSide })
  );
  leftRim.position.set(-9.5, 3.2, 0);
  leftRim.rotation.y = Math.PI / 2;
  envScene.add(leftRim);

  const rightRim = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(5.0, 4.8, 4.4), side: THREE.DoubleSide })
  );
  rightRim.position.set(9.5, 3.2, 0);
  rightRim.rotation.y = -Math.PI / 2;
  envScene.add(rightRim);

  const frontKicker = new THREE.Mesh(
    new THREE.PlaneGeometry(7.0, 1.8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.5, 4.0), side: THREE.DoubleSide })
  );
  frontKicker.position.set(0, 2.2, 12.5);
  frontKicker.rotation.y = Math.PI;
  envScene.add(frontKicker);

  const rearKicker = new THREE.Mesh(
    new THREE.PlaneGeometry(7.0, 2.0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(3.8, 3.2, 3.0), side: THREE.DoubleSide })
  );
  rearKicker.position.set(0, 2.5, -12.5);
  envScene.add(rearKicker);

  return envScene;
}

// 2. Architectural Loft Penthouse
export function createLoftEnvironmentScene() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#384659');

  const windowLight = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(6.0, 7.0, 8.5), side: THREE.DoubleSide })
  );
  windowLight.position.set(-18, 7, -10);
  windowLight.rotation.y = Math.PI * 0.35;
  envScene.add(windowLight);

  const windowLight2 = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(5.0, 6.0, 7.5), side: THREE.DoubleSide })
  );
  windowLight2.position.set(0, 7, -18);
  envScene.add(windowLight2);

  const interiorWall = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.35, 1.2), side: THREE.DoubleSide })
  );
  interiorWall.position.set(12, 6, 0);
  interiorWall.rotation.y = -Math.PI / 2;
  envScene.add(interiorWall);

  const floorBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.7, 0.65), side: THREE.DoubleSide })
  );
  floorBounce.rotation.x = -Math.PI / 2;
  floorBounce.position.set(0, -0.2, 0);
  envScene.add(floorBounce);

  return envScene;
}

// 3. Underground & F1 Pit Garages (Crisp Motorsport LED Lightbanks + Epoxy Floor Bounce)
export function createGarageEnvironmentScene(isF1Pit = false) {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(isF1Pit ? '#070a12' : '#080b12');

  const tubeMat = new THREE.MeshBasicMaterial({
    color: isF1Pit ? new THREE.Color(3.4, 3.7, 4.2) : new THREE.Color(4.2, 4.6, 5.4),
    side: THREE.DoubleSide,
  });

  [-2.2, 0, 2.2].forEach((x, idx) => {
    if (!isF1Pit && idx === 1) return;
    const tube = new THREE.Mesh(new THREE.PlaneGeometry(isF1Pit ? 0.65 : 0.48, 18), tubeMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(x, 4.8, 0);
    envScene.add(tube);
  });

  // Pit lane open door daylight / flood ingress in front (-Z)
  if (isF1Pit) {
    const pitDoor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 4.5),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 2.0, 2.4), side: THREE.DoubleSide })
    );
    pitDoor.position.set(0, 2.4, -12);
    envScene.add(pitDoor);
  }

  const wallCol = isF1Pit ? new THREE.Color(0.22, 0.25, 0.32) : new THREE.Color(0.24, 0.28, 0.36);
  [-8.5, 8.5].forEach((x, idx) => {
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 6),
      new THREE.MeshBasicMaterial({ color: wallCol, side: THREE.DoubleSide })
    );
    wall.position.set(x, 3, 0);
    wall.rotation.y = idx === 0 ? Math.PI / 2 : -Math.PI / 2;
    envScene.add(wall);
  });

  const floorBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.14, 0.16, 0.2), side: THREE.DoubleSide })
  );
  floorBounce.rotation.x = -Math.PI / 2;
  floorBounce.position.set(0, -0.1, 0);
  envScene.add(floorBounce);

  return envScene;
}

// 4. Concrete Gallery / Industrial Interior Scan (Skylight Sunbeam + Concrete Bounce)
export function createGalleryEnvironmentScene() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#121720');

  const skylight = new THREE.Mesh(
    new THREE.PlaneGeometry(6.0, 10.0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(8.0, 7.2, 5.8), side: THREE.DoubleSide })
  );
  skylight.rotation.x = Math.PI / 2;
  skylight.position.set(1.5, 6.5, -1.0);
  envScene.add(skylight);

  const skylight2 = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 8.0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(4.8, 5.4, 6.5), side: THREE.DoubleSide })
  );
  skylight2.rotation.x = Math.PI / 2;
  skylight2.position.set(-3.5, 6.5, 3.0);
  envScene.add(skylight2);

  const concreteMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.55, 0.58, 0.63),
    side: THREE.DoubleSide,
  });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(18, 7), concreteMat);
  backWall.position.set(0, 3.5, -9.0);
  envScene.add(backWall);

  const floorBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.28, 0.29, 0.31), side: THREE.DoubleSide })
  );
  floorBounce.rotation.x = -Math.PI / 2;
  floorBounce.position.set(0, -0.1, 0);
  envScene.add(floorBounce);

  return envScene;
}

// 5. Aero Wind Tunnel Facility
export function createWindTunnelEnvironmentScene() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#03060f');

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(8.5, 0.45, 16, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 6.5, 9.0) })
  );
  ring.position.set(0, 5.0, -22);
  envScene.add(ring);

  const flood = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 22),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(5.5, 6.0, 6.5), side: THREE.DoubleSide })
  );
  flood.rotation.x = Math.PI / 2;
  flood.position.set(0, 8.5, 0);
  envScene.add(flood);

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

  return envScene;
}

// 6. Natural Outdoor Daylight Sky Environment (Canadian Downtown, Vatican, Église, Kent, Construction, Desert)
export function createDaylightOutdoorEnvironmentScene(warmth = 'clear') {
  const envScene = new THREE.Scene();
  const isWarm = warmth === 'warm';
  envScene.background = new THREE.Color(isWarm ? '#7cb2df' : '#6ca6db');

  // Sky hemisphere dome
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(60, 32, 16),
    new THREE.MeshBasicMaterial({
      map: createSkyGradientTexture(
        isWarm ? '#3b76ad' : '#2f6aa3',
        isWarm ? '#d9cdb8' : '#bdd4e8',
        isWarm ? '#5c5346' : '#474e57',
        isWarm ? '#fff0c8' : '#fff9eb',
        new THREE.Vector3(0.55, 0.62, -0.45)
      ),
      side: THREE.BackSide,
    })
  );
  envScene.add(skyDome);

  // Solar disc HDR specular highlight
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 24),
    new THREE.MeshBasicMaterial({
      color: isWarm ? new THREE.Color(14, 11.5, 8.5) : new THREE.Color(13, 12.5, 11.5),
      side: THREE.DoubleSide,
    })
  );
  sunDisc.position.set(22, 26, -18);
  sunDisc.lookAt(0, 0, 0);
  envScene.add(sunDisc);

  // Pavement / stone ground bounce
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(55, 32),
    new THREE.MeshBasicMaterial({
      color: isWarm ? new THREE.Color(0.52, 0.47, 0.4) : new THREE.Color(0.36, 0.38, 0.42),
      side: THREE.DoubleSide,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.2;
  envScene.add(ground);

  return envScene;
}

// 7. Downtown Night Metropolis Environment (LA Night City, Night Runway, Cyberpunk)
export function createNightCityEnvironmentScene() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#050811');

  // Surrounding lit skyscraper window grids & warm sodium / cool LED streetlamps
  const lampColors = [
    new THREE.Color(7.5, 4.8, 2.2), // Warm sodium streetlamp
    new THREE.Color(3.5, 5.5, 8.0), // Cool LED skyscraper glow
    new THREE.Color(8.0, 5.8, 3.0), // Golden storefront glow
    new THREE.Color(2.8, 4.6, 6.8),
  ];

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const r = 16;
    const col = lampColors[i % lampColors.length];
    const lamp = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 5.5),
      new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })
    );
    lamp.position.set(Math.cos(angle) * r, 4.2 + (i % 3) * 2.0, Math.sin(angle) * r);
    lamp.lookAt(0, 1.0, 0);
    envScene.add(lamp);
  }

  // Overhead urban night sky haze bounce
  const nightSky = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.45, 0.72), side: THREE.DoubleSide })
  );
  nightSky.rotation.x = Math.PI / 2;
  nightSky.position.set(0, 18, 0);
  envScene.add(nightSky);

  const asphalt = new THREE.Mesh(
    new THREE.CircleGeometry(30, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.13, 0.16), side: THREE.DoubleSide })
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.y = -0.2;
  envScene.add(asphalt);

  return envScene;
}

export function getEnvironmentSceneForSceneId(sceneId) {
  switch (sceneId) {
    case 'interior_7':
    case 'architectural_exhibition_hall':
      return createLoftEnvironmentScene();
    case 'car_garage':
    case 'detailed_parking_garage':
    case 'velvet_curtain_showroom':
    case 'catwalk':
      return createGarageEnvironmentScene(false);
    case 'red_bull_f1_garage':
    case 'f1_pit_garage':
      return createGarageEnvironmentScene(true);
    case 'abandoned_vr_gallery':
    case 'building_interior_scan':
      return createGalleryEnvironmentScene();
    case 'wind_tunnel':
      return createWindTunnelEnvironmentScene();
    case 'la_night_city':
    case 'wet_night_bokeh_street':
    case 'marina_bay_circuit':
    case 'night_runway':
    case 'cyberpunk_garage':
    case 'cyberpunk_tunnel':
      return createNightCityEnvironmentScene();
    case 'warehouse_courtyard_day':
    case 'monaco_circuit':
    case 'vatican_city':
    case 'desert_workshop_garage':
    case 'construction_site':
      return createDaylightOutdoorEnvironmentScene('warm');
    case 'city_bokeh_street_day':
    case 'canadian_downtown':
    case 'eglise_saint_polycarpe':
    case 'kent_lumber_yard':
    case 'cloud_deck':
      return createDaylightOutdoorEnvironmentScene('clear');
    case 'pro_lighting_studio':
    case 'dark_void':
    case 'wet_studio':
    default:
      return createAutomotiveStudioScene();
  }
}

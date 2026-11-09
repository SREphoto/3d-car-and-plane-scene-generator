import * as THREE from 'three';

/**
 * Creates a high-dynamic-range Automotive Studio Lighting Environment.
 * Used with PMREMGenerator to bake fluid, razor-sharp studio reflections
 * for car paint, curved body panels, glass, and polished chrome.
 */
export function createAutomotiveStudioScene() {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#020306');

  // 1. High-Intensity Overhead Main Softbox (creates the signature bodyline highlight streak)
  const mainSoftboxGeo = new THREE.PlaneGeometry(6.5, 28);
  const mainSoftboxMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(8.0, 8.0, 8.0),
    side: THREE.DoubleSide,
  });
  const mainSoftbox = new THREE.Mesh(mainSoftboxGeo, mainSoftboxMat);
  mainSoftbox.rotation.x = Math.PI / 2;
  mainSoftbox.position.set(0, 9.5, 0);
  envScene.add(mainSoftbox);

  // 2. Secondary Off-Axis Overhead Strip (adds depth to curved fenders & roofs)
  const strip2Geo = new THREE.PlaneGeometry(1.8, 24);
  const strip2Mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(4.5, 4.8, 5.2),
    side: THREE.DoubleSide,
  });
  const strip2 = new THREE.Mesh(strip2Geo, strip2Mat);
  strip2.rotation.x = Math.PI / 2;
  strip2.position.set(4.2, 8.8, 0);
  envScene.add(strip2);

  // 3. Left Rim Light Strip (sculpts the driver's side shoulder & sill line)
  const leftRimGeo = new THREE.PlaneGeometry(1.2, 26);
  const leftRimMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(4.0, 4.5, 6.0), // Cool white/cyan tint
    side: THREE.DoubleSide,
  });
  const leftRim = new THREE.Mesh(leftRimGeo, leftRimMat);
  leftRim.position.set(-9.5, 3.2, 0);
  leftRim.rotation.y = Math.PI / 2;
  envScene.add(leftRim);

  // 4. Right Rim Light Strip (sculpts the passenger's side shoulder & sill line)
  const rightRimGeo = new THREE.PlaneGeometry(1.2, 26);
  const rightRimMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(5.5, 5.2, 4.8), // Warm white tint
    side: THREE.DoubleSide,
  });
  const rightRim = new THREE.Mesh(rightRimGeo, rightRimMat);
  rightRim.position.set(9.5, 3.2, 0);
  rightRim.rotation.y = -Math.PI / 2;
  envScene.add(rightRim);

  // 5. Front Low-Angle Kicker (highlights the front grille, splitter & hood nose)
  const frontKickerGeo = new THREE.PlaneGeometry(7.0, 1.8);
  const frontKickerMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(3.5, 3.8, 4.2),
    side: THREE.DoubleSide,
  });
  const frontKicker = new THREE.Mesh(frontKickerGeo, frontKickerMat);
  frontKicker.position.set(0, 2.2, 12.5);
  frontKicker.rotation.y = Math.PI;
  envScene.add(frontKicker);

  // 6. Rear Diffuser & Spoiler Kicker
  const rearKickerGeo = new THREE.PlaneGeometry(7.0, 2.0);
  const rearKickerMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(4.2, 3.5, 3.2),
    side: THREE.DoubleSide,
  });
  const rearKicker = new THREE.Mesh(rearKickerGeo, rearKickerMat);
  rearKicker.position.set(0, 2.5, -12.5);
  envScene.add(rearKicker);

  return envScene;
}

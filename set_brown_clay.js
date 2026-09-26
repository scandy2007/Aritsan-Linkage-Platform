import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf8');

// Update clay colors to deep, rich earthy brownish clay
const oldClaySection = `    const clayMat = new THREE.MeshStandardMaterial({
      color: 0xB35B2B, // Rich warm terracotta
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.DoubleSide
    });
    const darkPatternMat = new THREE.MeshStandardMaterial({
      color: 0x2A140A, // Deep carved brown/black
      roughness: 0.85,
      metalness: 0.01
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x9E4B1F, // Burnished clay rim
      roughness: 0.65,
      metalness: 0.02,
      side: THREE.DoubleSide
    });`;

const newClaySection = `    const clayMat = new THREE.MeshStandardMaterial({
      color: 0x8A4621, // Deep rich earthy brownish clay
      roughness: 0.78,
      metalness: 0.01,
      side: THREE.DoubleSide
    });
    const darkPatternMat = new THREE.MeshStandardMaterial({
      color: 0x1C0E06, // Deep espresso carved brown
      roughness: 0.88,
      metalness: 0.0
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x733614, // Burnished dark clay brown rim
      roughness: 0.70,
      metalness: 0.01,
      side: THREE.DoubleSide
    });`;

html = html.replace(oldClaySection, newClaySection);

// Update bottom disc color
html = html.replace(
  `new THREE.MeshStandardMaterial({ color: 0x8C3F18, roughness: 0.9 })`,
  `new THREE.MeshStandardMaterial({ color: 0x5E280C, roughness: 0.95 })`
);

// Calibrate lighting for richer brownish depth
const oldLighting = `    // Warm studio lighting tailored for terracotta & pottery PBR
    scene.add(new THREE.AmbientLight(0xfff8f0, 0.65));
    scene.add(new THREE.HemisphereLight(0xffeedd, 0x332014, 0.55));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(3.5, 5.5, 4.5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffeedb, 0.65);
    fillLight.position.set(-4, 3, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffbb88, 0.55);
    rimLight.position.set(0, 4, -4);
    scene.add(rimLight);

    const groundBounce = new THREE.DirectionalLight(0xa05020, 0.3);
    groundBounce.position.set(0, -4, 2);
    scene.add(groundBounce);`;

const newLighting = `    // Calibrated warm studio lighting to preserve rich earthy brown clay tones
    scene.add(new THREE.AmbientLight(0xffeedd, 0.48));
    scene.add(new THREE.HemisphereLight(0xffe4cc, 0x221208, 0.42));

    const keyLight = new THREE.DirectionalLight(0xfff5ea, 0.95);
    keyLight.position.set(3.5, 5.5, 4.5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe8d0ba, 0.45);
    fillLight.position.set(-4, 3, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xe08844, 0.45);
    rimLight.position.set(0, 4, -4);
    scene.add(rimLight);

    const groundBounce = new THREE.DirectionalLight(0x7a3610, 0.25);
    groundBounce.position.set(0, -4, 2);
    scene.add(groundBounce);`;

html = html.replace(oldLighting, newLighting);

fs.writeFileSync('index.html', html, 'utf8');
console.log('Updated clay to rich brownish clay color & calibrated lighting');

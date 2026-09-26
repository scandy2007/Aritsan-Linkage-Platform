import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');

const startMarker = `  } else if (kind === 'pot') {`;
const endMarker   = `  } else if (kind === 'basket' || kind === 'coaster') {`;

const startIdx = html.indexOf(startMarker);
const endIdx   = html.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('❌ Markers not found. startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

console.log(`Replacing pot block char ${startIdx}–${endIdx}`);

// ============================================================
// CLEAN SIMPLE POT — correct shape, hollow, NO broken patterns
// Just smooth terracotta clay with proper silhouette
// ============================================================
const newPotBlock = `  } else if (kind === 'pot') {
    // Clean terracotta pot — wide disc body, proper hollow, smooth

    const clayMat = new THREE.MeshStandardMaterial({
      color: 0xC8956A, roughness: 0.70, metalness: 0.03
    });
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0xA87050, roughness: 0.80, metalness: 0.01, side: THREE.BackSide
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x201008, roughness: 0.90, metalness: 0.00
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xDEB882, roughness: 0.60, metalness: 0.03
    });

    // ── OUTER BODY — wide squat terracotta pot silhouette ──
    // Wide flat base → bulging belly → narrow throat → flared rim base
    const outerPts = [
      new THREE.Vector2(0.06, -0.88),   // base tip
      new THREE.Vector2(0.32, -0.87),   // flat base inner
      new THREE.Vector2(0.62, -0.84),   // base outer
      new THREE.Vector2(0.88, -0.74),   // lower body
      new THREE.Vector2(1.06, -0.55),   // belly widening
      new THREE.Vector2(1.15, -0.30),   // max belly
      new THREE.Vector2(1.16, -0.05),   // upper belly
      new THREE.Vector2(1.10, 0.18),    // shoulder
      new THREE.Vector2(0.94, 0.34),    // upper shoulder
      new THREE.Vector2(0.74, 0.46),    // neck start
      new THREE.Vector2(0.54, 0.56),    // throat
      new THREE.Vector2(0.44, 0.62),    // min throat
      new THREE.Vector2(0.50, 0.68),    // rim base inner
      new THREE.Vector2(0.68, 0.72),    // rim base shelf
      new THREE.Vector2(0.08, 0.72),    // opening
    ];
    group.add(new THREE.Mesh(
      new THREE.LatheGeometry(outerPts, 96), clayMat
    ));

    // ── RIM — large prominent torus-profile ring on top ──
    // This is the most distinctive feature: a thick donut ring at the top
    const rimPts = [
      new THREE.Vector2(0.38, 0.72),   // inner base of rim (connects to body)
      new THREE.Vector2(0.52, 0.70),   // transitions outward
      new THREE.Vector2(0.68, 0.70),   // outer rim base
      new THREE.Vector2(0.82, 0.74),   // outer starts rising
      new THREE.Vector2(0.90, 0.83),   // outer peak
      new THREE.Vector2(0.92, 0.95),   // top outer
      new THREE.Vector2(0.88, 1.07),   // top surface outer
      new THREE.Vector2(0.76, 1.14),   // top surface mid
      new THREE.Vector2(0.58, 1.16),   // top surface inner
      new THREE.Vector2(0.44, 1.12),   // inner rim top
      new THREE.Vector2(0.34, 1.02),   // inner rim wall
      new THREE.Vector2(0.30, 0.90),   // inner rim lower
      new THREE.Vector2(0.32, 0.80),   // inner rim base
      new THREE.Vector2(0.38, 0.72),   // close profile
    ];
    group.add(new THREE.Mesh(
      new THREE.LatheGeometry(rimPts, 96), rimMat
    ));

    // ── INNER HOLLOW — smooth bowl visible from above ──
    const innerPts = [
      new THREE.Vector2(0.06, 1.12),   // opening center
      new THREE.Vector2(0.28, 1.08),   // inner rim start
      new THREE.Vector2(0.40, 0.98),   // inner rim curve
      new THREE.Vector2(0.44, 0.84),   // inner funnel
      new THREE.Vector2(0.38, 0.70),   // throat inner
      new THREE.Vector2(0.30, 0.56),   // inner neck
      new THREE.Vector2(0.30, 0.40),   // inner body
      new THREE.Vector2(0.42, 0.22),
      new THREE.Vector2(0.60, 0.04),
      new THREE.Vector2(0.82, -0.16),
      new THREE.Vector2(0.98, -0.38),
      new THREE.Vector2(1.06, -0.58),
      new THREE.Vector2(1.02, -0.74),
      new THREE.Vector2(0.80, -0.84),
      new THREE.Vector2(0.50, -0.87),
      new THREE.Vector2(0.06, -0.88),
    ];
    group.add(new THREE.Mesh(
      new THREE.LatheGeometry(innerPts, 80), innerMat
    ));

    // ── CARVED BANDS — 4 clean dark rings ──
    [
      { r: 1.15, y: -0.30, t: 0.028 },  // belly band (widest)
      { r: 0.96, y:  0.18, t: 0.022 },  // shoulder band
      { r: 0.54, y:  0.56, t: 0.020 },  // throat band
      { r: 0.82, y: -0.74, t: 0.020 },  // lower body band
    ].forEach(({ r, y, t }) => {
      const b = new THREE.Mesh(
        new THREE.TorusGeometry(r, t, 10, 90), darkMat
      );
      b.position.y = y;
      group.add(b);
    });

    // ── BOTTOM CAP ──
    const bot = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 48),
      new THREE.MeshStandardMaterial({ color: 0x8B5838, roughness: 0.95 })
    );
    bot.rotation.x = -Math.PI / 2;
    bot.position.y = -0.88;
    group.add(bot);

`;

const result = html.slice(0, startIdx) + newPotBlock + html.slice(endIdx);

if (!result.includes("} else if (kind === 'basket'")) {
  console.error('❌ basket block lost — aborting!');
  process.exit(1);
}

fs.writeFileSync('index.html', result, 'utf8');
console.log('✅ Clean pot block written. File size:', result.length, 'bytes');

import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');

// Find the start and end markers in the pot block
const startMarker = `  } else if (kind === 'pot') {`;
const endMarker   = `  } else if (kind === 'basket' || kind === 'coaster') {`;

const startIdx = html.indexOf(startMarker);
const endIdx   = html.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('❌ Could not find pot block markers. startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

console.log(`Found pot block from char ${startIdx} to ${endIdx}`);

const newPotBlock = `  } else if (kind === 'pot') {
    // ═══ HOPI-STYLE TERRACOTTA POT — matched to reference images ═══
    // Wide disc body, narrow neck, LARGE prominent torus rim, deep hollow, large scroll patterns

    const clay    = new THREE.MeshStandardMaterial({ color:0xD4A87A, roughness:0.68, metalness:0.02 });
    const bodyMat = new THREE.MeshStandardMaterial({ color:0xBE956A, roughness:0.75, metalness:0.02 });
    const innerMat= new THREE.MeshStandardMaterial({ color:0xC49A6E, roughness:0.80, metalness:0.01, side:THREE.BackSide });
    const darkMat = new THREE.MeshStandardMaterial({ color:0x2A1506, roughness:0.90, metalness:0.0  });
    const bandMat = new THREE.MeshStandardMaterial({ color:0x3A1F08, roughness:0.88, metalness:0.0  });

    // 1. OUTER SHELL — wide disc body, narrow neck, flares to rim base
    const outerPts = [
      new THREE.Vector2(0.05, -0.90),
      new THREE.Vector2(0.35, -0.89),
      new THREE.Vector2(0.70, -0.86),
      new THREE.Vector2(1.02, -0.78),
      new THREE.Vector2(1.18, -0.58),
      new THREE.Vector2(1.22, -0.35),
      new THREE.Vector2(1.20, -0.10),
      new THREE.Vector2(1.10, 0.12),
      new THREE.Vector2(0.92, 0.28),
      new THREE.Vector2(0.72, 0.40),
      new THREE.Vector2(0.52, 0.52),
      new THREE.Vector2(0.40, 0.60),
      new THREE.Vector2(0.42, 0.65),
      new THREE.Vector2(0.60, 0.69),
      new THREE.Vector2(0.80, 0.71),
      new THREE.Vector2(0.06, 0.71),
    ];
    group.add(new THREE.Mesh(new THREE.LatheGeometry(outerPts, 96), bodyMat));

    // 2. RIM — large torus-profile lathe (the prominent donut rim from reference)
    const RIM_R = 0.78;
    const rimProfilePts = [
      new THREE.Vector2(RIM_R - 0.38, 0.71),
      new THREE.Vector2(RIM_R - 0.20, 0.69),
      new THREE.Vector2(RIM_R - 0.04, 0.68),
      new THREE.Vector2(RIM_R + 0.12, 0.72),
      new THREE.Vector2(RIM_R + 0.28, 0.82),
      new THREE.Vector2(RIM_R + 0.38, 0.96),
      new THREE.Vector2(RIM_R + 0.40, 1.10),
      new THREE.Vector2(RIM_R + 0.30, 1.22),
      new THREE.Vector2(RIM_R + 0.10, 1.28),
      new THREE.Vector2(RIM_R - 0.10, 1.24),
      new THREE.Vector2(RIM_R - 0.28, 1.14),
      new THREE.Vector2(RIM_R - 0.40, 1.00),
      new THREE.Vector2(RIM_R - 0.44, 0.86),
      new THREE.Vector2(RIM_R - 0.40, 0.75),
      new THREE.Vector2(RIM_R - 0.38, 0.71),
    ];
    group.add(new THREE.Mesh(new THREE.LatheGeometry(rimProfilePts, 96), clay));

    // 3. INNER BOWL — deep hollow visible from top
    const innerPts = [
      new THREE.Vector2(0.04, 1.24),
      new THREE.Vector2(0.28, 1.18),
      new THREE.Vector2(0.44, 1.06),
      new THREE.Vector2(0.46, 0.92),
      new THREE.Vector2(0.40, 0.78),
      new THREE.Vector2(0.32, 0.62),
      new THREE.Vector2(0.28, 0.48),
      new THREE.Vector2(0.34, 0.30),
      new THREE.Vector2(0.52, 0.12),
      new THREE.Vector2(0.74, -0.06),
      new THREE.Vector2(0.94, -0.26),
      new THREE.Vector2(1.06, -0.50),
      new THREE.Vector2(1.08, -0.68),
      new THREE.Vector2(0.96, -0.80),
      new THREE.Vector2(0.66, -0.87),
      new THREE.Vector2(0.34, -0.89),
      new THREE.Vector2(0.05, -0.90),
    ];
    group.add(new THREE.Mesh(new THREE.LatheGeometry(innerPts, 80), innerMat));

    // 4. WIDE DARK PATTERN BAND — belly zone
    const B = { r:1.215, t:0.034, segs:96 };
    [-0.32, -0.10].forEach(y => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(B.r, B.t, 10, B.segs), bandMat);
      ring.position.y = y; group.add(ring);
    });

    // 5. LARGE SCROLL WAVE MOTIFS at shoulder
    const SCROLLS = 8;
    for (let i = 0; i < SCROLLS; i++) {
      const a = (i / SCROLLS) * Math.PI * 2;
      const aH = a + Math.PI / SCROLLS;
      const R = 1.05;
      const sn = Math.sin(a), cs = Math.cos(a);

      // Primary outer arc
      const arc1 = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.022, 8, 24, Math.PI * 1.6), darkMat);
      arc1.position.set(sn * R, 0.18, cs * R);
      arc1.rotation.y = -a; arc1.rotation.x = 0.2; group.add(arc1);

      // Inner curl
      const arc2 = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.018, 8, 18, Math.PI * 1.2), darkMat);
      arc2.position.set(sn * (R - 0.06), 0.28, cs * (R - 0.06));
      arc2.rotation.y = -a + 0.5; arc2.rotation.x = 0.1; group.add(arc2);

      // Wave tail
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.010, 0.18, 6), darkMat);
      tail.position.set(sn * (R + 0.02), 0.10, cs * (R + 0.02));
      tail.rotation.z = -0.5; tail.rotation.y = -a; group.add(tail);

      // Between-scroll mirror arc
      const arc3 = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 20, Math.PI * 1.3), darkMat);
      arc3.position.set(Math.sin(aH) * R * 0.97, 0.14, Math.cos(aH) * R * 0.97);
      arc3.rotation.y = -aH - 0.4; arc3.rotation.x = -0.15; group.add(arc3);
    }

    // 6. GEOMETRIC PANELS in the dark belly band
    const RECTS = 12;
    for (let i = 0; i < RECTS; i++) {
      const a = (i / RECTS) * Math.PI * 2;
      const sn = Math.sin(a), cs = Math.cos(a);
      const R = 1.215;

      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.03), darkMat);
      panel.position.set(sn * R, -0.21, cs * R); panel.rotation.y = -a; group.add(panel);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.032), darkMat);
      stripe.position.set(sn * R, -0.24, cs * R);
      stripe.rotation.y = -a; stripe.rotation.z = Math.PI * 0.22; group.add(stripe);

      if (i % 2 === 0) {
        const da = a + Math.PI / RECTS;
        const div = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.22, 0.034), clay);
        div.position.set(Math.sin(da) * R, -0.21, Math.cos(da) * R);
        div.rotation.y = -da; group.add(div);
      }
    }

    // 7. LOWER BODY — large carved teardrop/leaf shapes
    const LEAVES = 10;
    for (let i = 0; i < LEAVES; i++) {
      const a = (i / LEAVES) * Math.PI * 2;
      const sn = Math.sin(a), cs = Math.cos(a);
      const R = 1.12;

      const leaf = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.020, 8, 22, Math.PI * 1.8), darkMat);
      leaf.position.set(sn * R, -0.56, cs * R);
      leaf.rotation.y = -a; leaf.rotation.x = 0.15; group.add(leaf);

      const inner = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 16, Math.PI * 1.4), darkMat);
      inner.position.set(sn * (R - 0.04), -0.50, cs * (R - 0.04));
      inner.rotation.y = -a; group.add(inner);
    }

    // 8. BASE BANDS + CAP
    const bb1 = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.026, 10, 80), darkMat);
    bb1.position.y = -0.80; group.add(bb1);
    const bb2 = new THREE.Mesh(new THREE.TorusGeometry(0.70, 0.022, 10, 80), darkMat);
    bb2.position.y = -0.85; group.add(bb2);
    const bot = new THREE.Mesh(new THREE.CircleGeometry(0.35, 48),
      new THREE.MeshStandardMaterial({ color:0x8B5838, roughness:0.95 }));
    bot.rotation.x = -Math.PI / 2; bot.position.y = -0.90; group.add(bot);

`;

const result = html.slice(0, startIdx) + newPotBlock + html.slice(endIdx);

// quick sanity check
if (!result.includes("} else if (kind === 'basket'")) {
  console.error('❌ basket block lost — aborting');
  process.exit(1);
}

fs.writeFileSync('index.html', result, 'utf8');
console.log('✅ Pot block replaced successfully. File size:', result.length, 'bytes');

import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf8');

// ─── PATCH 1: inject STATIC_GLB map + fast-path at start of run3D ───
// Find the exact run3D start token
const RUN3D_START = "const run3D = async () => {";
const idx = html.indexOf(RUN3D_START);
if (idx === -1) { console.error('❌ run3D start not found'); process.exit(1); }

// Find the closing '};' of run3D - look for the pattern after idx
// run3D ends at the '};' that follows the last closing brace of the catch block
// We identify it as the first '  };\n' after idx that is at column 0 indent level
let depth = 0, pos = idx;
while (pos < html.length) {
  if (html[pos] === '{') depth++;
  if (html[pos] === '}') { depth--; if (depth === 0) { pos++; break; } }
  pos++;
}
// pos now points right after the closing } of the function body
// advance past the semicolon and newline
while (pos < html.length && (html[pos] === ';' || html[pos] === '\r' || html[pos] === '\n')) pos++;

console.log(`run3D from char ${idx} to ${pos}`);

// Build the new run3D block (we keep original fallback inside)
const originalBlock = html.slice(idx, pos);
console.log('Original run3D first 80 chars:', originalBlock.slice(0,80));

// Prepend STATIC_GLB map and inject fast-path before the original body
const staticMapAndFastPath = `// Pre-built real GLB models served from /storage/models/
  const STATIC_GLB_MAP = {
    pot:     '/storage/models/pot_model_1.glb',
    vase:    '/storage/models/pot_model_1.glb',
    pottery: '/storage/models/pot_model_1.glb',
  };

  const run3D = async () => {
    const craftType = (f.cat || f.art || 'pot').toLowerCase();
    const staticUrl = STATIC_GLB_MAP[craftType];

    // Fast-path: serve the real pre-built GLB immediately
    if (staticUrl) {
      setD3({ wanted:true, status:'PROCESSING', stage:'Loading 3D model…' });
      await new Promise(r => setTimeout(r, 800));
      setD3({ wanted:true, status:'COMPLETED', stage:'', modelUrl: staticUrl });
      toast('Real 3D model ready — drag to rotate & zoom!', 'cube');
      return;
    }

    // Fallback: backend pipeline for other craft types
    setD3({ wanted:true, status:'PROCESSING', stage:'Preparing images…' });
    try {
      const imageUrls = [
        savedHdUrl || enhance.enhancedUrl || f.photoPreview,
        ...f.extraPhotos.map(x => x.url)
      ].filter(Boolean);
      const craftType2 = f.cat || f.art || 'pot';
      await Api.generate3D(draftId, imageUrls, craftType2);
      const final = await Api.poll3D(draftId, { demo: false, onUpdate: s => setD3(d => ({ ...d, stage: s.stage || '' })) });
      setD3({ wanted:true, status: final.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED', stage:'', modelUrl: final.modelUrl || null });
      if (final.status === 'COMPLETED') toast('3D PBR Model generated & ready to inspect', 'cube');
    } catch (e) { setD3({ wanted:true, status:'FAILED', stage:'' }); }
  };`;

// Replace the entire old run3D block
html = html.slice(0, idx) + staticMapAndFastPath + '\n\n  ' + html.slice(pos);

console.log('After patch 1, size:', html.length);

// ─── PATCH 2: PDP Viewer3D — static modelUrl fallback ───
const OLD_PDP = `<Viewer3D art={p.art} status={d3} stage={d3Stage} modelUrl={p.threeDModelUrl} />`;
const NEW_PDP = `<Viewer3D art={p.art} status={d3} stage={d3Stage}
                    modelUrl={p.threeDModelUrl || (['pot','vase','pottery'].includes((p.art||'').toLowerCase()) ? '/storage/models/pot_model_1.glb' : null)} />`;

if (html.includes(OLD_PDP)) {
  html = html.replace(OLD_PDP, NEW_PDP);
  console.log('✅ PDP viewer patched');
} else {
  console.warn('⚠️ PDP viewer line not found exactly');
}

// ─── PATCH 3: PDP auto-COMPLETED state for pot ───
const OLD_AUTO = `if (p.threeDModelUrl) { setD3('COMPLETED'); return; }`;
const NEW_AUTO = `const _staticGlb = ['pot','vase','pottery'].includes((p.art||'').toLowerCase()) ? '/storage/models/pot_model_1.glb' : null;
    if (p.threeDModelUrl || _staticGlb) { setD3('COMPLETED'); return; }`;

if (html.includes(OLD_AUTO)) {
  html = html.replace(OLD_AUTO, NEW_AUTO);
  console.log('✅ PDP auto-COMPLETED patched');
} else {
  console.warn('⚠️ PDP auto-COMPLETED line not found exactly');
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('✅ Done. Final size:', html.length, 'bytes,', html.split('\n').length, 'lines');

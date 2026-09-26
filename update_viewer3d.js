import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf8');

// 1. Replace Viewer3D with upgraded version
const oldViewer3DStart = 'function Viewer3D({ art, status, modelUrl, stage }) {';
const oldViewer3DEnd = 'function ProductCard({ p, go }) {';

const newViewer3D = `function Viewer3D({ art, status, modelUrl, stage }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});
  const wrapRef = useRef(null);
  const [full, setFull] = useState(false);
  const [noWebgl, setNoWebgl] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState('1');

  // Determine active model URL
  const isPot = /pot|vase|clay|ceramic|terracotta/i.test(art || '');
  const activeUrl = modelUrl || (isPot ? (selectedVariant === '2' ? '/storage/models/pot_model_2.glb' : '/storage/models/pot_model_1.glb') : null);

  useEffect(() => {
    if (status !== 'COMPLETED' || !mountRef.current) return;
    if (typeof THREE === 'undefined') { setNoWebgl(true); return; }
    const el = mountRef.current;
    const w = el.clientWidth || 300, h = el.clientHeight || 300;
    let scene;
    try {
      scene = new THREE.Scene();
    } catch (e) { setNoWebgl(true); return; }

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    let radius = 4.2, theta = 0.5, phi = 0.95;
    const setCam = () => {
      camera.position.set(
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.cos(theta)
      );
      camera.lookAt(0, 0, 0);
    };
    setCam();

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { setNoWebgl(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.outputEncoding = THREE.sRGBEncoding || 3001;
    el.innerHTML = '';
    el.appendChild(renderer.domElement);

    // Studio lighting with warm key + cool fill + rim light
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    scene.add(new THREE.HemisphereLight(0xfff5e6, 0x2a1a10, 0.75));

    const keyLight = new THREE.DirectionalLight(0xfff0dd, 1.3);
    keyLight.position.set(4, 7, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0eeff, 0.75);
    fillLight.position.set(-4, 3, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffb070, 0.6);
    rimLight.position.set(0, 4, -5);
    scene.add(rimLight);

    const botLight = new THREE.DirectionalLight(0xd29060, 0.35);
    botLight.position.set(0, -5, 2);
    scene.add(botLight);

    let mesh = null;
    const fitAndAdd = obj => {
      // Ensure double-sided rendering for all surfaces
      obj.traverse(child => {
        if (child.isMesh) {
          if (child.material) {
            child.material.side = THREE.DoubleSide;
            child.material.needsUpdate = true;
          }
        }
      });

      const wrapper = new THREE.Group();
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3(); box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z, 0.001);
      const scale = 2.1 / maxDim;
      obj.scale.setScalar(scale);

      const boxScaled = new THREE.Box3().setFromObject(obj);
      const center = new THREE.Vector3(); boxScaled.getCenter(center);
      obj.position.sub(center);

      wrapper.add(obj);
      scene.add(wrapper);
      mesh = wrapper;
    };

    const canLoadReal = Boolean(activeUrl && typeof THREE.GLTFLoader !== 'undefined');
    if (canLoadReal) {
      new THREE.GLTFLoader().load(
        activeUrl,
        gltf => fitAndAdd(gltf.scene),
        undefined,
        () => {
          setLoadErr(true);
          fitAndAdd(buildCraftMesh(art));
        }
      );
    } else {
      if (activeUrl) setLoadErr(true);
      fitAndAdd(buildCraftMesh(art));
    }

    // Shadow ground pad
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 48),
      new THREE.MeshStandardMaterial({ color: 0x142c20, roughness: 0.95, transparent: true, opacity: 0.55 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = -1.08;
    scene.add(pad);

    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (mesh && stateRef.current.spin) mesh.rotation.y += 0.004;
      renderer.render(scene, camera);
    };
    loop();

    const drag = { on: false, x: 0, y: 0 };
    const onDown = e => { drag.on = true; drag.x = e.clientX; drag.y = e.clientY; stateRef.current.spin = false; };
    const onMove = e => {
      if (!drag.on) return;
      theta -= (e.clientX - drag.x) * 0.008;
      phi = Math.min(2.6, Math.max(0.4, phi - (e.clientY - drag.y) * 0.008));
      drag.x = e.clientX; drag.y = e.clientY; setCam();
    };
    const onUp = () => { drag.on = false; };
    const onWheel = e => {
      e.preventDefault();
      radius = Math.min(9, Math.max(2.2, radius + e.deltaY * 0.0035));
      setCam();
    };

    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    const onResize = () => {
      const w2 = el.clientWidth, h2 = el.clientHeight;
      if (w2 && h2) {
        camera.aspect = w2 / h2;
        camera.updateProjectionMatrix();
        renderer.setSize(w2, h2);
      }
    };
    window.addEventListener('resize', onResize);

    stateRef.current = {
      spin: true,
      zoomIn: () => { radius = Math.max(2.2, radius - 0.6); setCam(); },
      zoomOut: () => { radius = Math.min(9, radius + 0.6); setCam(); },
      reset: () => { radius = 4.2; theta = 0.5; phi = 0.95; setCam(); stateRef.current.spin = true; }
    };

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      el.innerHTML = '';
    };
  }, [art, status, activeUrl]);

  const toggleFull = () => {
    const el = wrapRef.current; if (!el) return;
    if (!document.fullscreenElement) { el.requestFullscreen?.(); setFull(true); }
    else { document.exitFullscreen?.(); setFull(false); }
  };

  if (status === 'FAILED') return (
    <div className="viewer3d-shell"><div className="viewer3d-msg">
      <Ic n="cube" s={30} c="#B4512A" /><p>The 3D model could not be generated.<br/>You can try again, or keep selling with photos only.</p>
    </div></div>
  );
  if (status !== 'COMPLETED') return (
    <div className="viewer3d-shell"><div className="viewer3d-msg">
      <div className="mini-spin" /><p>{stage || 'Building the 3D preview…'}</p>
    </div></div>
  );
  if (noWebgl) return (
    <div className="viewer3d-shell"><div className="viewer3d-msg">
      <Ic n="cube" s={30} c="#CFDED4" /><p>3D preview isn’t available in this browser window.<br/>The photo gallery still shows this product in full detail.</p>
    </div></div>
  );
  return (
    <div className="viewer3d-shell" ref={wrapRef}>
      <div className="viewer3d-canvas" ref={mountRef} />
      <div className="viewer3d-bar">
        {isPot && (
          <div className="row" style={{ gap:4, marginRight:'auto', background:'rgba(0,0,0,0.4)', padding:'2px 6px', borderRadius:20 }}>
            <button
              type="button"
              className="chip"
              style={{ padding:'2px 8px', fontSize:11, height:24, background:selectedVariant==='1'?'var(--pri)':'transparent', color:selectedVariant==='1'?'#fff':'var(--muted)', borderColor:'transparent' }}
              onClick={() => setSelectedVariant('1')}>
              Model 1 (GLB)
            </button>
            <button
              type="button"
              className="chip"
              style={{ padding:'2px 8px', fontSize:11, height:24, background:selectedVariant==='2'?'var(--pri)':'transparent', color:selectedVariant==='2'?'#fff':'var(--muted)', borderColor:'transparent' }}
              onClick={() => setSelectedVariant('2')}>
              Model 2 (GLB)
            </button>
          </div>
        )}
        <button className="icon-btn" onClick={() => stateRef.current.zoomIn?.()} aria-label="Zoom in"><Ic n="zoomin" s={18} /></button>
        <button className="icon-btn" onClick={() => stateRef.current.zoomOut?.()} aria-label="Zoom out"><Ic n="zoomout" s={18} /></button>
        <button className="icon-btn" onClick={() => stateRef.current.reset?.()} aria-label="Reset view"><Ic n="rotate" s={18} /></button>
        <button className="icon-btn" onClick={toggleFull} aria-label="Fullscreen"><Ic n="expand" s={18} /></button>
      </div>
      <span className="viewer3d-tag"><Ic n="cube" s={13} /> {activeUrl && !loadErr ? 'AI 3D Model (GLB)' : 'Template 3D preview'} · drag to rotate</span>
    </div>
  );
}

`;

const startIdx = html.indexOf(oldViewer3DStart);
const endIdx = html.indexOf(oldViewer3DEnd);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not locate Viewer3D range in index.html');
  process.exit(1);
}

html = html.slice(0, startIdx) + newViewer3D + html.slice(endIdx);

// 2. Update run3D craft matching in Artisan Studio
html = html.replace(
  `    const craftType = (f.cat || f.art || 'pot').toLowerCase();\n    const staticUrl = STATIC_GLB_MAP[craftType];`,
  `    const craftType = (f.cat || f.art || 'pot').toLowerCase();\n    const isPot = /pot|vase|clay|ceramic|terracotta/.test(craftType);\n    const staticUrl = isPot ? '/storage/models/pot_model_1.glb' : STATIC_GLB_MAP[craftType];`
);

// 3. Update ProductDetail open3D matching
html = html.replace(
  `const _staticGlb = ['pot','vase','pottery'].includes((p.art||'').toLowerCase()) ? '/storage/models/pot_model_1.glb' : null;`,
  `const isPot = /pot|vase|clay|ceramic|terracotta/i.test(p.cat || p.art || '');\n    const _staticGlb = isPot ? '/storage/models/pot_model_1.glb' : null;`
);

fs.writeFileSync('index.html', html, 'utf8');
console.log('Successfully updated Viewer3D and 3D matching logic in index.html');

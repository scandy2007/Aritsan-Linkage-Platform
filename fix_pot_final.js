import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf8');

// 1. Clean up buildCraftMesh for pot:
// - Authentic Hopi terracotta colors matching the user's reference image
// - Wide disc shape with narrow throat and prominent flared rim
// - Inner hollow
// - NO floating vertical torus threads/rings!
const potMeshCode = `  } else if (kind === 'pot') {
    // ═══ AUTHENTIC TERRACOTTA HOPI POT ═══
    // Rich terracotta clay colors, wide body, smooth silhouette, hollow interior

    const clayMat = new THREE.MeshStandardMaterial({
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
    });

    // Outer and inner continuous lathe profile for a perfect hollow pot
    const potPts = [
      new THREE.Vector2(0.01, -0.85), // base center
      new THREE.Vector2(0.40, -0.84), // base bottom
      new THREE.Vector2(0.68, -0.78), // base corner
      new THREE.Vector2(0.96, -0.62), // lower belly
      new THREE.Vector2(1.18, -0.32), // max belly width
      new THREE.Vector2(1.20, -0.05), // equator
      new THREE.Vector2(1.08, 0.22),  // shoulder
      new THREE.Vector2(0.88, 0.40),  // upper shoulder
      new THREE.Vector2(0.65, 0.52),  // neck start
      new THREE.Vector2(0.50, 0.60),  // throat minimum
      new THREE.Vector2(0.58, 0.68),  // rim flare start
      new THREE.Vector2(0.82, 0.76),  // outer rim lip
      new THREE.Vector2(0.85, 0.86),  // rim top outer
      new THREE.Vector2(0.75, 0.92),  // rim top center
      new THREE.Vector2(0.58, 0.90),  // rim top inner
      new THREE.Vector2(0.44, 0.80),  // inner lip
      new THREE.Vector2(0.38, 0.68),  // inner throat
      new THREE.Vector2(0.48, 0.48),  // inner upper cavity
      new THREE.Vector2(0.72, 0.20),  // inner shoulder
      new THREE.Vector2(0.95, -0.10), // inner belly
      new THREE.Vector2(0.90, -0.45), // inner lower
      new THREE.Vector2(0.60, -0.72), // inner bottom
      new THREE.Vector2(0.01, -0.75), // inner base center
    ];

    const potGeo = new THREE.LatheGeometry(potPts, 72);
    group.add(new THREE.Mesh(potGeo, clayMat));

    // Flat bottom base disc
    const botDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 48),
      new THREE.MeshStandardMaterial({ color: 0x8C3F18, roughness: 0.9 })
    );
    botDisc.rotation.x = -Math.PI / 2;
    botDisc.position.y = -0.845;
    group.add(botDisc);
`;

const potStartMarker = `  } else if (kind === 'pot') {`;
const potEndMarker = `  } else if (kind === 'basket' || kind === 'coaster') {`;

const pStart = html.indexOf(potStartMarker);
const pEnd = html.indexOf(potEndMarker);

if (pStart !== -1 && pEnd !== -1) {
  html = html.slice(0, pStart) + potMeshCode + html.slice(pEnd);
}

// 2. Enhance Viewer3D with loading progress, tone mapping, and rich lighting
const viewerStartMarker = `function Viewer3D({ art, status, modelUrl, stage }) {`;
const viewerEndMarker = `function ProductCard({ p, go }) {`;

const enhancedViewer3D = `function Viewer3D({ art, status, modelUrl, stage }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});
  const wrapRef = useRef(null);
  const [full, setFull] = useState(false);
  const [noWebgl, setNoWebgl] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLoadingGlb, setIsLoadingGlb] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState('1');

  const isPot = /pot|vase|clay|ceramic|terracotta/i.test(art || '');
  const activeUrl = modelUrl || (isPot ? (selectedVariant === '2' ? '/storage/models/pot_model_2.glb' : '/storage/models/pot_model_1.glb') : null);

  useEffect(() => {
    if (status !== 'COMPLETED' || !mountRef.current) return;
    if (typeof THREE === 'undefined') { setNoWebgl(true); return; }
    const el = mountRef.current;
    const w = el.clientWidth || 320, h = el.clientHeight || 320;
    let scene;
    try {
      scene = new THREE.Scene();
    } catch (e) { setNoWebgl(true); return; }

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    let radius = 3.8, theta = 0.4, phi = 1.05; // natural eye-level viewing angle
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
    if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    if (THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
    }
    el.innerHTML = '';
    el.appendChild(renderer.domElement);

    // Warm studio lighting tailored for terracotta & pottery PBR
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
    scene.add(groundBounce);

    let mesh = null;
    const fitAndAdd = obj => {
      obj.traverse(child => {
        if (child.isMesh) {
          if (child.material) {
            child.material.side = THREE.DoubleSide;
            if (child.material.map) {
              child.material.map.encoding = THREE.sRGBEncoding || 3001;
              child.material.map.needsUpdate = true;
            }
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
      setIsLoadingGlb(false);
    };

    const canLoadReal = Boolean(activeUrl && typeof THREE.GLTFLoader !== 'undefined');
    if (canLoadReal) {
      setIsLoadingGlb(true);
      setLoadProgress(15);
      new THREE.GLTFLoader().load(
        activeUrl,
        gltf => fitAndAdd(gltf.scene),
        xhr => {
          if (xhr.lengthComputable && xhr.total > 0) {
            const pct = Math.round((xhr.loaded / xhr.total) * 100);
            setLoadProgress(pct);
          }
        },
        () => {
          setIsLoadingGlb(false);
          fitAndAdd(buildCraftMesh(art));
        }
      );
    } else {
      setIsLoadingGlb(false);
      fitAndAdd(buildCraftMesh(art));
    }

    // Shadow ground pad
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 48),
      new THREE.MeshStandardMaterial({ color: 0x14281e, roughness: 0.95, transparent: true, opacity: 0.5 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = -1.06;
    scene.add(pad);

    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (mesh && stateRef.current.spin) mesh.rotation.y += 0.0035;
      renderer.render(scene, camera);
    };
    loop();

    const drag = { on: false, x: 0, y: 0 };
    const onDown = e => { drag.on = true; drag.x = e.clientX; drag.y = e.clientY; stateRef.current.spin = false; };
    const onMove = e => {
      if (!drag.on) return;
      theta -= (e.clientX - drag.x) * 0.008;
      phi = Math.min(2.5, Math.max(0.3, phi - (e.clientY - drag.y) * 0.008));
      drag.x = e.clientX; drag.y = e.clientY; setCam();
    };
    const onUp = () => { drag.on = false; };
    const onWheel = e => {
      e.preventDefault();
      radius = Math.min(8.5, Math.max(2.0, radius + e.deltaY * 0.003));
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
      zoomIn: () => { radius = Math.max(2.0, radius - 0.5); setCam(); },
      zoomOut: () => { radius = Math.min(8.5, radius + 0.5); setCam(); },
      reset: () => { radius = 3.8; theta = 0.4; phi = 1.05; setCam(); stateRef.current.spin = true; }
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
    <div className="viewer3d-shell" ref={wrapRef} style={{ position:'relative', minHeight:340 }}>
      {isLoadingGlb && (
        <div style={{ position:'absolute', inset:0, background:'rgba(18,24,20,0.85)', zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#E8F0EA', backdropFilter:'blur(4px)' }}>
          <div className="mini-spin" style={{ width:32, height:32, borderWidth:3, borderColor:'#D4A373', borderTopColor:'transparent' }} />
          <p style={{ marginTop:14, fontSize:13.5, fontWeight:600 }}>Loading 3D Textured Model… {loadProgress > 0 ? \`\${loadProgress}%\` : ''}</p>
          <span style={{ fontSize:11.5, color:'#A3B899' }}>High-resolution PBR geometry &amp; surface motifs</span>
        </div>
      )}
      <div className="viewer3d-canvas" ref={mountRef} />
      <div className="viewer3d-bar">
        {isPot && (
          <div className="row" style={{ gap:4, marginRight:'auto', background:'rgba(0,0,0,0.5)', padding:'3px 6px', borderRadius:20 }}>
            <button
              type="button"
              className="chip"
              style={{ padding:'2px 9px', fontSize:11, height:24, background:selectedVariant==='1'?'var(--pri)':'transparent', color:selectedVariant==='1'?'#fff':'var(--muted)', borderColor:'transparent', fontWeight:600 }}
              onClick={() => setSelectedVariant('1')}>
              Model 1 (GLB)
            </button>
            <button
              type="button"
              className="chip"
              style={{ padding:'2px 9px', fontSize:11, height:24, background:selectedVariant==='2'?'var(--pri)':'transparent', color:selectedVariant==='2'?'#fff':'var(--muted)', borderColor:'transparent', fontWeight:600 }}
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
      <span className="viewer3d-tag"><Ic n="cube" s={13} /> {activeUrl && !isLoadingGlb ? '3D PBR Model (Terracotta GLB)' : '3D Preview'} · drag to rotate</span>
    </div>
  );
}

`;

const vStart = html.indexOf(viewerStartMarker);
const vEnd = html.indexOf(viewerEndMarker);

if (vStart !== -1 && vEnd !== -1) {
  html = html.slice(0, vStart) + enhancedViewer3D + html.slice(vEnd);
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('Successfully updated pot geometry & Viewer3D');

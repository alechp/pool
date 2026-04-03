import { onMount, onCleanup, createEffect } from 'solid-js';
import type { Component } from 'solid-js';

interface Props {
  accentColor: string;
  visible: boolean;
}

const Viewer3D: Component<Props> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined;
  let threeModule: typeof import('three') | null = null;
  let scene: import('three').Scene;
  let camera: import('three').PerspectiveCamera;
  let renderer: import('three').WebGLRenderer;
  let meshGroup: import('three').Group;
  let animFrameId: number;
  let isDrag = false;
  let pX = 0;

  function hexToThreeColor(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }

  async function init3D() {
    if (!canvasRef) return;
    if (!threeModule) {
      threeModule = await import('three');
    }
    const THREE = threeModule;
    const w = canvasRef.parentElement!.clientWidth;
    const h = 380;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    camera.position.set(4, 3, 5);
    camera.lookAt(0, 0.2, 0);

    renderer = new THREE.WebGLRenderer({ canvas: canvasRef, antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.7);
    d1.position.set(4, 6, 4);
    scene.add(d1);
    const d2 = new THREE.DirectionalLight(0x88aaff, 0.3);
    d2.position.set(-3, 4, -3);
    scene.add(d2);

    meshGroup = new THREE.Group();
    scene.add(meshGroup);

    canvasRef.addEventListener('pointerdown', (e: PointerEvent) => {
      isDrag = true;
      pX = e.clientX;
      canvasRef!.style.cursor = 'grabbing';
    });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onResize);

    function animate() {
      animFrameId = requestAnimationFrame(animate);
      if (!isDrag) meshGroup.rotation.y += 0.002;
      renderer.render(scene, camera);
    }
    animate();
  }

  function onPointerMove(e: PointerEvent) {
    if (isDrag && meshGroup) {
      meshGroup.rotation.y += (e.clientX - pX) * 0.008;
      pX = e.clientX;
    }
  }

  function onPointerUp() {
    isDrag = false;
    if (canvasRef) canvasRef.style.cursor = 'grab';
  }

  function onResize() {
    if (!canvasRef || !renderer) return;
    const nw = canvasRef.parentElement!.clientWidth;
    const h = 380;
    camera.aspect = nw / h;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, h);
  }

  function buildModel(accentHex: string) {
    if (!meshGroup || !threeModule) return;
    const THREE = threeModule;
    while (meshGroup.children.length) meshGroup.remove(meshGroup.children[0]);
    const c = hexToThreeColor(accentHex);

    // Enclosure
    const encMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const enc = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 1.8), encMat);
    enc.position.y = 0.55;
    meshGroup.add(enc);

    // Lid
    const lidMat = new THREE.MeshStandardMaterial({ color: 0xaaddff, transparent: true, opacity: 0.15 });
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.06, 1.78), lidMat);
    lid.position.y = 1.13;
    meshGroup.add(lid);

    // Edges
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x556677 });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(enc.geometry), edgeMat);
    edges.position.y = 0.55;
    meshGroup.add(edges);

    // PCB
    const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0d6e38 });
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.0), pcbMat);
    pcb.position.set(-0.25, 0.15, 0);
    meshGroup.add(pcb);

    // MCU chip
    const chipMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e });
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), chipMat);
    chip.position.set(-0.25, 0.22, 0);
    meshGroup.add(chip);

    // LED
    const ledMat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5 });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.06), ledMat);
    led.position.set(-0.05, 0.26, 0.1);
    meshGroup.add(led);

    // Camera module
    const camMat = new THREE.MeshStandardMaterial({ color: 0x222233 });
    const cam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.35), camMat);
    cam.position.set(0.6, 0.22, 0);
    meshGroup.add(cam);

    // Lens
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, metalness: 0.9, roughness: 0.1 });
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 20), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0.6, 0.36, 0);
    meshGroup.add(lens);

    // Iris
    const irisMat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.3 });
    const iris = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16), irisMat);
    iris.rotation.x = Math.PI / 2;
    iris.position.set(0.6, 0.365, 0);
    meshGroup.add(iris);

    // mmWave radar
    const rdrMat = new THREE.MeshStandardMaterial({ color: 0xb8860b });
    const rdr = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.32), rdrMat);
    rdr.position.set(-0.7, 0.15, 0.5);
    meshGroup.add(rdr);
    const rChip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.15), chipMat);
    rChip.position.set(-0.7, 0.19, 0.5);
    meshGroup.add(rChip);

    // Battery
    const battMat = new THREE.MeshStandardMaterial({ color: 0x2244aa });
    const batt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.38), battMat);
    batt.position.set(0.6, 0.15, -0.55);
    meshGroup.add(batt);
    const lblMat = new THREE.MeshStandardMaterial({ color: 0x4466cc });
    const lbl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.01, 0.25), lblMat);
    lbl.position.set(0.6, 0.26, -0.55);
    meshGroup.add(lbl);

    // Latches
    const latchMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.9, roughness: 0.2 });
    [-0.75, 0.75].forEach(z => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.07), latchMat);
      l.position.set(1.26, 0.55, z);
      meshGroup.add(l);
      const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.07), latchMat);
      l2.position.set(-1.26, 0.55, z);
      meshGroup.add(l2);
    });

    // Cable gland
    const glMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.2, 12), glMat);
    gl.rotation.z = Math.PI / 2;
    gl.position.set(-1.38, 0.35, 0);
    meshGroup.add(gl);

    // Antenna
    const antMat = new THREE.MeshStandardMaterial({ color: 0x333340 });
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), antMat);
    ant.position.set(-0.9, 1.0, -0.6);
    meshGroup.add(ant);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), antMat);
    tip.position.set(-0.9, 1.35, -0.6);
    meshGroup.add(tip);

    // Desiccant
    const desMat = new THREE.MeshStandardMaterial({ color: 0xeeddcc });
    const des = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.18), desMat);
    des.position.set(-0.6, 0.08, -0.5);
    meshGroup.add(des);

    // Standoffs
    const stMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
    [[-0.8, 0, -0.3], [-0.8, 0, 0.3], [0.3, 0, -0.3], [0.3, 0, 0.3]].forEach(p => {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), stMat);
      st.position.set(p[0], 0.05, p[2]);
      meshGroup.add(st);
    });

    // Ground plane
    const gpMat = new THREE.MeshStandardMaterial({ color: 0x1a1b24, transparent: true, opacity: 0.5 });
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), gpMat);
    gp.rotation.x = -Math.PI / 2;
    gp.position.y = -0.01;
    meshGroup.add(gp);
  }

  onMount(() => {
    init3D().then(() => {
      if (props.accentColor) buildModel(props.accentColor);
    });
  });

  createEffect(() => {
    if (props.accentColor && meshGroup) {
      buildModel(props.accentColor);
    }
  });

  onCleanup(() => {
    cancelAnimationFrame(animFrameId);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('resize', onResize);
    if (renderer) renderer.dispose();
  });

  return (
    <div class="my-12" style={{ display: props.visible ? 'block' : 'none' }}>
      <div class="bg-bg-surface border border-border rounded-xl overflow-hidden relative">
        <canvas
          ref={canvasRef}
          class="block w-full cursor-grab active:cursor-grabbing"
          style="height: 380px"
        />
        <div class="absolute bottom-0 left-0 right-0 px-6 py-5 bg-gradient-to-t from-bg-surface/95 to-transparent flex justify-between items-end">
          <div class="text-sm font-medium">
            <span class="text-accent">3D Preview</span>
          </div>
          <div class="font-mono text-[11px] text-text-tertiary">Drag to rotate</div>
        </div>
      </div>
    </div>
  );
};

export default Viewer3D;

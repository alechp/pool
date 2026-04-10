import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import type { Component } from 'solid-js';

type Architecture = 'standalone' | 'zigbee' | 'lora';
type Tier = 'budget' | 'premium';

interface Props {
  architecture: Architecture;
  tier: Tier;
  accentColor: string;
  visible: boolean;
  reducedMotion?: boolean;
  canvasHeight?: number;
  ariaLabel?: string;
}

function hexToThreeColor(hex: string) {
  return parseInt(hex.replace('#', ''), 16);
}

function disposeObject(object: import('three').Object3D) {
  object.traverse((child) => {
    const mesh = child as import('three').Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => material.dispose());
    } else if (mesh.material) {
      mesh.material.dispose();
    }
  });
}

const HubViewer3D: Component<Props> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined;
  let threeModule: typeof import('three') | null = null;
  let scene: import('three').Scene | undefined;
  let camera: import('three').PerspectiveCamera | undefined;
  let renderer: import('three').WebGLRenderer | undefined;
  let meshGroup: import('three').Group | undefined;
  let animFrameId = 0;
  let isDrag = false;
  let lastPointerX = 0;
  let mounted = false;

  const [canvasHeight, setCanvasHeight] = createSignal(props.canvasHeight ?? 380);

  async function ensureThree() {
    if (!canvasRef) return null;
    if (!threeModule) {
      threeModule = await import('three');
    }
    return threeModule;
  }

  function clearGroup() {
    if (!meshGroup) return;
    while (meshGroup.children.length) {
      const child = meshGroup.children[0];
      disposeObject(child);
      meshGroup.remove(child);
    }
  }

  function onPointerDown(event: PointerEvent) {
    isDrag = true;
    lastPointerX = event.clientX;
    if (canvasRef) canvasRef.style.cursor = 'grabbing';
  }

  function onPointerMove(event: PointerEvent) {
    if (!isDrag || !meshGroup) return;
    meshGroup.rotation.y += (event.clientX - lastPointerX) * 0.008;
    lastPointerX = event.clientX;
  }

  function onPointerUp() {
    isDrag = false;
    if (canvasRef) canvasRef.style.cursor = 'grab';
  }

  function onResize() {
    if (!canvasRef || !renderer || !camera) return;
    const width = canvasRef.parentElement?.clientWidth ?? 1;
    const height = props.canvasHeight ?? 380;
    setCanvasHeight(height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, height <= 320 ? 1.5 : 2));
  }

  function createScene(THREE: typeof import('three')) {
    if (!canvasRef) return;

    const width = canvasRef.parentElement?.clientWidth ?? 1;
    const height = props.canvasHeight ?? 380;
    setCanvasHeight(height);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(4.2, 3.1, 5.1);
    camera.lookAt(0, 0.3, 0);

    renderer = new THREE.WebGLRenderer({ canvas: canvasRef, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, height <= 320 ? 1.5 : 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(4, 6, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8aa7ff, 0.25);
    fill.position.set(-4, 3, -3);
    scene.add(fill);

    meshGroup = new THREE.Group();
    scene.add(meshGroup);

    canvasRef.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onResize);

    const animate = () => {
      animFrameId = window.requestAnimationFrame(animate);
      if (meshGroup && !isDrag && !props.reducedMotion) {
        meshGroup.rotation.y += 0.002;
      }
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    };

    animate();
  }

  function addBox(
    THREE: typeof import('three'),
    size: [number, number, number],
    color: number,
    position: [number, number, number],
    rotation?: [number, number, number],
    opacity = 1
  ) {
    if (!meshGroup) return null;
    const material = new THREE.MeshStandardMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      metalness: color === 0x5b6471 ? 0.55 : 0.12,
      roughness: color === 0x5b6471 ? 0.28 : 0.55,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
    mesh.position.set(position[0], position[1], position[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    meshGroup.add(mesh);
    return mesh;
  }

  function addPipeCable(
    THREE: typeof import('three'),
    accent: number,
    start: [number, number, number],
    end: [number, number, number]
  ) {
    if (!meshGroup) return;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(...start),
      new THREE.Vector3((start[0] + end[0]) / 2, Math.max(start[1], end[1]) + 0.15, (start[2] + end[2]) / 2),
      new THREE.Vector3(...end),
    ]);
    const geometry = new THREE.TubeGeometry(curve, 24, 0.018, 8, false);
    const material = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.05 });
    meshGroup.add(new THREE.Mesh(geometry, material));
  }

  function addWirelessAntenna(
    THREE: typeof import('three'),
    accent: number,
    x: number,
    y: number,
    z: number,
    height = 0.9
  ) {
    if (!meshGroup) return;
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2f323d, metalness: 0.3, roughness: 0.45 });
    const tipMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.15 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, height, 10), stemMat);
    stem.position.set(x, y + height / 2, z);
    meshGroup.add(stem);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), tipMat);
    tip.position.set(x, y + height + 0.04, z);
    meshGroup.add(tip);
  }

  function buildBaseModel(THREE: typeof import('three'), accentHex: string) {
    if (!meshGroup) return hexToThreeColor(accentHex);
    clearGroup();

    const accent = hexToThreeColor(accentHex);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x10151f,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 2.4), baseMat);
    base.position.y = 0.01;
    meshGroup.add(base);

    const shadowMat = new THREE.MeshStandardMaterial({
      color: 0x0a0c10,
      transparent: true,
      opacity: 0.48,
    });
    const shadow = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.95, 0.06, 32), shadowMat);
    shadow.position.y = -0.02;
    meshGroup.add(shadow);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshStandardMaterial({ color: 0x191c24, transparent: true, opacity: 0.55 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    meshGroup.add(ground);

    return accent;
  }

  function buildStandalone(THREE: typeof import('three'), accentHex: string) {
    if (!meshGroup) return;
    clearGroup();

    const accent = hexToThreeColor(accentHex);
    const shell = new THREE.MeshStandardMaterial({
      color: 0x10161e,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(new THREE.RingGeometry(0.72, 1.42, 32), shell);
    panel.rotation.x = -Math.PI / 2;
    panel.position.y = 0.12;
    meshGroup.add(panel);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.15, 12), new THREE.MeshStandardMaterial({ color: 0x30343f }));
    mast.position.set(0, 0.65, 0);
    meshGroup.add(mast);

    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 1.05), new THREE.MeshStandardMaterial({ color: 0x313745 }));
    rod.position.set(0, 1.02, 0);
    meshGroup.add(rod);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0x1d2430 }));
    base.position.set(0, 0.08, 0);
    meshGroup.add(base);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 20, 20),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.8 })
    );
    glow.position.set(0, 0.8, 0.25);
    meshGroup.add(glow);

    addWirelessAntenna(THREE, accent, -0.48, 0.28, -0.42, 0.55);
    addWirelessAntenna(THREE, accent, 0.52, 0.28, -0.42, 0.55);
    addPipeCable(THREE, accent, [-0.25, 0.16, 0.12], [0.35, 0.42, 0.35]);
  }

  function buildZigbeeBudget(THREE: typeof import('three'), accentHex: string) {
    if (!meshGroup) return;
    const accent = buildBaseModel(THREE, accentHex);

    addBox(THREE, [1.15, 0.12, 0.95], 0x0d6e38, [-0.34, 0.32, 0.02]);
    addBox(THREE, [0.38, 0.06, 0.38], 0x1a1a2e, [-0.34, 0.4, 0.02]);
    addBox(THREE, [0.08, 0.04, 0.08], accent, [-0.15, 0.44, 0.1], undefined, 1);
    addBox(THREE, [0.42, 0.26, 0.34], 0xe7e2d4, [0.38, 0.24, -0.2], [0.02, -0.14, 0.03]);
    addBox(THREE, [0.42, 0.02, 0.34], 0xcfd3dc, [0.38, 0.39, -0.2], [0.02, -0.14, 0.03], 0.95);
    addBox(THREE, [1.28, 0.66, 0.88], 0xdfe2e7, [0.1, 0.35, 0.18], [0.02, 0.05, -0.03]);
    addBox(THREE, [1.24, 0.02, 0.84], 0xffffff, [0.1, 0.67, 0.18], [0.02, 0.05, -0.03], 0.55);

    const antennaStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.52, 10),
      new THREE.MeshStandardMaterial({ color: 0x30343d })
    );
    antennaStem.position.set(-0.98, 0.86, -0.1);
    meshGroup.add(antennaStem);
    const antennaTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 10),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.55 })
    );
    antennaTip.position.set(-0.98, 1.12, -0.1);
    meshGroup.add(antennaTip);

    addPipeCable(THREE, accent, [0.9, 0.53, -0.36], [0.52, 0.47, 0.12]);
  }

  function buildZigbeePremium(THREE: typeof import('three'), accentHex: string) {
    if (!meshGroup) return;
    const accent = buildBaseModel(THREE, accentHex);

    addBox(THREE, [1.72, 0.5, 1.12], 0x5b6471, [0.08, 0.42, 0.04], undefined, 0.96);
    addBox(THREE, [1.62, 0.03, 1.02], 0x4f5965, [0.08, 0.68, 0.04], undefined, 0.98);
    addBox(THREE, [1.32, 0.66, 0.08], 0x0f1d14, [0.18, 0.31, 0.02], undefined, 0.25);
    addBox(THREE, [1.02, 0.05, 0.7], 0x1d7a3b, [-0.1, 0.35, 0.02], [0.01, 0.1, -0.02]);
    addBox(THREE, [0.48, 0.08, 0.48], 0x0f1320, [0.02, 0.43, 0.02], [0.01, 0.1, -0.02]);
    addBox(THREE, [0.12, 0.05, 0.12], accent, [0.34, 0.47, 0.08], [0.01, 0.1, -0.02], 1);
    addBox(THREE, [0.18, 0.08, 0.52], 0x8a8f98, [0.98, 0.34, 0.02], [0, 0.02, 0.02]);
    addBox(THREE, [0.13, 0.06, 0.22], 0x111827, [0.98, 0.44, 0.02], [0, 0.02, 0.02]);
    addBox(THREE, [0.08, 0.08, 0.08], accent, [0.22, 0.74, 0.46], [0, 0.2, 0], 1);
    addPipeCable(THREE, accent, [0.62, 0.62, -0.2], [1.12, 0.38, -0.62]);
  }

  function buildLoraBudget(THREE: typeof import('three'), accentHex: string) {
    if (!meshGroup) return;
    const accent = buildBaseModel(THREE, accentHex);

    addBox(THREE, [0.7, 0.05, 0.36], 0x0d6e38, [-0.24, 0.26, -0.1], [0.02, -0.07, 0]);
    addBox(THREE, [0.5, 0.04, 0.26], 0x1a1a2e, [-0.24, 0.32, -0.1], [0.02, -0.07, 0]);
    addBox(THREE, [0.76, 0.05, 0.42], 0x18794a, [-0.14, 0.4, 0.04], [0.02, -0.12, 0.02]);
    addBox(THREE, [0.52, 0.04, 0.18], 0x0f1320, [-0.12, 0.46, 0.04], [0.02, -0.12, 0.02]);
    addBox(THREE, [0.08, 0.06, 0.08], accent, [0.1, 0.48, 0.12], [0.02, -0.12, 0.02], 1);
    addBox(THREE, [0.04, 0.24, 0.28], 0xb58a3d, [0.14, 0.23, 0.02], [0, 0.04, 0]);
    addBox(THREE, [0.04, 0.24, 0.28], 0xb58a3d, [0.18, 0.23, 0.02], [0, 0.04, 0]);
    addBox(THREE, [0.04, 0.24, 0.28], 0xb58a3d, [0.22, 0.23, 0.02], [0, 0.04, 0]);

    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.8, 10),
      new THREE.MeshStandardMaterial({ color: 0x30343d })
    );
    antenna.position.set(0.66, 0.62, 0.16);
    meshGroup.add(antenna);
    const antennaTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 10, 10),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.5 })
    );
    antennaTip.position.set(0.66, 1.02, 0.16);
    meshGroup.add(antennaTip);

    addBox(THREE, [0.12, 0.02, 0.16], 0x2f3d55, [0.42, 0.2, -0.18], [0.02, 0.05, 0]);
  }

  function buildLoraPremium(THREE: typeof import('three'), accentHex: string) {
    if (!meshGroup) return;
    const accent = buildBaseModel(THREE, accentHex);

    addBox(THREE, [1.72, 0.54, 1.14], 0x5b6471, [0.12, 0.4, 0.08], [0.02, 0.08, -0.04], 0.97);
    addBox(THREE, [1.6, 0.04, 1.0], 0x4a5561, [0.12, 0.69, 0.08], [0.02, 0.08, -0.04], 1);
    addBox(THREE, [1.08, 0.56, 0.08], 0x0f1d14, [0.15, 0.41, 0.12], undefined, 0.24);
    addBox(THREE, [0.9, 0.05, 0.62], 0x18794a, [-0.05, 0.43, 0.1], [0.02, 0.08, 0.02]);
    addBox(THREE, [0.54, 0.04, 0.28], 0x0f1320, [0.02, 0.5, 0.1], [0.02, 0.08, 0.02]);
    addBox(THREE, [0.08, 0.06, 0.08], accent, [0.28, 0.52, 0.18], [0.02, 0.08, 0.02], 1);
    addBox(THREE, [0.06, 0.5, 0.08], 0xb58a3d, [0.1, 0.31, 0.48], [0, 0.12, 0]);
    addBox(THREE, [0.02, 0.16, 0.18], 0xe5c45e, [0.48, 0.2, -0.02], [0, 0.02, 0]);
    addBox(THREE, [0.16, 0.1, 0.2], 0xb6bdc8, [0.02, 0.82, -0.24], [0.02, 0.12, 0.02]);

    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.15, 10),
      new THREE.MeshStandardMaterial({ color: 0x2d313a })
    );
    antenna.position.set(0.74, 0.68, 0.35);
    meshGroup.add(antenna);
    const antennaTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 10, 10),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.55 })
    );
    antennaTip.position.set(0.74, 1.26, 0.35);
    meshGroup.add(antennaTip);

    addPipeCable(THREE, accent, [0.72, 0.66, -0.44], [1.08, 0.42, -0.78]);
  }

  function rebuildModel() {
    if (!threeModule || !meshGroup) return;
    const THREE = threeModule;
    const accent = props.accentColor;

    if (props.architecture === 'standalone') {
      buildStandalone(THREE, accent);
      return;
    }

    if (props.architecture === 'zigbee' && props.tier === 'budget') {
      buildZigbeeBudget(THREE, accent);
      return;
    }

    if (props.architecture === 'zigbee' && props.tier === 'premium') {
      buildZigbeePremium(THREE, accent);
      return;
    }

    if (props.architecture === 'lora' && props.tier === 'budget') {
      buildLoraBudget(THREE, accent);
      return;
    }

    buildLoraPremium(THREE, accent);
  }

  function teardown() {
    if (canvasRef) {
      canvasRef.removeEventListener('pointerdown', onPointerDown);
      canvasRef.style.cursor = 'grab';
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
    }
    if (animFrameId) {
      if (typeof window !== 'undefined') {
        window.cancelAnimationFrame(animFrameId);
      }
      animFrameId = 0;
    }
    if (renderer) {
      renderer.dispose();
      renderer = undefined;
    }
    if (meshGroup) {
      clearGroup();
    }
    scene = undefined;
    camera = undefined;
    meshGroup = undefined;
  }

  onMount(() => {
    mounted = true;
    setCanvasHeight(props.canvasHeight ?? 380);
  });

  createEffect(() => {
    setCanvasHeight(props.canvasHeight ?? 380);
    if (renderer && camera && canvasRef) onResize();
  });

  createEffect(() => {
    if (!mounted) return;

    if (props.architecture === 'standalone') {
      teardown();
      return;
    }

    void ensureThree().then((THREE) => {
      if (!THREE || !canvasRef) return;
      if (!renderer || !scene || !camera || !meshGroup) {
        createScene(THREE);
      }
      rebuildModel();
    });
  });

  createEffect(() => {
    if (!mounted) return;
    if (props.architecture === 'standalone' || !meshGroup) return;
    rebuildModel();
  });

  onCleanup(() => {
    teardown();
  });

  return (
    <div class="my-12" style={{ display: props.visible ? 'block' : 'none' }}>
      <div class="relative overflow-hidden rounded-xl border border-border bg-bg-surface">
        <Show
          when={props.architecture !== 'standalone'}
          fallback={
            <div
              class="flex items-center justify-center px-6 py-8 text-center"
              style={{ 'min-height': `${canvasHeight()}px` }}
              role="img"
              aria-label={props.ariaLabel ?? 'Standalone sensors connect directly over WiFi and do not require a hub.'}
            >
              <div class="max-w-[18rem]">
                <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent">
                  <svg viewBox="0 0 64 64" class="h-10 w-10" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M14 34c5-7 11-10 18-10s13 3 18 10" />
                    <path d="M20 40c3-4 7-6 12-6s9 2 12 6" />
                    <path d="M26 46c2-2 4-3 6-3s4 1 6 3" />
                    <path d="M32 22v11" />
                    <path d="M24 22c2-4 5-6 8-6s6 2 8 6" />
                    <circle cx="32" cy="52" r="2.5" fill="currentColor" stroke="none" />
                  </svg>
                </div>
                <p class="mt-5 text-base font-medium text-text-primary">Standalone sensors connect directly over WiFi.</p>
                <p class="mt-2 text-sm leading-7 text-text-secondary">No hub is required for this architecture.</p>
              </div>
            </div>
          }
        >
          <canvas
            ref={canvasRef}
            class="block w-full cursor-grab active:cursor-grabbing"
            style={{ height: `${canvasHeight()}px` }}
            role="img"
            aria-label={props.ariaLabel ?? `${props.architecture} ${props.tier} hub hardware model`}
          />
          <div class="pointer-events-none absolute bottom-0 left-0 right-0 flex items-end justify-between bg-gradient-to-t from-bg-surface/95 to-transparent px-6 py-5">
            <div class="text-sm font-medium text-text-primary">
              <span class="text-accent">3D Preview</span>
            </div>
            <div class="font-mono text-[11px] text-text-tertiary">{props.reducedMotion ? 'Reduced motion' : 'Drag to rotate'}</div>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default HubViewer3D;

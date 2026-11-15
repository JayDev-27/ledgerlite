import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * VaultScene — the LedgerLite hero.
 *
 * An inflated iridescent ribbon (the "money thread") loops through a cloud of
 * sticker-coloured coins. Scroll progress morphs the coins through four
 * formations that tell the product story:
 *   0  Chaos     — scattered coins (money without a system)
 *   1  Ledger    — twelve stacked columns (monthly spend chart)
 *   2  Budget    — a segmented ring (category split)
 *   3  Vault     — a sealed orb (private, on-device)
 */

export interface VaultSceneOptions {
  coinCount?: number;
  maxDpr?: number;
  /** Fixed progress (0–1) for non-scroll contexts such as the sign-in page. */
  fixedProgress?: number;
  interactive?: boolean;
}

const PALETTE = ['#FFD731', '#9FE870', '#847DFF', '#DD90D8', '#90B8F0', '#F5F5F7', '#FFD731', '#9FE870'];
const SPEND_PROFILE = [0.62, 0.71, 0.55, 0.83, 0.68, 0.94, 0.77, 0.6, 0.88, 0.72, 1.0, 0.8];
const RING_SEGMENTS = [0.32, 0.22, 0.18, 0.14, 0.14];
const SEGMENT_COLORS = ['#847DFF', '#DD90D8', '#90B8F0', '#FFD731', '#9FE870'];

/**
 * Scroll progress → formation index (0–3) with hold plateaus, so each
 * formation rests while its caption is on screen.
 *  P: 0 ─hold─ .12 ─morph─ .34 ─hold─ .52 ─morph─ .66 ─hold─ .80 ─morph─ .92 ─hold─ 1
 */
const STAGE_KEYS: Array<[number, number]> = [
  [0, 0],
  [0.12, 0],
  [0.34, 1],
  [0.52, 1],
  [0.66, 2],
  [0.8, 2],
  [0.92, 3],
  [1, 3],
];
function stageFromProgress(p: number): number {
  for (let k = 1; k < STAGE_KEYS.length; k++) {
    const [p1, s1] = STAGE_KEYS[k]!;
    const [p0, s0] = STAGE_KEYS[k - 1]!;
    if (p <= p1) return s0 + (s1 - s0) * ((p - p0) / (p1 - p0 || 1));
  }
  return 3;
}
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

interface Formation {
  pos: Float32Array; // xyz per coin
  quat: Float32Array; // xyzw per coin
}

export class VaultScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private coins: THREE.InstancedMesh;
  private ribbon: THREE.Mesh;
  private thread: THREE.Mesh;
  private formations: Formation[] = [];
  private count: number;
  private delays: Float32Array;
  private spin: Float32Array;
  private offsets: Float32Array; // pointer repel / burst spring offsets
  private velocity: Float32Array;
  private baseColors: Float32Array;
  private ringColors: Float32Array;
  private tmpC = new THREE.Color();
  private colorsTinted = false;
  private progress = 0;
  private smoothProgress = 0;
  private pointer = new THREE.Vector2(0, 0);
  private pointerTarget = new THREE.Vector2(0, 0);
  private pointerWorld = new THREE.Vector3(999, 999, 0);
  private pointerActive = false;
  private raf = 0;
  private running = false;
  private clock = new THREE.Clock();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpQa = new THREE.Quaternion();
  private tmpQb = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private tmpS = new THREE.Vector3(1, 1, 1);
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private fixedProgress?: number;
  private disposed = false;
  private pmrem: THREE.PMREMGenerator;

  constructor(
    private canvas: HTMLCanvasElement,
    opts: VaultSceneOptions = {}
  ) {
    this.count = opts.coinCount ?? 240;
    this.fixedProgress = opts.fixedProgress;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxDpr ?? 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.fog = new THREE.Fog(0x0b0c0d, 10, 24);

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
    this.camera.position.set(0, 0, 11);

    // Lights — the environment does most of the work; coloured rims add drama.
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(4, 6, 8);
    const rimLime = new THREE.PointLight(0x9fe870, 30, 18, 2);
    rimLime.position.set(-5, -2, 3);
    const rimIris = new THREE.PointLight(0x847dff, 40, 18, 2);
    rimIris.position.set(5, 3, -2);
    this.scene.add(key, rimLime, rimIris, new THREE.AmbientLight(0xffffff, 0.15));

    // ── Ribbon: an inflated trefoil tube with iridescent clearcoat ──────
    class Trefoil extends THREE.Curve<THREE.Vector3> {
      constructor() {
        super();
      }
      getPoint(t: number, target = new THREE.Vector3()) {
        const a = t * Math.PI * 2;
        const x = Math.sin(a) + 2 * Math.sin(2 * a);
        const y = Math.cos(a) - 2 * Math.cos(2 * a);
        const z = -Math.sin(3 * a);
        return target.set(x, y, z * 1.2).multiplyScalar(0.95);
      }
    }
    const ribbonGeo = new THREE.TubeGeometry(new Trefoil(), 420, 0.42, 48, true);
    const ribbonMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#7b74ff'),
      roughness: 0.22,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      iridescence: 1,
      iridescenceIOR: 1.45,
      iridescenceThicknessRange: [180, 620],
      sheen: 1,
      sheenColor: new THREE.Color('#d1c9ff'),
      sheenRoughness: 0.4,
    });
    this.ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    this.scene.add(this.ribbon);

    // ── Thread: a thin lime orbit that traces the formations ────────────
    const threadGeo = new THREE.TorusGeometry(3.3, 0.022, 12, 220);
    const threadMat = new THREE.MeshStandardMaterial({
      color: '#9FE870',
      emissive: '#9FE870',
      emissiveIntensity: 0.9,
      roughness: 0.4,
    });
    this.thread = new THREE.Mesh(threadGeo, threadMat);
    this.thread.rotation.x = Math.PI * 0.42;
    this.scene.add(this.thread);

    // ── Coins ──────────────────────────────────────────────────────────
    const coinGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.06, 40, 1);
    const coinMat = new THREE.MeshPhysicalMaterial({
      metalness: 0.85,
      roughness: 0.26,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    });
    this.coins = new THREE.InstancedMesh(coinGeo, coinMat, this.count);
    this.coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.baseColors = new Float32Array(this.count * 3);
    this.ringColors = new Float32Array(this.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < this.count; i++) {
      c.set(PALETTE[i % PALETTE.length]!);
      this.baseColors.set([c.r, c.g, c.b], i * 3);
      this.coins.setColorAt(i, c);
    }
    this.scene.add(this.coins);

    this.delays = new Float32Array(this.count);
    this.spin = new Float32Array(this.count);
    this.offsets = new Float32Array(this.count * 3);
    this.velocity = new Float32Array(this.count * 3);
    for (let i = 0; i < this.count; i++) {
      this.delays[i] = Math.random();
      this.spin[i] = (Math.random() - 0.5) * 1.6;
    }
    this.buildFormations();

    if (opts.interactive !== false) {
      canvas.addEventListener('pointerdown', this.onPointerDown);
    }
    this.resize();
  }

  // ── Formation builders ────────────────────────────────────────────────
  private buildFormations() {
    const n = this.count;
    const e = new THREE.Euler();
    const q = new THREE.Quaternion();
    const make = (): Formation => ({ pos: new Float32Array(n * 3), quat: new Float32Array(n * 4) });
    const setQ = (f: Formation, i: number, quat: THREE.Quaternion) => {
      f.quat[i * 4] = quat.x;
      f.quat[i * 4 + 1] = quat.y;
      f.quat[i * 4 + 2] = quat.z;
      f.quat[i * 4 + 3] = quat.w;
    };

    // 0 — Chaos: a loose shell around the ribbon
    const chaos = make();
    for (let i = 0; i < n; i++) {
      // Shell biased behind the focal plane so coins frame, not cover, the copy
      const r = 3.4 + Math.random() * 3.4;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const z = r * Math.sin(ph) * Math.sin(th);
      chaos.pos.set(
        [r * Math.sin(ph) * Math.cos(th) * 1.3 + 1.2, r * Math.cos(ph) * 0.85, z > 0 ? z * 0.25 - 0.5 : z * 0.9 - 0.5],
        i * 3
      );
      setQ(chaos, i, q.setFromEuler(e.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28)));
    }

    // 1 — Ledger: twelve stacked columns proportional to a spend profile
    const ledger = make();
    const total = SPEND_PROFILE.reduce((a, b) => a + b, 0);
    const cols = SPEND_PROFILE.length;
    const heights = SPEND_PROFILE.map((v) => Math.floor((v / total) * n));
    let rem = n - heights.reduce((a, b) => a + b, 0);
    for (let k = cols - 1; rem > 0; k = (k - 1 + cols) % cols, rem--) heights[k] = (heights[k] ?? 0) + 1;
    const flat = new THREE.Quaternion().setFromEuler(e.set(0.18, 0, 0));
    let idx = 0;
    for (let col = 0; col < cols; col++) {
      const x = (col - (cols - 1) / 2) * 0.62;
      for (let h = 0; h < (heights[col] ?? 0); h++) {
        ledger.pos.set([x, -2.1 + h * 0.072, 0], idx * 3);
        setQ(ledger, idx, flat);
        idx++;
      }
    }

    // 2 — Budget: segmented ring, coins standing tangent to the circle
    const ring = make();
    const layers = 3;
    const perLayer = Math.ceil(n / layers);
    const gapRad = 0.07;
    const usable = Math.PI * 2 - RING_SEGMENTS.length * gapRad;
    for (let i = 0; i < n; i++) {
      const layer = i % layers;
      const t = Math.floor(i / layers) / perLayer;
      let seg = 0;
      let acc = RING_SEGMENTS[0]!;
      while (t > acc && seg < RING_SEGMENTS.length - 1) acc += RING_SEGMENTS[++seg]!;
      const a = t * usable + seg * gapRad - Math.PI / 2;
      const r = 1.75 + layer * 0.32;
      ring.pos.set([Math.cos(a) * r, Math.sin(a) * r, (layer - 1) * 0.12], i * 3);
      // Faces the camera (cylinder axis → +Z) so the ring reads as a donut chart
      setQ(ring, i, q.setFromEuler(e.set(Math.PI / 2 + (layer - 1) * 0.15, (layer - 1) * 0.1, 0)));
      const segColor = new THREE.Color(SEGMENT_COLORS[seg]!);
      this.ringColors.set([segColor.r, segColor.g, segColor.b], i * 3);
    }

    // 3 — Vault: a Fibonacci sphere with coins facing outward
    const vault = make();
    const golden = Math.PI * (3 - Math.sqrt(5));
    const dir = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const rr = Math.sqrt(1 - y * y);
      const th = golden * i;
      dir.set(Math.cos(th) * rr, y, Math.sin(th) * rr);
      vault.pos.set([dir.x * 1.9, dir.y * 1.9, dir.z * 1.9], i * 3);
      setQ(vault, i, q.setFromUnitVectors(Y_AXIS, dir));
    }

    this.formations = [chaos, ledger, ring, vault];
  }

  // ── Public API ────────────────────────────────────────────────────────
  setProgress(p: number) {
    this.progress = clamp01(p);
  }

  setPointer(nx: number, ny: number) {
    this.pointerTarget.set(nx, ny);
    this.pointerActive = true;
  }

  clearPointer() {
    this.pointerActive = false;
    this.pointerTarget.set(0, 0);
  }

  burst(strength = 1) {
    for (let i = 0; i < this.count; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      const s = (0.08 + Math.random() * 0.22) * strength;
      const v = this.velocity;
      v[i * 3] = v[i * 3]! + Math.sin(b) * Math.cos(a) * s;
      v[i * 3 + 1] = v[i * 3 + 1]! + Math.cos(b) * s;
      v[i * 3 + 2] = v[i * 3 + 2]! + Math.sin(b) * Math.sin(a) * s;
    }
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.clock.getDelta();
    const loop = () => {
      if (!this.running) return;
      this.tick();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Render a single settled frame (reduced-motion / static path). */
  renderOnce() {
    this.tick(true);
  }

  dispose() {
    this.stop();
    this.disposed = true;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.scene.environment?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }

  private onPointerDown = () => this.burst(1);

  // ── Frame ─────────────────────────────────────────────────────────────
  private tick(staticFrame = false) {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    const time = this.clock.elapsedTime;
    const target = this.fixedProgress ?? this.progress;
    this.smoothProgress = staticFrame
      ? target
      : this.smoothProgress + (target - this.smoothProgress) * Math.min(1, dt * 4.5);
    const P = this.smoothProgress;

    // Pointer smoothing + world projection for the repel field
    this.pointer.lerp(this.pointerTarget, Math.min(1, dt * 5));
    if (this.pointerActive) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      if (!this.raycaster.ray.intersectPlane(this.plane, this.pointerWorld)) this.pointerWorld.set(999, 999, 0);
    } else {
      this.pointerWorld.set(999, 999, 0);
    }

    // Stage interpolation with hold plateaus
    const stage = Math.min(2.9999, stageFromProgress(P));
    const from = Math.floor(stage);
    const local = stage - from;
    const A = this.formations[from]!;
    const B = this.formations[from + 1]!;
    const ease = smooth(local);
    const lerpK = (arr: number[]) => arr[from]! + (arr[from + 1]! - arr[from]!) * ease;

    // Camera choreography with aspect-aware dolly so the chart fits on phones
    const aspect = this.camera.aspect;
    const fit = Math.max(1, 1.25 / aspect);
    const y = lerpK([0, 0.2, 0, 0]);
    const k = staticFrame ? 1 : Math.min(1, dt * 3);
    this.camera.position.x += (this.pointer.x * 0.9 - this.camera.position.x) * k;
    this.camera.position.y += (y + this.pointer.y * 0.6 - this.camera.position.y) * k;
    this.camera.position.z = lerpK([11, 11.5, 11, 11.5]) * fit;
    // Fog tracks the dolly so portrait screens (camera pulled far back) stay lit
    const fog = this.scene.fog as THREE.Fog;
    fog.near = this.camera.position.z - 1;
    fog.far = this.camera.position.z + 13;
    this.camera.lookAt(0, y * 0.5, 0);

    // Composition offsets keep each formation clear of its caption
    const wide = aspect > 1;
    const shiftX = wide ? lerpK([0, 0.9, -2.4, 0]) : 0;
    const shiftY = wide ? lerpK([0, 0, 0, 0.45]) : lerpK([0, 0.4, 1.1, 1.0]);

    // Ribbon choreography
    const s = lerpK([1.05, 0.55, 0.42, 0.62]) * (1 + Math.sin(time * 1.4) * 0.015);
    this.ribbon.scale.setScalar(s);
    const rx = lerpK([1.6, 3.6, 0, 0]);
    const ry = lerpK([0, 2.4, 0, 0]) * (wide ? 1 : 0.15);
    this.ribbon.position.set((aspect < 0.9 ? rx * 0.3 : rx) + shiftX, ry + shiftY, -0.6);
    this.thread.position.set(shiftX, shiftY, 0);
    this.ribbon.rotation.set(time * 0.12 + P * 2.2, time * 0.18 + P * 3.1, P * 1.4);

    this.thread.rotation.z = time * 0.25;
    this.thread.rotation.x = Math.PI * 0.42 + P * 1.1;
    this.thread.scale.setScalar(1.15 + (0.78 - 1.15) * P);

    // Coins (typed-array reads are bounds-safe by construction: n*3 / n*4)
    const repelR = 1.6;
    const Ap = A.pos as unknown as number[];
    const Bp = B.pos as unknown as number[];
    const Aq = A.quat as unknown as number[];
    const Bq = B.quat as unknown as number[];
    const off = this.offsets as unknown as number[];
    const vel = this.velocity as unknown as number[];
    const delays = this.delays as unknown as number[];
    const spin = this.spin as unknown as number[];
    const bc = this.baseColors as unknown as number[];
    const rc = this.ringColors as unknown as number[];
    const inRingZone = from === 1 || from === 2;
    // Repaint once more after leaving the ring zone so colours fully reset
    const colorDirty = inRingZone || this.colorsTinted;
    this.colorsTinted = inRingZone;
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      const i4 = i * 4;
      const delay = delays[i]!;
      // Staggered wave so the morph ripples rather than snapping
      const t = smooth(clamp01(local * 1.45 - delay * 0.45));

      let px = Ap[i3]! + (Bp[i3]! - Ap[i3]!) * t;
      let py = Ap[i3 + 1]! + (Bp[i3 + 1]! - Ap[i3 + 1]!) * t;
      let pz = Ap[i3 + 2]! + (Bp[i3 + 2]! - Ap[i3 + 2]!) * t;

      // Idle life: chaos drifts and bobs, formations breathe
      const chaosWeight = from === 0 ? 1 - t : 0;
      const bob = Math.sin(time * 0.9 + delay * 12);
      px += Math.cos(time * 0.3 + i) * 0.25 * chaosWeight;
      py += bob * (0.22 * chaosWeight + 0.02);

      if (from === 2) {
        // Spin the vault orb as it seals
        const ang = time * 0.25 * t;
        const cx = Math.cos(ang);
        const sx = Math.sin(ang);
        const nx = px * cx - pz * sx;
        pz = px * sx + pz * cx;
        px = nx;
      }

      // Pointer repel + burst spring
      const ox = off[i3]!;
      const oy = off[i3 + 1]!;
      const oz = off[i3 + 2]!;
      let vx = vel[i3]!;
      let vy = vel[i3 + 1]!;
      let vz = vel[i3 + 2]!;
      const dx = px + ox - this.pointerWorld.x;
      const dy = py + oy - this.pointerWorld.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < repelR * repelR) {
        const d = Math.sqrt(d2) || 0.001;
        const f = (1 - d / repelR) * 0.06;
        vx += (dx / d) * f;
        vy += (dy / d) * f;
        vz += f * 0.6;
      }
      // Spring back to formation with damping
      vx = (vx - ox * 0.06) * 0.86;
      vy = (vy - oy * 0.06) * 0.86;
      vz = (vz - oz * 0.06) * 0.86;
      vel[i3] = vx;
      vel[i3 + 1] = vy;
      vel[i3 + 2] = vz;
      off[i3] = ox + vx;
      off[i3 + 1] = oy + vy;
      off[i3 + 2] = oz + vz;

      this.tmpV.set(px + ox + vx + shiftX, py + oy + vy + shiftY, pz + oz + vz);

      // Colour: palette everywhere except the budget ring, which colours by category
      const ringW = from === 1 ? t : from === 2 ? 1 - t : 0;
      if (ringW > 0 || colorDirty) {
        this.tmpC.setRGB(
          bc[i3]! + (rc[i3]! - bc[i3]!) * ringW,
          bc[i3 + 1]! + (rc[i3 + 1]! - bc[i3 + 1]!) * ringW,
          bc[i3 + 2]! + (rc[i3 + 2]! - bc[i3 + 2]!) * ringW
        );
        this.coins.setColorAt(i, this.tmpC);
      }

      this.tmpQa.set(Aq[i4]!, Aq[i4 + 1]!, Aq[i4 + 2]!, Aq[i4 + 3]!);
      this.tmpQb.set(Bq[i4]!, Bq[i4 + 1]!, Bq[i4 + 2]!, Bq[i4 + 3]!);
      this.tmpQ.slerpQuaternions(this.tmpQa, this.tmpQb, t);
      // Personal spin about the coin's own axis, strongest in chaos
      this.tmpQa.setFromAxisAngle(Y_AXIS, spin[i]! * time * (0.15 + chaosWeight * 0.85));
      this.tmpQ.multiply(this.tmpQa);

      this.tmpM.compose(this.tmpV, this.tmpQ, this.tmpS);
      this.coins.setMatrixAt(i, this.tmpM);
    }
    this.coins.instanceMatrix.needsUpdate = true;
    if (colorDirty && this.coins.instanceColor) this.coins.instanceColor.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);
  }
}

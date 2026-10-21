"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useMemo,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  BalloonSize,
  BalloonSpec,
  BubbleSpec,
  StabilityAutoFix,
  StepSpec,
  TwistType,
} from "@/types/balloon";
import { TWISTER_COLORS, TWIST_ENCYCLOPEDIA, inchesToFingers } from "@/lib/balloonConstants";
import {
  BubbleLayout,
  UNIT,
  Vec3,
  computeBalloonLayout,
  getStepVisibility,
  roundQuarter,
} from "@/lib/balloonLayout";

export type BuildViewMode = "step" | "final";

export type AddTwistPresetKind =
  | "basic"
  | "lock_pair"
  | "pinch"
  | "loop"
  | "toe"
  | "tulip"
  | "bird_body"
  | "spiral"
  | "s_hook"
  | "z_bend"
  | "side_bubble"
  | "cut_tail_bubbles";

export interface ThreeBalloonViewerRef {
  exportPng: (options?: { title?: string; download?: boolean }) => string | null;
  resetCamera: () => void;
  fitCamera: () => void;
  toggleAutoRotate: () => boolean;
}

interface ThreeBalloonViewerProps {
  balloons: BalloonSpec[];
  bubbles: BubbleSpec[];
  steps: StepSpec[];
  currentStepIndex: number;
  buildMode: BuildViewMode;
  onBuildModeChange?: (mode: BuildViewMode) => void;
  onSelectStep?: (stepIdx: number) => void;
  selectedBubbleIndex?: number | null;
  onSelectBubble?: (index: number) => void;
  onUpdateBubble?: (index: number, updated: Partial<BubbleSpec>, syncPartner?: boolean) => void;
  onAddTwistPreset?: (preset: AddTwistPresetKind, afterBubbleIndex?: number) => void;
  onDeleteBubble?: (index: number) => void;
  onDuplicateBubble?: (index: number) => void;
  onAddBalloon?: (size: BalloonSize, colorHex: string, colorName: string) => void;
  onUpdateBalloon?: (balloonId: string, updated: Partial<BalloonSpec>) => void;
  onApplyAutoFix?: (fix: StabilityAutoFix) => void;
  onAutoStabilizeAll?: () => void;
  showLabels?: boolean;
  onToggleLabels?: () => void;
  showGhost?: boolean;
  onToggleGhost?: () => void;
  autoRotateDefault?: boolean;
  className?: string;
}

const tv = (v: Vec3) => new THREE.Vector3(v[0], v[1], v[2]);
const HIGHLIGHT = "#FACC15";
const SELECT_COLOR = "#22D3EE";
const DANGER_COLOR = "#F43F5E";

const ADD_TWIST_PALETTE: Array<{
  kind: AddTwistPresetKind;
  label: string;
  icon: string;
  convertTwist: TwistType;
  hint: string;
}> = [
  { kind: "basic", label: "Basic", icon: "🫧", convertTwist: "basic", hint: "Single bubble twist (hold until locked)" },
  { kind: "lock_pair", label: "Lock Pair", icon: "🔒", convertTwist: "lock", hint: "2 folded bubbles locked together (ears / legs)" },
  { kind: "pinch", label: "Pinch / Ear", icon: "🤏", convertTwist: "pinch", hint: "Self-locking 90° friction pinch joint" },
  { kind: "loop", label: "Loop", icon: "➰", convertTwist: "loop", hint: "Self-locking teardrop petal / guard loop" },
  { kind: "toe", label: "Toe Paw", icon: "🐾", convertTwist: "toe", hint: "Mini paw pinch twist" },
  { kind: "tulip", label: "Tulip / Apple", icon: "🌷", convertTwist: "tulip", hint: "Inverted nozzle dimple twist (+ lock pinch)" },
  { kind: "bird_body", label: "3-Roll Body", icon: "🐦", convertTwist: "bird_body", hint: "3-bubble Bird Body roll-through prism" },
  { kind: "spiral", label: "Spiral", icon: "🌀", convertTwist: "spiral", hint: "Coiled corkscrew spiral segment" },
  { kind: "s_hook", label: "S-Hook", icon: "〰️", convertTwist: "s_hook", hint: "Warm hand-curved S-contour" },
  { kind: "z_bend", label: "Z-Bend", icon: "⚡", convertTwist: "z_bend", hint: "Sharp accordion Z-fold" },
  { kind: "side_bubble", label: "Side Rail", icon: "🛡️", convertTwist: "side_bubble", hint: "Flank side bubble" },
  { kind: "cut_tail_bubbles", label: "Pom-Pom Tip", icon: "✂️", convertTwist: "cut_tail_bubbles", hint: "Tied cut-tail with tiny bead pom-pom" },
];

/**
 * Custom smooth latex sausage profile from y = 0 (pinched twist seam) to y = lengthUnits (pinched twist seam).
 * Every bubble starts & ends cleanly right at its exact 3D joints!
 */
function createSmoothLatexSausageGeometry(radius: number, lengthUnits: number): THREE.LatheGeometry {
  const N = 26;
  const pts: THREE.Vector2[] = [];
  const capFrac = Math.min(0.42, (radius * 0.95) / Math.max(0.28, lengthUnits));
  for (let i = 0; i <= N; i++) {
    const t = i / N; // 0 .. 1 along bubble axis
    let profile: number;
    if (t < capFrac) {
      const u = t / capFrac;
      profile = 0.13 + 0.87 * Math.sin(u * (Math.PI / 2));
    } else if (t > 1 - capFrac) {
      const u = (1 - t) / capFrac;
      profile = 0.13 + 0.87 * Math.sin(u * (Math.PI / 2));
    } else {
      const midT = (t - 0.5) * 2;
      profile = 1.0 + 0.055 * (1 - midT * midT);
    }
    pts.push(new THREE.Vector2(Math.max(0.02, radius * profile), t * lengthUnits));
  }
  return new THREE.LatheGeometry(pts, 28);
}

/** Smooth invaginated Apple / Tulip Twist LatheGeometry with genuine recessed knot tunnel! */
function createTulipLatexGeometry(radius: number, lengthUnits: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const H = lengthUnits;
  // Base pinched neck -> plump outer wall -> rounded front lip -> deep inverted inner dimple!
  const steps = 22;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = radius * (0.15 + 1.02 * Math.sin(Math.min(1, t * 1.12) * Math.PI * 0.86));
    pts.push(new THREE.Vector2(Math.max(0.03, r), t * H));
  }
  // Curve lip inward into recessed apple core dimple
  pts.push(new THREE.Vector2(radius * 0.42, H * 0.98));
  pts.push(new THREE.Vector2(radius * 0.22, H * 0.72));
  pts.push(new THREE.Vector2(0.01, H * 0.58));
  return new THREE.LatheGeometry(pts, 28);
}

export const ThreeBalloonViewer = forwardRef<
  ThreeBalloonViewerRef,
  ThreeBalloonViewerProps
>(
  (
    {
      balloons,
      bubbles,
      steps,
      currentStepIndex,
      buildMode,
      onBuildModeChange,
      onSelectStep,
      selectedBubbleIndex = 0,
      onSelectBubble,
      onUpdateBubble,
      onAddTwistPreset,
      onDeleteBubble,
      onDuplicateBubble,
      onAddBalloon,
      onUpdateBalloon,
      onApplyAutoFix,
      onAutoStabilizeAll,
      showLabels = true,
      onToggleLabels,
      showGhost = false,
      onToggleGhost,
      autoRotateDefault = false,
      className = "w-full h-full min-h-[520px]",
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const pivotRef = useRef<THREE.Group | null>(null);
    const modelGroupRef = useRef<THREE.Group | null>(null);
    const ghostGroupRef = useRef<THREE.Group | null>(null);
    const gizmoGroupRef = useRef<THREE.Group | null>(null);
    const labelGroupRef = useRef<THREE.Group | null>(null);
    const gridRef = useRef<THREE.GridHelper | null>(null);

    const pickMeshesRef = useRef<THREE.Object3D[]>([]);
    const gizmoMeshesRef = useRef<THREE.Object3D[]>([]);
    const activeMatsRef = useRef<THREE.MeshPhysicalMaterial[]>([]);
    const dangerRingsRef = useRef<THREE.Mesh[]>([]);
    const finalSphereRef = useRef<THREE.Sphere | null>(null);
    const lastFitKeyRef = useRef<string>("");

    const [isAutoRotating, setIsAutoRotating] = useState(autoRotateDefault);
    const [wireframe, setWireframe] = useState(false);
    const [releasedHands, setReleasedHands] = useState(false);
    const [pairSync, setPairSync] = useState(true);
    const [hudOpen, setHudOpen] = useState(true);
    const [paletteOpen, setPaletteOpen] = useState(true);
    const [dragReadout, setDragReadout] = useState<string | null>(null);
    const [cursorStyle, setCursorStyle] = useState<string>("grab");
    const [dropPreview, setDropPreview] = useState<{
      preset: AddTwistPresetKind;
      bubbleIndex: number | null;
      convertMode: boolean;
    } | null>(null);

    // Latest callbacks/data in refs so WebGL pointer listeners always have fresh state with zero re-mount
    const latestRef = useRef({
      balloons,
      bubbles,
      selectedBubbleIndex,
      pairSync,
      onSelectBubble,
      onUpdateBubble,
      onAddTwistPreset,
    });
    latestRef.current = {
      balloons,
      bubbles,
      selectedBubbleIndex,
      pairSync,
      onSelectBubble,
      onUpdateBubble,
      onAddTwistPreset,
    };

    const layoutSnapshot = useMemo(
      () => computeBalloonLayout(balloons, bubbles, { releasedHands }),
      [balloons, bubbles, releasedHands]
    );
    const layoutSnapshotRef = useRef(layoutSnapshot);
    layoutSnapshotRef.current = layoutSnapshot;

    const fitCameraTo = (sphere: THREE.Sphere | null, keepDirection = true) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls || !sphere) return;
      const fovRad = (camera.fov * Math.PI) / 180;
      const dist = THREE.MathUtils.clamp(
        (sphere.radius / Math.sin(fovRad / 2)) * 1.05,
        7.5,
        75
      );
      let dir = new THREE.Vector3(0.45, 0.34, 1).normalize();
      if (keepDirection && camera.position.length() > 0.01) {
        dir = camera.position.clone().sub(controls.target).normalize();
        if (dir.length() < 0.01) dir = new THREE.Vector3(0.45, 0.34, 1).normalize();
      }
      camera.position.copy(dir.multiplyScalar(dist));
      controls.target.set(0, 0, 0);
      controls.update();
    };

    useImperativeHandle(ref, () => ({
      exportPng: (options = {}) => {
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        if (!renderer || !scene || !camera) return null;
        const labels = labelGroupRef.current;
        const ghosts = ghostGroupRef.current;
        const gizmos = gizmoGroupRef.current;
        const grid = gridRef.current;
        const previousSize = renderer.getSize(new THREE.Vector2());
        const previousPixelRatio = renderer.getPixelRatio();
        const previousAspect = camera.aspect;
        const previousVisibility = {
          labels: labels?.visible ?? true,
          ghosts: ghosts?.visible ?? true,
          gizmos: gizmos?.visible ?? true,
          grid: grid?.visible ?? true,
        };

        if (labels) labels.visible = false;
        if (ghosts) ghosts.visible = false;
        if (gizmos) gizmos.visible = false;
        if (grid) grid.visible = false;
        renderer.setPixelRatio(1);
        renderer.setSize(1800, 1400, false);
        camera.aspect = 1800 / 1400;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        const dataUrl = renderer.domElement.toDataURL("image/png");

        renderer.setPixelRatio(previousPixelRatio);
        renderer.setSize(previousSize.x, previousSize.y, false);
        camera.aspect = previousAspect;
        camera.updateProjectionMatrix();
        if (labels) labels.visible = previousVisibility.labels;
        if (ghosts) ghosts.visible = previousVisibility.ghosts;
        if (gizmos) gizmos.visible = previousVisibility.gizmos;
        if (grid) grid.visible = previousVisibility.grid;
        renderer.render(scene, camera);

        if (options.download) {
          const link = document.createElement("a");
          link.download = `${options.title || "balloon-sculpture"}.png`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
        return dataUrl;
      },
      resetCamera: () => fitCameraTo(finalSphereRef.current, false),
      fitCamera: () => fitCameraTo(finalSphereRef.current, true),
      toggleAutoRotate: () => {
        const next = !isAutoRotating;
        setIsAutoRotating(next);
        if (controlsRef.current) controlsRef.current.autoRotate = next;
        return next;
      },
    }));

    /* ---------------- scene setup + 3D handle drag engine ---------------- */
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const width = container.clientWidth || 640;
      const height = container.clientHeight || 520;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b1220);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 220);
      camera.position.set(6, 4.5, 14);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Studio PBR Environment for authentic shiny smooth latex reflections!
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = envRT.texture;
      scene.environmentIntensity = 0.72;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.autoRotate = autoRotateDefault;
      controls.autoRotateSpeed = 1.6;
      controls.maxDistance = 85;
      controls.minDistance = 2.5;
      controlsRef.current = controls;

      scene.add(new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 1.5);
      key.position.set(12, 18, 15);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x93c5fd, 0.95);
      rim.position.set(-14, 10, -12);
      scene.add(rim);
      const fill = new THREE.DirectionalLight(0xfde68a, 0.45);
      fill.position.set(0, -10, 8);
      scene.add(fill);

      const grid = new THREE.GridHelper(32, 32, 0x334155, 0x1e293b);
      grid.position.y = -5;
      scene.add(grid);
      gridRef.current = grid;

      const pivot = new THREE.Group();
      scene.add(pivot);
      pivotRef.current = pivot;

      const modelGroup = new THREE.Group();
      const ghostGroup = new THREE.Group();
      const gizmoGroup = new THREE.Group();
      const labelGroup = new THREE.Group();
      pivot.add(modelGroup, ghostGroup, gizmoGroup, labelGroup);
      modelGroupRef.current = modelGroup;
      ghostGroupRef.current = ghostGroup;
      gizmoGroupRef.current = gizmoGroup;
      labelGroupRef.current = labelGroup;

      /* ----- Interactive 3D Handle Dragging + Bubble Picking ----- */
      const raycaster = new THREE.Raycaster();
      const dragPlane = new THREE.Plane();
      const hitPoint = new THREE.Vector3();

      type DragSession =
        | null
        | {
            mode: "length" | "diameter" | "bend";
            bubbleIndex: number;
            startClientX: number;
            startClientY: number;
            startWorld: THREE.Vector3;
            axisWorld: THREE.Vector3;
            perpWorld: THREE.Vector3;
            initialLength: number;
            initialDiameter: number;
            initialBend: number;
            initialTurn: number;
          };

      let dragSession: DragSession = null;
      let downX = 0;
      let downY = 0;

      const setNdc = (clientX: number, clientY: number) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          -((clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(ndc, camera);
      };

      const onPointerDown = (e: PointerEvent) => {
        downX = e.clientX;
        downY = e.clientY;
        setNdc(e.clientX, e.clientY);

        // 1. Check 3D Gizmo Handles FIRST!
        const gizmoHits = raycaster.intersectObjects(gizmoMeshesRef.current, true);
        if (gizmoHits.length > 0) {
          const obj = gizmoHits[0].object;
          const gKind = obj.userData.gizmoKind as
            | "length"
            | "diameter"
            | "bend"
            | "add_after"
            | undefined;
          const bIdx = obj.userData.bubbleIndex as number;
          if (gKind === "add_after") {
            e.stopPropagation();
            latestRef.current.onAddTwistPreset?.("basic", bIdx);
            return;
          }
          if (gKind && latestRef.current.bubbles[bIdx]) {
            e.stopPropagation();
            const b = latestRef.current.bubbles[bIdx];
            const lay = layoutSnapshotRef.current.layouts[bIdx];
            if (!lay) return;
            const pivotOffset = pivot.position.clone();
            const worldDir = tv(lay.dir).normalize();
            const worldPerp = tv(lay.side).normalize();
            const camDir = new THREE.Vector3();
            camera.getWorldDirection(camDir);
            dragPlane.setFromNormalAndCoplanarPoint(camDir.clone().negate(), gizmoHits[0].point);
            raycaster.ray.intersectPlane(dragPlane, hitPoint);

            controls.enabled = false;
            renderer.domElement.setPointerCapture(e.pointerId);
            dragSession = {
              mode: gKind,
              bubbleIndex: bIdx,
              startClientX: e.clientX,
              startClientY: e.clientY,
              startWorld: hitPoint.clone(),
              axisWorld: worldDir,
              perpWorld: worldPerp.lengthSq() > 0.01 ? worldPerp : new THREE.Vector3(0, 0, 1),
              initialLength: b.lengthInches,
              initialDiameter: b.diameterInches || 2.0,
              initialBend: b.bend ?? 0,
              initialTurn: b.turn ?? 0,
            };
            void pivotOffset;
            setCursorStyle("grabbing");
          }
        }
      };

      const onPointerMove = (e: PointerEvent) => {
        if (dragSession) {
          setNdc(e.clientX, e.clientY);
          const curBubbles = latestRef.current.bubbles;
          const b = curBubbles[dragSession.bubbleIndex];
          if (!b) return;

          if (dragSession.mode === "length") {
            if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
              const delta = hitPoint.clone().sub(dragSession.startWorld);
              const alongUnits = delta.dot(dragSession.axisWorld);
              // Loop reach is ~0.44 * length, so scale sensitivity accordingly
              const factor = b.twistType === "loop" || b.isLoop ? 1 / (UNIT * 0.44) : 1 / UNIT;
              const rawInches = dragSession.initialLength + alongUnits * factor;
              const snapped = Math.max(0.5, Math.min(26, Math.round(rawInches * 4) / 4));
              latestRef.current.onUpdateBubble?.(
                dragSession.bubbleIndex,
                { lengthInches: snapped },
                latestRef.current.pairSync
              );
              setDragReadout(
                `📏 ${b.label}: ${snapped.toFixed(2).replace(/\.00$/, "")}″ (${inchesToFingers(
                  snapped
                )} fingers)`
              );
            }
          } else if (dragSession.mode === "diameter") {
            if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
              const delta = hitPoint.clone().sub(dragSession.startWorld);
              const radialUnits = delta.dot(dragSession.perpWorld);
              const rawDiam = dragSession.initialDiameter + radialUnits / 0.28;
              const snapped = Math.max(0.75, Math.min(3.5, Math.round(rawDiam * 20) / 20));
              latestRef.current.onUpdateBubble?.(
                dragSession.bubbleIndex,
                { diameterInches: Math.round(snapped * 4) / 4 },
                latestRef.current.pairSync
              );
              setDragReadout(`↔️ ${b.label} Diameter: ${(Math.round(snapped * 4) / 4).toFixed(2)}″`);
            }
          } else if (dragSession.mode === "bend") {
            const dx = e.clientX - dragSession.startClientX;
            const dy = e.clientY - dragSession.startClientY;
            const newBend = Math.max(
              -165,
              Math.min(165, Math.round((dragSession.initialBend - dy * 0.65) / 5) * 5)
            );
            const newTurn = Math.max(
              -165,
              Math.min(165, Math.round((dragSession.initialTurn + dx * 0.65) / 5) * 5)
            );
            latestRef.current.onUpdateBubble?.(dragSession.bubbleIndex, {
              bend: newBend,
              turn: newTurn,
            });
            setDragReadout(`🧭 ${b.label}: Bend ${newBend}° · Turn ${newTurn}°`);
          }
          return;
        }

        // Hover cursor feedback over 3D handles & bubbles
        setNdc(e.clientX, e.clientY);
        const gHit = raycaster.intersectObjects(gizmoMeshesRef.current, true)[0];
        if (gHit) {
          const k = gHit.object.userData.gizmoKind;
          setCursorStyle(k === "add_after" ? "copy" : "ew-resize");
          return;
        }
        const bHit = raycaster.intersectObjects(pickMeshesRef.current, false)[0];
        setCursorStyle(bHit ? "pointer" : "grab");
      };

      const onPointerUp = (e: PointerEvent) => {
        if (dragSession) {
          dragSession = null;
          controls.enabled = true;
          try {
            renderer.domElement.releasePointerCapture(e.pointerId);
          } catch {
            // ignore if already released
          }
          setDragReadout(null);
          setCursorStyle("grab");
          return;
        }

        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
        setNdc(e.clientX, e.clientY);
        const hits = raycaster.intersectObjects(pickMeshesRef.current, false);
        const hit = hits.find((h) => h.object.userData.bubbleIndex !== undefined);
        if (hit) {
          latestRef.current.onSelectBubble?.(hit.object.userData.bubbleIndex as number);
        }
      };

      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerup", onPointerUp);

      const clock = new THREE.Clock();
      let running = true;
      let raf = 0;
      const animate = () => {
        if (!running) return;
        const t = clock.getElapsedTime();
        activeMatsRef.current.forEach((m) => {
          m.emissiveIntensity = 0.42 + 0.26 * Math.sin(t * 4.2);
        });
        dangerRingsRef.current.forEach((ring) => {
          const s = 1 + 0.14 * Math.sin(t * 6.5);
          ring.scale.set(s, s, s);
        });
        controls.update();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      animate();

      const doResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      const ro = new ResizeObserver(doResize);
      ro.observe(container);
      window.addEventListener("resize", doResize);

      return () => {
        running = false;
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener("resize", doResize);
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
        controls.dispose();
        envRT.dispose();
        pmrem.dispose();
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ---------------- rebuild 3D smooth latex scene + handles ---------------- */
    useEffect(() => {
      const pivot = pivotRef.current;
      const modelGroup = modelGroupRef.current;
      const ghostGroup = ghostGroupRef.current;
      const gizmoGroup = gizmoGroupRef.current;
      const labelGroup = labelGroupRef.current;
      if (!pivot || !modelGroup || !ghostGroup || !gizmoGroup || !labelGroup) return;

      const disposeGroup = (g: THREE.Group) => {
        while (g.children.length > 0) {
          const child = g.children[0];
          g.remove(child);
          child.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
            const disposeMat = (m: THREE.Material) => {
              const withMap = m as THREE.MeshBasicMaterial;
              if (withMap.map) withMap.map.dispose();
              m.dispose();
            };
            if (Array.isArray(mat)) mat.forEach(disposeMat);
            else if (mat) disposeMat(mat);
          });
        }
      };

      disposeGroup(modelGroup);
      disposeGroup(ghostGroup);
      disposeGroup(gizmoGroup);
      disposeGroup(labelGroup);
      pickMeshesRef.current = [];
      gizmoMeshesRef.current = [];
      activeMatsRef.current = [];
      dangerRingsRef.current = [];

      if (!bubbles || bubbles.length === 0) return;

      const { layouts, chains, stability } = layoutSnapshot;
      const layoutByIndex = new Map(layouts.map((l) => [l.index, l]));

      const vis =
        buildMode === "final" || releasedHands
          ? {
              formed: new Set(bubbles.map((_, i) => i)),
              active: new Set<number>(),
              introducedBalloons: new Set(balloons.map((b) => b.id)),
            }
          : getStepVisibility(steps, bubbles, balloons, currentStepIndex);

      const latexMat = (
        hex: string,
        opts: {
          active?: boolean;
          ghost?: boolean;
          ghostOpacity?: number;
          dropTarget?: boolean;
          unraveled?: boolean;
        } = {}
      ) => {
        if (opts.ghost) {
          return new THREE.MeshBasicMaterial({
            color: new THREE.Color(hex),
            transparent: true,
            opacity: opts.ghostOpacity ?? 0.12,
            depthWrite: false,
          });
        }
        if (opts.dropTarget) {
          return new THREE.MeshPhysicalMaterial({
            color: new THREE.Color("#10B981"),
            emissive: new THREE.Color("#10B981"),
            emissiveIntensity: 0.55,
            roughness: 0.16,
            clearcoat: 1.0,
          });
        }
        if (opts.unraveled) {
          return new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(hex).lerp(new THREE.Color(DANGER_COLOR), 0.35),
            emissive: new THREE.Color(DANGER_COLOR),
            emissiveIntensity: 0.25,
            roughness: 0.22,
            clearcoat: 0.95,
            clearcoatRoughness: 0.1,
            wireframe,
          });
        }
        if (opts.active) {
          const m = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(hex).lerp(new THREE.Color(HIGHLIGHT), 0.35),
            emissive: new THREE.Color(HIGHLIGHT),
            emissiveIntensity: 0.42,
            roughness: 0.16,
            metalness: 0.02,
            clearcoat: 1.0,
            clearcoatRoughness: 0.07,
            sheen: 0.35,
            wireframe,
          });
          activeMatsRef.current.push(m);
          return m;
        }
        return new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(hex),
          roughness: 0.18,
          metalness: 0.01,
          clearcoat: 1.0,
          clearcoatRoughness: 0.09,
          sheen: 0.3,
          sheenRoughness: 0.35,
          ior: 1.48,
          wireframe,
        });
      };

      const Y = new THREE.Vector3(0, 1, 0);

      const buildMesh = (l: BubbleLayout, mat: THREE.Material): THREE.Mesh => {
        const r = l.radiusUnits;
        const len = l.lengthUnits;
        const startV = tv(l.start);
        const endV = tv(l.end);
        const dirV = tv(l.dir);
        let mesh: THREE.Mesh;

        switch (l.kind) {
          case "loop": {
            // Authentic 3D teardrop latex loop tapering right into `l.start`!
            const reachV = endV.clone().sub(startV);
            const reach = Math.max(r * 1.8, reachV.length());
            const dNorm = dirV.clone().normalize();
            const sideV = tv(l.side).normalize();
            const width = reach * 0.56;
            const curvePts: THREE.Vector3[] = [];
            const segs = 28;
            for (let i = 0; i <= segs; i++) {
              const t = i / segs;
              const theta = t * Math.PI;
              const along = Math.sin(theta) * reach;
              const across = Math.sin(theta * 2) * width * 0.5;
              curvePts.push(
                startV
                  .clone()
                  .addScaledVector(dNorm, along)
                  .addScaledVector(sideV, across)
              );
            }
            const geo = new THREE.TubeGeometry(
              new THREE.CatmullRomCurve3(curvePts),
              40,
              r * 0.8,
              16,
              false
            );
            mesh = new THREE.Mesh(geo, mat);
            break;
          }
          case "pinch": {
            // Plump self-locking pinch cushion nestled against the joint with crease groove
            const geo = new THREE.SphereGeometry(r * 1.02, 26, 20);
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
              const x = pos.getX(i);
              const y = pos.getY(i);
              const z = pos.getZ(i);
              // Subtle central pinch crease along X=0
              const pinchIndent = 1 - 0.18 * Math.exp(-(x * x) / (r * r * 0.12));
              pos.setXYZ(i, x * 1.28, y * 0.82 * pinchIndent, z * 1.05);
            }
            geo.computeVertexNormals();
            mesh = new THREE.Mesh(geo, mat);
            mesh.quaternion.setFromUnitVectors(Y, dirV);
            mesh.position.copy(tv(l.mid));
            break;
          }
          case "tulip": {
            const span = Math.max(r * 1.9, startV.distanceTo(endV));
            const geo = createTulipLatexGeometry(r * 1.16, span);
            mesh = new THREE.Mesh(geo, mat);
            mesh.quaternion.setFromUnitVectors(Y, dirV);
            mesh.position.copy(startV);
            break;
          }
          case "bird_rail": {
            const radialV = l.bowOut ? tv(l.bowOut) : tv(l.up).multiplyScalar(r);
            const q1 = startV.clone().lerp(endV, 0.25).addScaledVector(radialV, 0.85);
            const qMid = startV.clone().lerp(endV, 0.5).addScaledVector(radialV, 1.05);
            const q3 = startV.clone().lerp(endV, 0.75).addScaledVector(radialV, 0.85);
            const geo = new THREE.TubeGeometry(
              new THREE.CatmullRomCurve3([startV, q1, qMid, q3, endV]),
              32,
              r * 0.92,
              16,
              false
            );
            mesh = new THREE.Mesh(geo, mat);
            break;
          }
          case "spiral": {
            const pts: THREE.Vector3[] = [];
            const sideV = tv(l.side);
            const upV = tv(l.up);
            const spanVec = endV.clone().sub(startV);
            const spanLen = Math.max(len, spanVec.length());
            const axisNorm = spanVec.length() > 0.05 ? spanVec.clone().normalize() : dirV;
            const turns = Math.max(2.2, spanLen * 0.85);
            const coilR = r * 0.82;
            const N = 52;
            for (let i = 0; i <= N; i++) {
              const t = i / N;
              const env = Math.sin(Math.min(1, t * 5) * (Math.PI / 2)) * Math.sin(Math.min(1, (1 - t) * 5) * (Math.PI / 2));
              const a = t * turns * Math.PI * 2;
              const c = startV
                .clone()
                .addScaledVector(axisNorm, spanLen * t)
                .addScaledVector(sideV, Math.cos(a) * coilR * (0.25 + 0.75 * env))
                .addScaledVector(upV, Math.sin(a) * coilR * (0.25 + 0.75 * env));
              pts.push(c);
            }
            const geo = new THREE.TubeGeometry(
              new THREE.CatmullRomCurve3(pts),
              68,
              r * 0.64,
              14,
              false
            );
            mesh = new THREE.Mesh(geo, mat);
            break;
          }
          case "bent": {
            const upV = tv(l.up);
            const curve =
              l.bubble.twistType === "z_bend"
                ? new THREE.CubicBezierCurve3(
                    startV,
                    startV.clone().addScaledVector(dirV, len * 0.3).addScaledVector(upV, len * 0.26),
                    startV.clone().addScaledVector(dirV, len * 0.7).addScaledVector(upV, -len * 0.26),
                    endV
                  )
                : new THREE.QuadraticBezierCurve3(
                    startV,
                    tv(l.mid).addScaledVector(upV, len * 0.22),
                    endV
                  );
            const geo = new THREE.TubeGeometry(curve, 30, r * 0.92, 18, false);
            // Smooth end spheres so curved tube ends look rounded like real latex
            const tipCap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.92, 16, 12), mat);
            tipCap.position.copy(endV);
            modelGroup.add(tipCap);
            mesh = new THREE.Mesh(geo, mat);
            break;
          }
          case "bead": {
            const geo = new THREE.SphereGeometry(r * 1.12, 24, 18);
            mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(tv(l.mid));
            break;
          }
          default: {
            if (l.bowOut) {
              const flk = tv(l.bowOut);
              const qMid = startV.clone().lerp(endV, 0.5).add(flk);
              const geo = new THREE.TubeGeometry(
                new THREE.CatmullRomCurve3([startV, qMid, endV]),
                28,
                r * 0.9,
                16,
                false
              );
              mesh = new THREE.Mesh(geo, mat);
            } else {
              const segVec = endV.clone().sub(startV);
              const segLen = Math.max(0.22, segVec.length());
              const segDir = segVec.length() > 1e-4 ? segVec.normalize() : dirV;
              const geo = createSmoothLatexSausageGeometry(r, segLen);
              mesh = new THREE.Mesh(geo, mat);
              mesh.quaternion.setFromUnitVectors(Y, segDir);
              mesh.position.copy(startV);
            }
          }
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
      };

      /* ----- formed bubbles + smooth U-crease lock elbows ----- */
      layouts.forEach((l) => {
        if (!vis.formed.has(l.index)) return;
        const isActive = vis.active.has(l.index);
        const isDropHover = dropPreview?.bubbleIndex === l.index;
        const mat = latexMat(l.bubble.color, {
          active: isActive,
          dropTarget: isDropHover,
          unraveled: l.unraveledInRelease,
        });
        const mesh = buildMesh(l, mat);
        mesh.userData.bubbleIndex = l.index;
        modelGroup.add(mesh);
        pickMeshesRef.current.push(mesh);

        // If this bubble opens a 2-bubble Lock Pair and its partner is also formed,
        // connect the two parallel tubes smoothly across their 180° fold tip!
        if (
          l.foldBridgeTo &&
          l.partnerIndex !== undefined &&
          vis.formed.has(l.partnerIndex)
        ) {
          const pA = tv(l.end);
          const pB = tv(l.foldBridgeTo);
          const apex = pA
            .clone()
            .lerp(pB, 0.5)
            .addScaledVector(tv(l.dir), l.radiusUnits * 0.62);
          const bridgeGeo = new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3([pA, apex, pB]),
            16,
            l.radiusUnits * 0.82,
            14,
            false
          );
          const bridgeMesh = new THREE.Mesh(bridgeGeo, mat);
          bridgeMesh.userData.bubbleIndex = l.index;
          modelGroup.add(bridgeMesh);
          pickMeshesRef.current.push(bridgeMesh);
        }
      });

      /* ----- tiered next-step ghost forecast -----
         Only the next three construction steps are previewed. The immediate next
         step is strongest; farther steps fade rapidly instead of showing the whole
         finished sculpture at one uniform opacity. */
      if (buildMode === "step" && showGhost && !releasedHands) {
        const bubbleStep = new Map<number, number>();
        steps.forEach((step, stepIndex) => {
          step.bubbleIndices.forEach((bubbleIndex) => {
            if (!bubbleStep.has(bubbleIndex)) bubbleStep.set(bubbleIndex, stepIndex);
          });
        });
        const tierOpacity = [0, 0.3, 0.13, 0.055];
        layouts.forEach((layout) => {
          if (vis.formed.has(layout.index)) return;
          const futureStep = bubbleStep.get(layout.index);
          if (futureStep === undefined) return;
          const distance = futureStep - currentStepIndex;
          if (distance < 1 || distance > 3) return;
          ghostGroup.add(
            buildMesh(
              layout,
              latexMat(layout.bubble.color, {
                ghost: true,
                ghostOpacity: tierOpacity[distance],
              })
            )
          );
        });
      }

      /* ----- pulsing crimson rings on any unstable seams ----- */
      stability.issues.forEach((issue) => {
        if (issue.severity !== "will_untwist" || !issue.jointPosition) return;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.68, 0.065, 10, 32),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(DANGER_COLOR) })
        );
        ring.position.copy(tv(issue.jointPosition));
        modelGroup.add(ring);
        dangerRingsRef.current.push(ring);
      });

      /* ----- 3D interactive handles on selected bubble (always visible) ----- */
      if (
        selectedBubbleIndex !== null &&
        selectedBubbleIndex !== undefined &&
        !releasedHands
      ) {
        const l = layoutByIndex.get(selectedBubbleIndex);
        if (l) {
          // Cyan selection halo
          const halo = new THREE.Mesh(
            new THREE.TorusGeometry(l.radiusUnits * 1.38 + 0.1, 0.042, 10, 36),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(SELECT_COLOR) })
          );
          halo.position.copy(tv(l.mid));
          halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tv(l.dir));
          gizmoGroup.add(halo);

          // 1. LENGTH STRETCH GIZMO (Cyan glowing handle at bubble's far end/apex)
          const lenHandlePos = tv(l.end).clone().addScaledVector(tv(l.dir), 0.28);
          const lenHandle = new THREE.Mesh(
            new THREE.SphereGeometry(0.24, 18, 14),
            new THREE.MeshBasicMaterial({ color: new THREE.Color("#22D3EE") })
          );
          lenHandle.position.copy(lenHandlePos);
          lenHandle.userData = { gizmoKind: "length", bubbleIndex: l.index };
          gizmoGroup.add(lenHandle);
          gizmoMeshesRef.current.push(lenHandle);

          const coneOut = new THREE.Mesh(
            new THREE.ConeGeometry(0.14, 0.3, 14),
            new THREE.MeshBasicMaterial({ color: new THREE.Color("#22D3EE") })
          );
          coneOut.position.copy(lenHandlePos).addScaledVector(tv(l.dir), 0.3);
          coneOut.quaternion.setFromUnitVectors(Y, tv(l.dir));
          coneOut.userData = { gizmoKind: "length", bubbleIndex: l.index };
          gizmoGroup.add(coneOut);
          gizmoMeshesRef.current.push(coneOut);

          // 2. DIAMETER SQUEEZE GIZMO (Magenta sphere on bubble equator)
          const diamHandle = new THREE.Mesh(
            new THREE.SphereGeometry(0.19, 16, 12),
            new THREE.MeshBasicMaterial({ color: new THREE.Color("#F472B6") })
          );
          diamHandle.position
            .copy(tv(l.mid))
            .addScaledVector(tv(l.side), l.radiusUnits + 0.28);
          diamHandle.userData = { gizmoKind: "diameter", bubbleIndex: l.index };
          gizmoGroup.add(diamHandle);
          gizmoMeshesRef.current.push(diamHandle);

          // 3. BEND / TURN AIM GIZMO (Amber sphere above bubble midpoint)
          const bendHandle = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.22, 0),
            new THREE.MeshBasicMaterial({ color: new THREE.Color("#FACC15") })
          );
          bendHandle.position
            .copy(tv(l.mid))
            .addScaledVector(tv(l.up), l.radiusUnits + 0.36);
          bendHandle.userData = { gizmoKind: "bend", bubbleIndex: l.index };
          gizmoGroup.add(bendHandle);
          gizmoMeshesRef.current.push(bendHandle);

          // 4. IN-SCENE '+' JOINT HANDLE (Emerald sphere at chainEnd to add next bubble right in 3D!)
          const addPos = tv(l.chainEnd)
            .clone()
            .addScaledVector(tv(l.chainDir), 0.32)
            .add(new THREE.Vector3(0, -0.32, 0));
          const addSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 16, 12),
            new THREE.MeshBasicMaterial({ color: new THREE.Color("#10B981") })
          );
          addSphere.position.copy(addPos);
          addSphere.userData = { gizmoKind: "add_after", bubbleIndex: l.index };
          gizmoGroup.add(addSphere);
          gizmoMeshesRef.current.push(addSphere);
        }
      }

      /* ----- nozzle knots, trailing un-twisted balloon tubes & uninflated tails ----- */
      const droopingTail = (
        from: THREE.Vector3,
        dirV: THREE.Vector3,
        tailInches: number,
        color: string
      ) => {
        const tl = THREE.MathUtils.clamp(tailInches * UNIT * 0.42, 0.45, 2.2);
        const pts = [
          from.clone(),
          from
            .clone()
            .addScaledVector(dirV, tl * 0.45)
            .add(new THREE.Vector3(0, -tl * 0.16, 0)),
          from
            .clone()
            .addScaledVector(dirV, tl * 0.78)
            .add(new THREE.Vector3(0.1, -tl * 0.5, 0.05)),
        ];
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.075, 10, false),
          new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(color),
            roughness: 0.38,
            clearcoat: 0.4,
          })
        );
        modelGroup.add(tube);
      };

      balloons.forEach((bal) => {
        const chain = chains.get(bal.id);
        const bLayouts = layouts.filter((l) => l.bubble.balloonId === bal.id);
        if (bLayouts.length === 0) return;
        if (!vis.introducedBalloons.has(bal.id)) return;

        // Tied nozzle lip & bead
        const knotPos = chain ? tv(chain.startPos) : tv(bLayouts[0].start);
        const knot = new THREE.Mesh(
          new THREE.TorusGeometry((chain?.radiusUnits ?? 0.55) * 0.36, 0.095, 10, 20),
          latexMat(bal.color)
        );
        knot.position.copy(knotPos);
        knot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tv(bLayouts[0].dir));
        modelGroup.add(knot);

        const formedL = bLayouts.filter((l) => vis.formed.has(l.index));
        const unformedL = bLayouts.filter((l) => !vis.formed.has(l.index));

        if (buildMode === "step" && !releasedHands && unformedL.length > 0) {
          const lastFormed = formedL[formedL.length - 1];
          const origin = lastFormed ? tv(lastFormed.chainEnd) : tv(bLayouts[0].start);
          const dirR = lastFormed ? tv(lastFormed.chainDir) : tv(bLayouts[0].dir);
          const rawRemainingUnits =
            unformedL.reduce((s, l) => s + (l.bubble.lengthInches || 0), 0) * UNIT;
          const totalLen = Math.min(9.5, Math.max(1.2, rawRemainingUnits));
          const r = chain?.radiusUnits ?? 0.55;
          const p0 = origin.clone();
          const p1 = origin.clone().addScaledVector(dirR, totalLen * 0.5);
          const p2 = p1
            .clone()
            .addScaledVector(dirR, totalLen * 0.28)
            .add(new THREE.Vector3(0, -totalLen * 0.08, 0));
          const p3 = p2
            .clone()
            .addScaledVector(dirR, totalLen * 0.14)
            .add(new THREE.Vector3(0, -totalLen * 0.14, 0));
          const remMesh = new THREE.Mesh(
            new THREE.TubeGeometry(
              new THREE.CatmullRomCurve3([p0, p1, p2, p3]),
              32,
              r * 0.92,
              16,
              false
            ),
            latexMat(bal.color)
          );
          remMesh.castShadow = true;
          modelGroup.add(remMesh);
          const cap = new THREE.Mesh(
            new THREE.SphereGeometry(r * 0.92, 16, 12),
            latexMat(bal.color)
          );
          cap.position.copy(p3);
          modelGroup.add(cap);
          droopingTail(p3, dirR, bal.tailLengthInches ?? 8, bal.color);
        } else {
          const last = bLayouts[bLayouts.length - 1];
          if (
            last &&
            last.bubble.twistType !== "cut_tail" &&
            last.bubble.twistType !== "cut_tail_bubbles" &&
            last.bubble.lockToBubbleStart === undefined
          ) {
            droopingTail(
              tv(last.end),
              tv(last.dir),
              bal.tailLengthInches ?? 8,
              bal.color
            );
          }
        }
      });

      /* ----- numbered bubble callout badges ----- */
      if (showLabels) {
        layouts.forEach((l) => {
          if (!vis.formed.has(l.index)) return;
          const isActive = vis.active.has(l.index);
          const isSelected = selectedBubbleIndex === l.index;
          const isDanger = l.endSeamWillUntwist;
          const canvas = document.createElement("canvas");
          canvas.width = 128;
          canvas.height = 128;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.beginPath();
            ctx.arc(64, 64, 50, 0, Math.PI * 2);
            ctx.fillStyle = isDanger
              ? DANGER_COLOR
              : isSelected
              ? SELECT_COLOR
              : isActive
              ? HIGHLIGHT
              : "rgba(15,23,42,0.88)";
            ctx.fill();
            ctx.lineWidth = 6;
            ctx.strokeStyle = isSelected || isActive ? "#0f172a" : "rgba(255,255,255,0.75)";
            ctx.stroke();
            ctx.fillStyle = isSelected || isActive ? "#0f172a" : "#ffffff";
            ctx.font = "bold 50px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(l.index + 1), 64, 67);
          }
          const tex = new THREE.CanvasTexture(canvas);
          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
          );
          sprite.renderOrder = 25;
          sprite.scale.set(0.76, 0.76, 1);
          sprite.position
            .copy(tv(l.mid))
            .addScaledVector(tv(l.up), l.radiusUnits + 0.44);
          labelGroup.add(sprite);
        });
      }

      /* ----- center sculpture & auto-fit camera when design changes ----- */
      const finalBox = new THREE.Box3();
      layouts.forEach((l) => {
        finalBox.expandByPoint(tv(l.start));
        finalBox.expandByPoint(tv(l.end));
        finalBox.expandByPoint(tv(l.mid));
      });
      if (!finalBox.isEmpty()) {
        finalBox.expandByScalar(0.8);
        const center = new THREE.Vector3();
        finalBox.getCenter(center);
        const sphere = new THREE.Sphere();
        finalBox.getBoundingSphere(sphere);
        sphere.radius *= 1.16;
        finalSphereRef.current = sphere;
        pivot.position.copy(center.clone().negate());
        if (gridRef.current) {
          gridRef.current.position.y = finalBox.min.y - center.y - 0.35;
        }
        const fitKey =
          bubbles[0]?.id +
          ":" +
          balloons.map((b) => b.id).join("|");
        if (fitKey !== lastFitKeyRef.current) {
          lastFitKeyRef.current = fitKey;
          fitCameraTo(sphere, false);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      layoutSnapshot,
      balloons,
      bubbles,
      steps,
      currentStepIndex,
      buildMode,
      selectedBubbleIndex,
      showLabels,
      showGhost,
      wireframe,
      releasedHands,
      dropPreview,
    ]);

    /* ---------------- HTML5 Drag-and-Drop Twist onto 3D Canvas ---------------- */
    const hitBubbleAtClientPos = (clientX: number, clientY: number): number | null => {
      const renderer = rendererRef.current;
      const camera = cameraRef.current;
      if (!renderer || !camera) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      const rc = new THREE.Raycaster();
      rc.setFromCamera(ndc, camera);
      const hits = rc.intersectObjects(pickMeshesRef.current, false);
      const hit = hits.find((h) => h.object.userData.bubbleIndex !== undefined);
      return hit ? (hit.object.userData.bubbleIndex as number) : null;
    };

    const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      const preset = e.dataTransfer.types.includes("application/x-balloon-twist")
        ? (dropPreview?.preset ?? "basic")
        : null;
      if (!preset) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      const hitIdx = hitBubbleAtClientPos(e.clientX, e.clientY);
      setDropPreview((prev) => ({
        preset: prev?.preset ?? "basic",
        bubbleIndex: hitIdx,
        convertMode: e.altKey,
      }));
    };

    const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
      const raw = e.dataTransfer.getData("application/x-balloon-twist") as AddTwistPresetKind;
      setDropPreview(null);
      if (!raw) return;
      e.preventDefault();
      const hitIdx = hitBubbleAtClientPos(e.clientX, e.clientY);
      if (hitIdx !== null && e.altKey) {
        const entry = ADD_TWIST_PALETTE.find((p) => p.kind === raw);
        if (entry) {
          onUpdateBubble?.(hitIdx, {
            twistType: entry.convertTwist,
            isLoop: entry.convertTwist === "loop",
            isPinch: entry.convertTwist === "pinch" || entry.convertTwist === "toe",
            isTulip: entry.convertTwist === "tulip",
          });
          onSelectBubble?.(hitIdx);
        }
        return;
      }
      onAddTwistPreset?.(raw, hitIdx ?? bubbles.length - 1);
    };

    const safeIdx = Math.max(0, Math.min(selectedBubbleIndex ?? 0, bubbles.length - 1));
    const selBubble = bubbles[safeIdx];
    const selLayout = layoutSnapshot.layouts[safeIdx];
    const selBalloon = balloons.find((x) => x.id === selBubble?.balloonId);
    const { stability } = layoutSnapshot;
    const visNow =
      buildMode === "step" && !releasedHands
        ? getStepVisibility(steps, bubbles, balloons, currentStepIndex)
        : null;
    const formedCount = visNow ? visNow.formed.size : bubbles.length;
    const firstUntwistIssue = stability.issues.find((i) => i.severity === "will_untwist") || stability.issues[0];

    return (
      <div
        className={`relative rounded-2xl overflow-hidden shadow-2xl bg-slate-950 border border-slate-800 select-none ${className}`}
        onDragOver={handleCanvasDragOver}
        onDragLeave={() => setDropPreview((p) => (p ? { ...p, bubbleIndex: null } : null))}
        onDrop={handleCanvasDrop}
      >
        {/* WebGL Smooth Latex Viewport */}
        <div
          ref={containerRef}
          style={{ cursor: cursorStyle }}
          className="w-full h-full min-h-[540px]"
        />

        {/* Live Drag Handle Callout Toast */}
        {dragReadout && (
          <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-slate-950/95 border border-cyan-400 text-cyan-200 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold shadow-2xl">
            {dragReadout}
          </div>
        )}

        {/* Live Drag-and-Drop Target Callout */}
        {dropPreview && (
          <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-emerald-950/95 border border-emerald-400 text-emerald-200 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-2xl">
            {dropPreview.bubbleIndex !== null
              ? dropPreview.convertMode
                ? `🔄 Drop to convert #${dropPreview.bubbleIndex + 1} (${bubbles[dropPreview.bubbleIndex]?.label}) → ${dropPreview.preset}`
                : `➕ Drop to insert ${dropPreview.preset.replace("_", " ")} right after #${dropPreview.bubbleIndex + 1} (${bubbles[dropPreview.bubbleIndex]?.label}) · (Hold Alt to convert)`
              : `➕ Drop to twist ${dropPreview.preset.replace("_", " ")} onto the balloon end`}
          </div>
        )}

        {/* TOP BAR: Stability & Hands-Free Physics Tester + Camera Controls */}
        <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex flex-wrap items-center justify-between gap-1.5 pointer-events-none">
          {/* Stability Status + Let Go Physics Button + 1-Click Auto-Fix */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-700/70 shadow-lg text-xs">
            <button
              onClick={() => setReleasedHands((r) => !r)}
              className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                releasedHands
                  ? "bg-rose-500 text-white shadow ring-2 ring-rose-300/60"
                  : "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30"
              }`}
              title="Simulate letting go of all twists with your hands — un-anchored twists unravel into straight tubes!"
            >
              <span>{releasedHands ? "🖐️ Hands Released!" : "✊ Hold → 🖐️ Test Let Go"}</span>
            </button>

            {stability.isStable ? (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
                ✅ Stable ({stability.lockedJoints}/{stability.totalJoints} joints locked)
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <span
                  className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-bold animate-pulse"
                  title={firstUntwistIssue?.whatHappensWhenReleased}
                >
                  ⚠️ {stability.untwistCount} Will Untwist!
                </span>
                {onAutoStabilizeAll && (
                  <button
                    onClick={() => {
                      onAutoStabilizeAll();
                      setReleasedHands(false);
                    }}
                    className="px-2 py-0.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] shadow transition"
                    title={firstUntwistIssue ? `${firstUntwistIssue.title} — Click to automatically lock all unstable joints!` : "Auto-lock unstable joints"}
                  >
                    🔧 Lock Now
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Camera & Overlay Controls */}
          <div className="pointer-events-auto flex items-center gap-1 bg-slate-900/90 backdrop-blur-md px-2 py-1.5 rounded-xl border border-slate-700/70 text-[11px] text-slate-200 shadow-lg">
            <button
              onClick={() => setPaletteOpen((p) => !p)}
              className={`px-2 py-0.5 rounded-md font-semibold transition ${
                paletteOpen ? "bg-amber-500 text-slate-950" : "hover:bg-slate-800 text-slate-300"
              }`}
              title="Toggle Add-Twist Palette inside 3D Viewport"
            >
              🧰 Twists
            </button>
            <button
              onClick={() => {
                const next = !isAutoRotating;
                setIsAutoRotating(next);
                if (controlsRef.current) controlsRef.current.autoRotate = next;
              }}
              className={`px-2 py-0.5 rounded-md transition ${
                isAutoRotating ? "bg-amber-500 text-slate-950 font-bold" : "hover:bg-slate-800"
              }`}
              title="Auto-spin turntable"
            >
              🔄 Spin
            </button>
            <button
              onClick={() => fitCameraTo(finalSphereRef.current, true)}
              className="px-2 py-0.5 rounded-md hover:bg-slate-800 transition"
              title="Fit camera to sculpture"
            >
              🎯 Fit
            </button>
            {onToggleLabels && (
              <button
                onClick={onToggleLabels}
                className={`px-2 py-0.5 rounded-md transition ${
                  showLabels ? "bg-slate-700 text-amber-300" : "hover:bg-slate-800 text-slate-400"
                }`}
                title="Toggle 3D bubble numbers"
              >
                #
              </button>
            )}
            {onToggleGhost && (
              <button
                onClick={onToggleGhost}
                className={`px-2 py-0.5 rounded-md transition ${
                  showGhost ? "bg-slate-700 text-amber-300" : "hover:bg-slate-800 text-slate-400"
                }`}
                title="Toggle tiered forecast of the next three build steps"
              >
                👻
              </button>
            )}
            <button
              onClick={() => setWireframe((w) => !w)}
              className={`px-2 py-0.5 rounded-md transition ${
                wireframe ? "bg-cyan-500 text-slate-950 font-bold" : "hover:bg-slate-800"
              }`}
              title="Toggle wireframe latex mesh"
            >
              🌐
            </button>
          </div>
        </div>

        {/* LEFT FLOATING PALETTE INSIDE 3D SIMULATION: Click OR Drag-and-Drop Twists Onto Model! */}
        {paletteOpen && onAddTwistPreset && (
          <div className="absolute top-14 left-2.5 z-20 w-[132px] max-h-[305px] overflow-y-auto bg-slate-900/88 backdrop-blur-md p-2 rounded-xl border border-slate-700/70 shadow-xl space-y-1">
            <div className="text-[9px] font-black uppercase tracking-wider text-amber-400 px-1 flex items-center justify-between">
              <span>+ Add / Drop Twist</span>
            </div>
            <div className="grid grid-cols-1 gap-1">
              {ADD_TWIST_PALETTE.map((item) => (
                <button
                  key={item.kind}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-balloon-twist", item.kind);
                    e.dataTransfer.effectAllowed = "copy";
                    setDropPreview({ preset: item.kind, bubbleIndex: null, convertMode: false });
                  }}
                  onDragEnd={() => setDropPreview(null)}
                  onClick={() => onAddTwistPreset(item.kind, safeIdx)}
                  className="px-2 py-1 rounded-lg bg-slate-950/90 hover:bg-amber-500 hover:text-slate-950 text-left text-[11px] font-semibold text-slate-200 border border-slate-800 transition flex items-center gap-1.5 cursor-grab active:cursor-grabbing"
                  title={`${item.hint} — Click to insert after Bubble #${safeIdx + 1}, or drag & drop directly onto any 3D bubble!`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
            {onAddBalloon && (
              <div className="pt-1 border-t border-slate-800 space-y-1">
                <div className="text-[9px] font-bold uppercase text-slate-400 px-1">+ New Balloon</div>
                <div className="grid grid-cols-3 gap-1">
                  {(["160", "260", "360"] as BalloonSize[]).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => onAddBalloon(sz, "#38BDF8", "Pale Blue")}
                      className="py-1 rounded bg-cyan-950/80 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 font-mono font-bold text-[10px] border border-cyan-800/60 transition"
                      title={`Attach a new ${sz} balloon at the current joint`}
                    >
                      +{sz}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instability Banner when an active issue exists */}
        {!stability.isStable && firstUntwistIssue && (
          <div className="absolute top-14 right-2.5 z-20 max-w-[300px] bg-rose-950/92 backdrop-blur-md border border-rose-500/60 rounded-xl p-2.5 text-[11px] text-rose-100 shadow-xl space-y-1.5">
            <div className="font-bold text-rose-300 flex items-center justify-between gap-2">
              <span>⚠️ {firstUntwistIssue.title}</span>
            </div>
            <p className="text-[10px] text-rose-200/90 leading-snug">
              {firstUntwistIssue.whatHappensWhenReleased}
            </p>
            {onApplyAutoFix && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  onClick={() => {
                    onApplyAutoFix(firstUntwistIssue.fix);
                    setReleasedHands(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] transition shadow"
                >
                  🔧 {firstUntwistIssue.fixLabel}
                </button>
                <button
                  onClick={() => setReleasedHands((r) => !r)}
                  className="px-2 py-1 rounded-lg bg-rose-900/80 hover:bg-rose-800 text-rose-200 text-[10px] font-semibold transition"
                >
                  {releasedHands ? "✊ Hold Back" : "🖐️ Watch Unravel"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* BOTTOM DOCK RIGHT INSIDE THE 3D VIEWPORT: Selected Bubble Direct Controls + Step Bar */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 bg-slate-900/92 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5 shadow-2xl space-y-2 text-xs">
          {/* Header Row: Selected Bubble Picker + Direct Twist Switcher + Add/Delete + Collapse */}
          {selBubble && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setHudOpen((o) => !o)}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold"
                title={hudOpen ? "Collapse in-viewport sliders" : "Expand in-viewport sliders"}
              >
                {hudOpen ? "▼" : "▲"} #{safeIdx + 1}
              </button>

              <button
                onClick={() => onSelectBubble?.(Math.max(0, safeIdx - 1))}
                disabled={safeIdx === 0}
                className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] disabled:opacity-30"
                title="Select previous bubble"
              >
                ◀
              </button>
              <input
                type="text"
                value={selBubble.label}
                onChange={(e) => onUpdateBubble?.(safeIdx, { label: e.target.value })}
                className="w-28 sm:w-36 px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-[11px] font-semibold text-white focus:outline-none focus:border-cyan-400"
              />
              <button
                onClick={() => onSelectBubble?.(Math.min(bubbles.length - 1, safeIdx + 1))}
                disabled={safeIdx >= bubbles.length - 1}
                className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] disabled:opacity-30"
                title="Select next bubble"
              >
                ▶
              </button>

              {/* Direct Twist Type Changer */}
              <select
                value={selBubble.twistType}
                onChange={(e) => {
                  const t = e.target.value as TwistType;
                  onUpdateBubble?.(safeIdx, {
                    twistType: t,
                    isLoop: t === "loop",
                    isPinch: t === "pinch" || t === "toe",
                    isTulip: t === "tulip" || t === "tulip_chain",
                  });
                }}
                className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 font-semibold text-[11px] focus:outline-none"
                title="Change this bubble's twist formation"
              >
                {Object.values(TWIST_ENCYCLOPEDIA).map((tw) => (
                  <option key={tw.type} value={tw.type} className="bg-slate-900 text-white">
                    🔄 {tw.name}
                  </option>
                ))}
              </select>

              {/* Quick 160 / 260 / 360 Gauge Buttons */}
              <div className="flex rounded overflow-hidden border border-slate-700 bg-slate-950">
                {(
                  [
                    ["160", 1.0],
                    ["260", 2.0],
                    ["360", 3.0],
                  ] as Array<[BalloonSize, number]>
                ).map(([label, d]) => (
                  <button
                    key={label}
                    onClick={() => onUpdateBubble?.(safeIdx, { diameterInches: d }, pairSync)}
                    className={`px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                      Math.abs((selBubble.diameterInches || 2) - d) < 0.35
                        ? "bg-cyan-500 text-slate-950"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title={`Set bubble gauge to ${label} (${d}″ diameter)`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {selLayout?.partnerIndex !== undefined && (
                <button
                  onClick={() => setPairSync((s) => !s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                    pairSync
                      ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                  title="Keep paired lock bubbles equal when dragging size in 3D"
                >
                  🔗 Pair {pairSync ? "ON" : "OFF"}
                </button>
              )}

              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => onAddTwistPreset?.("basic", safeIdx)}
                  className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px]"
                  title="Insert bubble right after selected"
                >
                  + Bubble
                </button>
                <button
                  onClick={() => onDuplicateBubble?.(safeIdx)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
                  title="Duplicate selected bubble"
                >
                  ⧉
                </button>
                <button
                  onClick={() => onDeleteBubble?.(safeIdx)}
                  disabled={bubbles.length <= 1}
                  className="px-2 py-0.5 rounded bg-rose-950/80 hover:bg-rose-600 text-rose-300 hover:text-white font-bold text-[11px] disabled:opacity-30"
                  title="Remove selected bubble"
                >
                  − Remove
                </button>
              </div>
            </div>
          )}

          {/* Expandable Direct Sliders + Color Dots + 3D Handle Legend */}
          {hudOpen && selBubble && (
            <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>🔵 Length (or drag cyan tip)</span>
                    <span className="font-mono text-cyan-300">
                      {selBubble.lengthInches}″ ({inchesToFingers(selBubble.lengthInches)}f)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={24}
                    step={0.25}
                    value={selBubble.lengthInches}
                    onChange={(e) =>
                      onUpdateBubble?.(
                        safeIdx,
                        { lengthInches: parseFloat(e.target.value) },
                        pairSync
                      )
                    }
                    className="w-full accent-cyan-400 h-1.5 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>🟠 Bend Up/Down (drag gold handle)</span>
                    <span className="font-mono text-amber-300">{selBubble.bend ?? 0}°</span>
                  </div>
                  <input
                    type="range"
                    min={-160}
                    max={160}
                    step={5}
                    value={selBubble.bend ?? 0}
                    onChange={(e) =>
                      onUpdateBubble?.(safeIdx, { bend: parseInt(e.target.value) })
                    }
                    className="w-full accent-amber-400 h-1.5 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>🟠 Turn Left/Right</span>
                    <span className="font-mono text-amber-300">{selBubble.turn ?? 0}°</span>
                  </div>
                  <input
                    type="range"
                    min={-160}
                    max={160}
                    step={5}
                    value={selBubble.turn ?? 0}
                    onChange={(e) =>
                      onUpdateBubble?.(safeIdx, { turn: parseInt(e.target.value) })
                    }
                    className="w-full accent-amber-400 h-1.5 cursor-pointer"
                  />
                </div>
              </div>

              {/* Color Swatches + Step Scrubber right inside viewport */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-1">
                  {TWISTER_COLORS.slice(0, 12).map((colorOption) => (
                    <button
                      key={colorOption.name}
                      onClick={() =>
                        selBalloon &&
                        onUpdateBalloon?.(selBalloon.id, {
                          color: colorOption.hex,
                          colorName: colorOption.name,
                        })
                      }
                      className={`w-4 h-4 rounded-full border transition hover:scale-125 ${
                        selBalloon?.color.toLowerCase() === colorOption.hex.toLowerCase()
                          ? "border-white ring-2 ring-cyan-400"
                          : "border-white/20"
                      }`}
                      style={{ backgroundColor: colorOption.hex }}
                      title={`${colorOption.name} — recolors the entire ${selBalloon?.size ?? ""} balloon`}
                    />
                  ))}
                  {selBalloon && (
                    <span className="text-[10px] text-slate-500 ml-1 font-mono">
                      {selBalloon.name}
                    </span>
                  )}
                </div>

                {/* Inline Step Switcher synced with 3D Build */}
                {onSelectStep && onBuildModeChange && (
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      onClick={() => onBuildModeChange(buildMode === "step" ? "final" : "step")}
                      className={`px-2 py-0.5 rounded font-bold ${
                        buildMode === "final"
                          ? "bg-emerald-500 text-slate-950"
                          : "bg-amber-500 text-slate-950"
                      }`}
                    >
                      {buildMode === "final"
                        ? `★ Final (${bubbles.length})`
                        : `🪜 Step ${currentStepIndex + 1}/${steps.length} (${formedCount}/${bubbles.length})`}
                    </button>
                    <button
                      onClick={() => {
                        onBuildModeChange("step");
                        onSelectStep(Math.max(0, currentStepIndex - 1));
                      }}
                      disabled={currentStepIndex <= 0}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30"
                    >
                      ◀
                    </button>
                    <button
                      onClick={() => {
                        onBuildModeChange("step");
                        onSelectStep(Math.min(steps.length - 1, currentStepIndex + 1));
                      }}
                      disabled={currentStepIndex >= steps.length - 1}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30"
                    >
                      ▶
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

ThreeBalloonViewer.displayName = "ThreeBalloonViewer";

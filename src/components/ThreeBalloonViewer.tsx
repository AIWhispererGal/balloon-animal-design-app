"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useCallback,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  Bird,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleDashed,
  Copy,
  Equal,
  Flower2,
  Ghost,
  Hand,
  Hash,
  Link2,
  Maximize2,
  PawPrint,
  Pin,
  Plus,
  RotateCw,
  Scissors,
  Shell,
  Shield,
  Trash2,
  Unlink,
  Waves,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import {
  BalloonSpec,
  BubbleSpec,
  StabilityAutoFix,
  StepSpec,
  TwistType,
} from "@/types/balloon";
import { TWIST_ENCYCLOPEDIA, inchesToFingers } from "@/lib/balloonConstants";
import {
  BubbleLayout,
  UNIT,
  Vec3,
  computeBalloonLayout,
  getStepVisibility,
} from "@/lib/balloonLayout";
import { computeAirBudget } from "@/lib/balloonAir";
import { SplitMode, twistFlags } from "@/lib/designEdits";
import { AddBalloonPopover, AddBalloonRequest } from "./AddBalloonPopover";
import { ColorPicker } from "./ColorPicker";
import { SplitMenu } from "./SplitMenu";
import { AirBudgetBar } from "./AirBudgetBar";

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
  selectedBubbleIndices?: number[];
  onSelectBubble?: (index: number, additive?: boolean) => void;
  onClearSelection?: () => void;
  onUpdateBubble?: (index: number, updated: Partial<BubbleSpec>, syncPartner?: boolean) => void;
  onAddTwistPreset?: (preset: AddTwistPresetKind, afterBubbleIndex?: number, balloonId?: string) => void;
  onDeleteBubble?: (index: number) => void;
  onDuplicateBubble?: (index: number) => void;
  onSplitBubble?: (index: number, mode: SplitMode) => void;
  onTwistTogether?: (indices: number[]) => void;
  onReleaseTwists?: (indices: number[]) => void;
  onEqualizeLengths?: (indices: number[]) => void;
  onAddBalloon?: (req: AddBalloonRequest) => void;
  onUpdateBalloon?: (balloonId: string, updated: Partial<BalloonSpec>) => void;
  activeBalloonId?: string | null;
  onSetActiveBalloon?: (id: string | null) => void;
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
const MULTI_COLOR = "#67E8F9";
const DANGER_COLOR = "#F43F5E";
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const ADD_TWIST_PALETTE: Array<{
  kind: AddTwistPresetKind;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  convertTwist: TwistType;
  hint: string;
}> = [
  { kind: "basic", label: "Basic", Icon: Circle, convertTwist: "basic", hint: "Single bubble twist (hold until locked)" },
  { kind: "lock_pair", label: "Lock pair", Icon: Link2, convertTwist: "lock", hint: "Two folded bubbles locked together (ears, legs)" },
  { kind: "pinch", label: "Pinch / ear", Icon: Pin, convertTwist: "pinch", hint: "Self-locking friction pinch at the joint" },
  { kind: "loop", label: "Loop", Icon: CircleDashed, convertTwist: "loop", hint: "Self-locking teardrop petal or guard loop" },
  { kind: "toe", label: "Toe paw", Icon: PawPrint, convertTwist: "toe", hint: "Tiny paw pinch twist" },
  { kind: "tulip", label: "Tulip / apple", Icon: Flower2, convertTwist: "tulip", hint: "Inverted nozzle dimple twist with a lock pinch" },
  { kind: "bird_body", label: "Bird body", Icon: Bird, convertTwist: "bird_body", hint: "Three bubbles rolled through as a bundle" },
  { kind: "spiral", label: "Spiral", Icon: Shell, convertTwist: "spiral", hint: "Coiled corkscrew segment" },
  { kind: "s_hook", label: "S-hook", Icon: Waves, convertTwist: "s_hook", hint: "Warm hand-curved S contour" },
  { kind: "z_bend", label: "Z-bend", Icon: Zap, convertTwist: "z_bend", hint: "Sharp accordion fold" },
  { kind: "side_bubble", label: "Side rail", Icon: Shield, convertTwist: "side_bubble", hint: "Flank bubble along the spine" },
  { kind: "cut_tail_bubbles", label: "Pom-pom tip", Icon: Scissors, convertTwist: "cut_tail_bubbles", hint: "Tied cut tail with a tiny bead" },
];

/** Smooth latex sausage profile from y = 0 to y = lengthUnits, pinched at both seams. */
function createSmoothLatexSausageGeometry(radius: number, lengthUnits: number): THREE.LatheGeometry {
  const N = 26;
  const pts: THREE.Vector2[] = [];
  const capFrac = Math.min(0.42, (radius * 0.95) / Math.max(0.28, lengthUnits));
  for (let i = 0; i <= N; i++) {
    const t = i / N;
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

/** Apple / tulip twist with a recessed knot dimple. */
function createTulipLatexGeometry(radius: number, lengthUnits: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const H = lengthUnits;
  const steps = 22;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = radius * (0.15 + 1.02 * Math.sin(Math.min(1, t * 1.12) * Math.PI * 0.86));
    pts.push(new THREE.Vector2(Math.max(0.03, r), t * H));
  }
  pts.push(new THREE.Vector2(radius * 0.42, H * 0.98));
  pts.push(new THREE.Vector2(radius * 0.22, H * 0.72));
  pts.push(new THREE.Vector2(0.01, H * 0.58));
  return new THREE.LatheGeometry(pts, 28);
}

function disposeObject(o: THREE.Object3D) {
  const mesh = o as THREE.Mesh;
  if (mesh.geometry) mesh.geometry.dispose();
  const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
  const disposeMat = (m: THREE.Material) => {
    if (m.userData.shared) return;
    const withMap = m as THREE.MeshBasicMaterial;
    if (withMap.map && !withMap.map.userData.shared) withMap.map.dispose();
    m.dispose();
  };
  if (Array.isArray(mat)) mat.forEach(disposeMat);
  else if (mat) disposeMat(mat);
}

function clearGroup(g: THREE.Group) {
  while (g.children.length > 0) {
    const child = g.children[0];
    g.remove(child);
    child.traverse(disposeObject);
  }
}

export const ThreeBalloonViewer = forwardRef<ThreeBalloonViewerRef, ThreeBalloonViewerProps>(
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
      selectedBubbleIndices,
      onSelectBubble,
      onClearSelection,
      onUpdateBubble,
      onAddTwistPreset,
      onDeleteBubble,
      onDuplicateBubble,
      onSplitBubble,
      onTwistTogether,
      onReleaseTwists,
      onEqualizeLengths,
      onAddBalloon,
      onUpdateBalloon,
      activeBalloonId,
      onSetActiveBalloon,
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
    const bubbleMeshesRef = useRef<Map<number, THREE.Mesh[]>>(new Map());
    const activeMatsRef = useRef<THREE.MeshPhysicalMaterial[]>([]);
    const dangerRingsRef = useRef<THREE.Mesh[]>([]);
    const finalSphereRef = useRef<THREE.Sphere | null>(null);
    const lastFitKeyRef = useRef<string>("");
    const baseMatCacheRef = useRef<Map<string, THREE.MeshPhysicalMaterial>>(new Map());
    const labelTexCacheRef = useRef<Map<string, THREE.CanvasTexture>>(new Map());

    const [isAutoRotating, setIsAutoRotating] = useState(autoRotateDefault);
    const [wireframe, setWireframe] = useState(false);
    const [releasedHands, setReleasedHands] = useState(false);
    const [pairSync, setPairSync] = useState(true);
    const [hudOpen, setHudOpen] = useState(true);
    const [paletteOpen, setPaletteOpen] = useState(true);
    const [splitMode, setSplitMode] = useState(false);
    const [dragReadout, setDragReadout] = useState<string | null>(null);
    const [cursorStyle, setCursorStyle] = useState<string>("grab");
    const [dropPreview, setDropPreview] = useState<{
      preset: AddTwistPresetKind;
      bubbleIndex: number | null;
      convertMode: boolean;
    } | null>(null);

    const multiSelection = useMemo(
      () => (selectedBubbleIndices ?? (selectedBubbleIndex !== null ? [selectedBubbleIndex] : [])).filter(
        (i) => i >= 0 && i < bubbles.length
      ),
      [selectedBubbleIndices, selectedBubbleIndex, bubbles.length]
    );

    // Latest callbacks/data in refs so WebGL pointer listeners always have fresh state with zero re-mount
    const latestRef = useRef({
      balloons,
      bubbles,
      selectedBubbleIndex,
      pairSync,
      splitMode,
      onSelectBubble,
      onUpdateBubble,
      onAddTwistPreset,
      onSplitBubble,
    });
    const layoutSnapshot = useMemo(
      () => computeBalloonLayout(balloons, bubbles, { releasedHands }),
      [balloons, bubbles, releasedHands]
    );
    const layoutSnapshotRef = useRef(layoutSnapshot);
    useEffect(() => {
      latestRef.current = {
        balloons,
        bubbles,
        selectedBubbleIndex,
        pairSync,
        splitMode,
        onSelectBubble,
        onUpdateBubble,
        onAddTwistPreset,
        onSplitBubble,
      };
      layoutSnapshotRef.current = layoutSnapshot;
    });

    const vis = useMemo(
      () =>
        buildMode === "final" || releasedHands
          ? {
              formed: new Set(bubbles.map((_, i) => i)),
              active: new Set<number>(),
              introducedBalloons: new Set(balloons.map((b) => b.id)),
            }
          : (() => {
              const v = getStepVisibility(steps, bubbles, balloons, currentStepIndex);
              // A balloon with no bubbles yet is already inflated on the table
              balloons.forEach((bal) => {
                if (!bubbles.some((b) => b.balloonId === bal.id)) v.introducedBalloons.add(bal.id);
              });
              return v;
            })(),
      [buildMode, releasedHands, bubbles, balloons, steps, currentStepIndex]
    );

    const airByBalloon = useMemo(
      () => new Map(balloons.map((bal) => [bal.id, computeAirBudget(bal, bubbles, vis.formed)])),
      [balloons, bubbles, vis.formed]
    );

    const fitCameraTo = useCallback((sphere: THREE.Sphere | null, keepDirection = true) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls || !sphere) return;
      const fovRad = (camera.fov * Math.PI) / 180;
      const dist = THREE.MathUtils.clamp((sphere.radius / Math.sin(fovRad / 2)) * 1.05, 7.5, 75);
      let dir = new THREE.Vector3(0.45, 0.34, 1).normalize();
      if (keepDirection && camera.position.length() > 0.01) {
        dir = camera.position.clone().sub(controls.target).normalize();
        if (dir.length() < 0.01) dir = new THREE.Vector3(0.45, 0.34, 1).normalize();
      }
      camera.position.copy(dir.multiplyScalar(dist));
      controls.target.set(0, 0, 0);
      controls.update();
    }, []);

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

    /* ---------------- scene setup + 3D handle drag engine (mounted once) ---------------- */
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const width = container.clientWidth || 640;
      const height = container.clientHeight || 520;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0f1c);
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

      const grid = new THREE.GridHelper(32, 32, 0x1f2937, 0x111827);
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

      /* ----- picking + handle dragging ----- */
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
            lastApplied: string;
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

        const gizmoHits = raycaster.intersectObjects(gizmoMeshesRef.current, true);
        if (gizmoHits.length > 0) {
          const obj = gizmoHits[0].object;
          const gKind = obj.userData.gizmoKind as "length" | "diameter" | "bend" | "add_after" | undefined;
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
              lastApplied: "",
            };
            setCursorStyle("grabbing");
          }
        }
      };

      const onPointerMove = (e: PointerEvent) => {
        if (dragSession) {
          setNdc(e.clientX, e.clientY);
          const b = latestRef.current.bubbles[dragSession.bubbleIndex];
          if (!b) return;

          if (dragSession.mode === "length") {
            if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
              const delta = hitPoint.clone().sub(dragSession.startWorld);
              const alongUnits = delta.dot(dragSession.axisWorld);
              const factor = b.twistType === "loop" || b.isLoop ? 1 / (UNIT * 0.44) : 1 / UNIT;
              const rawInches = dragSession.initialLength + alongUnits * factor;
              const snapped = Math.max(0.5, Math.min(26, Math.round(rawInches * 4) / 4));
              const key = `L${snapped}`;
              if (key !== dragSession.lastApplied) {
                dragSession.lastApplied = key;
                latestRef.current.onUpdateBubble?.(
                  dragSession.bubbleIndex,
                  { lengthInches: snapped },
                  latestRef.current.pairSync
                );
              }
              setDragReadout(
                `${b.label}: ${snapped.toFixed(2).replace(/\.?0+$/, "")}″ (${inchesToFingers(snapped)} fingers)`
              );
            }
          } else if (dragSession.mode === "diameter") {
            if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
              const delta = hitPoint.clone().sub(dragSession.startWorld);
              const radialUnits = delta.dot(dragSession.perpWorld);
              const rawDiam = dragSession.initialDiameter + radialUnits / 0.28;
              const snapped = Math.max(0.75, Math.min(3.5, Math.round(rawDiam * 4) / 4));
              const key = `D${snapped}`;
              if (key !== dragSession.lastApplied) {
                dragSession.lastApplied = key;
                latestRef.current.onUpdateBubble?.(
                  dragSession.bubbleIndex,
                  { diameterInches: snapped },
                  latestRef.current.pairSync
                );
              }
              setDragReadout(`${b.label} diameter: ${snapped.toFixed(2)}″`);
            }
          } else if (dragSession.mode === "bend") {
            const dx = e.clientX - dragSession.startClientX;
            const dy = e.clientY - dragSession.startClientY;
            const newBend = Math.max(-165, Math.min(165, Math.round((dragSession.initialBend - dy * 0.65) / 5) * 5));
            const newTurn = Math.max(-165, Math.min(165, Math.round((dragSession.initialTurn + dx * 0.65) / 5) * 5));
            const key = `B${newBend}T${newTurn}`;
            if (key !== dragSession.lastApplied) {
              dragSession.lastApplied = key;
              latestRef.current.onUpdateBubble?.(dragSession.bubbleIndex, { bend: newBend, turn: newTurn });
            }
            setDragReadout(`${b.label}: bend ${newBend}° · turn ${newTurn}°`);
          }
          return;
        }

        setNdc(e.clientX, e.clientY);
        const gHit = raycaster.intersectObjects(gizmoMeshesRef.current, true)[0];
        if (gHit) {
          const k = gHit.object.userData.gizmoKind;
          setCursorStyle(k === "add_after" ? "copy" : "ew-resize");
          return;
        }
        const bHit = raycaster.intersectObjects(pickMeshesRef.current, false)[0];
        setCursorStyle(bHit ? (latestRef.current.splitMode ? "crosshair" : "pointer") : "grab");
      };

      const onPointerUp = (e: PointerEvent) => {
        if (dragSession) {
          dragSession = null;
          controls.enabled = true;
          try {
            renderer.domElement.releasePointerCapture(e.pointerId);
          } catch {
            // already released
          }
          setDragReadout(null);
          setCursorStyle("grab");
          return;
        }

        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
        setNdc(e.clientX, e.clientY);
        const hits = raycaster.intersectObjects(pickMeshesRef.current, false);
        const hit = hits.find((h) => h.object.userData.bubbleIndex !== undefined);
        if (!hit) return;
        const idx = hit.object.userData.bubbleIndex as number;

        // Split mode: click a point along the bubble to put a new twist there
        if (latestRef.current.splitMode && latestRef.current.onSplitBubble) {
          const lay = layoutSnapshotRef.current.layouts[idx];
          const b = latestRef.current.bubbles[idx];
          if (lay && b) {
            const local = hit.point.clone().sub(pivot.position);
            const a = tv(lay.start);
            const bEnd = tv(lay.end);
            const seg = bEnd.clone().sub(a);
            const segLen2 = seg.lengthSq();
            const t = segLen2 > 1e-6 ? THREE.MathUtils.clamp(local.clone().sub(a).dot(seg) / segLen2, 0.05, 0.95) : 0.5;
            const straight = lay.kind === "capsule" || lay.kind === "bird_rail" || lay.kind === "bent";
            latestRef.current.onSplitBubble(
              idx,
              straight ? { kind: "at", inches: Math.round(b.lengthInches * t * 4) / 4 } : { kind: "equal", parts: 2 }
            );
          }
          return;
        }

        latestRef.current.onSelectBubble?.(idx, e.shiftKey || e.metaKey || e.ctrlKey);
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

      const baseMatCache = baseMatCacheRef.current;
      const labelTexCache = labelTexCacheRef.current;

      return () => {
        running = false;
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener("resize", doResize);
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
        [modelGroup, ghostGroup, gizmoGroup, labelGroup].forEach(clearGroup);
        baseMatCache.forEach((m) => m.dispose());
        baseMatCache.clear();
        labelTexCache.forEach((t) => t.dispose());
        labelTexCache.clear();
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

    /* ---------------- materials (cached per color so rebuilds don't churn the GPU) ---------------- */
    const baseLatexMat = useCallback(
      (hex: string): THREE.MeshPhysicalMaterial => {
        const key = `${hex}|${wireframe ? 1 : 0}`;
        const cache = baseMatCacheRef.current;
        let m = cache.get(key);
        if (!m) {
          m = new THREE.MeshPhysicalMaterial({
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
          m.userData.shared = true;
          cache.set(key, m);
        }
        return m;
      },
      [wireframe]
    );

    const buildMesh = useCallback(
      (l: BubbleLayout, mat: THREE.Material, extras?: THREE.Group): THREE.Mesh => {
        const r = l.radiusUnits;
        const len = l.lengthUnits;
        const startV = tv(l.start);
        const endV = tv(l.end);
        const dirV = tv(l.dir);
        let mesh: THREE.Mesh;

        switch (l.kind) {
          case "loop": {
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
              curvePts.push(
                startV
                  .clone()
                  .addScaledVector(dNorm, Math.sin(theta) * reach)
                  .addScaledVector(sideV, Math.sin(theta * 2) * width * 0.5)
              );
            }
            mesh = new THREE.Mesh(
              new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePts), 40, r * 0.8, 16, false),
              mat
            );
            break;
          }
          case "pinch": {
            const geo = new THREE.SphereGeometry(r * 1.02, 26, 20);
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
              const x = pos.getX(i);
              const y = pos.getY(i);
              const z = pos.getZ(i);
              const pinchIndent = 1 - 0.18 * Math.exp(-(x * x) / (r * r * 0.12));
              pos.setXYZ(i, x * 1.28, y * 0.82 * pinchIndent, z * 1.05);
            }
            geo.computeVertexNormals();
            mesh = new THREE.Mesh(geo, mat);
            mesh.quaternion.setFromUnitVectors(Y_AXIS, dirV);
            mesh.position.copy(tv(l.mid));
            break;
          }
          case "tulip": {
            const span = Math.max(r * 1.9, startV.distanceTo(endV));
            mesh = new THREE.Mesh(createTulipLatexGeometry(r * 1.16, span), mat);
            mesh.quaternion.setFromUnitVectors(Y_AXIS, dirV);
            mesh.position.copy(startV);
            break;
          }
          case "bird_rail": {
            const radialV = l.bowOut ? tv(l.bowOut) : tv(l.up).multiplyScalar(r);
            const q1 = startV.clone().lerp(endV, 0.25).addScaledVector(radialV, 0.85);
            const qMid = startV.clone().lerp(endV, 0.5).addScaledVector(radialV, 1.05);
            const q3 = startV.clone().lerp(endV, 0.75).addScaledVector(radialV, 0.85);
            mesh = new THREE.Mesh(
              new THREE.TubeGeometry(new THREE.CatmullRomCurve3([startV, q1, qMid, q3, endV]), 32, r * 0.92, 16, false),
              mat
            );
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
              const env =
                Math.sin(Math.min(1, t * 5) * (Math.PI / 2)) * Math.sin(Math.min(1, (1 - t) * 5) * (Math.PI / 2));
              const a = t * turns * Math.PI * 2;
              pts.push(
                startV
                  .clone()
                  .addScaledVector(axisNorm, spanLen * t)
                  .addScaledVector(sideV, Math.cos(a) * coilR * (0.25 + 0.75 * env))
                  .addScaledVector(upV, Math.sin(a) * coilR * (0.25 + 0.75 * env))
              );
            }
            mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 68, r * 0.64, 14, false), mat);
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
                : new THREE.QuadraticBezierCurve3(startV, tv(l.mid).addScaledVector(upV, len * 0.22), endV);
            if (extras) {
              const tipCap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.92, 16, 12), mat);
              tipCap.position.copy(endV);
              extras.add(tipCap);
            }
            mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, r * 0.92, 18, false), mat);
            break;
          }
          case "bead": {
            mesh = new THREE.Mesh(new THREE.SphereGeometry(r * 1.12, 24, 18), mat);
            mesh.position.copy(tv(l.mid));
            break;
          }
          default: {
            if (l.bowOut) {
              const qMid = startV.clone().lerp(endV, 0.5).add(tv(l.bowOut));
              mesh = new THREE.Mesh(
                new THREE.TubeGeometry(new THREE.CatmullRomCurve3([startV, qMid, endV]), 28, r * 0.9, 16, false),
                mat
              );
            } else {
              const segVec = endV.clone().sub(startV);
              const segLen = Math.max(0.22, segVec.length());
              const segDir = segVec.length() > 1e-4 ? segVec.normalize() : dirV;
              mesh = new THREE.Mesh(createSmoothLatexSausageGeometry(r, segLen), mat);
              mesh.quaternion.setFromUnitVectors(Y_AXIS, segDir);
              mesh.position.copy(startV);
            }
          }
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
      },
      []
    );

    /* ---------------- heavy pass: latex model, untwisted remainder, shrinking tails ---------------- */
    useEffect(() => {
      const pivot = pivotRef.current;
      const modelGroup = modelGroupRef.current;
      const ghostGroup = ghostGroupRef.current;
      if (!pivot || !modelGroup || !ghostGroup) return;

      clearGroup(modelGroup);
      clearGroup(ghostGroup);
      pickMeshesRef.current = [];
      bubbleMeshesRef.current = new Map();
      activeMatsRef.current = [];
      dangerRingsRef.current = [];

      const { layouts, chains, stability } = layoutSnapshot;

      const specialMat = (hex: string, opts: { active?: boolean; unraveled?: boolean }) => {
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
      };

      const registerBubbleMesh = (idx: number, mesh: THREE.Mesh) => {
        mesh.userData.bubbleIndex = idx;
        modelGroup.add(mesh);
        pickMeshesRef.current.push(mesh);
        const arr = bubbleMeshesRef.current.get(idx) ?? [];
        arr.push(mesh);
        bubbleMeshesRef.current.set(idx, arr);
      };

      /* formed bubbles + lock-pair fold elbows */
      layouts.forEach((l) => {
        if (!vis.formed.has(l.index)) return;
        const isActive = vis.active.has(l.index);
        const mat =
          isActive || l.unraveledInRelease
            ? specialMat(l.bubble.color, { active: isActive, unraveled: l.unraveledInRelease })
            : baseLatexMat(l.bubble.color);
        registerBubbleMesh(l.index, buildMesh(l, mat, modelGroup));

        if (l.foldBridgeTo && l.partnerIndex !== undefined && vis.formed.has(l.partnerIndex)) {
          const pA = tv(l.end);
          const pB = tv(l.foldBridgeTo);
          const apex = pA.clone().lerp(pB, 0.5).addScaledVector(tv(l.dir), l.radiusUnits * 0.62);
          const bridgeMesh = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3([pA, apex, pB]), 16, l.radiusUnits * 0.82, 14, false),
            mat
          );
          registerBubbleMesh(l.index, bridgeMesh);
        }
      });

      /* tiered next-step ghost forecast */
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
              new THREE.MeshBasicMaterial({
                color: new THREE.Color(layout.bubble.color),
                transparent: true,
                opacity: tierOpacity[distance],
                depthWrite: false,
              })
            )
          );
        });
      }

      /* pulsing rings on unstable seams */
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

      /* nozzle knots, untwisted remainder and the shrinking uninflated tail */
      const tailMat = (color: string, ghost = false) =>
        ghost
          ? new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.16, depthWrite: false })
          : new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color), roughness: 0.38, clearcoat: 0.4 });

      const droopingTail = (from: THREE.Vector3, dirV: THREE.Vector3, tailInches: number, color: string, ghost = false) => {
        if (tailInches <= 0.05) return;
        const tl = THREE.MathUtils.clamp(tailInches * UNIT * 0.5, 0.12, 4.5);
        const pts = [
          from.clone(),
          from.clone().addScaledVector(dirV, tl * 0.45).add(new THREE.Vector3(0, -tl * 0.16, 0)),
          from.clone().addScaledVector(dirV, tl * 0.78).add(new THREE.Vector3(0.1, -tl * 0.5, 0.05)),
        ];
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.075, 10, false),
          tailMat(color, ghost)
        );
        modelGroup.add(tube);
      };

      const boundsPts: THREE.Vector3[] = [];

      balloons.forEach((bal) => {
        const chain = chains.get(bal.id);
        if (!chain || !vis.introducedBalloons.has(bal.id)) return;
        const bLayouts = layouts.filter((l) => l.bubble.balloonId === bal.id);
        const air = airByBalloon.get(bal.id);
        const r = chain.radiusUnits;
        const firstDir = bLayouts[0] ? tv(bLayouts[0].dir) : tv(chain.startDir);

        // tied nozzle knot
        const knotPos = tv(chain.startPos);
        const knot = new THREE.Mesh(new THREE.TorusGeometry(r * 0.36, 0.095, 10, 20), baseLatexMat(bal.color));
        knot.position.copy(knotPos);
        knot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), firstDir);
        modelGroup.add(knot);

        const formedL = bLayouts.filter((l) => vis.formed.has(l.index));
        const lastFormed = formedL[formedL.length - 1];
        const lastLayout = bLayouts[bLayouts.length - 1];
        const tiedOff =
          lastLayout &&
          formedL.length === bLayouts.length &&
          (lastLayout.bubble.twistType === "cut_tail" ||
            lastLayout.bubble.twistType === "cut_tail_bubbles" ||
            lastLayout.bubble.lockToBubbleStart !== undefined);

        const origin = lastFormed ? tv(lastFormed.chainEnd) : knotPos.clone();
        const dirR = lastFormed ? tv(lastFormed.chainDir) : firstDir.clone();
        const untwistedInches = air?.untwistedInches ?? 0;
        let tailFrom = origin.clone();

        if (!tiedOff && untwistedInches > 0.2) {
          // inflated but still untwisted balloon; visually capped so a long leftover
          // reads as "unused balloon" without dwarfing the sculpture
          const totalLen = Math.min(9.5, Math.max(0.6, untwistedInches * UNIT));
          const p0 = origin.clone();
          const p1 = origin.clone().addScaledVector(dirR, totalLen * 0.5);
          const p2 = p1.clone().addScaledVector(dirR, totalLen * 0.28).add(new THREE.Vector3(0, -totalLen * 0.08, 0));
          const p3 = p2.clone().addScaledVector(dirR, totalLen * 0.14).add(new THREE.Vector3(0, -totalLen * 0.14, 0));
          const remMesh = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, p1, p2, p3]), 32, r * 0.92, 16, false),
            baseLatexMat(bal.color)
          );
          remMesh.castShadow = true;
          remMesh.userData.untwistedBalloonId = bal.id;
          modelGroup.add(remMesh);
          const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.92, 16, 12), baseLatexMat(bal.color));
          cap.position.copy(p3);
          modelGroup.add(cap);
          tailFrom = p3;
          boundsPts.push(p0, p3);
        } else if (!tiedOff && lastFormed) {
          tailFrom = tv(lastFormed.end);
        }

        if (!tiedOff && air) {
          // ghost of the tail you started with, then the tail that is actually left
          if (buildMode === "step" && air.twistShiftInches > 0.2) {
            droopingTail(tailFrom, dirR, air.initialTailInches, bal.color, true);
          }
          droopingTail(tailFrom, dirR, air.tailRemainingInches, bal.color);
          boundsPts.push(tailFrom);
        }
      });

      /* center sculpture & auto-fit camera when the design changes */
      const finalBox = new THREE.Box3();
      layouts.forEach((l) => {
        finalBox.expandByPoint(tv(l.start));
        finalBox.expandByPoint(tv(l.end));
        finalBox.expandByPoint(tv(l.mid));
      });
      boundsPts.forEach((p) => finalBox.expandByPoint(p));
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
        const fitKey = (bubbles[0]?.id ?? "empty") + ":" + balloons.map((b) => b.id).join("|");
        if (fitKey !== lastFitKeyRef.current) {
          lastFitKeyRef.current = fitKey;
          fitCameraTo(sphere, false);
        }
      }
    }, [
      layoutSnapshot,
      vis,
      airByBalloon,
      balloons,
      bubbles,
      steps,
      currentStepIndex,
      buildMode,
      showGhost,
      wireframe,
      releasedHands,
      baseLatexMat,
      buildMesh,
      fitCameraTo,
    ]);

    /* ---------------- light pass: selection halos, handles, number badges ---------------- */
    useEffect(() => {
      const gizmoGroup = gizmoGroupRef.current;
      const labelGroup = labelGroupRef.current;
      if (!gizmoGroup || !labelGroup) return;
      clearGroup(gizmoGroup);
      clearGroup(labelGroup);
      gizmoMeshesRef.current = [];

      const { layouts } = layoutSnapshot;
      const layoutByIndex = new Map(layouts.map((l) => [l.index, l]));
      const primary = selectedBubbleIndex ?? null;

      if (!releasedHands) {
        // halos on every selected bubble
        multiSelection.forEach((idx) => {
          const l = layoutByIndex.get(idx);
          if (!l || !vis.formed.has(idx)) return;
          const isPrimary = idx === primary;
          const halo = new THREE.Mesh(
            new THREE.TorusGeometry(l.radiusUnits * 1.38 + 0.1, isPrimary ? 0.042 : 0.03, 10, 36),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(isPrimary ? SELECT_COLOR : MULTI_COLOR) })
          );
          halo.position.copy(tv(l.mid));
          halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tv(l.dir));
          gizmoGroup.add(halo);
        });

        // handles on the primary bubble
        const l = primary !== null ? layoutByIndex.get(primary) : undefined;
        if (l && vis.formed.has(l.index) && !splitMode) {
          const lenHandlePos = tv(l.end).clone().addScaledVector(tv(l.dir), 0.28);
          const lenHandle = new THREE.Mesh(
            new THREE.SphereGeometry(0.24, 18, 14),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(SELECT_COLOR) })
          );
          lenHandle.position.copy(lenHandlePos);
          lenHandle.userData = { gizmoKind: "length", bubbleIndex: l.index };
          gizmoGroup.add(lenHandle);
          gizmoMeshesRef.current.push(lenHandle);

          const coneOut = new THREE.Mesh(
            new THREE.ConeGeometry(0.14, 0.3, 14),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(SELECT_COLOR) })
          );
          coneOut.position.copy(lenHandlePos).addScaledVector(tv(l.dir), 0.3);
          coneOut.quaternion.setFromUnitVectors(Y_AXIS, tv(l.dir));
          coneOut.userData = { gizmoKind: "length", bubbleIndex: l.index };
          gizmoGroup.add(coneOut);
          gizmoMeshesRef.current.push(coneOut);

          const diamHandle = new THREE.Mesh(
            new THREE.SphereGeometry(0.19, 16, 12),
            new THREE.MeshBasicMaterial({ color: new THREE.Color("#F472B6") })
          );
          diamHandle.position.copy(tv(l.mid)).addScaledVector(tv(l.side), l.radiusUnits + 0.28);
          diamHandle.userData = { gizmoKind: "diameter", bubbleIndex: l.index };
          gizmoGroup.add(diamHandle);
          gizmoMeshesRef.current.push(diamHandle);

          const bendHandle = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.22, 0),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(HIGHLIGHT) })
          );
          bendHandle.position.copy(tv(l.mid)).addScaledVector(tv(l.up), l.radiusUnits + 0.36);
          bendHandle.userData = { gizmoKind: "bend", bubbleIndex: l.index };
          gizmoGroup.add(bendHandle);
          gizmoMeshesRef.current.push(bendHandle);

          const addPos = tv(l.chainEnd).clone().addScaledVector(tv(l.chainDir), 0.32).add(new THREE.Vector3(0, -0.32, 0));
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

      /* numbered badges (textures cached by number + state) */
      if (showLabels) {
        const cache = labelTexCacheRef.current;
        const texFor = (n: number, state: "danger" | "selected" | "active" | "plain") => {
          const key = `${n}|${state}`;
          let tex = cache.get(key);
          if (tex) return tex;
          const canvas = document.createElement("canvas");
          canvas.width = 128;
          canvas.height = 128;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.beginPath();
            ctx.arc(64, 64, 50, 0, Math.PI * 2);
            ctx.fillStyle =
              state === "danger"
                ? DANGER_COLOR
                : state === "selected"
                ? SELECT_COLOR
                : state === "active"
                ? HIGHLIGHT
                : "rgba(15,23,42,0.88)";
            ctx.fill();
            ctx.lineWidth = 6;
            ctx.strokeStyle = state === "selected" || state === "active" ? "#0f172a" : "rgba(255,255,255,0.75)";
            ctx.stroke();
            ctx.fillStyle = state === "selected" || state === "active" ? "#0f172a" : "#ffffff";
            ctx.font = "bold 50px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(n), 64, 67);
          }
          tex = new THREE.CanvasTexture(canvas);
          tex.userData.shared = true;
          cache.set(key, tex);
          return tex;
        };

        layouts.forEach((l) => {
          if (!vis.formed.has(l.index)) return;
          const state = l.endSeamWillUntwist
            ? "danger"
            : multiSelection.includes(l.index)
            ? "selected"
            : vis.active.has(l.index)
            ? "active"
            : "plain";
          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: texFor(l.index + 1, state), depthTest: false, transparent: true })
          );
          sprite.renderOrder = 25;
          sprite.scale.set(0.76, 0.76, 1);
          sprite.position.copy(tv(l.mid)).addScaledVector(tv(l.up), l.radiusUnits + 0.44);
          labelGroup.add(sprite);
        });
      }
    }, [layoutSnapshot, vis, multiSelection, selectedBubbleIndex, showLabels, releasedHands, splitMode]);

    /* Escape leaves split mode */
    useEffect(() => {
      if (!splitMode) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setSplitMode(false);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [splitMode]);

    /* ---------------- drop-target highlight without a rebuild ---------------- */
    useEffect(() => {
      const idx = dropPreview?.bubbleIndex ?? null;
      if (idx === null) return;
      const meshes = bubbleMeshesRef.current.get(idx);
      if (!meshes) return;
      const hl = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#10B981"),
        emissive: new THREE.Color("#10B981"),
        emissiveIntensity: 0.55,
        roughness: 0.16,
        clearcoat: 1.0,
      });
      const originals = meshes.map((m) => m.material);
      meshes.forEach((m) => {
        m.material = hl;
      });
      return () => {
        meshes.forEach((m, i) => {
          m.material = originals[i];
        });
        hl.dispose();
      };
    }, [dropPreview?.bubbleIndex]);

    /* ---------------- HTML5 drag-and-drop twist onto 3D canvas ---------------- */
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
      if (!e.dataTransfer.types.includes("application/x-balloon-twist")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      const hitIdx = hitBubbleAtClientPos(e.clientX, e.clientY);
      setDropPreview((prev) =>
        prev && prev.bubbleIndex === hitIdx && prev.convertMode === e.altKey
          ? prev
          : { preset: prev?.preset ?? "basic", bubbleIndex: hitIdx, convertMode: e.altKey }
      );
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
          onUpdateBubble?.(hitIdx, { twistType: entry.convertTwist, ...twistFlags(entry.convertTwist) });
          onSelectBubble?.(hitIdx);
        }
        return;
      }
      onAddTwistPreset?.(raw, hitIdx ?? undefined, hitIdx === null ? activeBalloonId ?? undefined : undefined);
    };

    /* ---------------- derived UI state ---------------- */
    const hasBubbles = bubbles.length > 0;
    const safeIdx = hasBubbles ? Math.max(0, Math.min(selectedBubbleIndex ?? 0, bubbles.length - 1)) : -1;
    const selBubble = hasBubbles ? bubbles[safeIdx] : undefined;
    const selLayout = hasBubbles ? layoutSnapshot.layouts[safeIdx] : undefined;
    const selBalloon =
      balloons.find((x) => x.id === selBubble?.balloonId) ??
      balloons.find((x) => x.id === activeBalloonId) ??
      balloons[0];
    const { stability } = layoutSnapshot;
    const formedCount = vis.formed.size;
    const firstUntwistIssue =
      stability.issues.find((i) => i.severity === "will_untwist") || stability.issues[0];
    const multi = multiSelection.length > 1;
    const sortedSel = [...multiSelection].sort((a, b) => a - b);
    const adjacentSel = sortedSel.every((v, k) => k === 0 || v === sortedSel[k - 1] + 1);
    const twistTogetherLabel = !multi
      ? ""
      : adjacentSel
      ? sortedSel.length === 2
        ? "Twist together as lock pair"
        : `Roll ${sortedSel.length} through (bird body)`
      : `Lock #${sortedSel[sortedSel.length - 1] + 1} back into #${sortedSel[0] + 1}`;

    const iconBtn = (active: boolean) =>
      `btn btn-icon ${active ? "btn-active" : "btn-ghost"}`;

    return (
      <div
        className={`relative select-none overflow-hidden bg-[#0a0f1c] ${className}`}
        onDragOver={handleCanvasDragOver}
        onDragLeave={() => setDropPreview((p) => (p ? { ...p, bubbleIndex: null } : null))}
        onDrop={handleCanvasDrop}
      >
        <div ref={containerRef} style={{ cursor: cursorStyle }} className="h-full min-h-[540px] w-full" />

        {/* transient readouts */}
        {(dragReadout || dropPreview || splitMode) && (
          <div className="hud pointer-events-none absolute left-[170px] top-14 z-30 max-w-[400px] px-3.5 py-1.5 font-mono text-xs text-cyan-100">
            {dragReadout
              ? dragReadout
              : dropPreview
              ? dropPreview.bubbleIndex !== null
                ? dropPreview.convertMode
                  ? `Convert #${dropPreview.bubbleIndex + 1} to ${dropPreview.preset.replace(/_/g, " ")}`
                  : `Insert ${dropPreview.preset.replace(/_/g, " ")} after #${dropPreview.bubbleIndex + 1} (hold Alt to convert)`
                : `Drop to add ${dropPreview.preset.replace(/_/g, " ")} at the end of the balloon`
              : "Split mode: click a point on any bubble to put a twist there · Esc to exit"}
          </div>
        )}

        {/* top bar */}
        <div className="pointer-events-none absolute left-2.5 right-2.5 top-2.5 z-20 flex flex-wrap items-start justify-between gap-1.5">
          <div className="hud pointer-events-auto flex flex-wrap items-center gap-1.5 px-2 py-1.5">
            <button
              onClick={() => setReleasedHands((r) => !r)}
              className={`btn btn-xs ${releasedHands ? "btn-danger" : "btn-secondary"}`}
              title="Simulate letting go: unanchored twists unravel into straight tubes"
            >
              <Hand className="h-3.5 w-3.5" />
              {releasedHands ? "Hands released" : "Let go"}
            </button>
            {stability.isStable ? (
              <span className="chip chip-ok">Stable · {stability.lockedJoints}/{stability.totalJoints} locked</span>
            ) : (
              <>
                <span className="chip chip-danger" title={firstUntwistIssue?.whatHappensWhenReleased}>
                  {stability.untwistCount} will untwist
                </span>
                {onAutoStabilizeAll && (
                  <button
                    onClick={() => {
                      onAutoStabilizeAll();
                      setReleasedHands(false);
                    }}
                    className="btn btn-success btn-xs"
                    title={firstUntwistIssue ? `${firstUntwistIssue.title} — auto-lock all unstable joints` : "Auto-lock"}
                  >
                    <Wrench className="h-3.5 w-3.5" /> Lock all
                  </button>
                )}
              </>
            )}
          </div>

          <div className="hud pointer-events-auto flex items-center gap-0.5 px-1 py-1">
            <button onClick={() => setPaletteOpen((p) => !p)} className={iconBtn(paletteOpen)} title="Twist palette">
              <Boxes className="h-4 w-4" />
            </button>
            {onSplitBubble && (
              <button
                onClick={() => setSplitMode((s) => !s)}
                className={iconBtn(splitMode)}
                title="Split mode: click on a bubble where you want a new twist"
                disabled={!hasBubbles}
              >
                <Scissors className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => {
                const next = !isAutoRotating;
                setIsAutoRotating(next);
                if (controlsRef.current) controlsRef.current.autoRotate = next;
              }}
              className={iconBtn(isAutoRotating)}
              title="Turntable spin"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button onClick={() => fitCameraTo(finalSphereRef.current, true)} className={iconBtn(false)} title="Fit to view">
              <Maximize2 className="h-4 w-4" />
            </button>
            {onToggleLabels && (
              <button onClick={onToggleLabels} className={iconBtn(showLabels)} title="Bubble numbers">
                <Hash className="h-4 w-4" />
              </button>
            )}
            {onToggleGhost && (
              <button onClick={onToggleGhost} className={iconBtn(showGhost)} title="Preview the next steps">
                <Ghost className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => setWireframe((w) => !w)} className={iconBtn(wireframe)} title="Wireframe">
              <Boxes className="h-4 w-4 opacity-70" />
            </button>
          </div>
        </div>

        {/* twist palette */}
        {paletteOpen && onAddTwistPreset && (
          <div className="hud absolute left-2.5 top-14 z-30 w-[150px] space-y-1 p-2">
            <div className="flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Add twist</span>
            </div>
            <div className="max-h-[300px] space-y-0.5 overflow-y-auto scrollbar-thin">
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
                  onClick={() =>
                    onAddTwistPreset(item.kind, hasBubbles ? safeIdx : undefined, hasBubbles ? undefined : selBalloon?.id)
                  }
                  className="flex w-full cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-200 transition hover:bg-amber-400 hover:text-slate-950 active:cursor-grabbing"
                  title={`${item.hint}. Click to add after the selected bubble, or drag onto any bubble.`}
                >
                  <item.Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
            {onAddBalloon && (
              <div className="border-t border-slate-800 pt-1.5">
                <AddBalloonPopover
                  bubbles={bubbles}
                  selectedBubbleIndex={hasBubbles ? safeIdx : null}
                  usedColors={balloons.map((b) => b.color)}
                  onAdd={onAddBalloon}
                  compact
                  direction="up"
                  className="w-full [&>button]:w-full"
                />
              </div>
            )}
          </div>
        )}

        {/* instability banner */}
        {!stability.isStable && firstUntwistIssue && (
          <div className="hud absolute right-2.5 top-14 z-20 max-w-[300px] space-y-1.5 border-rose-400/30 p-2.5 text-xs text-rose-100">
            <div className="font-semibold text-rose-200">{firstUntwistIssue.title}</div>
            <p className="text-[11px] leading-snug text-rose-100/80">{firstUntwistIssue.whatHappensWhenReleased}</p>
            {onApplyAutoFix && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  onClick={() => {
                    onApplyAutoFix(firstUntwistIssue.fix);
                    setReleasedHands(false);
                  }}
                  className="btn btn-success btn-xs"
                >
                  {firstUntwistIssue.fixLabel}
                </button>
                <button onClick={() => setReleasedHands((r) => !r)} className="btn btn-ghost btn-xs">
                  {releasedHands ? "Hold again" : "Watch it unravel"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* bottom dock */}
        <div className="hud absolute bottom-2.5 left-2.5 right-2.5 z-20 space-y-2 p-2.5 text-xs">
          {!hasBubbles && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-slate-300">
                <span className="font-semibold text-white">Blank balloon.</span> Pick a twist from the palette
                to make the first bubble
                {selBalloon ? (
                  <>
                    {" "}on <span className="font-semibold" style={{ color: selBalloon.color }}>{selBalloon.name}</span>
                  </>
                ) : null}
                .
              </div>
              {balloons.length > 1 && onSetActiveBalloon && (
                <select
                  value={selBalloon?.id ?? ""}
                  onChange={(e) => onSetActiveBalloon(e.target.value)}
                  className="select"
                  title="Which balloon receives the next bubble"
                >
                  {balloons.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.size} {b.colorName})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* multi-selection bar */}
          {multi && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2 py-1.5">
              <span className="font-semibold text-cyan-100">
                {multiSelection.length} selected · {sortedSel.map((i) => `#${i + 1}`).join(" ")}
              </span>
              {onTwistTogether && (
                <button onClick={() => onTwistTogether(sortedSel)} className="btn btn-primary btn-xs">
                  <Link2 className="h-3.5 w-3.5" /> {twistTogetherLabel}
                </button>
              )}
              {onEqualizeLengths && (
                <button onClick={() => onEqualizeLengths(sortedSel)} className="btn btn-secondary btn-xs" title="Give all selected bubbles the same length">
                  <Equal className="h-3.5 w-3.5" /> Equalize
                </button>
              )}
              {onReleaseTwists && (
                <button onClick={() => onReleaseTwists(sortedSel)} className="btn btn-secondary btn-xs" title="Back to plain basic twists">
                  <Unlink className="h-3.5 w-3.5" /> Unlock
                </button>
              )}
              {onDeleteBubble && (
                <button onClick={() => onDeleteBubble(safeIdx)} className="btn btn-danger btn-xs">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              )}
              <button onClick={onClearSelection} className="btn btn-ghost btn-icon ml-auto h-6 w-6" title="Clear selection (Esc)">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* selected bubble row */}
          {selBubble && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setHudOpen((o) => !o)}
                className="btn btn-ghost btn-xs"
                title={hudOpen ? "Collapse sliders" : "Expand sliders"}
              >
                {hudOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                <span className="font-mono">#{safeIdx + 1}</span>
              </button>
              <button onClick={() => onSelectBubble?.(Math.max(0, safeIdx - 1))} disabled={safeIdx === 0} className="btn btn-ghost btn-icon h-7 w-7" title="Previous bubble">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                type="text"
                value={selBubble.label}
                onChange={(e) => onUpdateBubble?.(safeIdx, { label: e.target.value })}
                className="input input-sm w-32 sm:w-40"
              />
              <button onClick={() => onSelectBubble?.(Math.min(bubbles.length - 1, safeIdx + 1))} disabled={safeIdx >= bubbles.length - 1} className="btn btn-ghost btn-icon h-7 w-7" title="Next bubble">
                <ChevronRight className="h-4 w-4" />
              </button>

              <select
                value={selBubble.twistType}
                onChange={(e) => {
                  const t = e.target.value as TwistType;
                  onUpdateBubble?.(safeIdx, { twistType: t, ...twistFlags(t) });
                }}
                className="select border-amber-400/40 text-amber-200"
                title="Twist formation"
              >
                {Object.values(TWIST_ENCYCLOPEDIA).map((tw) => (
                  <option key={tw.type} value={tw.type} className="bg-slate-900 text-white">
                    {tw.name}
                  </option>
                ))}
              </select>

              {onSplitBubble && <SplitMenu bubble={selBubble} onSplit={(m) => onSplitBubble(safeIdx, m)} compact />}

              {selLayout?.partnerIndex !== undefined && (
                <button
                  onClick={() => setPairSync((s) => !s)}
                  className={`btn btn-xs ${pairSync ? "btn-active" : "btn-secondary"}`}
                  title="Keep paired lock bubbles equal while resizing"
                >
                  <Link2 className="h-3.5 w-3.5" /> Pair {pairSync ? "on" : "off"}
                </button>
              )}

              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => onAddTwistPreset?.("basic", safeIdx)} className="btn btn-success btn-xs" title="Insert a bubble right after this one">
                  <Plus className="h-3.5 w-3.5" /> Bubble
                </button>
                <button onClick={() => onDuplicateBubble?.(safeIdx)} className="btn btn-secondary btn-icon h-7 w-7" title="Duplicate">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => onDeleteBubble?.(safeIdx)} className="btn btn-danger btn-icon h-7 w-7" title="Delete (Del)">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {hudOpen && selBubble && (
            <div className="grid grid-cols-1 items-center gap-x-3 gap-y-1.5 border-t border-slate-800/80 pt-2 sm:grid-cols-4">
              <SliderRow
                label="Length"
                value={`${selBubble.lengthInches}″ · ${inchesToFingers(selBubble.lengthInches)}f`}
                min={0.5}
                max={24}
                step={0.25}
                current={selBubble.lengthInches}
                onChange={(v) => onUpdateBubble?.(safeIdx, { lengthInches: v }, pairSync)}
                accent="cyan"
              />
              <SliderRow
                label="Bend"
                value={`${selBubble.bend ?? 0}°`}
                min={-160}
                max={160}
                step={5}
                current={selBubble.bend ?? 0}
                onChange={(v) => onUpdateBubble?.(safeIdx, { bend: v })}
              />
              <SliderRow
                label="Turn"
                value={`${selBubble.turn ?? 0}°`}
                min={-160}
                max={160}
                step={5}
                current={selBubble.turn ?? 0}
                onChange={(v) => onUpdateBubble?.(safeIdx, { turn: v })}
              />
              <div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Gauge</span>
                  <span className="font-mono text-slate-300">{selBubble.diameterInches}″</span>
                </div>
                <div className="seg mt-0.5 w-full">
                  {([["160", 1.0], ["260", 2.0], ["360", 3.0]] as Array<[string, number]>).map(([label, d]) => (
                    <button
                      key={label}
                      onClick={() => onUpdateBubble?.(safeIdx, { diameterInches: d }, pairSync)}
                      className={`seg-item flex-1 font-mono ${Math.abs((selBubble.diameterInches || 2) - d) < 0.35 ? "seg-item-active" : ""}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* air gauges + balloon color + step switcher */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-800/80 pt-2">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1">
              {balloons.map((bal) => {
                const air = airByBalloon.get(bal.id);
                if (!air || !vis.introducedBalloons.has(bal.id)) return null;
                return (
                  <button
                    key={bal.id}
                    onClick={() => onSetActiveBalloon?.(bal.id)}
                    className={`rounded-md px-1 py-0.5 text-left transition hover:bg-slate-800/60 ${
                      selBalloon?.id === bal.id ? "bg-slate-800/40" : ""
                    }`}
                    title={`${bal.name}: ${air.statusMessage}`}
                  >
                    <AirBudgetBar air={air} color={bal.color} compact />
                  </button>
                );
              })}
            </div>

            {selBalloon && onUpdateBalloon && (
              <ColorPicker
                size="sm"
                value={selBalloon.color}
                valueName={selBalloon.colorName}
                label={`${selBalloon.size} ${selBalloon.colorName}`}
                onChange={(hex, name) => onUpdateBalloon(selBalloon.id, { color: hex, colorName: name })}
              />
            )}

            {onSelectStep && onBuildModeChange && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onBuildModeChange(buildMode === "step" ? "final" : "step")}
                  className={`btn btn-xs ${buildMode === "final" ? "btn-success" : "btn-primary"}`}
                  title="Toggle between the step-by-step build and the finished shape"
                >
                  {buildMode === "final"
                    ? `Final · ${bubbles.length} bubbles`
                    : `Step ${currentStepIndex + 1}/${steps.length} · ${formedCount}/${bubbles.length}`}
                </button>
                <button
                  onClick={() => {
                    onBuildModeChange("step");
                    onSelectStep(Math.max(0, currentStepIndex - 1));
                  }}
                  disabled={currentStepIndex <= 0}
                  className="btn btn-ghost btn-icon h-7 w-7"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    onBuildModeChange("step");
                    onSelectStep(Math.min(steps.length - 1, currentStepIndex + 1));
                  }}
                  disabled={currentStepIndex >= steps.length - 1}
                  className="btn btn-ghost btn-icon h-7 w-7"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

ThreeBalloonViewer.displayName = "ThreeBalloonViewer";

const SliderRow: React.FC<{
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  current: number;
  onChange: (v: number) => void;
  accent?: "cyan" | "amber";
}> = ({ label, value, min, max, step, current, onChange, accent = "amber" }) => (
  <div>
    <div className="flex justify-between text-[11px] text-slate-400">
      <span>{label}</span>
      <span className={`font-mono ${accent === "cyan" ? "text-cyan-200" : "text-amber-200"}`}>{value}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={current}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className={`range ${accent === "cyan" ? "accent-cyan-400" : ""}`}
    />
  </div>
);

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface CameraControlsProps {
  onBackgroundClick?: () => void;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  idleDelay?: number;
  minRadius?: number;
  maxRadius?: number;
}

interface SphericalState { theta: number; phi: number; radius: number; }

interface CameraDragState {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  mode: 'orbit' | 'pan';
  moved: boolean;
}

const DRAG_THRESHOLD_PX = 3;

/**
 * Camera controller. Only the camera owns camera drag state.
 *
 * Ligands block camera drag by calling stopPropagation() on their R3F
 * pointerdown handlers, so the background plane never sees the event.
 * There is no shared "dragging" ref — that caused race conditions.
 */
export function CameraControls({
  onBackgroundClick,
  autoRotate = true,
  autoRotateSpeed = 0.15,
  idleDelay = 2.5,
  minRadius = 25,
  maxRadius = 260,
}: CameraControlsProps) {
  const { camera, gl } = useThree();

  const target = useRef<SphericalState>({
    theta: Math.PI / 2, phi: Math.PI / 2, radius: 90,
  });
  const current = useRef<SphericalState>({
    theta: Math.PI / 2, phi: Math.PI / 2, radius: 90,
  });

  const lookAt = useRef(new THREE.Vector3(0, 0, 0));
  const lookAtTarget = useRef(new THREE.Vector3(0, 0, 0));

  const cameraDrag = useRef<CameraDragState | null>(null);
  const lastDragMoved = useRef(false);
  const lastInteraction = useRef(performance.now());

  // Wheel + context menu on the canvas
  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = target.current;
      const factor = Math.exp(e.deltaY * 0.0012);
      s.radius = Math.max(minRadius, Math.min(maxRadius, s.radius * factor));
      lastInteraction.current = performance.now();
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', onContextMenu);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }, [gl, minRadius, maxRadius]);

  // Window-level move/up during a camera drag
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const cd = cameraDrag.current;
      if (!cd) return;

      const dx = e.clientX - cd.lastX;
      const dy = e.clientY - cd.lastY;
      cd.lastX = e.clientX;
      cd.lastY = e.clientY;

      if (!cd.moved) {
        const totalX = Math.abs(e.clientX - cd.startX);
        const totalY = Math.abs(e.clientY - cd.startY);
        if (totalX + totalY < DRAG_THRESHOLD_PX) return;
        cd.moved = true;
      }

      lastInteraction.current = performance.now();

      if (cd.mode === 'orbit') {
        const s = target.current;
        s.theta -= dx * 0.0055;   // mouse right -> scene spins right
        s.phi   -= dy * 0.0055;   // mouse down  -> see top of object
        const eps = 0.02;
        s.phi = Math.max(eps, Math.min(Math.PI - eps, s.phi));
      } else {
        const s = target.current;
        const radius = s.radius;
        const camPos = new THREE.Vector3(
          lookAtTarget.current.x + radius * Math.sin(s.phi) * Math.cos(s.theta),
          lookAtTarget.current.y + radius * Math.cos(s.phi),
          lookAtTarget.current.z + radius * Math.sin(s.phi) * Math.sin(s.theta)
        );
        const forward = new THREE.Vector3()
          .subVectors(lookAtTarget.current, camPos).normalize();
        const worldUp = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
        const up = new THREE.Vector3().crossVectors(right, forward).normalize();
        const scale = radius * 0.0016;
        lookAtTarget.current.addScaledVector(right, -dx * scale);
        lookAtTarget.current.addScaledVector(up, dy * scale);
      }
    };

    const onUp = () => {
      const cd = cameraDrag.current;
      lastDragMoved.current = cd?.moved ?? false;
      cameraDrag.current = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // The background plane receives pointerdown on empty space.
  const handlePlanePointerDown = (e: any) => {
    const mode: 'orbit' | 'pan' =
      e.button === 1 || e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey
        ? 'pan' : 'orbit';
    cameraDrag.current = {
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      mode,
      moved: false,
    };
    lastInteraction.current = performance.now();
  };

  const handlePlaneClick = () => {
    if (lastDragMoved.current) return;
    onBackgroundClick?.();
  };

  useFrame((_, delta) => {
    const t = target.current;
    const c = current.current;

    if (autoRotate && !cameraDrag.current) {
      const idleMs = performance.now() - lastInteraction.current;
      if (idleMs > idleDelay * 1000) {
        t.theta += delta * autoRotateSpeed;
      }
    }

    const k = 1 - Math.pow(0.0008, Math.min(delta, 0.1));
    c.theta += (t.theta - c.theta) * k;
    c.phi += (t.phi - c.phi) * k;
    c.radius += (t.radius - c.radius) * k;
    lookAt.current.lerp(lookAtTarget.current, k);

    const x = lookAt.current.x + c.radius * Math.sin(c.phi) * Math.cos(c.theta);
    const y = lookAt.current.y + c.radius * Math.cos(c.phi);
    const z = lookAt.current.z + c.radius * Math.sin(c.phi) * Math.sin(c.theta);

    camera.position.set(x, y, z);
    camera.lookAt(lookAt.current);
  });

  // Raycast target: a large box surrounding the whole scene.
  //
  // Why a box and not a plane: a plane becomes edge-on (or ends up behind
  // the camera) whenever the camera orbits to look along that plane's
  // normal axis. When that happens, the ray from the camera through the
  // pointer misses the plane and camera drag dies silently.
  //
  // The box surrounds the camera from every angle. A ray from inside the
  // box always hits exactly one of the six inner faces. BackSide renders
  // only the inner surface, which is the one we want to raycast.
  return (
    <mesh
      position={[0, 0, 0]}
      onPointerDown={handlePlanePointerDown}
      onClick={handlePlaneClick}
    >
      <boxGeometry args={[2000, 2000, 2000]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
        side={THREE.BackSide}
      />
    </mesh>
  );
}

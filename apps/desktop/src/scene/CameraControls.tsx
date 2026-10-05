import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface CameraControlsProps {
  draggingRef: MutableRefObject<boolean>;
  onBackgroundClick?: () => void;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  idleDelay?: number;
  minRadius?: number;
  maxRadius?: number;
}

interface SphericalState {
  theta: number;
  phi: number;
  radius: number;
}

interface CameraDragState {
  x: number;
  y: number;
  mode: 'orbit' | 'pan';
  moved: boolean;
}

const DRAG_THRESHOLD_PX = 4;

export function CameraControls({
  draggingRef,
  onBackgroundClick,
  autoRotate = true,
  autoRotateSpeed = 0.15,
  idleDelay = 2.5,
  minRadius = 25,
  maxRadius = 260,
}: CameraControlsProps) {
  const { camera, gl } = useThree();

  const spherical = useRef<SphericalState>({
    theta: Math.PI / 2,
    phi: Math.PI / 2,
    radius: 90,
  });
  const target = useRef(new THREE.Vector3(0, 0, 0));

  const cameraDrag = useRef<CameraDragState | null>(null);
  const lastCameraDragMoved = useRef(false);
  const lastInteraction = useRef(performance.now());

  // Wheel zoom and context menu — native listeners on the canvas.
  // These do not conflict with mesh events.
  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = spherical.current;
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

  // Move / up during a camera drag — window listeners.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const cd = cameraDrag.current;
      if (!cd) return;

      const dx = e.clientX - cd.x;
      const dy = e.clientY - cd.y;
      cd.x = e.clientX;
      cd.y = e.clientY;

      if (!cd.moved) {
        if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD_PX) return;
        cd.moved = true;
      }

      lastInteraction.current = performance.now();

      if (cd.mode === 'orbit') {
        const s = spherical.current;
        s.theta -= dx * 0.006;
        s.phi -= dy * 0.006;
        const eps = 0.01;
        s.phi = Math.max(eps, Math.min(Math.PI - eps, s.phi));
      } else {
        const s = spherical.current;
        const radius = s.radius;
        const camPos = new THREE.Vector3(
          target.current.x + radius * Math.sin(s.phi) * Math.cos(s.theta),
          target.current.y + radius * Math.cos(s.phi),
          target.current.z + radius * Math.sin(s.phi) * Math.sin(s.theta)
        );
        const forward = new THREE.Vector3()
          .subVectors(target.current, camPos)
          .normalize();
        const worldUp = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
        const up = new THREE.Vector3().crossVectors(right, forward).normalize();
        const scale = radius * 0.0016;
        target.current.addScaledVector(right, -dx * scale);
        target.current.addScaledVector(up, dy * scale);
      }
    };

    const onUp = () => {
      const cd = cameraDrag.current;
      lastCameraDragMoved.current = cd?.moved ?? false;
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

  // R3F event handler for the background plane.
  // R3F only fires this when no other mesh stopped propagation first.
  const handlePlanePointerDown = useCallback(
    (e: any) => {
      // Belt-and-braces: if a mesh somehow already claimed the gesture,
      // do not start a camera drag.
      if (draggingRef.current) return;

      const mode: 'orbit' | 'pan' =
        e.button === 1 || e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey
          ? 'pan'
          : 'orbit';

      cameraDrag.current = {
        x: e.clientX,
        y: e.clientY,
        mode,
        moved: false,
      };
      lastInteraction.current = performance.now();
    },
    [draggingRef]
  );

  const handlePlaneClick = useCallback(() => {
    if (lastCameraDragMoved.current) return;
    onBackgroundClick?.();
  }, [onBackgroundClick]);

  useFrame((_, delta) => {
    const s = spherical.current;
    const t = target.current;

    if (autoRotate && !cameraDrag.current && !draggingRef.current) {
      const idleMs = performance.now() - lastInteraction.current;
      if (idleMs > idleDelay * 1000) {
        s.theta += delta * autoRotateSpeed;
      }
    }

    const x = t.x + s.radius * Math.sin(s.phi) * Math.cos(s.theta);
    const y = t.y + s.radius * Math.cos(s.phi);
    const z = t.z + s.radius * Math.sin(s.phi) * Math.sin(s.theta);

    camera.position.set(x, y, z);
    camera.lookAt(t);
  });

  // The background plane. Always behind the scene. Invisible but raycastable.
  // R3F's raycaster uses distance sorting and stopPropagation, so this plane
  // only receives pointerdown when the user clicked empty space.
  return (
    <mesh
      position={[0, 0, -900]}
      onPointerDown={handlePlanePointerDown}
      onClick={handlePlaneClick}
    >
      <planeGeometry args={[200000, 200000]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
        depthTest={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

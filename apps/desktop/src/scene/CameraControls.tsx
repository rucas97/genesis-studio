import { useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface CameraControlsProps {
  /** Set true while the user is dragging. */
  draggingRef: MutableRefObject<boolean>;
  /** Slow auto-rotation when the user has been idle. */
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  /** Seconds of idle time before auto-rotation resumes. */
  idleDelay?: number;
  minRadius?: number;
  maxRadius?: number;
}

interface SphericalState {
  theta: number;
  phi: number;
  radius: number;
}

const DRAG_THRESHOLD_PX = 4;

export function CameraControls({
  draggingRef,
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

  const pointerDown = useRef<{
    x: number;
    y: number;
    mode: 'orbit' | 'pan';
    moved: boolean;
  } | null>(null);
  const lastInteraction = useRef(performance.now());

  useEffect(() => {
    const el = gl.domElement;

    const getDragMode = (e: PointerEvent): 'orbit' | 'pan' => {
      if (e.button === 1 || e.button === 2) return 'pan';
      if (e.shiftKey || e.ctrlKey || e.metaKey) return 'pan';
      return 'orbit';
    };

    const onPointerDown = (e: PointerEvent) => {
      // Ignore if the pointer is over a UI element (overlay buttons etc.)
      // The canvas is the only target we care about.
      if (e.target !== el) return;
      e.preventDefault();
      const mode = getDragMode(e);
      pointerDown.current = {
        x: e.clientX,
        y: e.clientY,
        mode,
        moved: false,
      };
      draggingRef.current = false;
      lastInteraction.current = performance.now();
    };

    const onPointerMove = (e: PointerEvent) => {
      const pd = pointerDown.current;
      if (!pd) return;

      const dx = e.clientX - pd.x;
      const dy = e.clientY - pd.y;
      pd.x = e.clientX;
      pd.y = e.clientY;

      if (!pd.moved) {
        const totalDx = Math.abs(dx);
        const totalDy = Math.abs(dy);
        if (totalDx + totalDy < DRAG_THRESHOLD_PX) return;
        pd.moved = true;
        draggingRef.current = true;
      }

      lastInteraction.current = performance.now();

      if (pd.mode === 'orbit') {
        const s = spherical.current;
        s.theta -= dx * 0.006;
        s.phi -= dy * 0.006;
        // Clamp phi to avoid gimbal flip at poles.
        const eps = 0.01;
        s.phi = Math.max(eps, Math.min(Math.PI - eps, s.phi));
      } else {
        // Pan: move the target in the camera's local plane.
        const s = spherical.current;
        const radius = s.radius;

        // Camera basis in world space.
        const camPos = new THREE.Vector3(
          target.current.x + radius * Math.sin(s.phi) * Math.cos(s.theta),
          target.current.y + radius * Math.cos(s.phi),
          target.current.z + radius * Math.sin(s.phi) * Math.sin(s.theta)
        );
        const forward = new THREE.Vector3()
          .subVectors(target.current, camPos)
          .normalize();
        const worldUp = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3()
          .crossVectors(forward, worldUp)
          .normalize();
        const up = new THREE.Vector3().crossVectors(right, forward).normalize();

        // Scale so panning feels consistent regardless of zoom.
        const scale = radius * 0.0016;
        target.current.addScaledVector(right, -dx * scale);
        target.current.addScaledVector(up, dy * scale);
      }
    };

    const onPointerUp = () => {
      pointerDown.current = null;
      // The click handler on the mesh checks draggingRef; clear it on the
      // next tick so the click event sees the correct value.
      setTimeout(() => {
        draggingRef.current = false;
      }, 0);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = spherical.current;
      const factor = Math.exp(e.deltaY * 0.0012);
      s.radius = Math.max(minRadius, Math.min(maxRadius, s.radius * factor));
      lastInteraction.current = performance.now();
    };

    const onContextMenu = (e: MouseEvent) => {
      // Right-click is used for pan; suppress the browser menu on canvas.
      e.preventDefault();
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', onContextMenu);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }, [gl, draggingRef, minRadius, maxRadius]);

  useFrame((_, delta) => {
    const s = spherical.current;
    const t = target.current;

    // Auto-rotate when idle.
    if (autoRotate && !pointerDown.current) {
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

  return null;
}

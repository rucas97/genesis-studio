import { useCallback, useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  ELEMENT_COLORS, ELEMENT_RADII, type LigandEntry,
} from '../data/ligandLibrary';

export interface LigandMeshProps {
  instanceId: string;
  ligand: LigandEntry;
  position: [number, number, number];
  onPositionChange: (instanceId: string, p: [number, number, number]) => void;
  onDragStart?: (instanceId: string) => void;
  onDragEnd?: (instanceId: string, p: [number, number, number]) => void;
  onAtomClick?: (instanceId: string, atomIndex: number) => void;
  highlightedAtom?: number | null;
  draggable?: boolean;
}

export function LigandMesh({
  instanceId,
  ligand,
  position,
  onPositionChange,
  onDragStart,
  onDragEnd,
  onAtomClick,
  highlightedAtom,
  draggable = true,
}: LigandMeshProps) {
  const { camera, gl } = useThree();
  const draggingRef = useRef(false);
  const offsetRef = useRef(new THREE.Vector3());
  const planeRef = useRef(new THREE.Plane());
  const positionRef = useRef(position);
  positionRef.current = position;

  const [hovered, setHovered] = useState(false);

  const handlePointerDown = useCallback(
    (e: any) => {
      if (!draggable) return;
      e.stopPropagation();
      draggingRef.current = true;
      onDragStart?.(instanceId);

      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      planeRef.current.setFromNormalAndCoplanarPoint(
        camDir,
        new THREE.Vector3(...positionRef.current)
      );

      const rect = gl.domElement.getBoundingClientRect();
      const nx = ((e.nativeEvent.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.nativeEvent.clientY - rect.top) / rect.height) * 2 - 1);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(planeRef.current, hit)) {
        offsetRef.current.copy(hit).sub(new THREE.Vector3(...positionRef.current));
      } else {
        offsetRef.current.set(0, 0, 0);
      }
    },
    [camera, gl, draggable, instanceId, onDragStart]
  );

  useEffect(() => {
    if (!draggable) return;
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const rect = gl.domElement.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(planeRef.current, hit)) {
        hit.sub(offsetRef.current);
        onPositionChange(instanceId, [hit.x, hit.y, hit.z]);
      }
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      onDragEnd?.(instanceId, positionRef.current);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [camera, gl, draggable, instanceId, onPositionChange, onDragEnd]);

  const bonds = ligand.bonds.map((bond, i) => {
    const a = ligand.atoms[bond.a];
    const b = ligand.atoms[bond.b];
    const va = new THREE.Vector3(a.x, a.y, a.z);
    const vb = new THREE.Vector3(b.x, b.y, b.z);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    const dir = vb.clone().sub(va);
    const length = dir.length();
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize()
    );
    return { mid, length, quat, key: `bond-${i}` };
  });

  return (
    <group
      position={position}
      onPointerOver={(e) => {
        if (!draggable) return;
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'grab';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = '';
      }}
    >
      {bonds.map((b) => (
        <mesh
          key={b.key}
          position={b.mid.toArray()}
          quaternion={b.quat}
          onPointerDown={handlePointerDown}
        >
          <cylinderGeometry args={[0.16, 0.16, b.length, 10]} />
          <meshStandardMaterial
            color={0xaab8c8}
            roughness={0.35}
            metalness={0.5}
            emissive={hovered ? 0x4488bb : 0x000000}
            emissiveIntensity={hovered ? 0.2 : 0}
          />
        </mesh>
      ))}

      {ligand.atoms.map((a, i) => {
        const color = ELEMENT_COLORS[a.element];
        const radius = ELEMENT_RADII[a.element];
        const isHighlighted = highlightedAtom === i;
        return (
          <mesh
            key={`atom-${i}`}
            position={[a.x, a.y, a.z]}
            onPointerDown={handlePointerDown}
            onClick={(e) => {
              if (draggingRef.current) return;
              e.stopPropagation();
              onAtomClick?.(instanceId, i);
            }}
          >
            <sphereGeometry args={[isHighlighted ? radius * 1.7 : radius, 22, 22]} />
            <meshStandardMaterial
              color={color}
              roughness={0.28}
              metalness={0.35}
              emissive={isHighlighted ? 0x66ccff : hovered ? color : 0x000000}
              emissiveIntensity={isHighlighted ? 0.85 : hovered ? 0.3 : 0}
            />
          </mesh>
        );
      })}
    </group>
  );
}

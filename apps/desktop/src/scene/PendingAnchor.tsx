import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface PendingAnchorProps {
  position: [number, number, number];
  color?: number;
  showLine?: boolean;
}

export function PendingAnchor({
  position, color = 0x66ccff, showLine = true,
}: PendingAnchorProps) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.scale.setScalar(1 + Math.sin(t * 5) * 0.15);
  });

  return (
    <>
      <mesh ref={ref} position={position} raycast={() => null}>
        <sphereGeometry args={[1.6, 20, 20]} />
        <meshBasicMaterial
          color={color} transparent opacity={0.5} depthTest={false}
        />
      </mesh>
      <mesh position={position} raycast={() => null}>
        <ringGeometry args={[1.5, 2.0, 40]} />
        <meshBasicMaterial
          color={color} transparent opacity={0.95}
          side={THREE.DoubleSide} depthTest={false}
        />
      </mesh>
      {showLine && <PendingLine from={position} color={color} />}
    </>
  );
}

function PendingLine({
  from, color,
}: { from: [number, number, number]; color: number }) {
  const { camera, gl } = useThree();
  const [cursor, setCursor] = useState<[number, number, number]>([
    from[0] + 20, from[1], from[2],
  ]);
  const planeRef = useRef(new THREE.Plane());

  useEffect(() => {
    const el = gl.domElement;
    const fromVec = new THREE.Vector3(from[0], from[1], from[2]);

    const onMove = (e: PointerEvent) => {
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      planeRef.current.setFromNormalAndCoplanarPoint(camDir, fromVec);

      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(planeRef.current, hit)) {
        setCursor([hit.x, hit.y, hit.z]);
      }
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [camera, gl, from[0], from[1], from[2]]);

  const obj = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from[0], from[1], from[2]),
      new THREE.Vector3(cursor[0], cursor[1], cursor[2]),
    ]);
    const m = new THREE.LineDashedMaterial({
      color, dashSize: 0.9, gapSize: 0.5,
      transparent: true, opacity: 0.85, depthTest: false,
    });
    const l = new THREE.Line(g, m);
    l.computeLineDistances();
    l.raycast = () => null;
    return l;
  }, [from[0], from[1], from[2], cursor[0], cursor[1], cursor[2], color]);

  return <primitive object={obj} />;
}

"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, PerformanceMonitor } from "@react-three/drei";
import { Box3, Group, MathUtils, Mesh, Vector3 } from "three";
import type { Object3D } from "three";
import { useGLTF } from "@react-three/drei";

export type OpeningPhase = "idle" | "spinning" | "opening" | "bursting" | "done";

class ModelErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Black Market crate model failed to load:", error);
    this.props.onError();
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

function CrateModel({
  url,
  phase,
  onLoaded,
}: {
  url: string;
  phase: OpeningPhase;
  onLoaded: () => void;
}) {
  const { scene } = useGLTF(url);
  const root = useRef<Group>(null);
  const lid = useRef<Object3D | null>(null);
  const lidStart = useRef(0);
  const { model, center, scale } = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.geometry = node.geometry.clone();
      node.material = Array.isArray(node.material)
        ? node.material.map((material) => material.clone())
        : node.material.clone();
      node.castShadow = true;
      node.receiveShadow = true;
    });
    const bounds = new Box3().setFromObject(clone);
    const dimensions = bounds.getSize(new Vector3());
    const maxDimension = Math.max(dimensions.x, dimensions.y, dimensions.z, 0.001);
    return {
      model: clone,
      center: bounds.getCenter(new Vector3()),
      scale: 2.4 / maxDimension,
    };
  }, [scene]);

  useEffect(() => {
    const foundLid = model.getObjectByName("lid") ??
      model.children.find((child) => child.name.toLowerCase() === "lid") ??
      model.getObjectByName("Lid");
    lid.current = foundLid ?? null;
    lidStart.current = foundLid?.rotation.x ?? 0;
    onLoaded();
    return () => {
      model.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        node.geometry.dispose();
        if (Array.isArray(node.material)) {
          node.material.forEach((material) => material.dispose());
        } else {
          node.material.dispose();
        }
      });
    };
  }, [model, onLoaded]);

  useFrame((state, delta) => {
    if (!root.current) return;
    const opening = phase === "opening" || phase === "bursting" || phase === "done";
    if (phase === "spinning") {
      root.current.rotation.y += delta * 4.2;
    } else {
      root.current.rotation.y = MathUtils.damp(root.current.rotation.y, 0, 3, delta);
    }

    if (lid.current) {
      lid.current.rotation.x = MathUtils.damp(
        lid.current.rotation.x,
        lidStart.current + (opening ? -1.35 : 0),
        5,
        delta,
      );
    } else {
      const bounce = opening ? Math.sin(state.clock.elapsedTime * 10) * 0.06 : 0;
      const target = scale * (1 + bounce);
      root.current.scale.setScalar(MathUtils.damp(root.current.scale.x, target, 8, delta));
    }
  });

  const position = center.clone().multiplyScalar(-scale);
  return (
    <group ref={root} position={[position.x, position.y, position.z]} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

function BurstParticles({ phase }: { phase: OpeningPhase }) {
  const particles = useRef<Group>(null);
  const burstStartedAt = useRef<number | null>(null);
  const directions = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => {
        const angle = index * Math.PI * (3 - Math.sqrt(5));
        const height = 1 - (index / 17) * 2;
        const radius = Math.sqrt(1 - height * height);
        return new Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      }),
    [],
  );

  useFrame((state, delta) => {
    if (!particles.current) return;
    const active = phase === "bursting" || phase === "done";
    particles.current.visible = active;
    if (!active) return;
    const startedAt =
      burstStartedAt.current ?? (burstStartedAt.current = state.clock.elapsedTime);
    particles.current.children.forEach((particle, index) => {
      const direction = directions[index];
      const elapsed = Math.min(1, state.clock.elapsedTime - startedAt);
      const distance = Math.min(2.2, elapsed * 1.8);
      particle.position.copy(direction).multiplyScalar(distance);
      particle.scale.setScalar(Math.max(0.01, 1 - distance / 2.5));
      particle.rotation.y += delta * 2;
    });
  });

  return (
    <group ref={particles} visible={false}>
      {directions.map((_, index) => (
        <mesh key={index}>
          <icosahedronGeometry args={[0.12, 0]} />
          <meshStandardMaterial
            color={index % 2 === 0 ? "#f5c451" : "#c4a1ff"}
            emissive={index % 2 === 0 ? "#8c5200" : "#542398"}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

function CrateScene({
  url,
  phase,
  onModelLoaded,
  onLowPerformance,
}: {
  url: string;
  phase: OpeningPhase;
  onModelLoaded: () => void;
  onLowPerformance: () => void;
}) {
  return (
    <>
      <color attach="background" args={["#09090b"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={2} castShadow />
      <pointLight position={[-3, 1, 2]} intensity={24} color="#8b5cf6" distance={12} />
      <PerformanceMonitor
        bounds={(refreshRate) => [30, refreshRate]}
        onDecline={({ fps }) => {
          if (fps < 30) onLowPerformance();
        }}
      />
      <Suspense
        fallback={
          <mesh>
            <boxGeometry args={[1.8, 1.4, 1.3]} />
            <meshStandardMaterial color="#6d28d9" wireframe />
          </mesh>
        }
      >
        <Environment preset="studio" />
        <CrateModel url={url} phase={phase} onLoaded={onModelLoaded} />
      </Suspense>
      <BurstParticles phase={phase} />
    </>
  );
}

export default function CrateCanvas({
  url,
  phase,
  onModelLoaded,
  onModelError,
}: {
  url: string;
  phase: OpeningPhase;
  onModelLoaded: () => void;
  onModelError: () => void;
}) {
  const [lowPerformance, setLowPerformance] = useState(false);

  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 45 }}
      dpr={[1, 2]}
      shadows={!lowPerformance}
      gl={{ antialias: false, powerPreference: "low-power" }}
    >
      <ModelErrorBoundary onError={onModelError}>
        <CrateScene
          url={url}
          phase={phase}
          onModelLoaded={onModelLoaded}
          onLowPerformance={() => setLowPerformance(true)}
        />
      </ModelErrorBoundary>
    </Canvas>
  );
}

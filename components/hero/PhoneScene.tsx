"use client";
// WebGL tier of the exploded-phone hero (React Three Fiber + drei).
// DECISION: the phone is built procedurally from primitives (an original,
// brand-neutral design) until the Draco-compressed GLB from §4.3 is modelled;
// swap `PhoneModel` for a useGLTF() loader with one mesh per layer — the
// explode/label/scroll wiring below stays the same.
import { useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Html, PresentationControls, RoundedBox, useVideoTexture } from "@react-three/drei";
import * as THREE from "three";
import { LAYERS, type LayerCounts } from "./layers";

const W = 1.5, H = 3.1;

function frameShape() {
  const r = 0.22, t = 0.07;
  const rr = (s: THREE.Shape | THREE.Path, x: number, y: number, w: number, h: number, rad: number) => {
    s.moveTo(x + rad, y);
    s.lineTo(x + w - rad, y); s.quadraticCurveTo(x + w, y, x + w, y + rad);
    s.lineTo(x + w, y + h - rad); s.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    s.lineTo(x + rad, y + h); s.quadraticCurveTo(x, y + h, x, y + h - rad);
    s.lineTo(x, y + rad); s.quadraticCurveTo(x, y, x + rad, y);
  };
  const shape = new THREE.Shape();
  rr(shape, -W / 2, -H / 2, W, H, r);
  const hole = new THREE.Path();
  rr(hole, -W / 2 + t, -H / 2 + t, W - 2 * t, H - 2 * t, r - t);
  shape.holes.push(hole);
  return shape;
}

function ScreenVideo({ src }: { src: string }) {
  const tex = useVideoTexture(src, { muted: true, loop: true, start: true, playsInline: true, crossOrigin: "anonymous" });
  return (
    <mesh position={[0, 0, 0.026]}>
      <planeGeometry args={[W - 0.12, H - 0.12]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

function Label({ text, href, side }: { text: string; href: string; side: 1 | -1 }) {
  return (
    <Html position={[side * (W / 2 + 0.15), 0, 0]} center={false} zIndexRange={[20, 0]} style={{ pointerEvents: "auto" }}>
      <a
        href={href}
        className="whitespace-nowrap rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-ink-2 backdrop-blur hover:border-accent hover:text-ink"
        style={{ background: "color-mix(in srgb, var(--surface-1) 75%, transparent)", transform: side < 0 ? "translateX(-100%)" : undefined, display: "inline-block" }}
      >
        {text}
      </a>
    </Html>
  );
}

function PhoneModel({ explode, counts, videoSrc, showLabels }: { explode: MutableRefObject<number>; counts: LayerCounts; videoSrc?: string; showLabels: boolean }) {
  const group = useRef<THREE.Group>(null);
  const layers = useRef<(THREE.Group | null)[]>([]);
  const shape = useMemo(frameShape, []);
  const smooth = useRef(0);
  const accent = typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#22D3EE" : "#22D3EE";

  useFrame((state, dt) => {
    smooth.current = THREE.MathUtils.damp(smooth.current, explode.current, 4, dt);
    LAYERS.forEach((l, i) => {
      const g = layers.current[i];
      if (g) g.position.z = l.z * (0.06 + smooth.current * 0.55);
    });
    if (group.current) {
      const t = state.clock.elapsedTime;
      group.current.rotation.y = -0.65 + Math.sin(t * 0.35) * 0.18;
      group.current.rotation.x = 0.28 + Math.sin(t * 0.25) * 0.05;
      group.current.position.y = Math.sin(t * 0.6) * 0.05;
    }
  });

  return (
    <group ref={group}>
      {/* Display */}
      <group ref={(el) => { layers.current[0] = el; }}>
        <RoundedBox args={[W, H, 0.05]} radius={0.2} smoothness={4}>
          <meshPhysicalMaterial color="#05060a" roughness={0.08} metalness={0.2} clearcoat={1} clearcoatRoughness={0.05} />
        </RoundedBox>
        {videoSrc ? <ScreenVideo src={videoSrc} /> : (
          <mesh position={[0, 0, 0.026]}>
            <planeGeometry args={[W - 0.12, H - 0.12]} />
            <meshBasicMaterial color={accent} transparent opacity={0.08} />
          </mesh>
        )}
        {showLabels && <Label text={`Display · ${counts.displays ?? 30}+ fits`} href={LAYERS[0].href} side={1} />}
      </group>
      {/* Mid-frame */}
      <group ref={(el) => { layers.current[1] = el; }}>
        <mesh position={[0, 0, -0.06]}>
          <extrudeGeometry args={[shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }]} />
          <meshStandardMaterial color="#aab2bc" metalness={0.9} roughness={0.28} />
        </mesh>
        {showLabels && <Label text="Mid-frame" href={LAYERS[1].href} side={-1} />}
      </group>
      {/* Logic board */}
      <group ref={(el) => { layers.current[2] = el; }}>
        <RoundedBox args={[W - 0.22, H * 0.42, 0.03]} radius={0.06} position={[0, H * 0.24, 0]}>
          <meshStandardMaterial color="#0d3a2c" roughness={0.6} metalness={0.3} />
        </RoundedBox>
        {[[-0.3, 0.95, 0.32, 0.32], [0.2, 0.88, 0.36, 0.2], [0.25, 0.55, 0.22, 0.22], [-0.25, 0.5, 0.4, 0.14]].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, y, 0.03]}>
            <boxGeometry args={[w, h, 0.03]} />
            <meshStandardMaterial color={i === 0 ? "#1c1f26" : "#2a2f39"} metalness={0.6} roughness={0.35} />
          </mesh>
        ))}
        <mesh position={[-0.3, 0.95, 0.05]}>
          <planeGeometry args={[0.2, 0.2]} />
          <meshBasicMaterial color={accent} transparent opacity={0.35} />
        </mesh>
        {showLabels && <Label text="Logic board · repairs" href={LAYERS[2].href} side={1} />}
      </group>
      {/* Battery */}
      <group ref={(el) => { layers.current[3] = el; }}>
        <RoundedBox args={[W - 0.36, H * 0.48, 0.06]} radius={0.06} position={[0, -H * 0.2, 0]}>
          <meshStandardMaterial color="#1f232b" roughness={0.45} metalness={0.4} />
        </RoundedBox>
        <mesh position={[0, -H * 0.2, 0.032]}>
          <planeGeometry args={[W - 0.6, 0.1]} />
          <meshBasicMaterial color="#34D399" transparent opacity={0.7} />
        </mesh>
        {showLabels && <Label text={`Battery · ${counts.batteries ?? 30}+ fits`} href={LAYERS[3].href} side={-1} />}
      </group>
      {/* Back glass */}
      <group ref={(el) => { layers.current[4] = el; }}>
        <RoundedBox args={[W, H, 0.04]} radius={0.2} smoothness={4}>
          <meshPhysicalMaterial color="#1a2a33" roughness={0.15} metalness={0.1} transmission={0.25} thickness={0.2} clearcoat={1} />
        </RoundedBox>
        <RoundedBox args={[0.62, 0.62, 0.06]} radius={0.14} position={[-0.36, H / 2 - 0.5, -0.04]}>
          <meshPhysicalMaterial color="#141c22" roughness={0.1} clearcoat={1} />
        </RoundedBox>
        {[[-0.48, H / 2 - 0.38], [-0.24, H / 2 - 0.62]].map(([x, y], i) => (
          <mesh key={i} position={[x, y, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.04, 32]} />
            <meshPhysicalMaterial color="#05070a" roughness={0} metalness={0.5} clearcoat={1} />
          </mesh>
        ))}
        {showLabels && <Label text="Back glass" href={LAYERS[4].href} side={1} />}
      </group>
    </group>
  );
}

function GroundRing() {
  const accent = typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#22D3EE" : "#22D3EE";
  return (
    <mesh position={[0, -2.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.5, 1.56, 96]} />
      <meshBasicMaterial color={accent} transparent opacity={0.55} toneMapped={false} />
    </mesh>
  );
}

export default function PhoneScene({
  explode, counts, videoSrc, active, showLabels,
}: { explode: MutableRefObject<number>; counts: LayerCounts; videoSrc?: string; active: boolean; showLabels: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0.2, 7.2], fov: 35 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      aria-label="3D StarTech phone separating into its parts"
      role="img"
    >
      <ambientLight intensity={0.35} />
      <spotLight position={[2, 6, 5]} angle={0.5} penumbra={0.8} intensity={60} color="#ffffff" />
      <spotLight position={[-4, 2, 3]} angle={0.6} penumbra={1} intensity={30} color="#22D3EE" />
      <pointLight position={[0, -2, 2]} intensity={4} color="#22D3EE" />
      <PresentationControls global={false} polar={[-0.3, 0.3]} azimuth={[-0.9, 0.9]} snap>
        <PhoneModel explode={explode} counts={counts} videoSrc={videoSrc} showLabels={showLabels} />
      </PresentationControls>
      <GroundRing />
      <ContactShadows position={[0, -2.15, 0]} opacity={0.5} scale={8} blur={2.5} far={4} />
    </Canvas>
  );
}

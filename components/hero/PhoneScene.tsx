"use client";
// WebGL tier of the hero: a flagship phone styled after the iPhone 17 Pro Max
// (aluminium unibody, full-width camera plateau, triple camera, Dynamic Island),
// built from primitives so no copyrighted Apple imagery is used. It turns a full
// 360° and its five layers separate (display → frame → board → battery → back).
//
// Real 3D model: put a licensed GLB in /public/models/ and set
// NEXT_PUBLIC_HERO_GLB=/models/hero-phone.glb — it replaces the procedural
// phone, still rotating 360°. Exploded layers need one mesh per layer in that file.
import { Suspense, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center, ContactShadows, Html, PresentationControls, RoundedBox, useGLTF, useVideoTexture } from "@react-three/drei";
import * as THREE from "three";
import { LAYERS, PHONE_COLORS, type LayerCounts, type PhoneColor } from "./layers";



const W = 1.5, H = 3.14, R = 0.24;
const GLB_URL = process.env.NEXT_PUBLIC_HERO_GLB || "";

function ring(w: number, h: number, r: number, t: number) {
  const rr = (s: THREE.Shape | THREE.Path, x: number, y: number, ww: number, hh: number, rad: number) => {
    s.moveTo(x + rad, y);
    s.lineTo(x + ww - rad, y); s.quadraticCurveTo(x + ww, y, x + ww, y + rad);
    s.lineTo(x + ww, y + hh - rad); s.quadraticCurveTo(x + ww, y + hh, x + ww - rad, y + hh);
    s.lineTo(x + rad, y + hh); s.quadraticCurveTo(x, y + hh, x, y + hh - rad);
    s.lineTo(x, y + rad); s.quadraticCurveTo(x, y, x + rad, y);
  };
  const shape = new THREE.Shape();
  rr(shape, -w / 2, -h / 2, w, h, r);
  const hole = new THREE.Path();
  rr(hole, -w / 2 + t, -h / 2 + t, w - 2 * t, h - 2 * t, r - t);
  shape.holes.push(hole);
  return shape;
}

/** Lock-screen wallpaper drawn to a canvas (no external images). */
function useWallpaper(color: PhoneColor) {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 512; c.height = 1072;
    const g = c.getContext("2d")!;
    const base = PHONE_COLORS[color].body;
    const bg = g.createLinearGradient(0, 0, 512, 1072);
    bg.addColorStop(0, "#05060a"); bg.addColorStop(0.55, base); bg.addColorStop(1, "#0b0d14");
    g.fillStyle = bg; g.fillRect(0, 0, 512, 1072);
    for (let i = 0; i < 3; i++) {
      const rg = g.createRadialGradient(140 + i * 130, 420 + i * 180, 10, 140 + i * 130, 420 + i * 180, 320);
      rg.addColorStop(0, `rgba(255,255,255,${0.16 - i * 0.04})`); rg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = rg; g.fillRect(0, 0, 512, 1072);
    }
    g.fillStyle = "rgba(255,255,255,.92)"; g.textAlign = "center";
    g.font = "600 34px system-ui, sans-serif"; g.fillText("Friday 3 October", 256, 210);
    g.font = "700 150px system-ui, sans-serif"; g.fillText("9:41", 256, 360);
    g.font = "600 26px system-ui, sans-serif"; g.fillStyle = "rgba(255,255,255,.7)"; g.fillText("StarTech · Genuine parts", 256, 990);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [color]);
}

function ScreenVideo({ src }: { src: string }) {
  const tex = useVideoTexture(src, { muted: true, loop: true, start: true, playsInline: true, crossOrigin: "anonymous" });
  return (
    <mesh position={[0, 0, 0.027]}>
      <planeGeometry args={[W - 0.1, H - 0.1]} />
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

/** Spins the whole phone a full 360° (slow turntable), with a gentle float. */
function useTurntable() {
  const group = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (!group.current) return;
    group.current.rotation.y += dt * 0.42;
    group.current.rotation.x = 0.12 + Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.05;
  });
  return group;
}

function FlagshipPhone({ explode, counts, videoSrc, showLabels, color }: { explode: MutableRefObject<number>; counts: LayerCounts; videoSrc?: string; showLabels: boolean; color: PhoneColor }) {
  const group = useTurntable();
  const layers = useRef<(THREE.Group | null)[]>([]);
  const smooth = useRef(0);
  const frameShape = useMemo(() => ring(W, H, R, 0.07), []);
  const wallpaper = useWallpaper(color);
  const c = PHONE_COLORS[color];

  useFrame((_, dt) => {
    smooth.current = THREE.MathUtils.damp(smooth.current, explode.current, 4, dt);
    LAYERS.forEach((l, i) => {
      const g = layers.current[i];
      if (g) g.position.z = l.z * (0.045 + smooth.current * 0.5);
    });
  });

  const lens = (x: number, y: number, k: number) => (
    <group key={k} position={[x, y, -0.105]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh><cylinderGeometry args={[0.15, 0.155, 0.05, 48]} /><meshStandardMaterial color={c.frame} metalness={0.9} roughness={0.25} /></mesh>
      <mesh position={[0, -0.026, 0]}><cylinderGeometry args={[0.118, 0.118, 0.01, 48]} /><meshPhysicalMaterial color="#05070b" roughness={0.05} metalness={0.4} clearcoat={1} /></mesh>
      <mesh position={[0.03, -0.032, -0.03]}><cylinderGeometry args={[0.035, 0.035, 0.004, 24]} /><meshBasicMaterial color="#3a4a6b" /></mesh>
    </group>
  );

  return (
    <group ref={group}>
      {/* Display: black glass, wallpaper, Dynamic Island */}
      <group ref={(el) => { layers.current[0] = el; }}>
        <RoundedBox args={[W, H, 0.05]} radius={R} smoothness={5}>
          <meshPhysicalMaterial color="#05060a" roughness={0.06} metalness={0.1} clearcoat={1} clearcoatRoughness={0.03} />
        </RoundedBox>
        {videoSrc ? <ScreenVideo src={videoSrc} /> : wallpaper && (
          <mesh position={[0, 0, 0.027]}>
            <planeGeometry args={[W - 0.1, H - 0.1]} />
            <meshBasicMaterial map={wallpaper} toneMapped={false} />
          </mesh>
        )}
        <RoundedBox args={[0.42, 0.12, 0.01]} radius={0.05} position={[0, H / 2 - 0.2, 0.031]}>
          <meshBasicMaterial color="#000" />
        </RoundedBox>
        {showLabels && <Label text={`Display · ${counts.displays ?? 30}+ fits`} href={LAYERS[0].href} side={1} />}
      </group>

      {/* Frame: aluminium band + buttons */}
      <group ref={(el) => { layers.current[1] = el; }}>
        <mesh position={[0, 0, -0.06]}>
          <extrudeGeometry args={[frameShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.014, bevelThickness: 0.014, bevelSegments: 3 }]} />
          <meshStandardMaterial color={c.frame} metalness={0.85} roughness={0.32} />
        </mesh>
        {[[W / 2 + 0.012, 0.55, 0.36], [W / 2 + 0.012, -0.35, 0.22]].map(([x, y, h], i) => (
          <RoundedBox key={i} args={[0.03, h, 0.07]} radius={0.012} position={[x, y, 0]}>
            <meshStandardMaterial color={c.frame} metalness={0.9} roughness={0.25} />
          </RoundedBox>
        ))}
        {[[-W / 2 - 0.012, 0.95, 0.16], [-W / 2 - 0.012, 0.6, 0.3], [-W / 2 - 0.012, 0.22, 0.3]].map(([x, y, h], i) => (
          <RoundedBox key={i} args={[0.03, h, 0.07]} radius={0.012} position={[x, y, 0]}>
            <meshStandardMaterial color={c.frame} metalness={0.9} roughness={0.25} />
          </RoundedBox>
        ))}
        {showLabels && <Label text="Frame & buttons" href={LAYERS[1].href} side={-1} />}
      </group>

      {/* Logic board */}
      <group ref={(el) => { layers.current[2] = el; }}>
        <RoundedBox args={[W - 0.24, H * 0.36, 0.03]} radius={0.06} position={[0, H * 0.27, 0]}>
          <meshStandardMaterial color="#0d3a2c" roughness={0.6} metalness={0.3} />
        </RoundedBox>
        {[[-0.3, 1.05, 0.34, 0.34], [0.22, 0.98, 0.34, 0.2], [0.24, 0.7, 0.22, 0.22], [-0.24, 0.62, 0.42, 0.14]].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, y, 0.03]}>
            <boxGeometry args={[w, h, 0.03]} />
            <meshStandardMaterial color={i === 0 ? "#1c1f26" : "#2a2f39"} metalness={0.6} roughness={0.35} />
          </mesh>
        ))}
        {showLabels && <Label text="Logic board · repairs" href={LAYERS[2].href} side={1} />}
      </group>

      {/* Battery */}
      <group ref={(el) => { layers.current[3] = el; }}>
        <RoundedBox args={[W - 0.34, H * 0.5, 0.06]} radius={0.06} position={[0, -H * 0.19, 0]}>
          <meshStandardMaterial color="#1f232b" roughness={0.45} metalness={0.4} />
        </RoundedBox>
        <mesh position={[0, -H * 0.19, 0.032]}>
          <planeGeometry args={[W - 0.6, 0.08]} />
          <meshBasicMaterial color="#34D399" transparent opacity={0.75} />
        </mesh>
        {showLabels && <Label text={`Battery · ${counts.batteries ?? 30}+ fits`} href={LAYERS[3].href} side={-1} />}
      </group>

      {/* Back: aluminium unibody, full-width camera plateau, glass MagSafe panel */}
      <group ref={(el) => { layers.current[4] = el; }}>
        <RoundedBox args={[W, H, 0.04]} radius={R} smoothness={5}>
          <meshStandardMaterial color={c.body} metalness={0.75} roughness={0.42} />
        </RoundedBox>
        <RoundedBox args={[W - 0.5, H * 0.5, 0.012]} radius={0.12} position={[0, -H * 0.17, -0.024]}>
          <meshPhysicalMaterial color={c.body} roughness={0.25} metalness={0.2} clearcoat={0.8} transparent opacity={0.85} />
        </RoundedBox>
        <mesh position={[0, -H * 0.1, -0.032]}>
          <ringGeometry args={[0.36, 0.38, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.12} side={THREE.DoubleSide} />
        </mesh>
        {/* plateau */}
        <RoundedBox args={[W - 0.02, 0.98, 0.08]} radius={0.16} smoothness={5} position={[0, H / 2 - 0.55, -0.05]}>
          <meshStandardMaterial color={c.plateau} metalness={0.8} roughness={0.35} />
        </RoundedBox>
        {lens(-0.42, H / 2 - 0.32, 0)}
        {lens(-0.42, H / 2 - 0.78, 1)}
        {lens(-0.04, H / 2 - 0.55, 2)}
        <mesh position={[0.42, H / 2 - 0.35, -0.095]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.01, 32]} /><meshBasicMaterial color="#f4f1e8" />
        </mesh>
        <mesh position={[0.42, H / 2 - 0.72, -0.095]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.01, 32]} /><meshPhysicalMaterial color="#0a0b10" roughness={0.1} clearcoat={1} />
        </mesh>
        {showLabels && <Label text="Back glass & camera" href={LAYERS[4].href} side={1} />}
      </group>
    </group>
  );
}

function GlbPhone({ url }: { url: string }) {
  const group = useTurntable();
  const { scene } = useGLTF(url);
  return (
    <group ref={group}>
      <Center><primitive object={scene} scale={1} /></Center>
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
  explode, counts, videoSrc, active, showLabels, color = "cosmic-orange",
}: { explode: MutableRefObject<number>; counts: LayerCounts; videoSrc?: string; active: boolean; showLabels: boolean; color?: PhoneColor }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0.2, 7.4], fov: 35 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      aria-label="3D flagship phone rotating 360 degrees and separating into its parts"
      role="img"
    >
      <ambientLight intensity={0.45} />
      <spotLight position={[2, 6, 5]} angle={0.5} penumbra={0.8} intensity={70} color="#ffffff" />
      <spotLight position={[-4, 2, -4]} angle={0.6} penumbra={1} intensity={40} color="#ffffff" />
      <spotLight position={[-4, 2, 3]} angle={0.6} penumbra={1} intensity={25} color="#22D3EE" />
      <pointLight position={[0, -2, 2]} intensity={4} color="#22D3EE" />
      <PresentationControls global={false} polar={[-0.3, 0.3]} azimuth={[-Infinity, Infinity]} snap={false}>
        <Suspense fallback={null}>
          {GLB_URL
            ? <GlbPhone url={GLB_URL} />
            : <FlagshipPhone explode={explode} counts={counts} videoSrc={videoSrc} showLabels={showLabels} color={color} />}
        </Suspense>
      </PresentationControls>
      <GroundRing />
      <ContactShadows position={[0, -2.15, 0]} opacity={0.5} scale={8} blur={2.5} far={4} />
    </Canvas>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const fontTtfUrl = new URL("./Middletown-Font/Middletown.ttf", import.meta.url).href;
const fontOtfUrl = new URL("./Middletown-Font/Middletown.otf", import.meta.url).href;
if (typeof document !== "undefined" && !document.getElementById("mid-font-face")) {
  const style = document.createElement("style");
  style.id = "mid-font-face";
  style.textContent = `
    @font-face {
      font-family: 'Middletown';
      src: url(${fontTtfUrl}) format('truetype'), url(${fontOtfUrl}) format('opentype');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
  `;
  document.head.appendChild(style);
}

function Needle({ theta }) {
  const ref = useRef();
  useFrame(() => {
    if (ref.current) {
      // map polar angle (0=right, pi/2=up, pi=left) to mesh rotation (0=up)
      ref.current.rotation.z = theta - Math.PI / 2;
    }
  });
  return (
    <mesh ref={ref} position={[-0.1, -0.15, 0]}>
      <boxGeometry args={[0.01, 0.25, 0.01]} />
      <meshBasicMaterial color="#ff4d4d" />
    </mesh>
  );
}

function Bezel() {
  // Semi-circular ring bezel
  return (
    <group position={[0, -0.2, -0.01]}>
      <mesh>
        <ringGeometry args={[0.48, 0.54, 96, 1, Math.PI, Math.PI]} />
        <meshBasicMaterial color="#40e0ff" transparent opacity={0.35} />
      </mesh>
      <line>
        <bufferGeometry attach="geometry"
          {...(() => {
            const points = [];
            for (let i = 0; i <= 96; i++) {
              const t = i / 96;
              const a = Math.PI - t * Math.PI;
              points.push(new THREE.Vector3(Math.cos(a) * 0.46, Math.sin(a) * 0.46, 0));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            return geo;
          })()} />
        <lineBasicMaterial color="#8fdcff" linewidth={2} transparent opacity={0.6} />
      </line>
    </group>
  );
}

function ProtectorHatch() {
  // Radial hatch lines over the glass
  const geom = useMemo(() => {
    const segments = 16;
    const rIn = 0.35, rOut = 0.54;
    const positions = new Float32Array(segments * 2 * 3);
    for (let i = 0; i < segments; i++) {
      const t = i / (segments - 1);
      const a = Math.PI - t * Math.PI; // 180..0
      const x1 = Math.cos(a) * rIn;
      const y1 = Math.sin(a) * rIn;
      const x2 = Math.cos(a) * rOut;
      const y2 = Math.sin(a) * rOut;
      positions.set([x1, y1, 0, x2, y2, 0], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);
  return (
    <lineSegments position={[0, -0.2, 0.02]}>
      <primitive object={geom} />
      <lineBasicMaterial color="#aef6ff" transparent opacity={0.15} />
    </lineSegments>
  );
}

function Ticks() {
  const ticks = useMemo(() => new Array(13).fill(0).map((_, i) => i), []);
  return (
    <group>
      {ticks.map((i) => {
        const t = i / 12; // 0..1
        const deg = Math.PI - t * Math.PI; // 180..0 degrees
        const r = 0.45;
        const x = Math.cos(deg) * r;
        const y = Math.sin(deg) * r;
        return (
          <mesh key={i} position={[x, y - 0.2, 0]}>
            <boxGeometry args={[0.01, 0.04, 0.005]} />
            <meshBasicMaterial color="#aef6ff" />
          </mesh>
        );
      })}
    </group>
  );
}

function Gauge() {
  const [speed, setSpeed] = useState(0);
  useFrame(() => {
    const get = window.__getSpeedMs || (() => 0);
    setSpeed(get());
  });
  const mph = speed * 3.6 * 0.621371;
  const t = Math.max(0, Math.min(1, mph / 240));
  const sweep = 0.4; // use only 40% of the semicircle near the left
  const theta = Math.PI - t * (Math.PI * sweep); // stays on left side
  return (
    <group>
      <Bezel />
      <Ticks />
      <Needle theta={theta} />
      <ProtectorHatch />
    </group>
  );
}

function useSpeedKmH() {
  const [kmh, setKmh] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const get = window.__getSpeedMs || (() => 0);
      const ms = get();
      setKmh(ms * 3.6);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return kmh;
}

function R3FSpeedometer() {
  const kmh = useSpeedKmH();
  const maxKmh = 240;
  const pct = Math.max(0, Math.min(1, kmh / maxKmh));
  return (
    <div style={styles.wrapNumeric}>
      <div style={styles.numeric}>
        {Math.round(kmh)}<span style={styles.unit}> km/h</span>
      </div>
      {(() => {
        const segments = 16;
        const filled = Math.floor(pct * segments);
        const partial = pct * segments - filled;
        return (
          <div style={styles.barWrapRounded}>
            <div style={styles.barGrid}>
              {Array.from({ length: segments }).map((_, i) => {
                const fill = i < filled ? 1 : i === filled ? partial : 0;
                return (
                  <div key={i} style={styles.barSegment}>
                    <div style={{ ...styles.barSegmentFill, width: `${fill * 100}%` }} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const styles = {
  wrapNumeric: {
    position: "fixed",
    bottom: 16,
    left: 16,
    padding: "10px 14px",
    pointerEvents: "none",
    background: "transparent",
    border: "none",
    borderRadius: 8,
    boxShadow: "none",
  },
  numeric: {
    fontFamily: "Middletown, system-ui, Segoe UI, Arial, sans-serif",
    fontWeight: 700,
    fontSize: 60,
    color: "#c9f7ff",
    textShadow: "0 0 4px rgba(0,255,255,0.25)",
    letterSpacing: 1,
  },
  unit: { marginLeft: 6, fontSize: 14, opacity: 0.8 },
  barWrap: {
    width: 220,
    height: 10,
    marginTop: 6,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 6,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    background: "linear-gradient(90deg, #00e5ff, #00ffa3)",
    boxShadow: "0 0 12px rgba(0,255,200,0.5)",
  },
  barWrapRounded: {
    width: 220,
    padding: 4,
    marginTop: 8,
    borderRadius: 10,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.15)",
    boxShadow: "inset 0 0 8px rgba(0,255,200,0.08)",
  },
  barGrid: {
    display: "flex",
    gap: 3,
  },
  barSegment: {
    flex: 1,
    height: 12,
    background: "rgba(255,255,255,0.08)",
    borderRadius: 6,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  barSegmentFill: {
    height: "100%",
    background: "linear-gradient(90deg, #00e5ff, #00ffa3)",
    boxShadow: "0 0 10px rgba(0,255,200,0.4)",
    borderRadius: 6,
  },
};

// Auto-mount on import
(function mount() {
  if (typeof window === "undefined") return;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(<R3FSpeedometer />);
})();

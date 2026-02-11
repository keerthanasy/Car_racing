import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Score from "./score.jsx";
// Load custom web fonts once (Audiowide for headings, Poppins for UI text)
(function loadWebFonts() {
  if (typeof window === 'undefined') return;
  const id = 'gf-audiowide-poppins';
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Audiowide&family=Poppins:wght@400;700;800&display=swap';
    document.head.appendChild(link);
  }
  // Set a nicer default for the page
  try { document.body.style.fontFamily = 'Poppins, system-ui, Segoe UI, Arial, sans-serif'; } catch (_) { }
})();

const keyMeta = [
  { code: 'KeyW', label: 'W', arrow: '↑' },
  { code: 'KeyA', label: 'A', arrow: '←' },
  { code: 'KeyS', label: 'S', arrow: '↓' },
  { code: 'KeyD', label: 'D', arrow: '→' },
];

function KeysCard({ pressed }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 28,
      right: 40,
      zIndex: 15,
      userSelect: 'none',
      background: 'none', border: 'none', boxShadow: 'none', padding: 0,
      width: 'auto',
      pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 4 }}>
        <span />{/* center for W */}
        <Keycap meta={keyMeta[0]} pressed={pressed['KeyW']} />
        <span />{/* spacer, balance grid */}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
        <Keycap meta={keyMeta[1]} pressed={pressed['KeyA']} />
        <Keycap meta={keyMeta[2]} pressed={pressed['KeyS']} />
        <Keycap meta={keyMeta[3]} pressed={pressed['KeyD']} />
      </div>
    </div>
  );
}

function Keycap({ meta, pressed }) {
  const bgStyle = {
    position: 'absolute',
    inset: 0,
    borderRadius: 12,
    background: pressed ? 'linear-gradient(135deg, #15283b 0%, #295886 100%)' : 'transparent',
    boxShadow: '0 0 8px 1.5px #0b335940, 0 2px 10px #148ae022',
    border: '2px solid #184361',
    zIndex: 0,
    pointerEvents: 'none',
    transition: 'background 0.13s cubic-bezier(.68,-0.55,.43,1.31)',
  };
  // Arrow: use same gradient as background, with background-clip for pressed
  const arrowStyle = {
    fontSize: 26,
    lineHeight: 1,
    marginBottom: 2,
    marginTop: 0,
    fontWeight: 800,
    letterSpacing: '.02em',
    display: 'block',
    textAlign: 'center',
    zIndex: 2,
    position: 'relative',
    color: pressed ? 'transparent' : '#7cc9e7',
    textShadow: pressed ? '0 0 6px #2b507dee' : '0 1px 3px #3467a2',
    background: pressed ? 'linear-gradient(135deg, #15283b 0%, #295886 100%)' : undefined,
    WebkitBackgroundClip: pressed ? 'text' : undefined,
    backgroundClip: pressed ? 'text' : undefined,
    WebkitTextFillColor: pressed ? 'transparent' : undefined,
  };
  const labelStyle = {
    fontSize: 19,
    color: pressed ? '#fff' : '#bce5fa',
    fontFamily: 'Poppins, system-ui, Segoe UI, Arial, sans-serif',
    fontWeight: pressed ? 900 : 700,
    letterSpacing: '.03em',
    marginTop: 0,
    textShadow: pressed ? '0 0 4px #17eaf3,0 1px 3px #37bff8' : '0 1px 3px #3f9acf',
    textAlign: 'center',
    display: 'block',
    zIndex: 2,
    position: 'relative',
  };
  return (
    <div style={{ position: 'relative', margin: 0, padding: '0 3px 0 3px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 54 }}>
      <div style={bgStyle} />
      <span style={arrowStyle}>{meta.arrow}</span>
      <span style={labelStyle}>{meta.label}</span>
    </div>
  );
}

// PlaneCollectionPanel removed


function Panel() {
  const keyAliases = {
    ArrowUp: 'KeyW',
    ArrowLeft: 'KeyA',
    ArrowDown: 'KeyS',
    ArrowRight: 'KeyD',
  };
  const [visible, setVisible] = useState(true);
  // Remove score logic
  // const [score, setScore] = useState(0);
  const [pressed, setPressed] = useState({});
  // 20 panel colors
  const panelColors = [
    '#1a1a1a', '#964b00', '#ff0000', '#ffa500', '#ffff00', '#00ff00', '#0000ff', '#8a2be2', '#808080', '#ffffff',
    '#1a1a1a', '#964b00', '#ff0000', '#ffa500', '#ffff00', '#00ff00', '#0000ff', '#8a2be2', '#808080', '#ffffff',
  ];
  // Track if collected (each value: false, or a color string when filled)
  const [collectedArr, setCollectedArr] = useState(Array(20).fill(null));

  // Expose setter to window for demo; in real project, move to Redux or events
  useEffect(() => {
    // REMOVE score logic
    // window.setScoreFromPhysics = (updaterOrValue) => {
    //   setScore((prev) => {
    //     const next = typeof updaterOrValue === "function" ? updaterOrValue(prev) : updaterOrValue;
    //     return next;
    //   });
    // };
    const onKey = (e) => {
      let updates = {};
      if (keyMeta.some(k => k.code === e.code)) updates[e.code] = e.type === 'keydown';
      if (e.code in keyAliases) updates[keyAliases[e.code]] = e.type === 'keydown';
      if (Object.keys(updates).length) setPressed((p) => ({ ...p, ...updates }));
      if (e.code === "Enter") {
        e.preventDefault();
        setVisible(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.setPlaneCollected = undefined;
    };
  }, []);

  return (
    <>
      {/* REMOVE <Score score={score} position="right" /> */}
      <KeysCard pressed={pressed} />
      {visible && (
        <div id="enter-panel-overlay-r3f" style={styles.overlay}>
          <div style={styles.frame}>
            <div style={styles.accent} />
            <div style={styles.controlsTitle}>Controls</div>
            <div style={styles.keysBoard}>
              <div style={styles.rowCenter}>
                <div style={styles.pairKey}>W / ↑</div>
              </div>
              <div style={styles.spacer} />
              <div style={styles.row}>
                <div style={styles.pairKey}>A / ←</div>
                <div style={styles.pairKey}>S / ↓</div>
                <div style={styles.pairKey}>D / →</div>
              </div>
              <div style={styles.spacer} />
              <div style={styles.rowCenter}>
                <div style={styles.spaceKey}>Space</div>
              </div>
            </div>
            <div style={{ marginTop: 36 }} />
            {/* 20 small boxes, 2 rows of 10, after all controls */}
            {/* <div style={{ display: 'flex', flexDirection:'column', gap:10, alignItems:'center', justifyContent:'center' }}>
              <div style={{display:'flex',gap:7}}>
                {collectedArr.slice(0,10).map((c,i) => (
                  <div key={i} style={{
                    width:18, height:18, border:'1.5px solid #48adcf', borderRadius:4,
                    background:c || '#2c2c39', boxShadow: c? '0 0 8px 2px '+(c)+'88' : 'none',
                    transition:'background 0.24s',
                  }} />
                ))}
              </div>
              <div style={{display:'flex',gap:7}}>
                {collectedArr.slice(10,20).map((c,i) => (
                  <div key={10+i} style={{
                    width:18, height:18, border:'1.5px solid #48adcf', borderRadius:4,
                    background: c || '#2c2c39', boxShadow: c? '0 0 8px 2px '+(c)+'88' : 'none',
                    transition:'background 0.24s',
                  }} />
                ))}
              </div>
            </div> */}
            <h1 style={{ ...styles.title, marginTop: 18 }}>Press Enter to start the Journey</h1>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 99999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    backdropFilter: "none",
  },
  // No canvas background
  frame: {
    position: "relative",
    width: "min(740px, 90vw)",
    padding: "48px 32px",
    border: "1px solid rgba(0,255,255,0.35)",
    borderRadius: 16,
    boxShadow:
      "0 0 24px rgba(0,255,255,0.08), inset 0 0 40px rgba(0,160,255,0.06), 0 0 2px 1px rgba(0,255,255,0.25)",
    background: "linear-gradient(180deg, rgba(0,20,40,0.65), rgba(0,10,20,0.65))",
    overflow: "hidden",
  },
  accent: {
    position: "absolute",
    inset: -1,
    borderRadius: 16,
    pointerEvents: "none",
    boxShadow: "0 0 60px rgba(0,220,255,0.12), inset 0 0 60px rgba(0,120,255,0.08)",
  },
  title: {
    margin: 0,
    textAlign: "center",
    fontFamily: "Audiowide, system-ui, Segoe UI, Arial, sans-serif",
    color: "#9ffcff",
    letterSpacing: ".12em",
    textTransform: "uppercase",
    fontSize: "clamp(16px, 2vw, 22px)",
    textShadow: "0 0 18px rgba(0,180,255,0.45), 0 0 2px rgba(0,255,255,0.35)",
  },
  sub: {
    textAlign: "center",
    fontFamily: "Poppins, system-ui, Segoe UI, Arial, sans-serif",
    color: "#bfefff",
    opacity: 0.9,
    fontSize: "clamp(13px, 2.2vw, 16px)",
    letterSpacing: ".08em",
    marginTop: 8,
  },
  keycap: {
    display: "inline-block",
    marginLeft: 8,
    padding: "6px 10px",
    border: "1px solid rgba(0,255,255,0.4)",
    borderRadius: 6,
    color: "#00ffff",
    background: "rgba(0,255,255,0.06)",
    boxShadow: "inset 0 0 8px rgba(0,255,255,0.15), 0 0 10px rgba(0,200,255,0.18)",
  },
  controlsTitle: {
    fontFamily: "Audiowide, system-ui, Segoe UI, Arial, sans-serif",
    fontSize: 20,
    letterSpacing: ".14em",
    color: "#aef6ff",
    marginBottom: 8,
    textTransform: "uppercase",
    textAlign: "center",
  },
  controlsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
    justifyItems: "center",
  },
  keysBoard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  row: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCenter: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  spacer: { height: 12 },
  key: {
    minWidth: 44,
    height: 44,
    padding: "0 10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(0,255,255,0.35)",
    borderRadius: 8,
    color: "#00ffff",
    background: "rgba(0,255,255,0.06)",
    boxShadow: "inset 0 0 10px rgba(0,255,255,0.16), 0 0 8px rgba(0,200,255,0.12)",
    fontWeight: 700,
    fontSize: 18,
  },
  comboKey: {
    minWidth: 320,
    height: 44,
    padding: "0 14px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(0,255,255,0.45)",
    borderRadius: 10,
    color: "#00ffff",
    background: "rgba(0,255,255,0.06)",
    boxShadow: "inset 0 0 12px rgba(0,255,255,0.18), 0 0 10px rgba(0,200,255,0.12)",
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: ".08em",
  },
  pairKey: {
    minWidth: 60,
    height: 34,
    padding: "0 6px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(0,255,255,0.45)",
    borderRadius: 10,
    color: "#00ffff",
    background: "rgba(0,255,255,0.06)",
    boxShadow: "inset 0 0 12px rgba(0,255,255,0.18), 0 0 10px rgba(0,200,255,0.12)",
    fontWeight: 700,
    fontSize: 17,
    letterSpacing: ".06em",
  },
  spaceKey: {
    minWidth: 160,
    height: 32,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(0,255,255,0.35)",
    borderRadius: 8,
    color: "#00ffff",
    background: "rgba(0,255,255,0.06)",
    boxShadow: "inset 0 0 10px rgba(0,255,255,0.16), 0 0 8px rgba(0,200,255,0.12)",
    fontWeight: 600,
    letterSpacing: ".08em",
    fontSize: 16,
  },
  controlRow: {
    color: "#d8f7ff",
    fontFamily: "Segoe UI, Arial, sans-serif",
    fontSize: 16,
    opacity: 0.95,
    textAlign: "center",
  },
  controlKey: {
    display: "inline-block",
    minWidth: 30,
    padding: "4px 8px",
    marginRight: 8,
    border: "1px solid rgba(0,255,255,0.35)",
    borderRadius: 6,
    color: "#00ffff",
    background: "rgba(0,255,255,0.06)",
    boxShadow: "inset 0 0 8px rgba(0,255,255,0.16)",
    fontWeight: 600,
  },
};

// Auto-mount on import
(function mount() {
  if (typeof window === "undefined") return;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(<Panel />);
})();

// Simple congratulations overlay, shown when finish cloth is reached
function CongratulationsOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    window.showCongrats = () => setVisible(true);
    return () => { window.showCongrats = undefined; };
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.35)', backdropFilter: 'blur(2px)'
    }}>
      <div style={{
        position: 'relative', width: 'min(720px, 90vw)',
        padding: '40px 28px', border: '1px solid rgba(0,255,255,0.35)',
        borderRadius: 16, boxShadow: '0 0 24px rgba(0,255,255,0.10)',
        background: 'linear-gradient(180deg, rgba(0,20,40,0.8), rgba(0,10,20,0.8))',
        textAlign: 'center'
      }}>
        {typeof window !== 'undefined' && typeof window.areAllPlanesCollected === 'function' && window.areAllPlanesCollected() && (
          <h2 style={{
            margin: 0,
            fontFamily: 'Orbitron, system-ui, Segoe UI, Arial, sans-serif',
            color: '#aef6ff', letterSpacing: '.14em', textTransform: 'uppercase',
            fontSize: 24, textShadow: '0 0 18px rgba(0,180,255,0.45)'
          }}>Congrats, you completed the ride!</h2>
        )}
        {typeof window !== 'undefined' && typeof window.areAllPlanesCollected === 'function' && window.areAllPlanesCollected() ? (
          <button onClick={() => setVisible(false)} style={{
            cursor: 'pointer',
            padding: '10px 18px', borderRadius: 10,
            border: '1px solid rgba(0,255,255,0.45)',
            background: 'rgba(0,255,255,0.06)', color: '#00ffff',
            boxShadow: 'inset 0 0 12px rgba(0,255,255,0.18), 0 0 10px rgba(0,200,255,0.12)',
            fontWeight: 700, letterSpacing: '.08em'
          }}>Continue</button>
        ) : (
          <>
            <p style={{
              margin: '12px 0 18px', color: '#ffd4d4', opacity: 0.95,
              fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: 15
            }}>Oops, you didn’t collect the colors fully. Click Retry to collect all.</p>
            <button onClick={() => { try { if (typeof window.retryFromStart === 'function') window.retryFromStart(); } catch (_) { } finally { setVisible(false); } }} style={{
              cursor: 'pointer',
              padding: '10px 18px', borderRadius: 10,
              border: '1px solid rgba(255,120,120,0.5)',
              background: 'rgba(255,60,60,0.08)', color: '#ffbdbd',
              boxShadow: 'inset 0 0 12px rgba(255,120,120,0.18), 0 0 10px rgba(255,80,80,0.12)',
              fontWeight: 800, letterSpacing: '.08em'
            }}>Retry</button>
          </>
        )}
      </div>
    </div>
  );
}

// Mount congratulations overlay
(function mountCongrats() {
  if (typeof window === 'undefined') return;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(<CongratulationsOverlay />);
})();

// Small instruction text at left corner
function InstructionHint() {
  return (
    <div style={{
      position: 'fixed',
      top: 22,
      left: 22,
      zIndex: 20,
      fontFamily: 'Audiowide, system-ui, Segoe UI, Arial, sans-serif',
      fontWeight: 800,
      letterSpacing: '.06em',
      color: '#c8f3ff',
      textShadow: '0 1px 0 #0d5163, 0 0 6px #48a9d460',
      background: 'none',
      border: 'none',
      borderRadius: 0,
      padding: 0,
      pointerEvents: 'none'
    }}>
      Move forward and collect the colors and values
    </div>
  );
}

// Mount instruction hint
(function mountInstruction() {
  if (typeof window === 'undefined') return;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(<InstructionHint />);
})();

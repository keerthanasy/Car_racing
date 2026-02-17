import React, { useEffect, useState, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";

// ==============================
// TAXI HUD - React Overlay
// ==============================

// --- Notification Toast ---
function NotificationToast({ message, type, onDone }) {
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setExiting(true), 3500);
        const removeTimer = setTimeout(() => onDone && onDone(), 4200);
        return () => {
            clearTimeout(timer);
            clearTimeout(removeTimer);
        };
    }, []);

    const bgColor =
        type === "success"
            ? "rgba(0, 255, 136, 0.12)"
            : type === "warn"
                ? "rgba(255, 170, 0, 0.12)"
                : "rgba(0, 180, 255, 0.12)";
    const borderColor =
        type === "success"
            ? "rgba(0, 255, 136, 0.4)"
            : type === "warn"
                ? "rgba(255, 170, 0, 0.4)"
                : "rgba(0, 180, 255, 0.4)";
    const textColor =
        type === "success" ? "#66ffaa" : type === "warn" ? "#ffcc66" : "#88ddff";

    return (
        <div
            style={{
                padding: "14px 24px",
                background: bgColor,
                border: `1px solid ${borderColor}`,
                borderRadius: 12,
                backdropFilter: "blur(10px)",
                color: textColor,
                fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
                fontWeight: 600,
                fontSize: 15,
                letterSpacing: ".03em",
                boxShadow: `0 4px 20px ${borderColor}, inset 0 0 20px rgba(0,0,0,0.2)`,
                transition: "all 0.5s ease",
                opacity: exiting ? 0 : 1,
                transform: exiting ? "translateY(-20px)" : "translateY(0)",
                marginBottom: 8,
            }}
        >
            {message}
        </div>
    );
}

// --- Fare Complete Popup ---
function FareCompletePopup({ fare, timeBonus, onClose }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
        const t = setTimeout(() => {
            setVisible(false);
            setTimeout(() => onClose && onClose(), 500);
        }, 3000);
        return () => clearTimeout(t);
    }, []);

    return (
        <div
            style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: visible
                    ? "translate(-50%, -50%) scale(1)"
                    : "translate(-50%, -50%) scale(0.5)",
                opacity: visible ? 1 : 0,
                transition: "all 0.5s cubic-bezier(.68,-0.55,.43,1.31)",
                zIndex: 100001,
                textAlign: "center",
                pointerEvents: "none",
            }}
        >
            <div
                style={{
                    background:
                        "linear-gradient(135deg, rgba(0,40,20,0.9), rgba(0,20,40,0.9))",
                    border: "1px solid rgba(0,255,136,0.5)",
                    borderRadius: 20,
                    padding: "28px 48px",
                    boxShadow:
                        "0 0 40px rgba(0,255,136,0.15), inset 0 0 30px rgba(0,255,136,0.05)",
                    backdropFilter: "blur(15px)",
                }}
            >
                <div
                    style={{
                        fontFamily: "'Orbitron', sans-serif",
                        color: "#00ff88",
                        fontSize: 14,
                        letterSpacing: ".2em",
                        textTransform: "uppercase",
                        marginBottom: 8,
                    }}
                >
                    FARE COMPLETE
                </div>
                <div
                    style={{
                        fontFamily: "'Orbitron', sans-serif",
                        color: "#fff",
                        fontSize: 42,
                        fontWeight: 900,
                        textShadow: "0 0 20px rgba(0,255,136,0.4)",
                    }}
                >
                    ${fare}
                </div>
                {timeBonus > 0 && (
                    <div
                        style={{
                            marginTop: 8,
                            fontFamily: "'Rajdhani', sans-serif",
                            color: "#ffcc00",
                            fontSize: 16,
                            fontWeight: 700,
                            letterSpacing: ".1em",
                        }}
                    >
                        ⚡ SPEED BONUS +${timeBonus}
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Task Panel (Top-Left) ---
function TaskPanel({ task, phase, state }) {
    if (!task) return null;

    const isPickup = phase === "pickup";
    const destination = isPickup ? task.pickup : task.dropoff;
    const accentColor = isPickup ? "#00ff88" : "#ff6600";
    const phaseLabel = isPickup ? "PICK UP" : "DROP OFF";
    const phaseIcon = isPickup ? "🟢" : "🟠";

    return (
        <div
            id="taxi-task-panel"
            style={{
                position: "fixed",
                top: 22,
                left: 22,
                zIndex: 100,
                width: 320,
                background:
                    "linear-gradient(135deg, rgba(0,15,30,0.85), rgba(0,10,25,0.85))",
                border: `1px solid ${accentColor}44`,
                borderRadius: 16,
                padding: "18px 20px",
                backdropFilter: "blur(12px)",
                boxShadow: `0 4px 30px rgba(0,0,0,0.4), 0 0 20px ${accentColor}15`,
                fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
                transition: "all 0.4s ease",
            }}
        >
            {/* Phase indicator */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                }}
            >
                <div
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: accentColor,
                        boxShadow: `0 0 8px ${accentColor}`,
                        animation: "pulse-dot 1.5s ease-in-out infinite",
                    }}
                />
                <span
                    style={{
                        color: accentColor,
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: ".2em",
                        fontFamily: "'Orbitron', sans-serif",
                    }}
                >
                    {phaseLabel}
                </span>
            </div>

            {/* Passenger Info */}
            <div style={{ marginBottom: 10 }}>
                <div
                    style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 11,
                        letterSpacing: ".1em",
                        textTransform: "uppercase",
                        marginBottom: 2,
                    }}
                >
                    Passenger
                </div>
                <div
                    style={{
                        color: "#fff",
                        fontSize: 18,
                        fontWeight: 700,
                        letterSpacing: ".02em",
                    }}
                >
                    {task.passenger}
                </div>
            </div>

            {/* Destination */}
            <div style={{ marginBottom: 10 }}>
                <div
                    style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 11,
                        letterSpacing: ".1em",
                        textTransform: "uppercase",
                        marginBottom: 2,
                    }}
                >
                    {isPickup ? "Pickup Location" : "Drop-off Location"}
                </div>
                <div
                    style={{
                        color: accentColor,
                        fontSize: 16,
                        fontWeight: 600,
                    }}
                >
                    📍 {destination.name}
                </div>
                <div
                    style={{
                        color: "rgba(255,255,255,0.35)",
                        fontSize: 12,
                        marginTop: 2,
                    }}
                >
                    {destination.district} District
                </div>
            </div>

            {/* Fare */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    paddingTop: 10,
                    marginTop: 6,
                }}
            >
                <span
                    style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 12,
                        letterSpacing: ".1em",
                        textTransform: "uppercase",
                    }}
                >
                    Fare
                </span>
                <span
                    style={{
                        color: "#ffcc00",
                        fontSize: 20,
                        fontWeight: 900,
                        fontFamily: "'Orbitron', sans-serif",
                    }}
                >
                    ${task.fare}
                </span>
            </div>

            {/* Full Route (shown after pickup) */}
            {!isPickup && (
                <div
                    style={{
                        marginTop: 10,
                        padding: "8px 0 0",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 2,
                            }}
                        >
                            <div
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: "#00ff88",
                                }}
                            />
                            <div
                                style={{
                                    width: 1,
                                    height: 16,
                                    background:
                                        "linear-gradient(to bottom, #00ff88, #ff6600)",
                                }}
                            />
                            <div
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: "#ff6600",
                                }}
                            />
                        </div>
                        <div>
                            <div
                                style={{
                                    color: "rgba(255,255,255,0.4)",
                                    fontSize: 11,
                                }}
                            >
                                {task.pickup.name}
                            </div>
                            <div style={{ height: 10 }} />
                            <div style={{ color: "#ff6600", fontSize: 12, fontWeight: 600 }}>
                                {task.dropoff.name}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Earnings Panel (Top-Right) ---
function EarningsPanel({ earnings, tasksCompleted }) {
    return (
        <div
            id="taxi-earnings-panel"
            style={{
                position: "fixed",
                top: 232,
                right: 22,
                zIndex: 100,
                background:
                    "linear-gradient(135deg, rgba(0,15,30,0.85), rgba(0,10,25,0.85))",
                border: "1px solid rgba(255,204,0,0.25)",
                borderRadius: 16,
                padding: "14px 22px",
                backdropFilter: "blur(12px)",
                boxShadow: "0 4px 30px rgba(0,0,0,0.4), 0 0 15px rgba(255,204,0,0.08)",
                fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
                textAlign: "center",
                minWidth: 160,
            }}
        >
            <div
                style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 11,
                    letterSpacing: ".15em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                }}
            >
                TOTAL EARNINGS
            </div>
            <div
                style={{
                    color: "#ffcc00",
                    fontSize: 28,
                    fontWeight: 900,
                    fontFamily: "'Orbitron', sans-serif",
                    textShadow: "0 0 15px rgba(255,204,0,0.3)",
                }}
            >
                ${earnings}
            </div>
            <div
                style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 12,
                    marginTop: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                }}
            >
                <span style={{ color: "#00ff88" }}>✓</span>
                {tasksCompleted} {tasksCompleted === 1 ? "ride" : "rides"} completed
            </div>
        </div>
    );
}

// --- Distance Indicator (Bottom-Center) ---
function DistanceIndicator({ distance, label, color }) {
    if (distance === null || distance === undefined) return null;

    const distDisplay =
        distance > 100
            ? `${(distance / 100).toFixed(1)} km`
            : `${Math.round(distance)} m`;

    return (
        <div
            style={{
                position: "fixed",
                bottom: 100,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                pointerEvents: "none",
            }}
        >
            <div
                style={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: 22,
                    fontWeight: 900,
                    color: color || "#00ff88",
                    textShadow: `0 0 15px ${color || "#00ff88"}66`,
                    letterSpacing: ".05em",
                }}
            >
                {distDisplay}
            </div>
            <div
                style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.5)",
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                }}
            >
                → {label}
            </div>
        </div>
    );
}

// --- Idle Status (Waiting for task) ---
function IdleStatus() {
    return (
        <div
            style={{
                position: "fixed",
                top: 22,
                left: 22,
                zIndex: 100,
                background:
                    "linear-gradient(135deg, rgba(0,15,30,0.75), rgba(0,10,25,0.75))",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 16,
                padding: "16px 24px",
                backdropFilter: "blur(12px)",
                boxShadow: "0 4px 30px rgba(0,0,0,0.3)",
                fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
                display: "flex",
                alignItems: "center",
                gap: 12,
            }}
        >
            <div
                style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#00ff88",
                    boxShadow: "0 0 10px #00ff8866",
                    animation: "pulse-dot 2s ease-in-out infinite",
                }}
            />
            <div>
                <div
                    style={{
                        color: "#aef6ff",
                        fontSize: 14,
                        fontWeight: 700,
                        fontFamily: "'Orbitron', sans-serif",
                        letterSpacing: ".1em",
                    }}
                >
                    AVAILABLE
                </div>
                <div
                    style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 12,
                        marginTop: 2,
                    }}
                >
                    Waiting for next passenger...
                </div>
            </div>
        </div>
    );
}
// --- Minimap (Top-Right) ---
function Minimap() {
    const canvasRef = useRef(null);
    const animRef = useRef(null);
    const MAP_SIZE = 200;
    const MAP_RADIUS = MAP_SIZE / 2;
    const SCALE = 0.035; // world units to pixels

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        canvas.width = MAP_SIZE * 2; // retina
        canvas.height = MAP_SIZE * 2;
        canvas.style.width = MAP_SIZE + "px";
        canvas.style.height = MAP_SIZE + "px";
        ctx.scale(2, 2);

        const draw = () => {
            animRef.current = requestAnimationFrame(draw);
            ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

            // Get data
            const carData = window.__minimapGetCarData
                ? window.__minimapGetCarData()
                : null;
            const roadPoints = window.__minimapRoadPoints || [];
            const markers = window.__minimapGetMarkers
                ? window.__minimapGetMarkers()
                : [];

            if (!carData) return;

            const cx = MAP_RADIUS;
            const cy = MAP_RADIUS;
            const carX = carData.x;
            const carZ = carData.z;
            const carYaw = carData.yaw;

            // Background circle
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, MAP_RADIUS - 2, 0, Math.PI * 2);
            ctx.clip();

            // Dark background
            const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, MAP_RADIUS);
            bgGrad.addColorStop(0, "rgba(0, 20, 40, 0.92)");
            bgGrad.addColorStop(1, "rgba(0, 10, 20, 0.95)");
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

            // Grid lines
            ctx.strokeStyle = "rgba(255,255,255,0.04)";
            ctx.lineWidth = 0.5;
            const gridSpacing = 20;
            for (let i = -MAP_SIZE; i < MAP_SIZE * 2; i += gridSpacing) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, MAP_SIZE);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(MAP_SIZE, i);
                ctx.stroke();
            }

            // Draw road
            if (roadPoints.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
                ctx.lineWidth = 3;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                let started = false;
                for (let i = 0; i < roadPoints.length; i++) {
                    const px = cx + (roadPoints[i].x - carX) * SCALE;
                    const py = cy + (roadPoints[i].z - carZ) * SCALE;
                    // Only draw if within visible radius (with some margin)
                    if (
                        Math.abs(px - cx) < MAP_RADIUS + 20 &&
                        Math.abs(py - cy) < MAP_RADIUS + 20
                    ) {
                        if (!started) {
                            ctx.moveTo(px, py);
                            started = true;
                        } else {
                            ctx.lineTo(px, py);
                        }
                    } else {
                        started = false;
                    }
                }
                ctx.stroke();
            }

            // Draw markers
            markers.forEach((m) => {
                const mx = cx + (m.x - carX) * SCALE;
                const my = cy + (m.z - carZ) * SCALE;

                // Check if within map
                const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
                let drawX = mx,
                    drawY = my;

                // If outside circle, clamp to edge with direction indicator
                if (dist > MAP_RADIUS - 10) {
                    const angle = Math.atan2(my - cy, mx - cx);
                    drawX = cx + Math.cos(angle) * (MAP_RADIUS - 12);
                    drawY = cy + Math.sin(angle) * (MAP_RADIUS - 12);

                    // Draw direction arrow at edge
                    ctx.save();
                    ctx.translate(drawX, drawY);
                    ctx.rotate(angle);
                    ctx.beginPath();
                    ctx.moveTo(6, 0);
                    ctx.lineTo(-3, -4);
                    ctx.lineTo(-3, 4);
                    ctx.closePath();
                    ctx.fillStyle = m.type === "pickup" ? "#00ff88" : "#ff6600";
                    ctx.fill();
                    ctx.restore();
                }

                // Pulse effect
                const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
                const color = m.type === "pickup" ? "#00ff88" : "#ff6600";

                // Outer glow
                ctx.beginPath();
                ctx.arc(drawX, drawY, 8 * pulse, 0, Math.PI * 2);
                ctx.fillStyle =
                    m.type === "pickup"
                        ? `rgba(0, 255, 136, ${0.15 * pulse})`
                        : `rgba(255, 102, 0, ${0.15 * pulse})`;
                ctx.fill();

                // Inner dot
                ctx.beginPath();
                ctx.arc(drawX, drawY, 4, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();

                // Label
                if (dist < MAP_RADIUS - 10) {
                    ctx.fillStyle = color;
                    ctx.font = "bold 8px Rajdhani, sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText(
                        m.type === "pickup" ? "PICKUP" : "DROP",
                        drawX,
                        drawY - 10
                    );
                }
            });

            // Draw car (center)
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-carYaw + Math.PI / 2);

            // Car body
            ctx.fillStyle = "#00ccff";
            ctx.shadowColor = "#00ccff";
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(0, -7);
            ctx.lineTo(-4, 5);
            ctx.lineTo(0, 3);
            ctx.lineTo(4, 5);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();

            ctx.restore();

            // Border ring
            ctx.beginPath();
            ctx.arc(cx, cy, MAP_RADIUS - 1, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(0, 200, 255, 0.35)";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Outer glow ring
            ctx.beginPath();
            ctx.arc(cx, cy, MAP_RADIUS - 1, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(0, 200, 255, 0.08)";
            ctx.lineWidth = 4;
            ctx.stroke();

            // Compass labels
            ctx.fillStyle = "rgba(255,255,255,0.3)";
            ctx.font = "bold 9px Orbitron, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("N", cx, 14);
            ctx.fillText("S", cx, MAP_SIZE - 6);
            ctx.textAlign = "left";
            ctx.fillText("W", 6, cy + 3);
            ctx.textAlign = "right";
            ctx.fillText("E", MAP_SIZE - 6, cy + 3);
        };

        draw();
        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, []);

    return (
        <div
            style={{
                position: "fixed",
                top: 22,
                right: 22,
                zIndex: 100,
                borderRadius: "50%",
                overflow: "hidden",
                boxShadow:
                    "0 4px 30px rgba(0,0,0,0.5), 0 0 15px rgba(0,200,255,0.1), inset 0 0 20px rgba(0,0,0,0.3)",
            }}
        >
            <canvas ref={canvasRef} />
        </div>
    );
}

// ==============================
// MAIN HUD COMPONENT
// ==============================
function TaxiHUD() {
    const [loadingDone, setLoadingDone] = useState(false);
    const [taskData, setTaskData] = useState(null);
    const [earnings, setEarnings] = useState(0);
    const [tasksCompleted, setTasksCompleted] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [farePopup, setFarePopup] = useState(null);
    const [dirInfo, setDirInfo] = useState(null);
    const notifId = useRef(0);

    // Connect to game system via window bridge
    useEffect(() => {
        const onLoadingComplete = () => setLoadingDone(true);
        window.addEventListener("loadingComplete", onLoadingComplete);
        if (window.__loadingComplete) setLoadingDone(true);

        // Taxi game callbacks
        window.__taxiHUD_onTaskUpdate = (data) => {
            setTaskData(data);
            if (data.state === "completed" && data.totalFare) {
                setFarePopup({
                    fare: data.totalFare,
                    timeBonus: data.timeBonus || 0,
                });
            }
        };

        window.__taxiHUD_onEarningsUpdate = (e) => {
            setEarnings(e);
        };

        window.__taxiHUD_onNotification = (message, type) => {
            const id = ++notifId.current;
            setNotifications((prev) => [...prev, { id, message, type }]);
        };

        // Poll direction info
        const dirInterval = setInterval(() => {
            if (window.__taxiGetDirInfo) {
                const info = window.__taxiGetDirInfo();
                setDirInfo(info);
            }
            if (window.__taxiGetGameData) {
                const gd = window.__taxiGetGameData();
                if (gd) {
                    setEarnings(gd.totalEarnings);
                    setTasksCompleted(gd.tasksCompleted);
                }
            }
        }, 200);

        return () => {
            window.removeEventListener("loadingComplete", onLoadingComplete);
            clearInterval(dirInterval);
            window.__taxiHUD_onTaskUpdate = undefined;
            window.__taxiHUD_onEarningsUpdate = undefined;
            window.__taxiHUD_onNotification = undefined;
        };
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    if (!loadingDone) return null;

    const state = taskData?.state || "idle";
    const isIdle = !taskData || state === "idle" || state === "completed";
    const task = taskData?.task || null;
    const phase = taskData?.phase || null;

    return (
        <>
            {/* Inject keyframe animation */}
            <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }
      `}</style>

            {/* Task Panel or Idle Status */}
            {isIdle ? (
                <IdleStatus />
            ) : (
                <TaskPanel task={task} phase={phase} state={state} />
            )}

            {/* Earnings Panel */}
            <EarningsPanel earnings={earnings} tasksCompleted={tasksCompleted} />

            {/* Minimap */}
            <Minimap />

            {/* Distance Indicator */}
            {dirInfo && (
                <DistanceIndicator
                    distance={dirInfo.distance}
                    label={dirInfo.label}
                    color={dirInfo.color}
                />
            )}

            {/* Notifications */}
            <div
                style={{
                    position: "fixed",
                    top: 80,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 100002,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    pointerEvents: "none",
                }}
            >
                {notifications.map((n) => (
                    <NotificationToast
                        key={n.id}
                        message={n.message}
                        type={n.type}
                        onDone={() => removeNotification(n.id)}
                    />
                ))}
            </div>

            {/* Fare Complete Popup */}
            {farePopup && (
                <FareCompletePopup
                    fare={farePopup.fare}
                    timeBonus={farePopup.timeBonus}
                    onClose={() => setFarePopup(null)}
                />
            )}
        </>
    );
}

// Auto-mount
(function mountTaxiHUD() {
    if (typeof window === "undefined") return;
    const container = document.createElement("div");
    container.id = "taxi-hud-root";
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(<TaxiHUD />);
})();

export default TaxiHUD;

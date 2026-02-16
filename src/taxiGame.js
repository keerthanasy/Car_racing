import * as THREE from "three";

// =============================
// TAXI GAME SYSTEM
// =============================

// --- Location Database ---
// Named locations along the road curve with approximate X positions
const LOCATIONS = [
  { id: 0,  name: "Downtown Plaza",       x: 50,    z: 0,   district: "Downtown" },
  { id: 1,  name: "Central Station",       x: 0,     z: 0,   district: "Downtown" },
  { id: 2,  name: "West Market",           x: -100,  z: 0,   district: "Westside" },
  { id: 3,  name: "Oakwood Avenue",        x: -250,  z: 10,  district: "Westside" },
  { id: 4,  name: "Riverside Drive",       x: -450,  z: -20, district: "Riverside" },
  { id: 5,  name: "Elm Street",            x: -650,  z: 30,  district: "Midtown" },
  { id: 6,  name: "Harbor Point",          x: -850,  z: -30, district: "Harbor" },
  { id: 7,  name: "Sunset Boulevard",      x: -1050, z: 0,   district: "Sunset" },
  { id: 8,  name: "Pine Ridge Mall",       x: -1250, z: 0,   district: "North End" },
  { id: 9,  name: "Grand Theater",         x: -1450, z: 0,   district: "North End" },
  { id: 10, name: "Crystal Bay",           x: -1650, z: 20,  district: "Crystal" },
  { id: 11, name: "Willowbrook Park",      x: -1850, z: -20, district: "Crystal" },
  { id: 12, name: "Bridge Entrance",       x: -2050, z: 0,   district: "Bridge" },
  // After bridge
  { id: 13, name: "New Harbor District",   x: -3200, z: 0,   district: "New Harbor" },
  { id: 14, name: "Beacon Hill",           x: -3500, z: 20,  district: "New City" },
  { id: 15, name: "Marina Square",         x: -3800, z: -20, district: "New City" },
  { id: 16, name: "Skyline Tower",         x: -4100, z: 0,   district: "Skyline" },
  { id: 17, name: "Eclipse Avenue",        x: -4400, z: 20,  district: "Skyline" },
  { id: 18, name: "Starlight Terrace",     x: -4700, z: -20, district: "Starlight" },
  { id: 19, name: "End Point Station",     x: -5000, z: 0,   district: "Starlight" },
];

// --- NPC Passenger Names ---
const PASSENGER_NAMES = [
  "Alex Rivera",    "Jordan Lee",     "Sam Bennett",    "Casey Morgan",
  "Riley Parker",   "Taylor Brooks",  "Morgan Davis",   "Quinn Foster",
  "Avery Chen",     "Dakota Reyes",   "Skyler Patel",   "Jamie Cruz",
  "Charlie Woods",  "Sage Miller",    "Rowan Kim",      "Phoenix Gray",
  "Hayden Stone",   "Emery Walsh",    "Blair Nguyen",   "Finley Hart",
];

// --- NPC Appearances (color palettes for procedural characters) ---
const NPC_COLORS = [
  { body: 0x3498db, head: 0xf0dab4 }, // Blue outfit, light skin
  { body: 0xe74c3c, head: 0xd4a574 }, // Red outfit, medium skin
  { body: 0x2ecc71, head: 0xf0dab4 }, // Green outfit
  { body: 0x9b59b6, head: 0x8d6e4c }, // Purple outfit, dark skin
  { body: 0xf39c12, head: 0xf0dab4 }, // Orange outfit
  { body: 0x1abc9c, head: 0xd4a574 }, // Teal outfit
  { body: 0xe67e22, head: 0x8d6e4c }, // Dark orange outfit
  { body: 0x2980b9, head: 0xf0dab4 }, // Navy outfit
];

// Task states
const TASK_STATE = {
  IDLE: "idle",
  ASSIGNED: "assigned",         // Task given, drive to pickup
  ARRIVING: "arriving",         // Near pickup zone
  PICKED_UP: "picked_up",       // Passenger aboard, drive to dropoff
  NEAR_DROPOFF: "near_dropoff", // Near dropoff zone
  COMPLETED: "completed",       // Successfully dropped off
};

export class TaxiGame {
  constructor({ scene, roadCurve }) {
    this.scene = scene;
    this.roadCurve = roadCurve;
    
    // Game state
    this.state = TASK_STATE.IDLE;
    this.currentTask = null;
    this.completedTasks = [];
    this.totalEarnings = 0;
    this.tasksCompleted = 0;
    this.taskQueue = [];
    this.usedPassengerNames = new Set();
    
    // 3D objects
    this.pickupMarker = null;
    this.dropoffMarker = null;
    this.npcMesh = null;
    this.pickupBeacon = null;
    this.dropoffBeacon = null;
    this.pickupArrow = null;
    this.dropoffArrow = null;
    
    // Proximity settings
    this.pickupRadius = 15;
    this.dropoffRadius = 15;
    
    // Internal clock
    this.elapsedTime = 0;
    this.taskTimer = 0;
    
    // UI callback
    this.onTaskUpdate = null; // function(taskData) called on state changes
    this.onEarningsUpdate = null; // function(earnings)
    this.onNotification = null; // function(message, type)
    
    // Initialize markers
    this._createMarkers();
    
    // Generate first task after a delay
    this._taskCooldown = 3; // seconds before first task
    this._taskCooldownTimer = 0;
    
    // Arrow animation
    this._arrowBobTime = 0;
  }

  _createMarkers() {
    // --- Pickup Marker (Green glowing cylinder + beacon) ---
    const pickupGroup = new THREE.Group();
    
    // Ground ring
    const ringGeo = new THREE.RingGeometry(3, 4, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    pickupGroup.add(ring);
    
    // Inner glow disc
    const discGeo = new THREE.CircleGeometry(3, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.05;
    pickupGroup.add(disc);
    
    // Vertical beacon light pillar
    const beaconGeo = new THREE.CylinderGeometry(0.15, 0.15, 30, 8);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.25,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 15;
    pickupGroup.add(beacon);
    this.pickupBeacon = beacon;
    
    // Floating arrow above pickup
    const arrowGroup = new THREE.Group();
    const arrowGeo = new THREE.ConeGeometry(1, 2, 4);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.rotation.x = Math.PI; // Point downward
    arrowGroup.add(arrow);
    arrowGroup.position.y = 8;
    pickupGroup.add(arrowGroup);
    this.pickupArrow = arrowGroup;
    
    pickupGroup.visible = false;
    this.scene.add(pickupGroup);
    this.pickupMarker = pickupGroup;
    
    // --- Dropoff Marker (Orange/Red glowing) ---
    const dropoffGroup = new THREE.Group();
    
    // Ground ring
    const dRingGeo = new THREE.RingGeometry(3, 4, 32);
    const dRingMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const dRing = new THREE.Mesh(dRingGeo, dRingMat);
    dRing.rotation.x = -Math.PI / 2;
    dRing.position.y = 0.1;
    dropoffGroup.add(dRing);
    
    // Inner glow disc
    const dDiscGeo = new THREE.CircleGeometry(3, 32);
    const dDiscMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const dDisc = new THREE.Mesh(dDiscGeo, dDiscMat);
    dDisc.rotation.x = -Math.PI / 2;
    dDisc.position.y = 0.05;
    dropoffGroup.add(dDisc);
    
    // Vertical beacon
    const dBeaconGeo = new THREE.CylinderGeometry(0.15, 0.15, 30, 8);
    const dBeaconMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.25,
    });
    const dBeacon = new THREE.Mesh(dBeaconGeo, dBeaconMat);
    dBeacon.position.y = 15;
    dropoffGroup.add(dBeacon);
    this.dropoffBeacon = dBeacon;
    
    // Floating arrow
    const dArrowGroup = new THREE.Group();
    const dArrowGeo = new THREE.ConeGeometry(1, 2, 4);
    const dArrowMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    const dArrow = new THREE.Mesh(dArrowGeo, dArrowMat);
    dArrow.rotation.x = Math.PI;
    dArrowGroup.add(dArrow);
    dArrowGroup.position.y = 8;
    dropoffGroup.add(dArrowGroup);
    this.dropoffArrow = dArrowGroup;
    
    dropoffGroup.visible = false;
    this.scene.add(dropoffGroup);
    this.dropoffMarker = dropoffGroup;
    
    // --- NPC Mesh (simple procedural character) ---
    this.npcGroup = new THREE.Group();
    this._buildNPCMesh(NPC_COLORS[0]);
    this.npcGroup.visible = false;
    this.scene.add(this.npcGroup);
  }

  _buildNPCMesh(colors) {
    // Clear previous children
    while (this.npcGroup.children.length) {
      this.npcGroup.remove(this.npcGroup.children[0]);
    }
    
    // Body (cylinder)
    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.5, 1.4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: colors.body,
      roughness: 0.6,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.0;
    this.npcGroup.add(body);
    
    // Head (sphere)
    const headGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const headMat = new THREE.MeshStandardMaterial({
      color: colors.head,
      roughness: 0.7,
      metalness: 0.0,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.05;
    this.npcGroup.add(head);
    
    // "Taxi!" arm wave (simple cylinder arm raised)
    const armGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.7, 6);
    const armMat = new THREE.MeshStandardMaterial({
      color: colors.body,
      roughness: 0.6,
    });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(0.5, 1.8, 0);
    arm.rotation.z = -Math.PI / 4; // Raised arm
    this.npcGroup.add(arm);
    
    // Hand
    const handGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const handMat = new THREE.MeshStandardMaterial({ color: colors.head, roughness: 0.7 });
    const hand = new THREE.Mesh(handGeo, handMat);
    hand.position.set(0.85, 2.15, 0);
    this.npcGroup.add(hand);
    
    // Floating name label (created via canvas texture)
    // We'll update this per-task
  }

  _getRandomPassengerName() {
    const available = PASSENGER_NAMES.filter(n => !this.usedPassengerNames.has(n));
    if (available.length === 0) {
      this.usedPassengerNames.clear();
      return PASSENGER_NAMES[Math.floor(Math.random() * PASSENGER_NAMES.length)];
    }
    const name = available[Math.floor(Math.random() * available.length)];
    this.usedPassengerNames.add(name);
    return name;
  }

  _getRandomLocation(excludeId = -1) {
    const available = LOCATIONS.filter(l => l.id !== excludeId);
    return available[Math.floor(Math.random() * available.length)];
  }

  _getLocationWorldPos(location) {
    // Find closest point on road curve to the location's X
    // Sample the curve and find the closest point
    const samples = 200;
    let bestPoint = null;
    let bestDist = Infinity;
    
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = this.roadCurve.getPointAt(t);
      const dx = point.x - location.x;
      const dz = point.z - location.z;
      const dist = dx * dx + dz * dz;
      if (dist < bestDist) {
        bestDist = dist;
        bestPoint = point.clone();
      }
    }
    
    // Offset slightly to the side of the road
    if (bestPoint) {
      const t = this._getCurveT(bestPoint.x);
      const tangent = this.roadCurve.getTangentAt(Math.max(0, Math.min(1, t)));
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
      // Place on the right side of the road
      bestPoint.add(right.clone().multiplyScalar(7));
      bestPoint.y = 0.1;
    }
    
    return bestPoint || new THREE.Vector3(location.x, 0.1, location.z);
  }

  _getCurveT(targetX) {
    // Binary search for approximate t where curve.x ≈ targetX
    const samples = 200;
    let bestT = 0;
    let bestDist = Infinity;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = this.roadCurve.getPointAt(t);
      const dist = Math.abs(point.x - targetX);
      if (dist < bestDist) {
        bestDist = dist;
        bestT = t;
      }
    }
    return bestT;
  }

  _calculateFare(pickup, dropoff) {
    const distance = Math.abs(pickup.x - dropoff.x);
    // Base fare + distance-based fare
    const baseFare = 50;
    const distanceFare = Math.floor(distance / 10) * 5;
    const bonus = Math.random() > 0.7 ? Math.floor(Math.random() * 50) + 20 : 0;
    return baseFare + distanceFare + bonus;
  }

  generateTask() {
    const pickup = this._getRandomLocation();
    const dropoff = this._getRandomLocation(pickup.id);
    const passenger = this._getRandomPassengerName();
    const colorIndex = Math.floor(Math.random() * NPC_COLORS.length);
    const fare = this._calculateFare(pickup, dropoff);
    
    const task = {
      id: Date.now(),
      passenger,
      pickup,
      dropoff,
      fare,
      colorIndex,
      pickupPos: this._getLocationWorldPos(pickup),
      dropoffPos: this._getLocationWorldPos(dropoff),
      timeStarted: this.elapsedTime,
      timeBonus: 0,
    };
    
    return task;
  }

  assignTask(task) {
    this.currentTask = task;
    this.state = TASK_STATE.ASSIGNED;
    this.taskTimer = 0;
    
    // Show pickup marker
    this.pickupMarker.position.copy(task.pickupPos);
    this.pickupMarker.visible = true;
    this.dropoffMarker.visible = false;
    
    // Show NPC at pickup
    this._buildNPCMesh(NPC_COLORS[task.colorIndex]);
    this.npcGroup.position.copy(task.pickupPos);
    this.npcGroup.position.y = 0;
    this.npcGroup.visible = true;
    
    // Notify UI
    if (this.onTaskUpdate) {
      this.onTaskUpdate({
        state: this.state,
        task: this.currentTask,
        phase: "pickup",
      });
    }
    
    if (this.onNotification) {
      this.onNotification(`📍 New Fare! Pick up ${task.passenger} at ${task.pickup.name}`, "info");
    }
  }

  _pickupPassenger() {
    this.state = TASK_STATE.PICKED_UP;
    
    // Hide pickup marker and NPC
    this.pickupMarker.visible = false;
    this.npcGroup.visible = false;
    
    // Show dropoff marker
    this.dropoffMarker.position.copy(this.currentTask.dropoffPos);
    this.dropoffMarker.visible = true;
    
    if (this.onTaskUpdate) {
      this.onTaskUpdate({
        state: this.state,
        task: this.currentTask,
        phase: "dropoff",
      });
    }
    
    if (this.onNotification) {
      this.onNotification(`✅ ${this.currentTask.passenger} picked up! Head to ${this.currentTask.dropoff.name}`, "success");
    }
  }

  _dropoffPassenger() {
    this.state = TASK_STATE.COMPLETED;
    
    // Calculate time bonus
    const timeTaken = this.elapsedTime - this.currentTask.timeStarted;
    let timeBonus = 0;
    if (timeTaken < 30) timeBonus = 100;
    else if (timeTaken < 60) timeBonus = 50;
    else if (timeTaken < 90) timeBonus = 25;
    
    const totalFare = this.currentTask.fare + timeBonus;
    this.totalEarnings += totalFare;
    this.tasksCompleted++;
    
    // Hide markers
    this.dropoffMarker.visible = false;
    
    // Show NPC at dropoff briefly
    this.npcGroup.position.copy(this.currentTask.dropoffPos);
    this.npcGroup.position.y = 0;
    this.npcGroup.visible = true;
    
    // Hide NPC after 2 seconds
    setTimeout(() => {
      this.npcGroup.visible = false;
    }, 2000);
    
    this.completedTasks.push({
      ...this.currentTask,
      timeBonus,
      totalFare,
      timeTaken,
    });
    
    if (this.onTaskUpdate) {
      this.onTaskUpdate({
        state: this.state,
        task: this.currentTask,
        totalFare,
        timeBonus,
      });
    }
    
    if (this.onEarningsUpdate) {
      this.onEarningsUpdate(this.totalEarnings);
    }
    
    if (this.onNotification) {
      let msg = `💰 Fare complete! Earned $${totalFare}`;
      if (timeBonus > 0) msg += ` (Speed bonus: +$${timeBonus})`;
      this.onNotification(msg, "success");
    }
    
    // Reset to idle and schedule next task
    this.currentTask = null;
    this.state = TASK_STATE.IDLE;
    this._taskCooldownTimer = 0;
    this._taskCooldown = 3 + Math.random() * 4; // 3-7 seconds between tasks
  }

  update(delta, carPosition) {
    this.elapsedTime += delta;
    this._arrowBobTime += delta;
    
    // Animate markers
    this._animateMarkers(delta);
    
    // State machine
    switch (this.state) {
      case TASK_STATE.IDLE:
        this._taskCooldownTimer += delta;
        if (this._taskCooldownTimer >= this._taskCooldown) {
          const task = this.generateTask();
          this.assignTask(task);
        }
        break;
        
      case TASK_STATE.ASSIGNED:
        // Check if car is near pickup
        if (carPosition && this.currentTask) {
          const dist = carPosition.distanceTo(this.currentTask.pickupPos);
          if (dist < this.pickupRadius) {
            this._pickupPassenger();
          }
        }
        break;
        
      case TASK_STATE.PICKED_UP:
        // Check if car is near dropoff
        this.taskTimer += delta;
        if (carPosition && this.currentTask) {
          const dist = carPosition.distanceTo(this.currentTask.dropoffPos);
          if (dist < this.dropoffRadius) {
            this._dropoffPassenger();
          }
        }
        break;
    }
    
    // Make NPC face the car
    if (this.npcGroup.visible && carPosition) {
      const dir = new THREE.Vector3()
        .subVectors(carPosition, this.npcGroup.position)
        .setY(0)
        .normalize();
      if (dir.length() > 0.01) {
        this.npcGroup.lookAt(
          carPosition.x,
          this.npcGroup.position.y,
          carPosition.z
        );
      }
    }
  }

  _animateMarkers(delta) {
    const t = this._arrowBobTime;
    
    // Bob arrows up/down
    if (this.pickupArrow && this.pickupMarker.visible) {
      this.pickupArrow.position.y = 6 + Math.sin(t * 3) * 1.5;
      this.pickupArrow.rotation.y += delta * 2;
    }
    if (this.dropoffArrow && this.dropoffMarker.visible) {
      this.dropoffArrow.position.y = 6 + Math.sin(t * 3 + Math.PI) * 1.5;
      this.dropoffArrow.rotation.y += delta * 2;
    }
    
    // Pulse beacon opacity
    if (this.pickupBeacon && this.pickupMarker.visible) {
      this.pickupBeacon.material.opacity = 0.15 + Math.sin(t * 4) * 0.1;
    }
    if (this.dropoffBeacon && this.dropoffMarker.visible) {
      this.dropoffBeacon.material.opacity = 0.15 + Math.sin(t * 4) * 0.1;
    }
    
    // Rotate pickup ring
    if (this.pickupMarker.visible) {
      const ring = this.pickupMarker.children[0]; // ground ring
      if (ring) ring.rotation.z += delta * 0.5;
    }
    if (this.dropoffMarker.visible) {
      const ring = this.dropoffMarker.children[0];
      if (ring) ring.rotation.z += delta * 0.5;
    }
    
    // NPC wave animation
    if (this.npcGroup.visible && this.npcGroup.children.length >= 3) {
      const arm = this.npcGroup.children[2]; // Arm mesh
      if (arm) {
        arm.rotation.z = -Math.PI / 4 + Math.sin(t * 5) * 0.3;
      }
    }
  }

  // Get direction info for HUD compass/arrow
  getDirectionTo(carPosition) {
    if (!carPosition) return null;
    
    let target = null;
    let label = "";
    let color = "#00ff88";
    
    if (this.state === TASK_STATE.ASSIGNED && this.currentTask) {
      target = this.currentTask.pickupPos;
      label = this.currentTask.pickup.name;
      color = "#00ff88";
    } else if (this.state === TASK_STATE.PICKED_UP && this.currentTask) {
      target = this.currentTask.dropoffPos;
      label = this.currentTask.dropoff.name;
      color = "#ff6600";
    }
    
    if (!target) return null;
    
    const dir = new THREE.Vector3().subVectors(target, carPosition);
    const distance = dir.length();
    dir.normalize();
    
    return { direction: dir, distance, label, color };
  }

  // Get current game data for HUD
  getGameData() {
    return {
      state: this.state,
      currentTask: this.currentTask,
      totalEarnings: this.totalEarnings,
      tasksCompleted: this.tasksCompleted,
      elapsedTime: this.elapsedTime,
    };
  }
}

export { TASK_STATE, LOCATIONS };

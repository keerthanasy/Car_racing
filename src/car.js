import * as THREE from "three";
import * as CANNON from "cannon-es";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class Car {
  constructor({ scene, world, wheelMaterial }) {
    this.scene = scene;
    this.world = world;
    this.wheelMaterial = wheelMaterial;

    this.phongInvisible = new THREE.MeshPhongMaterial({ color: 0x00ff00, visible: false });

    // Visual chassis placeholder
    this.carBodyGeometry = new THREE.BoxGeometry(2, 1, 4);
    this.mesh = new THREE.Mesh(this.carBodyGeometry, this.phongInvisible);
    this.mesh.position.y = 3;
    this.scene.add(this.mesh);

    this.carModel = undefined;
    const carLoader = new GLTFLoader();
    carLoader.load("./car_lab.glb", (gltf) => {
      this.carModel = gltf.scene;
      this.mesh.add(this.carModel);
      this.carModel.rotation.y = Math.PI;
    });

    // Physics chassis (will be used by RaycastVehicle)
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 2));
    this.body = new CANNON.Body({ mass: 250, material: new CANNON.Material({ friction: 0 }) });
    this.body.addShape(chassisShape);
    this.body.position.set(this.mesh.position.x, this.mesh.position.y - 0.5, this.mesh.position.z);
    this.body.linearDamping = 0.2;
    this.body.angularDamping = 0.5;
    this.world.addBody(this.body);

    this.wheelLFMesh = this.createWheelMesh();
    this.wheelRFMesh = this.createWheelMesh();
    this.wheelLBMesh = this.createWheelMesh();
    this.wheelRBMesh = this.createWheelMesh();

    this.loadWheelGLTF(this.wheelLFMesh);
    this.loadWheelGLTF(this.wheelRFMesh);
    this.loadWheelGLTF(this.wheelLBMesh);
    this.loadWheelGLTF(this.wheelRBMesh);

    // Build RaycastVehicle (suspension prevents jumping at high speed)
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.body,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    const halfTrack = 1.05; 
    const halfWB = 1.4;
    const wheelRadius = 0.38; 
    const connectionHeight = -0.35;

    // Manual adjustment for wheels
    this.leftSideCorrection = -0.02; 
    this.rightSideCorrection = 0.3;
    this.halfTrack = halfTrack;
    this.halfWB = halfWB;
    this.connectionHeight = connectionHeight;

    // FL (Left) -> +X normally. Apply correction.
    const flX = this.halfTrack + this.leftSideCorrection;
    // RL (Left) -> +X normally. Apply correction.
    const rlX = this.halfTrack + this.leftSideCorrection;
    
    // Right side stays at normal width + correction (Right is -X)
    // To move Right wheels Closer to center (left/positive), we ADD to negative value.
    // To move Right wheels Further out (right/negative), we SUBTRACT.
    // Let's create a variable for it.
    const frX = -this.halfTrack + this.rightSideCorrection; 
    const rrX = -this.halfTrack + this.rightSideCorrection;

    const baseWheel = {
      radius: wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 55,
      suspensionRestLength: 0.3,
      frictionSlip: 30,
      dampingRelaxation: 2.3,
      dampingCompression: 4.3,
      maxSuspensionForce: 10000,
      rollInfluence: 0.01,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      maxSuspensionTravel: 1,
      customSlidingRotationalSpeed: 30,
    };

    // FL
    this.vehicle.addWheel({
      ...baseWheel,
      chassisConnectionPointLocal: new CANNON.Vec3(flX, connectionHeight, -halfWB),
    });
    // FR
    this.vehicle.addWheel({
      
      ...baseWheel,
      chassisConnectionPointLocal: new CANNON.Vec3(frX, connectionHeight, -halfWB),
    });
    // RL
    this.vehicle.addWheel({
      ...baseWheel,
      chassisConnectionPointLocal: new CANNON.Vec3(rlX, connectionHeight, halfWB),
    });
    // RR
    this.vehicle.addWheel({
      ...baseWheel,
      chassisConnectionPointLocal: new CANNON.Vec3(rrX, connectionHeight, halfWB),
    });

    this.vehicle.addToWorld(this.world);

    // Controls tuning
    this.maxEngineForce = 750;
    this.brakeForce = 12; // softer default braking to avoid instant lock
    this.slowDownForce = 19.6;
    this.maxSteerVal = 0.3;
    this.isBraking = false;
    // Progressive braking control
    this.targetBrake = 0;    // 0..1 desired
    this.currentBrake = 0;   // 0..1 applied
    this.brakeRampUp = 8;    // per second towards 1
    this.brakeRampDown = 12; // per second towards 0
    this.normalFriction = 30;
    this.brakingFriction = 8;

    // Upright stabilization params
    this.uprightAlignK = 150;   // torque gain to align up vector
    this.uprightDampK = 8;      // damping for roll/pitch angular velocity

    // Visual Offsets
    // Physics X is inverted. 
    // FL (Left): Physics = flX (+ val). Visual X = -flX.
    // FR (Right): Physics = frX (- val). Visual X = -frX (+ val).
    // Note: If frX is negative (normal), -frX is positive.
    this.wheelVisualOffsets = {
      lf: new THREE.Vector3(-flX, connectionHeight, -halfWB),
      rf: new THREE.Vector3(-frX, connectionHeight, -halfWB), // -(-val) = +val
      lb: new THREE.Vector3(-rlX, connectionHeight, halfWB),
      rb: new THREE.Vector3(-rrX, connectionHeight, halfWB),
    };
  }

  // Returns true if the car's up vector is largely opposite to world up
  isUpsideDown(thresholdDot = 0.2) {
    if (!this.body) return false;
    const localUp = new CANNON.Vec3(0, 1, 0);
    const upWorld = new CANNON.Vec3();
    this.body.quaternion.vmult(localUp, upWorld);
    return upWorld.dot(new CANNON.Vec3(0, 1, 0)) < thresholdDot;
  }

  // Recover to upright while preserving current yaw/heading
  recoverUpright(lift = 0.6) {
    if (!this.body) return;
    // Determine yaw from current forward vector (local +Z)
    const localFwd = new CANNON.Vec3(0, 0, 1);
    const fwdWorld = new CANNON.Vec3();
    this.body.quaternion.vmult(localFwd, fwdWorld);
    // project to XZ plane
    fwdWorld.y = 0;
    if (fwdWorld.lengthSquared() < 1e-4) {
      fwdWorld.set(0, 0, 1);
    }
    const yaw = Math.atan2(fwdWorld.x, fwdWorld.z);
    const q = new CANNON.Quaternion();
    q.setFromEuler(0, yaw, 0, "XYZ");
    this.body.quaternion.copy(q);
    // small lift to avoid intersecting the ground
    this.body.position.y = Math.max(this.body.position.y, lift);
    // reset velocities
    this.body.angularVelocity.set(0, 0, 0);
    this.body.velocity.set(0, this.body.velocity.y * 0.2, 0);
  }

  // Keep chassis upright by applying corrective torque each frame
  updateUprightStabilization(delta) {
    if (!this.body) return;
    const worldUp = new CANNON.Vec3(0, 1, 0);
    const localUp = new CANNON.Vec3(0, 1, 0);
    const upWorld = new CANNON.Vec3();
    this.body.quaternion.vmult(localUp, upWorld);
    // Torque to align upWorld to worldUp: proportional to cross product
    const errorAxis = new CANNON.Vec3();
    upWorld.cross(worldUp, errorAxis); // axis to rotate around
    // Scale torque
    const alignTorque = errorAxis.scale(this.uprightAlignK);
    this.body.torque.vadd(alignTorque, this.body.torque);

    // Dampen roll/pitch angular velocity (remove yaw component first)
    const angVel = this.body.angularVelocity.clone();
    const yawComponent = worldUp.scale(angVel.dot(worldUp));
    const rollPitch = angVel.vsub(yawComponent);
    const dampTorque = rollPitch.scale(-this.uprightDampK);
    this.body.torque.vadd(dampTorque, this.body.torque);
  }

  createWheelMesh() {
    const geo = new THREE.CylinderGeometry(0.33, 0.33, 0.2);
    geo.rotateZ(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, this.phongInvisible);
    this.scene.add(mesh);
    return mesh;
  }

  loadWheelGLTF(parentMesh) {
    const loader = new GLTFLoader();
    loader.load("./wheel_lab.glb", (gltf) => {
      const wheelMesh = gltf.scene;
      parentMesh.add(wheelMesh);
    });
  }

  // Raycast vehicle does not use rigid wheel bodies
  createWheelBody() { return null; }

  updateVisualOnlyPositions() {
    const tmp = new THREE.Vector3();
    tmp.copy(this.wheelVisualOffsets.lf).applyQuaternion(this.mesh.quaternion);
    this.wheelLFMesh.position.copy(this.mesh.position).add(tmp);
    this.wheelLFMesh.quaternion.copy(this.mesh.quaternion);

    tmp.copy(this.wheelVisualOffsets.rf).applyQuaternion(this.mesh.quaternion);
    this.wheelRFMesh.position.copy(this.mesh.position).add(tmp);
    this.wheelRFMesh.quaternion.copy(this.mesh.quaternion);

    tmp.copy(this.wheelVisualOffsets.lb).applyQuaternion(this.mesh.quaternion);
    this.wheelLBMesh.position.copy(this.mesh.position).add(tmp);
    this.wheelLBMesh.quaternion.copy(this.mesh.quaternion);

    tmp.copy(this.wheelVisualOffsets.rb).applyQuaternion(this.mesh.quaternion);
    this.wheelRBMesh.position.copy(this.mesh.position).add(tmp);
    this.wheelRBMesh.quaternion.copy(this.mesh.quaternion);
  }

  syncWheelMeshesFromBodies() {
    if (!this.vehicle || !this.vehicle.wheelInfos) return;
    const infos = this.vehicle.wheelInfos;
    // Map: 0: FL, 1: FR, 2: RL, 3: RR
    const meshes = [this.wheelLFMesh, this.wheelRFMesh, this.wheelLBMesh, this.wheelRBMesh];
    for (let i = 0; i < infos.length && i < meshes.length; i++) {
      this.vehicle.updateWheelTransform(i);
      const wt = infos[i].worldTransform;
      meshes[i].position.copy(wt.position);
      meshes[i].quaternion.copy(wt.quaternion);
    }
  }

  setForwardVelocity(v) {
    // Map velocity command to engine force
    const scaled = Math.max(-20, Math.min(20, v));
    let engine = (scaled / 20) * this.maxEngineForce; // W positive => forward force
    // Reduce engine as braking increases
    engine *= (1 - this.currentBrake);
    // Apply on all wheels for AWD, or only rear (2,3) for RWD
    this.vehicle.applyEngineForce(engine, 0);
    this.vehicle.applyEngineForce(engine, 1);
    this.vehicle.applyEngineForce(engine, 2);
    this.vehicle.applyEngineForce(engine, 3);
    // Release brakes when applying throttle
    if (!this.isBraking) {
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
    }
  }

  setRightVelocity(v) {
    // Map [-0.1..0.1] to [-maxSteer..maxSteer]
    const steer = -Math.max(-0.2, Math.min(0.2, v)) / 0.2 * this.maxSteerVal;
    // steer front wheels only
    if (this.vehicle) {
      this.vehicle.setSteeringValue(steer, 0);
      this.vehicle.setSteeringValue(steer, 1);
      // rear wheels no steer
      this.vehicle.setSteeringValue(0, 2);
      this.vehicle.setSteeringValue(0, 3);
    }
  }

  setPosition(x, y, z, yawRadians = 0) {
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.set(0, yawRadians, 0);
    this.body.position.set(x, y, z);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    const q = new CANNON.Quaternion();
    q.setFromEuler(0, yawRadians, 0, "XYZ");
    this.body.quaternion.copy(q);
  }

  setRotation(yawRad = 0, pitchRad = 0, rollRad = 0) {
    this.mesh.rotation.set(pitchRad, yawRad, rollRad);
    const q = new CANNON.Quaternion();
    q.setFromEuler(pitchRad, yawRad, rollRad, "XYZ");
    this.body.quaternion.copy(q);
    this.body.angularVelocity.set(0, 0, 0);
  }

  setRotationDegrees(yawDeg = 0, pitchDeg = 0, rollDeg = 0) {
    const toRad = (d) => (d * Math.PI) / 180;
    this.setRotation(toRad(yawDeg), toRad(pitchDeg), toRad(rollDeg));
  }

  enablePhysicsNow() {
    // Nothing special needed for raycast vehicle, ensure stable initial step
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
  }

  getSpeedMetersPerSecond() {
    return this.body.velocity.length();
  }

  setBrake(force) {
    const f = Math.max(0, force);
    // Front-biased braking to improve stability and reduce rear lift
    const front = f;       // 100% on front
    const rear = f * 0.6;  // 60% on rear
    this.vehicle.setBrake(front, 0); // FL
    this.vehicle.setBrake(front, 1); // FR
    this.vehicle.setBrake(rear, 2);  // RL
    this.vehicle.setBrake(rear, 3);  // RR
  }

  applyBrake(isBraking) {
    this.isBraking = !!isBraking;
    this.targetBrake = this.isBraking ? 1 : 0;
  }

  updateBraking(delta) {
    // Smoothly approach targetBrake
    const rate = this.targetBrake > this.currentBrake ? this.brakeRampUp : this.brakeRampDown;
    this.currentBrake += (this.targetBrake - this.currentBrake) * Math.min(1, rate * Math.max(0, delta));
    // Apply brake force and friction adjustment
    const applied = this.brakeForce * this.currentBrake;
    this.setBrake(applied);
    if (this.vehicle && this.vehicle.wheelInfos) {
      const slip = this.isBraking ? this.brakingFriction : this.normalFriction;
      for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
        this.vehicle.wheelInfos[i].frictionSlip = slip;
      }
    }
  }

  updateWheelPosition(index, x, y, z) {
    if (!this.vehicle || !this.vehicle.wheelInfos[index]) return;

    // Update Physics
    this.vehicle.wheelInfos[index].chassisConnectionPointLocal.set(x, y, z);

    // Update Visual Offsets
    // FL (0): Phys X=1.1, Vis X=-1.1
    // FR (1): Phys X=-1.1, Vis X=1.1
    // RL (2): Phys X=1.1, Vis X=-1.1
    // RR (3): Phys X=-1.1, Vis X=1.1
    // So Visual X = -Physics X for these specific indices if we assume symmetry
    // However, let's just use -x for now as per current observation
    
    // Invert X for visual
    const visualX = -x;
    const visualY = y; 
    // Z seems consistent: -1.8 for FL (phys) and -1.8 for FL (vis)
    // Wait, let's recheck Z
    // FL Phys: -halfWB + 0.1 = -1.9 + 0.1 = -1.8
    // FL Vis: -1.8
    // So Z is matching (no inversion)
    const visualZ = z;

    const keys = ['lf', 'rf', 'lb', 'rb'];
    if (this.wheelVisualOffsets && this.wheelVisualOffsets[keys[index]]) {
        this.wheelVisualOffsets[keys[index]].set(visualX, visualY, visualZ);
    }
  }

  updateLeftSideCorrection(val) {
      if (!this.vehicle || !this.vehicle.wheelInfos) return;
      this.leftSideCorrection = val;
      
      const flX = this.halfTrack + this.leftSideCorrection;
      const rlX = this.halfTrack + this.leftSideCorrection;

      // Update FL (Index 0)
      this.updateWheelPosition(0, flX, this.connectionHeight, -this.halfWB);
      // Update RL (Index 2)
      this.updateWheelPosition(2, rlX, this.connectionHeight, this.halfWB);
  }

  updateRightSideCorrection(val) {
      if (!this.vehicle || !this.vehicle.wheelInfos) return;
      this.rightSideCorrection = val;
      
      const frX = -this.halfTrack + this.rightSideCorrection;
      const rrX = -this.halfTrack + this.rightSideCorrection;

      // Update FR (Index 1)
      this.updateWheelPosition(1, frX, this.connectionHeight, -this.halfWB);
      // Update RR (Index 3)
      this.updateWheelPosition(3, rrX, this.connectionHeight, this.halfWB);
  }
}

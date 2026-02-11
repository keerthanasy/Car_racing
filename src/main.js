import * as THREE from "three";
import Stats from "stats-js";
import { GUI } from "dat.gui";
import * as CANNON from "cannon-es";
import CannonDebugRenderer from "cannon-es-debugger";
import "./EnterPanelR3F.jsx";
import "./speedometer.jsx";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
// FakeGlowMaterial import removed
import { Car } from "./car.js";
import { createPlane } from "./intro.js";

const scene = new THREE.Scene();

const light = new THREE.DirectionalLight();
light.position.set(25, 25, 25);
scene.add(light);

//add ambient light
const ambientLight = new THREE.AmbientLight(0x403050, 0.5); // Cooler, dimmer ambient for contrast
scene.add(ambientLight);

// Sunset Fog
scene.fog = new THREE.FogExp2(0x200f30, 0.002);


const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// Create audio listener for 3D audio
const audioListener = new THREE.AudioListener();
camera.add(audioListener);

// Enter panel will show by default

const car = new THREE.Group();
scene.add(car);

const chaseCam = new THREE.Object3D();
chaseCam.position.set(0, 0, 0);

const chaseCamPivot = new THREE.Object3D();
chaseCamPivot.position.set(0, 1, 4);
chaseCamPivot.rotation.set(0, 30, 0);
chaseCam.add(chaseCamPivot);
scene.add(chaseCam);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
// renderer.shadowMap.enabled = true
// renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.appendChild(renderer.domElement);
renderer.intensity = 0.5;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;

// Sky shader removed


const phongMaterial = new THREE.MeshPhongMaterial({
  color: 0x00ff00,
  visible: false,
});

const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

// improve solver stability (higher iterations for better high-speed stability)
world.solver.iterations = 15;
world.solver.tolerance = 0.001;

// fixed-step params (used in the animate loop)
const FIXED_TIME_STEP = 1 / 60;
const MAX_SUB_STEPS = 3;

const groundMaterial = new CANNON.Material("groundMaterial");
groundMaterial.friction = 0.25;
groundMaterial.restitution = 0.0;

const wheelMaterial = new CANNON.Material("wheelMaterial");
wheelMaterial.friction = 0.25;
wheelMaterial.restitution = 0.0;

// Material for road cylinders (speed breakers)
const cylinderMaterial = new CANNON.Material("cylinderMaterial");
cylinderMaterial.friction = 0.3;
cylinderMaterial.restitution = 0.0;

// Contact material for wheel-cylinder interactions to prevent jumping at high speed
const wheelCylinderContact = new CANNON.ContactMaterial(wheelMaterial, cylinderMaterial, {
  friction: 0.4,
  restitution: 0.0,
  contactEquationStiffness: 1e8, // High stiffness for stable contact
  contactEquationRelaxation: 4, // Lower relaxation for smoother response
  frictionEquationStiffness: 1e8,
  frictionEquationRelaxation: 3,
});
world.addContactMaterial(wheelCylinderContact);

// Ground with PBR road textures (width increased to 100)
// Defines a curved path for the road
const curve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(200, 0, 0),
  new THREE.Vector3(50, 0, 0),
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(-100, 0, 0),
  new THREE.Vector3(-200, 0, 40),
  new THREE.Vector3(-400, 0, -40),
  new THREE.Vector3(-600, 0, 60),
  new THREE.Vector3(-800, 0, -60),
  new THREE.Vector3(-1000, 0, 0),
  new THREE.Vector3(-1200, 0, 0),
]);

// Helper to visualize the curve (optional, for debugging)
// const curvePoints = curve.getPoints(50);
// const curveGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
// const curveMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
// scene.add(new THREE.Line(curveGeo, curveMat));

// Custom Ribbon Geometry generation for perfect UV control
const roadWidth = 18;
const roadSegments = 400;
const roadWidthHalf = roadWidth / 2;
const roadGeoPoints = curve.getSpacedPoints(roadSegments);
const roadGeometry = new THREE.BufferGeometry();

const positions = [];
const uvs = [];
const indices = [];

for (let i = 0; i < roadSegments; i++) {
  const p = roadGeoPoints[i];
  const nextP = roadGeoPoints[ Math.min(i + 1, roadSegments - 1) ];
  
  // Calculate forward (tangent) and right vectors
  // Simple tangent approach
  const tangent = new THREE.Vector3().subVectors(nextP, p).normalize();
  if (i === roadSegments - 1) {
      // Use previous tangent for last point
      const prevP = roadGeoPoints[i-1];
      tangent.subVectors(p, prevP).normalize();
  }
  
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
  
  // Left and Right vertices
  const pL = new THREE.Vector3().copy(p).add(right.clone().multiplyScalar(-roadWidthHalf));
  const pR = new THREE.Vector3().copy(p).add(right.clone().multiplyScalar(roadWidthHalf));
  
  // Add vertices
  // We need to keep adding them to flat array
  positions.push(pL.x, pL.y, pL.z);
  positions.push(pR.x, pR.y, pR.z);
  
  // UVs
  // u = 0 (left) to 1 (right)
  // v = i / roadSegments (length progress)
  const vProgress = i / roadSegments;
  uvs.push(0, vProgress);
  uvs.push(1, vProgress);
  
  // Indices (Two triangles per segment)
  if (i < roadSegments - 1) {
      const base = i * 2;
      // Triangle 1: BaseL, BaseR, NextL
      indices.push(base, base + 2, base + 1);
      // Triangle 2: BaseR, NextL, NextR
      indices.push(base + 1, base + 2, base + 3);
  }
}

roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
roadGeometry.setIndex(indices);
roadGeometry.computeVertexNormals();

// No Extrude Settings needed anymore


// Road Shader Material
const roadVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const roadFragmentShader = `
  varying vec2 vUv;
  varying vec3 vWorldPos;

  // Simple noise
  float noise(vec2 n) {
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
  }

  void main() {
    // Road dark asphalt base
    vec3 asphalt = vec3(0.15, 0.15, 0.17);
    
    // Noise for texture
    // vUv.x is 0..1 (Width), vUv.y is 0..1 (Length)
    // Scale y by aspect ratio (Length is ~1500, width 18 -> ratio ~80)
    float grain = noise(vUv * vec2(40.0, 1000.0)) * 0.08;
    vec3 color = asphalt + vec3(grain);

    // Center Dotted Line
    // Center is x = 0.5
    float centerDist = abs(vUv.x - 0.5);
    
    // Dashes along Y (Length)
    // Increase frequency for many dashes
    float dash = step(0.5, sin(vUv.y * 300.0));
    
    // Line width
    float line = smoothstep(0.012, 0.008, centerDist);
    color = mix(color, vec3(1.0, 0.8, 0.0), line * dash); // Yellow

    // Side Stripes (x=0.05 and x=0.95)
    float s1 = abs(vUv.x - 0.05);
    float s2 = abs(vUv.x - 0.95);
    float sideLine = smoothstep(0.012, 0.008, min(s1, s2));
    
    color = mix(color, vec3(0.9), sideLine);

    gl_FragColor = vec4(color, 1.0);
  }
`;


const roadShaderMaterial = new THREE.ShaderMaterial({
  vertexShader: roadVertexShader,
  fragmentShader: roadFragmentShader,
  side: THREE.DoubleSide
});


const groundMesh = new THREE.Mesh(roadGeometry, roadShaderMaterial);
scene.add(groundMesh);

// Ground/Grass Shader for the city base
const grassVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv * 50.0; // Tiling
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const grassFragmentShader = `
  varying vec2 vUv;
  void main() {
    // Dark city ground, maybe concrete/grass mix
    vec3 darkGreen = vec3(0.02, 0.05, 0.02);
    vec3 concrete = vec3(0.05, 0.05, 0.06);
    
    // Grid pattern
    float grid = step(0.98, fract(vUv.x)) + step(0.98, fract(vUv.y));
    vec3 color = mix(darkGreen, concrete, 0.5);
    color += vec3(0.05) * grid; // faint grid lines

    gl_FragColor = vec4(color, 1.0);
  }
`;

const grassMaterial = new THREE.ShaderMaterial({
  vertexShader: grassVertexShader,
  fragmentShader: grassFragmentShader,
});

const grassPlane = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), grassMaterial);
grassPlane.rotation.x = -Math.PI / 2;
grassPlane.position.y = -0.5; // Slightly below road
scene.add(grassPlane);


// Physics for the curved road (Trimesh)
// Note: RaycastVehicle requires a body to hit.
// Physics for the road
// Since the road is perfectly flat at Y=0, we use a global Plane for robust physics.
// This prevents any "falling through" issues with Trimesh and is much more performant.
const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({
   mass: 0, // static
   material: groundMaterial 
});
groundBody.addShape(groundShape);
// Rotate plane to face up (Cannon plane faces +Z by default, rotate -90 deg around X to face +Y)
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
groundBody.position.set(0, 0, 0); 
world.addBody(groundBody);



// Circle plane removed


// Panels removed for curved road
// const panels = new Panels({ scene, world, groundMesh, renderer });
const panels = { updateTime: () => {} }; // Dummy object to prevent crash in animate loop


// Create and add a plane from intro.js
const introPlane = createPlane({
  width: 20,
  height: 20,
  color: 0x4a90e2,
  position: { x: 0, y: 5, z: -20 },
  rotation: { x: 0, y: 0, z: 0 },
  doubleSide: false,
});
scene.add(introPlane);

// Load and add robot model from intro.js (positioned near the car)
// Robot loading and setup removed

// Road cylinders (humps) removed

// Panels (Collectables) removed

const startX = -100;
const spacing = 50;

// Since loops are removed, define lastCylinderX manually based on intended length
// Previously: const lastCylinderX = startX - (numCylinders - 1) * spacing;
// We'll mimic the length of the track
const trackLengthChunks = 20; 
const lastCylinderX = startX - (trackLengthChunks - 1) * spacing;
const finishLineX = lastCylinderX - spacing; // finish line X independent of planeX
const finishStopOffset = 6.0; // car must clear this distance past the cloth before stopping

// Cloth/Finish line physics removed


// Finish line mesh removed


// --- Shattering logic ---
// --- Remove shatterPanel function and all uses of shatteredPanels ---
// --- In the animate() loop, just remove panels when intersected by the car ---

// --- Animate logic ---
function aabbIntersect(meshA, meshB) {
  meshA.geometry.computeBoundingBox();
  meshB.geometry.computeBoundingBox();
  meshA.updateMatrixWorld();
  meshB.updateMatrixWorld();
  const boxA = meshA.geometry.boundingBox
    .clone()
    .applyMatrix4(meshA.matrixWorld);
  const boxB = meshB.geometry.boundingBox
    .clone()
    .applyMatrix4(meshB.matrixWorld);
  return boxA.intersectsBox(boxB);
}

// Physics for road cylinders removed

//load a hdri using RGBELoader
const rgbeLoader = new RGBELoader();
rgbeLoader.load("./sky_4.hdr", (environmentMap) => {
  environmentMap.mapping = THREE.EquirectangularReflectionMapping;
  // scene.background = environmentMap;
  scene.environment = environmentMap;
  // scene.background.rotation = Math.PI / 2
});
let road;

//backgroun color
// Sunset Background
const backgroundColor = new THREE.Color("#200f30");
scene.background = backgroundColor;

// Sun Light (Directional)
light.position.set(-100, 20, 100); // Low angle
light.color.setHex(0xffaa33); // Orange/Golden
light.intensity = 1.5;

// City Generation
const createWindowTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    context.fillStyle = "#111";
    context.fillRect(0, 0, 32, 64);
    for (let y = 2; y < 62; y += 2) {
        for (let x = 2; x < 30; x += 2) {
        if (Math.random() > 0.6) {
            context.fillStyle = Math.random() < 0.5 ? "#ffcc00" : "#ffaa00"; // Warm/Yellow
            context.fillRect(x, y, 1, 1);
        }
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
};

const windowTexture = createWindowTexture();

function generateCity(pathCurve, numBuildings) {
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  // Re-use materials with different colors if needed, but here's a base one
  const buildingMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.9, // Matte surface to avoid sun reflections/glare circles
    metalness: 0.1, // Reduced metalness to prevent metallic shine
    emissiveMap: windowTexture,
    emissive: 0xffffff,
    emissiveIntensity: 0.8
  });


  const cityGroup = new THREE.Group();
  scene.add(cityGroup);

  const points = pathCurve.getSpacedPoints(numBuildings);
  
  // Streetlamp geometries
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 8, 8);
  const headGeo = new THREE.BoxGeometry(1.5, 0.2, 0.5);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

  points.forEach((point, index) => {
    if (index === 0) return; // Skip start

    const tangent = pathCurve.getTangentAt(index / numBuildings);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

    // 1. Streetlights (Closer to road)
    // Place every 3rd point roughly
    if (index % 3 === 0) {
      [-1, 1].forEach((side) => {
          const lampDist = 12; // Just outside road width (which is 18, so half is 9)
          const lampPos = new THREE.Vector3().copy(point).add(right.clone().multiplyScalar(side * lampDist));
          
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.copy(lampPos);
          pole.position.y = 4; // 8 units tall, center at 4
          cityGroup.add(pole);

          const head = new THREE.Mesh(headGeo, poleMat);
          head.position.set(0, 4, 0); // relative to pole
          // Rotate head to face road center
          if (side === 1) head.rotation.y = Math.PI; 
          
          // Add light (REMOVED to fix MAX_FRAGMENT_UNIFORM_VECTORS error)
          // Real-time spotlights are too expensive for this many poles.
          // const spotLight = new THREE.SpotLight(0xffaa00, 20.0, 30, 0.6, 0.5, 1);
          // ... 
          
          // Create a bulb mesh for visual glow
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2), bulbMat);
          bulb.position.set(0, 3.8, side === 1 ? -0.4 : 0.4).add(lampPos); // world pos for bulb mesh
          cityGroup.add(bulb);

          // SpotLight logic removed

          
          // Attach stick head to pole (simplification: just add to group at world pos)
          const headWorld = new THREE.Mesh(headGeo, poleMat);
          headWorld.position.copy(lampPos).add(new THREE.Vector3(0, 4, 0));
          headWorld.lookAt(point); // Aim at road center
          cityGroup.add(headWorld);
      });
    }

    // 2. Buildings (Further out)

    // 2. Main City Blocks (Mid-distance)
    [-1, 1].forEach((side) => {
       if (Math.random() > 0.6) return;

       const dist = 25 + Math.random() * 40; // Closer/dense
       const pos = new THREE.Vector3().copy(point).add(right.clone().multiplyScalar(side * dist));
       
       const width = 15 + Math.random() * 10;
       const depth = 15 + Math.random() * 10;
       const height = 40 + Math.random() * 120; // 40-160 height

       const mesh = new THREE.Mesh(buildingGeo, buildingMat);
       mesh.position.copy(pos);
       mesh.position.y = height / 2 - 5; 
       mesh.scale.set(width, height, depth);
       mesh.lookAt(point.x, mesh.position.y, point.z); 
       
       cityGroup.add(mesh);
    });

    // 3. Mega Skyscrapers (Distant/Illusion)
    // Place fewer, but much larger/taller buildings further back
    if (index % 5 === 0) {
       [-1, 1].forEach((side) => {
           if (Math.random() > 0.5) return;
           const dist = 80 + Math.random() * 80; // 80-160 units away
           const pos = new THREE.Vector3().copy(point).add(right.clone().multiplyScalar(side * dist));
           
           const width = 30 + Math.random() * 30; // Wide base
           const depth = 30 + Math.random() * 30;
           const height = 150 + Math.random() * 200; // 150-350 height

           const mesh = new THREE.Mesh(buildingGeo, buildingMat);
           mesh.position.copy(pos);
           mesh.position.y = height / 2 - 10; // Sunk slightly
           mesh.scale.set(width, height, depth);
           mesh.lookAt(point.x, mesh.position.y, point.z); 
           cityGroup.add(mesh);

           // Blinking red beacon on top
           if (height > 250) {
               const bead = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
               bead.position.copy(pos);
               bead.position.y = height - 10;
               cityGroup.add(bead);
           }
       });
    }
  });
}

// Increase density
generateCity(curve, 300);



// Ground physics body already created with Trimesh above
// Removing old box physics setup


// Instantiate modular car and attach chase camera
const playerCar = new Car({ scene, world, wheelMaterial });
playerCar.mesh.add(chaseCam);
// Rotate car to face -X (direction of road start)
// setRotation(yaw, pitch, roll). Local Z (forward) -> Global -X requires +90 deg (PI/2) yaw
if (playerCar.setRotation) {
  playerCar.setRotation(Math.PI / 2, 0, 0);
}

const keyMap = {};
let physicsEnabled = true; // Auto-enable physics for immediate play


// Robot animation into car removed

const onDocumentKey = (e) => {
  keyMap[e.code] = e.type === "keydown";

  // Check if the Enter key is pressed
  if (e.code === "Enter" && e.type === "keydown") {
    // Enable physics directly
    enablePhysicsNow();
  }

  // Procedural plane controls
  if (e.type === "keydown") {
    switch (e.code) {
      case "KeyP":
        // Generate new procedural plane
        planeGenerator.generatePlane(
          { x: Math.random() * 100 - 50, y: -2.5, z: Math.random() * 100 - 50 },
          { x: -Math.PI / 2, y: 0, z: 0 }
        );
        break;
      case "KeyT":
        // Generate terrain plane
        planeGenerator.parameters.planeType = "terrain";
        planeGenerator.parameters.amplitude = 3;
        planeGenerator.parameters.noiseScale = 0.05;
        planeGenerator.generatePlane(
          { x: 0, y: -2.5, z: 0 },
          { x: -Math.PI / 2, y: 0, z: 0 }
        );
        break;
      case "KeyW":
        // Generate wave plane
        planeGenerator.parameters.planeType = "wave";
        planeGenerator.parameters.amplitude = 2;
        planeGenerator.parameters.frequency = 0.2;
        planeGenerator.generatePlane(
          { x: 0, y: -2.5, z: 0 },
          { x: -Math.PI / 2, y: 0, z: 0 }
        );
        break;
      case "KeyC":
        // Clear all planes
        planeGenerator.clearPlanes();
        break;
      case "KeyU":
        // Update current plane
        if (planeGenerator.planes.length > 0) {
          planeGenerator.updatePlane(0);
        }
        break;
    }
  }
  return false;
};
let forwardVelocity = 0;
let rightVelocity = 0;
let controlsLocked = false; // disable inputs after finish line
document.addEventListener("keydown", onDocumentKey);
document.addEventListener("keyup", onDocumentKey);
window.addEventListener("resize", onWindowResize, false);
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}
// const stats = new Stats();
// document.body.appendChild(stats.dom);
const clock = new THREE.Clock();
let delta;
//const cannonDebugRenderer = new CannonDebugRenderer(scene, world) // Comment out or remove this line
const v = new THREE.Vector3();
let thrusting = false;

// Camera smoothing state
const camSmoothed = new THREE.Vector3();
const lookSmoothed = new THREE.Vector3();
let cameraInitialized = false;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false;

// const axesHelper = new THREE.AxesHelper(100); // Create a very big axis helper
// scene.add(axesHelper); // Add the axis helper to the scene
// axesHelper.position.set(1, 1, 1);

// Blinking glow effect removed

let carModel1;
/// Load and add the car model to the car body mesh
const carLoader1 = new GLTFLoader();
carLoader1.load("./car_lab.glb", (gltf) => {
  carModel1 = gltf.scene;
  scene.add(carModel1);
  carModel1.position.set(0, -2.6, 50);
});

// GUI Setup
// --- Car Debug GUI ---
const gui = new GUI();
const wheelFolder = gui.addFolder("Wheel Adjustment");

const setupWheelGUI = (index, name) => {
    const folder = wheelFolder.addFolder(name);
    
    // Get initial values safely
    const pos = (playerCar && typeof playerCar.getWheelPosition === 'function') 
        ? playerCar.getWheelPosition(index) 
        : {x:0, y:0, z:0};
    
    // Proxy object to hold values for GUI
    const proxy = { x: pos.x, y: pos.y, z: pos.z };
    
    folder.add(proxy, 'x', -3, 3, 0.01).onChange(v => {
        if (playerCar) playerCar.updateWheelPosition(index, v, proxy.y, proxy.z);
    });
    folder.add(proxy, 'y', -2, 2, 0.01).onChange(v => {
        if (playerCar) playerCar.updateWheelPosition(index, proxy.x, v, proxy.z);
    });
    folder.add(proxy, 'z', -4, 4, 0.01).onChange(v => {
        if (playerCar) playerCar.updateWheelPosition(index, proxy.x, proxy.y, v);
    });
    folder.open();
};

if (playerCar) {
    gui.add({ leftCorrection: -0.02 }, 'leftCorrection', -2.0, 1.0, 0.01)
       .name('Left Wheels X Adjustment')
       .onChange(v => {
           if (playerCar) playerCar.updateLeftSideCorrection(v);
       });

    gui.add({ rightCorrection: 0.3 }, 'rightCorrection', -1.0, 2.0, 0.01)
       .name('Right Wheels X Adjustment')
       .onChange(v => {
           if (playerCar) playerCar.updateRightSideCorrection(v);
       });

    setupWheelGUI(0, "Front Left");
    setupWheelGUI(1, "Front Right");
    setupWheelGUI(2, "Rear Left");
    setupWheelGUI(3, "Rear Right");
}

const debugObj = { editMode: false };
gui.add(debugObj, 'editMode').name('Edit & Orbit').onChange((val) => {
    physicsEnabled = !val;
    controls.enabled = val;
    
    if (val) {
        // Edit Mode: Stop the car
        if (playerCar && playerCar.body) {
            playerCar.body.velocity.set(0,0,0);
            playerCar.body.angularVelocity.set(0,0,0);
        }
    } else {
        // Game Mode
        // Logic to resume will be handled by the loop re-engaging physics
    }
});
wheelFolder.open();

// Help text overlay removed

// GUI for background shader removed per request

const maxSpeed = 20; // Set a common maximum speed for the car

// Simple plane generator placeholder to prevent errors
const planeGenerator = {
  planes: [],
  parameters: {
    planeType: "flat",
    amplitude: 2,
    frequency: 0.1,
    noiseScale: 0.1,
  },
  generatePlane: function () {
    console.log("Plane generation not implemented");
  },
  clearPlanes: function () {
    console.log("Clear planes not implemented");
  },
  updatePlane: function () {
    console.log("Update plane not implemented");
  },
};

// Speedometer UI removed

// wheel visual offsets handled inside Car class

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  delta = Math.min(clock.getDelta(), 0.1);
  // advance panel shaders time
  const t = clock.getElapsedTime();
  panels.updateTime(t);
  // roadCylinderShaderMat logic removed

  if (physicsEnabled) {
    // step using fixed timestep with substeps for stability
    world.step(delta);

    if (typeof playerCar.updateUprightStabilization === "function") {
      playerCar.updateUprightStabilization(delta);
    }
    // Auto-recover if flipped over and basically stopped
    if (
      typeof playerCar.isUpsideDown === "function" &&
      typeof playerCar.recoverUpright === "function"
    ) {
      const flipped = playerCar.isUpsideDown(0.1);
      const slow = playerCar.getSpeedMetersPerSecond() < 0.5;
      if (flipped && slow) {
        playerCar.recoverUpright(0.8);
      }
    }
  }

  // Sync car physics to Three.js (car mesh follows physics body)
  playerCar.mesh.position.copy(playerCar.body.position);
  playerCar.mesh.quaternion.copy(playerCar.body.quaternion);

  // Initialize camera smoothing targets once
  if (!cameraInitialized) {
    camSmoothed.copy(camera.position);
    lookSmoothed.copy(playerCar.mesh.position);
    cameraInitialized = true;
  }

  // Capture starting pose once for retry without reload
  if (
    typeof window !== "undefined" &&
    !window.__startPoseCaptured &&
    playerCar &&
    playerCar.body
  ) {
    try {
      const p = playerCar.body.position;
      const q = playerCar.body.quaternion;
      // yaw extraction from quaternion (Y-up)
      const w = q.w,
        x = q.x,
        y = q.y,
        z = q.z;
      const yaw = Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
      window.__startPose = { x: p.x, y: p.y, z: p.z, yaw };
      window.__startPoseCaptured = true;
    } catch (_) {}
  }

  // If physics is not enabled, position wheel meshes visually relative to the car visual mesh
  if (!physicsEnabled) {
    playerCar.updateVisualOnlyPositions();
  } else {
    playerCar.syncWheelMeshesFromBodies();
  }

  // Blinking glow effect removed

// Finish line check removed for endless mode


  // Input handling
  thrusting = false;
  if (!controlsLocked) {
    if (keyMap["KeyW"] || keyMap["ArrowUp"]) {
      if (forwardVelocity < maxSpeed) forwardVelocity += delta * 10;
      thrusting = true;
    }
    if (keyMap["KeyS"] || keyMap["ArrowDown"]) {
      if (forwardVelocity > -maxSpeed) forwardVelocity -= delta * 10;
      thrusting = true;
    }
    if (keyMap["KeyA"] || keyMap["ArrowLeft"]) {
      if (rightVelocity > -0.1) rightVelocity -= delta * 5;
    } else if (keyMap["KeyD"] || keyMap["ArrowRight"]) {
      if (rightVelocity < 0.1) rightVelocity += delta * 5;
    } else {
      rightVelocity = 0;
    }
  } else {
    // when locked, no steering; allow natural slowdown and braking only
    rightVelocity = 0;
  }

  if (keyMap["ArrowDown"]) {
    if (forwardVelocity > 0) {
      forwardVelocity -= delta;
    }
    if (forwardVelocity < 0) {
      forwardVelocity += delta;
    }
  }
  if (!thrusting) {
    if (forwardVelocity > 0) {
      forwardVelocity -= 0.25;
    }
    if (forwardVelocity < 0) {
      forwardVelocity += 0.25;
    }
  }

  // Apply braking from Space bar
  const isBraking = !!keyMap["Space"];
  if (typeof playerCar.applyBrake === "function") {
    playerCar.applyBrake(isBraking);
  }
  if (typeof playerCar.updateBraking === "function") {
    playerCar.updateBraking(delta);
  }
  if (isBraking) {
    // bleed some commanded speed while braking for responsiveness
    forwardVelocity *= 0.9;
  }

  playerCar.setForwardVelocity(forwardVelocity);
  playerCar.setRightVelocity(rightVelocity);
  if (!controls.enabled) {
      // Desired camera position from chase cam pivot
      chaseCamPivot.getWorldPosition(v);

      if (v.y < 0.5) {
        v.y = 0.5;
      }
      // Exponential smoothing based on delta time
      const smooth = 1 - Math.exp(-8 * delta);
      camSmoothed.lerp(v, smooth);
      camera.position.copy(camSmoothed);
      lookSmoothed.lerp(playerCar.mesh.position, smooth);
      camera.lookAt(lookSmoothed);
  }
  // animate sky gradient time
// Sky animation removed


  // Robot animation mixer logic removed

  render();
  // stats.update();

  // Speedometer update removed

  // Render fade effect
  renderer.autoClear = false;
  // renderer.render(fadeScene, fadeCamera);
  renderer.autoClear = true;

  // Panel movement and collision logic removed
// Cloth and finish line logic removed

}

function render() {
  renderer.render(scene, camera);
}

animate();
window.focus();

// -- add this helper to change car position at runtime (keeps visual + physics in sync)
function setCarPosition(x, y, z, yawRadians = 0) {
  playerCar.setPosition(x, y, z, yawRadians);
}

// Rotate car by Euler angles (radians). Keeps Three.js mesh and Cannon body in sync.
function setCarRotation(yawRad = 0, pitchRad = 0, rollRad = 0) {
  playerCar.setRotation(yawRad, pitchRad, rollRad);
}

// Convenience: rotate using degrees
function setCarRotationDegrees(yawDeg = 0, pitchDeg = 0, rollDeg = 0) {
  const toRad = (d) => (d * Math.PI) / 180;
  setCarRotation(toRad(yawDeg), toRad(pitchDeg), toRad(rollDeg));
}

// Examples:
// teleport car and rotate to face +Z (yaw 0)
setCarPosition(0, 1.5, 0, 0);
// // rotate car 90° to the right (yaw = 90 degrees)
setCarRotationDegrees(90);

// Record explicit initial start pose (position + rotation) for reliable retry
try {
  if (typeof window !== "undefined" && playerCar && playerCar.body) {
    const p0 = playerCar.body.position;
    const q0 = playerCar.body.quaternion;
    const w0 = q0.w,
      x0 = q0.x,
      y0 = q0.y,
      z0 = q0.z;
    const yaw0 = Math.atan2(
      2 * (w0 * y0 + x0 * z0),
      1 - 2 * (y0 * y0 + z0 * z0)
    );
    window.__startPose = { x: p0.x, y: p0.y, z: p0.z, yaw: yaw0 };
    window.__startPoseCaptured = true;
  }
} catch (_) {}

// Enable physics now function
function enablePhysicsNow() {
  if (physicsEnabled) return;
  // ensure physics enabled flag first to avoid re-entrancy
  physicsEnabled = true;
  // Delegate to car instance to snap wheels and stabilize
  playerCar.enablePhysicsNow();
}

// Expose current speed for HUD overlays (R3F speedometer)
if (typeof window !== "undefined") {
  window.__getSpeedMs = () => {
    try {
      return playerCar.getSpeedMetersPerSecond();
    } catch (e) {
      return 0;
    }
  };

  // Expose retry function to reset to start without reloading the scene
  window.retryFromStart = () => {
    try {
      // unlock controls and clear input/velocities
      controlsLocked = false;
      for (const k in keyMap) keyMap[k] = false;
      forwardVelocity = 0;
      rightVelocity = 0;
      if (playerCar && playerCar.body) {
        playerCar.body.velocity.set(0, 0, 0);
        playerCar.body.angularVelocity.set(0, 0, 0);
      }
      // detach flag if attached
      if (Array.isArray(flagConstraintsToCar) && flagConstraintsToCar.length) {
        for (const c of flagConstraintsToCar) {
          try {
            world.removeConstraint(c);
          } catch (_) {}
        }
        flagConstraintsToCar.length = 0;
      }
      if (typeof flagAttached !== "undefined") flagAttached = false;
      // move car to stored start pose
      const pose = window.__startPose;
      if (pose) {
        setCarPosition(pose.x, pose.y, pose.z, pose.yaw || 0);
      }
      // allow congrats to show again when finishing next time
      window.__congratsShown = false;
    } catch (_) {}
  };
}

// showFloatingPlusOne function removed

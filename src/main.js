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
  new THREE.Vector3(-1400, 0, 0),
  new THREE.Vector3(-1600, 0, 40),
  new THREE.Vector3(-1800, 0, -40),
  new THREE.Vector3(-2000, 0, 0),
  new THREE.Vector3(-2200, 0, 0),
  // Bridge Section
  new THREE.Vector3(-2400, 0, 0), 
  new THREE.Vector3(-2600, 20, 0), // Peak
  new THREE.Vector3(-2800, 20, 0), // Flat
  new THREE.Vector3(-3000, 0, 0), // End bridge
  new THREE.Vector3(-3200, 0, 0),
]);

// Helper to visualize the curve (optional, for debugging)
// const curvePoints = curve.getPoints(50);
// const curveGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
// const curveMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
// scene.add(new THREE.Line(curveGeo, curveMat));

// Custom Ribbon Geometry generation for perfect UV control
const roadWidth = 18;
const roadSegments = 1200;
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
// Physics for the road - Reverted to Plane for robust flat road physics
// The bridge physics will be handled separately in generateBridge using boxes
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
            const colors = ["#ffcc00", "#ffaa00", "#00ffff", "#ff00ff", "#33ff33", "#ffffff"];
            context.fillStyle = colors[Math.floor(Math.random() * colors.length)];
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

// Global building material with custom blinking shader
const buildingMat = new THREE.MeshStandardMaterial({
  color: 0x111111,
  roughness: 0.9, 
  metalness: 0.1, 
  emissiveMap: windowTexture,
  emissive: 0xffffff,
  emissiveIntensity: 0.8
});

buildingMat.onBeforeCompile = (shader) => {
  shader.uniforms.time = { value: 0 };
  buildingMat.userData.shader = shader;

  // 1. Modify Vertex Shader to pass world position
  shader.vertexShader = `
    varying vec3 vWorldPos;
  ` + shader.vertexShader;
  
  shader.vertexShader = shader.vertexShader.replace(
    '#include <worldpos_vertex>',
    `
    #include <worldpos_vertex>
    vWorldPos = (modelMatrix * vec4(transformDirection( position, modelMatrix ), 1.0)).xyz;
    // Fallback if transformDirection isn't enough, usually modelMatrix * vec4(position, 1.0) is standard
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz; 
    `
  );

  // 2. Modify Fragment Shader to use world position for unique blinking
  shader.fragmentShader = `
    uniform float time;
    varying vec3 vWorldPos;
  ` + shader.fragmentShader;

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `
    #ifdef USE_EMISSIVEMAP
      vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
      
      // Identify distinct windows on the texture
      vec2 pixel = floor(vEmissiveMapUv * vec2(32.0, 64.0));
      float pixelRnd = fract(sin(dot(pixel, vec2(12.9898, 78.233))) * 43758.5453);

      // Identify distinct buildings using World Position
      // Use floor to keep it constant across the face of one building
      float buildingSeed = fract(sin(dot(floor(vWorldPos.xz * 0.1), vec2(12.9898, 78.233))) * 43758.5453);

      // Combine to get a unique seed for this specific window on this specific building
      float uniqueRnd = fract(pixelRnd + buildingSeed);

      // Threshold: bright windows only, and sparse (top 10%)
      float brightness = max(emissiveColor.r, max(emissiveColor.g, emissiveColor.b));

      if (brightness > 0.2 && uniqueRnd > 0.85) {
          // Varied speed and phase
          float speed = 1.5 + uniqueRnd * 1.5; 
          float phase = uniqueRnd * 6.28 + buildingSeed * 10.0;
          
          float blink = step(0.5, sin(time * speed + phase));
          emissiveColor.rgb *= blink;
      }

      totalEmissiveRadiance *= emissiveColor.rgb;
    #endif
    `
  );
};

function generateCity(pathCurve, numBuildings) {
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  // buildingMat is now defined globally above


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
    if (point.x < -2100) return; // Stop city before bridge

    const tangent = pathCurve.getTangentAt(index / numBuildings);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

    // 1. Streetlights (Closer to road)
    // Reduce count: Place every 6th point roughly
    if (index % 6 === 0) {
      [-1, 1].forEach((side) => {
          const lampDist = 12; // Just outside road width (which is 18, so half is 9)
          const lampPos = new THREE.Vector3().copy(point).add(right.clone().multiplyScalar(side * lampDist));
          
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.copy(lampPos);
          pole.position.y = 4; // 8 units tall, center at 4
          cityGroup.add(pole);

          // Add physics for the pole
          // Using Box for simplicity and alignment (0.1 rad -> 0.2 width -> 0.1 halfExtents)
          const poleShape = new CANNON.Box(new CANNON.Vec3(0.1, 4, 0.1));
          const poleBody = new CANNON.Body({
            mass: 0, // Static
            shape: poleShape
          });
          poleBody.position.copy(pole.position);
          world.addBody(poleBody);

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
       if (Math.random() > 0.8) return; // Keep more buildings

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
       
       const buildingShape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
       const buildingBody = new CANNON.Body({
         mass: 0, // Static
         shape: buildingShape
       });
       buildingBody.position.copy(mesh.position);
       buildingBody.quaternion.copy(mesh.quaternion);  // <--- Added rotation match
       world.addBody(buildingBody);
       
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

           // Add physics for skyscraper
           const skyScraperShape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
           const skyScraperBody = new CANNON.Body({
               mass: 0,
               shape: skyScraperShape
           });
           skyScraperBody.position.copy(mesh.position);
           // Match rotation of the mesh
           skyScraperBody.quaternion.copy(mesh.quaternion);
           world.addBody(skyScraperBody);

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
generateCity(curve, 600);

function generateBridge(curve) {
  const bridgeGroup = new THREE.Group();
  scene.add(bridgeGroup);
  
  // Get points for the bridge section (approx x < -2200)
  const allPoints = curve.getSpacedPoints(1200);
  const bridgePoints = allPoints.filter(p => p.x < -2200 && p.x > -3000);
  
  if (bridgePoints.length === 0) return;

  // Materials
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 });
  const cableMat = new THREE.LineBasicMaterial({ color: 0xff3333, linewidth: 3 }); 
  const railMat = new THREE.MeshStandardMaterial({ color: 0xaa3333 });

  // 1. Towers (At start approx -2300 and end -2900)
  // We can find points closest to these X values
  const towerX1 = -2300;
  const towerX2 = -2900;
  
  // Helper to place tower
  const placeTower = (xPos) => {
      // Find point on curve
      const p = bridgePoints.reduce((prev, curr) => 
        Math.abs(curr.x - xPos) < Math.abs(prev.x - xPos) ? curr : prev
      );
      
      const height = 60;
      
      // Use grouping for tower
      const tower = new THREE.Group();
      tower.position.set(p.x, p.y, p.z); // Center at road point
      
      // Left Pillar
      const tL = new THREE.Mesh(new THREE.BoxGeometry(5, height, 5), pillarMat);
      tL.position.set(0, height/2 - 5, -15); // Local pos
      tower.add(tL);
      
      // Right Pillar
      const tR = new THREE.Mesh(new THREE.BoxGeometry(5, height, 5), pillarMat);
      tR.position.set(0, height/2 - 5, 15);
      tower.add(tR);
      
      // Cross beam
      const beam = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 35), pillarMat);
      beam.position.set(0, height - 5, 0);
      tower.add(beam);

      // Add physics for tower pillars
      const pillarShape = new CANNON.Box(new CANNON.Vec3(2.5, height/2, 2.5));
      
      const bodyL = new CANNON.Body({ mass: 0, shape: pillarShape });
      bodyL.position.set(p.x, p.y + height/2 - 5, p.z - 15);
      world.addBody(bodyL);

      const bodyR = new CANNON.Body({ mass: 0, shape: pillarShape });
      bodyR.position.set(p.x, p.y + height/2 - 5, p.z + 15);
      world.addBody(bodyR);
      
      bridgeGroup.add(tower);
      
      // Return world positions of tops for cable
      return { 
          topL: new THREE.Vector3(p.x, p.y + height - 2, p.z - 15), 
          topR: new THREE.Vector3(p.x, p.y + height - 2, p.z + 15) 
      };
  };

  const t1 = placeTower(towerX1);
  const t2 = placeTower(towerX2);

  // 2. Cables
  // Simple straight lines connecting: Start -> T1 -> T2 -> End
  const startP = bridgePoints[0];
  const endP = bridgePoints[bridgePoints.length - 1];

  const pointsL = [
      new THREE.Vector3(startP.x, startP.y, startP.z - 15),
      t1.topL,
      t2.topL,
      new THREE.Vector3(endP.x, endP.y, endP.z - 15)
  ];
  bridgeGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsL), cableMat));
  
  const pointsR = [
      new THREE.Vector3(startP.x, startP.y, startP.z + 15),
      t1.topR,
      t2.topR,
      new THREE.Vector3(endP.x, endP.y, endP.z + 15)
  ];
  bridgeGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsR), cableMat));

  // 3. Railings / Side pillars along the span
  bridgePoints.forEach((p, i) => {
      // Small posts
      if (i % 4 === 0) { 
          const postGeo = new THREE.BoxGeometry(0.5, 3, 0.5);
          
          const pL = new THREE.Mesh(postGeo, railMat);
          pL.position.set(p.x, p.y + 1.5, p.z - 10);
          bridgeGroup.add(pL);
          
          const pR = new THREE.Mesh(postGeo, railMat);
          pR.position.set(p.x, p.y + 1.5, p.z + 10);
          bridgeGroup.add(pR);
      }
  });

  // 4. Physics for Bridge Surface (Segmented Boxes)
  // This ensures the car can drive up the bridge.
  // We skip the first few points to avoid z-fighting with the ground plane where it starts
  const skip = 5; 
  for(let i = skip; i < bridgePoints.length - 1; i++) {
        const p1 = bridgePoints[i];
        const p2 = bridgePoints[i+1];
        
        const dist = p1.distanceTo(p2);
        // Midpoint
        const center = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        
        // Create box. Extents are half-sizes.
        // Width 15 (creates 30 total width, road is 18, so plenty of margin)
        // Height 0.5 (1 unit thick)
        // Depth dist/2 (Length of segment)
        // Add overlap (dist/2 + 0.5) to ensure smooth transition
        const boxShape = new CANNON.Box(new CANNON.Vec3(15, 0.5, dist / 2 + 0.1));
        
        const body = new CANNON.Body({ mass: 0, material: groundMaterial });
        body.addShape(boxShape);
        body.position.set(center.x, center.y - 0.5, center.z); // Shift down slightly so surface matches visual

        // Orientation
        // Calculate tangent vector
        const segment = new THREE.Vector3().subVectors(p2, p1).normalize();
        
        // Align Box Z-axis (length) with segment vector
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), segment);
        body.quaternion.set(q.x, q.y, q.z, q.w);
        
        world.addBody(body);
  }
}

generateBridge(curve);



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
  
  if (buildingMat.userData.shader) {
      buildingMat.userData.shader.uniforms.time.value = t;
  }
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

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

/**
 * Creates a plane mesh with optional parameters
 * @param {Object} options - Configuration options
 * @param {number} options.width - Width of the plane (default: 10)
 * @param {number} options.height - Height of the plane (default: 10)
 * @param {number} options.widthSegments - Number of width segments (default: 1)
 * @param {number} options.heightSegments - Number of height segments (default: 1)
 * @param {THREE.Color|number|string} options.color - Color of the plane (default: 0x808080)
 * @param {THREE.Vector3} options.position - Position of the plane (default: {x: 0, y: 0, z: 0})
 * @param {THREE.Euler} options.rotation - Rotation of the plane (default: {x: -Math.PI/2, y: 0, z: 0})
 * @param {boolean} options.doubleSide - Whether to render both sides (default: false)
 * @returns {THREE.Mesh} The created plane mesh
 */
export function createPlane(options = {}) {
  const {
    width = 10,
    height = 10,
    widthSegments = 1,
    heightSegments = 1,
    color = 0x808080,
    position = { x: 0, y: 0, z: 0 },
    rotation = { x: -Math.PI / 2, y: 0, z: 0 },
    doubleSide = false,
  } = options;

  const geometry = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);
  const material = new THREE.MeshStandardMaterial({
    color: color,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    roughness: 0.8,
    metalness: 0.2,
  });

  const plane = new THREE.Mesh(geometry, material);
  plane.position.set(position.x, position.y, position.z);
  plane.rotation.set(rotation.x, rotation.y, rotation.z);
  plane.receiveShadow = true;

  return plane;
}

/**
 * Loads and sets up audio for the robot
 * @param {string} audioPath - Path to the audio file (MP3, OGG, etc.)
 * @param {THREE.AudioListener} listener - AudioListener from the camera
 * @param {Object} options - Audio configuration options
 * @param {boolean} options.loop - Whether to loop the audio (default: false)
 * @param {number} options.volume - Volume level 0-1 (default: 0.5)
 * @param {boolean} options.autoplay - Whether to start playing automatically (default: false)
 * @param {THREE.Object3D} options.position - Position object to attach audio to (for 3D positional audio)
 * @returns {Promise<THREE.Audio|THREE.PositionalAudio>} Promise that resolves with the audio object
 */
export function loadRobotAudio(audioPath, listener, options = {}) {
  const {
    loop = false,
    volume = 0.5,
    autoplay = false,
    position = null,
  } = options;

  return new Promise((resolve, reject) => {
    // Use fetch to load audio file
    fetch(audioPath)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => {
        // Create audio context and decode audio data
        const audioContext = listener.context;
        
        return audioContext.decodeAudioData(arrayBuffer);
      })
      .then((audioBuffer) => {
        let audio;
        
        // Use positional audio if position is provided
        if (position) {
          audio = new THREE.PositionalAudio(listener);
          audio.setRefDistance(5);
          audio.setRolloffFactor(1);
          audio.setMaxDistance(50);
        } else {
          audio = new THREE.Audio(listener);
        }
        
        audio.setBuffer(audioBuffer);
        audio.setLoop(loop);
        audio.setVolume(volume);
        
        if (autoplay) {
          audio.play();
        }
        
        resolve(audio);
      })
      .catch((error) => {
        console.error("Error loading robot audio:", error);
        reject(error);
      });
  });
}

/**
 * Loads a robot model and returns it with animations
 * @param {string} modelPath - Path to the robot GLB/GLTF file
 * @param {Object} options - Configuration options
 * @param {THREE.Vector3} options.position - Initial position (default: {x: 0, y: 0, z: 0})
 * @param {THREE.Vector3} options.scale - Scale factor (default: {x: 1, y: 1, z: 1})
 * @param {THREE.Euler} options.rotation - Initial rotation (default: {x: 0, y: 0, z: 0})
 * @param {boolean} options.castShadow - Whether the model casts shadows (default: true)
 * @param {boolean} options.receiveShadow - Whether the model receives shadows (default: true)
 * @returns {Promise<Object>} Promise that resolves with {robot, animations, mixer} where robot is the model, animations is the animation clips array, and mixer is an AnimationMixer instance
 */
export function loadRobotModel(modelPath = "./ROBOt_18.glb", options = {}) {
  const {
    position = { x: 5, y: 0, z: 0 },
    scale = { x: 1, y: 1, z: 1 },
    rotation = { x: 0, y: 0, z: 0 },
    castShadow = true,
    receiveShadow = true,
  } = options;

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      modelPath,
      (gltf) => {
        const robot = gltf.scene;
        
        // Apply transformations
        robot.position.set(position.x, position.y, position.z);
        robot.scale.set(scale.x, scale.y, scale.z);
        robot.rotation.set(rotation.x, rotation.y, rotation.z);

        // Configure shadows for all meshes
        robot.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = castShadow;
            child.receiveShadow = receiveShadow;
          }
        });

        // Create animation mixer if animations exist
        let mixer = null;
        const animations = gltf.animations || [];
        if (animations.length > 0) {
          mixer = new THREE.AnimationMixer(robot);
        }

        resolve({ robot, animations, mixer });
      },
      undefined,
      (error) => {
        console.error("Error loading robot model:", error);
        reject(error);
      }
    );
  });
}

export default class Intro {
  constructor(scene, modelPath = "./robot.glb", options = {}) {
    this.scene = scene;
    this.modelPath = modelPath;
    this.options = options;
    this.robot = null;
  }

  /**
   * Loads and adds the robot to the scene
   * @returns {Promise<THREE.Group>} Promise that resolves with the loaded robot
   */
  async loadRobot() {
    try {
      this.robot = await loadRobotModel(this.modelPath, this.options);
      if (this.scene) {
        this.scene.add(this.robot);
      }
      return this.robot;
    } catch (error) {
      console.error("Failed to load robot:", error);
      throw error;
    }
  }

  /**
   * Gets the current robot model
   * @returns {THREE.Group|null} The robot model or null if not loaded
   */
  getRobot() {
    return this.robot;
  }
}
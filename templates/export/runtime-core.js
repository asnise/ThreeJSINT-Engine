const container = document.getElementById('container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = false;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const hemi = new THREE.HemisphereLight(0xcceeff, 0x444444, 0.7);
hemi.position.set(0, 20, 0);
scene.add(hemi);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 500);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
const loadedTextures = {};
const loadedMeshScenes = {};
const allObjects = [];

function dataUrlToArrayBuffer(dataUrl) {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function loadAssets() {
  for (const [id, data] of Object.entries(ASSETS_DATA.textures || {})) {
    if (!data || !data.data) continue;
    try {
      const tex = await new Promise((res, rej) => textureLoader.load(data.data, res, undefined, rej));
      tex.colorSpace = THREE.SRGBColorSpace;
      loadedTextures[id] = tex;
    } catch (err) {
      console.warn('Failed to load texture asset in export:', id, err);
    }
  }
  for (const [id, data] of Object.entries(ASSETS_DATA.meshes || {})) {
    if (!data || !data.data) continue;
    try {
      const ab = dataUrlToArrayBuffer(data.data);
      const gltf = await new Promise((res, rej) => gltfLoader.parse(ab, '', res, rej));
      loadedMeshScenes[id] = gltf.scene;
    } catch (err) {
      console.warn('Failed to parse mesh asset in export:', id, err);
    }
  }
}

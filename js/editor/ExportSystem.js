export class ExportSystem {
  constructor(sceneManager, assetManager, uiManager = null, nodeRuntime = null) {
    this.sceneManager = sceneManager;
    this.assetManager = assetManager;
    this.uiManager = uiManager;
    this.nodeRuntime = nodeRuntime;
  }

  async exportHTML() {
    const sceneData = this.sceneManager.serialize();
    const assetsData = await this.assetManager.serializeAssets();
    const uiData = this.uiManager ? this.uiManager.serialize() : null;
    const nodeGraphData = this.nodeRuntime ? this.nodeRuntime.serialize() : null;

    const html = this._generateHTML(sceneData, assetsData, uiData, nodeGraphData);

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exported-scene.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  _generateHTML(sceneData, assetsData, uiData, nodeGraphData) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>Exported Scene — ThreeInteractEngine</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #000; font-family: system-ui, sans-serif; }
canvas { display: block; width: 100%; height: 100%; }
.interact-prompt {
  position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.7); color: #ccc; padding: 8px 16px; border-radius: 4px;
  font-size: 14px; pointer-events: none; z-index: 50; display: none; white-space: nowrap;
}
.crosshair {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
  width: 16px; height: 16px; pointer-events: none; z-index: 50;
}
.crosshair::before, .crosshair::after { content: ''; position: absolute; background: rgba(255,255,255,0.6); }
.crosshair::before { width: 2px; height: 16px; left: 7px; top: 0; }
.crosshair::after { width: 16px; height: 2px; top: 7px; left: 0; }
.custom-ui-layer {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 40; overflow: hidden;
}
.custom-ui-element {
  position: absolute;
  user-select: none;
  pointer-events: none;
  box-sizing: border-box;
}
.inspect-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.inspect-overlay canvas { max-width: 80%; max-height: 80%; }
.inspect-close {
  position: absolute; top: 16px; right: 20px; width: 32px; height: 32px;
  background: transparent; border: 1px solid #888; border-radius: 2px; color: #ccc;
  font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.inspect-hint { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); color: #888; font-size: 12px; }
.mobile-joystick-area { position: fixed; left: 0; bottom: 0; width: 50%; height: 40%; z-index: 60; display: none; touch-action: none; }
.mobile-joystick-base {
  position: absolute; left: 40px; bottom: 40px; width: 100px; height: 100px; border-radius: 50%;
  background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center;
}
.mobile-joystick-thumb { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.4); pointer-events: none; }
.mobile-look-area { position: fixed; right: 0; bottom: 0; width: 50%; height: 100%; z-index: 55; display: none; touch-action: none; }
.mobile-interact-btn {
  position: fixed; right: 20px; bottom: 100px; width: 64px; height: 64px; border-radius: 50%;
  background: rgba(61,133,198,0.6); border: 2px solid rgba(61,133,198,0.8); color: #fff;
  font-size: 12px; font-weight: 600; cursor: pointer; z-index: 65; display: none; touch-action: none;
  align-items: center; justify-content: center;
}
.start-screen {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center;
  z-index: 2000; cursor: pointer;
}
.start-screen span { color: #ccc; font-size: 18px; }
</style>
</head>
<body>
<div id="container"></div>
<div class="custom-ui-layer" id="customUILayer"></div>
<div class="start-screen" id="startScreen"><span>Click to Start</span></div>

<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
  }
}
</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const SCENE_DATA = ${JSON.stringify(sceneData)};
const ASSETS_DATA = ${JSON.stringify(assetsData)};
const UI_DATA = ${JSON.stringify(uiData || {})};
const NODE_DATA = ${JSON.stringify(nodeGraphData || {})};

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

async function loadAssets() {
  for (const [id, data] of Object.entries(ASSETS_DATA.textures || {})) {
    const tex = await new Promise((res, rej) => textureLoader.load(data.data, res, undefined, rej));
    tex.colorSpace = THREE.SRGBColorSpace;
    loadedTextures[id] = tex;
  }
  for (const [id, data] of Object.entries(ASSETS_DATA.meshes || {})) {
    const blob = await fetch(data.data).then(r => r.blob());
    const url = URL.createObjectURL(blob);
    const gltf = await new Promise((res, rej) => gltfLoader.load(url, res, undefined, rej));
    loadedMeshScenes[id] = gltf.scene;
    URL.revokeObjectURL(url);
  }
}

function buildScene() {
  const sp = SCENE_DATA.playerSpawn || { position: { x: 0, y: 1.7, z: 5 }, rotation: { x: 0, y: 0, z: 0 } };
  camera.position.set(sp.position.x, sp.position.y, sp.position.z);

  const objMap = new Map();

  for (const od of SCENE_DATA.objects) {
    let obj;
    if (od.userData.type === 'imported_mesh' && od.userData.meshAssetId && loadedMeshScenes[od.userData.meshAssetId]) {
      obj = loadedMeshScenes[od.userData.meshAssetId].clone(true);
    } else if (od.userData.primitiveType) {
      const color = od.color ? new THREE.Color(od.color) : new THREE.Color(0x888888);
      switch (od.userData.primitiveType) {
        case 'cube': obj = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({ color })); break;
        case 'sphere': obj = new THREE.Mesh(new THREE.SphereGeometry(0.5,32,24), new THREE.MeshStandardMaterial({ color })); break;
        case 'plane': obj = new THREE.Mesh(new THREE.PlaneGeometry(10,10), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide })); obj.rotation.x = -Math.PI/2; break;
        case 'cylinder': obj = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,1,32), new THREE.MeshStandardMaterial({ color })); break;
        default: continue;
      }
    } else { continue; }

    obj.userData = od.userData;
    obj.position.set(od.position.x, od.position.y, od.position.z);
    obj.rotation.set(THREE.MathUtils.degToRad(od.rotation.x), THREE.MathUtils.degToRad(od.rotation.y), THREE.MathUtils.degToRad(od.rotation.z));
    obj.scale.set(od.scale.x, od.scale.y, od.scale.z);
    obj.visible = (od.userData.active !== false);

    if (od.userData.textures?.base && loadedTextures[od.userData.textures.base]) {
      const applyTex = (m) => { if (m.isMesh) { m.material.map = loadedTextures[od.userData.textures.base]; m.material.needsUpdate = true; } };
      if (obj.isMesh) applyTex(obj); else obj.traverse(applyTex);
    }

    objMap.set(od.userData.id, obj);
    allObjects.push(obj);
  }

  // Assemble parent-child hierarchy
  for (const obj of allObjects) {
    const parentId = obj.userData?.parentId;
    if (parentId && objMap.has(parentId)) {
      objMap.get(parentId).add(obj);
    } else {
      scene.add(obj);
    }
  }

  // Update visibility down the hierarchy
  for (const obj of allObjects) {
    if (!obj.parent || obj.parent === scene) {
      updateHierarchyVisibility(obj);
    }
  }
}

function updateHierarchyVisibility(parentObj) {
  const isParentVis = parentObj.visible;
  for (const child of parentObj.children) {
    if (child.userData && child.userData.id) {
      child.visible = isParentVis && (child.userData.active !== false);
      updateHierarchyVisibility(child);
    }
  }
}

function isActiveInHierarchy(obj) {
  let cur = obj;
  while (cur && cur !== scene) {
    if (cur.userData && cur.userData.active === false) return false;
    if (cur.visible === false) return false;
    cur = cur.parent;
  }
  return true;
}

// --- Custom UI Layer ---
const customUIElements = new Map();

function buildCustomUI() {
  const layer = document.getElementById('customUILayer');
  if (!layer || !UI_DATA.elements) return;

  for (const elData of UI_DATA.elements) {
    const el = document.createElement(elData.type === 'image' ? 'img' : 'div');
    el.id = 'custom-ui-' + elData.id;
    el.className = 'custom-ui-element';

    if (elData.type === 'label') {
      el.textContent = elData.text || '';
      el.style.color = elData.color || '#ffffff';
      el.style.fontSize = (elData.fontSize || 16) + 'px';
      el.style.fontFamily = elData.fontFamily || 'system-ui, sans-serif';
      el.style.fontWeight = elData.fontWeight || 'normal';
    } else if (elData.type === 'image') {
      if (elData.assetId && loadedTextures[elData.assetId]) {
        el.src = ASSETS_DATA.textures?.[elData.assetId]?.data || '';
      } else if (elData.src) {
        el.src = elData.src;
      }
      el.style.width = (elData.width || 64) + 'px';
      el.style.height = (elData.height || 64) + 'px';
      el.style.objectFit = 'contain';
    }

    el.style.opacity = elData.opacity !== undefined ? elData.opacity : 1;
    el.style.display = elData.visible !== false ? 'block' : 'none';

    applyAnchor(el, elData.anchor || 'top-left', elData.offsetX || 0, elData.offsetY || 0);
    layer.appendChild(el);
    customUIElements.set(elData.id, el);
  }
}

function applyBaseUI() {
  const base = UI_DATA.baseUI;
  if (!base) return;

  if (base.crosshair) {
    if (base.crosshair.active === false) crosshairEl.style.display = 'none';
    if (base.crosshair.size) {
      crosshairEl.style.width = base.crosshair.size + 'px';
      crosshairEl.style.height = base.crosshair.size + 'px';
    }
  }

  if (base.prompt) {
    if (base.prompt.active === false) promptEl.style.display = 'none';
    if (base.prompt.fontSize) promptEl.style.fontSize = base.prompt.fontSize + 'px';
    if (base.prompt.color) promptEl.style.color = base.prompt.color;
    if (base.prompt.bg) promptEl.style.background = base.prompt.bg;
  }

  if (base.joystick) {
    if (base.joystick.active === false) jArea.style.display = 'none';
    if (base.joystick.baseSize) {
      jBase.style.width = base.joystick.baseSize + 'px';
      jBase.style.height = base.joystick.baseSize + 'px';
    }
    if (base.joystick.thumbSize) {
      jThumb.style.width = base.joystick.thumbSize + 'px';
      jThumb.style.height = base.joystick.thumbSize + 'px';
    }
  }
}

function applyAnchor(el, anchor, ox, oy) {
  el.style.top = ''; el.style.bottom = ''; el.style.left = ''; el.style.right = '';
  let trans = '';
  switch (anchor) {
    case 'top-left': el.style.top = oy + 'px'; el.style.left = ox + 'px'; break;
    case 'top-center': el.style.top = oy + 'px'; el.style.left = '50%'; trans = 'translateX(calc(-50% + ' + ox + 'px))'; break;
    case 'top-right': el.style.top = oy + 'px'; el.style.right = (-ox) + 'px'; break;
    case 'middle-left': el.style.top = '50%'; el.style.left = ox + 'px'; trans = 'translateY(calc(-50% + ' + oy + 'px))'; break;
    case 'middle-center': el.style.top = '50%'; el.style.left = '50%'; trans = 'translate(calc(-50% + ' + ox + 'px), calc(-50% + ' + oy + 'px))'; break;
    case 'middle-right': el.style.top = '50%'; el.style.right = (-ox) + 'px'; trans = 'translateY(calc(-50% + ' + oy + 'px))'; break;
    case 'bottom-left': el.style.bottom = (-oy) + 'px'; el.style.left = ox + 'px'; break;
    case 'bottom-center': el.style.bottom = (-oy) + 'px'; el.style.left = '50%'; trans = 'translateX(calc(-50% + ' + ox + 'px))'; break;
    case 'bottom-right': el.style.bottom = (-oy) + 'px'; el.style.right = (-ox) + 'px'; break;
  }
  el.style.transform = trans;
}

// --- Node Graph Runtime (inline) ---
const graphVariables = new Map();
const activeTweens = [];
const nodeStates = new Map();

function initNodeGraph() {
  graphVariables.clear();
  nodeStates.clear();
  activeTweens.length = 0;
  if (NODE_DATA.variables) {
    for (const [k, v] of Object.entries(NODE_DATA.variables)) {
      graphVariables.set(k, v);
    }
  }
}

function getObjectById(id) {
  if (!id) return null;
  return allObjects.find(o => o.userData?.id === id) || null;
}

function triggerNodeEvent(eventType, contextObj) {
  if (!NODE_DATA.nodes) return;
  const targetId = contextObj?.userData?.id || (typeof contextObj === 'string' ? contextObj : null);
  const eventNodes = NODE_DATA.nodes.filter(n => n.type === eventType);
  for (const node of eventNodes) {
    const p = node.data || node.properties || {};
    if (eventType === 'OnInteract' || eventType === 'OnTriggerEnter' || eventType === 'OnTriggerExit') {
      const filterId = p.targetId || p.targetObject;
      if (filterId && filterId !== 'any' && filterId !== targetId) {
        continue;
      }
    } else if (eventType === 'OnVariableChanged') {
      const filterVar = p.varName;
      if (filterVar && filterVar !== 'any' && filterVar !== contextObj?.varName) {
        continue;
      }
    }
    executeOutput(node.id, 'flow', contextObj);
    executeOutput(node.id, 'out', contextObj);
  }
}

function executeOutput(nodeId, outputPortName, contextObj) {
  if (!NODE_DATA.connections) return;
  const normPort = String(outputPortName).toLowerCase();
  const conns = NODE_DATA.connections.filter(c => c.fromNode === nodeId && (String(c.fromPort).toLowerCase() === normPort || (normPort === 'flow' && String(c.fromPort).toLowerCase() === 'out') || (normPort === 'out' && String(c.fromPort).toLowerCase() === 'flow')));
  for (const conn of conns) {
    const targetNode = NODE_DATA.nodes.find(n => n.id === conn.toNode);
    if (targetNode) {
      executeNode(targetNode, conn.toPort, contextObj);
    }
  }
}

function executeNode(node, inPort, contextObj) {
  const p = node.data || node.properties || {};
  switch (node.type) {
    case 'CheckCondition': {
      const varName = p.varName || p.variableName;
      const expected = p.val !== undefined ? p.val : (p.value !== undefined ? p.value : p.expectedValue);
      const actual = graphVariables.get(varName);
      const op = p.operator || p.op || '==';
      let pass = false;
      if (op === '==') pass = String(actual) === String(expected) || actual == expected;
      else if (op === '!=') pass = String(actual) !== String(expected);
      else if (op === '>') pass = Number(actual) > Number(expected);
      else if (op === '<') pass = Number(actual) < Number(expected);
      else if (op === '>=') pass = Number(actual) >= Number(expected);
      else if (op === '<=') pass = Number(actual) <= Number(expected);

      if (pass) {
        executeOutput(node.id, 'true', contextObj);
      } else {
        executeOutput(node.id, 'false', contextObj);
      }
      break;
    }
    case 'FlipFlop': {
      const state = nodeStates.get(node.id) || 'A';
      if (state === 'A') {
        nodeStates.set(node.id, 'B');
        executeOutput(node.id, 'A', contextObj);
        executeOutput(node.id, 'a', contextObj);
      } else {
        nodeStates.set(node.id, 'A');
        executeOutput(node.id, 'B', contextObj);
        executeOutput(node.id, 'b', contextObj);
      }
      break;
    }
    case 'CounterGate': {
      if (String(inPort).toLowerCase() === 'reset') {
        nodeStates.set(node.id, 0);
        return;
      }
      const count = (nodeStates.get(node.id) || 0) + 1;
      const target = Number(p.targetCount) || 3;
      nodeStates.set(node.id, count);
      if (count >= target) {
        if (p.autoReset) nodeStates.set(node.id, 0);
        executeOutput(node.id, 'reached', contextObj);
      } else {
        executeOutput(node.id, 'not_reached', contextObj);
        executeOutput(node.id, 'step', contextObj);
      }
      break;
    }
    case 'Delay': {
      const seconds = Number(p.seconds !== undefined ? p.seconds : p.delayTime) || 1;
      setTimeout(() => {
        executeOutput(node.id, 'flow', contextObj);
        executeOutput(node.id, 'out', contextObj);
      }, seconds * 1000);
      break;
    }
    case 'RotateObject': {
      const targetId = p.targetId || p.targetObject;
      const obj = getObjectById(targetId) || contextObj;
      if (obj) {
        let dx = THREE.MathUtils.degToRad(Number(p.rotX) || 0);
        let dy = THREE.MathUtils.degToRad(Number(p.rotY) || 0);
        let dz = THREE.MathUtils.degToRad(Number(p.rotZ) || 0);
        if (p.axis) {
          const rad = THREE.MathUtils.degToRad(Number(p.angle) || 0);
          if (p.axis === 'x') dx = rad;
          else if (p.axis === 'y') dy = rad;
          else if (p.axis === 'z') dz = rad;
        }
        const duration = Number(p.duration) || 0;
        if (duration <= 0.001) {
          obj.rotation.x += dx; obj.rotation.y += dy; obj.rotation.z += dz;
          executeOutput(node.id, 'flow', contextObj);
          executeOutput(node.id, 'out', contextObj);
        } else {
          activeTweens.push({
            obj: obj,
            type: 'rotation',
            start: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
            target: { x: obj.rotation.x + dx, y: obj.rotation.y + dy, z: obj.rotation.z + dz },
            duration: duration,
            elapsed: 0,
            easing: p.easing || 'easeInOutQuad',
            onComplete: () => {
              executeOutput(node.id, 'flow', contextObj);
              executeOutput(node.id, 'out', contextObj);
            }
          });
          return;
        }
      }
      executeOutput(node.id, 'flow', contextObj);
      executeOutput(node.id, 'out', contextObj);
      break;
    }
    case 'MoveObject': {
      const targetId = p.targetId || p.targetObject;
      const obj = getObjectById(targetId) || contextObj;
      if (obj) {
        const dx = Number(p.dx !== undefined ? p.dx : p.moveX) || 0;
        const dy = Number(p.dy !== undefined ? p.dy : p.moveY) || 0;
        const dz = Number(p.dz !== undefined ? p.dz : p.moveZ) || 0;
        const duration = Number(p.duration) || 0;
        if (duration <= 0.001) {
          obj.position.x += dx; obj.position.y += dy; obj.position.z += dz;
          executeOutput(node.id, 'flow', contextObj);
          executeOutput(node.id, 'out', contextObj);
        } else {
          activeTweens.push({
            obj: obj,
            type: 'position',
            start: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
            target: { x: obj.position.x + dx, y: obj.position.y + dy, z: obj.position.z + dz },
            duration: duration,
            elapsed: 0,
            easing: p.easing || 'easeInOutQuad',
            onComplete: () => {
              executeOutput(node.id, 'flow', contextObj);
              executeOutput(node.id, 'out', contextObj);
            }
          });
          return;
        }
      }
      executeOutput(node.id, 'flow', contextObj);
      executeOutput(node.id, 'out', contextObj);
      break;
    }
    case 'SetActive': {
      const targetId = p.targetId || p.targetObject;
      const obj = getObjectById(targetId) || contextObj;
      if (obj) {
        let active = true;
        if (p.mode === 'toggle') {
          active = !obj.visible;
        } else if (p.mode === 'hide' || p.visible === false || p.visible === 'false') {
          active = false;
        } else {
          active = true;
        }
        obj.userData.active = active;
        obj.visible = active;
        updateHierarchyVisibility(obj);
      }
      executeOutput(node.id, 'flow', contextObj);
      executeOutput(node.id, 'out', contextObj);
      break;
    }
    case 'SetUIActive': {
      const uiId = p.uiId || p.elementId;
      const mode = p.mode || 'toggle';
      let targetEl = null;
      if (uiId === 'base:crosshair') targetEl = crosshairEl;
      else if (uiId === 'base:joystick') targetEl = jArea;
      else if (uiId === 'base:prompt') targetEl = promptEl;
      else targetEl = customUIElements.get(uiId);

      if (targetEl) {
        let isVis = targetEl.style.display !== 'none';
        let nextVis = true;
        if (mode === 'toggle') nextVis = !isVis;
        else nextVis = (mode === 'show');
        targetEl.style.display = nextVis ? '' : 'none';
      }
      executeOutput(node.id, 'flow', contextObj);
      executeOutput(node.id, 'out', contextObj);
      break;
    }
    case 'GetVariable': {
      const varName = p.varName || p.variableName;
      const val = graphVariables.get(varName);
      executeOutput(node.id, 'flow', { ...contextObj, varName, value: val });
      executeOutput(node.id, 'out', { ...contextObj, varName, value: val });
      break;
    }
    case 'SetVariable': {
      const varName = p.varName || p.variableName;
      if (varName) {
        const op = p.op || 'set';
        const val = p.val !== undefined ? p.val : p.value;
        const cur = graphVariables.get(varName);
        let nextVal = val;
        if (op === 'set') nextVal = val;
        else if (op === 'add') nextVal = (Number(cur) || 0) + Number(val);
        else if (op === 'subtract') nextVal = (Number(cur) || 0) - Number(val);
        else if (op === 'toggle') nextVal = !Boolean(cur);
        graphVariables.set(varName, nextVal);
        if (cur !== nextVal) {
          triggerNodeEvent('OnVariableChanged', { varName, value: nextVal });
        }
      }
      executeOutput(node.id, 'flow', contextObj);
      executeOutput(node.id, 'out', contextObj);
      break;
    }
    case 'SetUIText': {
      const elId = p.uiId || p.elementId;
      const el = customUIElements.get(elId);
      if (el) {
        let text = p.text !== undefined ? String(p.text) : '';
        text = text.replace(/\\{([a-zA-Z0-9_-]+)\\}/g, (_, vName) => {
          const v = graphVariables.get(vName);
          return v !== undefined ? v : ('{' + vName + '}');
        });
        el.textContent = text;
      }
      executeOutput(node.id, 'flow', contextObj);
      executeOutput(node.id, 'out', contextObj);
      break;
    }
    case 'ChangeColor': {
      const targetId = p.targetId || p.targetObject;
      const obj = getObjectById(targetId) || contextObj;
      if (obj && p.color) {
        const c = new THREE.Color(p.color);
        const setC = (m) => { if (m.isMesh && m.material) m.material.color.copy(c); };
        if (obj.isMesh) setC(obj); else obj.traverse(setC);
      }
      executeOutput(node.id, 'flow', contextObj);
      executeOutput(node.id, 'out', contextObj);
      break;
    }
    case 'InspectItem': {
      const targetId = p.targetId || p.targetObject;
      const obj = getObjectById(targetId) || contextObj;
      if (obj) {
        startInspect(obj);
      }
      executeOutput(node.id, 'flow', contextObj);
      executeOutput(node.id, 'out', contextObj);
      break;
    }
    default:
      executeOutput(node.id, 'flow', contextObj);
      executeOutput(node.id, 'out', contextObj);
      break;
  }
}

function updateTweens(dt) {
  for (let i = activeTweens.length - 1; i >= 0; i--) {
    const t = activeTweens[i];
    t.elapsed += dt;
    let progress = Math.min(1, t.elapsed / t.duration);
    let eased = progress;
    if (t.easing === 'easeInOutQuad') {
      eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    }
    if (t.type === 'rotation') {
      t.obj.rotation.x = t.start.x + (t.target.x - t.start.x) * eased;
      t.obj.rotation.y = t.start.y + (t.target.y - t.start.y) * eased;
      t.obj.rotation.z = t.start.z + (t.target.z - t.start.z) * eased;
    } else if (t.type === 'position') {
      t.obj.position.x = t.start.x + (t.target.x - t.start.x) * eased;
      t.obj.position.y = t.start.y + (t.target.y - t.start.y) * eased;
      t.obj.position.z = t.start.z + (t.target.z - t.start.z) * eased;
    }
    if (progress >= 1) {
      activeTweens.splice(i, 1);
      if (t.onComplete) t.onComplete();
    }
  }
}

// --- FPS Controller (inline) ---
const euler = new THREE.Euler(0,0,0,'YXZ');
let lockState = 'None';
const velocity = new THREE.Vector3();
const keys = { w: false, s: false, a: false, d: false };
let fpsEnabled = false;
const gravity = -15, moveSpeed = 5, lookSens = 0.002, playerH = 1.7, playerR = 0.3;
const activeTriggers = new Map();

function enableFPS() {
  fpsEnabled = true;
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKey);
  document.addEventListener('mousemove', onMouse);
  document.addEventListener('pointerlockchange', onPLC);
  renderer.domElement.addEventListener('click', onClick);
  document.body.addEventListener('click', (e) => {
    if (fpsEnabled && !inspectActive && lockState === 'None' && !e.target.closest('.mobile-joystick-area, .mobile-look-area, .mobile-interact-btn, .inspect-overlay')) {
      renderer.domElement.requestPointerLock();
    }
  });
  renderer.domElement.requestPointerLock();
}

function onKey(e) {
  const d = e.type === 'keydown';
  const code = e.code;
  const key = e.key ? e.key.toLowerCase() : '';
  if (code === 'KeyW' || key === 'w' || code === 'ArrowUp') keys.w = d;
  if (code === 'KeyS' || key === 's' || code === 'ArrowDown') keys.s = d;
  if (code === 'KeyA' || key === 'a' || code === 'ArrowLeft') keys.a = d;
  if (code === 'KeyD' || key === 'd' || code === 'ArrowRight') keys.d = d;
  if ((code === 'KeyE' || key === 'e') && d) tryInteract();
}
function onMouse(e) {
  if (lockState !== 'Locked') return;
  euler.setFromQuaternion(camera.quaternion, 'YXZ');
  euler.y -= e.movementX * lookSens;
  euler.x -= e.movementY * lookSens;
  euler.x = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, euler.x));
  camera.quaternion.setFromEuler(euler);
}
function onPLC() { lockState = document.pointerLockElement ? 'Locked' : 'None'; }
function onClick() { if (lockState === 'None' && fpsEnabled && !inspectActive) renderer.domElement.requestPointerLock(); }

function updateFPS(dt) {
  if (!fpsEnabled || inspectActive) return;
  velocity.y += gravity * dt;
  const fwd = new THREE.Vector3(0,0,-1); fwd.applyAxisAngle(new THREE.Vector3(0,1,0), euler.y); fwd.normalize();
  const right = new THREE.Vector3(1,0,0); right.applyAxisAngle(new THREE.Vector3(0,1,0), euler.y); right.normalize();
  const mv = new THREE.Vector3();
  if (keys.w) mv.add(fwd); if (keys.s) mv.sub(fwd); if (keys.d) mv.add(right); if (keys.a) mv.sub(right);

  if (mobileActive) {
    const mi = getMobileMove();
    if (mi.x !== 0 || mi.z !== 0) {
      mv.set(0,0,0);
      mv.addScaledVector(fwd, -mi.z);
      mv.addScaledVector(right, mi.x);
    }
  }

  if (mv.lengthSq()>0) mv.normalize();

  const np = camera.position.clone();
  np.addScaledVector(mv, moveSpeed*dt);
  np.y += velocity.y*dt;

  const colliders = allObjects.filter(o => o.userData?.collider?.enabled && !o.userData.collider.isTrigger && isActiveInHierarchy(o));
  const _pb = new THREE.Box3();
  const _cbox = new THREE.Box3();

  for (let iter = 0; iter < 2; iter++) {
    _pb.min.set(np.x-playerR, np.y-playerH, np.z-playerR);
    _pb.max.set(np.x+playerR, np.y, np.z+playerR);

    for (const c of colliders) {
      _cbox.setFromObject(c);
      if ((_cbox.max.y - _cbox.min.y) < 0.05) {
        _cbox.min.y -= 0.5;
      }
      if (!_pb.intersectsBox(_cbox)) continue;

      const sz = _cbox.getSize(new THREE.Vector3());
      const ct = _cbox.getCenter(new THREE.Vector3());
      const dx = np.x - ct.x;
      const dy = (np.y - playerH/2) - ct.y;
      const dz = np.z - ct.z;

      const ox = (playerR + sz.x/2) - Math.abs(dx);
      const oy = (playerH/2 + sz.y/2) - Math.abs(dy);
      const oz = (playerR + sz.z/2) - Math.abs(dz);

      if (ox<=0 || oy<=0 || oz<=0) continue;

      if (oy < ox && oy < oz) {
        if (dy > 0) {
          np.y = _cbox.max.y + playerH;
          velocity.y = 0;
        } else {
          np.y = _cbox.min.y;
        }
      } else if (ox < oz) {
        np.x += dx > 0 ? ox : -ox;
      } else {
        np.z += dz > 0 ? oz : -oz;
      }

      _pb.min.set(np.x-playerR, np.y-playerH, np.z-playerR);
      _pb.max.set(np.x+playerR, np.y, np.z+playerR);
    }
  }

  if (np.y < playerH) { np.y = playerH; velocity.y = 0; }
  camera.position.copy(np);

  // Trigger checks
  const triggers = allObjects.filter(o => o.userData?.collider?.enabled && o.userData.collider.isTrigger && isActiveInHierarchy(o));
  const currentInside = new Set();
  _pb.min.set(np.x-playerR, np.y-playerH, np.z-playerR);
  _pb.max.set(np.x+playerR, np.y, np.z+playerR);

  for (const trg of triggers) {
    _cbox.setFromObject(trg);
    if ((_cbox.max.y - _cbox.min.y) < 0.05) _cbox.min.y -= 0.5;
    if (_pb.intersectsBox(_cbox)) {
      currentInside.add(trg.userData.id);
      if (!activeTriggers.has(trg.userData.id)) {
        activeTriggers.set(trg.userData.id, trg);
        triggerNodeEvent('OnTriggerEnter', trg);
      }
    }
  }

  for (const [id, trg] of activeTriggers) {
    if (!currentInside.has(id)) {
      activeTriggers.delete(id);
      triggerNodeEvent('OnTriggerExit', trg);
    }
  }
}

// --- Interaction (inline) ---
const raycaster = new THREE.Raycaster();
const promptEl = document.createElement('div'); promptEl.className='interact-prompt'; document.body.appendChild(promptEl);
const crosshairEl = document.createElement('div'); crosshairEl.className='crosshair'; document.body.appendChild(crosshairEl);
let currentTarget = null;

function updateInteraction() {
  if (!fpsEnabled || inspectActive) return;
  raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
  const interactables = allObjects.filter(o => o.userData?.interaction?.enabled && isActiveInHierarchy(o));
  const meshes = [];
  interactables.forEach(o => { if (o.isMesh) meshes.push(o); else o.traverse(c => { if (c.isMesh) meshes.push(c); }); });
  const hits = raycaster.intersectObjects(meshes, false);
  let found = null;
  for (const h of hits) {
    if (h.distance > 3) continue;
    let t = h.object; while (t && !t.userData?.interaction?.enabled) t = t.parent;
    if (t) { found = t; break; }
  }
  if (found !== currentTarget) {
    currentTarget = found;
    if (found) {
      promptEl.textContent = found.userData.interaction.promptText || 'Press E';
      promptEl.style.display = 'block';
      if (mobileActive) showMobileInteract();
    } else {
      promptEl.style.display = 'none';
      if (mobileActive) hideMobileInteract();
    }
  }
}

function tryInteract() {
  if (!currentTarget || inspectActive) return;
  triggerNodeEvent('OnInteract', currentTarget);
  if (currentTarget.userData?.interaction?.type === 'inspect') startInspect(currentTarget);
}

// --- Item Inspector (inline) ---
let inspectActive = false;
const inspectScene = new THREE.Scene();
inspectScene.add(new THREE.AmbientLight(0xffffff, 0.7));
const iDir = new THREE.DirectionalLight(0xffffff, 0.9); iDir.position.set(3,4,5); inspectScene.add(iDir);
const iFill = new THREE.DirectionalLight(0xaaccff, 0.3); iFill.position.set(-2,1,-3); inspectScene.add(iFill);
const iCam = new THREE.PerspectiveCamera(40,1,0.01,100); iCam.position.set(0,0,3);

const overlay = document.createElement('div'); overlay.className='inspect-overlay'; overlay.style.display='none';
const iCanvas = document.createElement('canvas'); overlay.appendChild(iCanvas);
const iRenderer = new THREE.WebGLRenderer({ canvas: iCanvas, alpha: true, antialias: true });
iRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); iRenderer.outputColorSpace = THREE.SRGBColorSpace;
const closeBtn = document.createElement('button'); closeBtn.className='inspect-close'; closeBtn.textContent='✕';
closeBtn.addEventListener('click', closeInspect); overlay.appendChild(closeBtn);
const hintEl = document.createElement('div'); hintEl.className='inspect-hint'; hintEl.textContent='Drag to rotate · ESC to close';
overlay.appendChild(hintEl); document.body.appendChild(overlay);

let inspClone = null, isDrag = false, prevM = {x:0,y:0};
overlay.addEventListener('mousedown', e => { if(!e.target.closest('.inspect-close')){isDrag=true;prevM={x:e.clientX,y:e.clientY};} });
overlay.addEventListener('mousemove', e => { if(!isDrag||!inspClone)return; inspClone.rotation.y+=(e.clientX-prevM.x)*0.008; inspClone.rotation.x+=(e.clientY-prevM.y)*0.008; prevM={x:e.clientX,y:e.clientY}; });
window.addEventListener('mouseup', ()=>{isDrag=false;});
overlay.addEventListener('touchstart', e => { if(e.target.closest('.inspect-close'))return; if(e.touches.length===1){isDrag=true;prevM={x:e.touches[0].clientX,y:e.touches[0].clientY};} }, {passive:false});
overlay.addEventListener('touchmove', e => { e.preventDefault(); if(!isDrag||!inspClone||e.touches.length!==1)return; inspClone.rotation.y+=(e.touches[0].clientX-prevM.x)*0.008; inspClone.rotation.x+=(e.touches[0].clientY-prevM.y)*0.008; prevM={x:e.touches[0].clientX,y:e.touches[0].clientY}; }, {passive:false});
overlay.addEventListener('touchend', ()=>{isDrag=false;});
window.addEventListener('keydown', e => { if(e.key==='Escape'&&inspectActive){e.preventDefault();closeInspect();} });

function startInspect(obj) {
  inspectActive = true; promptEl.style.display='none'; crosshairEl.style.display='none';
  if(mobileActive) hideMobileInteract();
  if(document.pointerLockElement) document.exitPointerLock();
  const clone = obj.clone(true);
  const box = new THREE.Box3().setFromObject(clone); const center = box.getCenter(new THREE.Vector3());
  clone.position.sub(center); const sz = box.getSize(new THREE.Vector3());
  iCam.position.set(0,0,Math.max(sz.x,sz.y,sz.z)*2.2); iCam.lookAt(0,0,0);
  if(inspClone) inspectScene.remove(inspClone);
  inspectScene.add(clone); inspClone = clone;
  overlay.style.display='flex';
  const w=window.innerWidth*0.7, h=window.innerHeight*0.7;
  iRenderer.setSize(w,h); iCam.aspect=w/h; iCam.updateProjectionMatrix();
}

function closeInspect() {
  overlay.style.display='none'; inspectActive=false;
  if(inspClone){inspectScene.remove(inspClone);inspClone=null;}
  crosshairEl.style.display='block';
  if(fpsEnabled) renderer.domElement.requestPointerLock();
}

// --- Mobile Controls (inline) ---
let mobileActive = false, mMoveX = 0, mMoveZ = 0, jTouch = null, lTouch = null, jCenter = {x:0,y:0}, lPrev = {x:0,y:0};
const jArea = document.createElement('div'); jArea.className='mobile-joystick-area';
const jBase = document.createElement('div'); jBase.className='mobile-joystick-base';
const jThumb = document.createElement('div'); jThumb.className='mobile-joystick-thumb';
jBase.appendChild(jThumb); jArea.appendChild(jBase); document.body.appendChild(jArea);
const lArea = document.createElement('div'); lArea.className='mobile-look-area'; document.body.appendChild(lArea);
const mBtn = document.createElement('button'); mBtn.className='mobile-interact-btn'; mBtn.textContent='E'; mBtn.style.display='none'; document.body.appendChild(mBtn);

function showMobileInteract(){ if(mobileActive){mBtn.style.display='flex';mBtn.style.alignItems='center';mBtn.style.justifyContent='center';} }
function hideMobileInteract(){ mBtn.style.display='none'; }
function getMobileMove(){ return {x:mMoveX,z:mMoveZ}; }

function activateMobileUI() {
  if (mobileActive) return;
  mobileActive = true;
  jArea.style.display = 'block';
  lArea.style.display = 'block';
}

const isLikelyMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ((window.innerWidth <= 768) && ('ontouchstart' in window));
if (isLikelyMobile) activateMobileUI();

window.addEventListener('touchstart', () => {
  if (!mobileActive && isLikelyMobile) {
    activateMobileUI();
  }
}, { passive: true });

jArea.addEventListener('touchstart', e=>{e.preventDefault();if(jTouch!==null)return;const t=e.changedTouches[0];jTouch=t.identifier;const r=jBase.getBoundingClientRect();jCenter={x:r.left+r.width/2,y:r.top+r.height/2};},{passive:false});
jArea.addEventListener('touchmove', e=>{e.preventDefault();for(const t of e.changedTouches){if(t.identifier!==jTouch)continue;let dx=t.clientX-jCenter.x,dy=t.clientY-jCenter.y;const d=Math.sqrt(dx*dx+dy*dy);if(d>40){dx=(dx/d)*40;dy=(dy/d)*40;}jThumb.style.transform='translate(' + dx + 'px,' + dy + 'px)';mMoveX=dx/40;mMoveZ=dy/40;}},{passive:false});
jArea.addEventListener('touchend', e=>{for(const t of e.changedTouches){if(t.identifier===jTouch){jTouch=null;mMoveX=0;mMoveZ=0;jThumb.style.transform='translate(0,0)';}}},{passive:false});
jArea.addEventListener('touchcancel', e=>{jTouch=null;mMoveX=0;mMoveZ=0;jThumb.style.transform='translate(0,0)';},{passive:false});
lArea.addEventListener('touchstart', e=>{e.preventDefault();if(lTouch!==null)return;const t=e.changedTouches[0];lTouch=t.identifier;lPrev={x:t.clientX,y:t.clientY};},{passive:false});
lArea.addEventListener('touchmove', e=>{e.preventDefault();for(const t of e.changedTouches){if(t.identifier!==lTouch)continue;const dx=t.clientX-lPrev.x,dy=t.clientY-lPrev.y;lPrev={x:t.clientX,y:t.clientY};euler.setFromQuaternion(camera.quaternion,'YXZ');euler.y-=dx*lookSens*5;euler.x-=dy*lookSens*5;euler.x=Math.max(-Math.PI/2+0.01,Math.min(Math.PI/2-0.01,euler.x));camera.quaternion.setFromEuler(euler);}},{passive:false});
lArea.addEventListener('touchend', ()=>{lTouch=null;},{passive:false});
lArea.addEventListener('touchcancel', ()=>{lTouch=null;},{passive:false});
mBtn.addEventListener('touchstart', e=>{e.preventDefault();tryInteract();},{passive:false});

// --- Start ---
async function init() {
  await loadAssets();
  buildScene();
  buildCustomUI();
  applyBaseUI();
  initNodeGraph();

  const startScreen = document.getElementById('startScreen');
  startScreen.addEventListener('click', () => {
    startScreen.style.display = 'none';
    enableFPS();
    if (isLikelyMobile) activateMobileUI();
    triggerNodeEvent('OnStart', null);
  });

  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.1);
    updateFPS(dt);
    updateTweens(dt);
    updateInteraction();
    renderer.render(scene, camera);
    if (inspectActive) iRenderer.render(inspectScene, iCam);
  }
  loop();
}

init();
<\/script>
</body>
</html>`;
  }
}

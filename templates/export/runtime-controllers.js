const nodeRuntime = new NodeGraphRuntime(sceneManagerAdapter, uiManagerAdapter, itemInspectorAdapter, collisionAdapter);
nodeRuntime.deserialize(NODE_DATA);

let activePlayerObj = null;
let activeCameraObj = null;

function setupPlayEntities() {
  allObjects.forEach(o => {
    o.traverse(c => {
      if (c.userData?.isGizmo) c.visible = false;
    });
  });

  activePlayerObj = allObjects.find(o => 
    (o.userData?.type === 'player_controller' || o.userData?.components?.playerController?.enabled) && isActiveInHierarchy(o)
  );
  activeCameraObj = allObjects.find(o => 
    (o.userData?.type === 'camera' || o.isCamera || o.userData?.components?.camera?.enabled) && isActiveInHierarchy(o)
  );

  if (activePlayerObj) {
    activePlayerObj.updateMatrixWorld(true);
    let childCam = activePlayerObj.children.find(c => (c.isCamera || c.userData?.type === 'camera') && !c.userData?.isGizmo)
      || sceneManagerAdapter.getChildren(activePlayerObj.userData.id).find(c => (c.isCamera || c.userData?.type === 'camera') && !c.userData?.isGizmo);
    if (!childCam) {
      const pCtrl = activePlayerObj.userData?.components?.playerController || activePlayerObj.userData?.playerController || {};
      const camY = pCtrl.cameraOffsetY !== undefined ? pCtrl.cameraOffsetY : 1.6;
      childCam = new THREE.Group();
      childCam.name = 'MainCamera';
      childCam.userData = { id: crypto.randomUUID(), name: 'MainCamera', type: 'camera', parentId: activePlayerObj.userData.id, components: { camera: { enabled: true, fov: 75, near: 0.1, far: 1000 } } };
      childCam.position.set(0, camY, 0);
      activePlayerObj.add(childCam);
      allObjects.push(childCam);
      objMap.set(childCam.userData.id, childCam);
    }
    childCam.updateMatrixWorld(true);
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    childCam.getWorldPosition(worldPos);
    childCam.getWorldQuaternion(worldQuat);
    camera.position.copy(worldPos);
    camera.quaternion.copy(worldQuat);
    const camData = childCam.userData?.components?.camera || childCam.userData?.camera || {};
    if (camData.fov) camera.fov = camData.fov;
    if (camData.near) camera.near = camData.near;
    if (camData.far) camera.far = camData.far;
    camera.updateProjectionMatrix();
  } else if (activeCameraObj) {
    activeCameraObj.updateMatrixWorld(true);
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    activeCameraObj.getWorldPosition(worldPos);
    activeCameraObj.getWorldQuaternion(worldQuat);
    camera.position.copy(worldPos);
    camera.quaternion.copy(worldQuat);
    const camData = activeCameraObj.userData?.components?.camera || activeCameraObj.userData?.camera || {};
    if (camData.fov) camera.fov = camData.fov;
    if (camData.near) camera.near = camData.near;
    if (camData.far) camera.far = camData.far;
    camera.updateProjectionMatrix();
  }
}

const fallbackEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const fallbackVelocity = new THREE.Vector3();
let fallbackEnabled = false;
const fallbackKeys = { w: false, s: false, a: false, d: false };
const fallbackGravity = -15, fallbackSpeed = 5, fallbackLookSens = 0.002, fallbackH = 1.7, fallbackR = 0.3;

function enableFallbackFPS() {
  fallbackEnabled = true;
  const sp = SCENE_DATA.playerSpawn || { rotation: { x: 0, y: 0, z: 0 } };
  fallbackEuler.set(
    THREE.MathUtils.degToRad(sp.rotation?.x || 0),
    THREE.MathUtils.degToRad(sp.rotation?.y || 0),
    0,
    'YXZ'
  );
  camera.quaternion.setFromEuler(fallbackEuler);
  window.addEventListener('keydown', (e) => {
    const code = e.code;
    const key = e.key ? e.key.toLowerCase() : '';
    if (code === 'KeyW' || key === 'w' || code === 'ArrowUp') fallbackKeys.w = true;
    if (code === 'KeyS' || key === 's' || code === 'ArrowDown') fallbackKeys.s = true;
    if (code === 'KeyA' || key === 'a' || code === 'ArrowLeft') fallbackKeys.a = true;
    if (code === 'KeyD' || key === 'd' || code === 'ArrowRight') fallbackKeys.d = true;
  });
  window.addEventListener('keyup', (e) => {
    const code = e.code;
    const key = e.key ? e.key.toLowerCase() : '';
    if (code === 'KeyW' || key === 'w' || code === 'ArrowUp') fallbackKeys.w = false;
    if (code === 'KeyS' || key === 's' || code === 'ArrowDown') fallbackKeys.s = false;
    if (code === 'KeyA' || key === 'a' || code === 'ArrowLeft') fallbackKeys.a = false;
    if (code === 'KeyD' || key === 'd' || code === 'ArrowRight') fallbackKeys.d = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!document.pointerLockElement || activePlayerObj) return;
    fallbackEuler.setFromQuaternion(camera.quaternion, 'YXZ');
    fallbackEuler.y -= e.movementX * fallbackLookSens;
    fallbackEuler.x -= e.movementY * fallbackLookSens;
    fallbackEuler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, fallbackEuler.x));
    camera.quaternion.setFromEuler(fallbackEuler);
  });
}

function updateFallbackFPS(dt) {
  if (activePlayerObj || !fallbackEnabled || inspectActive) return;
  fallbackVelocity.y += fallbackGravity * dt;
  const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), fallbackEuler.y).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), fallbackEuler.y).normalize();
  const mv = new THREE.Vector3();
  if (fallbackKeys.w) mv.add(fwd);
  if (fallbackKeys.s) mv.sub(fwd);
  if (fallbackKeys.d) mv.add(right);
  if (fallbackKeys.a) mv.sub(right);

  if (mobileActive) {
    const mi = getMobileMove();
    if (mi.x !== 0 || mi.z !== 0) {
      mv.set(0, 0, 0);
      mv.addScaledVector(fwd, -mi.z);
      mv.addScaledVector(right, mi.x);
    }
  }

  if (mv.lengthSq() > 0) mv.normalize();
  const np = camera.position.clone();
  np.addScaledVector(mv, fallbackSpeed * dt);
  np.y += fallbackVelocity.y * dt;

  const res = collisionAdapter.resolvePlayerCollision(np, fallbackR, fallbackH);
  if (res.grounded && fallbackVelocity.y < 0) fallbackVelocity.y = 0;
  if (res.position.y < fallbackH) {
    res.position.y = fallbackH;
    fallbackVelocity.y = 0;
  }
  camera.position.copy(res.position);
  collisionAdapter.checkTriggers(camera.position, fallbackR);
}

const raycaster = new THREE.Raycaster();
let currentTarget = null;

function updateInteraction() {
  if (inspectActive) return;
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const interactables = allObjects.filter(o => {
    const inter = o.userData?.components?.interaction || o.userData?.interaction;
    return inter && inter.enabled && isActiveInHierarchy(o);
  });
  const meshes = [];
  interactables.forEach(o => {
    if (o.isMesh) meshes.push(o);
    else o.traverse(c => { if (c.isMesh) meshes.push(c); });
  });
  const hits = raycaster.intersectObjects(meshes, false);
  let found = null;
  for (const h of hits) {
    let t = h.object;
    while (t && !(t.userData?.components?.interaction?.enabled || t.userData?.interaction?.enabled)) t = t.parent;
    if (t) {
      const inter = t.userData?.components?.interaction || t.userData?.interaction || {};
      const maxDist = inter.maxDistance !== undefined ? inter.maxDistance : 3.5;
      if (h.distance <= maxDist) {
        found = t;
        break;
      }
    }
  }
  if (found !== currentTarget) {
    currentTarget = found;
    if (found) {
      const inter = found.userData?.components?.interaction || found.userData?.interaction || {};
      promptEl.textContent = inter.promptText || 'Press E';
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
  nodeRuntime.triggerEvent('OnInteract', currentTarget);
  const inter = currentTarget.userData?.components?.interaction || currentTarget.userData?.interaction;
  if (inter?.type === 'inspect') {
    startInspect(currentTarget);
  }
}

let inspectActive = false;
const inspectScene = new THREE.Scene();
inspectScene.add(new THREE.AmbientLight(0xffffff, 0.7));
const iDir = new THREE.DirectionalLight(0xffffff, 0.9);
iDir.position.set(3, 4, 5);
inspectScene.add(iDir);
const iFill = new THREE.DirectionalLight(0xaaccff, 0.3);
iFill.position.set(-2, 1, -3);
inspectScene.add(iFill);
const iCam = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
iCam.position.set(0, 0, 3);

const overlay = document.createElement('div');
overlay.className = 'inspect-overlay';
overlay.style.display = 'none';
const iCanvas = document.createElement('canvas');
overlay.appendChild(iCanvas);
const iRenderer = new THREE.WebGLRenderer({ canvas: iCanvas, alpha: true, antialias: true });
iRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
iRenderer.outputColorSpace = THREE.SRGBColorSpace;
const closeBtn = document.createElement('button');
closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
closeBtn.addEventListener('click', closeInspect);
overlay.appendChild(closeBtn);
const hintEl = document.createElement('div');
hintEl.className = 'inspect-hint';
hintEl.textContent = 'Drag to rotate · ESC to close';
overlay.appendChild(hintEl);
document.body.appendChild(overlay);

let inspClone = null, isDrag = false, prevM = { x: 0, y: 0 };
overlay.addEventListener('mousedown', e => {
  if (!e.target.closest('.inspect-close')) {
    isDrag = true;
    prevM = { x: e.clientX, y: e.clientY };
  }
});
overlay.addEventListener('mousemove', e => {
  if (!isDrag || !inspClone) return;
  inspClone.rotation.y += (e.clientX - prevM.x) * 0.008;
  inspClone.rotation.x += (e.clientY - prevM.y) * 0.008;
  prevM = { x: e.clientX, y: e.clientY };
});
window.addEventListener('mouseup', () => { isDrag = false; });
overlay.addEventListener('touchstart', e => {
  if (e.target.closest('.inspect-close')) return;
  if (e.touches.length === 1) {
    isDrag = true;
    prevM = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
}, { passive: false });
overlay.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!isDrag || !inspClone || e.touches.length !== 1) return;
  inspClone.rotation.y += (e.touches[0].clientX - prevM.x) * 0.008;
  inspClone.rotation.x += (e.touches[0].clientY - prevM.y) * 0.008;
  prevM = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: false });
overlay.addEventListener('touchend', () => { isDrag = false; });
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && inspectActive) {
    e.preventDefault();
    closeInspect();
  }
});

function startInspect(obj) {
  inspectActive = true;
  promptEl.style.display = 'none';
  crosshairEl.style.display = 'none';
  if (mobileActive) hideMobileInteract();
  if (document.pointerLockElement) document.exitPointerLock();
  const clone = obj.clone(true);
  clone.traverse(c => {
    if (c.userData?.isGizmo || c.name?.includes('Gizmo') || c.name?.includes('Helper')) {
      c.visible = false;
    }
  });
  const box = new THREE.Box3().setFromObject(clone);
  const center = box.getCenter(new THREE.Vector3());
  clone.position.sub(center);
  const sz = box.getSize(new THREE.Vector3());
  iCam.position.set(0, 0, Math.max(sz.x, sz.y, sz.z, 0.5) * 2.2);
  iCam.lookAt(0, 0, 0);
  if (inspClone) inspectScene.remove(inspClone);
  inspectScene.add(clone);
  inspClone = clone;
  overlay.style.display = 'flex';
  const w = window.innerWidth * 0.7, h = window.innerHeight * 0.7;
  iRenderer.setSize(w, h);
  iCam.aspect = w / h;
  iCam.updateProjectionMatrix();
}

function closeInspect() {
  overlay.style.display = 'none';
  inspectActive = false;
  if (inspClone) {
    inspectScene.remove(inspClone);
    inspClone = null;
  }
  crosshairEl.style.display = 'block';
  if (document.body.requestPointerLock) {
    try { renderer.domElement.requestPointerLock?.(); } catch (err) {}
  }
}

let mobileActive = false, mMoveX = 0, mMoveZ = 0, jTouch = null, lTouch = null, jCenter = { x: 0, y: 0 }, lPrev = { x: 0, y: 0 };

function showMobileInteract() {
  if (mobileActive) {
    mBtn.style.display = 'flex';
    mBtn.style.alignItems = 'center';
    mBtn.style.justifyContent = 'center';
  }
}
function hideMobileInteract() { mBtn.style.display = 'none'; }
function getMobileMove() { return { x: mMoveX, z: mMoveZ }; }

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

jArea.addEventListener('touchstart', e => {
  e.preventDefault();
  if (jTouch !== null) return;
  const t = e.changedTouches[0];
  jTouch = t.identifier;
  const r = jBase.getBoundingClientRect();
  jCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, { passive: false });

jArea.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier !== jTouch) continue;
    let dx = t.clientX - jCenter.x;
    let dy = t.clientY - jCenter.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 40) { dx = (dx / d) * 40; dy = (dy / d) * 40; }
    jThumb.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    mMoveX = dx / 40;
    mMoveZ = dy / 40;

    if (mMoveZ < -0.2) { nodeRuntime._keys.add('KeyW'); nodeRuntime._keys.delete('KeyS'); }
    else if (mMoveZ > 0.2) { nodeRuntime._keys.add('KeyS'); nodeRuntime._keys.delete('KeyW'); }
    else { nodeRuntime._keys.delete('KeyW'); nodeRuntime._keys.delete('KeyS'); }

    if (mMoveX > 0.2) { nodeRuntime._keys.add('KeyD'); nodeRuntime._keys.delete('KeyA'); }
    else if (mMoveX < -0.2) { nodeRuntime._keys.add('KeyA'); nodeRuntime._keys.delete('KeyD'); }
    else { nodeRuntime._keys.delete('KeyA'); nodeRuntime._keys.delete('KeyD'); }
  }
}, { passive: false });

jArea.addEventListener('touchend', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === jTouch) {
      jTouch = null;
      mMoveX = 0;
      mMoveZ = 0;
      jThumb.style.transform = 'translate(0,0)';
      nodeRuntime._keys.delete('KeyW');
      nodeRuntime._keys.delete('KeyS');
      nodeRuntime._keys.delete('KeyA');
      nodeRuntime._keys.delete('KeyD');
    }
  }
}, { passive: false });

jArea.addEventListener('touchcancel', e => {
  jTouch = null;
  mMoveX = 0;
  mMoveZ = 0;
  jThumb.style.transform = 'translate(0,0)';
  nodeRuntime._keys.delete('KeyW');
  nodeRuntime._keys.delete('KeyS');
  nodeRuntime._keys.delete('KeyA');
  nodeRuntime._keys.delete('KeyD');
}, { passive: false });

lArea.addEventListener('touchstart', e => {
  e.preventDefault();
  if (lTouch !== null) return;
  const t = e.changedTouches[0];
  lTouch = t.identifier;
  lPrev = { x: t.clientX, y: t.clientY };
}, { passive: false });

lArea.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier !== lTouch) continue;
    const dx = t.clientX - lPrev.x;
    const dy = t.clientY - lPrev.y;
    lPrev = { x: t.clientX, y: t.clientY };
    nodeRuntime._mouseDelta.x += dx * 2.5;
    nodeRuntime._mouseDelta.y += dy * 2.5;

    if (!activePlayerObj) {
      fallbackEuler.setFromQuaternion(camera.quaternion, 'YXZ');
      fallbackEuler.y -= dx * fallbackLookSens * 5;
      fallbackEuler.x -= dy * fallbackLookSens * 5;
      fallbackEuler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, fallbackEuler.x));
      camera.quaternion.setFromEuler(fallbackEuler);
    }
  }
}, { passive: false });

lArea.addEventListener('touchend', () => { lTouch = null; }, { passive: false });
lArea.addEventListener('touchcancel', () => { lTouch = null; }, { passive: false });
mBtn.addEventListener('touchstart', e => { e.preventDefault(); tryInteract(); }, { passive: false });

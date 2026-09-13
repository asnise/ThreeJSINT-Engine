function buildScene() {
  const sp = SCENE_DATA.playerSpawn || { position: { x: 0, y: 1.7, z: 5 }, rotation: { x: 0, y: 0, z: 0 } };
  camera.position.set(sp.position.x, sp.position.y, sp.position.z);
  if (sp.rotation) {
    camera.rotation.set(
      THREE.MathUtils.degToRad(sp.rotation.x || 0),
      THREE.MathUtils.degToRad(sp.rotation.y || 0),
      THREE.MathUtils.degToRad(sp.rotation.z || 0)
    );
  }

  const objMap = new Map();
  const alreadyParented = new Set();

  const rawObjects = Array.isArray(SCENE_DATA.objects) ? SCENE_DATA.objects : [];
  const seenIds = new Set();
  const deduplicatedObjects = [];
  for (const o of rawObjects) {
    const id = o.userData?.id;
    if (id) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
    }
    deduplicatedObjects.push(o);
  }

  const getDepth = (id, visited = new Set()) => {
    if (!id || visited.has(id)) return 0;
    visited.add(id);
    const item = deduplicatedObjects.find(o => o.userData?.id === id);
    if (!item || !item.userData?.parentId) return 0;
    return 1 + getDepth(item.userData.parentId, visited);
  };

  const sortedObjects = [...deduplicatedObjects].sort((a, b) => {
    return getDepth(a.userData?.id) - getDepth(b.userData?.id);
  });

  const normalizeComponents = (ud) => {
    if (!ud) return;
    if (!ud.components) ud.components = {};
    if (ud.components.collider && !ud.collider) ud.collider = ud.components.collider;
    if (ud.collider && !ud.components.collider) ud.components.collider = ud.collider;
    if (ud.components.interaction && !ud.interaction) ud.interaction = ud.components.interaction;
    if (ud.interaction && !ud.components.interaction) ud.components.interaction = ud.interaction;
    if (ud.components.playerController && !ud.playerController) ud.playerController = ud.components.playerController;
    if (ud.playerController && !ud.components.playerController) ud.components.playerController = ud.playerController;
    if (ud.components.camera && !ud.camera) ud.camera = ud.components.camera;
    if (ud.camera && !ud.components.camera) ud.components.camera = ud.camera;
  };

  const applyMaterials = (targetObj, matDataList, isImported = false) => {
    if (!matDataList || !Array.isArray(matDataList)) return;
    let matIndex = 0;
    const applySavedMats = (mesh) => {
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const saved = matDataList[matIndex++];
        if (saved) {
          if (saved.color && m.color) m.color.set(saved.color);
          if (saved.roughness !== undefined && m.roughness !== undefined) m.roughness = saved.roughness;
          if (saved.metalness !== undefined && m.metalness !== undefined) m.metalness = saved.metalness;
          if (saved.opacity !== undefined) {
            m.opacity = saved.opacity;
            m.transparent = saved.transparent ?? (saved.opacity < 1);
          }
          if (saved.wireframe !== undefined) m.wireframe = saved.wireframe;
          if (saved.side === 'double') m.side = THREE.DoubleSide;
          else if (saved.side === 'back') m.side = THREE.BackSide;
          else if (saved.side === 'front') m.side = THREE.FrontSide;
          if (saved.textureId && loadedTextures[saved.textureId]) {
            m.map = loadedTextures[saved.textureId];
            if (isImported) m.map.flipY = false;
          }
          m.needsUpdate = true;
        }
      });
    };
    if (targetObj.isMesh) applySavedMats(targetObj); else targetObj.traverse(applySavedMats);
  };

  const applyTextures = (targetObj, texData, isImported = false) => {
    if (!texData) return;
    if (texData.base && loadedTextures[texData.base]) {
      const tex = loadedTextures[texData.base];
      if (isImported) tex.flipY = false;
      const applyTex = (m) => {
        if (m.isMesh && m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => {
            mat.map = tex;
            if (isImported && mat.color) mat.color.setHex(0xffffff);
            mat.needsUpdate = true;
          });
        }
      };
      if (targetObj.isMesh) applyTex(targetObj); else targetObj.traverse(applyTex);
    }
  };

  for (const od of sortedObjects) {
    if (objMap.has(od.userData?.id)) continue;

    let obj = null;

    if (od.userData?.parentId && objMap.has(od.userData.parentId)) {
      const parent = objMap.get(od.userData.parentId);
      let found = null;
      parent.traverse((c) => {
        if (!found && c !== parent && (c.userData?.id === od.userData.id || c.name === od.userData.name || c.name === od.userData.submeshName)) {
          found = c;
        }
      });
      if (found) {
        obj = found;
        obj.userData = { ...obj.userData, ...od.userData };
        normalizeComponents(obj.userData);
        obj.position.set(od.position.x, od.position.y, od.position.z);
        obj.rotation.set(
          THREE.MathUtils.degToRad(od.rotation.x),
          THREE.MathUtils.degToRad(od.rotation.y),
          THREE.MathUtils.degToRad(od.rotation.z)
        );
        obj.scale.set(od.scale.x, od.scale.y, od.scale.z);
        obj.visible = (obj.userData.active !== false);

        applyMaterials(obj, od.materials, od.userData?.type === 'imported_mesh');
        applyTextures(obj, od.userData?.textures, od.userData?.type === 'imported_mesh');

        objMap.set(od.userData.id, obj);
        alreadyParented.add(od.userData.id);
        if (!allObjects.includes(obj)) allObjects.push(obj);
        continue;
      }
    }

    if (!od.userData?.parentId && od.userData.type === 'imported_mesh' && od.userData.meshAssetId && loadedMeshScenes[od.userData.meshAssetId]) {
      obj = loadedMeshScenes[od.userData.meshAssetId].clone(true);
      const childDatas = sortedObjects.filter((o) => o.userData?.parentId === od.userData.id);
      const expectedChildren = new Set(
        childDatas.map((o) => o.userData.submeshName || o.userData.name || o.userData.id)
      );

      let pieces = obj.children;
      if (pieces.length === 1 && pieces[0].children && pieces[0].children.length > 1) {
        pieces = pieces[0].children;
      }

      if (childDatas.length > 0 && pieces.length > 1) {
        const toRemove = [];
        for (const piece of pieces) {
          const matchedChild = childDatas.find(
            (cd) =>
              (cd.userData.submeshName && (cd.userData.submeshName === piece.name || cd.userData.submeshName === piece.userData?.name)) ||
              (cd.userData.name && (cd.userData.name === piece.name || cd.userData.name === piece.userData?.name)) ||
              (cd.userData.id && cd.userData.id === piece.userData?.id)
          );

          if (matchedChild) {
            piece.userData = { ...piece.userData, ...matchedChild.userData };
            normalizeComponents(piece.userData);
            piece.position.set(matchedChild.position.x, matchedChild.position.y, matchedChild.position.z);
            piece.rotation.set(
              THREE.MathUtils.degToRad(matchedChild.rotation.x),
              THREE.MathUtils.degToRad(matchedChild.rotation.y),
              THREE.MathUtils.degToRad(matchedChild.rotation.z)
            );
            piece.scale.set(matchedChild.scale.x, matchedChild.scale.y, matchedChild.scale.z);
            applyMaterials(piece, matchedChild.materials, true);
            applyTextures(piece, matchedChild.userData?.textures, true);
            alreadyParented.add(piece.userData.id);
            objMap.set(piece.userData.id, piece);
            if (!allObjects.includes(piece)) allObjects.push(piece);
          } else {
            const nameMatch = piece.name && expectedChildren.has(piece.name);
            const idMatch = piece.userData?.id && expectedChildren.has(piece.userData.id);
            if (!nameMatch && !idMatch) {
              toRemove.push(piece);
            }
          }
        }
        toRemove.forEach((p) => {
          if (p.parent) p.parent.remove(p);
        });
      }
    } else if (od.userData.components?.mesh || od.userData.primitiveType) {
      const meshComp = od.userData.components?.mesh || {};
      const geomType = meshComp.geometryType || od.userData.primitiveType || 'cube';
      const color = meshComp.color ? new THREE.Color(meshComp.color) : (od.color ? new THREE.Color(od.color) : new THREE.Color(0x888888));
      const roughness = meshComp.roughness !== undefined ? meshComp.roughness : 0.5;
      const metalness = meshComp.metalness !== undefined ? meshComp.metalness : 0.0;
      const opacity = meshComp.opacity !== undefined ? meshComp.opacity : (od.opacity !== undefined ? od.opacity : 1.0);
      const transparent = meshComp.transparent !== undefined ? meshComp.transparent : (opacity < 1.0);
      const wireframe = !!meshComp.wireframe;

      let geo;
      let isPlane = false;
      switch (geomType) {
        case 'sphere': geo = new THREE.SphereGeometry(0.5, 32, 24); break;
        case 'plane': geo = new THREE.PlaneGeometry(10, 10); isPlane = true; break;
        case 'cylinder': geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 32); break;
        case 'cube':
        default: geo = new THREE.BoxGeometry(1, 1, 1); break;
      }

      let mat;
      if (od.materials && Array.isArray(od.materials) && od.materials.length > 0) {
        const matList = od.materials.map(saved => {
          const m = new THREE.MeshStandardMaterial({
            color: saved.color ? new THREE.Color(saved.color) : color,
            roughness: saved.roughness !== undefined ? saved.roughness : roughness,
            metalness: saved.metalness !== undefined ? saved.metalness : metalness,
            opacity: saved.opacity !== undefined ? saved.opacity : opacity,
            transparent: saved.transparent !== undefined ? saved.transparent : transparent,
            wireframe: saved.wireframe !== undefined ? saved.wireframe : wireframe,
            side: saved.side === 'double' || isPlane ? THREE.DoubleSide : (saved.side === 'back' ? THREE.BackSide : THREE.FrontSide)
          });
          if (saved.textureId && loadedTextures[saved.textureId]) {
            m.map = loadedTextures[saved.textureId];
          }
          return m;
        });
        mat = matList.length === 1 ? matList[0] : matList;
      } else {
        mat = new THREE.MeshStandardMaterial({
          color,
          roughness,
          metalness,
          opacity,
          transparent,
          wireframe,
          side: isPlane ? THREE.DoubleSide : THREE.FrontSide
        });
      }

      const group = new THREE.Group();
      group.name = od.userData.name || 'GameObject';
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = (od.userData.name || 'GameObject') + '_Mesh';
      if (isPlane) mesh.rotation.x = -Math.PI / 2;
      mesh.userData = { isMeshRenderer: true, parentId: od.userData.id };
      if (meshComp.enabled === false) mesh.visible = false;
      group.add(mesh);
      obj = group;
    } else if (od.userData.type === 'camera' || od.userData.components?.camera) {
      const camData = od.userData.components?.camera || od.userData.camera || {};
      obj = new THREE.PerspectiveCamera(camData.fov || 75, window.innerWidth / window.innerHeight, camData.near || 0.1, camData.far || 1000);
      obj.name = od.userData.name || 'Camera';
    } else if (od.userData.type === 'player_controller' || od.userData.type === 'empty' || od.userData.type === 'game_object' || !od.userData.type) {
      obj = new THREE.Group();
      obj.name = od.userData.name || 'GameObject';
    } else {
      continue;
    }

    obj.userData = { ...obj.userData, ...od.userData };
    normalizeComponents(obj.userData);

    obj.position.set(od.position.x, od.position.y, od.position.z);
    obj.rotation.set(
      THREE.MathUtils.degToRad(od.rotation.x),
      THREE.MathUtils.degToRad(od.rotation.y),
      THREE.MathUtils.degToRad(od.rotation.z)
    );
    obj.scale.set(od.scale.x, od.scale.y, od.scale.z);
    obj.visible = (obj.userData.active !== false);

    applyMaterials(obj, od.materials, od.userData?.type === 'imported_mesh');
    applyTextures(obj, od.userData?.textures, od.userData?.type === 'imported_mesh');

    objMap.set(od.userData.id, obj);
    if (!allObjects.includes(obj)) allObjects.push(obj);
  }

  for (const obj of allObjects) {
    const parentId = obj.userData?.parentId;
    if (parentId && objMap.has(parentId)) {
      if (!alreadyParented.has(obj.userData?.id)) {
        const parent = objMap.get(parentId);
        if (obj.parent !== parent) {
          parent.add(obj);
        }
      }
    } else {
      if (!obj.parent) {
        scene.add(obj);
      }
    }
  }

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

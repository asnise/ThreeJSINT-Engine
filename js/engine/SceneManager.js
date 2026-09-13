import * as THREE from 'three';

export class SceneManager {
  //#region [Variables/Fields]
  scene = null;
  _objects = null;
  _selected = null;
  _callbacks = null;
  playerSpawn = null;
  //#endregion

  //#region [Properties]
  get selectedObject() { return this._selected; }
  //#endregion

  //#region [Unity Methods]
  //#endregion

  //#region [Public Methods]
  constructor(threeScene) {
    this.scene = threeScene;
    this._objects = new Map();
    this._selected = null;
    this._callbacks = {
      objectAdded: [],
      objectRemoved: [],
      objectSelected: [],
      sceneChanged: [],
      projectAssetsChanged: []
    };
    this.playerSpawn = { position: new THREE.Vector3(0, 1.7, 5), rotation: new THREE.Euler(0, 0, 0) };
  }

  addObject(obj) {
    if (!obj.userData?.id) {
      obj.userData = obj.userData || {};
      obj.userData.id = crypto.randomUUID();
    }
    if (obj.userData.active === undefined) {
      obj.userData.active = true;
    }
    if (obj.userData.parentId === undefined) {
      obj.userData.parentId = null;
    }
    this._objects.set(obj.userData.id, obj);
    if (!obj.userData.parentId && !obj.parent) {
      this.scene.add(obj);
    }
    obj.visible = this.isActiveInHierarchy(obj.userData.id);

    obj.traverse((child) => {
      if (child !== obj && !child.userData?.isGizmo && !child.userData?._isOverlay) {
        if (child.userData?.id || child.userData?.type || child.userData?.components || child.isCamera) {
          if (!child.userData) child.userData = {};
          if (!child.userData.id) child.userData.id = crypto.randomUUID();
          if (child.userData.parentId === undefined || child.userData.parentId === null) {
            child.userData.parentId = child.parent?.userData?.id || obj.userData.id;
          }
          this._objects.set(child.userData.id, child);
          child.visible = this.isActiveInHierarchy(child.userData.id);
          this._emit('objectAdded', child);
        }
      }
    });

    this._emit('objectAdded', obj);
    this._emit('sceneChanged');
  }

  removeObject(id) {
    const rootTarget = this._objects.get(id);
    if (!rootTarget) return;

    if (this._selected === rootTarget || this._selected?.userData?.id === id) {
      this.selectObject(null);
    }

    const idsToDelete = new Set([id]);

    rootTarget.traverse((child) => {
      if (child.userData?.id) {
        idsToDelete.add(child.userData.id);
      }
    });

    let foundNew = true;
    while (foundNew) {
      foundNew = false;
      for (const [oId, o] of this._objects.entries()) {
        if (!idsToDelete.has(oId) && o.userData?.parentId && idsToDelete.has(o.userData.parentId)) {
          idsToDelete.add(oId);
          foundNew = true;
        }
      }
    }

    for (const curId of idsToDelete) {
      const curObj = this._objects.get(curId);
      if (!curObj) continue;

      if (this._selected === curObj) {
        this.selectObject(null);
      }

      if (curObj.children) {
        const overlays = curObj.children.filter((c) => c.userData?._isOverlay);
        overlays.forEach((o) => curObj.remove(o));
      }

      if (curObj !== rootTarget) {
        if (curObj.parent) {
          curObj.parent.remove(curObj);
        } else {
          this.scene.remove(curObj);
        }
      }

      this._objects.delete(curId);
      this._emit('objectRemoved', curObj);
    }

    if (rootTarget.parent) {
      rootTarget.parent.remove(rootTarget);
    } else {
      this.scene.remove(rootTarget);
    }

    this._objects.delete(id);
    this._emit('objectRemoved', rootTarget);
    this._emit('sceneChanged');
  }

  setActive(id, active) {
    const obj = this._objects.get(id);
    if (!obj) return;
    obj.userData.active = Boolean(active);
    obj.visible = this.isActiveInHierarchy(id);
    this._updateChildrenVisibility(obj);
    this._emit('sceneChanged');
  }

  isActiveInHierarchy(id) {
    let cur = this._objects.get(id);
    while (cur) {
      if (cur.userData?.active === false) return false;
      if (!cur.userData?.parentId) break;
      cur = this._objects.get(cur.userData.parentId);
    }
    return true;
  }

  setParent(childId, parentId) {
    const child = this._objects.get(childId);
    if (!child) return;
    if (childId === parentId) return;

    if (parentId) {
      let check = this._objects.get(parentId);
      while (check) {
        if (check.userData?.id === childId) return;
        check = check.userData?.parentId ? this._objects.get(check.userData.parentId) : null;
      }
    }

    const oldParentId = child.userData.parentId;
    if (oldParentId && this._objects.has(oldParentId)) {
      const oldP = this._objects.get(oldParentId);
      oldP.remove(child);
    } else {
      this.scene.remove(child);
    }

    if (parentId && this._objects.has(parentId)) {
      const newP = this._objects.get(parentId);
      child.userData.parentId = parentId;
      newP.attach(child);
    } else {
      child.userData.parentId = null;
      this.scene.attach(child);
    }

    child.visible = this.isActiveInHierarchy(childId);
    this._updateChildrenVisibility(child);
    this._emit('sceneChanged');
  }

  getObject(id) {
    return this._objects.get(id) || null;
  }

  getAllObjects() {
    return Array.from(new Set(this._objects.values()));
  }

  getRootObjects() {
    return this.getAllObjects().filter(o => !o.userData?.parentId);
  }

  getChildren(parentId) {
    return this.getAllObjects().filter(o => o.userData?.parentId === parentId);
  }

  getInteractableObjects() {
    return this.getAllObjects().filter(o => {
      const active = this.isActiveInHierarchy(o.userData.id);
      const inter = o.userData?.components?.interaction || o.userData?.interaction;
      return inter?.enabled && active;
    });
  }

  getColliderObjects() {
    return this.getAllObjects().filter(o => {
      const active = this.isActiveInHierarchy(o.userData.id);
      const col = o.userData?.components?.collider || o.userData?.collider;
      return col?.enabled && active;
    });
  }

  selectObject(idOrNull) {
    if (idOrNull === null) {
      this._selected = null;
      this._emit('objectSelected', null);
      return;
    }
    const obj = typeof idOrNull === 'string' ? this._objects.get(idOrNull) : idOrNull;
    if (!obj) return;
    this._selected = obj;
    this._emit('objectSelected', obj);
  }

  on(event, cb) {
    if (this._callbacks[event]) this._callbacks[event].push(cb);
  }

  off(event, cb) {
    if (this._callbacks[event]) {
      this._callbacks[event] = this._callbacks[event].filter(c => c !== cb);
    }
  }

  serialize() {
    for (const root of Array.from(this._objects.values())) {
      root.traverse((child) => {
        if (child !== root && !child.userData?.isGizmo && !child.userData?._isOverlay) {
          if (child.userData?.id || child.userData?.type || child.userData?.components || child.isCamera) {
            if (!child.userData) child.userData = {};
            if (!child.userData.id) child.userData.id = crypto.randomUUID();
            if (!child.userData.parentId) {
              child.userData.parentId = child.parent?.userData?.id || root.userData.id;
            }
            if (!this._objects.has(child.userData.id)) {
              this._objects.set(child.userData.id, child);
            }
          }
        }
      });
    }

    const objects = [];
    const seen = new Set();
    for (const obj of this._objects.values()) {
      if (!obj || !obj.userData?.id) continue;
      if (seen.has(obj.userData.id)) continue;
      seen.add(obj.userData.id);
      const data = {
        userData: JSON.parse(JSON.stringify(obj.userData)),
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        rotation: { x: THREE.MathUtils.radToDeg(obj.rotation.x), y: THREE.MathUtils.radToDeg(obj.rotation.y), z: THREE.MathUtils.radToDeg(obj.rotation.z) },
        scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
      };

      const materials = [];
      const extractMat = (mesh) => {
        if (!mesh.isMesh || !mesh.material) return;
        const mList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mList.forEach((m, idx) => {
          materials.push({
            meshName: mesh.name,
            slot: idx,
            name: m.name || '',
            color: m.color ? '#' + m.color.getHexString() : '#ffffff',
            roughness: m.roughness !== undefined ? m.roughness : 0.5,
            metalness: m.metalness !== undefined ? m.metalness : 0.0,
            opacity: m.opacity !== undefined ? m.opacity : 1.0,
            transparent: !!m.transparent,
            wireframe: !!m.wireframe,
            side: m.side === THREE.DoubleSide ? 'double' : (m.side === THREE.BackSide ? 'back' : 'front'),
            textureId: m.userData?.textureId || null
          });
        });
      };
      if (obj.isMesh) extractMat(obj); else obj.traverse(extractMat);
      if (materials.length > 0) {
        data.materials = materials;
        data.color = materials[0].color;
        data.opacity = materials[0].opacity;
      }

      objects.push(data);
    }

    return {
      playerSpawn: {
        position: { x: this.playerSpawn.position.x, y: this.playerSpawn.position.y, z: this.playerSpawn.position.z },
        rotation: { x: this.playerSpawn.rotation.x, y: this.playerSpawn.rotation.y, z: this.playerSpawn.rotation.z }
      },
      objects,
      ui: this.uiData || null,
      nodeGraph: this.nodeGraphData || null
    };
  }

  clear() {
    this.selectObject(null);
    for (const obj of Array.from(this._objects.values())) {
      if (obj.parent && obj.parent !== this.scene) {
        obj.parent.remove(obj);
      }
      this.scene.remove(obj);
    }
    this._objects.clear();

    const strays = [];
    for (const child of this.scene.children) {
      if (child.userData?.id || (child.isMesh && !child.isLight && !child.isGridHelper)) {
        strays.push(child);
      }
    }
    strays.forEach((s) => this.scene.remove(s));
  }

  deserialize(data, assetManager, primitives) {
    this.clear();
    const alreadyParented = new Set();
    this.uiData = data.ui || null;
    this.nodeGraphData = data.nodeGraph || null;

    if (data.playerSpawn) {
      const sp = data.playerSpawn;
      this.playerSpawn.position.set(sp.position.x, sp.position.y, sp.position.z);
      if (sp.rotation) {
        this.playerSpawn.rotation.set(sp.rotation.x, sp.rotation.y, sp.rotation.z);
      }
    }

    const rawObjects = Array.isArray(data.objects) ? data.objects : [];
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
            if (saved.textureId && assetManager) {
              const texAsset = assetManager.getTexture(saved.textureId);
              if (texAsset && texAsset.texture) {
                m.map = texAsset.texture;
                if (isImported) m.map.flipY = false;
              }
            }
            m.needsUpdate = true;
          }
        });
      };
      if (targetObj.isMesh) applySavedMats(targetObj); else targetObj.traverse(applySavedMats);
    };

    const applyTextures = (targetObj, texData) => {
      if (!assetManager || !texData) return;
      if (texData.base) {
        assetManager.applyBaseTexture(targetObj, texData.base);
      }
      if (texData.overrides) {
        for (const ov of texData.overrides) {
          assetManager.addOverrideTexture(targetObj, ov.id, ov.opacity, ov.blendMode);
        }
      }
    };

    for (const objData of sortedObjects) {
      if (this._objects.has(objData.userData?.id)) {
        continue;
      }

      let obj;

      if (objData.userData?.parentId && this._objects.has(objData.userData.parentId)) {
        const parent = this._objects.get(objData.userData.parentId);
        let found = null;
        parent.traverse((c) => {
          if (!found && c !== parent && (c.userData?.id === objData.userData.id || c.name === objData.userData.name || c.name === objData.userData.submeshName)) {
            found = c;
          }
        });
        if (found) {
          obj = found;
          obj.userData = { ...obj.userData, ...objData.userData };
          obj.position.set(objData.position.x, objData.position.y, objData.position.z);
          obj.rotation.set(
            THREE.MathUtils.degToRad(objData.rotation.x),
            THREE.MathUtils.degToRad(objData.rotation.y),
            THREE.MathUtils.degToRad(objData.rotation.z)
          );
          obj.scale.set(objData.scale.x, objData.scale.y, objData.scale.z);
          this._objects.set(obj.userData.id, obj);
          alreadyParented.add(obj.userData.id);

          applyMaterials(obj, objData.materials, objData.userData?.type === 'imported_mesh');
          applyTextures(obj, objData.userData?.textures);
          continue;
        }
      }

      if (!objData.userData?.parentId && objData.userData.type === 'imported_mesh' && objData.userData.meshAssetId && assetManager) {
        obj = assetManager.createMeshInstance(objData.userData.meshAssetId);
        if (!obj) continue;

        const childDatas = sortedObjects.filter((o) => o.userData?.parentId === objData.userData.id);
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
              piece.position.set(matchedChild.position.x, matchedChild.position.y, matchedChild.position.z);
              piece.rotation.set(
                THREE.MathUtils.degToRad(matchedChild.rotation.x),
                THREE.MathUtils.degToRad(matchedChild.rotation.y),
                THREE.MathUtils.degToRad(matchedChild.rotation.z)
              );
              piece.scale.set(matchedChild.scale.x, matchedChild.scale.y, matchedChild.scale.z);
              applyMaterials(piece, matchedChild.materials, true);
              applyTextures(piece, matchedChild.userData?.textures);
              alreadyParented.add(piece.userData.id);
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
      } else if (primitives) {
        obj = primitives.createGameObject(objData.userData?.name);
        const comps = objData.userData?.components || {};
        const hasSavedChildCam = rawObjects.some(o => o.userData?.parentId === objData.userData?.id && (o.userData?.type === 'camera' || o.userData?.components?.camera || o.isCamera));

        if (comps.mesh) {
          primitives.attachMeshComponent(obj, comps.mesh);
        } else if (objData.userData?.primitiveType) {
          const color = objData.color ? (typeof objData.color === 'string' ? objData.color : '#' + new THREE.Color(objData.color).getHexString()) : '#888888';
          primitives.attachMeshComponent(obj, { geometryType: objData.userData.primitiveType, color });
        }

        if (comps.collider) {
          primitives.attachColliderComponent(obj, comps.collider);
        } else if (objData.userData?.collider) {
          primitives.attachColliderComponent(obj, objData.userData.collider);
        }

        if (comps.interaction) {
          primitives.attachInteractionComponent(obj, comps.interaction);
        } else if (objData.userData?.interaction) {
          primitives.attachInteractionComponent(obj, objData.userData.interaction);
        }

        if (comps.playerController || objData.userData?.type === 'player_controller') {
          primitives.attachPlayerControllerComponent(obj, comps.playerController || objData.userData?.playerController || {}, !hasSavedChildCam);
        }

        if (comps.camera || objData.userData?.type === 'camera') {
          primitives.attachCameraComponent(obj, comps.camera || objData.userData?.camera || {});
        }

        if (comps.nodeGraph) {
          primitives.attachNodeGraphComponent(obj, comps.nodeGraph);
        }
      } else {
        continue;
      }

      obj.userData = { ...obj.userData, ...objData.userData };
      obj.position.set(objData.position.x, objData.position.y, objData.position.z);
      obj.rotation.set(
        THREE.MathUtils.degToRad(objData.rotation.x),
        THREE.MathUtils.degToRad(objData.rotation.y),
        THREE.MathUtils.degToRad(objData.rotation.z)
      );
      obj.scale.set(objData.scale.x, objData.scale.y, objData.scale.z);

      if (objData.materials && Array.isArray(objData.materials)) {
        applyMaterials(obj, objData.materials, objData.userData?.type === 'imported_mesh');
      } else {
        if (objData.color && obj.isMesh && obj.material) {
          obj.material.color.set(objData.color);
        }
        if (objData.opacity !== undefined && obj.isMesh && obj.material) {
          obj.material.opacity = objData.opacity;
          obj.material.transparent = objData.opacity < 1;
        }
      }

      if (objData.userData?.parentId && this._objects.has(objData.userData.parentId)) {
        const parent = this._objects.get(objData.userData.parentId);
        parent.add(obj);
        this._objects.set(obj.userData.id, obj);
        alreadyParented.add(obj.userData.id);
        this._emit('objectAdded', obj);
      } else {
        this.addObject(obj);
      }
      applyTextures(obj, objData.userData?.textures);
    }

    for (const objData of deduplicatedObjects) {
      if (objData.userData?.parentId && !alreadyParented.has(objData.userData.id)) {
        const parentObj = this._objects.get(objData.userData.parentId);
        const childObj = this._objects.get(objData.userData.id);
        if (parentObj && childObj && childObj.parent !== parentObj) {
          if (childObj.parent) childObj.parent.remove(childObj);
          parentObj.add(childObj);
          alreadyParented.add(objData.userData.id);
        }
      }
    }

    for (const obj of this.getAllObjects()) {
      obj.visible = this.isActiveInHierarchy(obj.userData.id);
    }

    this._emit('sceneChanged');
  }
  //#endregion

  //#region [Private Methods]
  _updateChildrenVisibility(parentObj) {
    const pId = parentObj.userData?.id;
    if (!pId) return;
    for (const child of this._objects.values()) {
      if (child.userData?.parentId === pId) {
        child.visible = this.isActiveInHierarchy(child.userData.id);
        this._updateChildrenVisibility(child);
      }
    }
  }

  _emit(event, ...args) {
    (this._callbacks[event] || []).forEach(cb => cb(...args));
  }
  //#endregion
}

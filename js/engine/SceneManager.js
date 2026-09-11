import * as THREE from 'three';

export class SceneManager {
  constructor(threeScene) {
    this.scene = threeScene;
    this._objects = new Map();
    this._selected = null;
    this._callbacks = {
      objectAdded: [],
      objectRemoved: [],
      objectSelected: [],
      sceneChanged: []
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
    if (!obj.userData.parentId) {
      this.scene.add(obj);
    }
    obj.visible = this.isActiveInHierarchy(obj.userData.id);
    this._emit('objectAdded', obj);
    this._emit('sceneChanged');
  }

  removeObject(id) {
    const obj = this._objects.get(id);
    if (!obj) return;
    if (this._selected === obj) this.selectObject(null);

    for (const child of this._objects.values()) {
      if (child.userData.parentId === id) {
        this.setParent(child.userData.id, obj.userData.parentId || null);
      }
    }

    if (obj.parent) obj.parent.remove(obj);
    else this.scene.remove(obj);

    this._objects.delete(id);
    this._emit('objectRemoved', obj);
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
    return Array.from(this._objects.values());
  }

  getRootObjects() {
    return this.getAllObjects().filter(o => !o.userData?.parentId);
  }

  getChildren(parentId) {
    return this.getAllObjects().filter(o => o.userData?.parentId === parentId);
  }

  getInteractableObjects() {
    return this.getAllObjects().filter(o => o.userData?.interaction?.enabled && this.isActiveInHierarchy(o.userData.id));
  }

  getColliderObjects() {
    return this.getAllObjects().filter(o => o.userData?.collider?.enabled && this.isActiveInHierarchy(o.userData.id));
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

  get selectedObject() { return this._selected; }

  on(event, cb) {
    if (this._callbacks[event]) this._callbacks[event].push(cb);
  }

  off(event, cb) {
    if (this._callbacks[event]) {
      this._callbacks[event] = this._callbacks[event].filter(c => c !== cb);
    }
  }

  _emit(event, ...args) {
    (this._callbacks[event] || []).forEach(cb => cb(...args));
  }

  serialize() {
    const objects = [];
    for (const obj of this._objects.values()) {
      const data = {
        userData: JSON.parse(JSON.stringify(obj.userData)),
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        rotation: { x: THREE.MathUtils.radToDeg(obj.rotation.x), y: THREE.MathUtils.radToDeg(obj.rotation.y), z: THREE.MathUtils.radToDeg(obj.rotation.z) },
        scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
      };

      if (obj.isMesh && obj.material) {
        data.color = '#' + obj.material.color.getHexString();
        data.opacity = obj.material.opacity;
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

  deserialize(data, assetManager, primitives) {
    for (const obj of Array.from(this._objects.values())) {
      this.scene.remove(obj);
    }
    this._objects.clear();
    this._selected = null;
    this.uiData = data.ui || null;
    this.nodeGraphData = data.nodeGraph || null;

    if (data.playerSpawn) {
      const sp = data.playerSpawn;
      this.playerSpawn.position.set(sp.position.x, sp.position.y, sp.position.z);
      if (sp.rotation) {
        this.playerSpawn.rotation.set(sp.rotation.x, sp.rotation.y, sp.rotation.z);
      }
    }

    for (const objData of data.objects) {
      let obj;

      if (objData.userData.type === 'imported_mesh' && objData.userData.meshAssetId && assetManager) {
        obj = assetManager.createMeshInstance(objData.userData.meshAssetId);
        if (!obj) continue;
      } else if (objData.userData.primitiveType && primitives) {
        const color = objData.color ? new THREE.Color(objData.color) : 0x888888;
        obj = primitives.createFromType(objData.userData.primitiveType, color);
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

      if (objData.color && obj.isMesh && obj.material) {
        obj.material.color.set(objData.color);
      }
      if (objData.opacity !== undefined && obj.isMesh && obj.material) {
        obj.material.opacity = objData.opacity;
        obj.material.transparent = objData.opacity < 1;
      }

      this.addObject(obj);

      if (assetManager && objData.userData.textures) {
        if (objData.userData.textures.base) {
          assetManager.applyBaseTexture(obj, objData.userData.textures.base);
        }
        if (objData.userData.textures.overrides) {
          for (const ov of objData.userData.textures.overrides) {
            assetManager.addOverrideTexture(obj, ov.id, ov.opacity, ov.blendMode);
          }
        }
      }
    }

    // Reconstruct parent-child hierarchy
    for (const objData of data.objects) {
      if (objData.userData?.parentId) {
        this.setParent(objData.userData.id, objData.userData.parentId);
      }
    }

    for (const obj of this._objects.values()) {
      obj.visible = this.isActiveInHierarchy(obj.userData.id);
    }

    this._emit('sceneChanged');
  }

  clear() {
    for (const obj of Array.from(this._objects.values())) {
      this.scene.remove(obj);
    }
    this._objects.clear();
    this._selected = null;
    this._emit('sceneChanged');
  }
}

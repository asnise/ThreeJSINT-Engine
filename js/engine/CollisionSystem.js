import * as THREE from 'three';

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();
const _playerBox = new THREE.Box3();

export class CollisionSystem {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this._triggers = new Map();
    this._debugHelpers = [];
    this._debugVisible = false;
  }

  resolvePlayerCollision(position, radius, height) {
    const colliders = this.sceneManager.getColliderObjects().filter(o => !o.userData.collider.isTrigger);
    let grounded = false;
    const pos = position.clone();
    const halfH = height / 2;

    for (let iter = 0; iter < 2; iter++) {
      _playerBox.min.set(pos.x - radius, pos.y - height, pos.z - radius);
      _playerBox.max.set(pos.x + radius, pos.y, pos.z + radius);

      for (const obj of colliders) {
        this._getWorldBox(obj, _box);
        if (!_playerBox.intersectsBox(_box)) continue;

        const pCenter = new THREE.Vector3(pos.x, pos.y - halfH, pos.z);
        const oCenter = _box.getCenter(_center);
        _box.getSize(_size);

        const dx = pCenter.x - oCenter.x;
        const dy = pCenter.y - oCenter.y;
        const dz = pCenter.z - oCenter.z;

        const overlapX = (radius + _size.x / 2) - Math.abs(dx);
        const overlapY = (halfH + _size.y / 2) - Math.abs(dy);
        const overlapZ = (radius + _size.z / 2) - Math.abs(dz);

        if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) continue;

        if (overlapY < overlapX && overlapY < overlapZ) {
          if (dy > 0) {
            pos.y = _box.max.y + height;
            grounded = true;
          } else {
            pos.y = _box.min.y;
          }
        } else if (overlapX < overlapZ) {
          pos.x += (dx > 0 ? overlapX : -overlapX);
        } else {
          pos.z += (dz > 0 ? overlapZ : -overlapZ);
        }

        _playerBox.min.set(pos.x - radius, pos.y - height, pos.z - radius);
        _playerBox.max.set(pos.x + radius, pos.y, pos.z + radius);
      }
    }

    return { position: pos, grounded };
  }

  checkTriggers(playerPos, radius) {
    const triggers = this.sceneManager.getColliderObjects().filter(o => o.userData.collider.isTrigger);
    const currentInside = new Set();
    const entered = [];
    const exited = [];
    const stayed = [];

    const pMin = new THREE.Vector3(playerPos.x - radius, playerPos.y - 1.7, playerPos.z - radius);
    const pMax = new THREE.Vector3(playerPos.x + radius, playerPos.y, playerPos.z + radius);
    _playerBox.set(pMin, pMax);

    for (const obj of triggers) {
      this._getWorldBox(obj, _box);
      const id = obj.userData.id;

      if (_playerBox.intersectsBox(_box)) {
        currentInside.add(id);
        if (!this._triggers.has(id)) {
          entered.push(obj);
          this._triggers.set(id, obj);
        } else {
          stayed.push(obj);
        }
      }
    }

    for (const [id, obj] of this._triggers) {
      if (!currentInside.has(id)) {
        exited.push(obj);
        this._triggers.delete(id);
      }
    }

    for (const obj of entered) {
      if (this.onTriggerEnter) this.onTriggerEnter(obj);
    }
    for (const obj of exited) {
      if (this.onTriggerExit) this.onTriggerExit(obj);
    }

    return { entered, stayed, exited };
  }

  _getWorldBox(obj, target) {
    target.setFromObject(obj);
    if ((target.max.y - target.min.y) < 0.05) {
      target.min.y -= 0.5;
    }
    return target;
  }

  setDebugVisible(visible) {
    this._debugVisible = visible;
    this.updateDebugVisuals();
  }

  get isDebugVisible() {
    return this._debugVisible;
  }

  updateDebugVisuals() {
    for (const h of this._debugHelpers) {
      h.parent?.remove(h);
    }
    this._debugHelpers = [];

    if (!this._debugVisible) return;

    const colliders = this.sceneManager.getColliderObjects();
    for (const obj of colliders) {
      this._getWorldBox(obj, _box);
      const helper = new THREE.Box3Helper(_box,
        obj.userData.collider.isTrigger ? 0x00ff00 : 0x00e5ff
      );
      this.sceneManager.scene.add(helper);
      this._debugHelpers.push(helper);
    }
  }

  clearTriggerState() {
    this._triggers.clear();
  }
}

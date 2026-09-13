const activeTriggers = new Map();

function getColliderBox(obj, target) {
  const col = obj.userData?.components?.collider || obj.userData?.collider;
  target.setFromObject(obj);
  if (target.isEmpty() && col) {
    const sz = col.size || { x: 1, y: 1, z: 1 };
    const ct = col.center || { x: 0, y: 0, z: 0 };
    const hx = (sz.x || 1) / 2, hy = (sz.y || 1) / 2, hz = (sz.z || 1) / 2;
    target.min.set(ct.x - hx, ct.y - hy, ct.z - hz);
    target.max.set(ct.x + hx, ct.y + hy, ct.z + hz);
    target.applyMatrix4(obj.matrixWorld);
  }
  if ((target.max.y - target.min.y) < 0.05) {
    target.min.y -= 0.5;
  }
  return target;
}

const collisionAdapter = {
  resolvePlayerCollision: (position, radius = 0.3, height = 1.7) => {
    const np = position.clone();
    const colliders = allObjects.filter(o => {
      const col = o.userData?.components?.collider || o.userData?.collider;
      return col && col.enabled && !col.isTrigger && isActiveInHierarchy(o);
    });
    const _pb = new THREE.Box3();
    const _cbox = new THREE.Box3();
    let grounded = false;

    for (let iter = 0; iter < 2; iter++) {
      _pb.min.set(np.x - radius, np.y, np.z - radius);
      _pb.max.set(np.x + radius, np.y + height, np.z + radius);

      for (const c of colliders) {
        getColliderBox(c, _cbox);
        if (!_pb.intersectsBox(_cbox)) continue;

        const sz = _cbox.getSize(new THREE.Vector3());
        const ct = _cbox.getCenter(new THREE.Vector3());
        const dx = np.x - ct.x;
        const dy = (np.y + height / 2) - ct.y;
        const dz = np.z - ct.z;

        const ox = (radius + sz.x / 2) - Math.abs(dx);
        const oy = (height / 2 + sz.y / 2) - Math.abs(dy);
        const oz = (radius + sz.z / 2) - Math.abs(dz);

        if (ox <= 0 || oy <= 0 || oz <= 0) continue;

        if (oy < ox && oy < oz) {
          if (dy > 0) {
            np.y = _cbox.max.y;
            grounded = true;
          } else {
            np.y = _cbox.min.y - height;
          }
        } else if (ox < oz) {
          np.x += dx > 0 ? ox : -ox;
        } else {
          np.z += dz > 0 ? oz : -oz;
        }

        _pb.min.set(np.x - radius, np.y, np.z - radius);
        _pb.max.set(np.x + radius, np.y + height, np.z + radius);
      }
    }

    if (np.y <= 0) {
      np.y = 0;
      grounded = true;
    }

    return { position: np, grounded };
  },

  checkTriggers: (pos, radius = 0.5) => {
    const triggers = allObjects.filter(o => {
      const col = o.userData?.components?.collider || o.userData?.collider;
      return col && col.enabled && !col.isTrigger && isActiveInHierarchy(o);
    });
    const currentInside = new Set();
    const _pb = new THREE.Box3();
    const _cbox = new THREE.Box3();
    _pb.min.set(pos.x - radius, pos.y - radius, pos.z - radius);
    _pb.max.set(pos.x + radius, pos.y + radius, pos.z + radius);

    for (const trg of triggers) {
      getColliderBox(trg, _cbox);
      if (_pb.intersectsBox(_cbox)) {
        currentInside.add(trg.userData.id);
        if (!activeTriggers.has(trg.userData.id)) {
          activeTriggers.set(trg.userData.id, trg);
          nodeRuntime.triggerEvent('OnTriggerEnter', trg);
        }
      }
    }

    for (const [id, trg] of activeTriggers) {
      if (!currentInside.has(id)) {
        activeTriggers.delete(id);
        nodeRuntime.triggerEvent('OnTriggerExit', trg);
      }
    }
  }
};

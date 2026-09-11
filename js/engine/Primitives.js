import * as THREE from 'three';

const _counters = {};

function nextName(type) {
  if (!_counters[type]) _counters[type] = 0;
  _counters[type]++;
  return `${type}_${String(_counters[type]).padStart(3, '0')}`;
}

function makeUserData(name, primitiveType) {
  return {
    id: crypto.randomUUID(),
    name,
    type: 'primitive',
    primitiveType,
    collider: { enabled: false, isTrigger: false },
    interaction: { enabled: false, type: 'inspect', promptText: 'Press E to interact' },
    textures: { base: null, overrides: [] },
    meshAssetId: null
  };
}

export class Primitives {

  static createCube(color = 0x888888) {
    const name = nextName('Cube');
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = makeUserData(name, 'cube');
    mesh.name = name;
    return mesh;
  }

  static createSphere(color = 0x888888) {
    const name = nextName('Sphere');
    const geo = new THREE.SphereGeometry(0.5, 32, 24);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = makeUserData(name, 'sphere');
    mesh.name = name;
    return mesh;
  }

  static createPlane(color = 0x888888) {
    const name = nextName('Plane');
    const geo = new THREE.PlaneGeometry(10, 10);
    const mat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.userData = makeUserData(name, 'plane');
    mesh.name = name;
    return mesh;
  }

  static createCylinder(color = 0x888888) {
    const name = nextName('Cylinder');
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = makeUserData(name, 'cylinder');
    mesh.name = name;
    return mesh;
  }

  static createFromType(type, color) {
    switch (type) {
      case 'cube': return Primitives.createCube(color);
      case 'sphere': return Primitives.createSphere(color);
      case 'plane': return Primitives.createPlane(color);
      case 'cylinder': return Primitives.createCylinder(color);
      default: return Primitives.createCube(color);
    }
  }

  static makeUserData(name, type) {
    return makeUserData(name, type);
  }
}

import * as THREE from 'three';

const _counters = {};

function nextName(type) {
  if (!_counters[type]) _counters[type] = 0;
  _counters[type]++;
  return `${type}_${String(_counters[type]).padStart(3, '0')}`;
}

export class Primitives {
  //#region [Variables/Fields]
  //#endregion

  //#region [Properties]
  //#endregion

  //#region [Unity Methods]
  //#endregion

  //#region [Public Methods]
  static createGameObject(name = null) {
    const objName = name || nextName('GameObject');
    const group = new THREE.Group();
    group.name = objName;
    group.userData = {
      id: crypto.randomUUID(),
      name: objName,
      type: 'game_object',
      active: true,
      parentId: null,
      components: {},
      collider: { enabled: false, isTrigger: false },
      interaction: { enabled: false, type: 'inspect', promptText: 'Press E to interact' },
      textures: { base: null, overrides: [] },
      meshAssetId: null
    };
    return group;
  }

  static createEmpty(name = null) {
    return Primitives.createGameObject(name || nextName('Empty'));
  }

  static createCube(color = 0x888888) {
    const go = Primitives.createGameObject(nextName('Cube'));
    Primitives.attachMeshComponent(go, { geometryType: 'cube', color: typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color });
    Primitives.attachColliderComponent(go, { type: 'box', enabled: true, isTrigger: false });
    return go;
  }

  static createSphere(color = 0x888888) {
    const go = Primitives.createGameObject(nextName('Sphere'));
    Primitives.attachMeshComponent(go, { geometryType: 'sphere', color: typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color });
    Primitives.attachColliderComponent(go, { type: 'sphere', enabled: true, isTrigger: false });
    return go;
  }

  static createPlane(color = 0x888888) {
    const go = Primitives.createGameObject(nextName('Plane'));
    Primitives.attachMeshComponent(go, { geometryType: 'plane', color: typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color });
    Primitives.attachColliderComponent(go, { type: 'box', enabled: true, isTrigger: false });
    return go;
  }

  static createCylinder(color = 0x888888) {
    const go = Primitives.createGameObject(nextName('Cylinder'));
    Primitives.attachMeshComponent(go, { geometryType: 'cylinder', color: typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color });
    Primitives.attachColliderComponent(go, { type: 'cylinder', enabled: true, isTrigger: false });
    return go;
  }

  static createCamera(name = null, fov = 75, near = 0.1, far = 1000) {
    const go = Primitives.createGameObject(name || nextName('Camera'));
    Primitives.attachCameraComponent(go, { fov, near, far, isMainCamera: true });
    return go;
  }

  static createPlayerController(name = null, includeCamera = true) {
    const go = Primitives.createGameObject(name || nextName('PlayerController'));
    Primitives.attachPlayerControllerComponent(go, {
      moveSpeed: 5,
      lerpSpeed: 10,
      jumpForce: 8,
      gravity: -15,
      playerRadius: 0.3,
      playerHeight: 1.7,
      cameraOffsetY: 1.6
    }, includeCamera);
    return go;
  }

  static createFromType(type, color) {
    switch (type) {
      case 'empty': return Primitives.createEmpty();
      case 'cube': return Primitives.createCube(color);
      case 'sphere': return Primitives.createSphere(color);
      case 'plane': return Primitives.createPlane(color);
      case 'cylinder': return Primitives.createCylinder(color);
      case 'camera': return Primitives.createCamera();
      case 'player_controller': return Primitives.createPlayerController();
      default: return Primitives.createCube(color);
    }
  }

  static hasComponent(gameObject, componentType) {
    if (!gameObject?.userData?.components) return false;
    return !!gameObject.userData.components[componentType];
  }

  static getComponent(gameObject, componentType) {
    if (!gameObject?.userData?.components) return null;
    return gameObject.userData.components[componentType] || null;
  }

  static addComponent(gameObject, componentType, config = {}) {
    if (!gameObject?.userData) return null;
    if (!gameObject.userData.components) gameObject.userData.components = {};

    switch (componentType) {
      case 'mesh':
        return Primitives.attachMeshComponent(gameObject, config);
      case 'collider':
        return Primitives.attachColliderComponent(gameObject, config);
      case 'interaction':
        return Primitives.attachInteractionComponent(gameObject, config);
      case 'playerController':
        return Primitives.attachPlayerControllerComponent(gameObject, config);
      case 'camera':
        return Primitives.attachCameraComponent(gameObject, config);
      case 'nodeGraph':
        return Primitives.attachNodeGraphComponent(gameObject, config);
      default:
        return null;
    }
  }

  static removeComponent(gameObject, componentType) {
    if (!gameObject?.userData?.components) return;

    switch (componentType) {
      case 'mesh':
        Primitives.removeMeshComponent(gameObject);
        break;
      case 'collider':
        Primitives.removeColliderComponent(gameObject);
        break;
      case 'interaction':
        Primitives.removeInteractionComponent(gameObject);
        break;
      case 'playerController':
        Primitives.removePlayerControllerComponent(gameObject);
        break;
      case 'camera':
        Primitives.removeCameraComponent(gameObject);
        break;
      case 'nodeGraph':
        Primitives.removeNodeGraphComponent(gameObject);
        break;
    }
  }

  static attachMeshComponent(gameObject, config = {}) {
    const geometryType = config.geometryType || config.primitiveType || 'cube';
    const color = config.color || '#888888';
    const roughness = config.roughness !== undefined ? config.roughness : 0.5;
    const metalness = config.metalness !== undefined ? config.metalness : 0.0;
    const opacity = config.opacity !== undefined ? config.opacity : 1.0;
    const transparent = config.transparent !== undefined ? config.transparent : (opacity < 1.0);
    const wireframe = !!config.wireframe;
    const textureId = config.textureId || null;
    const meshAssetId = config.meshAssetId || null;

    Primitives.removeMeshComponent(gameObject);

    const compData = {
      enabled: config.enabled !== false,
      geometryType,
      color,
      roughness,
      metalness,
      opacity,
      transparent,
      wireframe,
      textureId,
      meshAssetId
    };

    gameObject.userData.components.mesh = compData;
    gameObject.userData.primitiveType = geometryType;
    gameObject.userData.meshAssetId = meshAssetId;

    let geo;
    let isPlane = false;
    switch (geometryType) {
      case 'sphere':
        geo = new THREE.SphereGeometry(0.5, 32, 24);
        break;
      case 'plane':
        geo = new THREE.PlaneGeometry(10, 10);
        isPlane = true;
        break;
      case 'cylinder':
        geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
        break;
      case 'cube':
      default:
        geo = new THREE.BoxGeometry(1, 1, 1);
        break;
    }

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness,
      metalness,
      opacity,
      transparent,
      wireframe,
      side: isPlane ? THREE.DoubleSide : THREE.FrontSide
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `${gameObject.name}_Mesh`;
    if (isPlane) mesh.rotation.x = -Math.PI / 2;
    mesh.userData = { isMeshRenderer: true, parentId: gameObject.userData.id };
    gameObject.add(mesh);

    return compData;
  }

  static removeMeshComponent(gameObject) {
    if (!gameObject) return;
    delete gameObject.userData.components.mesh;
    delete gameObject.userData.primitiveType;

    for (let i = gameObject.children.length - 1; i >= 0; i--) {
      const child = gameObject.children[i];
      if (child.userData?.isMeshRenderer || (child.isMesh && !child.userData?.isGizmo)) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
        gameObject.remove(child);
      }
    }
  }

  static attachColliderComponent(gameObject, config = {}) {
    const compData = {
      enabled: config.enabled !== false,
      type: config.type || 'box',
      isTrigger: !!config.isTrigger,
      size: config.size || { x: 1, y: 1, z: 1 },
      center: config.center || { x: 0, y: 0, z: 0 },
      radius: config.radius !== undefined ? config.radius : 0.5,
      height: config.height !== undefined ? config.height : 1.0
    };

    gameObject.userData.components.collider = compData;
    gameObject.userData.collider = compData;
    return compData;
  }

  static removeColliderComponent(gameObject) {
    if (!gameObject?.userData) return;
    delete gameObject.userData.components.collider;
    gameObject.userData.collider = { enabled: false, isTrigger: false };
  }

  static attachInteractionComponent(gameObject, config = {}) {
    const compData = {
      enabled: config.enabled !== false,
      type: config.type || 'inspect',
      promptText: config.promptText || 'Press E to interact',
      maxDistance: config.maxDistance || 3
    };

    gameObject.userData.components.interaction = compData;
    gameObject.userData.interaction = compData;
    return compData;
  }

  static removeInteractionComponent(gameObject) {
    if (!gameObject?.userData) return;
    delete gameObject.userData.components.interaction;
    gameObject.userData.interaction = { enabled: false, type: 'inspect', promptText: '' };
  }

  static attachPlayerControllerComponent(gameObject, config = {}, includeCamera = true) {
    Primitives.removePlayerControllerComponent(gameObject);

    const compData = {
      enabled: config.enabled !== false,
      moveSpeed: config.moveSpeed !== undefined ? config.moveSpeed : 5,
      lerpSpeed: config.lerpSpeed !== undefined ? config.lerpSpeed : 10,
      jumpForce: config.jumpForce !== undefined ? config.jumpForce : 8,
      gravity: config.gravity !== undefined ? config.gravity : -15,
      playerRadius: config.playerRadius !== undefined ? config.playerRadius : 0.3,
      playerHeight: config.playerHeight !== undefined ? config.playerHeight : 1.7,
      cameraOffsetY: config.cameraOffsetY !== undefined ? config.cameraOffsetY : 1.6
    };

    gameObject.userData.components.playerController = compData;
    gameObject.userData.playerController = compData;
    gameObject.userData.type = 'player_controller';

    const bodyGeo = new THREE.CylinderGeometry(compData.playerRadius, compData.playerRadius, compData.playerHeight, 16);
    bodyGeo.translate(0, compData.playerHeight / 2, 0);
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: true, transparent: true, opacity: 0.5 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.name = 'PlayerBodyGizmo';
    bodyMesh.userData.isGizmo = true;
    gameObject.add(bodyMesh);

    const pointerGeo = new THREE.ConeGeometry(0.08, 0.25, 8);
    pointerGeo.rotateX(-Math.PI / 2);
    pointerGeo.translate(0, compData.cameraOffsetY, -0.35);
    const pointerMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const pointerMesh = new THREE.Mesh(pointerGeo, pointerMat);
    pointerMesh.name = 'PlayerForwardPointer';
    pointerMesh.userData.isGizmo = true;
    gameObject.add(pointerMesh);

    if (includeCamera) {
      const cameraObj = Primitives.createCamera('MainCamera', 75, 0.1, 1000);
      cameraObj.position.set(0, compData.cameraOffsetY, 0);
      cameraObj.userData.parentId = gameObject.userData.id;
      gameObject.add(cameraObj);
    }

    return compData;
  }

  static removePlayerControllerComponent(gameObject) {
    if (!gameObject?.userData) return;
    delete gameObject.userData.components.playerController;
    delete gameObject.userData.playerController;
    if (gameObject.userData.type === 'player_controller') {
      gameObject.userData.type = 'game_object';
    }

    for (let i = gameObject.children.length - 1; i >= 0; i--) {
      const child = gameObject.children[i];
      if (child.name === 'PlayerBodyGizmo' || child.name === 'PlayerForwardPointer') {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
        gameObject.remove(child);
      }
    }
  }

  static attachCameraComponent(gameObject, config = {}) {
    Primitives.removeCameraComponent(gameObject);

    const fov = config.fov !== undefined ? config.fov : 75;
    const near = config.near !== undefined ? config.near : 0.1;
    const far = config.far !== undefined ? config.far : 1000;
    const isMainCamera = config.isMainCamera !== false;

    const compData = {
      enabled: config.enabled !== false,
      fov,
      near,
      far,
      isMainCamera
    };

    gameObject.userData.components.camera = compData;
    gameObject.userData.camera = compData;
    gameObject.userData.type = 'camera';

    const camBodyGeo = new THREE.BoxGeometry(0.25, 0.2, 0.3);
    const camMat = new THREE.MeshBasicMaterial({ color: 0x818cf8, wireframe: true });
    const camBody = new THREE.Mesh(camBodyGeo, camMat);
    camBody.name = 'CameraGizmoBody';
    camBody.userData.isGizmo = true;
    gameObject.add(camBody);

    const lensGeo = new THREE.CylinderGeometry(0.08, 0.11, 0.15, 12);
    lensGeo.rotateX(Math.PI / 2);
    lensGeo.translate(0, 0, -0.2);
    const lens = new THREE.Mesh(lensGeo, camMat);
    lens.name = 'CameraGizmoLens';
    lens.userData.isGizmo = true;
    gameObject.add(lens);

    return compData;
  }

  static removeCameraComponent(gameObject) {
    if (!gameObject?.userData) return;
    delete gameObject.userData.components.camera;
    delete gameObject.userData.camera;
    if (gameObject.userData.type === 'camera') {
      gameObject.userData.type = 'game_object';
    }

    for (let i = gameObject.children.length - 1; i >= 0; i--) {
      const child = gameObject.children[i];
      if (child.name === 'CameraGizmoBody' || child.name === 'CameraGizmoLens') {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
        gameObject.remove(child);
      }
    }
  }

  static attachNodeGraphComponent(gameObject, config = {}) {
    const compData = {
      enabled: config.enabled !== false,
      scope: config.scope || ('object:' + gameObject.userData.id)
    };
    gameObject.userData.components.nodeGraph = compData;
    return compData;
  }

  static removeNodeGraphComponent(gameObject) {
    if (!gameObject?.userData) return;
    delete gameObject.userData.components.nodeGraph;
  }
  //#endregion

  //#region [Private Methods]
  //#endregion
}

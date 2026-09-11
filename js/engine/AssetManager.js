import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AssetManager {
  constructor() {
    this._textures = new Map();
    this._meshes = new Map();
    this._gltfLoader = new GLTFLoader();
    this._textureLoader = new THREE.TextureLoader();
  }

  async importMesh(file) {
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type || 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      this._gltfLoader.load(url, (gltf) => {
        const id = crypto.randomUUID();
        const scene = gltf.scene;

        scene.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
          }
        });

        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());

        const asset = {
          id,
          name: file.name.replace(/\.[^.]+$/, ''),
          type: 'mesh',
          scene: scene,
          boundingSize: { x: size.x, y: size.y, z: size.z },
          blobUrl: url,
          arrayBuffer: arrayBuffer
        };

        this._meshes.set(id, asset);
        resolve(asset);
      }, undefined, (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      });
    });
  }

  createMeshInstance(meshAssetId) {
    const asset = this._meshes.get(meshAssetId);
    if (!asset) return null;

    const clone = asset.scene.clone(true);

    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
      }
    });

    clone.name = asset.name;
    clone.userData = {
      id: crypto.randomUUID(),
      name: asset.name,
      type: 'imported_mesh',
      primitiveType: null,
      collider: { enabled: false, isTrigger: false },
      interaction: { enabled: false, type: 'inspect', promptText: 'Press E to interact' },
      textures: { base: null, overrides: [] },
      meshAssetId
    };

    return clone;
  }

  async importTexture(file) {
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });
    const url = URL.createObjectURL(blob);

    const texture = await new Promise((resolve, reject) => {
      this._textureLoader.load(url, resolve, undefined, reject);
    });

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = true;

    const id = crypto.randomUUID();
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 48;
    previewCanvas.height = 48;
    const ctx = previewCanvas.getContext('2d');
    const img = texture.image;
    ctx.drawImage(img, 0, 0, 48, 48);
    const preview = previewCanvas.toDataURL('image/png');

    const asset = {
      id,
      name: file.name,
      type: 'texture',
      texture,
      blobUrl: url,
      arrayBuffer,
      preview
    };

    this._textures.set(id, asset);
    return asset;
  }

  getTexture(id) { return this._textures.get(id) || null; }
  getMesh(id) { return this._meshes.get(id) || null; }
  getAllTextures() { return Array.from(this._textures.values()); }
  getAllMeshes() { return Array.from(this._meshes.values()); }

  applyBaseTexture(object, textureId) {
    const asset = this._textures.get(textureId);
    if (!asset) return;

    const applyToMesh = (mesh) => {
      if (!mesh.isMesh) return;
      mesh.material.map = asset.texture;
      mesh.material.needsUpdate = true;
    };

    if (object.isMesh) {
      applyToMesh(object);
    } else {
      object.traverse(applyToMesh);
    }

    if (object.userData?.textures) {
      object.userData.textures.base = textureId;
    }
  }

  clearBaseTexture(object) {
    const clearMesh = (mesh) => {
      if (!mesh.isMesh) return;
      mesh.material.map = null;
      mesh.material.needsUpdate = true;
    };

    if (object.isMesh) {
      clearMesh(object);
    } else {
      object.traverse(clearMesh);
    }

    if (object.userData?.textures) {
      object.userData.textures.base = null;
    }
  }

  addOverrideTexture(object, textureId, opacity = 0.5, blendMode = 'multiply') {
    const asset = this._textures.get(textureId);
    if (!asset) return;

    if (!object.userData?.textures) return;

    const override = {
      id: textureId,
      opacity,
      blendMode
    };

    object.userData.textures.overrides.push(override);
    this._applyOverrides(object);
  }

  removeOverrideTexture(object, index) {
    if (!object.userData?.textures?.overrides) return;
    object.userData.textures.overrides.splice(index, 1);
    this._applyOverrides(object);
  }

  updateOverride(object, index, props) {
    if (!object.userData?.textures?.overrides?.[index]) return;
    Object.assign(object.userData.textures.overrides[index], props);
    this._applyOverrides(object);
  }

  _applyOverrides(object) {
    const existingOverlays = [];
    object.children.forEach(child => {
      if (child.userData?._isOverlay) existingOverlays.push(child);
    });
    existingOverlays.forEach(o => object.remove(o));

    const overrides = object.userData?.textures?.overrides || [];
    if (overrides.length === 0) return;

    let targetMesh = object.isMesh ? object : null;
    if (!targetMesh) {
      object.traverse(c => { if (c.isMesh && !targetMesh) targetMesh = c; });
    }
    if (!targetMesh) return;

    overrides.forEach((ov, i) => {
      const asset = this._textures.get(ov.id);
      if (!asset) return;

      const overlayGeo = targetMesh.geometry.clone();
      const overlayMat = new THREE.MeshBasicMaterial({
        map: asset.texture,
        transparent: true,
        opacity: ov.opacity,
        depthWrite: false,
        side: THREE.FrontSide,
        blending: ov.blendMode === 'multiply' ? THREE.MultiplyBlending : THREE.NormalBlending
      });

      const overlay = new THREE.Mesh(overlayGeo, overlayMat);
      overlay.position.copy(targetMesh.position);
      overlay.rotation.copy(targetMesh.rotation);
      overlay.scale.copy(targetMesh.scale);
      overlay.renderOrder = 10 + i;
      overlay.userData = { _isOverlay: true, _overrideIndex: i };

      object.add(overlay);
    });
  }

  async serializeAssets() {
    const textures = {};
    for (const [id, asset] of this._textures) {
      const base64 = this._arrayBufferToBase64(asset.arrayBuffer);
      textures[id] = {
        name: asset.name,
        data: `data:${this._getMimeType(asset.name)};base64,${base64}`
      };
    }

    const meshes = {};
    for (const [id, asset] of this._meshes) {
      const base64 = this._arrayBufferToBase64(asset.arrayBuffer);
      meshes[id] = {
        name: asset.name,
        data: `data:model/gltf-binary;base64,${base64}`
      };
    }

    return { textures, meshes };
  }

  async deserializeAssets(assetsData) {
    if (!assetsData) return;

    if (assetsData.textures) {
      for (const [id, texData] of Object.entries(assetsData.textures)) {
        if (this._textures.has(id)) continue;
        try {
          const ab = this._dataUrlToArrayBuffer(texData.data);
          const blob = new Blob([ab], { type: this._getMimeType(texData.name) });
          const url = URL.createObjectURL(blob);
          const texture = await new Promise((resolve, reject) => {
            this._textureLoader.load(url, resolve, undefined, reject);
          });
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.flipY = true;

          const previewCanvas = document.createElement('canvas');
          previewCanvas.width = 48;
          previewCanvas.height = 48;
          const ctx = previewCanvas.getContext('2d');
          ctx.drawImage(texture.image, 0, 0, 48, 48);
          const preview = previewCanvas.toDataURL('image/png');

          this._textures.set(id, {
            id,
            name: texData.name,
            type: 'texture',
            texture,
            preview,
            blobUrl: url,
            arrayBuffer: ab
          });
        } catch (err) {
          console.warn('Failed to deserialize texture:', id, err);
        }
      }
    }

    if (assetsData.meshes) {
      for (const [id, meshData] of Object.entries(assetsData.meshes)) {
        if (this._meshes.has(id)) continue;
        try {
          const ab = this._dataUrlToArrayBuffer(meshData.data);
          const blob = new Blob([ab], { type: 'model/gltf-binary' });
          const url = URL.createObjectURL(blob);
          const gltf = await new Promise((resolve, reject) => {
            this._gltfLoader.load(url, resolve, undefined, reject);
          });
          const scene = gltf.scene;
          scene.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = false;
              child.receiveShadow = false;
            }
          });
          const box = new THREE.Box3().setFromObject(scene);
          const size = box.getSize(new THREE.Vector3());

          this._meshes.set(id, {
            id,
            name: meshData.name,
            type: 'mesh',
            scene,
            boundingSize: { x: size.x, y: size.y, z: size.z },
            blobUrl: url,
            arrayBuffer: ab
          });
        } catch (err) {
          console.warn('Failed to deserialize mesh:', id, err);
        }
      }
    }
  }

  clear() {
    this._textures.clear();
    this._meshes.clear();
  }

  _dataUrlToArrayBuffer(dataUrl) {
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  _arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  _getMimeType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
    return map[ext] || 'image/png';
  }
}

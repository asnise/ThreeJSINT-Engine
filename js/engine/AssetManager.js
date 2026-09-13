import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AssetManager {
  constructor() {
    this._textures = new Map();
    this._meshes = new Map();
    this._nodeGraphs = new Map();
    this._folders = new Map();
    this._gltfLoader = new GLTFLoader();
    this._textureLoader = new THREE.TextureLoader();
  }

  async importMesh(file, folderId = null) {
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
          folderId: folderId || null,
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

  cloneUniqueMaterials(object) {
    object.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => {
            const m = mat.clone();
            m.name = mat.name;
            return m;
          });
        } else {
          const m = child.material.clone();
          m.name = child.material.name;
          child.material = m;
        }
      }
    });
  }

  setupSeparatedObjects(rootObj, meshAssetId) {
    this.cloneUniqueMaterials(rootObj);

    let pieces = rootObj.children;
    if (pieces.length === 1 && pieces[0].children && pieces[0].children.length > 1) {
      pieces = pieces[0].children;
    }

    if (pieces.length > 1) {
      pieces.forEach((piece, idx) => {
        if (!piece.userData?.id) {
          piece.userData = piece.userData || {};
          piece.userData.id = crypto.randomUUID();
          piece.userData.name = piece.name || `${rootObj.name}_Part_${idx + 1}`;
          piece.userData.type = 'imported_mesh';
          piece.userData.primitiveType = null;
          piece.userData.collider = piece.userData.collider || { enabled: false, isTrigger: false };
          piece.userData.interaction = piece.userData.interaction || { enabled: false, type: 'inspect', promptText: 'Press E to interact' };
          piece.userData.textures = piece.userData.textures || { base: null, overrides: [] };
          piece.userData.meshAssetId = meshAssetId;
          piece.userData.submeshName = piece.name;
          piece.userData.parentId = rootObj.userData.id;
          piece.userData.active = true;

          this.cloneUniqueMaterials(piece);
        }
      });
    }
  }

  createMeshInstance(meshAssetId) {
    const asset = this._meshes.get(meshAssetId);
    if (!asset) return null;

    const clone = asset.scene.clone(true);
    this.cloneUniqueMaterials(clone);

    const rootId = crypto.randomUUID();
    clone.name = asset.name;
    clone.userData = {
      id: rootId,
      name: asset.name,
      type: 'imported_mesh',
      primitiveType: null,
      collider: { enabled: false, isTrigger: false },
      interaction: { enabled: false, type: 'inspect', promptText: 'Press E to interact' },
      textures: { base: null, overrides: [] },
      meshAssetId,
      parentId: null,
      active: true
    };

    this.setupSeparatedObjects(clone, meshAssetId);

    return clone;
  }

  async importTexture(file, folderId = null) {
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
      folderId: folderId || null,
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

  deleteTexture(id) {
    const asset = this._textures.get(id);
    if (!asset) return false;
    if (asset.texture) asset.texture.dispose();
    if (asset.blobUrl) URL.revokeObjectURL(asset.blobUrl);
    return this._textures.delete(id);
  }

  deleteMesh(id) {
    const asset = this._meshes.get(id);
    if (!asset) return false;
    if (asset.blobUrl) URL.revokeObjectURL(asset.blobUrl);
    return this._meshes.delete(id);
  }

  renameTexture(id, newName) {
    const asset = this._textures.get(id);
    if (!asset || !newName) return false;
    asset.name = newName.trim();
    return true;
  }

  renameMesh(id, newName) {
    const asset = this._meshes.get(id);
    if (!asset || !newName) return false;
    asset.name = newName.trim();
    return true;
  }

  applyBaseTexture(object, textureId) {
    const asset = this._textures.get(textureId);
    if (!asset) return;

    const isGltf = object.userData?.type === 'imported_mesh';
    if (isGltf && asset.texture) {
      asset.texture.flipY = false;
    }

    const applyToMesh = (mesh) => {
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          m.map = asset.texture;
          if (isGltf && m.color) m.color.setHex(0xffffff);
          m.needsUpdate = true;
        });
      } else if (mesh.material) {
        mesh.material.map = asset.texture;
        if (isGltf && mesh.material.color) mesh.material.color.setHex(0xffffff);
        mesh.material.needsUpdate = true;
      }
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
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          m.map = null;
          m.needsUpdate = true;
        });
      } else if (mesh.material) {
        mesh.material.map = null;
        mesh.material.needsUpdate = true;
      }
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
        data: `data:${this._getMimeType(asset.name)};base64,${base64}`,
        folderId: asset.folderId || null
      };
    }

    const meshes = {};
    for (const [id, asset] of this._meshes) {
      const base64 = this._arrayBufferToBase64(asset.arrayBuffer);
      meshes[id] = {
        name: asset.name,
        data: `data:model/gltf-binary;base64,${base64}`,
        folderId: asset.folderId || null
      };
    }

    const nodeGraphs = {};
    for (const [id, asset] of this._nodeGraphs) {
      nodeGraphs[id] = {
        id: asset.id,
        name: asset.name,
        type: 'nodegraph',
        folderId: asset.folderId || null,
        graphData: asset.graphData || { nodes: [], connections: [], variables: {} },
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt
      };
    }

    const folders = {};
    for (const [id, folder] of this._folders) {
      folders[id] = {
        id: folder.id,
        name: folder.name,
        type: 'folder',
        parentFolderId: folder.parentFolderId || null,
        createdAt: folder.createdAt
      };
    }

    return { textures, meshes, nodeGraphs, folders };
  }

  createNodeGraphAsset(name = 'NewGraph', graphData = null, folderId = null) {
    const id = crypto.randomUUID();
    const cleanName = (name || 'NewGraph').replace(/\.nodegraph$/i, '');
    const asset = {
      id,
      name: `${cleanName}.nodegraph`,
      type: 'nodegraph',
      folderId: folderId || null,
      graphData: graphData || { nodes: [], connections: [], variables: {} },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this._nodeGraphs.set(id, asset);
    return asset;
  }

  getNodeGraph(id) {
    return this._nodeGraphs.get(id) || null;
  }

  getAllNodeGraphs() {
    return Array.from(this._nodeGraphs.values());
  }

  renameNodeGraph(id, newName) {
    const asset = this._nodeGraphs.get(id);
    if (!asset) return false;
    const cleanName = (newName || 'NewGraph').replace(/\.nodegraph$/i, '');
    asset.name = `${cleanName}.nodegraph`;
    asset.updatedAt = new Date().toISOString();
    return true;
  }

  deleteNodeGraph(id) {
    return this._nodeGraphs.delete(id);
  }

  createFolder(name = 'New Folder', parentFolderId = null) {
    const id = crypto.randomUUID();
    const folder = {
      id,
      name: (name || 'New Folder').trim(),
      type: 'folder',
      parentFolderId: parentFolderId || null,
      createdAt: new Date().toISOString()
    };
    this._folders.set(id, folder);
    return folder;
  }

  getFolder(id) {
    return this._folders.get(id) || null;
  }

  getAllFolders() {
    return Array.from(this._folders.values());
  }

  renameFolder(id, newName) {
    const folder = this._folders.get(id);
    if (!folder) return false;
    folder.name = (newName || 'Folder').trim();
    return true;
  }

  deleteFolder(id) {
    const folder = this._folders.get(id);
    if (!folder) return false;

    for (const m of this._meshes.values()) {
      if (m.folderId === id) m.folderId = folder.parentFolderId || null;
    }
    for (const t of this._textures.values()) {
      if (t.folderId === id) t.folderId = folder.parentFolderId || null;
    }
    for (const g of this._nodeGraphs.values()) {
      if (g.folderId === id) g.folderId = folder.parentFolderId || null;
    }
    for (const f of this._folders.values()) {
      if (f.parentFolderId === id) f.parentFolderId = folder.parentFolderId || null;
    }

    return this._folders.delete(id);
  }

  moveItemToFolder(itemId, itemType, targetFolderId) {
    if (itemType === 'mesh') {
      const m = this._meshes.get(itemId);
      if (m) m.folderId = targetFolderId || null;
    } else if (itemType === 'texture') {
      const t = this._textures.get(itemId);
      if (t) t.folderId = targetFolderId || null;
    } else if (itemType === 'nodegraph') {
      const g = this._nodeGraphs.get(itemId);
      if (g) g.folderId = targetFolderId || null;
    } else if (itemType === 'folder') {
      const f = this._folders.get(itemId);
      if (f && f.id !== targetFolderId) f.parentFolderId = targetFolderId || null;
    }
  }

  clear() {
    for (const asset of this._textures.values()) {
      if (asset.texture) asset.texture.dispose();
      if (asset.blobUrl) URL.revokeObjectURL(asset.blobUrl);
    }
    this._textures.clear();

    for (const asset of this._meshes.values()) {
      if (asset.blobUrl) URL.revokeObjectURL(asset.blobUrl);
    }
    this._meshes.clear();
    this._nodeGraphs.clear();
    this._folders.clear();
  }

  async deserializeAssets(assetsData) {
    if (!assetsData) return;

    if (assetsData.textures) {
      for (const [id, texData] of Object.entries(assetsData.textures)) {
        if (!texData || !texData.data) continue;
        if (this._textures.has(id)) continue;
        try {
          const ab = this._dataUrlToArrayBuffer(texData.data);
          const blob = new Blob([ab], { type: this._getMimeType(texData.name || 'texture.png') });
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
            name: texData.name || 'Texture',
            type: 'texture',
            folderId: texData.folderId || null,
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
        if (!meshData || !meshData.data) continue;
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
            folderId: meshData.folderId || null,
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

    if (assetsData.nodeGraphs) {
      for (const [id, graphData] of Object.entries(assetsData.nodeGraphs)) {
        if (!graphData) continue;
        this._nodeGraphs.set(id, {
          id,
          name: graphData.name || 'Script.nodegraph',
          type: 'nodegraph',
          folderId: graphData.folderId || null,
          graphData: graphData.graphData || { nodes: [], connections: [], variables: {} },
          createdAt: graphData.createdAt || new Date().toISOString(),
          updatedAt: graphData.updatedAt || new Date().toISOString()
        });
      }
    }

    if (assetsData.folders) {
      for (const [id, folderData] of Object.entries(assetsData.folders)) {
        if (!folderData) continue;
        this._folders.set(id, {
          id,
          name: folderData.name || 'Folder',
          type: 'folder',
          parentFolderId: folderData.parentFolderId || null,
          createdAt: folderData.createdAt || new Date().toISOString()
        });
      }
    }
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

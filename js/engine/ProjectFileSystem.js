export class ProjectFileSystem {
  //#region [Variables/Fields]
  _projectName = 'MyInteractiveScene';
  _dbName = 'ThreeJSINT_DB';
  _dbStore = 'recent_projects_v2';
  _db = null;
  //#endregion

  //#region [Properties]
  get isSupported() {
    return true;
  }

  get projectName() {
    return this._projectName;
  }

  set projectName(value) {
    this._projectName = value || 'MyInteractiveScene';
  }

  get hasActiveProject() {
    return !!this._projectName;
  }

  get packageFileName() {
    const safe = (this._projectName || 'project').replace(/[^a-zA-Z0-9_\-]/g, '_');
    return `${safe}.threeint`;
  }
  //#endregion

  //#region [Unity Methods]
  constructor() {
    this._initDatabase();
  }
  //#endregion

  //#region [Public Methods]
  async createProject(projectName, initialData = null) {
    this._projectName = projectName || 'MyInteractiveScene';
    const data = initialData || this._createDefaultProjectData(this._projectName);
    data.projectName = this._projectName;
    data.updatedAt = new Date().toISOString();

    await this.addRecentProject(this._projectName, data);
    return data;
  }

  async bundleProject(projectData, assetManager = null) {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip library is not loaded.');
    }

    const zip = new JSZip();
    projectData.projectName = this._projectName;
    projectData.updatedAt = new Date().toISOString();

    zip.file('project.json', JSON.stringify(projectData, null, 2));

    const assetsFolder = zip.folder('assets');
    const modelsFolder = assetsFolder.folder('models');
    const texturesFolder = assetsFolder.folder('textures');

    if (assetManager) {
      if (assetManager._meshes) {
        for (const [id, m] of assetManager._meshes.entries()) {
          if (m.arrayBuffer) {
            const safeName = (m.name || id).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
            const filename = safeName.endsWith('.glb') ? safeName : safeName + '.glb';
            modelsFolder.file(filename, m.arrayBuffer);
          }
        }
      }

      if (assetManager._textures) {
        for (const [id, t] of assetManager._textures.entries()) {
          if (t.arrayBuffer) {
            const safeName = (t.name || id).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
            const filename = safeName.endsWith('.png') ? safeName : safeName + '.png';
            texturesFolder.file(filename, t.arrayBuffer);
          }
        }
      }
    }

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    await this.addRecentProject(this._projectName, projectData);
    return blob;
  }

  async saveLocalProject(projectData) {
    if (!projectData) return false;
    const name = projectData.projectName || this._projectName;
    this._projectName = name;
    projectData.projectName = name;
    projectData.updatedAt = new Date().toISOString();
    await this.addRecentProject(name, projectData);
    try {
      localStorage.setItem('threejsint_last_project', name);
      localStorage.setItem('threejsint_last_saved', projectData.updatedAt);
    } catch {}
    return true;
  }

  downloadBundle(blob, fileName = null) {
    const targetName = fileName || this.packageFileName;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = targetName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async parseProjectPackage(fileOrBlob) {
    const isJson = fileOrBlob.name
      ? fileOrBlob.name.toLowerCase().endsWith('.json')
      : fileOrBlob.type === 'application/json';

    if (isJson) {
      const text = await fileOrBlob.text();
      const data = JSON.parse(text);
      if (data.projectName) this._projectName = data.projectName;
      await this.addRecentProject(this._projectName, data);
      return data;
    }

    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip library is required to open .threeint or .zip project packages.');
    }

    const zip = await JSZip.loadAsync(fileOrBlob);
    const projectJsonFile = zip.file('project.json');
    if (!projectJsonFile) {
      throw new Error('Invalid project package: project.json was not found in the archive.');
    }

    const projectText = await projectJsonFile.async('text');
    const projectData = JSON.parse(projectText);

    if (projectData.projectName) {
      this._projectName = projectData.projectName;
    }

    projectData.assets = projectData.assets || {};
    projectData.assets.textures = projectData.assets.textures || {};
    projectData.assets.meshes = projectData.assets.meshes || {};

    const textureZipFiles = zip.file(/^assets\/textures\/.+/);
    for (const file of textureZipFiles) {
      const fileName = file.name.split('/').pop();
      if (!fileName) continue;
      const existingEntry = Object.values(projectData.assets.textures).find(t => t.name === fileName);
      if (!existingEntry || !existingEntry.data) {
        const ab = await file.async('arraybuffer');
        const ext = fileName.split('.').pop().toLowerCase();
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
        const base64 = this._arrayBufferToBase64(ab);
        if (existingEntry) {
          existingEntry.data = `data:${mime};base64,${base64}`;
        } else {
          const id = crypto.randomUUID();
          projectData.assets.textures[id] = {
            name: fileName,
            data: `data:${mime};base64,${base64}`
          };
        }
      }
    }

    const modelZipFiles = zip.file(/^assets\/models\/.+/);
    for (const file of modelZipFiles) {
      const fileName = file.name.split('/').pop();
      if (!fileName) continue;
      const baseName = fileName.replace(/\.glb$/i, '');
      const existingEntry = Object.values(projectData.assets.meshes).find(m => m.name === baseName || m.name === fileName);
      if (!existingEntry || !existingEntry.data) {
        const ab = await file.async('arraybuffer');
        const base64 = this._arrayBufferToBase64(ab);
        if (existingEntry) {
          existingEntry.data = `data:model/gltf-binary;base64,${base64}`;
        } else {
          const id = crypto.randomUUID();
          projectData.assets.meshes[id] = {
            name: baseName,
            data: `data:model/gltf-binary;base64,${base64}`
          };
        }
      }
    }

    await this.addRecentProject(this._projectName, projectData);
    return projectData;
  }

  async getRecentProjects() {
    await this._ensureDB();
    return new Promise((resolve) => {
      if (!this._db) {
        resolve([]);
        return;
      }
      try {
        const tx = this._db.transaction(this._dbStore, 'readonly');
        const store = tx.objectStore(this._dbStore);
        const req = store.getAll();
        req.onsuccess = () => {
          const results = req.result || [];
          results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          resolve(results);
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  async addRecentProject(name, data = null) {
    await this._ensureDB();
    if (!this._db) return;
    return new Promise((resolve) => {
      try {
        const tx = this._db.transaction(this._dbStore, 'readwrite');
        const store = tx.objectStore(this._dbStore);
        const entry = {
          name,
          data,
          timestamp: Date.now()
        };
        store.put(entry, name);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async removeRecentProject(name) {
    await this._ensureDB();
    if (!this._db) return;
    return new Promise((resolve) => {
      try {
        const tx = this._db.transaction(this._dbStore, 'readwrite');
        const store = tx.objectStore(this._dbStore);
        store.delete(name);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  //#endregion

  //#region [Private Methods]
  _createDefaultProjectData(name) {
    return {
      format: 'ThreeJSINT',
      version: 1,
      projectName: name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scene: { objects: [] },
      assets: { meshes: {}, textures: {} },
      uiData: { elements: [] },
      nodeGraphData: { nodes: [], connections: [], variables: {} }
    };
  }

  _arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  _initDatabase() {
    if (typeof indexedDB === 'undefined') return;
    const req = indexedDB.open(this._dbName, 2);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(this._dbStore)) {
        db.createObjectStore(this._dbStore);
      }
    };
    req.onsuccess = (e) => {
      this._db = e.target.result;
    };
  }

  async _ensureDB() {
    if (this._db) return;
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve();
        return;
      }
      const req = indexedDB.open(this._dbName, 2);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this._dbStore)) {
          db.createObjectStore(this._dbStore);
        }
      };
      req.onsuccess = (e) => {
        this._db = e.target.result;
        resolve();
      };
      req.onerror = () => resolve();
    });
  }
  //#endregion
}

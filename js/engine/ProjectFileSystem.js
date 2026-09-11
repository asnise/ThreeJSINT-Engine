export class ProjectFileSystem {
  //#region [Variables/Fields]
  _currentDirHandle = null;
  _projectName = 'UntitledProject';
  _dbName = 'ThreeJSINT_DB';
  _dbStore = 'recent_projects';
  _db = null;
  //#endregion

  //#region [Properties]
  get isSupported() {
    return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
  }

  get currentDirHandle() {
    return this._currentDirHandle;
  }

  get projectName() {
    return this._projectName;
  }

  set projectName(value) {
    this._projectName = value || 'UntitledProject';
  }

  get hasActiveProject() {
    return this._currentDirHandle !== null;
  }
  //#endregion

  //#region [Unity Methods]
  constructor() {
    this._initDatabase();
  }
  //#endregion

  //#region [Public Methods]
  async createProjectInDirectory(dirHandle, projectName, initialData = null) {
    this._currentDirHandle = dirHandle;
    this._projectName = projectName || dirHandle.name || 'NewProject';

    await this._ensureProjectStructure();

    const data = initialData || this._createDefaultProjectData(this._projectName);
    data.projectName = this._projectName;
    data.updatedAt = new Date().toISOString();

    await this.writeTextFile('project.json', JSON.stringify(data, null, 2));
    await this.addRecentProject(this._projectName, dirHandle);

    return data;
  }

  async promptCreateProject(projectName, initialData = null) {
    if (!this.isSupported) {
      throw new Error('File System Access API is not supported in this browser.');
    }
    const dirHandle = await window.showDirectoryPicker({
      mode: 'readwrite'
    });
    return await this.createProjectInDirectory(dirHandle, projectName, initialData);
  }

  async promptOpenProject() {
    if (!this.isSupported) {
      throw new Error('File System Access API is not supported in this browser.');
    }
    const dirHandle = await window.showDirectoryPicker({
      mode: 'readwrite'
    });
    return await this.openProjectFromDirectory(dirHandle);
  }

  async openProjectFromDirectory(dirHandle) {
    const perm = await this._verifyPermission(dirHandle, true);
    if (!perm) {
      throw new Error('Permission to access folder was denied.');
    }

    this._currentDirHandle = dirHandle;
    this._projectName = dirHandle.name;

    const projectJsonText = await this.readTextFile('project.json');
    if (!projectJsonText) {
      throw new Error('No project.json found in the selected folder. Please ensure this is a valid project folder.');
    }

    const data = JSON.parse(projectJsonText);
    if (data.projectName) {
      this._projectName = data.projectName;
    }

    await this.addRecentProject(this._projectName, dirHandle);
    return data;
  }

  async saveProject(projectData, assetManager = null) {
    if (!this._currentDirHandle) {
      return await this.promptCreateProject(this._projectName, projectData);
    }

    const perm = await this._verifyPermission(this._currentDirHandle, true);
    if (!perm) {
      throw new Error('Permission to write to project folder was denied.');
    }

    await this._ensureProjectStructure();

    projectData.projectName = this._projectName;
    projectData.updatedAt = new Date().toISOString();

    if (assetManager) {
      await this._syncAssetsToDisk(assetManager);
    }

    await this.writeTextFile('project.json', JSON.stringify(projectData, null, 2));
    await this.addRecentProject(this._projectName, this._currentDirHandle);

    return true;
  }

  async writeTextFile(filename, content) {
    if (!this._currentDirHandle) return false;
    const fileHandle = await this._currentDirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  }

  async readTextFile(filename) {
    if (!this._currentDirHandle) return null;
    try {
      const fileHandle = await this._currentDirHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch {
      return null;
    }
  }

  async writeBinaryFile(subPath, arrayBuffer) {
    if (!this._currentDirHandle) return false;
    const parts = subPath.split('/').filter(p => p.length > 0);
    const fileName = parts.pop();

    let targetDir = this._currentDirHandle;
    for (const folder of parts) {
      targetDir = await targetDir.getDirectoryHandle(folder, { create: true });
    }

    const fileHandle = await targetDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(arrayBuffer);
    await writable.close();
    return true;
  }

  async getRecentProjects() {
    await this._ensureDB();
    return new Promise((resolve) => {
      if (!this._db) {
        resolve([]);
        return;
      }
      const tx = this._db.transaction(this._dbStore, 'readonly');
      const store = tx.objectStore(this._dbStore);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result || [];
        results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(results);
      };
      req.onerror = () => resolve([]);
    });
  }

  async addRecentProject(name, dirHandle) {
    await this._ensureDB();
    if (!this._db) return;
    return new Promise((resolve) => {
      const tx = this._db.transaction(this._dbStore, 'readwrite');
      const store = tx.objectStore(this._dbStore);
      const entry = {
        name,
        handle: dirHandle,
        pathName: dirHandle.name || name,
        timestamp: Date.now()
      };
      store.put(entry, name);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async removeRecentProject(name) {
    await this._ensureDB();
    if (!this._db) return;
    return new Promise((resolve) => {
      const tx = this._db.transaction(this._dbStore, 'readwrite');
      const store = tx.objectStore(this._dbStore);
      store.delete(name);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
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

  async _ensureProjectStructure() {
    if (!this._currentDirHandle) return;
    const assetsHandle = await this._currentDirHandle.getDirectoryHandle('assets', { create: true });
    await assetsHandle.getDirectoryHandle('models', { create: true });
    await assetsHandle.getDirectoryHandle('textures', { create: true });
  }

  async _syncAssetsToDisk(assetManager) {
    if (!assetManager || !this._currentDirHandle) return;

    for (const [id, m] of assetManager._meshes.entries()) {
      if (m.arrayBuffer) {
        const safeName = (m.name || id).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        const filename = safeName.endsWith('.glb') ? safeName : safeName + '.glb';
        await this.writeBinaryFile(`assets/models/${filename}`, m.arrayBuffer);
      }
    }

    for (const [id, t] of assetManager._textures.entries()) {
      if (t.arrayBuffer) {
        const safeName = (t.name || id).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        const filename = safeName.endsWith('.png') ? safeName : safeName + '.png';
        await this.writeBinaryFile(`assets/textures/${filename}`, t.arrayBuffer);
      }
    }
  }

  async _verifyPermission(fileHandle, readWrite = true) {
    const options = {};
    if (readWrite) {
      options.mode = 'readwrite';
    }
    if ((await fileHandle.queryPermission(options)) === 'granted') {
      return true;
    }
    if ((await fileHandle.requestPermission(options)) === 'granted') {
      return true;
    }
    return false;
  }

  _initDatabase() {
    if (typeof indexedDB === 'undefined') return;
    const req = indexedDB.open(this._dbName, 1);
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
      const req = indexedDB.open(this._dbName, 1);
      req.onsuccess = (e) => {
        this._db = e.target.result;
        resolve();
      };
      req.onerror = () => resolve();
    });
  }
  //#endregion
}

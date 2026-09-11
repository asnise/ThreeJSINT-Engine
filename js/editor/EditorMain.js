import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { Renderer } from '../engine/Renderer.js';
import { SceneManager } from '../engine/SceneManager.js';
import { AssetManager } from '../engine/AssetManager.js';
import { CollisionSystem } from '../engine/CollisionSystem.js';
import { FPSController } from '../engine/FPSController.js';
import { MobileControls } from '../engine/MobileControls.js';
import { InteractionSystem } from '../engine/InteractionSystem.js';
import { ItemInspector } from '../engine/ItemInspector.js';
import { Primitives } from '../engine/Primitives.js';

import { Hierarchy } from './Hierarchy.js';
import { Inspector } from './Inspector.js';
import { Toolbar } from './Toolbar.js';
import { Gizmo } from './Gizmo.js';
import { ExportSystem } from './ExportSystem.js';
import { UIManager } from '../engine/UIManager.js';
import { UIPanel } from './UIPanel.js';
import { NodeGraphRuntime } from '../engine/NodeGraph/NodeGraphRuntime.js';
import { NodeGraphEditor } from './NodeGraphEditor.js';
import { ProjectPanel } from './ProjectPanel.js';
import { ProjectFileSystem } from '../engine/ProjectFileSystem.js';
import { ProjectLauncher } from './ProjectLauncher.js';

export class EditorMain {
  constructor(rootEl) {
    this.rootEl = rootEl;
    this.mode = 'edit';
    this.maximizeOnPlay = false;
    this.projectFS = new ProjectFileSystem();

    this._setupDOM();
    this._setupEngine();
    this._setupEditor();
    this._setupKeyboard();

    this.renderer.start();
  }

  _setupDOM() {
    this.rootEl.innerHTML = '';
    this.rootEl.className = 'editor-root';

    this.toolbarEl = document.createElement('div');
    this.toolbarEl.className = 'editor-toolbar';
    this.rootEl.appendChild(this.toolbarEl);

    this.hierarchyEl = document.createElement('div');
    this.hierarchyEl.className = 'panel-hierarchy';
    this.rootEl.appendChild(this.hierarchyEl);

    this.viewportEl = document.createElement('div');
    this.viewportEl.className = 'panel-viewport';
    this.rootEl.appendChild(this.viewportEl);

    this.inspectorEl = document.createElement('div');
    this.inspectorEl.className = 'panel-inspector';
    this.rootEl.appendChild(this.inspectorEl);

    this.projectEl = document.createElement('div');
    this.projectEl.className = 'panel-project';
    this.rootEl.appendChild(this.projectEl);

    this.playOverlayMsg = document.createElement('div');
    this.playOverlayMsg.className = 'play-overlay-msg';
    this.playOverlayMsg.textContent = 'Click to lock cursor · ESC to unlock · Press Stop to exit';
    this.viewportEl.appendChild(this.playOverlayMsg);
  }

  _setupEngine() {
    this.renderer = new Renderer(this.viewportEl);
    this.assetManager = new AssetManager();
    this.sceneManager = new SceneManager(this.renderer.scene);
    this.collisionSystem = new CollisionSystem(this.sceneManager);
    this.itemInspector = new ItemInspector(this.viewportEl);

    this.fpsController = new FPSController(
      this.renderer.camera,
      this.renderer.domElement,
      this.collisionSystem
    );

    this.mobileControls = new MobileControls(this.viewportEl);

    this.interactionSystem = new InteractionSystem(
      this.renderer.camera,
      this.sceneManager,
      this.fpsController,
      this.mobileControls,
      this.itemInspector,
      this.viewportEl
    );

    this.orbitControls = new OrbitControls(this.renderer.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = false;
    this.orbitControls.target.set(0, 1, 0);
    this.orbitControls.update();

    this.uiManager = new UIManager();
    this.uiManager.mount(this.viewportEl);

    this.nodeRuntime = new NodeGraphRuntime(this.sceneManager, this.uiManager, this.itemInspector);


    this.interactionSystem.onObjectInteracted = (target) => {
      this.nodeRuntime.triggerEvent('OnInteract', target);
    };

    this.collisionSystem.onTriggerEnter = (obj) => {
      this.nodeRuntime.triggerEvent('OnTriggerEnter', obj);
    };

    this.collisionSystem.onTriggerExit = (obj) => {
      this.nodeRuntime.triggerEvent('OnTriggerExit', obj);
    };

    this.renderer.onUpdate((dt) => this._update(dt));
  }

  _setupEditor() {
    this.hierarchy = new Hierarchy(this.hierarchyEl, this.sceneManager, {
      onFocusObject: (obj) => this.focusObject(obj)
    }, this.assetManager);
    this.inspector = new Inspector(this.inspectorEl, this.sceneManager, this.assetManager);

    this.gizmo = new Gizmo(
      this.renderer.camera,
      this.renderer.domElement,
      this.renderer.scene,
      this.sceneManager
    );

    this.gizmo.onDraggingChanged = (isDragging) => {
      this.orbitControls.enabled = !isDragging;
      if (!isDragging) this.inspector.refresh();
    };

    this.uiPanel = new UIPanel(this.rootEl, this.uiManager, this.assetManager);
    this.nodeGraphEditor = new NodeGraphEditor(this.rootEl, this.nodeRuntime, this.sceneManager, this.uiManager);
    this.inspector.onOpenNodeGraph = (objId) => this.nodeGraphEditor.openForObject(objId);
    this.projectPanel = new ProjectPanel(this.projectEl, this.assetManager, this.sceneManager, {
      onRename: () => this.renameProject()
    });

    this.exportSystem = new ExportSystem(this.sceneManager, this.assetManager, this.uiManager, this.nodeRuntime);

    this.toolbar = new Toolbar(this.toolbarEl, {
      addPrimitive: (type) => this._addPrimitive(type),
      importMesh: () => this._importMesh(),
      importTexture: () => this._importTexture(),
      setGizmoMode: (mode) => this.gizmo.setMode(mode),
      play: () => this.play(),
      stop: () => this.stop(),
      exportHTML: () => this.exportSystem.exportHTML(),
      exportZip: () => this.exportSystem.exportZip(this.projectFS.projectName),
      saveProject: () => this.saveProject(),
      saveProjectAs: () => this.saveProjectAs(),
      renameProject: () => this.renameProject(),
      openProjectFolder: () => this.openProjectFolder(),
      openProjectFile: () => this.openProjectFile(),
      openLauncher: () => this.projectLauncher.show(true),
      loadDemo: (name) => this.loadDemo(name),
      toggleColliders: () => this.toggleColliders(),
      openUIPanel: () => this.uiPanel.toggle(),
      openNodeGraph: () => this.nodeGraphEditor.toggle(),
      toggleMaximize: (val) => {
        this.maximizeOnPlay = val;
        if (this.mode === 'play') {
          this._applyPlayLayout(val);
        }
      }
    }, this.viewportEl);

    this.projectLauncher = new ProjectLauncher(this.rootEl, this.projectFS, {
      onProjectCreated: (data) => {
        this._loadProjectData(data);
        this._setProjectName(this.projectFS.projectName);
        this._showToast(`Project created: ${this.projectFS.projectName}`);
      },
      onProjectLoaded: (data) => {
        this._loadProjectData(data);
        this._setProjectName(this.projectFS.projectName);
        this._showToast(`Project loaded: ${this.projectFS.projectName}`);
      },
      onLegacyFileLoaded: (data) => {
        this._loadProjectData(data);
        this._setProjectName(data.projectName || 'JSON Project');
        this._showToast('Project loaded from file');
      },
      onLoadDemo: (name) => {
        this.loadDemo(name);
        this._setProjectName(`Demo: ${name}`);
      },
      onQuickSandbox: (name, template) => {
        if (template === 'demo') {
          this.loadDemo('treasure-room');
        }
        this._setProjectName('Quick Sandbox');
      }
    });

    setTimeout(() => {
      this.projectLauncher.show(true);
    }, 120);

    this.sceneManager.on('sceneChanged', () => {
      if (this.collisionSystem.isDebugVisible) {
        this.collisionSystem.updateDebugVisuals();
      }
    });

    this._setupViewportSelection();
    this._setupViewportDrop();
    this._addDefaultScene();
  }

  _setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        this.saveProjectAs();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        this.saveProject();
        return;
      }

      if (this.mode !== 'edit') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'Delete':
        case 'Backspace':
          if (this.sceneManager.selectedObject) {
            this.sceneManager.removeObject(this.sceneManager.selectedObject.userData.id);
          }
          break;
        case 'KeyF':
          if (this.sceneManager.selectedObject) {
            this.focusObject(this.sceneManager.selectedObject);
          }
          break;
        case 'KeyW':
          this.gizmo.setMode('translate');
          break;
        case 'KeyE':
          this.gizmo.setMode('rotate');
          break;
        case 'KeyR':
          this.gizmo.setMode('scale');
          break;
      }
    });
  }

  focusObject(obj) {
    if (!obj || !this.orbitControls) return;
    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    this.orbitControls.target.copy(center);
    this.orbitControls.update();
  }

  _addDefaultScene() {
    const floor = Primitives.createPlane(0x4a4a4a);
    floor.userData.name = 'Floor';
    floor.name = 'Floor';
    floor.userData.collider.enabled = true;
    this.sceneManager.addObject(floor);

    const grid = new THREE.GridHelper(10, 10, 0x555555, 0x333333);
    grid.position.y = 0.01;
    this.renderer.scene.add(grid);
    this._gridHelper = grid;
  }

  _addPrimitive(type) {
    const obj = Primitives.createFromType(type);
    obj.position.y = 0.5;
    this.sceneManager.addObject(obj);
    this.sceneManager.selectObject(obj.userData.id);
  }

  async _importMesh() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.glb,.gltf';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const asset = await this.assetManager.importMesh(file);
        const instance = this.assetManager.createMeshInstance(asset.id);
        if (instance) {
          instance.position.y = 0.5;
          this.sceneManager.addObject(instance);
          this.sceneManager.selectObject(instance.userData.id);
        }
        this.projectPanel.refresh();
      } catch (err) {
        console.error('Failed to import mesh:', err);
      }
    });
    input.click();
  }

  async _importTexture() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        await this.assetManager.importTexture(file);
        this.inspector.refresh();
        this.projectPanel.refresh();
      } catch (err) {
        console.error('Failed to import texture:', err);
      }
    });
    input.click();
  }

  _update(dt) {
    if (this.mode === 'edit') {
      this.orbitControls.update();
    } else if (this.mode === 'play') {
      this.fpsController.update(dt);
      this.interactionSystem.update();
      this.nodeRuntime.update(dt);

      if (this.mobileControls.isMobile && this.mobileControls.enabled) {
        const mi = this.mobileControls.getMoveInput();
        this.fpsController.setMoveInput(mi.x, mi.z);
      }

      this.collisionSystem.checkTriggers(
        this.renderer.camera.position,
        this.fpsController.playerRadius
      );
    }
  }

  _savedCameraState = null;

  _applyPlayLayout(maximize) {
    if (maximize) {
      this.hierarchyEl.style.display = 'none';
      this.inspectorEl.style.display = 'none';
      this.projectEl.style.display = 'none';
      this.rootEl.style.gridTemplateRows = 'var(--toolbar-h) 1fr';
      this.rootEl.style.gridTemplateColumns = '1fr';
      this.rootEl.style.gridTemplateAreas = '"toolbar" "viewport"';
    } else {
      this.hierarchyEl.style.display = '';
      this.inspectorEl.style.display = '';
      this.projectEl.style.display = '';
      this.rootEl.style.gridTemplateRows = '';
      this.rootEl.style.gridTemplateColumns = '';
      this.rootEl.style.gridTemplateAreas = '';
    }
    this.renderer.resize();
  }

  play() {
    if (this.mode === 'play') return;
    this.mode = 'play';

    this._savedCameraState = {
      position: this.renderer.camera.position.clone(),
      quaternion: this.renderer.camera.quaternion.clone(),
      target: this.orbitControls.target.clone()
    };

    this.orbitControls.enabled = false;
    this.gizmo.disable();

    this._applyPlayLayout(this.maximizeOnPlay);

    if (this._gridHelper) this._gridHelper.visible = false;

    const spawn = this.sceneManager.playerSpawn;
    this.fpsController.enable(spawn.position, spawn.rotation);

    if (this.mobileControls.isMobile) {
      this.mobileControls.enable((dx, dy) => {
        this.fpsController.setLookInput(dx, dy);
      });
    }

    this.interactionSystem.enable();
    this.collisionSystem.clearTriggerState();

    this.nodeRuntime.reset();
    this.nodeRuntime.triggerEvent('OnStart');

    this.toolbar.setPlayMode(true);
    this.playOverlayMsg.style.display = 'block';
    setTimeout(() => { this.playOverlayMsg.style.display = 'none'; }, 3000);

    this.renderer.resize();
  }

  stop() {
    if (this.mode === 'edit') return;
    this.mode = 'edit';

    this.fpsController.disable();
    this.mobileControls.disable();
    this.interactionSystem.disable();
    this.nodeRuntime.reset();

    if (this.itemInspector.isActive) {
      this.itemInspector.close();
    }

    if (this._savedCameraState) {
      this.renderer.camera.position.copy(this._savedCameraState.position);
      this.renderer.camera.quaternion.copy(this._savedCameraState.quaternion);
      this.orbitControls.target.copy(this._savedCameraState.target);
    }

    this.orbitControls.enabled = true;
    this.gizmo.enable();

    this._applyPlayLayout(false);

    if (this._gridHelper) this._gridHelper.visible = true;

    this.toolbar.setPlayMode(false);
    this.renderer.resize();
  }

  async loadDemo(name) {
    try {
      const resp = await fetch(`demo/${name}.json`);
      const data = await resp.json();
      await this._loadProjectData(data);
      this._setProjectName(`Demo: ${name}`);
      this._showToast(`Demo loaded: ${name}`);
    } catch (err) {
      console.warn('Could not load demo:', err);
    }
  }

  async _loadProjectData(data) {
    if (data.projectName) {
      this.projectFS.projectName = data.projectName;
      this._setProjectName(this.projectFS.projectName);
    }

    this.sceneManager.selectObject(null);
    if (this.gizmo) this.gizmo.detach();

    this.assetManager.clear();
    if (data.assets) {
      await this.assetManager.deserializeAssets(data.assets);
    }
    const sceneData = data.scene || data;
    this.sceneManager.deserialize(sceneData, this.assetManager, Primitives);

    if (data.uiData || sceneData.uiData) {
      this.uiManager.deserialize(data.uiData || sceneData.uiData);
    } else {
      this.uiManager.clearCustom();
    }

    if (data.nodeGraphData || sceneData.nodeGraphData) {
      this.nodeRuntime.deserialize(data.nodeGraphData || sceneData.nodeGraphData);
    } else {
      this.nodeRuntime.deserialize({ nodes: [], connections: [], variables: {} });
    }

    this.hierarchy.refresh();
    this.inspector.refresh();
    this.projectPanel.refresh();
    if (this.collisionSystem.isDebugVisible) {
      this.collisionSystem.updateDebugVisuals();
    }
  }

  async _serializeCurrentProject() {
    const sceneData = this.sceneManager.serialize();
    const assetsData = await this.assetManager.serializeAssets();
    const uiData = this.uiManager.serialize();
    const nodeGraphData = this.nodeRuntime.serialize();
    return {
      format: 'ThreeJSINT',
      version: 1,
      projectName: this.projectFS.projectName || 'MyInteractiveScene',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scene: sceneData,
      assets: assetsData,
      uiData: uiData,
      nodeGraphData: nodeGraphData
    };
  }

  async saveProject() {
    try {
      const project = await this._serializeCurrentProject();
      await this.projectFS.saveLocalProject(project);
      this._showToast(`Saved locally: ${this.projectFS.projectName}`);
    } catch (err) {
      console.warn('Local save failed:', err);
      this._showToast(`Failed to save locally: ${err.message}`);
    }
  }

  async saveProjectAs() {
    const currentName = this.projectFS.projectName || 'MyInteractiveScene';
    const newName = prompt('Enter project name to export as file:', currentName);
    if (!newName) return;
    this.projectFS.projectName = newName.trim();
    this._setProjectName(this.projectFS.projectName);

    try {
      const project = await this._serializeCurrentProject();
      const blob = await this.projectFS.bundleProject(project, this.assetManager);
      this.projectFS.downloadBundle(blob);
      await this.projectFS.saveLocalProject(project);
      this._showToast(`Exported package: ${this.projectFS.packageFileName}`);
    } catch (err) {
      console.warn('Direct package save failed, fallback to json:', err);
      const project = await this._serializeCurrentProject();
      await this._fallbackSaveDownload(project);
    }
  }

  async renameProject() {
    const currentName = this.projectFS.projectName || 'MyInteractiveScene';
    const newName = prompt('Enter new project name:', currentName);
    if (!newName || newName.trim() === currentName) return;
    this.projectFS.projectName = newName.trim();
    this._setProjectName(this.projectFS.projectName);
    await this.saveProject();
    this._showToast(`Renamed project: ${this.projectFS.projectName}`);
  }

  async openProjectFolder() {
    await this.openProjectFile();
  }

  async openProjectFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.threeint,.zip,.json';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const data = await this.projectFS.parseProjectPackage(file);
        await this._loadProjectData(data);
        const name = data.projectName || file.name.replace(/\.(threeint|zip|json)$/i, '');
        this.projectFS.projectName = name;
        this._setProjectName(name);
        this._showToast(`Loaded ${file.name}`);
      } catch (err) {
        alert(`Failed to load project package: ${err.message}`);
      }
    });
    input.click();
  }

  _setProjectName(name) {
    if (this.toolbar) this.toolbar.setProjectName(name);
    if (this.projectPanel) this.projectPanel.setProjectName(name);
  }

  async _fallbackSaveDownload(project) {
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(this.projectFS.projectName || 'project').replace(/[^a-zA-Z0-9_\-]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this._showToast('Saved as JSON download');
  }

  _showToast(message) {
    const existing = document.querySelector('.editor-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'editor-toast';
    toast.textContent = message;
    this.rootEl.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }

  toggleColliders() {
    const next = !this.collisionSystem.isDebugVisible;
    this.collisionSystem.setDebugVisible(next);
    return next;
  }


  _setupViewportSelection() {
    let downX = 0, downY = 0;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    this.viewportEl.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
    });

    this.viewportEl.addEventListener('pointerup', (e) => {
      if (this.mode !== 'edit') return;
      if (this.gizmo && this.gizmo.controls && this.gizmo.controls.dragging) return;
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist > 6) return;

      const rect = this.renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, this.renderer.camera);
      const objects = this.sceneManager.getAllObjects();
      const meshes = [];
      objects.forEach(obj => {
        if (obj.isMesh) meshes.push(obj);
        else obj.traverse(c => { if (c.isMesh) meshes.push(c); });
      });

      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length > 0) {
        let topObj = hits[0].object;
        while (topObj && !topObj.userData?.id) {
          topObj = topObj.parent;
        }
        if (topObj && topObj.userData?.id) {
          this.sceneManager.selectObject(topObj.userData.id);
          return;
        }
      }
      this.sceneManager.selectObject(null);
    });
  }

  _setupViewportDrop() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.viewportEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    this.viewportEl.addEventListener('drop', async (e) => {
      e.preventDefault();

      const rect = this.renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, this.renderer.camera);

      let targetPos = new THREE.Vector3();
      const intersectPoint = new THREE.Vector3();

      const meshes = [];
      this.sceneManager.getAllObjects().forEach(obj => {
        if (obj.isMesh) meshes.push(obj);
        else obj.traverse(c => { if (c.isMesh) meshes.push(c); });
      });
      const hits = raycaster.intersectObjects(meshes, false);

      if (hits.length > 0) {
        targetPos.copy(hits[0].point);
      } else if (raycaster.ray.intersectPlane(groundPlane, intersectPoint)) {
        targetPos.copy(intersectPoint);
      } else {
        targetPos.set(0, 0, 0);
      }

      // Handle OS files dropped directly onto viewport
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (const file of e.dataTransfer.files) {
          const ext = file.name.split('.').pop().toLowerCase();
          if (ext === 'glb' || ext === 'gltf') {
            try {
              const asset = await this.assetManager.importMesh(file);
              const inst = this.assetManager.createMeshInstance(asset.id);
              if (inst) {
                inst.position.copy(targetPos);
                inst.position.y += 0.5;
                this.sceneManager.addObject(inst);
                this.sceneManager.selectObject(inst.userData.id);
              }
              this.projectPanel.refresh();
            } catch (err) {
              console.error('Failed to import dropped mesh:', err);
            }
          } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
            try {
              await this.assetManager.importTexture(file);
              this.projectPanel.refresh();
            } catch (err) {
              console.error('Failed to import dropped texture:', err);
            }
          }
        }
        return;
      }

      // Handle dragging from Project panel
      const raw = e.dataTransfer?.getData('application/json');
      if (!raw) return;
      let data;
      try { data = JSON.parse(raw); } catch (err) { return; }

      if (hits.length > 0 && data.assetType === 'texture') {
        let topObj = hits[0].object;
        while (topObj && !topObj.userData?.id) topObj = topObj.parent;
        if (topObj) {
          if (topObj.userData?.type === 'imported_mesh' || topObj.userData?.textures) {
            this.assetManager.applyBaseTexture(topObj, data.assetId);
            this.inspector.refresh();
            return;
          }
          if (topObj.userData?.material) {
            topObj.userData.material.textureId = data.assetId;
            const tex = this.assetManager.getTexture(data.assetId);
            if (tex) {
              topObj.traverse(child => {
                if (child.isMesh && child.material) {
                  child.material.map = tex;
                  child.material.needsUpdate = true;
                }
              });
            }
            this.inspector.refresh();
            return;
          }
        }
      }

      if (data.assetType === 'mesh') {
        const instance = this.assetManager.createMeshInstance(data.assetId);
        if (instance) {
          instance.position.copy(targetPos);
          if (hits.length === 0 || Math.abs(targetPos.y) < 0.05) {
            instance.position.y += 0.5;
          }
          this.sceneManager.addObject(instance);
          this.sceneManager.selectObject(instance.userData.id);
          this.projectPanel.refresh();
        }
      }
    });
  }
}

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
    this._sceneUndoStack = [];
    this._sceneRedoStack = [];
    this._maxSceneHistory = 50;
    this._gizmoPreDragSnapshot = null;
    this._autoSaveTimer = null;

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

    this.nodeRuntime = new NodeGraphRuntime(this.sceneManager, this.uiManager, this.itemInspector, this.collisionSystem);


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
    this.inspector = new Inspector(this.inspectorEl, this.sceneManager, this.assetManager, {
      itemInspector: this.itemInspector
    });

    this.gizmo = new Gizmo(
      this.renderer.camera,
      this.renderer.domElement,
      this.renderer.scene,
      this.sceneManager
    );

    this.gizmo.onDraggingChanged = (isDragging) => {
      this.orbitControls.enabled = !isDragging;
      if (isDragging) {
        this._gizmoPreDragSnapshot = this._createSceneSnapshot();
      } else {
        if (this._gizmoPreDragSnapshot) {
          this._sceneUndoStack.push(this._gizmoPreDragSnapshot);
          if (this._sceneUndoStack.length > this._maxSceneHistory) {
            this._sceneUndoStack.shift();
          }
          this._sceneRedoStack = [];
          this._gizmoPreDragSnapshot = null;
        }
        this.inspector.refresh();
      }
    };

    this.uiPanel = new UIPanel(this.rootEl, this.uiManager, this.assetManager);
    this.nodeGraphEditor = new NodeGraphEditor(this.rootEl, this.nodeRuntime, this.sceneManager, this.uiManager, this.assetManager);
    this.inspector.onOpenNodeGraph = (objId) => this.nodeGraphEditor.openForObject(objId);
    this.projectPanel = new ProjectPanel(this.projectEl, this.assetManager, this.sceneManager, {
      onRename: () => this.renameProject(),
      onOpenNodeGraphAsset: (assetId) => this.nodeGraphEditor.openForAsset(assetId)
    });

    this.exportSystem = new ExportSystem(this.sceneManager, this.assetManager, this.uiManager, this.nodeRuntime);

    this.toolbar = new Toolbar(this.toolbarEl, {
      undo: () => this.undo(),
      redo: () => this.redo(),
      duplicate: () => this.duplicateSelected(),
      deleteSelected: () => this.deleteSelected(),
      addPrimitive: (type) => this._addPrimitive(type),
      addPlayerController: () => this._addPlayerController(),
      addCamera: () => this._addCamera(),
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
      },
      onQuickSandbox: () => {
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
      this._updatePlayButtonState();
      this._scheduleAutoSave();
    });
    this.sceneManager.on('objectAdded', () => {
      this._updatePlayButtonState();
      this._scheduleAutoSave();
    });
    this.sceneManager.on('objectRemoved', () => {
      this._updatePlayButtonState();
      this._scheduleAutoSave();
    });
    this.sceneManager.on('projectAssetsChanged', () => {
      this._scheduleAutoSave();
    });

    this._setupViewportSelection();
    this._setupViewportDrop();
    this._setupViewportPointerLock();
    this._addDefaultScene();
    this._updatePlayButtonState();
  }

  _setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'KeyS' || e.key?.toLowerCase() === 's')) {
        e.preventDefault();
        this.saveProjectAs();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.code === 'KeyS' || e.key?.toLowerCase() === 's')) {
        e.preventDefault();
        this.saveProject();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyZ' || e.key?.toLowerCase() === 'z')) {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyY' || e.key?.toLowerCase() === 'y')) {
        e.preventDefault();
        this.redo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyD' || e.key?.toLowerCase() === 'd')) {
        e.preventDefault();
        this.duplicateSelected();
        return;
      }

      if (this.mode !== 'edit') {
        if (this.mode === 'play') {
          if ((e.code === 'KeyE' || e.key?.toLowerCase() === 'e') && !this.itemInspector?.isActive) {
            this.interactionSystem._tryInteract();
          }
        }
        return;
      }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'Delete':
        case 'Backspace':
          this.deleteSelected();
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
    this._pushSceneUndo();
    const obj = Primitives.createFromType(type);
    obj.position.y = (type === 'empty' || type === 'player_controller') ? 0 : 0.5;
    this.sceneManager.addObject(obj);
    this.sceneManager.selectObject(obj.userData.id);
  }

  _addPlayerController() {
    this._pushSceneUndo();
    const player = Primitives.createPlayerController();
    player.position.set(0, 0, 0);
    this.sceneManager.addObject(player);
    this.sceneManager.selectObject(player.userData.id);
    this.nodeGraphEditor._createPlayerPreset();
  }

  _addCamera() {
    this._pushSceneUndo();
    const camera = Primitives.createCamera();
    camera.position.set(0, 2, 5);
    this.sceneManager.addObject(camera);
    this.sceneManager.selectObject(camera.userData.id);
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
          this._pushSceneUndo();
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
      if (this._activePlayerObj) {
        this.nodeRuntime.update(dt);

        this._activePlayerObj.updateMatrixWorld(true);
        const childCam = this._activePlayerObj.children.find(c => (c.isCamera || c.userData?.type === 'camera') && !c.userData?.isGizmo)
          || this.sceneManager.getChildren(this._activePlayerObj.userData.id).find(c => (c.isCamera || c.userData?.type === 'camera') && !c.userData?.isGizmo);
        if (childCam) {
          childCam.updateMatrixWorld(true);
          const worldPos = new THREE.Vector3();
          const worldQuat = new THREE.Quaternion();
          childCam.getWorldPosition(worldPos);
          childCam.getWorldQuaternion(worldQuat);
          this.renderer.camera.position.copy(worldPos);
          this.renderer.camera.quaternion.copy(worldQuat);
        } else {
          const pCtrl = this._activePlayerObj.userData?.components?.playerController || this._activePlayerObj.userData?.playerController || {};
          const camY = pCtrl.cameraOffsetY !== undefined ? pCtrl.cameraOffsetY : 1.6;
          this.renderer.camera.position.copy(this._activePlayerObj.position).add(new THREE.Vector3(0, camY, 0));
          this.renderer.camera.quaternion.copy(this._activePlayerObj.quaternion);
        }
        this.renderer.camera.updateMatrixWorld(true);

        this.interactionSystem.update();

        const radius = this._activePlayerObj.userData?.playerController?.playerRadius || 0.3;
        this.collisionSystem.checkTriggers(this.renderer.camera.position, radius);
      } else if (this._activeCameraObj) {
        this.nodeRuntime.update(dt);

        this._activeCameraObj.updateMatrixWorld(true);
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        this._activeCameraObj.getWorldPosition(worldPos);
        this._activeCameraObj.getWorldQuaternion(worldQuat);
        this.renderer.camera.position.copy(worldPos);
        this.renderer.camera.quaternion.copy(worldQuat);
        this.renderer.camera.updateMatrixWorld(true);

        this.interactionSystem.update();
      }
    }
  }

  _savedCameraState = null;
  _activePlayerObj = null;
  _activeCameraObj = null;
  _savedPlayerPos = null;
  _savedPlayerRot = null;

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

    const playerObj = this.sceneManager.getAllObjects().find(o => 
      (o.userData?.type === 'player_controller' || o.userData?.components?.playerController?.enabled) && this.sceneManager.isActiveInHierarchy(o.userData.id)
    );
    const cameraObj = this.sceneManager.getAllObjects().find(o => 
      (o.userData?.type === 'camera' || o.isCamera || o.userData?.components?.camera?.enabled) && this.sceneManager.isActiveInHierarchy(o.userData.id)
    );

    if (!playerObj && !cameraObj) {
      this._showToast('Cannot Run: No Camera or Player Controller found in Hierarchy. Add one to run the scene.');
      return;
    }

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

    if (playerObj) {
      this._activePlayerObj = playerObj;
      this._savedPlayerPos = playerObj.position.clone();
      this._savedPlayerRot = playerObj.rotation.clone();

      const hasPlayerNodes = Array.from(this.nodeRuntime.nodes.values()).some(n => n.scope === 'player');
      if (!hasPlayerNodes) {
        this.nodeGraphEditor._createPlayerPreset();
      }

      playerObj.traverse(c => {
        if (c.userData?.isGizmo) c.visible = false;
      });

      this.nodeRuntime.enableInput(this.renderer.domElement);
      try {
        this.renderer.domElement.requestPointerLock?.();
      } catch (err) {}
    } else if (cameraObj) {
      this._activeCameraObj = cameraObj;
      cameraObj.traverse(c => {
        if (c.userData?.isGizmo) c.visible = false;
      });

      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      cameraObj.getWorldPosition(worldPos);
      cameraObj.getWorldQuaternion(worldQuat);
      this.renderer.camera.position.copy(worldPos);
      const camFov = cameraObj.userData?.components?.camera?.fov || cameraObj.userData?.camera?.fov;
      if (camFov) {
        this.renderer.camera.fov = camFov;
        this.renderer.camera.updateProjectionMatrix();
      }
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

    if (this._activePlayerObj) {
      this.nodeRuntime.disableInput();
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      this._activePlayerObj.traverse(c => {
        if (c.userData?.isGizmo) c.visible = true;
      });
      if (this._savedPlayerPos) {
        this._activePlayerObj.position.copy(this._savedPlayerPos);
        this._activePlayerObj.rotation.copy(this._savedPlayerRot);
        if (this._activePlayerObj.updateMatrixWorld) this._activePlayerObj.updateMatrixWorld(true);
      }
      this._activePlayerObj = null;
    } else if (this._activeCameraObj) {
      this._activeCameraObj.traverse(c => {
        if (c.userData?.isGizmo) c.visible = true;
      });
      this._activeCameraObj = null;
    }

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
    this._updatePlayButtonState();
    this.renderer.resize();
  }

  _updatePlayButtonState() {
    if (!this.toolbar) return;
    const hasCameraOrPlayer = this.sceneManager.getAllObjects().some(o => 
      (o.userData?.type === 'player_controller' || o.userData?.type === 'camera' || o.isCamera) && 
      this.sceneManager.isActiveInHierarchy(o.userData.id)
    );
    this.toolbar.setPlayEnabled(hasCameraOrPlayer);
  }

  async loadDemo(nameOrFile) {
    if (!nameOrFile) return;
    try {
      const filename = nameOrFile.endsWith('.threeint') ? nameOrFile : `${nameOrFile}.threeint`;
      const resp = await fetch(`demo/${filename}`);
      if (!resp.ok) {
        throw new Error(`Template not found: demo/${filename}`);
      }
      const blob = await resp.blob();
      const data = await this.projectFS.parseProjectPackage(blob);
      await this._loadProjectData(data);
      this._setProjectName(`Template: ${data.projectName || filename}`);
      this._showToast(`Template loaded: ${data.projectName || filename}`);
    } catch (err) {
      console.warn('Could not load template package:', err);
      this._showToast(`Could not load template: ${nameOrFile}`);
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
    this._updatePlayButtonState();
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

  _scheduleAutoSave() {
    if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = setTimeout(async () => {
      try {
        if (this.mode === 'play') return;
        const project = await this._serializeCurrentProject();
        await this.projectFS.saveLocalProject(project);
      } catch (err) {
      }
    }, 1200);
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

  _setupViewportPointerLock() {
    this.renderer.domElement.addEventListener('click', () => {
      if (this.mode === 'play') {
        if (this.itemInspector && this.itemInspector.isActive) return;
        try {
          this.renderer.domElement.requestPointerLock?.();
        } catch (e) {}
      }
    });
  }

  _createSceneSnapshot() {
    return {
      sceneData: this.sceneManager.serialize(),
      selectedId: this.sceneManager.selectedObject?.userData?.id || null
    };
  }

  _pushSceneUndo() {
    this._sceneUndoStack.push(this._createSceneSnapshot());
    if (this._sceneUndoStack.length > this._maxSceneHistory) {
      this._sceneUndoStack.shift();
    }
    this._sceneRedoStack = [];
  }

  _undoScene() {
    if (this._sceneUndoStack.length === 0) return;
    const current = this._createSceneSnapshot();
    this._sceneRedoStack.push(current);
    const prev = this._sceneUndoStack.pop();
    this.sceneManager.deserialize(prev.sceneData, this.assetManager, Primitives);
    if (prev.selectedId) {
      this.sceneManager.selectObject(prev.selectedId);
    } else {
      this.sceneManager.selectObject(null);
    }
    this.hierarchy.refresh();
    this.inspector.refresh();
    this._updatePlayButtonState();
  }

  _redoScene() {
    if (this._sceneRedoStack.length === 0) return;
    const current = this._createSceneSnapshot();
    this._sceneUndoStack.push(current);
    const next = this._sceneRedoStack.pop();
    this.sceneManager.deserialize(next.sceneData, this.assetManager, Primitives);
    if (next.selectedId) {
      this.sceneManager.selectObject(next.selectedId);
    } else {
      this.sceneManager.selectObject(null);
    }
    this.hierarchy.refresh();
    this.inspector.refresh();
    this._updatePlayButtonState();
  }

  undo() {
    if (this.uiPanel && this.uiPanel.isOpen) {
      this.uiPanel.undo();
      return;
    }
    this._undoScene();
  }

  redo() {
    if (this.uiPanel && this.uiPanel.isOpen) {
      this.uiPanel.redo();
      return;
    }
    this._redoScene();
  }

  duplicateSelected() {
    if (this.uiPanel && this.uiPanel.isOpen) {
      if (this.uiPanel._selectedElementId && !this.uiPanel._selectedElementId.startsWith('base:')) {
        this.uiPanel._pushUndo();
        const clone = this.uiManager.duplicateElement(this.uiPanel._selectedElementId);
        if (clone) {
          this.uiPanel._selectedElementId = clone.id;
          this.uiPanel._renderList();
          this.uiPanel._renderProps();
          this.uiPanel._renderPreview();
        }
      }
      return;
    }

    const selected = this.sceneManager.selectedObject;
    if (!selected) return;

    this._pushSceneUndo();
    const clone = selected.clone(true);
    clone.userData = JSON.parse(JSON.stringify(selected.userData || {}));
    clone.userData.id = crypto.randomUUID();
    clone.userData.name = (clone.userData.name || 'Object') + '_Copy';
    clone.name = clone.userData.name;
    clone.position.x += 1;
    clone.position.z += 1;
    this.sceneManager.addObject(clone);
    this.sceneManager.selectObject(clone.userData.id);
  }

  deleteSelected() {
    if (this.uiPanel && this.uiPanel.isOpen) {
      if (this.uiPanel._selectedElementId && !this.uiPanel._selectedElementId.startsWith('base:')) {
        this.uiPanel._pushUndo();
        this.uiManager.removeElement(this.uiPanel._selectedElementId);
        this.uiPanel._selectedElementId = 'base:crosshair';
        this.uiPanel._renderList();
        this.uiPanel._renderProps();
        this.uiPanel._renderPreview();
      }
      return;
    }

    const selected = this.sceneManager.selectedObject;
    if (selected && selected.userData?.id) {
      this._pushSceneUndo();
      this.sceneManager.removeObject(selected.userData.id);
    }
  }
}

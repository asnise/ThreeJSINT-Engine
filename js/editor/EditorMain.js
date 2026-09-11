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

export class EditorMain {
  constructor(rootEl) {
    this.rootEl = rootEl;
    this.mode = 'edit';
    this.maximizeOnPlay = false;

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
    this.itemInspector = new ItemInspector();

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
      this.itemInspector
    );

    this.orbitControls = new OrbitControls(this.renderer.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = false;
    this.orbitControls.target.set(0, 1, 0);
    this.orbitControls.update();

    this.uiManager = new UIManager();
    this.uiManager.mount(this.viewportEl);

    this.nodeRuntime = new NodeGraphRuntime(this.sceneManager, this.uiManager);

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
    this.hierarchy = new Hierarchy(this.hierarchyEl, this.sceneManager);
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
    this.projectPanel = new ProjectPanel(this.projectEl, this.assetManager, this.sceneManager);

    this.exportSystem = new ExportSystem(this.sceneManager, this.assetManager, this.uiManager, this.nodeRuntime);

    this.toolbar = new Toolbar(this.toolbarEl, {
      addPrimitive: (type) => this._addPrimitive(type),
      importMesh: () => this._importMesh(),
      importTexture: () => this._importTexture(),
      setGizmoMode: (mode) => this.gizmo.setMode(mode),
      play: () => this.play(),
      stop: () => this.stop(),
      exportHTML: () => this.exportSystem.exportHTML(),
      saveProject: () => this.saveProject(),
      openProject: () => this.openProject(),
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
    });

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
      if (this.mode !== 'edit') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'Delete':
          if (this.sceneManager.selectedObject) {
            this.sceneManager.removeObject(this.sceneManager.selectedObject.userData.id);
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
      this.sceneManager.deserialize(data, this.assetManager, Primitives);
      if (data.uiData) {
        this.uiManager.deserialize(data.uiData);
      } else {
        this.uiManager.clearCustom();
      }
      if (data.nodeGraphData) {
        this.nodeRuntime.deserialize(data.nodeGraphData);
      } else {
        this.nodeRuntime.deserialize({ nodes: [], connections: [], variables: {} });
      }
      this.hierarchy.refresh();
      this.inspector.refresh();
      this.projectPanel.refresh();
      if (this.collisionSystem.isDebugVisible) {
        this.collisionSystem.updateDebugVisuals();
      }
    } catch (err) {
      console.warn('Could not load demo:', err);
    }
  }

  async saveProject() {
    const sceneData = this.sceneManager.serialize();
    const assetsData = await this.assetManager.serializeAssets();
    const uiData = this.uiManager.serialize();
    const nodeGraphData = this.nodeRuntime.serialize();
    const project = {
      format: 'ThreeInteractEngine',
      version: 1,
      createdAt: new Date().toISOString(),
      scene: sceneData,
      assets: assetsData,
      uiData: uiData,
      nodeGraphData: nodeGraphData
    };

    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async openProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);

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
      } catch (err) {
        console.error('Failed to open project:', err);
        alert('Failed to load project file: ' + err.message);
      }
    });
    input.click();
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
        if (topObj && topObj.userData?.material) {
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

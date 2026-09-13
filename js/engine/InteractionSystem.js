import * as THREE from 'three';

export class InteractionSystem {
  //#region [Variables/Fields]
  camera;
  sceneManager;
  fpsController;
  mobileControls;
  itemInspector;
  container;
  enabled = false;
  interactRange = 3.5;
  currentTarget = null;
  isInteracting = false;
  promptEl = null;
  crosshairEl = null;
  onObjectInteracted = null;
  _raycaster = new THREE.Raycaster();
  _screenCenter = new THREE.Vector2(0, 0);
  _boundKeyDown = null;
  //#endregion

  //#region [Properties]
  get activeTarget() {
    return this.currentTarget;
  }
  //#endregion

  //#region [Public Methods]
  constructor(camera, sceneManager, fpsController, mobileControls, itemInspector, container = document.body) {
    this.camera = camera;
    this.sceneManager = sceneManager;
    this.fpsController = fpsController;
    this.mobileControls = mobileControls;
    this.itemInspector = itemInspector;
    this.container = container || document.body;

    this._createUI();

    this._boundKeyDown = (e) => this._onKeyDown(e);

    if (this.fpsController) {
      this.fpsController.onInteractKeyPress = () => this._tryInteract();
    }

    if (this.mobileControls) {
      this.mobileControls.onInteract = () => this._tryInteract();
    }
  }

  setCamera(camera) {
    this.camera = camera;
  }

  enable() {
    this.enabled = true;
    this.currentTarget = null;
    this.isInteracting = false;
    if (this.crosshairEl) this.crosshairEl.style.display = 'block';
    window.addEventListener('keydown', this._boundKeyDown);
  }

  disable() {
    this.enabled = false;
    this.currentTarget = null;
    this.isInteracting = false;
    if (this.promptEl) this.promptEl.style.display = 'none';
    if (this.crosshairEl) this.crosshairEl.style.display = 'none';
    if (this.mobileControls) {
      this.mobileControls.hideInteractButton();
    }
    window.removeEventListener('keydown', this._boundKeyDown);
  }

  tryInteract() {
    return this._tryInteract();
  }

  update() {
    if (!this.enabled || this.isInteracting || !this.camera) return;

    this._raycaster.setFromCamera(this._screenCenter, this.camera);

    const interactables = this.sceneManager.getInteractableObjects();
    const meshes = [];
    for (const obj of interactables) {
      if (obj.isMesh) {
        meshes.push(obj);
      } else {
        obj.traverse(c => { if (c.isMesh) meshes.push(c); });
      }
    }

    const intersects = this._raycaster.intersectObjects(meshes, false);
    let found = null;

    for (const hit of intersects) {
      let target = hit.object;
      while (target && !(target.userData?.components?.interaction?.enabled || target.userData?.interaction?.enabled)) {
        if (target.parent && target.parent !== this.sceneManager.scene) {
          target = target.parent;
        } else {
          target = null;
          break;
        }
      }
      if (target) {
        const inter = target.userData?.components?.interaction || target.userData?.interaction || {};
        const maxDist = inter.maxDistance !== undefined ? inter.maxDistance : this.interactRange;
        if (hit.distance <= maxDist) {
          found = target;
          break;
        }
      }
    }

    if (found !== this.currentTarget) {
      this.currentTarget = found;
      if (found) {
        const inter = found.userData?.components?.interaction || found.userData?.interaction || {};
        const text = inter.promptText || 'Press E to interact';
        this.promptEl.textContent = text;
        this.promptEl.style.display = 'block';
        if (this.mobileControls?.isMobile) {
          this.mobileControls.showInteractButton('E');
        }
      } else {
        this.promptEl.style.display = 'none';
        if (this.mobileControls) {
          this.mobileControls.hideInteractButton();
        }
      }
    }
  }
  //#endregion

  //#region [Private Methods]
  _createUI() {
    this.promptEl = document.createElement('div');
    this.promptEl.className = 'interact-prompt';
    this.container.appendChild(this.promptEl);

    this.crosshairEl = document.createElement('div');
    this.crosshairEl.className = 'crosshair';
    this.container.appendChild(this.crosshairEl);
  }

  _onKeyDown(e) {
    if (!this.enabled || this.isInteracting) return;
    if (e.code === 'KeyE' || e.key?.toLowerCase() === 'e') {
      this._tryInteract();
    }
  }

  _tryInteract() {
    if (!this.enabled || !this.currentTarget || this.isInteracting) return;

    const interaction = this.currentTarget.userData?.components?.interaction || this.currentTarget.userData?.interaction;
    if (!interaction?.enabled) return;

    if (this.onObjectInteracted) {
      this.onObjectInteracted(this.currentTarget);
    }

    if (interaction.type === 'inspect') {
      this._startInspect(this.currentTarget);
    }
  }

  _startInspect(target) {
    this.isInteracting = true;
    if (this.promptEl) this.promptEl.style.display = 'none';
    if (this.crosshairEl) this.crosshairEl.style.display = 'none';

    if (this.mobileControls) {
      this.mobileControls.hideInteractButton();
    }

    if (document.pointerLockElement) {
      try { document.exitPointerLock(); } catch (err) {}
    }
    if (this.fpsController) {
      this.fpsController.setLockState('None');
    }

    this.itemInspector.inspect(target);
    this.itemInspector.onClose = () => {
      this.isInteracting = false;
      if (this.enabled) {
        if (this.crosshairEl) this.crosshairEl.style.display = 'block';
        const lockTarget = this.container?.querySelector?.('canvas') || this.container;
        if (lockTarget && lockTarget.requestPointerLock) {
          try { lockTarget.requestPointerLock(); } catch (err) {}
        } else if (this.fpsController) {
          this.fpsController.setLockState('Locked');
        }
      }
    };
  }
  //#endregion
}

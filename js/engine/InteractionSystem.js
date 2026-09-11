import * as THREE from 'three';

export class InteractionSystem {
  constructor(camera, sceneManager, fpsController, mobileControls, itemInspector, container = document.body) {
    this.camera = camera;
    this.sceneManager = sceneManager;
    this.fpsController = fpsController;
    this.mobileControls = mobileControls;
    this.itemInspector = itemInspector;
    this.container = container || document.body;

    this.enabled = false;
    this.interactRange = 3;
    this.currentTarget = null;
    this.isInteracting = false;

    this._raycaster = new THREE.Raycaster();
    this._screenCenter = new THREE.Vector2(0, 0);

    this.promptEl = null;
    this.crosshairEl = null;
    this._createUI();

    this.fpsController.onInteractKeyPress = () => this._tryInteract();

    if (this.mobileControls) {
      this.mobileControls.onInteract = () => this._tryInteract();
    }
  }

  _createUI() {
    this.promptEl = document.createElement('div');
    this.promptEl.className = 'interact-prompt';
    this.container.appendChild(this.promptEl);

    this.crosshairEl = document.createElement('div');
    this.crosshairEl.className = 'crosshair';
    this.container.appendChild(this.crosshairEl);
  }


  enable() {
    this.enabled = true;
    this.currentTarget = null;
    this.isInteracting = false;
    this.crosshairEl.style.display = 'block';
  }

  disable() {
    this.enabled = false;
    this.currentTarget = null;
    this.isInteracting = false;
    this.promptEl.style.display = 'none';
    this.crosshairEl.style.display = 'none';
    if (this.mobileControls) {
      this.mobileControls.hideInteractButton();
    }
  }

  update() {
    if (!this.enabled || this.isInteracting) return;

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
      if (hit.distance > this.interactRange) continue;

      let target = hit.object;
      while (target && !target.userData?.interaction?.enabled) {
        target = target.parent;
      }
      if (target && target.userData?.interaction?.enabled) {
        found = target;
        break;
      }
    }

    if (found !== this.currentTarget) {
      this.currentTarget = found;
      if (found) {
        const text = found.userData.interaction.promptText || 'Press E to interact';
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

  _tryInteract() {
    if (!this.enabled || !this.currentTarget || this.isInteracting) return;

    const interaction = this.currentTarget.userData?.interaction;
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
    this.promptEl.style.display = 'none';
    this.crosshairEl.style.display = 'none';

    if (this.mobileControls) {
      this.mobileControls.hideInteractButton();
    }

    this.fpsController.setLockState('None');

    this.itemInspector.inspect(target);
    this.itemInspector.onClose = () => {
      this.isInteracting = false;
      this.crosshairEl.style.display = 'block';
      this.fpsController.setLockState('Locked');
    };
  }
}

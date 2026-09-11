import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export class Gizmo {
  constructor(camera, rendererDom, scene, sceneManager) {
    this.scene = scene;
    this.sceneManager = sceneManager;
    this.controls = new TransformControls(camera, rendererDom);
    this.controls.size = 0.8;
    scene.add(this.controls.getHelper());

    this._enabled = true;
    this._currentTarget = null;
    this._boxHelper = null;

    this.controls.addEventListener('dragging-changed', (event) => {
      if (this.onDraggingChanged) {
        this.onDraggingChanged(event.value);
      }
      if (this._boxHelper) this._boxHelper.update();
    });

    this.controls.addEventListener('change', () => {
      if (this._boxHelper) this._boxHelper.update();
    });

    this.sceneManager.on('objectSelected', (obj) => {
      if (obj && this._enabled) {
        this.attach(obj);
      } else {
        this.detach();
      }
    });

    this.sceneManager.on('sceneChanged', () => {
      if (this._boxHelper) this._boxHelper.update();
    });
  }

  setMode(mode) {
    this.controls.setMode(mode);
  }

  attach(obj) {
    this._currentTarget = obj;
    this.controls.attach(obj);

    if (this._boxHelper) {
      this.scene.remove(this._boxHelper);
      this._boxHelper.dispose?.();
    }
    this._boxHelper = new THREE.BoxHelper(obj, 0x00b4d8);
    this._boxHelper.material.depthTest = false;
    this._boxHelper.material.transparent = true;
    this._boxHelper.material.opacity = 0.9;
    this.scene.add(this._boxHelper);
  }

  detach() {
    this._currentTarget = null;
    this.controls.detach();
    if (this._boxHelper) {
      this.scene.remove(this._boxHelper);
      this._boxHelper.dispose?.();
      this._boxHelper = null;
    }
  }

  enable() {
    this._enabled = true;
    this.controls.enabled = true;
    const sel = this.sceneManager.selectedObject;
    if (sel) this.attach(sel);
  }

  disable() {
    this._enabled = false;
    this.controls.enabled = false;
    this.detach();
  }

  onDraggingChanged = null;
}

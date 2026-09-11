import * as THREE from 'three';

export class Renderer {
  constructor(container) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.shadowMap.enabled = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xcceeff, 0x444444, 0.7);
    hemi.position.set(0, 20, 0);
    this.scene.add(hemi);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 500);
    this.camera.position.set(0, 5, 10);

    this._clock = new THREE.Clock();
    this._animationId = null;
    this._updateCallbacks = [];

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  onUpdate(cb) {
    this._updateCallbacks.push(cb);
  }

  removeUpdate(cb) {
    this._updateCallbacks = this._updateCallbacks.filter(c => c !== cb);
  }

  start() {
    if (this._animationId) return;
    this._clock.start();
    const loop = () => {
      this._animationId = requestAnimationFrame(loop);
      const dt = Math.min(this._clock.getDelta(), 0.1);
      for (const cb of this._updateCallbacks) cb(dt);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  stop() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  get canvas() { return this.renderer.domElement; }
  get domElement() { return this.renderer.domElement; }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}

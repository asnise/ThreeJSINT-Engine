import * as THREE from 'three';

export class ItemInspector {
  constructor(container = document.body) {
    this.container = container || document.body;
    this.isActive = false;
    this.onClose = null;
    this._inspectedClone = null;
    this._isDragging = false;
    this._prevMouse = { x: 0, y: 0 };
    this._animFrame = null;

    this._scene = new THREE.Scene();

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this._scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(3, 4, 5);
    this._scene.add(dir);

    const fill = new THREE.DirectionalLight(0xaaccff, 0.3);
    fill.position.set(-2, 1, -3);
    this._scene.add(fill);

    this._camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    this._camera.position.set(0, 0, 3);

    this._createDOM();
    this._bindEvents();
  }

  mount(container) {
    if (!container || container === this.container) return;
    this.container = container;
    if (this.overlay && this.overlay.parentElement !== this.container) {
      this.container.appendChild(this.overlay);
    }
    if (this.isActive) this._resize();
  }

  _createDOM() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'inspect-overlay';
    this.overlay.style.display = 'none';

    this._canvas = document.createElement('canvas');
    this.overlay.appendChild(this._canvas);

    this._renderer = new THREE.WebGLRenderer({
      canvas: this._canvas,
      alpha: true,
      antialias: true
    });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.outputColorSpace = THREE.SRGBColorSpace;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'inspect-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.close());
    this.overlay.appendChild(closeBtn);

    const hint = document.createElement('div');
    hint.className = 'inspect-hint';
    hint.textContent = 'Drag to rotate · ESC to close';
    this.overlay.appendChild(hint);

    this.container.appendChild(this.overlay);
  }


  _bindEvents() {
    this.overlay.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (e.target.closest('.inspect-close')) return;
      this._isDragging = true;
      this._prevMouse = { x: e.clientX, y: e.clientY };
    });

    this.overlay.addEventListener('mousemove', (e) => {
      if (!this._isDragging || !this._inspectedClone) return;
      const dx = e.clientX - this._prevMouse.x;
      const dy = e.clientY - this._prevMouse.y;
      this._inspectedClone.rotation.y += dx * 0.008;
      this._inspectedClone.rotation.x += dy * 0.008;
      this._prevMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => { this._isDragging = false; });

    this.overlay.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      if (e.target.closest('.inspect-close')) return;
      if (e.touches.length === 1) {
        this._isDragging = true;
        this._prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: false });

    this.overlay.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this._isDragging || !this._inspectedClone || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this._prevMouse.x;
      const dy = e.touches[0].clientY - this._prevMouse.y;
      this._inspectedClone.rotation.y += dx * 0.008;
      this._inspectedClone.rotation.x += dy * 0.008;
      this._prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: false });

    this.overlay.addEventListener('touchend', () => { this._isDragging = false; });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isActive) {
        e.preventDefault();
        this.close();
      }
    });

    window.addEventListener('resize', () => {
      if (this.isActive) this._resize();
    });
  }

  inspect(sourceObject) {
    if (!sourceObject) return;
    const clone = sourceObject.clone(true);

    clone.traverse(child => {
      if (child.userData?.isGizmo || child.name?.includes('Gizmo') || child.name?.includes('Helper')) {
        child.visible = false;
      }
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
      }
    });

    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    clone.position.sub(center);

    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.5);
    this._camera.position.set(0, 0, maxDim * 2.2);
    this._camera.lookAt(0, 0, 0);

    this._clearInspectedClone();
    this._scene.add(clone);
    this._inspectedClone = clone;

    this.overlay.style.display = 'flex';
    this.isActive = true;
    this._resize();
    this._animate();
  }

  close() {
    this.overlay.style.display = 'none';
    this.isActive = false;
    this._clearInspectedClone();
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
    if (this.onClose) {
      const cb = this.onClose;
      this.onClose = null;
      cb();
    }
  }

  _clearInspectedClone() {
    if (this._inspectedClone) {
      this._scene.remove(this._inspectedClone);
      this._inspectedClone = null;
    }
  }

  _resize() {
    const target = this.container || document.body;
    const rect = target.getBoundingClientRect ? target.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
    const baseW = rect.width || window.innerWidth;
    const baseH = rect.height || window.innerHeight;
    const w = Math.max(100, Math.floor(baseW * 0.75));
    const h = Math.max(100, Math.floor(baseH * 0.75));
    this._renderer.setSize(w, h);
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
  }


  _animate() {
    if (!this.isActive) return;
    this._animFrame = requestAnimationFrame(() => this._animate());
    this._renderer.render(this._scene, this._camera);
  }
}

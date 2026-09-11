export class Toolbar {
  constructor(container, callbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this._activeMode = 'translate';
    this._isPlaying = false;

    this._build();
  }

  _build() {
    this.container.innerHTML = '';

    this.leftSection = document.createElement('div');
    this.leftSection.className = 'toolbar-left';

    this.centerSection = document.createElement('div');
    this.centerSection.className = 'toolbar-center';

    this.rightSection = document.createElement('div');
    this.rightSection.className = 'toolbar-right';

    this.container.appendChild(this.leftSection);
    this.container.appendChild(this.centerSection);
    this.container.appendChild(this.rightSection);

    this._addDropdown('File', [
      { label: 'Save Project', action: () => this.callbacks.saveProject() },
      { label: 'Open Project', action: () => this.callbacks.openProject() },
      { label: 'Demo: Treasure Room', action: () => this.callbacks.loadDemo('treasure-room') },
      { label: 'Export Standalone HTML', action: () => this.callbacks.exportHTML() },
    ], false);

    this._addSeparator();

    this._addDropdown('Add', [
      { label: 'Cube', action: () => this.callbacks.addPrimitive('cube') },
      { label: 'Sphere', action: () => this.callbacks.addPrimitive('sphere') },
      { label: 'Plane', action: () => this.callbacks.addPrimitive('plane') },
      { label: 'Cylinder', action: () => this.callbacks.addPrimitive('cylinder') },
    ], true);

    this._addSeparator();

    this._addButton('Import Mesh', () => this.callbacks.importMesh());
    this._addButton('Import Texture', () => this.callbacks.importTexture());

    this._addSeparator();

    this._translateBtn = this._addButton('W Move', () => this._setMode('translate'), true);
    this._rotateBtn = this._addButton('E Rotate', () => this._setMode('rotate'));
    this._scaleBtn = this._addButton('R Scale', () => this._setMode('scale'));

    this._addSeparator();

    this._collidersBtn = this._addButton('Colliders', () => {
      const active = this.callbacks.toggleColliders();
      this._collidersBtn.classList.toggle('active', active);
    });

    this._addButton('UI Layout', () => this.callbacks.openUIPanel());
    this._addButton('Node Graph', () => this.callbacks.openNodeGraph());

    // Center Play Bar (Unity-Style)
    this.centerBar = document.createElement('div');
    this.centerBar.className = 'toolbar-center-play-bar';

    this._playBtn = document.createElement('button');
    this._playBtn.className = 'toolbar-btn play-btn';
    this._playBtn.textContent = '▶ Play';
    this._playBtn.style.padding = '2px 14px';
    this._playBtn.style.fontWeight = 'bold';
    this._playBtn.addEventListener('click', () => this.callbacks.play());
    this.centerBar.appendChild(this._playBtn);

    this._stopBtn = document.createElement('button');
    this._stopBtn.className = 'toolbar-btn stop-btn';
    this._stopBtn.textContent = '■ Stop';
    this._stopBtn.style.padding = '2px 14px';
    this._stopBtn.style.fontWeight = 'bold';
    this._stopBtn.style.display = 'none';
    this._stopBtn.addEventListener('click', () => this.callbacks.stop());
    this.centerBar.appendChild(this._stopBtn);

    const maxLbl = document.createElement('label');
    maxLbl.className = 'toolbar-maximize-label';
    const maxChk = document.createElement('input');
    maxChk.type = 'checkbox';
    maxChk.style.cursor = 'pointer';
    maxChk.addEventListener('change', () => {
      if (this.callbacks.toggleMaximize) {
        this.callbacks.toggleMaximize(maxChk.checked);
      }
    });
    maxLbl.appendChild(maxChk);
    maxLbl.appendChild(document.createTextNode('Maximize'));
    this.centerBar.appendChild(maxLbl);

    this.centerSection.appendChild(this.centerBar);

    // Right Section
    this._playHint = document.createElement('span');
    this._playHint.style.fontSize = '11px';
    this._playHint.style.color = 'var(--text-muted)';
    this._playHint.style.marginRight = '8px';
    this._playHint.style.display = 'none';
    this._playHint.textContent = 'Click to lock cursor · ESC to unlock';
    this.rightSection.appendChild(this._playHint);
  }

  _addButton(text, onClick, active = false, extraClass = '') {
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn';
    if (active) btn.classList.add('active');
    if (extraClass) btn.classList.add(extraClass);
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    this.leftSection.appendChild(btn);
    return btn;
  }

  _addSeparator() {
    const sep = document.createElement('div');
    sep.className = 'toolbar-separator';
    this.leftSection.appendChild(sep);
  }

  _addDropdown(label, items, showPlus = false) {
    const wrapper = document.createElement('div');
    wrapper.className = 'toolbar-dropdown';

    const btn = document.createElement('button');
    btn.className = 'toolbar-btn';
    btn.textContent = (showPlus ? '+ ' : '') + label;
    wrapper.appendChild(btn);

    const menu = document.createElement('div');
    menu.className = 'toolbar-dropdown-menu';

    items.forEach(item => {
      const menuBtn = document.createElement('button');
      menuBtn.className = 'toolbar-dropdown-item';
      menuBtn.textContent = item.label;
      menuBtn.addEventListener('click', () => {
        item.action();
        menu.classList.remove('open');
      });
      menu.appendChild(menuBtn);
    });

    wrapper.appendChild(menu);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = menu.classList.contains('open');
      document.querySelectorAll('.toolbar-dropdown-menu.open').forEach(m => m.classList.remove('open'));
      if (!wasOpen) menu.classList.add('open');
    });

    document.addEventListener('click', () => {
      menu.classList.remove('open');
    });

    this.leftSection.appendChild(wrapper);
  }

  _setMode(mode) {
    this._activeMode = mode;
    this._translateBtn.classList.toggle('active', mode === 'translate');
    this._rotateBtn.classList.toggle('active', mode === 'rotate');
    this._scaleBtn.classList.toggle('active', mode === 'scale');
    if (this.callbacks.setGizmoMode) this.callbacks.setGizmoMode(mode);
  }

  setPlayMode(isPlaying) {
    this._isPlaying = isPlaying;
    this._playBtn.style.display = isPlaying ? 'none' : '';
    this._stopBtn.style.display = isPlaying ? '' : 'none';
    this._playHint.style.display = isPlaying ? '' : 'none';
    this.leftSection.style.opacity = isPlaying ? '0.4' : '';
    this.leftSection.style.pointerEvents = isPlaying ? 'none' : '';
  }

  get activeMode() { return this._activeMode; }
}

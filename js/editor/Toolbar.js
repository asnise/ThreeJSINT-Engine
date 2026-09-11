export class Toolbar {
  //#region [Properties]
  get isMaximized() {
    return this._isMaximized;
  }

  get activeMode() {
    return this._activeMode;
  }
  //#endregion

  //#region [Constructor]
  constructor(container, callbacks, viewportEl = null) {
    this.container = container;
    this.callbacks = callbacks;
    this.viewportEl = viewportEl;
    this._activeMode = 'translate';
    this._isPlaying = false;
    this._isMaximized = false;

    this._build();
  }
  //#endregion

  //#region [Public Methods]
  setProjectName(name) {
    if (this._projectNameEl) {
      const nameSpan = this._projectNameEl.querySelector('.project-badge-name');
      if (nameSpan) {
        nameSpan.textContent = name || 'Untitled';
      } else {
        this._projectNameEl.textContent = `Project: ${name || 'Untitled'}`;
      }
    }
  }

  setPlayMode(isPlaying) {
    this._isPlaying = isPlaying;
    this._playBtn.style.display = isPlaying ? 'none' : '';
    this._stopBtn.style.display = isPlaying ? '' : 'none';
    this._playHint.style.display = isPlaying ? '' : 'none';
    this.leftSection.style.opacity = isPlaying ? '0.4' : '';
    this.leftSection.style.pointerEvents = isPlaying ? 'none' : '';
  }

  setMaximize(val) {
    this._isMaximized = Boolean(val);
    if (this._maximizeBtn) {
      this._maximizeBtn.classList.toggle('active', this._isMaximized);
    }
  }
  //#endregion

  //#region [Private Methods]
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
      { label: 'Save Project (Ctrl+S)', action: () => this.callbacks.saveProject() },
      { label: 'Save Project As (.threeint)...', action: () => this.callbacks.saveProjectAs() },
      { label: 'Open Project (.threeint / .json)...', action: () => this.callbacks.openProjectFile() },
      { label: 'Project Launcher...', action: () => this.callbacks.openLauncher() },
      { label: 'Export Deployable Package (.zip)', action: () => this.callbacks.exportZip() },
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

    this.centerBar = document.createElement('div');
    this.centerBar.className = 'viewport-play-bar';

    this._playBtn = document.createElement('button');
    this._playBtn.className = 'viewport-play-btn play-btn';
    this._playBtn.title = 'Play Scene';
    this._playBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Play</span>';
    this._playBtn.addEventListener('click', () => this.callbacks.play());
    this.centerBar.appendChild(this._playBtn);

    this._stopBtn = document.createElement('button');
    this._stopBtn.className = 'viewport-play-btn stop-btn';
    this._stopBtn.title = 'Stop Scene';
    this._stopBtn.style.display = 'none';
    this._stopBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg><span>Stop</span>';
    this._stopBtn.addEventListener('click', () => this.callbacks.stop());
    this.centerBar.appendChild(this._stopBtn);

    const separator = document.createElement('div');
    separator.className = 'viewport-play-separator';
    this.centerBar.appendChild(separator);

    this._maximizeBtn = document.createElement('button');
    this._maximizeBtn.type = 'button';
    this._maximizeBtn.className = 'viewport-tab-toggle';
    this._maximizeBtn.title = 'Maximize on Play';
    this._maximizeBtn.innerHTML = '<span class="tab-toggle-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg></span><span>Maximize</span>';
    this._maximizeBtn.addEventListener('click', () => {
      this._isMaximized = !this._isMaximized;
      this._maximizeBtn.classList.toggle('active', this._isMaximized);
      if (this.callbacks.toggleMaximize) {
        this.callbacks.toggleMaximize(this._isMaximized);
      }
    });
    this.centerBar.appendChild(this._maximizeBtn);

    if (this.viewportEl) {
      this.viewportEl.appendChild(this.centerBar);
    } else {
      this.centerSection.appendChild(this.centerBar);
    }

    this._playHint = document.createElement('span');
    this._playHint.style.fontSize = '11px';
    this._playHint.style.color = 'var(--text-muted)';
    this._playHint.style.marginRight = '8px';
    this._playHint.style.display = 'none';
    this._playHint.textContent = 'Click to lock cursor · ESC to unlock';
    this.rightSection.appendChild(this._playHint);

    this._projectNameEl = document.createElement('button');
    this._projectNameEl.type = 'button';
    this._projectNameEl.className = 'toolbar-project-badge';
    this._projectNameEl.title = 'Active Project (Click to rename / save as)';
    this._projectNameEl.innerHTML = `
      <span class="project-badge-label">Project</span>
      <span class="project-badge-name">Untitled</span>
      <svg class="project-badge-edit" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    `;
    this._projectNameEl.addEventListener('click', () => {
      if (this.callbacks.renameProject) {
        this.callbacks.renameProject();
      }
    });
    this.rightSection.appendChild(this._projectNameEl);
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
  //#endregion
}


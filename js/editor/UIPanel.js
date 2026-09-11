export class UIPanel {
  //#region [Variables/Fields]
  container = null;
  uiManager = null;
  assetManager = null;
  isOpen = false;
  _selectedElementId = null;
  _showGuides = true;
  _showAnchors = true;
  _previewScale = 1;
  _userZoom = 1;
  _activePreset = '1280x720';
  _screenW = 1280;
  _screenH = 720;
  _searchTerm = '';
  _resizeObserver = null;
  _isDragging = false;
  _isResizing = false;
  _resizeHandle = null;
  _tooltipEl = null;
  _panX = 0;
  _panY = 0;
  _isCanvasPanning = false;
  _spacePressed = false;
  _zoomLabel = null;
  //#endregion

  //#region [Properties]
  get selectedElement() {
    if (!this._selectedElementId) return null;
    if (this._selectedElementId.startsWith('base:')) {
      return this.uiManager.baseUI[this._selectedElementId.replace('base:', '')] || null;
    }
    return this.uiManager.getElement(this._selectedElementId);
  }
  //#endregion

  //#region [Unity Methods]
  constructor(container, uiManager, assetManager) {
    this.container = container;
    this.uiManager = uiManager;
    this.assetManager = assetManager;
    this._build();
  }
  //#endregion

  //#region [Public Methods]
  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    this.overlay.style.display = 'flex';
    this._panX = 0;
    this._panY = 0;
    this._userZoom = 1;
    const all = this.uiManager.getAllElements();
    if (!this._selectedElementId) {
      if (all.length > 0) this._selectedElementId = all[0].id;
      else this._selectedElementId = 'base:crosshair';
    }
    this._renderList();
    this._renderProps();
    setTimeout(() => {
      this._updatePreviewScale();
      this._renderPreview();
    }, 40);
  }

  close() {
    this.isOpen = false;
    this.overlay.style.display = 'none';
  }
  //#endregion

  //#region [Private Methods]
  _getIconSvg(type) {
    switch (type) {
      case 'crosshair':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>`;
      case 'prompt':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
      case 'joystick':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`;
      case 'label':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`;
      case 'button':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M8 12h8"/></svg>`;
      case 'progressbar':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="10" rx="3"/><line x1="6" y1="12" x2="14" y2="12"/></svg>`;
      case 'panel':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/></svg>`;
      case 'image':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
      case 'eye-on':
        return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
      case 'eye-off':
        return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 3 18 18M10.5 10.6a3 3 0 0 0 4.2 4.2M9.9 4.2A10.8 10.8 0 0 1 12 4c7 0 10 7 10 7a13.1 13.1 0 0 1-4.2 4.8M2 12s3-7 10-7c1.3 0 2.5.3 3.6.8"/></svg>`;
      case 'lock-on':
        return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
      case 'lock-off':
        return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;
      case 'arrow-up':
        return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`;
      case 'arrow-down':
        return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
      case 'delete':
        return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
      case 'duplicate':
        return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="13" height="13" x="9" y="9" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      case 'search':
        return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
      default:
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
    }
  }

  _build() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'ui-editor-modal';
    this.overlay.style.display = 'none';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') {
        this.close();
        return;
      }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
        e.preventDefault();
        if (this._selectedElementId && !this._selectedElementId.startsWith('base:')) {
          const clone = this.uiManager.duplicateElement(this._selectedElementId);
          if (clone) {
            this._selectedElementId = clone.id;
            this._renderList();
            this._renderProps();
            this._renderPreview();
          }
        }
        return;
      }

      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (this._selectedElementId && !this._selectedElementId.startsWith('base:')) {
          this.uiManager.removeElement(this._selectedElementId);
          this._selectedElementId = 'base:crosshair';
          this._renderList();
          this._renderProps();
          this._renderPreview();
        }
        return;
      }

      const step = e.shiftKey ? 10 : 1;
      let handled = false;
      let dScreenX = 0;
      let dScreenY = 0;

      if (e.code === 'ArrowLeft') { dScreenX = -step; handled = true; }
      else if (e.code === 'ArrowRight') { dScreenX = step; handled = true; }
      else if (e.code === 'ArrowUp') { dScreenY = -step; handled = true; }
      else if (e.code === 'ArrowDown') { dScreenY = step; handled = true; }

      if (handled && this._selectedElementId) {
        e.preventDefault();
        const target = this._selectedElementId.startsWith('base:')
          ? this.uiManager.baseUI[this._selectedElementId.replace('base:', '')]
          : this.uiManager.getElement(this._selectedElementId);

        if (target && !target.locked) {
          const anchor = target.anchor || 'top-left';
          const curOx = target.offsetX || 0;
          const curOy = target.offsetY || 0;

          const newOx = anchor.includes('right') ? curOx - dScreenX : curOx + dScreenX;
          const newOy = anchor.includes('bottom') ? curOy - dScreenY : curOy + dScreenY;

          if (this._selectedElementId.startsWith('base:')) {
            this.uiManager.updateBaseUI(this._selectedElementId.replace('base:', ''), {
              offsetX: newOx,
              offsetY: newOy
            });
          } else {
            this.uiManager.updateElement(target.id, {
              offsetX: newOx,
              offsetY: newOy
            });
          }
          this._renderProps();
          this._renderPreview();
        }
      }
    });

    this.panel = document.createElement('div');
    this.panel.className = 'ui-editor-window';
    this.overlay.appendChild(this.panel);

    const header = document.createElement('div');
    header.className = 'ui-editor-header';

    const titleGroup = document.createElement('div');
    titleGroup.style.display = 'flex';
    titleGroup.style.alignItems = 'center';
    titleGroup.style.gap = '10px';
    titleGroup.innerHTML = `<span class="ui-editor-title">UI & HUD Layout Editor</span><span class="ui-editor-subtitle">(Canvas Designer)</span>`;
    header.appendChild(titleGroup);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ui-editor-close-btn';
    closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    closeBtn.title = 'Close Editor (Esc)';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);

    this.panel.appendChild(header);

    const body = document.createElement('div');
    body.className = 'ui-editor-body';
    this.panel.appendChild(body);

    const leftCol = document.createElement('div');
    leftCol.className = 'ui-editor-sidebar';

    const addActions = document.createElement('div');
    addActions.className = 'ui-editor-add-actions';

    const elementTypes = [
      { type: 'label', label: 'Text' },
      { type: 'button', label: 'Button' },
      { type: 'progressbar', label: 'Bar' },
      { type: 'panel', label: 'Panel' },
      { type: 'image', label: 'Image' }
    ];

    elementTypes.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'btn-add-ui';
      btn.innerHTML = `${this._getIconSvg(t.type)}<span>+ ${t.label}</span>`;
      btn.addEventListener('click', () => {
        const el = this.uiManager.addElement(t.type);
        this._selectedElementId = el.id;
        this._renderList();
        this._renderProps();
        this._renderPreview();
      });
      addActions.appendChild(btn);
    });

    leftCol.appendChild(addActions);

    const searchWrap = document.createElement('div');
    searchWrap.className = 'ui-editor-search-wrap';

    const searchIcon = document.createElement('span');
    searchIcon.className = 'ui-editor-search-icon';
    searchIcon.innerHTML = this._getIconSvg('search');
    searchWrap.appendChild(searchIcon);

    const searchInput = document.createElement('input');
    searchInput.className = 'ui-editor-search-input';
    searchInput.placeholder = 'Search elements...';
    searchInput.addEventListener('input', () => {
      this._searchTerm = searchInput.value.toLowerCase().trim();
      this._renderList();
    });
    searchWrap.appendChild(searchInput);
    leftCol.appendChild(searchWrap);

    this.listContainer = document.createElement('div');
    this.listContainer.className = 'ui-editor-list';
    leftCol.appendChild(this.listContainer);

    body.appendChild(leftCol);

    this.previewCol = document.createElement('div');
    this.previewCol.className = 'ui-editor-preview-col';

    const previewToolbar = document.createElement('div');
    previewToolbar.className = 'ui-preview-toolbar';

    const tbLeft = document.createElement('div');
    tbLeft.className = 'ui-preview-toolbar-left';

    const resSelect = document.createElement('select');
    resSelect.className = 'props-select';
    resSelect.style.height = '24px';
    resSelect.style.fontSize = '10px';
    resSelect.style.width = '145px';
    resSelect.innerHTML = `
      <option value="1280x720">16:9 HD (1280×720)</option>
      <option value="1920x1080">16:9 FHD (1920×1080)</option>
      <option value="720x1280">9:16 Portrait (720×1280)</option>
      <option value="1024x768">4:3 Classic (1024×768)</option>
    `;
    resSelect.addEventListener('change', () => {
      this._activePreset = resSelect.value;
      const [w, h] = this._activePreset.split('x').map(Number);
      this._screenW = w;
      this._screenH = h;
      this._panX = 0;
      this._panY = 0;
      this.previewScreen.style.width = `${w}px`;
      this.previewScreen.style.height = `${h}px`;
      this._updatePreviewScale();
      this._renderPreview();
    });
    tbLeft.appendChild(resSelect);
    previewToolbar.appendChild(tbLeft);

    const tbRight = document.createElement('div');
    tbRight.className = 'ui-preview-toolbar-right';

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'ui-preview-tool-btn';
    zoomOutBtn.textContent = '−';
    zoomOutBtn.title = 'Zoom Out';
    zoomOutBtn.addEventListener('click', () => {
      this._userZoom = Math.max(0.15, this._userZoom - 0.15);
      this._updatePreviewScale();
    });
    tbRight.appendChild(zoomOutBtn);

    this._zoomLabel = document.createElement('div');
    this._zoomLabel.className = 'ui-preview-zoom-label';
    this._zoomLabel.textContent = '100%';
    this._zoomLabel.title = 'Click to reset zoom to 100%';
    this._zoomLabel.addEventListener('click', () => {
      this._userZoom = 1;
      this._panX = 0;
      this._panY = 0;
      this._updatePreviewScale();
    });
    tbRight.appendChild(this._zoomLabel);

    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'ui-preview-tool-btn';
    zoomInBtn.textContent = '+';
    zoomInBtn.title = 'Zoom In';
    zoomInBtn.addEventListener('click', () => {
      this._userZoom = Math.min(3.5, this._userZoom + 0.15);
      this._updatePreviewScale();
    });
    tbRight.appendChild(zoomInBtn);

    const zoomFitBtn = document.createElement('button');
    zoomFitBtn.className = 'ui-preview-tool-btn';
    zoomFitBtn.textContent = 'Fit';
    zoomFitBtn.title = 'Fit to window & center canvas';
    zoomFitBtn.addEventListener('click', () => {
      this._userZoom = 1;
      this._panX = 0;
      this._panY = 0;
      this._updatePreviewScale();
    });
    tbRight.appendChild(zoomFitBtn);

    const guidesBtn = document.createElement('button');
    guidesBtn.className = `ui-preview-tool-btn ${this._showGuides ? 'active' : ''}`;
    guidesBtn.textContent = 'Guides';
    guidesBtn.addEventListener('click', () => {
      this._showGuides = !this._showGuides;
      guidesBtn.classList.toggle('active', this._showGuides);
      this._renderPreview();
    });
    tbRight.appendChild(guidesBtn);

    const anchorsBtn = document.createElement('button');
    anchorsBtn.className = `ui-preview-tool-btn ${this._showAnchors ? 'active' : ''}`;
    anchorsBtn.textContent = 'Anchors';
    anchorsBtn.addEventListener('click', () => {
      this._showAnchors = !this._showAnchors;
      anchorsBtn.classList.toggle('active', this._showAnchors);
      this._renderPreview();
    });
    tbRight.appendChild(anchorsBtn);

    previewToolbar.appendChild(tbRight);
    this.previewCol.appendChild(previewToolbar);

    this.previewViewport = document.createElement('div');
    this.previewViewport.className = 'ui-preview-viewport';

    this.previewScreen = document.createElement('div');
    this.previewScreen.className = 'ui-preview-screen';
    this.previewScreen.style.width = `${this._screenW}px`;
    this.previewScreen.style.height = `${this._screenH}px`;
    this.previewViewport.appendChild(this.previewScreen);

    this._tooltipEl = document.createElement('div');
    this._tooltipEl.className = 'ui-canvas-tooltip';
    this._tooltipEl.style.display = 'none';
    this.previewViewport.appendChild(this._tooltipEl);

    this.previewCol.appendChild(this.previewViewport);
    body.appendChild(this.previewCol);

    this._setupCanvasNavigation();

    this.propsContainer = document.createElement('div');
    this.propsContainer.className = 'ui-editor-props';
    body.appendChild(this.propsContainer);

    this.container.appendChild(this.overlay);

    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => {
        if (this.isOpen) {
          this._updatePreviewScale();
        }
      });
      this._resizeObserver.observe(this.previewViewport);
    }

    this.uiManager.onUIChanged = () => {
      if (this.isOpen) {
        this._renderList();
        this._renderProps();
        this._renderPreview();
      }
    };
  }

  _updatePreviewScale() {
    if (!this.previewViewport || !this.previewScreen) return;
    const rect = this.previewViewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const pad = 36;
    const baseScale = Math.min((rect.width - pad) / this._screenW, (rect.height - pad) / this._screenH);
    this._previewScale = Math.max(0.05, baseScale * this._userZoom);
    this._applyScreenTransform();
    if (this._zoomLabel) {
      this._zoomLabel.textContent = `${Math.round(this._userZoom * 100)}%`;
    }
  }

  _applyScreenTransform() {
    if (!this.previewScreen) return;
    this.previewScreen.style.transform = `translate(${this._panX}px, ${this._panY}px) scale(${this._previewScale})`;
  }

  _renderPreview() {
    if (!this.previewScreen) return;
    this.previewScreen.innerHTML = '';

    if (this._showGuides) {
      const centerGuides = document.createElement('div');
      centerGuides.className = 'ui-preview-center-guides';
      this.previewScreen.appendChild(centerGuides);

      const safeArea = document.createElement('div');
      safeArea.className = 'ui-preview-safe-area';
      safeArea.style.inset = `${this._screenH * 0.05}px ${this._screenW * 0.05}px`;
      this.previewScreen.appendChild(safeArea);
    }

    const baseUI = this.uiManager.baseUI;

    if (baseUI.crosshair && baseUI.crosshair.active !== false) {
      this._renderBaseCrosshair(baseUI.crosshair);
    }

    if (baseUI.prompt && baseUI.prompt.active !== false) {
      this._renderBasePrompt(baseUI.prompt);
    }

    if (baseUI.joystick && baseUI.joystick.active !== false) {
      this._renderBaseJoystick(baseUI.joystick);
    }

    const customElements = this.uiManager.getAllElements();
    customElements.forEach(el => {
      if (el.visible !== false) {
        this._renderCustomElement(el);
      }
    });

    if (this._showAnchors && this._selectedElementId) {
      this._renderSelectedAnchorIndicator();
    }
  }

  _renderBaseCrosshair(cfg) {
    const isSelected = this._selectedElementId === 'base:crosshair';
    const size = cfg.size || 16;
    const color = cfg.color || '#ffffff';
    const ox = cfg.offsetX || 0;
    const oy = cfg.offsetY || 0;

    const el = document.createElement('div');
    el.className = `ui-preview-el ${isSelected ? 'selected' : ''}`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `calc(50% + ${ox}px - ${size / 2}px)`;
    el.style.top = `calc(50% + ${oy}px - ${size / 2}px)`;
    el.style.justifyContent = 'center';

    const hLine = document.createElement('div');
    hLine.style.position = 'absolute';
    hLine.style.width = `${size}px`;
    hLine.style.height = `${cfg.thickness || 2}px`;
    hLine.style.backgroundColor = color;
    el.appendChild(hLine);

    const vLine = document.createElement('div');
    vLine.style.position = 'absolute';
    vLine.style.width = `${cfg.thickness || 2}px`;
    vLine.style.height = `${size}px`;
    vLine.style.backgroundColor = color;
    el.appendChild(vLine);

    if (isSelected) {
      const badge = document.createElement('div');
      badge.className = 'ui-preview-badge';
      badge.textContent = 'Crosshair (Center)';
      el.appendChild(badge);
    }

    this._setupElementInteractions(el, 'base:crosshair', { ...cfg, anchor: 'center' });
    this.previewScreen.appendChild(el);
  }

  _renderBasePrompt(cfg) {
    const isSelected = this._selectedElementId === 'base:prompt';
    const ox = cfg.offsetX || 0;
    const oy = cfg.offsetY || 60;

    const el = document.createElement('div');
    el.className = `ui-preview-el ${isSelected ? 'selected' : ''}`;
    el.style.bottom = `${oy}px`;
    el.style.left = `calc(50% + ${ox}px)`;
    el.style.transform = 'translateX(-50%)';
    el.style.padding = '6px 14px';
    el.style.borderRadius = '20px';
    el.style.background = cfg.bg || 'rgba(0,0,0,0.7)';
    el.style.color = cfg.color || '#cccccc';
    el.style.fontSize = `${cfg.fontSize || 14}px`;
    el.style.fontWeight = '500';
    el.style.fontFamily = 'system-ui, sans-serif';
    el.style.whiteSpace = 'nowrap';
    el.textContent = 'Press E to interact';

    if (isSelected) {
      const badge = document.createElement('div');
      badge.className = 'ui-preview-badge';
      badge.textContent = 'Prompt (Bottom-Center)';
      el.appendChild(badge);
    }

    this._setupElementInteractions(el, 'base:prompt', { ...cfg, anchor: 'bottom-center' });
    this.previewScreen.appendChild(el);
  }

  _renderBaseJoystick(cfg) {
    const isSelected = this._selectedElementId === 'base:joystick';
    const baseSize = cfg.baseSize || 100;
    const thumbSize = cfg.thumbSize || 40;
    const ox = cfg.offsetX || 40;
    const oy = cfg.offsetY || 40;

    const el = document.createElement('div');
    el.className = `ui-preview-el ${isSelected ? 'selected' : ''}`;
    el.style.bottom = `${oy}px`;
    el.style.left = `${ox}px`;
    el.style.width = `${baseSize}px`;
    el.style.height = `${baseSize}px`;
    el.style.borderRadius = '50%';
    el.style.border = '2px solid rgba(255, 255, 255, 0.4)';
    el.style.background = 'rgba(255, 255, 255, 0.1)';
    el.style.justifyContent = 'center';

    const thumb = document.createElement('div');
    thumb.style.width = `${thumbSize}px`;
    thumb.style.height = `${thumbSize}px`;
    thumb.style.borderRadius = '50%';
    thumb.style.background = 'rgba(255, 255, 255, 0.5)';
    el.appendChild(thumb);

    if (isSelected) {
      const badge = document.createElement('div');
      badge.className = 'ui-preview-badge';
      badge.textContent = 'Joystick (Bottom-Left)';
      el.appendChild(badge);
    }

    this._setupElementInteractions(el, 'base:joystick', { ...cfg, anchor: 'bottom-left' });
    this.previewScreen.appendChild(el);
  }

  _renderCustomElement(el) {
    const isSelected = this._selectedElementId === el.id;
    const node = document.createElement('div');
    node.className = `ui-preview-el ${isSelected ? 'selected' : ''}`;

    node.style.width = typeof el.width === 'number' ? `${el.width}px` : el.width;
    node.style.height = typeof el.height === 'number' ? `${el.height}px` : el.height;
    node.style.borderRadius = `${el.borderRadius || 0}px`;
    node.style.backgroundColor = el.bgColor || 'transparent';
    node.style.justifyContent = el.textAlign === 'left' ? 'flex-start' : (el.textAlign === 'right' ? 'flex-end' : 'center');
    node.style.border = el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || '#ffffff'}` : 'none';

    const ox = el.offsetX || 0;
    const oy = el.offsetY || 0;

    switch (el.anchor) {
      case 'top-left':
        node.style.top = `${oy}px`;
        node.style.left = `${ox}px`;
        break;
      case 'top-center':
        node.style.top = `${oy}px`;
        node.style.left = `calc(50% + ${ox}px)`;
        node.style.transform = 'translateX(-50%)';
        break;
      case 'top-right':
        node.style.top = `${oy}px`;
        node.style.right = `${ox}px`;
        break;
      case 'center-left':
        node.style.top = `calc(50% + ${oy}px)`;
        node.style.left = `${ox}px`;
        node.style.transform = 'translateY(-50%)';
        break;
      case 'center':
        node.style.top = `calc(50% + ${oy}px)`;
        node.style.left = `calc(50% + ${ox}px)`;
        node.style.transform = 'translate(-50%, -50%)';
        break;
      case 'center-right':
        node.style.top = `calc(50% + ${oy}px)`;
        node.style.right = `${ox}px`;
        node.style.transform = 'translateY(-50%)';
        break;
      case 'bottom-left':
        node.style.bottom = `${oy}px`;
        node.style.left = `${ox}px`;
        break;
      case 'bottom-center':
        node.style.bottom = `${oy}px`;
        node.style.left = `calc(50% + ${ox}px)`;
        node.style.transform = 'translateX(-50%)';
        break;
      case 'bottom-right':
        node.style.bottom = `${oy}px`;
        node.style.right = `${ox}px`;
        break;
      default:
        node.style.top = `${oy}px`;
        node.style.left = `${ox}px`;
        break;
    }

    if (el.type === 'label' || el.type === 'button') {
      node.textContent = el.text || '';
      node.style.color = el.textColor || '#ffffff';
      node.style.fontSize = `${el.fontSize || 14}px`;
      node.style.fontWeight = el.fontWeight || '500';
      node.style.padding = `${el.padding || 4}px`;
      node.style.fontFamily = 'system-ui, sans-serif';
    } else if (el.type === 'progressbar') {
      const val = Math.max(0, Math.min(el.maxValue || 100, el.value || 0));
      const pct = (val / (el.maxValue || 100)) * 100;

      const fill = document.createElement('div');
      fill.style.width = `${pct}%`;
      fill.style.height = '100%';
      fill.style.background = el.fillColor || '#ef4444';
      fill.style.borderRadius = `${Math.max(0, (el.borderRadius || 4) - 1)}px`;
      node.appendChild(fill);

      if (el.showText) {
        const textSpan = document.createElement('span');
        textSpan.style.position = 'absolute';
        textSpan.style.inset = '0';
        textSpan.style.display = 'flex';
        textSpan.style.alignItems = 'center';
        textSpan.style.justifyContent = 'center';
        textSpan.style.fontSize = `${el.fontSize || 11}px`;
        textSpan.style.color = el.textColor || '#ffffff';
        textSpan.style.fontWeight = 'bold';
        textSpan.textContent = el.text || `${Math.round(pct)}%`;
        node.appendChild(textSpan);
      }
    } else if (el.type === 'panel') {
      node.innerHTML = '';
    } else if (el.type === 'image') {
      let src = el.imageSrc || '';
      if (el.textureAssetId && this.assetManager) {
        const tex = this.assetManager.getTexture(el.textureAssetId);
        if (tex && (tex.preview || tex.blobUrl)) {
          src = tex.preview || tex.blobUrl;
        }
      }
      if (src) {
        node.style.backgroundImage = `url("${src}")`;
        node.style.backgroundRepeat = 'no-repeat';
        node.style.backgroundPosition = 'center';
        node.style.backgroundSize = el.fit === 'cover' ? 'cover' : 'contain';
      } else {
        node.style.border = '1px dashed #71717a';
        node.innerHTML = '<span style="font-size:10px;color:#a1a1aa;">[No Image]</span>';
      }
      node.style.opacity = el.opacity ?? 1;
    }

    if (isSelected) {
      const badge = document.createElement('div');
      badge.className = 'ui-preview-badge';
      badge.textContent = `${el.name} (${el.anchor})`;
      node.appendChild(badge);

      if (!el.locked) {
        this._attachResizeHandles(node, el);
      }
    }

    this._setupElementInteractions(node, el.id, el);
    this.previewScreen.appendChild(node);
  }

  _attachResizeHandles(node, el) {
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    handles.forEach(h => {
      const handleEl = document.createElement('div');
      handleEl.className = `ui-resize-handle handle-${h}`;
      handleEl.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || this._spacePressed || e.altKey) return;
        e.stopPropagation();
        e.preventDefault();
        this._startResize(e, el, h);
      });
      node.appendChild(handleEl);
    });
  }

  _renderSelectedAnchorIndicator() {
    let anchor = 'top-left';
    if (this._selectedElementId.startsWith('base:')) {
      const bKey = this._selectedElementId.replace('base:', '');
      anchor = this.uiManager.baseUI[bKey]?.anchor || 'center';
    } else {
      const el = this.uiManager.getElement(this._selectedElementId);
      if (el) anchor = el.anchor || 'top-left';
    }

    const dot = document.createElement('div');
    dot.className = 'ui-preview-anchor-dot';

    switch (anchor) {
      case 'top-left': dot.style.top = '0px'; dot.style.left = '0px'; break;
      case 'top-center': dot.style.top = '0px'; dot.style.left = '50%'; break;
      case 'top-right': dot.style.top = '0px'; dot.style.left = '100%'; break;
      case 'center-left': dot.style.top = '50%'; dot.style.left = '0px'; break;
      case 'center':
      case 'middle-center': dot.style.top = '50%'; dot.style.left = '50%'; break;
      case 'center-right': dot.style.top = '50%'; dot.style.left = '100%'; break;
      case 'bottom-left': dot.style.top = '100%'; dot.style.left = '0px'; break;
      case 'bottom-center': dot.style.top = '100%'; dot.style.left = '50%'; break;
      case 'bottom-right': dot.style.top = '100%'; dot.style.left = '100%'; break;
    }

    this.previewScreen.appendChild(dot);
  }

  _setupElementInteractions(node, id, config) {
    node.addEventListener('pointerdown', (e) => {
      if (e.target.classList.contains('ui-resize-handle')) return;
      if (e.button !== 0 || this._spacePressed || e.altKey) return;
      e.stopPropagation();
      e.preventDefault();

      if (this._selectedElementId !== id) {
        this._selectedElementId = id;
        this._renderList();
        this._renderProps();
        this._renderPreview();
      }

      if (config.locked) return;

      this._isDragging = true;
      const startX = e.clientX;
      const startY = e.clientY;
      const startOx = config.offsetX || 0;
      const startOy = config.offsetY || 0;
      const anchor = config.anchor || 'top-left';

      this._showTooltip(`X: ${startOx}px, Y: ${startOy}px`);

      const onPointerMove = (moveEv) => {
        if (!this._isDragging) return;
        const dx = (moveEv.clientX - startX) / this._previewScale;
        const dy = (moveEv.clientY - startY) / this._previewScale;

        let newOx = anchor.includes('right') ? Math.round(startOx - dx) : Math.round(startOx + dx);
        let newOy = anchor.includes('bottom') ? Math.round(startOy - dy) : Math.round(startOy + dy);

        if (anchor === 'center' || anchor === 'middle-center' || anchor === 'top-center' || anchor === 'bottom-center') {
          if (Math.abs(newOx) <= 5) newOx = 0;
        }
        if (anchor === 'center' || anchor === 'middle-center' || anchor === 'center-left' || anchor === 'center-right') {
          if (Math.abs(newOy) <= 5) newOy = 0;
        }

        if (id.startsWith('base:')) {
          const bKey = id.replace('base:', '');
          this.uiManager.updateBaseUI(bKey, { offsetX: newOx, offsetY: newOy });
        } else {
          this.uiManager.updateElement(id, { offsetX: newOx, offsetY: newOy });
        }

        this._showTooltip(`X: ${newOx}px, Y: ${newOy}px`);
        this._renderProps();
        this._renderPreview();
      };

      const onPointerUp = () => {
        this._isDragging = false;
        this._hideTooltip();
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  _startResize(e, el, handle) {
    this._isResizing = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = typeof el.width === 'number' ? el.width : parseInt(el.width) || 100;
    const startH = typeof el.height === 'number' ? el.height : parseInt(el.height) || 40;
    const startOx = el.offsetX || 0;
    const startOy = el.offsetY || 0;
    const anchor = el.anchor || 'top-left';

    this._showTooltip(`W: ${startW}px, H: ${startH}px`);

    const onPointerMove = (moveEv) => {
      if (!this._isResizing) return;
      const dx = (moveEv.clientX - startX) / this._previewScale;
      const dy = (moveEv.clientY - startY) / this._previewScale;

      let newW = startW;
      let newH = startH;
      let newOx = startOx;
      let newOy = startOy;

      if (handle.includes('e')) {
        newW = Math.max(16, Math.round(startW + dx));
        if (anchor.includes('right')) {
          newOx = Math.round(startOx - dx);
        }
      } else if (handle.includes('w')) {
        newW = Math.max(16, Math.round(startW - dx));
        if (anchor.includes('left')) {
          newOx = Math.round(startOx + dx);
        }
      }

      if (handle.includes('s')) {
        newH = Math.max(16, Math.round(startH + dy));
        if (anchor.includes('bottom')) {
          newOy = Math.round(startOy - dy);
        }
      } else if (handle.includes('n')) {
        newH = Math.max(16, Math.round(startH - dy));
        if (anchor.includes('top')) {
          newOy = Math.round(startOy + dy);
        }
      }

      this.uiManager.updateElement(el.id, {
        width: newW,
        height: newH,
        offsetX: newOx,
        offsetY: newOy
      });

      this._showTooltip(`W: ${newW}px, H: ${newH}px | X: ${newOx}, Y: ${newOy}`);
      this._renderProps();
      this._renderPreview();
    };

    const onPointerUp = () => {
      this._isResizing = false;
      this._hideTooltip();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  _showTooltip(text) {
    if (this._tooltipEl) {
      this._tooltipEl.textContent = text;
      this._tooltipEl.style.display = 'flex';
    }
  }

  _hideTooltip() {
    if (this._tooltipEl) {
      this._tooltipEl.style.display = 'none';
    }
  }

  _setupCanvasNavigation() {
    this.previewViewport.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    this.previewViewport.addEventListener('pointerdown', (e) => {
      const isMiddle = e.button === 1;
      const isRight = e.button === 2;
      const isLeft = e.button === 0;

      const isBackground = e.target === this.previewViewport ||
                           e.target === this.previewScreen ||
                           e.target.classList.contains('ui-preview-center-guides') ||
                           e.target.classList.contains('ui-preview-safe-area');

      const shouldPan = isMiddle || isRight || (isLeft && (isBackground || this._spacePressed || e.altKey));

      if (shouldPan) {
        e.preventDefault();
        e.stopPropagation();

        this._isCanvasPanning = true;
        const startX = e.clientX;
        const startY = e.clientY;
        const startPanX = this._panX;
        const startPanY = this._panY;

        this.previewViewport.classList.add('panning');

        const onPointerMove = (moveEv) => {
          if (!this._isCanvasPanning) return;
          const dx = moveEv.clientX - startX;
          const dy = moveEv.clientY - startY;
          this._panX = startPanX + dx;
          this._panY = startPanY + dy;
          this._applyScreenTransform();
        };

        const onPointerUp = (upEv) => {
          this._isCanvasPanning = false;
          this.previewViewport.classList.remove('panning');
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);

          if (isLeft && isBackground && Math.abs(upEv.clientX - startX) < 4 && Math.abs(upEv.clientY - startY) < 4) {
            this._selectedElementId = null;
            this._renderList();
            this._renderProps();
            this._renderPreview();
          }
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      }
    });

    this.previewViewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
      const newZoom = Math.min(3.5, Math.max(0.15, this._userZoom * zoomFactor));

      const rect = this.previewViewport.getBoundingClientRect();
      const cursorX = e.clientX - (rect.left + rect.width / 2);
      const cursorY = e.clientY - (rect.top + rect.height / 2);

      const ratio = newZoom / this._userZoom;
      this._panX = cursorX - (cursorX - this._panX) * ratio;
      this._panY = cursorY - (cursorY - this._panY) * ratio;
      this._userZoom = newZoom;
      this._updatePreviewScale();
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Space' && !this._spacePressed && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        this._spacePressed = true;
        this.previewViewport.style.cursor = 'grab';
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this._spacePressed = false;
        this.previewViewport.style.cursor = '';
      }
    });
  }

  _renderList() {
    this.listContainer.innerHTML = '';

    const baseHeader = document.createElement('div');
    baseHeader.className = 'ui-editor-section-header';
    baseHeader.innerHTML = `<span>Base HUD</span><span class="ui-editor-section-badge">3</span>`;
    this.listContainer.appendChild(baseHeader);

    const baseItems = [
      { id: 'base:crosshair', name: 'Crosshair', type: 'crosshair' },
      { id: 'base:prompt', name: 'Prompt', type: 'prompt' },
      { id: 'base:joystick', name: 'Joystick', type: 'joystick' }
    ];

    baseItems.forEach(b => {
      if (this._searchTerm && !b.name.toLowerCase().includes(this._searchTerm)) return;

      const item = document.createElement('div');
      item.className = 'ui-editor-item';
      if (b.id === this._selectedElementId) item.classList.add('selected');

      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.innerHTML = this._getIconSvg(b.type);
      item.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = b.name;
      item.appendChild(name);

      item.addEventListener('click', () => {
        this._selectedElementId = b.id;
        this._renderList();
        this._renderProps();
        this._renderPreview();
      });

      this.listContainer.appendChild(item);
    });

    const elements = this.uiManager.getAllElements();
    const filtered = elements.filter(el => !this._searchTerm || (el.name || el.type).toLowerCase().includes(this._searchTerm));

    const customHeader = document.createElement('div');
    customHeader.className = 'ui-editor-section-header';
    customHeader.innerHTML = `<span>Custom Elements</span><span class="ui-editor-section-badge">${elements.length}</span>`;
    this.listContainer.appendChild(customHeader);

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ui-editor-empty-hint';
      empty.textContent = this._searchTerm ? 'No matching elements found.' : 'No custom elements yet. Click + buttons above to add.';
      this.listContainer.appendChild(empty);
    }

    filtered.forEach(el => {
      const item = document.createElement('div');
      item.className = 'ui-editor-item';
      if (el.id === this._selectedElementId) item.classList.add('selected');

      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.innerHTML = this._getIconSvg(el.type);
      item.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = el.name || el.type;
      item.appendChild(name);

      const actions = document.createElement('div');
      actions.className = 'ui-item-actions';

      const visBtn = document.createElement('button');
      visBtn.className = `ui-item-btn ${el.visible !== false ? 'active' : ''}`;
      visBtn.innerHTML = el.visible !== false ? this._getIconSvg('eye-on') : this._getIconSvg('eye-off');
      visBtn.title = el.visible !== false ? 'Hide Element' : 'Show Element';
      visBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.uiManager.updateElement(el.id, { visible: !(el.visible !== false) });
        this._renderList();
        this._renderPreview();
      });
      actions.appendChild(visBtn);

      const lockBtn = document.createElement('button');
      lockBtn.className = `ui-item-btn ${el.locked ? 'active' : ''}`;
      lockBtn.innerHTML = el.locked ? this._getIconSvg('lock-on') : this._getIconSvg('lock-off');
      lockBtn.title = el.locked ? 'Unlock Dragging' : 'Lock on Canvas';
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.uiManager.updateElement(el.id, { locked: !el.locked });
        this._renderList();
        this._renderPreview();
      });
      actions.appendChild(lockBtn);

      const upBtn = document.createElement('button');
      upBtn.className = 'ui-item-btn';
      upBtn.innerHTML = this._getIconSvg('arrow-up');
      upBtn.title = 'Move Layer Up';
      upBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.uiManager.moveElementUp(el.id);
        this._renderList();
        this._renderPreview();
      });
      actions.appendChild(upBtn);

      const downBtn = document.createElement('button');
      downBtn.className = 'ui-item-btn';
      downBtn.innerHTML = this._getIconSvg('arrow-down');
      downBtn.title = 'Move Layer Down';
      downBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.uiManager.moveElementDown(el.id);
        this._renderList();
        this._renderPreview();
      });
      actions.appendChild(downBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'ui-item-btn del';
      delBtn.innerHTML = this._getIconSvg('delete');
      delBtn.title = 'Delete Element';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.uiManager.removeElement(el.id);
        if (this._selectedElementId === el.id) {
          this._selectedElementId = 'base:crosshair';
        }
        this._renderList();
        this._renderProps();
        this._renderPreview();
      });
      actions.appendChild(delBtn);

      item.appendChild(actions);

      item.addEventListener('click', () => {
        this._selectedElementId = el.id;
        this._renderList();
        this._renderProps();
        this._renderPreview();
      });

      this.listContainer.appendChild(item);
    });
  }

  _renderProps() {
    this.propsContainer.innerHTML = '';

    if (this._selectedElementId && this._selectedElementId.startsWith('base:')) {
      const baseKey = this._selectedElementId.replace('base:', '');
      const cfg = this.uiManager.baseUI[baseKey];
      if (!cfg) return;

      const titleCard = document.createElement('div');
      titleCard.className = 'props-card';
      titleCard.innerHTML = `
        <div class="props-title">
          <span>${this._getIconSvg(baseKey)}</span>
          <span>Base HUD: ${baseKey.charAt(0).toUpperCase() + baseKey.slice(1)}</span>
        </div>
      `;
      this.propsContainer.appendChild(titleCard);

      const layoutCard = document.createElement('div');
      layoutCard.className = 'props-card';
      layoutCard.innerHTML = `<div class="props-card-header"><span class="props-card-title">Layout & Position</span></div>`;

      this._addCheckboxRow(layoutCard, 'Active / Visible', cfg.active !== false, (val) => {
        this.uiManager.setBaseUIActive(baseKey, val);
        this._renderPreview();
      });

      this._addAnchorSelector(layoutCard, cfg, (newAnchor) => {
        this.uiManager.updateBaseUI(baseKey, { anchor: newAnchor });
        this._renderPreview();
      });

      this._addVec2Row(layoutCard, 'Offset (X, Y)', cfg.offsetX || 0, cfg.offsetY || 0, (x, y) => {
        this.uiManager.updateBaseUI(baseKey, { offsetX: x, offsetY: y });
        this._renderPreview();
      });

      this.propsContainer.appendChild(layoutCard);

      const styleCard = document.createElement('div');
      styleCard.className = 'props-card';
      styleCard.innerHTML = `<div class="props-card-header"><span class="props-card-title">Style & Config</span></div>`;

      if (baseKey === 'crosshair') {
        this._addInputRow(styleCard, 'Size', 'number', cfg.size || 16, (val) => {
          this.uiManager.updateBaseUI(baseKey, { size: parseInt(val) || 16 });
          this._renderPreview();
        });
        this._addColorRow(styleCard, 'Color', cfg.color || '#ffffff', (val) => {
          this.uiManager.updateBaseUI(baseKey, { color: val });
          this._renderPreview();
        });
      } else if (baseKey === 'joystick') {
        this._addInputRow(styleCard, 'Base Size', 'number', cfg.baseSize || 100, (val) => {
          this.uiManager.updateBaseUI(baseKey, { baseSize: parseInt(val) || 100 });
          this._renderPreview();
        });
        this._addInputRow(styleCard, 'Thumb Size', 'number', cfg.thumbSize || 40, (val) => {
          this.uiManager.updateBaseUI(baseKey, { thumbSize: parseInt(val) || 40 });
          this._renderPreview();
        });
      } else if (baseKey === 'prompt') {
        this._addInputRow(styleCard, 'Font Size', 'number', cfg.fontSize || 14, (val) => {
          this.uiManager.updateBaseUI(baseKey, { fontSize: parseInt(val) || 14 });
          this._renderPreview();
        });
        this._addColorRow(styleCard, 'Text Color', cfg.color || '#cccccc', (val) => {
          this.uiManager.updateBaseUI(baseKey, { color: val });
          this._renderPreview();
        });
        this._addInputRow(styleCard, 'Background', 'text', cfg.bg || 'rgba(0,0,0,0.7)', (val) => {
          this.uiManager.updateBaseUI(baseKey, { bg: val });
          this._renderPreview();
        });
      }

      this.propsContainer.appendChild(styleCard);
      return;
    }

    const el = this.uiManager.getElement(this._selectedElementId);

    if (!el) {
      const empty = document.createElement('div');
      empty.className = 'ui-editor-empty-hint';
      empty.textContent = 'Select an element on the left or canvas to inspect and edit properties.';
      this.propsContainer.appendChild(empty);
      return;
    }

    const infoCard = document.createElement('div');
    infoCard.className = 'props-card';
    infoCard.innerHTML = `
      <div class="props-title">
        <span>${this._getIconSvg(el.type)}</span>
        <span>${el.name || el.type}</span>
      </div>
    `;

    this._addInputRow(infoCard, 'Name', 'text', el.name, (val) => {
      this.uiManager.updateElement(el.id, { name: val });
      this._renderList();
      this._renderPreview();
    });

    this._addCheckboxRow(infoCard, 'Visible', el.visible !== false, (val) => {
      this.uiManager.updateElement(el.id, { visible: val });
      this._renderList();
      this._renderPreview();
    });

    this._addCheckboxRow(infoCard, 'Locked on Canvas', Boolean(el.locked), (val) => {
      this.uiManager.updateElement(el.id, { locked: val });
      this._renderList();
      this._renderPreview();
    });

    this.propsContainer.appendChild(infoCard);

    const layoutCard = document.createElement('div');
    layoutCard.className = 'props-card';
    layoutCard.innerHTML = `<div class="props-card-header"><span class="props-card-title">Transform & Layout</span></div>`;

    this._addAnchorSelector(layoutCard, el, (anchor) => {
      this.uiManager.updateElement(el.id, { anchor });
      this._renderPreview();
    });

    this._addVec2Row(layoutCard, 'Offset (X, Y)', el.offsetX || 0, el.offsetY || 0, (x, y) => {
      this.uiManager.updateElement(el.id, { offsetX: x, offsetY: y });
      this._renderPreview();
    });

    this._addVec2Row(layoutCard, 'Size (W, H)', el.width || 100, el.height || 40, (w, h) => {
      this.uiManager.updateElement(el.id, { width: w, height: h });
      this._renderPreview();
    });

    this.propsContainer.appendChild(layoutCard);

    const styleCard = document.createElement('div');
    styleCard.className = 'props-card';
    styleCard.innerHTML = `<div class="props-card-header"><span class="props-card-title">Appearance</span></div>`;

    this._addInputRow(styleCard, 'Background', 'text', el.bgColor || 'rgba(0,0,0,0.6)', (val) => {
      this.uiManager.updateElement(el.id, { bgColor: val });
      this._renderPreview();
    });

    this._addInputRow(styleCard, 'Border Radius', 'number', el.borderRadius || 0, (val) => {
      this.uiManager.updateElement(el.id, { borderRadius: parseInt(val) || 0 });
      this._renderPreview();
    });

    this._addInputRow(styleCard, 'Border Width', 'number', el.borderWidth || 0, (val) => {
      this.uiManager.updateElement(el.id, { borderWidth: parseInt(val) || 0 });
      this._renderPreview();
    });

    this._addColorRow(styleCard, 'Border Color', el.borderColor || '#ffffff', (val) => {
      this.uiManager.updateElement(el.id, { borderColor: val });
      this._renderPreview();
    });

    this.propsContainer.appendChild(styleCard);

    if (el.type === 'label' || el.type === 'button') {
      const textCard = document.createElement('div');
      textCard.className = 'props-card';
      textCard.innerHTML = `<div class="props-card-header"><span class="props-card-title">Typography & Button</span></div>`;

      this._addInputRow(textCard, 'Text', 'text', el.text || '', (val) => {
        this.uiManager.updateElement(el.id, { text: val });
        this._renderPreview();
      });

      this._addInputRow(textCard, 'Font Size', 'number', el.fontSize || 14, (val) => {
        this.uiManager.updateElement(el.id, { fontSize: parseInt(val) || 14 });
        this._renderPreview();
      });

      this._addColorRow(textCard, 'Text Color', el.textColor || '#ffffff', (val) => {
        this.uiManager.updateElement(el.id, { textColor: val });
        this._renderPreview();
      });

      if (el.type === 'button') {
        this._addInputRow(textCard, 'Hover Background', 'text', el.hoverBgColor || '#0369a1', (val) => {
          this.uiManager.updateElement(el.id, { hoverBgColor: val });
          this._renderPreview();
        });
      }

      this._addSelectRow(textCard, 'Align', ['left', 'center', 'right'], el.textAlign || 'center', (val) => {
        this.uiManager.updateElement(el.id, { textAlign: val });
        this._renderPreview();
      });

      this.propsContainer.appendChild(textCard);
    } else if (el.type === 'progressbar') {
      const barCard = document.createElement('div');
      barCard.className = 'props-card';
      barCard.innerHTML = `<div class="props-card-header"><span class="props-card-title">Progress Bar Config</span></div>`;

      this._addInputRow(barCard, 'Value (0-100)', 'number', el.value || 0, (val) => {
        this.uiManager.updateElement(el.id, { value: parseFloat(val) || 0 });
        this._renderPreview();
      }, 1, 0, el.maxValue || 100);

      this._addInputRow(barCard, 'Max Value', 'number', el.maxValue || 100, (val) => {
        this.uiManager.updateElement(el.id, { maxValue: parseFloat(val) || 100 });
        this._renderPreview();
      });

      this._addColorRow(barCard, 'Fill Color', el.fillColor || '#ef4444', (val) => {
        this.uiManager.updateElement(el.id, { fillColor: val });
        this._renderPreview();
      });

      this._addCheckboxRow(barCard, 'Show Text Overlay', Boolean(el.showText), (val) => {
        this.uiManager.updateElement(el.id, { showText: val });
        this._renderPreview();
      });

      this._addInputRow(barCard, 'Custom Text', 'text', el.text || '', (val) => {
        this.uiManager.updateElement(el.id, { text: val });
        this._renderPreview();
      });

      this.propsContainer.appendChild(barCard);
    } else if (el.type === 'image') {
      const imgCard = document.createElement('div');
      imgCard.className = 'props-card';
      imgCard.innerHTML = `<div class="props-card-header"><span class="props-card-title">Image Config</span></div>`;

      this._addImageAssetSelector(imgCard, el);

      this._addInputRow(imgCard, 'Opacity (0-1)', 'number', el.opacity ?? 1, (val) => {
        this.uiManager.updateElement(el.id, { opacity: parseFloat(val) });
        this._renderPreview();
      }, 0.1, 0, 1);

      this._addSelectRow(imgCard, 'Fit Mode', ['contain', 'cover'], el.fit || 'contain', (val) => {
        this.uiManager.updateElement(el.id, { fit: val });
        this._renderPreview();
      });

      this.propsContainer.appendChild(imgCard);
    }

    const actionCard = document.createElement('div');
    actionCard.className = 'props-card';
    actionCard.innerHTML = `<div class="props-card-header"><span class="props-card-title">Actions</span></div>`;

    const dupBtn = document.createElement('button');
    dupBtn.className = 'ui-btn-action primary';
    dupBtn.innerHTML = `${this._getIconSvg('duplicate')}<span>Duplicate (Ctrl+D)</span>`;
    dupBtn.addEventListener('click', () => {
      const clone = this.uiManager.duplicateElement(el.id);
      if (clone) {
        this._selectedElementId = clone.id;
        this._renderList();
        this._renderProps();
        this._renderPreview();
      }
    });
    actionCard.appendChild(dupBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'ui-btn-action danger';
    delBtn.style.marginTop = '6px';
    delBtn.innerHTML = `${this._getIconSvg('delete')}<span>Delete (Del)</span>`;
    delBtn.addEventListener('click', () => {
      this.uiManager.removeElement(el.id);
      this._selectedElementId = 'base:crosshair';
      this._renderList();
      this._renderProps();
      this._renderPreview();
    });
    actionCard.appendChild(delBtn);

    this.propsContainer.appendChild(actionCard);
  }

  _addAnchorSelector(targetContainer, el, onChange = null) {
    const row = document.createElement('div');
    row.className = 'props-row';

    const lbl = document.createElement('span');
    lbl.className = 'props-label';
    lbl.textContent = 'Anchor';
    row.appendChild(lbl);

    const grid = document.createElement('div');
    grid.className = 'anchor-grid';

    const anchors = [
      ['top-left', '↖'], ['top-center', '↑'], ['top-right', '↗'],
      ['center-left', '←'], ['center', '•'], ['center-right', '→'],
      ['bottom-left', '↙'], ['bottom-center', '↓'], ['bottom-right', '↘']
    ];

    anchors.forEach(([anchor, symbol]) => {
      const btn = document.createElement('button');
      btn.className = `anchor-btn ${el.anchor === anchor ? 'active' : ''}`;
      btn.textContent = symbol;
      btn.title = anchor;
      btn.addEventListener('click', () => {
        if (onChange) {
          onChange(anchor);
        } else if (el.id) {
          this.uiManager.updateElement(el.id, { anchor });
        }
        this._renderProps();
        this._renderPreview();
      });
      grid.appendChild(btn);
    });

    row.appendChild(grid);
    targetContainer.appendChild(row);
  }

  _addInputRow(targetContainer, label, type, val, onChange, step = 1, min = -Infinity, max = Infinity) {
    const row = document.createElement('div');
    row.className = 'props-row';
    const lbl = document.createElement('span');
    lbl.className = 'props-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const input = document.createElement('input');
    input.type = type;
    input.className = 'props-input';
    input.value = val;
    if (type === 'number') {
      input.step = String(step);
      if (min !== -Infinity) input.min = String(min);
      if (max !== Infinity) input.max = String(max);
    }
    input.addEventListener('input', () => onChange(input.value));
    row.appendChild(input);
    targetContainer.appendChild(row);
  }

  _addCheckboxRow(targetContainer, label, checked, onChange) {
    const row = document.createElement('div');
    row.className = 'props-row';
    const lbl = document.createElement('span');
    lbl.className = 'props-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = checked;
    cb.style.accentColor = 'var(--accent)';
    cb.style.cursor = 'pointer';
    cb.addEventListener('change', () => onChange(cb.checked));
    row.appendChild(cb);
    targetContainer.appendChild(row);
  }

  _addColorRow(targetContainer, label, val, onChange) {
    const row = document.createElement('div');
    row.className = 'props-row';
    const lbl = document.createElement('span');
    lbl.className = 'props-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const wrap = document.createElement('div');
    wrap.className = 'props-color-wrap';

    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'props-color-input';
    input.value = val.startsWith('#') && val.length === 7 ? val : '#ffffff';

    const textIn = document.createElement('input');
    textIn.type = 'text';
    textIn.className = 'props-color-text';
    textIn.value = val;

    input.addEventListener('input', () => {
      textIn.value = input.value;
      onChange(input.value);
    });

    textIn.addEventListener('input', () => {
      if (textIn.value.startsWith('#') && textIn.value.length === 7) {
        input.value = textIn.value;
      }
      onChange(textIn.value);
    });

    wrap.appendChild(input);
    wrap.appendChild(textIn);
    row.appendChild(wrap);
    targetContainer.appendChild(row);
  }

  _addSelectRow(targetContainer, label, options, current, onChange) {
    const row = document.createElement('div');
    row.className = 'props-row';
    const lbl = document.createElement('span');
    lbl.className = 'props-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const select = document.createElement('select');
    select.className = 'props-select';
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      if (opt === current) o.selected = true;
      select.appendChild(o);
    });
    select.addEventListener('change', () => onChange(select.value));
    row.appendChild(select);
    targetContainer.appendChild(row);
  }

  _addVec2Row(targetContainer, label, xVal, yVal, onChange) {
    const row = document.createElement('div');
    row.className = 'props-row';
    const lbl = document.createElement('span');
    lbl.className = 'props-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const wrap = document.createElement('div');
    wrap.className = 'props-vec2';

    const xField = document.createElement('div');
    xField.className = 'props-vec2-field';
    const xTag = document.createElement('span');
    xTag.textContent = 'X';
    const xIn = document.createElement('input');
    xIn.type = 'number';
    xIn.value = xVal;
    xIn.addEventListener('input', () => onChange(parseFloat(xIn.value) || 0, parseFloat(yIn.value) || 0));
    xField.appendChild(xTag);
    xField.appendChild(xIn);

    const yField = document.createElement('div');
    yField.className = 'props-vec2-field';
    const yTag = document.createElement('span');
    yTag.textContent = 'Y';
    const yIn = document.createElement('input');
    yIn.type = 'number';
    yIn.value = yVal;
    yIn.addEventListener('input', () => onChange(parseFloat(xIn.value) || 0, parseFloat(yIn.value) || 0));
    yField.appendChild(yTag);
    yField.appendChild(yIn);

    wrap.appendChild(xField);
    wrap.appendChild(yField);
    row.appendChild(wrap);
    targetContainer.appendChild(row);
  }

  _addImageAssetSelector(targetContainer, el) {
    const row = document.createElement('div');
    row.className = 'props-row';
    const lbl = document.createElement('span');
    lbl.className = 'props-label';
    lbl.textContent = 'Texture';
    row.appendChild(lbl);

    const select = document.createElement('select');
    select.className = 'props-select';
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '-- Select Texture --';
    select.appendChild(emptyOpt);

    if (this.assetManager) {
      const textures = this.assetManager.getAllTextures();
      textures.forEach(t => {
        const o = document.createElement('option');
        o.value = t.id;
        o.textContent = t.name;
        if (t.id === el.textureAssetId) o.selected = true;
        select.appendChild(o);
      });
    }

    select.addEventListener('change', () => {
      this.uiManager.updateElement(el.id, { textureAssetId: select.value });
      this._renderProps();
      this._renderPreview();
    });

    row.appendChild(select);
    targetContainer.appendChild(row);
  }
  //#endregion
}

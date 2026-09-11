export class UIPanel {
  constructor(container, uiManager, assetManager) {
    this.container = container;
    this.uiManager = uiManager;
    this.assetManager = assetManager;
    this.isOpen = false;
    this._selectedElementId = null;

    this._build();
  }

  _build() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'ui-editor-modal';
    this.overlay.style.display = 'none';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    this.panel = document.createElement('div');
    this.panel.className = 'ui-editor-window';
    this.overlay.appendChild(this.panel);


    const header = document.createElement('div');
    header.className = 'ui-editor-header';
    header.innerHTML = '<span>UI & HUD Layout Editor</span>';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ui-editor-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);
    this.panel.appendChild(header);

    const body = document.createElement('div');
    body.className = 'ui-editor-body';
    this.panel.appendChild(body);

    // Left column: list of elements + add buttons
    const leftCol = document.createElement('div');
    leftCol.className = 'ui-editor-sidebar';

    const addActions = document.createElement('div');
    addActions.className = 'ui-editor-add-actions';

    const addTextBtn = document.createElement('button');
    addTextBtn.className = 'btn-add-ui';
    addTextBtn.textContent = '+ LabelText';
    addTextBtn.addEventListener('click', () => {
      const el = this.uiManager.addElement('label');
      this._selectedElementId = el.id;
      this._renderList();
      this._renderProps();
    });

    const addImageBtn = document.createElement('button');
    addImageBtn.className = 'btn-add-ui';
    addImageBtn.textContent = '+ Image';
    addImageBtn.addEventListener('click', () => {
      const el = this.uiManager.addElement('image');
      this._selectedElementId = el.id;
      this._renderList();
      this._renderProps();
    });

    addActions.appendChild(addTextBtn);
    addActions.appendChild(addImageBtn);
    leftCol.appendChild(addActions);

    this.listContainer = document.createElement('div');
    this.listContainer.className = 'ui-editor-list';
    leftCol.appendChild(this.listContainer);

    body.appendChild(leftCol);

    // Right column: property inspector for selected UI element
    this.propsContainer = document.createElement('div');
    this.propsContainer.className = 'ui-editor-props';
    body.appendChild(this.propsContainer);

    this.container.appendChild(this.overlay);

    this.uiManager.onUIChanged = () => {
      if (this.isOpen) {
        this._renderList();
        this._renderProps();
      }
    };
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    this.overlay.style.display = 'flex';
    const all = this.uiManager.getAllElements();
    if (!this._selectedElementId && all.length > 0) {
      this._selectedElementId = all[0].id;
    }
    this._renderList();
    this._renderProps();
  }

  close() {
    this.isOpen = false;
    this.overlay.style.display = 'none';
  }

  _renderList() {
    this.listContainer.innerHTML = '';

    // Base UI section header
    const baseHeader = document.createElement('div');
    baseHeader.style.padding = '4px 8px';
    baseHeader.style.fontSize = '10px';
    baseHeader.style.fontWeight = 'bold';
    baseHeader.style.color = 'var(--text-dim)';
    baseHeader.style.textTransform = 'uppercase';
    baseHeader.textContent = 'Base UI Elements';
    this.listContainer.appendChild(baseHeader);

    const baseItems = [
      { id: 'base:crosshair', name: 'Crosshair', type: 'base' },
      { id: 'base:joystick', name: 'Virtual Joystick', type: 'base' },
      { id: 'base:prompt', name: 'Interaction Prompt', type: 'base' }
    ];

    baseItems.forEach(b => {
      const item = document.createElement('div');
      item.className = 'ui-editor-item';
      if (b.id === this._selectedElementId) item.classList.add('selected');

      const icon = document.createElement('span');
      icon.textContent = '[HUD]';
      icon.style.fontSize = '9px';
      icon.style.color = 'var(--accent)';
      icon.className = 'icon';
      item.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = b.name;
      item.appendChild(name);

      item.addEventListener('click', () => {
        this._selectedElementId = b.id;
        this._renderList();
        this._renderProps();
      });

      this.listContainer.appendChild(item);
    });

    // Custom UI section header
    const customHeader = document.createElement('div');
    customHeader.style.padding = '8px 8px 4px';
    customHeader.style.fontSize = '10px';
    customHeader.style.fontWeight = 'bold';
    customHeader.style.color = 'var(--text-dim)';
    customHeader.style.textTransform = 'uppercase';
    customHeader.textContent = 'Custom UI Elements';
    this.listContainer.appendChild(customHeader);

    const elements = this.uiManager.getAllElements();

    if (elements.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ui-editor-empty-hint';
      empty.textContent = 'No custom UI elements. Click + to add.';
      this.listContainer.appendChild(empty);
    }

    elements.forEach(el => {
      const item = document.createElement('div');
      item.className = 'ui-editor-item';
      if (el.id === this._selectedElementId) item.classList.add('selected');

      const icon = document.createElement('span');
      icon.textContent = el.type === 'label' ? 'T' : 'IMG';
      icon.className = 'icon';
      item.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = el.name || el.type;
      item.appendChild(name);

      const delBtn = document.createElement('button');
      delBtn.className = 'ui-del-btn';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.uiManager.removeElement(el.id);
        if (this._selectedElementId === el.id) {
          this._selectedElementId = 'base:crosshair';
        }
        this._renderList();
        this._renderProps();
      });
      item.appendChild(delBtn);

      item.addEventListener('click', () => {
        this._selectedElementId = el.id;
        this._renderList();
        this._renderProps();
      });

      this.listContainer.appendChild(item);
    });
  }

  _renderProps() {
    this.propsContainer.innerHTML = '';

    // Check if Base UI element is selected
    if (this._selectedElementId && this._selectedElementId.startsWith('base:')) {
      const baseKey = this._selectedElementId.replace('base:', '');
      const cfg = this.uiManager.baseUI[baseKey];
      if (!cfg) return;

      const title = document.createElement('div');
      title.className = 'props-title';
      title.textContent = `Base UI: ${baseKey.charAt(0).toUpperCase() + baseKey.slice(1)}`;
      this.propsContainer.appendChild(title);

      this._addCheckboxRow('Active / Visible', cfg.active !== false, (val) => {
        this.uiManager.setBaseUIActive(baseKey, val);
      });

      this._addAnchorSelector(cfg, (newAnchor) => {
        this.uiManager.updateBaseUI(baseKey, { anchor: newAnchor });
      });

      this._addVec2Row('Offset (X, Y)', cfg.offsetX || 0, cfg.offsetY || 0, (x, y) => {
        this.uiManager.updateBaseUI(baseKey, { offsetX: x, offsetY: y });
      });

      if (baseKey === 'crosshair') {
        this._addInputRow('Size', 'number', cfg.size || 16, (val) => {
          this.uiManager.updateBaseUI(baseKey, { size: parseInt(val) || 16 });
        });
        this._addColorRow('Color', cfg.color || '#ffffff', (val) => {
          this.uiManager.updateBaseUI(baseKey, { color: val });
        });
      } else if (baseKey === 'joystick') {
        this._addInputRow('Base Size', 'number', cfg.baseSize || 100, (val) => {
          this.uiManager.updateBaseUI(baseKey, { baseSize: parseInt(val) || 100 });
        });
        this._addInputRow('Thumb Size', 'number', cfg.thumbSize || 40, (val) => {
          this.uiManager.updateBaseUI(baseKey, { thumbSize: parseInt(val) || 40 });
        });
      } else if (baseKey === 'prompt') {
        this._addInputRow('Font Size', 'number', cfg.fontSize || 14, (val) => {
          this.uiManager.updateBaseUI(baseKey, { fontSize: parseInt(val) || 14 });
        });
        this._addColorRow('Text Color', cfg.color || '#cccccc', (val) => {
          this.uiManager.updateBaseUI(baseKey, { color: val });
        });
        this._addInputRow('Background (CSS)', 'text', cfg.bg || 'rgba(0,0,0,0.7)', (val) => {
          this.uiManager.updateBaseUI(baseKey, { bg: val });
        });
      }
      return;
    }

    const el = this.uiManager.getElement(this._selectedElementId);

    if (!el) {
      const empty = document.createElement('div');
      empty.className = 'ui-editor-empty-hint';
      empty.textContent = 'Select a UI element on the left to edit its layout and appearance.';
      this.propsContainer.appendChild(empty);
      return;
    }

    const title = document.createElement('div');
    title.className = 'props-title';
    title.textContent = `Edit ${el.type === 'label' ? 'LabelText' : 'Image'}: ${el.name}`;
    this.propsContainer.appendChild(title);

    // Name row
    this._addInputRow('Name', 'text', el.name, (val) => {
      this.uiManager.updateElement(el.id, { name: val });
      this._renderList();
    });

    // Visible checkbox
    this._addCheckboxRow('Visible', el.visible, (val) => {
      this.uiManager.updateElement(el.id, { visible: val });
    });

    // 3x3 Anchor selector
    this._addAnchorSelector(el);

    // Offsets
    this._addVec2Row('Offset (X, Y)', el.offsetX || 0, el.offsetY || 0, (x, y) => {
      this.uiManager.updateElement(el.id, { offsetX: x, offsetY: y });
    });

    // Size
    this._addVec2Row('Size (W, H)', el.width || 100, el.height || 40, (w, h) => {
      this.uiManager.updateElement(el.id, { width: w, height: h });
    });

    // Label specific props
    if (el.type === 'label') {
      this._addInputRow('Text', 'text', el.text || '', (val) => {
        this.uiManager.updateElement(el.id, { text: val });
      });

      this._addInputRow('Font Size', 'number', el.fontSize || 14, (val) => {
        this.uiManager.updateElement(el.id, { fontSize: parseInt(val) || 14 });
      });

      this._addColorRow('Text Color', el.textColor || '#ffffff', (val) => {
        this.uiManager.updateElement(el.id, { textColor: val });
      });

      this._addInputRow('Background (CSS)', 'text', el.bgColor || 'rgba(0,0,0,0.6)', (val) => {
        this.uiManager.updateElement(el.id, { bgColor: val });
      });

      this._addInputRow('Border Radius', 'number', el.borderRadius || 0, (val) => {
        this.uiManager.updateElement(el.id, { borderRadius: parseInt(val) || 0 });
      });

      this._addSelectRow('Align', ['left', 'center', 'right'], el.textAlign || 'center', (val) => {
        this.uiManager.updateElement(el.id, { textAlign: val });
      });
    }

    // Image specific props
    if (el.type === 'image') {
      this._addImageAssetSelector(el);

      this._addInputRow('Opacity', 'number', el.opacity ?? 1, (val) => {
        this.uiManager.updateElement(el.id, { opacity: parseFloat(val) });
      }, 0.1, 0, 1);

      this._addSelectRow('Fit Mode', ['contain', 'cover'], el.fit || 'contain', (val) => {
        this.uiManager.updateElement(el.id, { fit: val });
      });

      this._addInputRow('Border Radius', 'number', el.borderRadius || 0, (val) => {
        this.uiManager.updateElement(el.id, { borderRadius: parseInt(val) || 0 });
      });
    }
  }

  _addAnchorSelector(el, onChange = null) {
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
      });
      grid.appendChild(btn);
    });

    row.appendChild(grid);
    this.propsContainer.appendChild(row);
  }

  _addInputRow(label, type, val, onChange, step = 1, min = -Infinity, max = Infinity) {
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
    this.propsContainer.appendChild(row);
  }

  _addCheckboxRow(label, checked, onChange) {
    const row = document.createElement('div');
    row.className = 'props-row';
    const lbl = document.createElement('span');
    lbl.className = 'props-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = checked;
    cb.addEventListener('change', () => onChange(cb.checked));
    row.appendChild(cb);
    this.propsContainer.appendChild(row);
  }

  _addColorRow(label, val, onChange) {
    const row = document.createElement('div');
    row.className = 'props-row';
    const lbl = document.createElement('span');
    lbl.className = 'props-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'props-color-input';
    input.value = val;
    input.addEventListener('input', () => onChange(input.value));
    row.appendChild(input);
    this.propsContainer.appendChild(row);
  }

  _addSelectRow(label, options, current, onChange) {
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
    this.propsContainer.appendChild(row);
  }

  _addVec2Row(label, xVal, yVal, onChange) {
    const row = document.createElement('div');
    row.className = 'props-row';
    const lbl = document.createElement('span');
    lbl.className = 'props-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const wrap = document.createElement('div');
    wrap.className = 'props-vec2';

    const xIn = document.createElement('input');
    xIn.type = 'number';
    xIn.value = xVal;
    xIn.addEventListener('input', () => onChange(parseFloat(xIn.value) || 0, parseFloat(yIn.value) || 0));

    const yIn = document.createElement('input');
    yIn.type = 'number';
    yIn.value = yVal;
    yIn.addEventListener('input', () => onChange(parseFloat(xIn.value) || 0, parseFloat(yIn.value) || 0));

    wrap.appendChild(xIn);
    wrap.appendChild(yIn);
    row.appendChild(wrap);
    this.propsContainer.appendChild(row);
  }

  _addImageAssetSelector(el) {
    const row = document.createElement('div');
    row.className = 'props-row';
    const lbl = document.createElement('span');
    lbl.className = 'props-label';
    lbl.textContent = 'Texture';
    row.appendChild(lbl);

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.gap = '6px';
    wrap.style.alignItems = 'center';

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
    });
    wrap.appendChild(select);

    row.appendChild(wrap);
    this.propsContainer.appendChild(row);
  }
}

import * as THREE from 'three';

export class Inspector {
  constructor(container, sceneManager, assetManager, onOpenNodeGraph = null) {
    this.container = container;
    this.sceneManager = sceneManager;
    this.assetManager = assetManager;
    this.onOpenNodeGraph = onOpenNodeGraph;
    this._currentObject = null;

    this.panelHeader = document.createElement('div');
    this.panelHeader.className = 'panel-header';
    this.panelHeader.textContent = 'Inspector';
    this.container.appendChild(this.panelHeader);

    this.content = document.createElement('div');
    this.content.className = 'panel-content';
    this.container.appendChild(this.content);

    this.sceneManager.on('objectSelected', (obj) => this.showProperties(obj));
  }

  showProperties(obj) {
    this._currentObject = obj;
    this.content.innerHTML = '';

    if (!obj) {
      const empty = document.createElement('div');
      empty.className = 'no-selection';
      empty.textContent = 'Select an object to inspect';
      this.content.appendChild(empty);
      return;
    }

    this._addHeaderSection(obj);
    this._addTransformSection(obj);
    this._addMaterialSection(obj);
    this._addTextureSection(obj);
    this._addOverrideTextureSection(obj);
    this._addColliderSection(obj);
    this._addInteractionSection(obj);
  }

  _addHeaderSection(obj) {
    const wrap = document.createElement('div');
    wrap.className = 'inspector-header-card';
    wrap.style.padding = '8px 10px';
    wrap.style.borderBottom = '1px solid var(--border)';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '6px';

    const topRow = document.createElement('div');
    topRow.style.display = 'flex';
    topRow.style.alignItems = 'center';
    topRow.style.gap = '8px';

    const activeChk = document.createElement('input');
    activeChk.type = 'checkbox';
    activeChk.checked = obj.userData.active !== false;
    activeChk.title = 'Active';
    activeChk.style.cursor = 'pointer';
    activeChk.addEventListener('change', () => {
      this.sceneManager.setActive(obj.userData.id, activeChk.checked);
    });
    topRow.appendChild(activeChk);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'inspector-input';
    nameInput.value = obj.userData.name || obj.name || 'GameObject';
    nameInput.style.fontWeight = 'bold';
    nameInput.style.flex = '1';
    nameInput.addEventListener('change', () => {
      obj.userData.name = nameInput.value;
      obj.name = nameInput.value;
      this.sceneManager._emit('sceneChanged');
    });
    topRow.appendChild(nameInput);
    wrap.appendChild(topRow);

    const parentRow = document.createElement('div');
    parentRow.style.display = 'flex';
    parentRow.style.alignItems = 'center';
    parentRow.style.gap = '8px';

    const pLabel = document.createElement('span');
    pLabel.textContent = 'Parent:';
    pLabel.style.color = 'var(--text-muted)';
    pLabel.style.fontSize = '11px';
    pLabel.style.width = '45px';
    parentRow.appendChild(pLabel);

    const pSelect = document.createElement('select');
    pSelect.className = 'inspector-select';
    pSelect.style.flex = '1';

    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.textContent = '<None>';
    pSelect.appendChild(optNone);

    const all = this.sceneManager.getAllObjects();
    for (const other of all) {
      if (other.userData.id === obj.userData.id) continue;
      let isDescendant = false;
      let cur = other;
      while (cur && cur.userData?.parentId) {
        if (cur.userData.parentId === obj.userData.id) {
          isDescendant = true;
          break;
        }
        cur = this.sceneManager.getObject(cur.userData.parentId);
      }
      if (isDescendant) continue;

      const opt = document.createElement('option');
      opt.value = other.userData.id;
      opt.textContent = other.userData.name || other.name || 'Object';
      pSelect.appendChild(opt);
    }
    pSelect.value = obj.userData.parentId || '';
    pSelect.addEventListener('change', () => {
      this.sceneManager.setParent(obj.userData.id, pSelect.value || null);
    });
    parentRow.appendChild(pSelect);
    wrap.appendChild(parentRow);

    if (this.onOpenNodeGraph) {
      const nodeBtn = document.createElement('button');
      nodeBtn.className = 'inspector-btn';
      nodeBtn.innerHTML = '<span class="icon">⬡</span> Open in Node Graph';
      nodeBtn.addEventListener('click', () => {
        this.onOpenNodeGraph(obj.userData.id);
      });
      wrap.appendChild(nodeBtn);
    }

    this.content.appendChild(wrap);
  }

  refresh() {
    this.showProperties(this._currentObject);
  }

  _createSection(title, collapsed = false) {
    const section = document.createElement('div');
    section.className = 'inspector-section';

    const header = document.createElement('div');
    header.className = 'inspector-section-header';

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = collapsed ? '▶' : '▼';
    header.appendChild(arrow);

    const label = document.createElement('span');
    label.textContent = title;
    header.appendChild(label);

    section.appendChild(header);

    const body = document.createElement('div');
    body.className = 'inspector-section-body';
    if (collapsed) body.classList.add('collapsed');
    section.appendChild(body);

    header.addEventListener('click', () => {
      const isCollapsed = body.classList.toggle('collapsed');
      arrow.textContent = isCollapsed ? '▶' : '▼';
    });

    return { section, body };
  }

  _createRow(labelText) {
    const row = document.createElement('div');
    row.className = 'inspector-row';

    const label = document.createElement('div');
    label.className = 'inspector-label';
    label.textContent = labelText;
    label.title = labelText;
    row.appendChild(label);

    const value = document.createElement('div');
    value.className = 'inspector-value';
    row.appendChild(value);

    return { row, value };
  }

  _createNumberInput(val, onChange) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'inspector-input';
    input.step = '0.1';
    input.value = parseFloat(val).toFixed(2);
    input.addEventListener('change', () => onChange(parseFloat(input.value) || 0));
    return input;
  }

  _createVec3Row(labelText, vec, onChange, useDegrees = false) {
    const { row, value } = this._createRow(labelText);

    const vec3 = document.createElement('div');
    vec3.className = 'inspector-vec3';

    ['x', 'y', 'z'].forEach((axis) => {
      const field = document.createElement('div');
      field.className = 'vec-field';

      const lbl = document.createElement('span');
      lbl.className = `vec-label ${axis}`;
      lbl.textContent = axis.toUpperCase();
      field.appendChild(lbl);

      const rawVal = useDegrees ? THREE.MathUtils.radToDeg(vec[axis]) : vec[axis];
      const input = this._createNumberInput(rawVal, (v) => {
        const actual = useDegrees ? THREE.MathUtils.degToRad(v) : v;
        onChange(axis, actual);
      });
      field.appendChild(input);

      vec3.appendChild(field);
    });

    value.appendChild(vec3);
    return row;
  }

  _addTransformSection(obj) {
    const { section, body } = this._createSection('Transform');

    body.appendChild(this._createVec3Row('Position', obj.position, (axis, val) => {
      obj.position[axis] = val;
      obj.updateMatrixWorld(true);
      this.sceneManager._emit('sceneChanged');
    }));

    body.appendChild(this._createVec3Row('Rotation', obj.rotation, (axis, val) => {
      obj.rotation[axis] = val;
      obj.updateMatrixWorld(true);
      this.sceneManager._emit('sceneChanged');
    }, true));

    body.appendChild(this._createVec3Row('Scale', obj.scale, (axis, val) => {
      obj.scale[axis] = val;
      obj.updateMatrixWorld(true);
      this.sceneManager._emit('sceneChanged');
    }));

    this.content.appendChild(section);
  }

  _addMaterialSection(obj) {
    let material = null;
    if (obj.isMesh) {
      material = obj.material;
    } else {
      obj.traverse(c => { if (c.isMesh && !material) material = c.material; });
    }
    if (!material) return;

    const { section, body } = this._createSection('Material');

    const { row: colorRow, value: colorVal } = this._createRow('Color');
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'inspector-input';
    colorInput.value = '#' + material.color.getHexString();
    colorInput.addEventListener('input', () => {
      material.color.set(colorInput.value);
    });
    colorVal.appendChild(colorInput);
    body.appendChild(colorRow);

    const { row: opRow, value: opVal } = this._createRow('Opacity');
    const opInput = document.createElement('input');
    opInput.type = 'range';
    opInput.min = '0';
    opInput.max = '1';
    opInput.step = '0.05';
    opInput.value = material.opacity;
    opInput.style.flex = '1';
    opInput.addEventListener('input', () => {
      material.opacity = parseFloat(opInput.value);
      material.transparent = material.opacity < 1;
    });
    opVal.appendChild(opInput);
    body.appendChild(opRow);

    this.content.appendChild(section);
  }

  _addTextureSection(obj) {
    const { section, body } = this._createSection('Base Texture');

    const slot = document.createElement('div');
    slot.className = 'texture-slot';

    const preview = document.createElement('img');
    preview.className = 'texture-preview';

    const baseId = obj.userData?.textures?.base;
    if (baseId) {
      const asset = this.assetManager.getTexture(baseId);
      if (asset) preview.src = asset.preview;
    }

    slot.appendChild(preview);

    const info = document.createElement('div');
    info.className = 'texture-slot-info';

    const name = document.createElement('div');
    name.className = 'texture-slot-name';
    name.textContent = baseId ? (this.assetManager.getTexture(baseId)?.name || 'texture') : 'None';
    info.appendChild(name);

    const actions = document.createElement('div');
    actions.className = 'texture-slot-actions';

    const browseBtn = document.createElement('button');
    browseBtn.className = 'btn-small';
    browseBtn.textContent = 'Browse';
    browseBtn.addEventListener('click', () => this._browseTexture(obj, 'base'));
    actions.appendChild(browseBtn);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn-small';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => {
      this.assetManager.clearBaseTexture(obj);
      this.refresh();
    });
    actions.appendChild(clearBtn);

    info.appendChild(actions);
    slot.appendChild(info);
    body.appendChild(slot);

    this.content.appendChild(section);
  }

  _addOverrideTextureSection(obj) {
    const { section, body } = this._createSection('Shadow / Overlay Textures');

    const overrides = obj.userData?.textures?.overrides || [];
    const list = document.createElement('div');
    list.className = 'override-list';

    overrides.forEach((ov, i) => {
      const item = document.createElement('div');
      item.className = 'override-item';

      const preview = document.createElement('img');
      preview.className = 'texture-preview';
      const asset = this.assetManager.getTexture(ov.id);
      if (asset) preview.src = asset.preview;
      item.appendChild(preview);

      const controls = document.createElement('div');
      controls.className = 'override-item-controls';

      const opRow = document.createElement('div');
      opRow.className = 'override-item-row';
      const opLabel = document.createElement('label');
      opLabel.textContent = 'Opacity';
      opRow.appendChild(opLabel);
      const opSlider = document.createElement('input');
      opSlider.type = 'range';
      opSlider.min = '0';
      opSlider.max = '1';
      opSlider.step = '0.05';
      opSlider.value = ov.opacity;
      opSlider.addEventListener('input', () => {
        this.assetManager.updateOverride(obj, i, { opacity: parseFloat(opSlider.value) });
      });
      opRow.appendChild(opSlider);
      controls.appendChild(opRow);

      const blendRow = document.createElement('div');
      blendRow.className = 'override-item-row';
      const blendLabel = document.createElement('label');
      blendLabel.textContent = 'Blend';
      blendRow.appendChild(blendLabel);
      const blendSelect = document.createElement('select');
      blendSelect.innerHTML = '<option value="multiply">Multiply</option><option value="normal">Normal</option>';
      blendSelect.value = ov.blendMode;
      blendSelect.addEventListener('change', () => {
        this.assetManager.updateOverride(obj, i, { blendMode: blendSelect.value });
      });
      blendRow.appendChild(blendSelect);
      controls.appendChild(blendRow);

      item.appendChild(controls);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => {
        this.assetManager.removeOverrideTexture(obj, i);
        this.refresh();
      });
      item.appendChild(removeBtn);

      list.appendChild(item);
    });

    body.appendChild(list);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-override';
    addBtn.textContent = '+ Add Shadow / Overlay';
    addBtn.addEventListener('click', () => this._browseTexture(obj, 'override'));
    body.appendChild(addBtn);

    this.content.appendChild(section);
  }

  _addColliderSection(obj) {
    const { section, body } = this._createSection('Collider');
    const ud = obj.userData;

    const { row: enableRow, value: enableVal } = this._createRow('Enabled');
    const enableCb = document.createElement('label');
    enableCb.className = 'inspector-checkbox';
    const enableInput = document.createElement('input');
    enableInput.type = 'checkbox';
    enableInput.checked = ud.collider?.enabled || false;
    enableInput.addEventListener('change', () => {
      if (!ud.collider) ud.collider = { enabled: false, isTrigger: false };
      ud.collider.enabled = enableInput.checked;
      this.sceneManager._emit('sceneChanged');
    });
    enableCb.appendChild(enableInput);
    enableCb.appendChild(document.createTextNode('Active'));
    enableVal.appendChild(enableCb);
    body.appendChild(enableRow);

    const { row: trigRow, value: trigVal } = this._createRow('isTrigger');
    const trigCb = document.createElement('label');
    trigCb.className = 'inspector-checkbox';
    const trigInput = document.createElement('input');
    trigInput.type = 'checkbox';
    trigInput.checked = ud.collider?.isTrigger || false;
    trigInput.addEventListener('change', () => {
      if (!ud.collider) ud.collider = { enabled: false, isTrigger: false };
      ud.collider.isTrigger = trigInput.checked;
      this.sceneManager._emit('sceneChanged');
    });
    trigCb.appendChild(trigInput);
    trigCb.appendChild(document.createTextNode('Trigger'));
    trigVal.appendChild(trigCb);
    body.appendChild(trigRow);

    this.content.appendChild(section);
  }

  _addInteractionSection(obj) {
    const { section, body } = this._createSection('Interaction');
    const ud = obj.userData;

    const { row: enableRow, value: enableVal } = this._createRow('Enabled');
    const enableCb = document.createElement('label');
    enableCb.className = 'inspector-checkbox';
    const enableInput = document.createElement('input');
    enableInput.type = 'checkbox';
    enableInput.checked = ud.interaction?.enabled || false;
    enableInput.addEventListener('change', () => {
      if (!ud.interaction) ud.interaction = { enabled: false, type: 'inspect', promptText: 'Press E to interact' };
      ud.interaction.enabled = enableInput.checked;
    });
    enableCb.appendChild(enableInput);
    enableCb.appendChild(document.createTextNode('Active'));
    enableVal.appendChild(enableCb);
    body.appendChild(enableRow);

    const { row: typeRow, value: typeVal } = this._createRow('Type');
    const typeSelect = document.createElement('select');
    typeSelect.className = 'inspector-select';
    typeSelect.innerHTML = '<option value="inspect">Inspect (Focus & Rotate)</option><option value="none">None</option>';
    typeSelect.value = ud.interaction?.type || 'inspect';
    typeSelect.addEventListener('change', () => {
      if (!ud.interaction) ud.interaction = { enabled: false, type: 'inspect', promptText: 'Press E to interact' };
      ud.interaction.type = typeSelect.value;
    });
    typeVal.appendChild(typeSelect);
    body.appendChild(typeRow);

    const { row: promptRow, value: promptVal } = this._createRow('Prompt');
    const promptInput = document.createElement('input');
    promptInput.type = 'text';
    promptInput.className = 'inspector-input';
    promptInput.value = ud.interaction?.promptText || 'Press E to interact';
    promptInput.addEventListener('change', () => {
      if (!ud.interaction) ud.interaction = { enabled: false, type: 'inspect', promptText: '' };
      ud.interaction.promptText = promptInput.value;
    });
    promptVal.appendChild(promptInput);
    body.appendChild(promptRow);

    this.content.appendChild(section);
  }

  _browseTexture(obj, mode) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      const asset = await this.assetManager.importTexture(file);
      if (mode === 'base') {
        this.assetManager.applyBaseTexture(obj, asset.id);
      } else {
        this.assetManager.addOverrideTexture(obj, asset.id, 0.5, 'multiply');
      }
      this.refresh();
    });
    input.click();
  }
}

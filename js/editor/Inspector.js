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
    if (typeof this.sceneManager.on === 'function') {
      this.sceneManager.on('projectAssetsChanged', () => {
        if (this._currentObject) this.refresh();
      });
    }
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

    if (obj.userData?.type === 'imported_mesh' && obj.children.length > 0) {
      const hasUnseparated = obj.children.some(c => !c.userData?.id || !this.sceneManager.getObject(c.userData.id));
      if (hasUnseparated) {
        const sepBtn = document.createElement('button');
        sepBtn.className = 'inspector-btn';
        sepBtn.textContent = `Separate Sub-Meshes into GameObjects (${obj.children.length} Parts)`;
        sepBtn.title = 'Separate each mesh piece into its own GameObject in the hierarchy and isolate materials';
        sepBtn.addEventListener('click', () => {
          this.assetManager.setupSeparatedObjects(obj, obj.userData.meshAssetId);
          obj.children.forEach(c => {
            if (c.userData?.id) {
              this.sceneManager.addObject(c);
            }
          });
          this.sceneManager._emit('sceneChanged');
          this.refresh();
        });
        wrap.appendChild(sepBtn);
      }
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

  // #region Material Management
  _collectMaterials(obj) {
    const list = [];
    const traverseMesh = (mesh) => {
      if (!mesh.isMesh || !mesh.material) return;
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat, idx) => {
          list.push({
            mesh,
            material: mat,
            slotIndex: idx,
            name: mat.name || `${mesh.name || 'Mesh'}_Mat_${idx}`
          });
        });
      } else {
        list.push({
          mesh,
          material: mesh.material,
          slotIndex: 0,
          name: mesh.material.name || `${mesh.name || 'Mesh'}_Mat`
        });
      }
    };

    if (obj.isMesh) {
      traverseMesh(obj);
    } else {
      obj.traverse(traverseMesh);
    }
    return list;
  }

  _collectMeshes(obj) {
    const list = [];
    if (obj.isMesh) {
      list.push(obj);
    } else {
      obj.traverse(c => {
        if (c.isMesh) list.push(c);
      });
    }
    return list;
  }

  _addMaterialSection(obj) {
    const meshes = this._collectMeshes(obj);
    const slots = this._collectMaterials(obj);
    if (meshes.length === 0 && slots.length === 0) return;

    const { section, body } = this._createSection('Materials');

    let currentSlotIndex = 0;
    if (this._selectedMaterialSlot !== undefined && this._selectedMaterialSlot < slots.length) {
      currentSlotIndex = Math.max(0, this._selectedMaterialSlot);
    }
    this._selectedMaterialSlot = currentSlotIndex;

    const slotsContainer = document.createElement('div');
    slotsContainer.className = 'material-slots-container';

    const slotsHeader = document.createElement('div');
    slotsHeader.className = 'material-slots-header';

    const slotsTitle = document.createElement('span');
    slotsTitle.textContent = `Material Slots (${slots.length})`;
    slotsHeader.appendChild(slotsTitle);

    const slotsActions = document.createElement('div');
    slotsActions.className = 'material-slots-actions';

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-icon';
    addBtn.title = 'Add Material Slot';
    addBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    addBtn.addEventListener('click', () => {
      const targetMesh = (slots[currentSlotIndex] && slots[currentSlotIndex].mesh) || meshes[0];
      if (!targetMesh) return;

      const newMat = new THREE.MeshStandardMaterial({
        name: `Mat_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        color: 0xffffff,
        roughness: 0.8,
        metalness: 0.1
      });

      if (Array.isArray(targetMesh.material)) {
        targetMesh.material.push(newMat);
      } else if (targetMesh.material) {
        targetMesh.material = [targetMesh.material, newMat];
      } else {
        targetMesh.material = newMat;
      }

      const updatedSlots = this._collectMaterials(obj);
      this._selectedMaterialSlot = Math.max(0, updatedSlots.length - 1);
      this.sceneManager._emit('sceneChanged');
      this.refresh();
    });
    slotsActions.appendChild(addBtn);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-icon';
    removeBtn.title = 'Remove Selected Material Slot';
    removeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    removeBtn.addEventListener('click', () => {
      if (slots.length === 0) return;
      const targetSlot = slots[currentSlotIndex] || slots[0];
      const targetMesh = targetSlot.mesh;

      if (Array.isArray(targetMesh.material)) {
        targetMesh.material.splice(targetSlot.slotIndex, 1);
        if (targetMesh.material.length === 1) {
          targetMesh.material = targetMesh.material[0];
        }
      } else {
        targetMesh.material = new THREE.MeshStandardMaterial({
          name: 'Default_Mat',
          color: 0xcccccc,
          roughness: 0.9,
          metalness: 0.0
        });
      }

      this._selectedMaterialSlot = Math.max(0, currentSlotIndex - 1);
      this.sceneManager._emit('sceneChanged');
      this.refresh();
    });
    slotsActions.appendChild(removeBtn);

    slotsHeader.appendChild(slotsActions);
    slotsContainer.appendChild(slotsHeader);

    const slotsList = document.createElement('div');
    slotsList.className = 'material-slots-list';

    slots.forEach((s, idx) => {
      const item = document.createElement('div');
      item.className = 'material-slot-item' + (idx === currentSlotIndex ? ' selected' : '');

      const dot = document.createElement('span');
      dot.className = 'material-slot-dot';
      const hex = s.material.color ? '#' + s.material.color.getHexString() : '#cccccc';
      dot.style.background = hex;
      item.appendChild(dot);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'material-slot-item-name';
      nameSpan.textContent = `[${idx}] ${s.name}`;
      item.appendChild(nameSpan);

      const badge = document.createElement('span');
      badge.className = 'slot-badge';
      badge.textContent = s.mesh.name || 'Mesh';
      item.appendChild(badge);

      item.addEventListener('click', () => {
        this._selectedMaterialSlot = idx;
        this.refresh();
      });

      slotsList.appendChild(item);
    });

    if (slots.length === 0) {
      const noSlots = document.createElement('div');
      noSlots.className = 'material-slot-item';
      noSlots.style.color = 'var(--text-muted)';
      noSlots.textContent = 'No materials found';
      slotsList.appendChild(noSlots);
    }

    slotsContainer.appendChild(slotsList);
    body.appendChild(slotsContainer);

    if (slots.length === 0) {
      this.content.appendChild(section);
      return;
    }

    const currentSlot = slots[currentSlotIndex] || slots[0];
    const mat = currentSlot.material;

    const detailPanel = document.createElement('div');
    detailPanel.className = 'material-detail-panel';

    const { row: nameRow, value: nameVal } = this._createRow('Name');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'inspector-input';
    nameInput.value = mat.name || currentSlot.name;
    nameInput.addEventListener('change', () => {
      mat.name = nameInput.value.trim() || 'Material';
      this.sceneManager._emit('sceneChanged');
      this.refresh();
    });
    nameVal.appendChild(nameInput);
    detailPanel.appendChild(nameRow);

    if (meshes.length > 1 || Array.isArray(currentSlot.mesh.material)) {
      const { row: meshRow, value: meshVal } = this._createRow('Mapping');
      const meshSelect = document.createElement('select');
      meshSelect.className = 'inspector-select';
      meshes.forEach((m, mIdx) => {
        const opt = document.createElement('option');
        opt.value = m.uuid;
        const triCount = m.geometry?.attributes?.position?.count ? Math.round(m.geometry.attributes.position.count / 3) : 0;
        opt.textContent = `${m.name || `SubMesh_${mIdx}`}${triCount > 0 ? ` (${triCount} tris)` : ''}`;
        if (m.uuid === currentSlot.mesh.uuid) opt.selected = true;
        meshSelect.appendChild(opt);
      });

      meshSelect.addEventListener('change', () => {
        const newTargetMesh = meshes.find(m => m.uuid === meshSelect.value);
        if (!newTargetMesh || newTargetMesh === currentSlot.mesh) return;

        if (Array.isArray(currentSlot.mesh.material)) {
          currentSlot.mesh.material.splice(currentSlot.slotIndex, 1);
          if (currentSlot.mesh.material.length === 1) currentSlot.mesh.material = currentSlot.mesh.material[0];
        }

        if (Array.isArray(newTargetMesh.material)) {
          newTargetMesh.material.push(mat);
        } else if (newTargetMesh.material) {
          newTargetMesh.material = [newTargetMesh.material, mat];
        } else {
          newTargetMesh.material = mat;
        }

        this.sceneManager._emit('sceneChanged');
        this.refresh();
      });

      meshVal.appendChild(meshSelect);
      detailPanel.appendChild(meshRow);
    }

    if (mat.color) {
      const { row: colorRow, value: colorVal } = this._createRow('Base Color');
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'inspector-input';
      colorInput.style.width = '32px';
      colorInput.style.padding = '1px 2px';
      colorInput.value = '#' + mat.color.getHexString();

      const hexText = document.createElement('input');
      hexText.type = 'text';
      hexText.className = 'inspector-input';
      hexText.style.flex = '1';
      hexText.style.fontFamily = 'var(--font-mono)';
      hexText.value = '#' + mat.color.getHexString().toUpperCase();

      colorInput.addEventListener('input', () => {
        mat.color.set(colorInput.value);
        hexText.value = colorInput.value.toUpperCase();
        const dot = slotsList.children[currentSlotIndex]?.querySelector('.material-slot-dot');
        if (dot) dot.style.background = colorInput.value;
        this.sceneManager._emit('sceneChanged');
      });

      hexText.addEventListener('change', () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(hexText.value)) {
          mat.color.set(hexText.value);
          colorInput.value = hexText.value;
          const dot = slotsList.children[currentSlotIndex]?.querySelector('.material-slot-dot');
          if (dot) dot.style.background = hexText.value;
          this.sceneManager._emit('sceneChanged');
        }
      });

      const whiteQuick = document.createElement('button');
      whiteQuick.className = 'btn-small';
      whiteQuick.textContent = '#FFF';
      whiteQuick.title = 'Set to #FFFFFF (recommended for baked textures)';
      whiteQuick.addEventListener('click', () => {
        mat.color.setHex(0xffffff);
        colorInput.value = '#ffffff';
        hexText.value = '#FFFFFF';
        const dot = slotsList.children[currentSlotIndex]?.querySelector('.material-slot-dot');
        if (dot) dot.style.background = '#ffffff';
        this.sceneManager._emit('sceneChanged');
      });

      colorVal.appendChild(colorInput);
      colorVal.appendChild(hexText);
      colorVal.appendChild(whiteQuick);
      detailPanel.appendChild(colorRow);
    }

    const { row: texRow, value: texVal } = this._createRow('Base Texture');
    texVal.style.display = 'flex';
    texVal.style.flexDirection = 'column';
    texVal.style.gap = '6px';
    texVal.style.width = '100%';

    const texTopRow = document.createElement('div');
    texTopRow.style.display = 'flex';
    texTopRow.style.alignItems = 'center';
    texTopRow.style.gap = '8px';

    const texThumb = document.createElement('div');
    texThumb.style.width = '36px';
    texThumb.style.height = '36px';
    texThumb.style.borderRadius = 'var(--radius)';
    texThumb.style.border = '1px solid var(--border-subtle)';
    texThumb.style.background = 'var(--bg-input)';
    texThumb.style.backgroundSize = 'cover';
    texThumb.style.backgroundPosition = 'center';
    texThumb.style.flexShrink = '0';

    let currentTexId = mat.userData?.textureId;
    if (!currentTexId && mat.map) {
      const allTex = this.assetManager.getAllTextures();
      const matched = allTex.find(t => t.texture === mat.map);
      if (matched) currentTexId = matched.id;
    }

    if (currentTexId) {
      const asset = this.assetManager.getTexture(currentTexId);
      if (asset && asset.preview) {
        texThumb.style.backgroundImage = `url(${asset.preview})`;
      }
    }

    texTopRow.appendChild(texThumb);

    const texSelect = document.createElement('select');
    texSelect.className = 'inspector-select';
    texSelect.style.flex = '1';

    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.textContent = '-- None (No Texture) --';
    texSelect.appendChild(optNone);

    const allTextures = this.assetManager.getAllTextures();
    allTextures.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      if (t.id === currentTexId) opt.selected = true;
      texSelect.appendChild(opt);
    });

    texSelect.addEventListener('change', () => {
      if (texSelect.value) {
        const tAsset = this.assetManager.getTexture(texSelect.value);
        if (tAsset && tAsset.texture) {
          mat.map = tAsset.texture;
          if (obj.userData?.type === 'imported_mesh') mat.map.flipY = false;
          mat.userData = mat.userData || {};
          mat.userData.textureId = texSelect.value;
          mat.needsUpdate = true;
          if (tAsset.preview) texThumb.style.backgroundImage = `url(${tAsset.preview})`;
          if (obj.userData?.textures) obj.userData.textures.base = texSelect.value;
        }
      } else {
        mat.map = null;
        if (mat.userData) delete mat.userData.textureId;
        mat.needsUpdate = true;
        texThumb.style.backgroundImage = 'none';
        if (obj.userData?.textures) obj.userData.textures.base = null;
      }
      this.sceneManager._emit('sceneChanged');
      this.refresh();
    });
    texTopRow.appendChild(texSelect);
    texVal.appendChild(texTopRow);

    const texBtnRow = document.createElement('div');
    texBtnRow.style.display = 'flex';
    texBtnRow.style.gap = '4px';

    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn-small';
    uploadBtn.style.flex = '1';
    uploadBtn.textContent = 'Upload New...';
    uploadBtn.addEventListener('click', () => this._browseTexture(obj, 'base', mat));
    texBtnRow.appendChild(uploadBtn);

    if (currentTexId || mat.map) {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'btn-small';
      clearBtn.textContent = 'Clear';
      clearBtn.addEventListener('click', () => {
        mat.map = null;
        if (mat.userData) delete mat.userData.textureId;
        mat.needsUpdate = true;
        if (obj.userData?.textures) obj.userData.textures.base = null;
        this.sceneManager._emit('sceneChanged');
        this.refresh();
      });
      texBtnRow.appendChild(clearBtn);
    }
    texVal.appendChild(texBtnRow);
    detailPanel.appendChild(texRow);

    const { row: ovRow, value: ovVal } = this._createRow('Overlays');
    ovVal.style.display = 'flex';
    ovVal.style.flexDirection = 'column';
    ovVal.style.gap = '6px';
    ovVal.style.width = '100%';

    const overrides = obj.userData?.textures?.overrides || [];
    if (overrides.length > 0) {
      const ovList = document.createElement('div');
      ovList.className = 'override-list';

      overrides.forEach((ov, i) => {
        const item = document.createElement('div');
        item.className = 'override-item';

        const asset = this.assetManager.getTexture(ov.id);
        const preview = document.createElement('img');
        preview.className = 'override-thumb';
        if (asset && asset.preview) preview.src = asset.preview;
        item.appendChild(preview);

        const controls = document.createElement('div');
        controls.className = 'override-controls';

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
        removeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        removeBtn.addEventListener('click', () => {
          this.assetManager.removeOverrideTexture(obj, i);
          this.refresh();
        });
        item.appendChild(removeBtn);

        ovList.appendChild(item);
      });

      ovVal.appendChild(ovList);
    }

    const ovBtnRow = document.createElement('div');
    ovBtnRow.style.display = 'flex';
    ovBtnRow.style.gap = '4px';

    if (allTextures.length > 0) {
      const addOvBtn = document.createElement('button');
      addOvBtn.className = 'btn-small';
      addOvBtn.textContent = '+ Add From Project';
      addOvBtn.style.flex = '1';
      addOvBtn.addEventListener('click', () => {
        this.assetManager.addOverrideTexture(obj, allTextures[0].id, 0.5, 'multiply');
        this.sceneManager._emit('sceneChanged');
        this.refresh();
      });
      ovBtnRow.appendChild(addOvBtn);
    }

    const uploadOvBtn = document.createElement('button');
    uploadOvBtn.className = 'btn-small';
    uploadOvBtn.textContent = '+ Upload Overlay...';
    uploadOvBtn.style.flex = '1';
    uploadOvBtn.addEventListener('click', () => this._browseTexture(obj, 'override'));
    ovBtnRow.appendChild(uploadOvBtn);

    ovVal.appendChild(ovBtnRow);
    detailPanel.appendChild(ovRow);

    if (mat.roughness !== undefined) {
      const { row: roughRow, value: roughVal } = this._createRow('Roughness');
      const roughInput = document.createElement('input');
      roughInput.type = 'range';
      roughInput.min = '0';
      roughInput.max = '1';
      roughInput.step = '0.01';
      roughInput.value = mat.roughness;
      roughInput.style.flex = '1';

      const roughNum = document.createElement('span');
      roughNum.style.width = '32px';
      roughNum.style.textAlign = 'right';
      roughNum.style.fontFamily = 'var(--font-mono)';
      roughNum.style.fontSize = '10px';
      roughNum.textContent = Number(mat.roughness).toFixed(2);

      roughInput.addEventListener('input', () => {
        mat.roughness = parseFloat(roughInput.value);
        roughNum.textContent = Number(mat.roughness).toFixed(2);
        this.sceneManager._emit('sceneChanged');
      });

      roughVal.appendChild(roughInput);
      roughVal.appendChild(roughNum);
      detailPanel.appendChild(roughRow);
    }

    if (mat.metalness !== undefined) {
      const { row: metalRow, value: metalVal } = this._createRow('Metalness');
      const metalInput = document.createElement('input');
      metalInput.type = 'range';
      metalInput.min = '0';
      metalInput.max = '1';
      metalInput.step = '0.01';
      metalInput.value = mat.metalness;
      metalInput.style.flex = '1';

      const metalNum = document.createElement('span');
      metalNum.style.width = '32px';
      metalNum.style.textAlign = 'right';
      metalNum.style.fontFamily = 'var(--font-mono)';
      metalNum.style.fontSize = '10px';
      metalNum.textContent = Number(mat.metalness).toFixed(2);

      metalInput.addEventListener('input', () => {
        mat.metalness = parseFloat(metalInput.value);
        metalNum.textContent = Number(mat.metalness).toFixed(2);
        this.sceneManager._emit('sceneChanged');
      });

      metalVal.appendChild(metalInput);
      metalVal.appendChild(metalNum);
      detailPanel.appendChild(metalRow);
    }

    const { row: opRow, value: opVal } = this._createRow('Opacity');
    const opInput = document.createElement('input');
    opInput.type = 'range';
    opInput.min = '0';
    opInput.max = '1';
    opInput.step = '0.01';
    opInput.value = mat.opacity !== undefined ? mat.opacity : 1;
    opInput.style.flex = '1';

    const opNum = document.createElement('span');
    opNum.style.width = '32px';
    opNum.style.textAlign = 'right';
    opNum.style.fontFamily = 'var(--font-mono)';
    opNum.style.fontSize = '10px';
    opNum.textContent = Number(mat.opacity ?? 1).toFixed(2);

    opInput.addEventListener('input', () => {
      mat.opacity = parseFloat(opInput.value);
      mat.transparent = mat.opacity < 1;
      opNum.textContent = Number(mat.opacity).toFixed(2);
      this.sceneManager._emit('sceneChanged');
    });

    opVal.appendChild(opInput);
    opVal.appendChild(opNum);
    detailPanel.appendChild(opRow);

    const { row: optRow, value: optVal } = this._createRow('Options');
    optVal.style.display = 'flex';
    optVal.style.gap = '8px';
    optVal.style.flexWrap = 'wrap';

    const transLbl = document.createElement('label');
    transLbl.className = 'inspector-checkbox';
    const transChk = document.createElement('input');
    transChk.type = 'checkbox';
    transChk.checked = !!mat.transparent;
    transChk.addEventListener('change', () => {
      mat.transparent = transChk.checked;
      mat.needsUpdate = true;
      this.sceneManager._emit('sceneChanged');
    });
    transLbl.appendChild(transChk);
    transLbl.appendChild(document.createTextNode('Alpha'));
    optVal.appendChild(transLbl);

    const wireLbl = document.createElement('label');
    wireLbl.className = 'inspector-checkbox';
    const wireChk = document.createElement('input');
    wireChk.type = 'checkbox';
    wireChk.checked = !!mat.wireframe;
    wireChk.addEventListener('change', () => {
      mat.wireframe = wireChk.checked;
      mat.needsUpdate = true;
      this.sceneManager._emit('sceneChanged');
    });
    wireLbl.appendChild(wireChk);
    wireLbl.appendChild(document.createTextNode('Wire'));
    optVal.appendChild(wireLbl);

    const doubleLbl = document.createElement('label');
    doubleLbl.className = 'inspector-checkbox';
    const doubleChk = document.createElement('input');
    doubleChk.type = 'checkbox';
    doubleChk.checked = mat.side === THREE.DoubleSide;
    doubleChk.addEventListener('change', () => {
      mat.side = doubleChk.checked ? THREE.DoubleSide : THREE.FrontSide;
      mat.needsUpdate = true;
      this.sceneManager._emit('sceneChanged');
    });
    doubleLbl.appendChild(doubleChk);
    doubleLbl.appendChild(document.createTextNode('DoubleSide'));
    optVal.appendChild(doubleLbl);

    detailPanel.appendChild(optRow);

    body.appendChild(detailPanel);
    this.content.appendChild(section);
  }
  // #endregion

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

  _browseTexture(obj, mode, targetMat) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      const asset = await this.assetManager.importTexture(file);
      if (mode === 'base') {
        if (targetMat) {
          targetMat.map = asset.texture;
          if (obj.userData?.type === 'imported_mesh') targetMat.map.flipY = false;
          targetMat.userData = targetMat.userData || {};
          targetMat.userData.textureId = asset.id;
          targetMat.needsUpdate = true;
        }
        this.assetManager.applyBaseTexture(obj, asset.id);
      } else {
        this.assetManager.addOverrideTexture(obj, asset.id, 0.5, 'multiply');
      }
      this.sceneManager._emit('projectAssetsChanged');
      this.sceneManager._emit('sceneChanged');
      this.refresh();
    });
    input.click();
  }
}

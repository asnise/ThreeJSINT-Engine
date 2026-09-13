import * as THREE from 'three';
import { Primitives } from '../engine/Primitives.js';

export class Inspector {
  //#region [Variables/Fields]
  container = null;
  sceneManager = null;
  assetManager = null;
  onOpenNodeGraph = null;
  _currentObject = null;
  _selectedMaterialSlot = 0;
  panelHeader = null;
  content = null;
  //#endregion

  //#region [Properties]
  get currentObject() {
    return this._currentObject;
  }
  //#endregion

  //#region [Unity Methods]
  //#endregion

  //#region [Public Methods]
  constructor(container, sceneManager, assetManager, onOpenNodeGraph = null) {
    this.container = container;
    this.sceneManager = sceneManager;
    this.assetManager = assetManager;

    if (typeof onOpenNodeGraph === 'object' && onOpenNodeGraph !== null) {
      this.itemInspector = onOpenNodeGraph.itemInspector || null;
      this.onOpenNodeGraph = onOpenNodeGraph.onOpenNodeGraph || null;
    } else {
      this.onOpenNodeGraph = onOpenNodeGraph;
      this.itemInspector = null;
    }

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

    if (!obj.userData) obj.userData = {};
    if (!obj.userData.components) obj.userData.components = {};

    this._ensureComponentCompatibility(obj);

    this._addHeaderSection(obj);
    this._addTransformSection(obj);

    const comps = obj.userData.components;

    if (comps.mesh) {
      this._renderMeshComponent(obj);
    }
    if (comps.collider) {
      this._renderColliderComponent(obj);
    }
    if (comps.interaction) {
      this._renderInteractionComponent(obj);
    }
    if (comps.playerController) {
      this._renderPlayerControllerComponent(obj);
    }
    if (comps.camera) {
      this._renderCameraComponent(obj);
    }
    if (comps.nodeGraph) {
      this._renderNodeGraphComponent(obj);
    }

    this._renderAddComponentSection(obj);
  }

  refresh() {
    this.showProperties(this._currentObject);
  }
  //#endregion

  //#region [Private Methods]
  _ensureComponentCompatibility(obj) {
    const ud = obj.userData;
    const comps = ud.components;

    if (ud.primitiveType && !comps.mesh) {
      comps.mesh = {
        enabled: true,
        geometryType: ud.primitiveType,
        color: '#888888',
        roughness: 0.5,
        metalness: 0.0,
        opacity: 1.0,
        transparent: false,
        wireframe: false,
        textureId: ud.textures?.base || null,
        meshAssetId: ud.meshAssetId || null
      };
    }

    if (ud.collider && ud.collider.enabled !== undefined && !comps.collider) {
      comps.collider = {
        enabled: ud.collider.enabled,
        type: ud.collider.type || 'box',
        isTrigger: !!ud.collider.isTrigger,
        size: ud.collider.size || { x: 1, y: 1, z: 1 },
        center: ud.collider.center || { x: 0, y: 0, z: 0 },
        radius: ud.collider.radius !== undefined ? ud.collider.radius : 0.5,
        height: ud.collider.height !== undefined ? ud.collider.height : 1.0
      };
    }

    if (ud.interaction && ud.interaction.enabled !== undefined && !comps.interaction) {
      comps.interaction = {
        enabled: ud.interaction.enabled,
        type: ud.interaction.type || 'inspect',
        promptText: ud.interaction.promptText || 'Press E to interact',
        maxDistance: ud.interaction.maxDistance || 3
      };
    }

    if ((ud.type === 'player_controller' || ud.playerController) && !comps.playerController) {
      comps.playerController = {
        enabled: true,
        moveSpeed: ud.playerController?.moveSpeed !== undefined ? ud.playerController.moveSpeed : 5,
        lerpSpeed: ud.playerController?.lerpSpeed !== undefined ? ud.playerController.lerpSpeed : 10,
        jumpForce: ud.playerController?.jumpForce !== undefined ? ud.playerController.jumpForce : 8,
        gravity: ud.playerController?.gravity !== undefined ? ud.playerController.gravity : -15,
        playerRadius: ud.playerController?.playerRadius !== undefined ? ud.playerController.playerRadius : 0.3,
        playerHeight: ud.playerController?.playerHeight !== undefined ? ud.playerController.playerHeight : 1.7,
        cameraOffsetY: ud.playerController?.cameraOffsetY !== undefined ? ud.playerController.cameraOffsetY : 1.6
      };
    }

    if ((ud.type === 'camera' || obj.isCamera || ud.camera) && !comps.camera) {
      comps.camera = {
        enabled: true,
        fov: obj.fov || ud.camera?.fov || 75,
        near: obj.near || ud.camera?.near || 0.1,
        far: obj.far || ud.camera?.far || 1000,
        isMainCamera: ud.camera?.isMainCamera !== false
      };
    }
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

    if (this.onOpenNodeGraph && !obj.userData.components?.nodeGraph) {
      const nodeBtn = document.createElement('button');
      nodeBtn.className = 'inspector-btn';
      nodeBtn.innerHTML = '<span class="icon">&#x2B21;</span> Open in Node Graph';
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

  _createNumberInput(val, onChange, step = '0.1') {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'inspector-input';
    input.step = String(step);
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

  _createComponentCard(title, compKey, obj, iconSvg, contentBuilder) {
    const compData = obj.userData?.components?.[compKey];
    if (!compData) return;

    const card = document.createElement('div');
    card.className = 'inspector-component-card';

    const header = document.createElement('div');
    header.className = 'component-header';

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '6px';
    left.style.flex = '1';

    const arrow = document.createElement('span');
    arrow.className = 'component-header-arrow';
    arrow.textContent = '▼';
    left.appendChild(arrow);

    const icon = document.createElement('span');
    icon.className = 'component-header-icon';
    icon.innerHTML = iconSvg;
    left.appendChild(icon);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'component-header-title';
    titleSpan.textContent = title;
    left.appendChild(titleSpan);

    header.appendChild(left);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.alignItems = 'center';
    actions.style.gap = '8px';

    const enableChk = document.createElement('input');
    enableChk.type = 'checkbox';
    enableChk.className = 'component-header-enable';
    enableChk.checked = compData.enabled !== false;
    enableChk.title = 'Enable / Disable Component';
    enableChk.addEventListener('click', (e) => e.stopPropagation());
    enableChk.addEventListener('change', () => {
      compData.enabled = enableChk.checked;
      if (compKey === 'mesh') {
        obj.children.forEach(c => {
          if (c.userData?.isMeshRenderer || (c.isMesh && !c.userData?.isGizmo)) {
            c.visible = enableChk.checked;
          }
        });
      } else if (compKey === 'collider') {
        if (obj.userData.collider) obj.userData.collider.enabled = enableChk.checked;
        if (obj.userData?.components?.collider) obj.userData.components.collider.enabled = enableChk.checked;
      } else if (compKey === 'interaction') {
        if (obj.userData.interaction) obj.userData.interaction.enabled = enableChk.checked;
        if (obj.userData?.components?.interaction) obj.userData.components.interaction.enabled = enableChk.checked;
      } else if (compKey === 'playerController') {
        if (obj.userData.playerController) obj.userData.playerController.enabled = enableChk.checked;
        if (obj.userData?.components?.playerController) obj.userData.components.playerController.enabled = enableChk.checked;
      }
      this.sceneManager._emit('sceneChanged');
    });
    actions.appendChild(enableChk);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'component-remove-btn';
    removeBtn.innerHTML = '&#x2715;';
    removeBtn.title = `Remove ${title}`;
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Primitives.removeComponent(obj, compKey);
      this.sceneManager._emit('sceneChanged');
      this.refresh();
    });
    actions.appendChild(removeBtn);

    header.appendChild(actions);
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'component-body';

    header.addEventListener('click', () => {
      const isCollapsed = body.classList.toggle('collapsed');
      arrow.textContent = isCollapsed ? '▶' : '▼';
    });

    contentBuilder(body, compData);
    card.appendChild(body);

    this.content.appendChild(card);
  }

  _renderMeshComponent(obj) {
    const iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;

    this._createComponentCard('Mesh Renderer', 'mesh', obj, iconSvg, (body, compData) => {
      if (compData.geometryType) {
        const { row: geoRow, value: geoVal } = this._createRow('Geometry');
        const geoSelect = document.createElement('select');
        geoSelect.className = 'inspector-select';
        ['cube', 'sphere', 'plane', 'cylinder'].forEach(type => {
          const opt = document.createElement('option');
          opt.value = type;
          opt.textContent = type.charAt(0).toUpperCase() + type.slice(1);
          if (compData.geometryType === type) opt.selected = true;
          geoSelect.appendChild(opt);
        });

        geoSelect.addEventListener('change', () => {
          compData.geometryType = geoSelect.value;
          Primitives.attachMeshComponent(obj, compData);
          this.sceneManager._emit('sceneChanged');
          this.refresh();
        });

        geoVal.appendChild(geoSelect);
        body.appendChild(geoRow);
      }

      const meshes = this._collectMeshes(obj);
      const slots = this._collectMaterials(obj);

      if (slots.length > 0) {
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

        slotsContainer.appendChild(slotsList);
        body.appendChild(slotsContainer);

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
            compData.color = colorInput.value;
            const dot = slotsList.children[currentSlotIndex]?.querySelector('.material-slot-dot');
            if (dot) dot.style.background = colorInput.value;
            this.sceneManager._emit('sceneChanged');
          });

          hexText.addEventListener('change', () => {
            if (/^#[0-9A-Fa-f]{6}$/.test(hexText.value)) {
              mat.color.set(hexText.value);
              colorInput.value = hexText.value;
              compData.color = hexText.value;
              const dot = slotsList.children[currentSlotIndex]?.querySelector('.material-slot-dot');
              if (dot) dot.style.background = hexText.value;
              this.sceneManager._emit('sceneChanged');
            }
          });

          const whiteQuick = document.createElement('button');
          whiteQuick.className = 'btn-small';
          whiteQuick.textContent = '#FFF';
          whiteQuick.title = 'Set to #FFFFFF';
          whiteQuick.addEventListener('click', () => {
            mat.color.setHex(0xffffff);
            colorInput.value = '#ffffff';
            hexText.value = '#FFFFFF';
            compData.color = '#ffffff';
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
              compData.textureId = texSelect.value;
              mat.needsUpdate = true;
              if (tAsset.preview) texThumb.style.backgroundImage = `url(${tAsset.preview})`;
              if (obj.userData?.textures) obj.userData.textures.base = texSelect.value;
            }
          } else {
            mat.map = null;
            if (mat.userData) delete mat.userData.textureId;
            compData.textureId = null;
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
            compData.textureId = null;
            mat.needsUpdate = true;
            if (obj.userData?.textures) obj.userData.textures.base = null;
            this.sceneManager._emit('sceneChanged');
            this.refresh();
          });
          texBtnRow.appendChild(clearBtn);
        }
        texVal.appendChild(texBtnRow);
        detailPanel.appendChild(texRow);

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
            compData.roughness = mat.roughness;
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
            compData.metalness = mat.metalness;
            metalNum.textContent = Number(mat.metalness).toFixed(2);
            this.sceneManager._emit('sceneChanged');
          });

          metalVal.appendChild(metalInput);
          metalVal.appendChild(metalNum);
          detailPanel.appendChild(metalRow);
        }

        if (mat.opacity !== undefined) {
          const { row: opRow, value: opVal } = this._createRow('Opacity');
          const opInput = document.createElement('input');
          opInput.type = 'range';
          opInput.min = '0';
          opInput.max = '1';
          opInput.step = '0.01';
          opInput.value = mat.opacity;
          opInput.style.flex = '1';

          const opNum = document.createElement('span');
          opNum.style.width = '32px';
          opNum.style.textAlign = 'right';
          opNum.style.fontFamily = 'var(--font-mono)';
          opNum.style.fontSize = '10px';
          opNum.textContent = Number(mat.opacity).toFixed(2);

          opInput.addEventListener('input', () => {
            mat.opacity = parseFloat(opInput.value);
            mat.transparent = mat.opacity < 1;
            compData.opacity = mat.opacity;
            compData.transparent = mat.transparent;
            opNum.textContent = Number(mat.opacity).toFixed(2);
            this.sceneManager._emit('sceneChanged');
          });

          opVal.appendChild(opInput);
          opVal.appendChild(opNum);
          detailPanel.appendChild(opRow);
        }

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
          compData.transparent = transChk.checked;
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
          compData.wireframe = wireChk.checked;
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
      }
    });
  }

  _renderColliderComponent(obj) {
    const iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="3"/></svg>`;

    this._createComponentCard('Collider', 'collider', obj, iconSvg, (body, compData) => {
      const { row: typeRow, value: typeVal } = this._createRow('Type');
      const typeSelect = document.createElement('select');
      typeSelect.className = 'inspector-select';
      ['box', 'sphere', 'cylinder'].forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
        if (compData.type === t) opt.selected = true;
        typeSelect.appendChild(opt);
      });
      typeSelect.addEventListener('change', () => {
        compData.type = typeSelect.value;
        obj.userData.collider = compData;
        this.sceneManager._emit('sceneChanged');
        this.refresh();
      });
      typeVal.appendChild(typeSelect);
      body.appendChild(typeRow);

      const { row: trigRow, value: trigVal } = this._createRow('isTrigger');
      const trigCb = document.createElement('label');
      trigCb.className = 'inspector-checkbox';
      const trigInput = document.createElement('input');
      trigInput.type = 'checkbox';
      trigInput.checked = !!compData.isTrigger;
      trigInput.addEventListener('change', () => {
        compData.isTrigger = trigInput.checked;
        obj.userData.collider = compData;
        this.sceneManager._emit('sceneChanged');
      });
      trigCb.appendChild(trigInput);
      trigCb.appendChild(document.createTextNode('Trigger'));
      trigVal.appendChild(trigCb);
      body.appendChild(trigRow);

      if (compData.type === 'box') {
        if (!compData.size) compData.size = { x: 1, y: 1, z: 1 };
        body.appendChild(this._createVec3Row('Size', compData.size, (axis, val) => {
          compData.size[axis] = Math.max(0.01, val);
          obj.userData.collider = compData;
          this.sceneManager._emit('sceneChanged');
        }));
      } else if (compData.type === 'sphere') {
        if (compData.radius === undefined) compData.radius = 0.5;
        const { row: radRow, value: radVal } = this._createRow('Radius');
        const radInput = this._createNumberInput(compData.radius, (v) => {
          compData.radius = Math.max(0.01, v);
          obj.userData.collider = compData;
          this.sceneManager._emit('sceneChanged');
        }, '0.05');
        radVal.appendChild(radInput);
        body.appendChild(radRow);
      } else if (compData.type === 'cylinder') {
        if (compData.radius === undefined) compData.radius = 0.5;
        if (compData.height === undefined) compData.height = 1.0;

        const { row: radRow, value: radVal } = this._createRow('Radius');
        const radInput = this._createNumberInput(compData.radius, (v) => {
          compData.radius = Math.max(0.01, v);
          obj.userData.collider = compData;
          this.sceneManager._emit('sceneChanged');
        }, '0.05');
        radVal.appendChild(radInput);
        body.appendChild(radRow);

        const { row: hRow, value: hVal } = this._createRow('Height');
        const hInput = this._createNumberInput(compData.height, (v) => {
          compData.height = Math.max(0.01, v);
          obj.userData.collider = compData;
          this.sceneManager._emit('sceneChanged');
        }, '0.1');
        hVal.appendChild(hInput);
        body.appendChild(hRow);
      }

      if (!compData.center) compData.center = { x: 0, y: 0, z: 0 };
      body.appendChild(this._createVec3Row('Center', compData.center, (axis, val) => {
        compData.center[axis] = val;
        obj.userData.collider = compData;
        this.sceneManager._emit('sceneChanged');
      }));
    });
  }

  _renderInteractionComponent(obj) {
    const iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    this._createComponentCard('Interaction', 'interaction', obj, iconSvg, (body, compData) => {
      const { row: typeRow, value: typeVal } = this._createRow('Type');
      const typeSelect = document.createElement('select');
      typeSelect.className = 'inspector-select';
      typeSelect.innerHTML = '<option value="inspect">Inspect (Focus & Rotate)</option><option value="event">Custom Event Trigger</option><option value="none">None</option>';
      typeSelect.value = compData.type || 'inspect';
      typeSelect.addEventListener('change', () => {
        compData.type = typeSelect.value;
        obj.userData.interaction = compData;
        if (!obj.userData.components) obj.userData.components = {};
        obj.userData.components.interaction = compData;
        this.sceneManager._emit('sceneChanged');
      });
      typeVal.appendChild(typeSelect);
      body.appendChild(typeRow);

      const { row: promptRow, value: promptVal } = this._createRow('Prompt');
      const promptInput = document.createElement('input');
      promptInput.type = 'text';
      promptInput.className = 'inspector-input';
      promptInput.value = compData.promptText || 'Press E to interact';
      promptInput.addEventListener('change', () => {
        compData.promptText = promptInput.value;
        obj.userData.interaction = compData;
        if (!obj.userData.components) obj.userData.components = {};
        obj.userData.components.interaction = compData;
        this.sceneManager._emit('sceneChanged');
      });
      promptVal.appendChild(promptInput);
      body.appendChild(promptRow);

      const { row: distRow, value: distVal } = this._createRow('Distance');
      const distInput = this._createNumberInput(compData.maxDistance !== undefined ? compData.maxDistance : 3.0, (v) => {
        compData.maxDistance = Math.max(0.5, v);
        obj.userData.interaction = compData;
        if (!obj.userData.components) obj.userData.components = {};
        obj.userData.components.interaction = compData;
        this.sceneManager._emit('sceneChanged');
      }, '0.5');
      distVal.appendChild(distInput);
      body.appendChild(distRow);

      if (this.itemInspector) {
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'margin-top: 10px; display: flex;';
        const previewBtn = document.createElement('button');
        previewBtn.className = 'btn btn-secondary';
        previewBtn.style.cssText = 'width: 100%; font-size: 11px; padding: 6px 10px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; border-radius: 4px;';
        previewBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Preview Inspect Focus';
        previewBtn.title = 'Preview 3D Inspect focus view';
        previewBtn.addEventListener('click', () => {
          this.itemInspector.inspect(obj);
        });
        btnRow.appendChild(previewBtn);
        body.appendChild(btnRow);
      }
    });
  }

  _renderPlayerControllerComponent(obj) {
    const iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21v-2a6.5 6.5 0 0 1 13 0v2"/></svg>`;

    this._createComponentCard('Player Controller', 'playerController', obj, iconSvg, (body, compData) => {
      const addNum = (lbl, val, step, onChange) => {
        const { row, value } = this._createRow(lbl);
        const input = this._createNumberInput(val, onChange, step);
        value.appendChild(input);
        body.appendChild(row);
      };

      addNum('Move Speed', compData.moveSpeed, '0.5', (v) => { compData.moveSpeed = v; obj.userData.playerController = compData; this.sceneManager._emit('sceneChanged'); });
      addNum('Lerp Speed', compData.lerpSpeed, '1.0', (v) => { compData.lerpSpeed = v; obj.userData.playerController = compData; this.sceneManager._emit('sceneChanged'); });
      addNum('Jump Force', compData.jumpForce, '0.5', (v) => { compData.jumpForce = v; obj.userData.playerController = compData; this.sceneManager._emit('sceneChanged'); });
      addNum('Gravity', compData.gravity, '1.0', (v) => { compData.gravity = v; obj.userData.playerController = compData; this.sceneManager._emit('sceneChanged'); });
      addNum('Radius', compData.playerRadius, '0.05', (v) => { compData.playerRadius = v; obj.userData.playerController = compData; this.sceneManager._emit('sceneChanged'); });
      addNum('Height', compData.playerHeight, '0.1', (v) => { compData.playerHeight = v; obj.userData.playerController = compData; this.sceneManager._emit('sceneChanged'); });
      addNum('Camera Offset Y', compData.cameraOffsetY, '0.1', (v) => {
        compData.cameraOffsetY = v;
        obj.userData.playerController = compData;
        const childCam = obj.children.find(c => c.isCamera || c.userData?.type === 'camera');
        if (childCam) childCam.position.y = v;
        this.sceneManager._emit('sceneChanged');
      });

      const openNodeBtn = document.createElement('button');
      openNodeBtn.className = 'inspector-btn';
      openNodeBtn.style.marginTop = '8px';
      openNodeBtn.innerHTML = '<span class="icon">&#x2B21;</span> Open Player Logic in Node Graph';
      openNodeBtn.addEventListener('click', () => {
        if (this.onOpenNodeGraph) {
          this.onOpenNodeGraph('player');
        }
      });
      body.appendChild(openNodeBtn);
    });
  }

  _renderCameraComponent(obj) {
    const iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;

    this._createComponentCard('Camera', 'camera', obj, iconSvg, (body, compData) => {
      const addNum = (lbl, val, step, onChange) => {
        const { row, value } = this._createRow(lbl);
        const input = this._createNumberInput(val, onChange, step);
        value.appendChild(input);
        body.appendChild(row);
      };

      addNum('FOV', compData.fov, '1.0', (v) => {
        compData.fov = v;
        obj.userData.camera = compData;
        if (obj.isCamera) { obj.fov = v; obj.updateProjectionMatrix(); }
        const childCam = obj.children.find(c => c.isCamera);
        if (childCam) { childCam.fov = v; childCam.updateProjectionMatrix(); }
        this.sceneManager._emit('sceneChanged');
      });

      addNum('Near Clip', compData.near, '0.05', (v) => {
        compData.near = v;
        obj.userData.camera = compData;
        if (obj.isCamera) { obj.near = v; obj.updateProjectionMatrix(); }
        const childCam = obj.children.find(c => c.isCamera);
        if (childCam) { childCam.near = v; childCam.updateProjectionMatrix(); }
        this.sceneManager._emit('sceneChanged');
      });

      addNum('Far Clip', compData.far, '10.0', (v) => {
        compData.far = v;
        obj.userData.camera = compData;
        if (obj.isCamera) { obj.far = v; obj.updateProjectionMatrix(); }
        const childCam = obj.children.find(c => c.isCamera);
        if (childCam) { childCam.far = v; childCam.updateProjectionMatrix(); }
        this.sceneManager._emit('sceneChanged');
      });

      const { row: mainRow, value: mainVal } = this._createRow('Main Camera');
      const mainCb = document.createElement('label');
      mainCb.className = 'inspector-checkbox';
      const mainInput = document.createElement('input');
      mainInput.type = 'checkbox';
      mainInput.checked = compData.isMainCamera !== false;
      mainInput.addEventListener('change', () => {
        compData.isMainCamera = mainInput.checked;
        obj.userData.camera = compData;
        this.sceneManager._emit('sceneChanged');
      });
      mainCb.appendChild(mainInput);
      mainCb.appendChild(document.createTextNode('Active'));
      mainVal.appendChild(mainCb);
      body.appendChild(mainRow);
    });
  }

  _renderNodeGraphComponent(obj) {
    const iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><line x1="8.5" y1="7.5" x2="15.5" y2="16.5"/><line x1="9" y1="6" x2="15" y2="6"/></svg>`;

    this._createComponentCard('Node Graph', 'nodeGraph', obj, iconSvg, (body, compData) => {
      const { row, value } = this._createRow('Scope');
      const scopeVal = document.createElement('span');
      scopeVal.style.fontFamily = 'var(--font-mono)';
      scopeVal.style.fontSize = '11px';
      scopeVal.style.color = 'var(--text-muted)';
      scopeVal.textContent = compData.scope || `object:${obj.userData.id}`;
      value.appendChild(scopeVal);
      body.appendChild(row);

      const openNodeBtn = document.createElement('button');
      openNodeBtn.className = 'inspector-btn';
      openNodeBtn.style.marginTop = '8px';
      openNodeBtn.innerHTML = '<span class="icon">&#x2B21;</span> Open in Node Graph';
      openNodeBtn.addEventListener('click', () => {
        if (this.onOpenNodeGraph) {
          this.onOpenNodeGraph(obj.userData.id);
        }
      });
      body.appendChild(openNodeBtn);
    });
  }

  _renderAddComponentSection(obj) {
    const container = document.createElement('div');
    container.className = 'add-component-container';

    const addBtn = document.createElement('button');
    addBtn.className = 'add-component-btn';
    addBtn.textContent = '+ Add Component';

    const menu = document.createElement('div');
    menu.className = 'add-component-menu';
    menu.style.display = 'none';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'add-component-search';
    searchInput.placeholder = 'Search component...';
    menu.appendChild(searchInput);

    const listContainer = document.createElement('div');
    listContainer.className = 'add-component-list';
    listContainer.style.display = 'flex';
    listContainer.style.flexDirection = 'column';
    listContainer.style.gap = '4px';
    menu.appendChild(listContainer);

    const componentDefinitions = [
      {
        category: 'Rendering',
        items: [
          {
            name: 'Mesh Renderer',
            type: 'mesh',
            icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
            isAttached: () => Primitives.hasComponent(obj, 'mesh'),
            onAdd: () => Primitives.attachMeshComponent(obj, { geometryType: 'cube' })
          }
        ]
      },
      {
        category: 'Physics',
        items: [
          {
            name: 'Box Collider',
            type: 'collider_box',
            icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/></svg>`,
            isAttached: () => Primitives.hasComponent(obj, 'collider') && obj.userData.components.collider.type === 'box',
            onAdd: () => Primitives.attachColliderComponent(obj, { type: 'box', size: { x: 1, y: 1, z: 1 } })
          },
          {
            name: 'Sphere Collider',
            type: 'collider_sphere',
            icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/></svg>`,
            isAttached: () => Primitives.hasComponent(obj, 'collider') && obj.userData.components.collider.type === 'sphere',
            onAdd: () => Primitives.attachColliderComponent(obj, { type: 'sphere', radius: 0.5 })
          },
          {
            name: 'Cylinder Collider',
            type: 'collider_cylinder',
            icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 5v14c0 1.66-4 3-9 3s-9-1.34-9-3V5"/></svg>`,
            isAttached: () => Primitives.hasComponent(obj, 'collider') && obj.userData.components.collider.type === 'cylinder',
            onAdd: () => Primitives.attachColliderComponent(obj, { type: 'cylinder', radius: 0.5, height: 1.0 })
          }
        ]
      },
      {
        category: 'Gameplay',
        items: [
          {
            name: 'Player Controller',
            type: 'playerController',
            icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21v-2a6.5 6.5 0 0 1 13 0v2"/></svg>`,
            onAdd: () => {
              Primitives.attachPlayerControllerComponent(obj, {}, true);
              obj.traverse((child) => {
                if (child !== obj && !child.userData?.isGizmo && !child.userData?._isOverlay) {
                  if (child.userData?.id || child.userData?.type || child.userData?.components || child.isCamera) {
                    if (!child.userData) child.userData = {};
                    if (!child.userData.id) child.userData.id = crypto.randomUUID();
                    if (!child.userData.parentId) child.userData.parentId = child.parent?.userData?.id || obj.userData.id;
                    if (!this.sceneManager.getObject(child.userData.id)) {
                      this.sceneManager._objects.set(child.userData.id, child);
                      this.sceneManager._emit('objectAdded', child);
                    }
                  }
                }
              });
            }
          },
          {
            name: 'Interaction',
            type: 'interaction',
            icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
            isAttached: () => Primitives.hasComponent(obj, 'interaction'),
            onAdd: () => Primitives.attachInteractionComponent(obj, { type: 'inspect', promptText: 'Press E to interact' })
          },
          {
            name: 'Camera',
            type: 'camera',
            icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
            isAttached: () => Primitives.hasComponent(obj, 'camera'),
            onAdd: () => Primitives.attachCameraComponent(obj, { fov: 75, near: 0.1, far: 1000 })
          }
        ]
      },
      {
        category: 'Logic',
        items: [
          {
            name: 'Node Graph Logic',
            type: 'nodeGraph',
            icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><line x1="8.5" y1="7.5" x2="15.5" y2="16.5"/><line x1="9" y1="6" x2="15" y2="6"/></svg>`,
            isAttached: () => Primitives.hasComponent(obj, 'nodeGraph'),
            onAdd: () => Primitives.attachNodeGraphComponent(obj, {})
          }
        ]
      }
    ];

    const renderFilteredList = (query = '') => {
      listContainer.innerHTML = '';
      const q = query.toLowerCase().trim();

      componentDefinitions.forEach(cat => {
        const matchingItems = cat.items.filter(it => !q || it.name.toLowerCase().includes(q));
        if (matchingItems.length === 0) return;

        const catTitle = document.createElement('div');
        catTitle.className = 'add-component-category-title';
        catTitle.textContent = cat.category;
        listContainer.appendChild(catTitle);

        matchingItems.forEach(item => {
          const itemEl = document.createElement('button');
          itemEl.className = 'add-component-item';
          const attached = item.isAttached();
          if (attached) {
            itemEl.classList.add('disabled');
            itemEl.title = 'Component already attached';
          }
          itemEl.innerHTML = `<span class="component-header-icon">${item.icon}</span><span>${item.name}</span>${attached ? '<span style="margin-left:auto;font-size:10px;color:var(--text-muted);">(Attached)</span>' : ''}`;

          if (!attached) {
            itemEl.addEventListener('click', () => {
              item.onAdd();
              this.sceneManager._emit('sceneChanged');
              this.refresh();
            });
          }

          listContainer.appendChild(itemEl);
        });
      });
    };

    searchInput.addEventListener('input', () => renderFilteredList(searchInput.value));

    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.style.display === 'flex';
      menu.style.display = isOpen ? 'none' : 'flex';
      if (!isOpen) {
        searchInput.value = '';
        renderFilteredList('');
        setTimeout(() => searchInput.focus(), 50);
      }
    });

    const closeOnClickOutside = (e) => {
      if (!container.contains(e.target)) {
        menu.style.display = 'none';
      }
    };
    document.addEventListener('click', closeOnClickOutside);

    container.appendChild(addBtn);
    container.appendChild(menu);
    this.content.appendChild(container);
  }

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
        if (c.isMesh && !c.userData?.isGizmo) list.push(c);
      });
    }
    return list;
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
  //#endregion
}

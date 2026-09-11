export class ProjectPanel {
  constructor(container, assetManager, sceneManager, options = {}) {
    this.container = container;
    this.assetManager = assetManager;
    this.sceneManager = sceneManager;
    this.options = options || {};

    this.projectName = 'MyProject';
    this._selectedCategory = 'all';
    this._searchQuery = '';
    this._activeContextMenu = null;

    this._build();

    if (this.sceneManager && typeof this.sceneManager.on === 'function') {
      this.sceneManager.on('projectAssetsChanged', () => this.refresh());
    }
  }

  _build() {
    this.panelHeader = document.createElement('div');
    this.panelHeader.className = 'panel-header project-header';

    const leftTitle = document.createElement('div');
    leftTitle.style.display = 'flex';
    leftTitle.style.alignItems = 'center';
    leftTitle.style.gap = '8px';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = 'Project';
    titleSpan.style.fontWeight = 'bold';
    leftTitle.appendChild(titleSpan);

    const folderBadge = document.createElement('span');
    folderBadge.className = 'project-folder-badge';
    folderBadge.title = 'Project Folder (Click to Rename / Save As)';
    folderBadge.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span class="project-folder-name">${this.projectName}</span>
    `;
    folderBadge.addEventListener('click', () => this._renameProject());
    leftTitle.appendChild(folderBadge);
    this._folderBadge = folderBadge;
    this._folderBadgeName = folderBadge.querySelector('.project-folder-name');

    this.panelHeader.appendChild(leftTitle);

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.style.gap = '6px';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search Assets...';
    searchInput.className = 'inspector-input';
    searchInput.style.height = '20px';
    searchInput.style.fontSize = '10px';
    searchInput.style.width = '120px';
    searchInput.addEventListener('input', (e) => {
      this._searchQuery = e.target.value.toLowerCase();
      this.refresh();
    });
    controls.appendChild(searchInput);

    const importBtn = document.createElement('button');
    importBtn.className = 'toolbar-btn';
    importBtn.textContent = '+ Import';
    importBtn.style.padding = '2px 8px';
    importBtn.style.fontSize = '11px';
    importBtn.addEventListener('click', () => this._showImportMenu(importBtn));
    controls.appendChild(importBtn);

    this.panelHeader.appendChild(controls);
    this.container.appendChild(this.panelHeader);

    const layout = document.createElement('div');
    layout.className = 'project-panel-layout';
    layout.style.display = 'flex';
    layout.style.height = 'calc(100% - var(--section-header-h))';
    layout.style.overflow = 'hidden';

    // Left category sidebar
    const sidebar = document.createElement('div');
    sidebar.className = 'project-sidebar';
    sidebar.style.width = '140px';
    sidebar.style.borderRight = '1px solid var(--border)';
    sidebar.style.padding = '4px 0';
    sidebar.style.background = 'var(--bg-dark)';
    sidebar.style.flexShrink = '0';

    const categories = [
      { id: 'all', label: 'Assets (All)' },
      { id: 'models', label: 'Models' },
      { id: 'textures', label: 'Textures' },
    ];

    categories.forEach(cat => {
      const btn = document.createElement('div');
      btn.className = 'project-sidebar-item';
      btn.textContent = cat.label;
      if (cat.id === this._selectedCategory) btn.classList.add('active');
      btn.addEventListener('click', () => {
        sidebar.querySelectorAll('.project-sidebar-item').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        this._selectedCategory = cat.id;
        this.refresh();
      });
      sidebar.appendChild(btn);
    });

    layout.appendChild(sidebar);

    // Right grid view & dropzone
    const gridView = document.createElement('div');
    gridView.className = 'project-asset-grid';
    gridView.style.flex = '1';
    gridView.style.padding = '8px';
    gridView.style.overflowY = 'auto';
    gridView.style.display = 'flex';
    gridView.style.flexWrap = 'wrap';
    gridView.style.gap = '8px';
    gridView.style.alignContent = 'flex-start';

    this.gridView = gridView;
    this.gridView.addEventListener('contextmenu', (e) => {
      if (e.target === this.gridView || e.target.classList.contains('project-empty-msg')) {
        this._showGridContextMenu(e);
      }
    });
    layout.appendChild(gridView);
    this.container.appendChild(layout);

    this._setupOSDragDrop();
    this.refresh();
  }

  _renameProject() {
    const name = prompt('Enter Project Folder name:', this.projectName);
    if (name && name.trim()) {
      this.projectName = name.trim();
      this._folderBadge.textContent = `[ ${this.projectName} ]`;
    }
  }

  _showImportMenu(anchorBtn) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.glb,.gltf,image/png,image/jpeg,image/webp';
    input.addEventListener('change', async () => {
      if (!input.files) return;
      for (const file of input.files) {
        await this._importFile(file);
      }
      this.refresh();
    });
    input.click();
  }

  _setupOSDragDrop() {
    this.container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.container.classList.add('drag-over');
    });

    this.container.addEventListener('dragleave', (e) => {
      e.preventDefault();
      this.container.classList.remove('drag-over');
    });

    this.container.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.container.classList.remove('drag-over');

      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        for (const file of e.dataTransfer.files) {
          await this._importFile(file);
        }
        this.refresh();
      }
    });
  }

  async _importFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    try {
      if (ext === 'glb' || ext === 'gltf') {
        await this.assetManager.importMesh(file);
      } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
        await this.assetManager.importTexture(file);
      }
    } catch (err) {
      console.error('Failed to import file:', file.name, err);
    }
  }

  refresh() {
    this.gridView.innerHTML = '';

    const meshes = this.assetManager.getAllMeshes();
    const textures = this.assetManager.getAllTextures();

    const items = [];
    if (this._selectedCategory === 'all' || this._selectedCategory === 'models') {
      meshes.forEach(m => items.push({ type: 'mesh', id: m.id, name: m.name, asset: m }));
    }
    if (this._selectedCategory === 'all' || this._selectedCategory === 'textures') {
      textures.forEach(t => items.push({ type: 'texture', id: t.id, name: t.name, asset: t }));
    }

    const filtered = items.filter(i => !this._searchQuery || i.name.toLowerCase().includes(this._searchQuery));

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'project-empty-msg';
      empty.textContent = 'Drag 3D models (.glb/.gltf) or images here to import';
      empty.style.color = 'var(--text-dim)';
      empty.style.fontSize = '11px';
      empty.style.margin = 'auto';
      empty.style.padding = '20px';
      this.gridView.appendChild(empty);
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'project-asset-card';
      card.draggable = true;
      card.style.width = '74px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.gap = '4px';
      card.style.padding = '6px';
      card.style.borderRadius = '3px';
      card.style.background = 'var(--bg-panel)';
      card.style.cursor = 'grab';
      card.style.border = '1px solid var(--border)';

      const thumbBox = document.createElement('div');
      thumbBox.style.width = '48px';
      thumbBox.style.height = '48px';
      thumbBox.style.background = 'var(--bg-dark)';
      thumbBox.style.display = 'flex';
      thumbBox.style.alignItems = 'center';
      thumbBox.style.justifyContent = 'center';
      thumbBox.style.borderRadius = '2px';
      thumbBox.style.overflow = 'hidden';

      if (item.type === 'texture' && item.asset.preview) {
        const img = document.createElement('img');
        img.src = item.asset.preview;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        thumbBox.appendChild(img);
      } else {
        const svg = document.createElement('div');
        svg.innerHTML = '<svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" style="color:var(--text-muted);"><path d="M8 1.5 L14.5 5.25 L14.5 12.75 L8 16.5 L1.5 12.75 L1.5 5.25 Z"/><path d="M8 1.5 L8 16.5"/><path d="M1.5 5.25 L8 9 L14.5 5.25"/></svg>';
        thumbBox.appendChild(svg);
      }
      card.appendChild(thumbBox);

      const label = document.createElement('span');
      label.className = 'project-card-name';
      label.textContent = item.name;
      label.title = item.name;
      label.style.fontSize = '10px';
      label.style.maxWidth = '68px';
      label.style.overflow = 'hidden';
      label.style.textOverflow = 'ellipsis';
      label.style.whiteSpace = 'nowrap';
      label.style.textAlign = 'center';
      card.appendChild(label);

      card.addEventListener('dragstart', (e) => {
        card.style.opacity = '0.5';
        e.dataTransfer.setData('application/json', JSON.stringify({
          assetType: item.type,
          assetId: item.id,
          assetName: item.name
        }));
      });

      card.addEventListener('dragend', () => {
        card.style.opacity = '1';
      });

      card.addEventListener('dblclick', () => {
        if (item.type === 'mesh') {
          const instance = this.assetManager.createMeshInstance(item.id);
          if (instance) {
            instance.position.set(0, 0.5, 0);
            this.sceneManager.addObject(instance);
            this.sceneManager.selectObject(instance.userData.id);
          }
        }
      });

      card.addEventListener('contextmenu', (e) => {
        this._showAssetContextMenu(e, item);
      });

      this.gridView.appendChild(card);
    });
  }

  _showAssetContextMenu(e, item) {
    e.preventDefault();
    e.stopPropagation();

    this._closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.display = 'block';
    menu.style.zIndex = '100005';

    const title = document.createElement('div');
    title.className = 'context-menu-title';
    title.textContent = item.name;
    menu.appendChild(title);

    if (item.type === 'mesh') {
      const addBtn = this._createMenuItem('Add to Scene', () => {
        const instance = this.assetManager.createMeshInstance(item.id);
        if (instance) {
          instance.position.set(0, 0.5, 0);
          this.sceneManager.addObject(instance);
          this.sceneManager.selectObject(instance.userData.id);
        }
      });
      menu.appendChild(addBtn);
    }

    if (item.type === 'texture') {
      const selectedObj = this.sceneManager.selectedObject;
      const applyBtn = this._createMenuItem('Apply as Base Texture', () => {
        if (selectedObj) {
          this.assetManager.applyBaseTexture(selectedObj, item.id);
          this.sceneManager._emit('sceneChanged');
          this.sceneManager._emit('objectSelected', selectedObj);
        } else {
          alert('Please select a GameObject in Hierarchy first.');
        }
      });
      menu.appendChild(applyBtn);
    }

    const renameBtn = this._createMenuItem('Rename Asset...', () => {
      const newName = prompt('Enter new asset name:', item.name);
      if (newName && newName.trim() && newName.trim() !== item.name) {
        if (item.type === 'mesh') {
          this.assetManager.renameMesh(item.id, newName.trim());
        } else {
          this.assetManager.renameTexture(item.id, newName.trim());
        }
        this.refresh();
        this.sceneManager._emit('projectAssetsChanged');
      }
    });
    menu.appendChild(renameBtn);

    const copyIdBtn = this._createMenuItem('Copy Asset ID', () => {
      navigator.clipboard.writeText(item.id);
    });
    menu.appendChild(copyIdBtn);

    const sep = document.createElement('div');
    sep.className = 'context-menu-separator';
    menu.appendChild(sep);

    const delBtn = this._createMenuItem('Delete Asset', () => {
      if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
        if (item.type === 'mesh') {
          const toRemove = [];
          for (const obj of this.sceneManager._objects.values()) {
            if (obj.userData?.meshAssetId === item.id) {
              toRemove.push(obj.userData.id);
            }
          }
          toRemove.forEach((oId) => this.sceneManager.removeObject(oId));
          this.assetManager.deleteMesh(item.id);
        } else {
          this.assetManager.deleteTexture(item.id);
        }
        this.refresh();
        this.sceneManager._emit('projectAssetsChanged');
      }
    }, true);
    menu.appendChild(delBtn);

    document.body.appendChild(menu);
    this._positionMenu(menu, e.clientX, e.clientY);
    this._activeContextMenu = menu;

    const closeHandler = (evt) => {
      if (!menu.contains(evt.target)) {
        this._closeContextMenu();
        document.removeEventListener('pointerdown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', closeHandler), 10);
  }

  _showGridContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();

    this._closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.display = 'block';
    menu.style.zIndex = '100005';

    const title = document.createElement('div');
    title.className = 'context-menu-title';
    title.textContent = 'Assets';
    menu.appendChild(title);

    const importBtn = this._createMenuItem('Import Assets...', () => {
      this._showImportMenu();
    });
    menu.appendChild(importBtn);

    const refreshBtn = this._createMenuItem('Refresh', () => {
      this.refresh();
    });
    menu.appendChild(refreshBtn);

    document.body.appendChild(menu);
    this._positionMenu(menu, e.clientX, e.clientY);
    this._activeContextMenu = menu;

    const closeHandler = (evt) => {
      if (!menu.contains(evt.target)) {
        this._closeContextMenu();
        document.removeEventListener('pointerdown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', closeHandler), 10);
  }

  _createMenuItem(label, onClick, isDanger = false) {
    const btn = document.createElement('button');
    btn.className = 'context-menu-item';
    if (isDanger) btn.classList.add('danger');
    btn.textContent = label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._closeContextMenu();
      onClick();
    });
    return btn;
  }

  _positionMenu(menu, x, y) {
    const w = 180;
    const h = menu.offsetHeight || 140;
    let left = x;
    let top = y;
    if (left + w > window.innerWidth - 10) left = window.innerWidth - w - 10;
    if (top + h > window.innerHeight - 10) top = window.innerHeight - h - 10;
    menu.style.left = `${Math.max(10, left)}px`;
    menu.style.top = `${Math.max(10, top)}px`;
  }

  _closeContextMenu() {
    if (this._activeContextMenu) {
      this._activeContextMenu.remove();
      this._activeContextMenu = null;
    }
  }

  //#region [Public Methods]
  setProjectName(name) {
    this.projectName = name || 'MyProject';
    if (this._folderBadgeName) {
      this._folderBadgeName.textContent = this.projectName;
    }
  }
  //#endregion

  //#region [Private Methods]
  _renameProject() {
    if (this.options && typeof this.options.onRename === 'function') {
      this.options.onRename();
    }
  }
  //#endregion
}

export class ProjectPanel {
  //#region [Variables/Fields]
  container = null;
  assetManager = null;
  sceneManager = null;
  options = {};

  projectName = 'MyProject';
  _selectedCategory = 'all';
  _searchQuery = '';
  _activeContextMenu = null;
  _currentFolderId = null;

  panelHeader = null;
  breadcrumbBar = null;
  gridView = null;
  sidebar = null;
  _folderBadge = null;
  _folderBadgeName = null;
  //#endregion

  //#region [Properties]
  get currentFolderId() {
    return this._currentFolderId;
  }

  set currentFolderId(value) {
    this._currentFolderId = value;
    this.refresh();
  }
  //#endregion

  //#region [Unity Methods]
  constructor(container, assetManager, sceneManager, options = {}) {
    this.container = container;
    this.assetManager = assetManager;
    this.sceneManager = sceneManager;
    this.options = options || {};

    this._build();

    if (this.sceneManager && typeof this.sceneManager.on === 'function') {
      this.sceneManager.on('projectAssetsChanged', () => this.refresh());
    }
  }
  //#endregion

  //#region [Public Methods]
  setProjectName(name) {
    this.projectName = name || 'MyProject';
    if (this._folderBadgeName) {
      this._folderBadgeName.textContent = this.projectName;
    }
    this._updateBreadcrumbs();
  }

  refresh() {
    this._updateBreadcrumbs();
    this.gridView.innerHTML = '';

    const allFolders = this.assetManager ? this.assetManager.getAllFolders() : [];
    const allScripts = this.assetManager ? this.assetManager.getAllNodeGraphs() : [];
    const allMeshes = this.assetManager ? this.assetManager.getAllMeshes() : [];
    const allTextures = this.assetManager ? this.assetManager.getAllTextures() : [];

    const items = [];

    const isFolderLevel = (folderId) => {
      if (this._searchQuery) return true;
      return (folderId || null) === this._currentFolderId;
    };

    if (this._selectedCategory === 'all' || this._selectedCategory === 'folders') {
      allFolders
        .filter(f => isFolderLevel(f.parentFolderId))
        .forEach(f => items.push({ type: 'folder', id: f.id, name: f.name, asset: f }));
    }

    if (this._selectedCategory === 'all' || this._selectedCategory === 'scripts') {
      allScripts
        .filter(s => isFolderLevel(s.folderId))
        .forEach(s => items.push({ type: 'nodegraph', id: s.id, name: s.name, asset: s }));
    }

    if (this._selectedCategory === 'all' || this._selectedCategory === 'models') {
      allMeshes
        .filter(m => isFolderLevel(m.folderId))
        .forEach(m => items.push({ type: 'mesh', id: m.id, name: m.name, asset: m }));
    }

    if (this._selectedCategory === 'all' || this._selectedCategory === 'textures') {
      allTextures
        .filter(t => isFolderLevel(t.folderId))
        .forEach(t => items.push({ type: 'texture', id: t.id, name: t.name, asset: t }));
    }

    const filtered = items.filter(i => !this._searchQuery || i.name.toLowerCase().includes(this._searchQuery));

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'project-empty-msg';
      empty.textContent = this._searchQuery
        ? 'No matching assets found'
        : 'Empty directory. Use + Folder, + Script, or + Import to add assets.';
      empty.style.color = 'var(--text-dim)';
      empty.style.fontSize = '11px';
      empty.style.margin = 'auto';
      empty.style.padding = '20px';
      empty.style.textAlign = 'center';
      this.gridView.appendChild(empty);
      return;
    }

    filtered.forEach(item => {
      const card = this._renderAssetCard(item);
      this.gridView.appendChild(card);
    });
  }
  //#endregion

  //#region [Private Methods]
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
    folderBadge.title = 'Project Name (Click to Rename)';
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
    searchInput.style.width = '110px';
    searchInput.addEventListener('input', (e) => {
      this._searchQuery = e.target.value.toLowerCase();
      this.refresh();
    });
    controls.appendChild(searchInput);

    const newFolderBtn = document.createElement('button');
    newFolderBtn.className = 'toolbar-btn';
    newFolderBtn.title = 'Create New Folder in Current Directory';
    newFolderBtn.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
      + Folder
    `;
    newFolderBtn.style.padding = '2px 6px';
    newFolderBtn.style.fontSize = '11px';
    newFolderBtn.addEventListener('click', () => this._createNewFolder());
    controls.appendChild(newFolderBtn);

    const newScriptBtn = document.createElement('button');
    newScriptBtn.className = 'toolbar-btn';
    newScriptBtn.title = 'Create New NodeGraph Logic Script';
    newScriptBtn.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
      + Script
    `;
    newScriptBtn.style.padding = '2px 6px';
    newScriptBtn.style.fontSize = '11px';
    newScriptBtn.addEventListener('click', () => this._createNewScript());
    controls.appendChild(newScriptBtn);

    const importBtn = document.createElement('button');
    importBtn.className = 'toolbar-btn';
    importBtn.textContent = '+ Import';
    importBtn.style.padding = '2px 6px';
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

    const sidebar = document.createElement('div');
    sidebar.className = 'project-sidebar';
    sidebar.style.width = '140px';
    sidebar.style.borderRight = '1px solid var(--border)';
    sidebar.style.padding = '4px 0';
    sidebar.style.background = 'var(--bg-dark)';
    sidebar.style.flexShrink = '0';
    this.sidebar = sidebar;

    const categories = [
      { id: 'all', label: 'Assets (All)' },
      { id: 'folders', label: 'Folders' },
      { id: 'scripts', label: 'Scripts (NodeGraph)' },
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

    const rightContainer = document.createElement('div');
    rightContainer.style.flex = '1';
    rightContainer.style.display = 'flex';
    rightContainer.style.flexDirection = 'column';
    rightContainer.style.overflow = 'hidden';

    this.breadcrumbBar = document.createElement('div');
    this.breadcrumbBar.className = 'project-breadcrumb-bar';
    rightContainer.appendChild(this.breadcrumbBar);

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

    rightContainer.appendChild(gridView);
    layout.appendChild(rightContainer);
    this.container.appendChild(layout);

    this._setupOSDragDrop();
    this.refresh();
  }

  _updateBreadcrumbs() {
    if (!this.breadcrumbBar) return;
    this.breadcrumbBar.innerHTML = '';

    const rootItem = document.createElement('div');
    rootItem.className = `project-breadcrumb-item ${this._currentFolderId === null ? 'active' : ''}`;
    rootItem.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span>${this.projectName || 'Project'}</span>
    `;
    rootItem.addEventListener('click', () => {
      if (this._currentFolderId !== null) {
        this._currentFolderId = null;
        this.refresh();
      }
    });

    this._setupDropTarget(rootItem, null);
    this.breadcrumbBar.appendChild(rootItem);

    if (this._currentFolderId !== null && this.assetManager) {
      const trail = [];
      let curr = this.assetManager.getFolder(this._currentFolderId);
      const visited = new Set();
      while (curr && !visited.has(curr.id)) {
        visited.add(curr.id);
        trail.unshift(curr);
        curr = curr.parentFolderId ? this.assetManager.getFolder(curr.parentFolderId) : null;
      }

      trail.forEach((f, idx) => {
        const sep = document.createElement('span');
        sep.className = 'project-breadcrumb-sep';
        sep.textContent = '/';
        this.breadcrumbBar.appendChild(sep);

        const isLast = (idx === trail.length - 1);
        const itemEl = document.createElement('div');
        itemEl.className = `project-breadcrumb-item ${isLast ? 'active' : ''}`;
        itemEl.textContent = f.name;
        if (!isLast) {
          itemEl.addEventListener('click', () => {
            this._currentFolderId = f.id;
            this.refresh();
          });
        }
        this._setupDropTarget(itemEl, f.id);
        this.breadcrumbBar.appendChild(itemEl);
      });
    }
  }

  _setupDropTarget(targetEl, targetFolderId) {
    targetEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      targetEl.classList.add('drag-target-hover');
    });

    targetEl.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      targetEl.classList.remove('drag-target-hover');
    });

    targetEl.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      targetEl.classList.remove('drag-target-hover');

      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (data && data.assetId) {
          if (data.assetType === 'folder' && data.assetId === targetFolderId) return;
          this.assetManager.moveItemToFolder(data.assetId, data.assetType, targetFolderId);
          this.refresh();
          if (this.sceneManager && typeof this.sceneManager._emit === 'function') {
            this.sceneManager._emit('projectAssetsChanged');
          }
        }
      } catch (err) {
        console.error('Drop error:', err);
      }
    });
  }

  _renderAssetCard(item) {
    const card = document.createElement('div');
    card.className = `project-asset-card ${item.type === 'folder' ? 'folder-card' : ''}`;
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

    if (item.type === 'folder') {
      const svg = document.createElement('div');
      svg.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e5a93b" stroke-width="1.6"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
      thumbBox.appendChild(svg);
    } else if (item.type === 'nodegraph') {
      const svg = document.createElement('div');
      svg.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#a371f7" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="2"/><circle cx="16" cy="16" r="2"/><line x1="8" y1="10" x2="16" y2="14"/></svg>';
      thumbBox.appendChild(svg);
    } else if (item.type === 'texture' && item.asset.preview) {
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

    if (item.type === 'folder') {
      this._setupDropTarget(card, item.id);
    }

    card.addEventListener('dblclick', () => {
      if (item.type === 'folder') {
        this._currentFolderId = item.id;
        this.refresh();
      } else if (item.type === 'nodegraph') {
        if (this.options && typeof this.options.onOpenNodeGraphAsset === 'function') {
          this.options.onOpenNodeGraphAsset(item.id);
        }
      } else if (item.type === 'mesh') {
        const instance = this.assetManager.createMeshInstance(item.id);
        if (instance) {
          instance.position.set(0, 0.5, 0);
          this.sceneManager.addObject(instance);
          this.sceneManager.selectObject(instance.userData.id);
        }
      } else if (item.type === 'texture') {
        const selectedObj = this.sceneManager.selectedObject;
        if (selectedObj) {
          this.assetManager.applyBaseTexture(selectedObj, item.id);
          this.sceneManager._emit('sceneChanged');
          this.sceneManager._emit('objectSelected', selectedObj);
        }
      }
    });

    card.addEventListener('contextmenu', (e) => {
      this._showAssetContextMenu(e, item);
    });

    return card;
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

    if (item.type === 'folder') {
      const openBtn = this._createMenuItem('Open Folder', () => {
        this._currentFolderId = item.id;
        this.refresh();
      });
      menu.appendChild(openBtn);

      const renameBtn = this._createMenuItem('Rename Folder...', () => {
        const newName = prompt('Enter new folder name:', item.name);
        if (newName && newName.trim() && newName.trim() !== item.name) {
          this.assetManager.renameFolder(item.id, newName.trim());
          this.refresh();
          if (this.sceneManager && typeof this.sceneManager._emit === 'function') {
            this.sceneManager._emit('projectAssetsChanged');
          }
        }
      });
      menu.appendChild(renameBtn);

      const sep = document.createElement('div');
      sep.className = 'context-menu-separator';
      menu.appendChild(sep);

      const delBtn = this._createMenuItem('Delete Folder', () => {
        if (confirm(`Are you sure you want to delete folder "${item.name}"? Contents will be moved up.`)) {
          this.assetManager.deleteFolder(item.id);
          this.refresh();
          if (this.sceneManager && typeof this.sceneManager._emit === 'function') {
            this.sceneManager._emit('projectAssetsChanged');
          }
        }
      }, true);
      menu.appendChild(delBtn);
    } else if (item.type === 'nodegraph') {
      const openBtn = this._createMenuItem('Open Script Graph', () => {
        if (this.options && typeof this.options.onOpenNodeGraphAsset === 'function') {
          this.options.onOpenNodeGraphAsset(item.id);
        }
      });
      menu.appendChild(openBtn);

      const renameBtn = this._createMenuItem('Rename Script...', () => {
        const currentClean = item.name.replace(/\.nodegraph$/i, '');
        const newName = prompt('Enter new script name:', currentClean);
        if (newName && newName.trim() && newName.trim() !== currentClean) {
          this.assetManager.renameNodeGraph(item.id, newName.trim());
          this.refresh();
          if (this.sceneManager && typeof this.sceneManager._emit === 'function') {
            this.sceneManager._emit('projectAssetsChanged');
          }
        }
      });
      menu.appendChild(renameBtn);

      const copyIdBtn = this._createMenuItem('Copy Script Asset ID', () => {
        navigator.clipboard.writeText(item.id);
      });
      menu.appendChild(copyIdBtn);

      const sep = document.createElement('div');
      sep.className = 'context-menu-separator';
      menu.appendChild(sep);

      const delBtn = this._createMenuItem('Delete Script', () => {
        if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
          this.assetManager.deleteNodeGraph(item.id);
          this.refresh();
          if (this.sceneManager && typeof this.sceneManager._emit === 'function') {
            this.sceneManager._emit('projectAssetsChanged');
          }
        }
      }, true);
      menu.appendChild(delBtn);
    } else if (item.type === 'mesh') {
      const addBtn = this._createMenuItem('Add to Scene', () => {
        const instance = this.assetManager.createMeshInstance(item.id);
        if (instance) {
          instance.position.set(0, 0.5, 0);
          this.sceneManager.addObject(instance);
          this.sceneManager.selectObject(instance.userData.id);
        }
      });
      menu.appendChild(addBtn);

      const renameBtn = this._createMenuItem('Rename Asset...', () => {
        const newName = prompt('Enter new asset name:', item.name);
        if (newName && newName.trim() && newName.trim() !== item.name) {
          this.assetManager.renameMesh(item.id, newName.trim());
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
          const toRemove = [];
          for (const obj of this.sceneManager._objects.values()) {
            if (obj.userData?.meshAssetId === item.id) {
              toRemove.push(obj.userData.id);
            }
          }
          toRemove.forEach((oId) => this.sceneManager.removeObject(oId));
          this.assetManager.deleteMesh(item.id);
          this.refresh();
          this.sceneManager._emit('projectAssetsChanged');
        }
      }, true);
      menu.appendChild(delBtn);
    } else if (item.type === 'texture') {
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

      const renameBtn = this._createMenuItem('Rename Asset...', () => {
        const newName = prompt('Enter new asset name:', item.name);
        if (newName && newName.trim() && newName.trim() !== item.name) {
          this.assetManager.renameTexture(item.id, newName.trim());
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
          this.assetManager.deleteTexture(item.id);
          this.refresh();
          this.sceneManager._emit('projectAssetsChanged');
        }
      }, true);
      menu.appendChild(delBtn);
    }

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
    title.textContent = 'Project Directory';
    menu.appendChild(title);

    const newFolderBtn = this._createMenuItem('+ New Folder...', () => {
      this._createNewFolder();
    });
    menu.appendChild(newFolderBtn);

    const newScriptBtn = this._createMenuItem('+ New NodeGraph Script...', () => {
      this._createNewScript();
    });
    menu.appendChild(newScriptBtn);

    const importBtn = this._createMenuItem('Import Assets...', () => {
      this._showImportMenu();
    });
    menu.appendChild(importBtn);

    if (this._currentFolderId !== null) {
      const upBtn = this._createMenuItem('Go Up (Parent Directory)', () => {
        const curr = this.assetManager ? this.assetManager.getFolder(this._currentFolderId) : null;
        this._currentFolderId = curr ? curr.parentFolderId : null;
        this.refresh();
      });
      menu.appendChild(upBtn);
    }

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

  _createNewFolder() {
    const name = prompt('Enter Folder Name:', 'New Folder');
    if (name && name.trim()) {
      this.assetManager.createFolder(name.trim(), this._currentFolderId);
      this.refresh();
      if (this.sceneManager && typeof this.sceneManager._emit === 'function') {
        this.sceneManager._emit('projectAssetsChanged');
      }
    }
  }

  _createNewScript() {
    const name = prompt('Enter NodeGraph Script Name:', 'NewGraph');
    if (name && name.trim()) {
      const asset = this.assetManager.createNodeGraphAsset(name.trim(), null, this._currentFolderId);
      this.refresh();
      if (this.sceneManager && typeof this.sceneManager._emit === 'function') {
        this.sceneManager._emit('projectAssetsChanged');
      }
      if (this.options && typeof this.options.onOpenNodeGraphAsset === 'function') {
        this.options.onOpenNodeGraphAsset(asset.id);
      }
    }
  }

  _renameProject() {
    if (this.options && typeof this.options.onRename === 'function') {
      this.options.onRename();
    } else {
      const name = prompt('Enter Project Name:', this.projectName);
      if (name && name.trim()) {
        this.setProjectName(name.trim());
      }
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
      e.stopPropagation();
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
        if (this.sceneManager && typeof this.sceneManager._emit === 'function') {
          this.sceneManager._emit('projectAssetsChanged');
        }
      }
    });
  }

  async _importFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    try {
      if (ext === 'glb' || ext === 'gltf') {
        const asset = await this.assetManager.importMesh(file, this._currentFolderId);
        if (asset) asset.folderId = this._currentFolderId;
      } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
        const asset = await this.assetManager.importTexture(file, this._currentFolderId);
        if (asset) asset.folderId = this._currentFolderId;
      }
    } catch (err) {
      console.error('Failed to import file:', file.name, err);
    }
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
    const w = 190;
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
  //#endregion
}

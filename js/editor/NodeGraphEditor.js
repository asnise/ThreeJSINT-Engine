export class NodeGraphEditor {
  //#region [Variables/Fields]
  container = null;
  runtime = null;
  sceneManager = null;
  uiManager = null;
  assetManager = null;

  isOpen = false;
  currentScope = 'global';
  _pan = { x: 50, y: 50 };
  _zoom = 1.0;
  _isPanning = false;
  _panStart = { x: 0, y: 0 };

  _activeWire = null;
  _selectedWireId = null;
  _selectedNodeIds = new Set();
  _activeMenuTarget = null;

  _isSelectingBox = false;
  _boxStart = { x: 0, y: 0 };
  _selectionBoxEl = null;
  _rightPanStart = null;
  _didRightPan = false;

  overlay = null;
  window = null;
  header = null;
  tabBar = null;
  tabsContainer = null;
  canvasWrap = null;
  svg = null;
  nodesLayer = null;

  openTabs = [
    { id: 'global', type: 'system', title: 'Global / System', closable: false },
    { id: 'player', type: 'player', title: 'Player Controller', closable: true }
  ];
  activeTabId = 'global';
  //#endregion

  //#region [Properties]
  get _selectedNodeId() {
    return this._selectedNodeIds.values().next().value || null;
  }

  set _selectedNodeId(val) {
    this._selectedNodeIds.clear();
    if (val) this._selectedNodeIds.add(val);
  }
  //#endregion

  //#region [Unity Methods]
  constructor(container, nodeRuntime, sceneManager, uiManager, assetManager = null) {
    this.container = container;
    this.runtime = nodeRuntime;
    this.sceneManager = sceneManager;
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
    this._renderTabBar();
    this._render();
  }

  close() {
    this.isOpen = false;
    this.overlay.style.display = 'none';
  }

  switchScope(scope) {
    this.currentScope = scope;
    this.activeTabId = scope;

    if (!this.openTabs.some(t => t.id === scope)) {
      let title = scope;
      let type = 'generic';
      if (scope === 'global') {
        title = 'Global / System';
        type = 'system';
      } else if (scope === 'player') {
        title = 'Player Controller';
        type = 'player';
      } else if (scope.startsWith('object:')) {
        const obj = this.sceneManager.getObject(scope.replace('object:', ''));
        title = obj?.userData?.name || obj?.name || 'GameObject';
        type = 'object';
      } else if (scope.startsWith('asset:')) {
        const asset = this.assetManager?.getNodeGraph(scope.replace('asset:', ''));
        title = asset?.name || 'Script.nodegraph';
        type = 'asset';
      }
      this.openTabs.push({ id: scope, title, type, closable: scope !== 'global' });
    }

    this._renderTabBar();

    if (scope === 'player') {
      const hasNodes = Array.from(this.runtime.nodes.values()).some(n => n.scope === 'player');
      if (!hasNodes) {
        this._createPlayerPreset();
        return;
      }
    }
    this._render();
  }

  openTab(tabId, title, type = 'generic', closable = true) {
    let existing = this.openTabs.find(t => t.id === tabId);
    if (!existing) {
      existing = { id: tabId, title, type, closable };
      this.openTabs.push(existing);
    } else {
      if (title && existing.title !== title) existing.title = title;
    }
    this.switchScope(tabId);
  }

  closeTab(tabId) {
    const idx = this.openTabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;
    if (this.openTabs[idx].closable === false && this.openTabs.length === 1) return;

    this.openTabs.splice(idx, 1);
    if (this.activeTabId === tabId || this.currentScope === tabId) {
      const nextTab = this.openTabs[Math.max(0, idx - 1)] || this.openTabs[0];
      if (nextTab) {
        this.switchScope(nextTab.id);
      } else {
        this.openTab('global', 'Global / System', 'system', false);
      }
    } else {
      this._renderTabBar();
    }
  }

  openForObject(objectId) {
    if (objectId === 'player') {
      this.openTab('player', 'Player Controller', 'player');
    } else {
      const obj = this.sceneManager.getObject(objectId);
      const title = obj?.userData?.name || obj?.name || 'GameObject';
      this.openTab('object:' + objectId, title, 'object');
    }
    this.open();
  }

  openForAsset(assetId) {
    const asset = this.assetManager ? this.assetManager.getNodeGraph(assetId) : null;
    const title = asset?.name || 'Script.nodegraph';
    const scope = 'asset:' + assetId;

    if (asset && asset.graphData && Array.isArray(asset.graphData.nodes) && asset.graphData.nodes.length > 0) {
      const hasNodes = Array.from(this.runtime.nodes.values()).some(n => n.scope === scope);
      if (!hasNodes) {
        for (const n of asset.graphData.nodes) {
          this.runtime.nodes.set(n.id, { ...n, scope });
        }
        if (Array.isArray(asset.graphData.connections)) {
          for (const c of asset.graphData.connections) {
            if (!this.runtime.connections.some(rc => rc.id === c.id)) {
              this.runtime.connections.push({ ...c });
            }
          }
        }
      }
    }

    this.openTab(scope, title, 'asset');
    this.open();
  }

  autoLayoutNodes(margin = 40) {
    const currentScope = this.currentScope || 'global';
    let targetNodes = [];

    if (this._selectedNodeIds.size > 1) {
      targetNodes = Array.from(this._selectedNodeIds)
        .map(id => this.runtime.nodes.get(id))
        .filter(n => n && (n.scope || 'global') === currentScope);
    } else {
      targetNodes = Array.from(this.runtime.nodes.values())
        .filter(n => (n.scope || 'global') === currentScope);
    }

    if (targetNodes.length === 0) return;

    const targetIds = new Set(targetNodes.map(n => n.id));
    const activeConns = this.runtime.connections.filter(c => targetIds.has(c.fromNode) && targetIds.has(c.toNode));

    const inDegree = new Map();
    const adj = new Map();
    targetNodes.forEach(n => {
      inDegree.set(n.id, 0);
      adj.set(n.id, []);
    });

    activeConns.forEach(c => {
      inDegree.set(c.toNode, (inDegree.get(c.toNode) || 0) + 1);
      adj.get(c.fromNode).push(c.toNode);
    });

    const columns = new Map();
    const queue = [];
    targetNodes.forEach(n => {
      if ((inDegree.get(n.id) || 0) === 0) {
        columns.set(n.id, 0);
        queue.push(n.id);
      }
    });

    let safety = 0;
    while (queue.length > 0 && safety < 1000) {
      safety++;
      const u = queue.shift();
      const colU = columns.get(u) || 0;
      for (const v of (adj.get(u) || [])) {
        const nextCol = Math.max(columns.get(v) || 0, colU + 1);
        if ((columns.get(v) || 0) < nextCol) {
          columns.set(v, nextCol);
          queue.push(v);
        }
      }
    }

    const catOrder = {
      event: 0,
      parameter: 0,
      input: 1,
      hierarchy: 1,
      condition: 2,
      physics: 2,
      movement: 3,
      action: 3,
      output: 4,
      interface: 4
    };

    targetNodes.forEach(n => {
      if (!columns.has(n.id)) {
        columns.set(n.id, catOrder[n.category] ?? 1);
      }
    });

    const colBuckets = new Map();
    targetNodes.forEach(n => {
      const col = columns.get(n.id) || 0;
      if (!colBuckets.has(col)) colBuckets.set(col, []);
      colBuckets.get(col).push(n);
    });

    const minX = Math.min(...targetNodes.map(n => n.x));
    const minY = Math.min(...targetNodes.map(n => n.y));
    const startX = Math.max(60, isFinite(minX) ? minX : 60);
    const startY = Math.max(80, isFinite(minY) ? minY : 80);

    const cardWidth = 240;
    const sortedCols = Array.from(colBuckets.keys()).sort((a, b) => a - b);

    sortedCols.forEach((colIdx, cPos) => {
      const nodesInCol = colBuckets.get(colIdx);
      nodesInCol.sort((a, b) => {
        const cDiff = (catOrder[a.category] ?? 0) - (catOrder[b.category] ?? 0);
        if (cDiff !== 0) return cDiff;
        return a.y - b.y;
      });

      let currentY = startY;
      nodesInCol.forEach(n => {
        n.x = startX + cPos * (cardWidth + margin);
        n.y = currentY;

        const cardEl = this.nodesLayer.querySelector(`[data-node-id="${n.id}"]`);
        const h = cardEl ? cardEl.offsetHeight : 140;
        currentY += h + margin;
      });
    });

    this._render();
    this._syncAssetGraph();
  }
  //#endregion

  //#region [Private Methods]
  _build() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'nodegraph-modal';
    this.overlay.style.display = 'none';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.window = document.createElement('div');
    this.window.className = 'nodegraph-window';
    this.overlay.appendChild(this.window);

    this.header = document.createElement('div');
    this.header.className = 'nodegraph-header';
    this.header.innerHTML = `
      <div class="nodegraph-title">
        <span>Visual Logic & Condition Node Graph</span>
      </div>
    `;

    const controls = document.createElement('div');
    controls.className = 'nodegraph-header-controls';

    const addMenuBtn = document.createElement('button');
    addMenuBtn.className = 'toolbar-btn';
    addMenuBtn.textContent = '+ Add Node';
    addMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._showAddNodeMenu(addMenuBtn);
    });
    controls.appendChild(addMenuBtn);

    const layoutBtn = document.createElement('button');
    layoutBtn.className = 'toolbar-btn';
    layoutBtn.title = 'Auto Align Nodes with Spacing Margin';
    layoutBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      Auto Layout
    `;
    layoutBtn.addEventListener('click', () => {
      const marginInput = prompt('Enter node spacing margin (pixels):', '40');
      if (marginInput === null) return;
      const margin = parseInt(marginInput.trim(), 10);
      this.autoLayoutNodes(isNaN(margin) ? 40 : Math.max(10, margin));
    });
    controls.appendChild(layoutBtn);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'toolbar-btn';
    clearBtn.textContent = 'Clear Layer';
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear nodes in this layer?')) {
        for (const [id, n] of this.runtime.nodes.entries()) {
          if ((n.scope || 'global') === this.currentScope) {
            this.runtime.nodes.delete(id);
          }
        }
        this.runtime.connections = this.runtime.connections.filter(c => {
          return this.runtime.nodes.has(c.fromNode) && this.runtime.nodes.has(c.toNode);
        });
        this._render();
      }
    });
    controls.appendChild(clearBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'nodegraph-close-btn';
    closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    closeBtn.title = 'Close (ESC)';
    closeBtn.addEventListener('click', () => this.close());
    controls.appendChild(closeBtn);

    this.header.appendChild(controls);
    this.window.appendChild(this.header);

    this.tabBar = document.createElement('div');
    this.tabBar.className = 'nodegraph-tab-bar';

    this.tabsContainer = document.createElement('div');
    this.tabsContainer.className = 'nodegraph-tabs-container';
    this.tabBar.appendChild(this.tabsContainer);

    const addTabBtn = document.createElement('button');
    addTabBtn.className = 'nodegraph-tab-add-btn';
    addTabBtn.title = 'New Graph Tab (+)';
    addTabBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    addTabBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._showNewTabMenu(addTabBtn);
    });
    this.tabBar.appendChild(addTabBtn);

    this.window.appendChild(this.tabBar);

    this.canvasWrap = document.createElement('div');
    this.canvasWrap.className = 'nodegraph-canvas-wrap';

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'nodegraph-svg');
    this.canvasWrap.appendChild(this.svg);

    this.nodesLayer = document.createElement('div');
    this.nodesLayer.className = 'nodegraph-nodes-layer';
    this.canvasWrap.appendChild(this.nodesLayer);

    this.window.appendChild(this.canvasWrap);
    this.container.appendChild(this.overlay);

    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') {
        this.close();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this._selectedWireId) {
          this._deleteConnection(this._selectedWireId);
        } else if (this._selectedNodeIds.size > 0) {
          const toDelete = Array.from(this._selectedNodeIds);
          toDelete.forEach(id => this._deleteNode(id));
          this._selectedNodeIds.clear();
        }
      }
    });

    this._setupPanAndZoom();
  }

  _renderTabBar() {
    if (!this.tabsContainer) return;
    this.tabsContainer.innerHTML = '';

    for (const tab of this.openTabs) {
      const tabEl = document.createElement('div');
      const isActive = (tab.id === this.currentScope);
      tabEl.className = `nodegraph-tab ${isActive ? 'active' : ''}`;
      tabEl.dataset.tabId = tab.id;

      let iconSvg = '';
      if (tab.type === 'system') {
        iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>`;
      } else if (tab.type === 'player') {
        iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21v-2a6.5 6.5 0 0 1 13 0v2"/></svg>`;
      } else if (tab.type === 'asset') {
        iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`;
      } else {
        iconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`;
      }

      tabEl.innerHTML = `
        <span class="nodegraph-tab-icon">${iconSvg}</span>
        <span class="nodegraph-tab-title" title="${tab.title}">${tab.title}</span>
      `;

      if (tab.closable !== false) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'nodegraph-tab-close';
        closeBtn.title = 'Close Tab';
        closeBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeTab(tab.id);
        });
        tabEl.appendChild(closeBtn);
      }

      tabEl.addEventListener('click', () => {
        this.switchScope(tab.id);
      });

      this.tabsContainer.appendChild(tabEl);
    }
  }

  _showNewTabMenu(btn) {
    const existing = document.querySelector('.nodegraph-tab-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'nodegraph-context-menu nodegraph-tab-menu';
    menu.style.width = '220px';

    const header = document.createElement('div');
    header.className = 'context-menu-header';
    header.textContent = 'Open / Create Graph';
    menu.appendChild(header);

    const newScriptItem = document.createElement('div');
    newScriptItem.className = 'context-menu-item';
    newScriptItem.textContent = '+ New NodeGraph Asset...';
    newScriptItem.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.remove();
      const name = prompt('Enter NodeGraph script name:', 'NewGraph');
      if (name && name.trim()) {
        const clean = name.trim();
        let assetId = crypto.randomUUID();
        if (this.assetManager) {
          const asset = this.assetManager.createNodeGraphAsset(clean);
          assetId = asset.id;
          if (this.sceneManager && typeof this.sceneManager._emit === 'function') {
            this.sceneManager._emit('projectAssetsChanged');
          }
        }
        this.openTab('asset:' + assetId, `${clean}.nodegraph`, 'asset');
        this.open();
      }
    });
    menu.appendChild(newScriptItem);

    const sep = document.createElement('div');
    sep.className = 'context-menu-header';
    sep.textContent = 'Open GameObject Graph';
    menu.appendChild(sep);

    const objs = this.sceneManager.getAllObjects();
    objs.forEach(o => {
      const row = document.createElement('div');
      row.className = 'context-menu-item';
      row.textContent = o.userData?.name || o.name || 'GameObject';
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        this.openForObject(o.userData.id);
      });
      menu.appendChild(row);
    });

    document.body.appendChild(menu);
    const rect = btn.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${Math.min(window.innerWidth - 230, rect.left)}px`;

    const closeHandler = (evt) => {
      if (!menu.contains(evt.target)) {
        menu.remove();
        document.removeEventListener('pointerdown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', closeHandler), 10);
  }

  _setupPanAndZoom() {
    this.canvasWrap.addEventListener('mousedown', (e) => {
      const isCanvasBackground = (e.target === this.canvasWrap || e.target === this.svg || e.target.classList.contains('nodegraph-nodes-layer'));
      if (!isCanvasBackground) return;

      if (e.button === 1 || (e.button === 0 && (e.altKey || e.spaceKey))) {
        this._isPanning = true;
        this._panStart = { x: e.clientX - this._pan.x, y: e.clientY - this._pan.y };
        return;
      }

      if (e.button === 2) {
        this._rightPanStart = { x: e.clientX, y: e.clientY, panX: this._pan.x, panY: this._pan.y };
        this._didRightPan = false;
        return;
      }

      if (e.button === 0) {
        this._selectedWireId = null;
        this._renderWires();

        this._isSelectingBox = true;
        this._boxStart = { x: e.clientX, y: e.clientY };

        if (!this._selectionBoxEl) {
          this._selectionBoxEl = document.createElement('div');
          this._selectionBoxEl.className = 'nodegraph-selection-box';
          this.canvasWrap.appendChild(this._selectionBoxEl);
        }
        this._selectionBoxEl.style.display = 'block';
        this._selectionBoxEl.style.left = '0px';
        this._selectionBoxEl.style.top = '0px';
        this._selectionBoxEl.style.width = '0px';
        this._selectionBoxEl.style.height = '0px';
      }
    });

    this.canvasWrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = Math.max(0.4, Math.min(2.0, this._zoom * zoomFactor));
      if (newZoom === this._zoom) return;

      const rect = this.canvasWrap.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this._pan.x = mouseX - (mouseX - this._pan.x) * (newZoom / this._zoom);
      this._pan.y = mouseY - (mouseY - this._pan.y) * (newZoom / this._zoom);
      this._zoom = newZoom;

      this._updateTransform();
    }, { passive: false });

    this.canvasWrap.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this._didRightPan) {
        this._didRightPan = false;
        return;
      }
      this._showAddNodeMenu(null, e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (this._isPanning) {
        this._pan.x = e.clientX - this._panStart.x;
        this._pan.y = e.clientY - this._panStart.y;
        this._updateTransform();
      }

      if (this._rightPanStart) {
        const dx = e.clientX - this._rightPanStart.x;
        const dy = e.clientY - this._rightPanStart.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          this._didRightPan = true;
          this._pan.x = this._rightPanStart.panX + dx;
          this._pan.y = this._rightPanStart.panY + dy;
          this._updateTransform();
        }
      }

      if (this._isSelectingBox && this._selectionBoxEl) {
        const wrapRect = this.canvasWrap.getBoundingClientRect();
        const minX = Math.min(this._boxStart.x, e.clientX);
        const maxX = Math.max(this._boxStart.x, e.clientX);
        const minY = Math.min(this._boxStart.y, e.clientY);
        const maxY = Math.max(this._boxStart.y, e.clientY);
        const w = maxX - minX;
        const h = maxY - minY;

        this._selectionBoxEl.style.left = `${minX - wrapRect.left}px`;
        this._selectionBoxEl.style.top = `${minY - wrapRect.top}px`;
        this._selectionBoxEl.style.width = `${w}px`;
        this._selectionBoxEl.style.height = `${h}px`;

        if (w > 3 || h > 3) {
          const worldLeft = (minX - wrapRect.left - this._pan.x) / this._zoom;
          const worldRight = (maxX - wrapRect.left - this._pan.x) / this._zoom;
          const worldTop = (minY - wrapRect.top - this._pan.y) / this._zoom;
          const worldBottom = (maxY - wrapRect.top - this._pan.y) / this._zoom;

          const currentScope = this.currentScope || 'global';
          for (const node of this.runtime.nodes.values()) {
            if ((node.scope || 'global') !== currentScope) continue;
            const cardEl = this.nodesLayer.querySelector(`[data-node-id="${node.id}"]`);
            if (!cardEl) continue;

            const cardW = cardEl.offsetWidth || 220;
            const cardH = cardEl.offsetHeight || 120;
            const nodeLeft = node.x;
            const nodeRight = node.x + cardW;
            const nodeTop = node.y;
            const nodeBottom = node.y + cardH;

            const intersects = !(nodeRight < worldLeft || nodeLeft > worldRight || nodeBottom < worldTop || nodeTop > worldBottom);

            if (intersects) {
              this._selectedNodeIds.add(node.id);
              cardEl.classList.add('selected');
            } else if (!e.shiftKey && !e.ctrlKey) {
              this._selectedNodeIds.delete(node.id);
              cardEl.classList.remove('selected');
            }
          }
        }
      }

      if (this._activeWire) {
        this._updateActiveWire(e);
      }
    });

    window.addEventListener('mouseup', (e) => {
      this._isPanning = false;

      if (this._rightPanStart) {
        this._rightPanStart = null;
      }

      if (this._isSelectingBox) {
        this._isSelectingBox = false;
        if (this._selectionBoxEl) {
          this._selectionBoxEl.style.display = 'none';
        }

        const dist = Math.hypot(e.clientX - this._boxStart.x, e.clientY - this._boxStart.y);
        if (dist <= 4 && !e.shiftKey && !e.ctrlKey) {
          this._selectedNodeIds.clear();
          this.nodesLayer.querySelectorAll('.nodegraph-card.selected').forEach(c => c.classList.remove('selected'));
          this._selectedWireId = null;
          this._renderWires();
        }
      }

      if (this._activeWire) {
        this._cancelActiveWire(e);
      }
    });
  }

  _updateTransform() {
    this.nodesLayer.style.transform = `translate(${this._pan.x}px, ${this._pan.y}px) scale(${this._zoom})`;
    this.canvasWrap.style.backgroundPosition = `${this._pan.x}px ${this._pan.y}px`;
    this.canvasWrap.style.backgroundSize = `${24 * this._zoom}px ${24 * this._zoom}px`;
    this._renderWires();
  }

  _showAddNodeMenu(btn, posX, posY) {
    const existing = document.querySelector('.nodegraph-context-menu');
    if (existing) {
      existing.remove();
      if (this._activeMenuTarget === (btn || 'canvas')) {
        this._activeMenuTarget = null;
        return;
      }
    }
    this._activeMenuTarget = btn || 'canvas';

    const menu = document.createElement('div');
    menu.className = 'nodegraph-context-menu';

    const searchWrap = document.createElement('div');
    searchWrap.className = 'nodegraph-menu-search-wrap';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'nodegraph-search-input';
    searchInput.placeholder = 'Search nodes...';
    searchWrap.appendChild(searchInput);
    menu.appendChild(searchWrap);
    setTimeout(() => searchInput.focus(), 50);

    const categories = [
      {
        cat: 'Events',
        items: [
          { type: 'OnUpdate', label: 'OnUpdate (Per Frame / Tick)' },
          { type: 'OnStart', label: 'OnStart (Play Begin)' },
          { type: 'OnInteract', label: 'OnInteract (Press E)' },
          { type: 'OnTriggerEnter', label: 'OnTriggerEnter (Walk In)' },
          { type: 'OnTriggerExit', label: 'OnTriggerExit (Walk Out)' },
          { type: 'OnVariableChanged', label: 'OnVariableChanged (Var Updated)' },
        ]
      },
      {
        cat: 'Input',
        items: [
          { type: 'InputAxis', label: 'Input Axis (WASD / Space / Shift / E)' },
          { type: 'MouseLookInput', label: 'Mouse Look Input (Delta X / Y)' },
        ]
      },
      {
        cat: 'Movement',
        items: [
          { type: 'MovementDirection', label: 'Movement Direction (Smoothing & Lerp)' },
        ]
      },
      {
        cat: 'Physics',
        items: [
          { type: 'CharacterPhysics', label: 'Character Physics (Gravity & Jump)' },
        ]
      },
      {
        cat: 'Output',
        items: [
          { type: 'CharacterMoveOutput', label: 'Character Move Output (Collider Move)' },
          { type: 'RotateCameraOutput', label: 'Rotate Camera Output (Yaw & Pitch)' },
        ]
      },
      {
        cat: 'Parameters',
        items: [
          { type: 'Parameter', label: 'Parameter (Typed Constant)' },
          { type: 'FloatParameter', label: 'Float Parameter (Decimal)' },
          { type: 'IntParameter', label: 'Int Parameter (Integer)' },
          { type: 'StringParameter', label: 'String Parameter (Text)' },
          { type: 'BooleanParameter', label: 'Boolean Parameter (True / False)' },
          { type: 'Vector3Parameter', label: 'Vector3 Parameter (X, Y, Z)' },
          { type: 'ListParameter', label: 'List / Array Parameter' },
          { type: 'DictionaryParameter', label: 'Dictionary / Map Parameter' },
        ]
      },
      {
        cat: 'Hierarchy & Components',
        items: [
          { type: 'GetChildComponent', label: 'Get Child Component (Ref Child & Comp)' },
        ]
      },
      {
        cat: 'Interface & Variables',
        items: [
          { type: 'DynamicInterface', label: 'Dynamic Interface (Public Variables / Custom I/O)' },
        ]
      },
      {
        cat: 'Conditions',
        items: [
          { type: 'CheckCondition', label: 'Check Condition (If Var)' },
          { type: 'GetVariable', label: 'Get Variable (Read Var)' },
          { type: 'FlipFlop', label: 'Flip-Flop (A / B Toggle)' },
          { type: 'CounterGate', label: 'Counter Gate (X Times)' },
          { type: 'Delay', label: 'Delay (Timer)' },
        ]
      },
      {
        cat: 'Actions',
        items: [
          { type: 'RotateObject', label: 'Rotate Object (Tween)' },
          { type: 'SetActive', label: 'Set GameObject Active (Show/Hide)' },
          { type: 'MoveObject', label: 'Move Object (Tween)' },
          { type: 'SetVariable', label: 'Set Variable' },
          { type: 'SetUIActive', label: 'Set UI Active (Show/Hide UI)' },
          { type: 'SetUIText', label: 'Set UI Text (Template {var})' },
          { type: 'ChangeColor', label: 'Change Color' },
          { type: 'InspectItem', label: 'Inspect Item' },
        ]
      }
    ];

    const wrapRect = this.canvasWrap.getBoundingClientRect();
    const spawnX = (posX !== undefined) ? (-this._pan.x + (posX - wrapRect.left)) / this._zoom : (-this._pan.x + 280) / this._zoom;
    const spawnY = (posY !== undefined) ? (-this._pan.y + (posY - wrapRect.top)) / this._zoom : (-this._pan.y + 120) / this._zoom;

    categories.forEach(group => {
      const header = document.createElement('div');
      header.className = 'context-menu-header';
      header.textContent = group.cat;
      menu.appendChild(header);

      group.items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'context-menu-item';
        row.textContent = item.label;
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          this._createNode(item.type, spawnX, spawnY);
          menu.remove();
          this._activeMenuTarget = null;
        });
        menu.appendChild(row);
      });
    });

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      const headers = menu.querySelectorAll('.context-menu-header');
      const items = menu.querySelectorAll('.context-menu-item');
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        const matches = !q || text.includes(q);
        item.style.display = matches ? 'flex' : 'none';
      });
      headers.forEach(h => {
        let sibling = h.nextElementSibling;
        let anyVisible = false;
        while (sibling && !sibling.classList.contains('context-menu-header')) {
          if (sibling.classList.contains('context-menu-item') && sibling.style.display !== 'none') {
            anyVisible = true;
          }
          sibling = sibling.nextElementSibling;
        }
        h.style.display = anyVisible ? 'block' : 'none';
      });
    });

    document.body.appendChild(menu);

    let top = 0;
    let left = 0;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      top = rect.bottom + 4;
      left = rect.left;
    } else if (posX !== undefined && posY !== undefined) {
      top = posY;
      left = posX;
    }

    const menuW = 260;
    const menuH = Math.min(menu.scrollHeight || 420, 440);
    if (left + menuW > window.innerWidth - 10) left = window.innerWidth - menuW - 10;
    if (top + menuH > window.innerHeight - 10) top = window.innerHeight - menuH - 10;

    menu.style.top = `${Math.max(10, top)}px`;
    menu.style.left = `${Math.max(10, left)}px`;

    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        this._activeMenuTarget = null;
        document.removeEventListener('pointerdown', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', closeMenu), 10);
  }

  _createNode(type, x, y, skipRender = false) {
    const id = crypto.randomUUID();
    let category = 'action';
    let title = type;
    let inputs = [{ id: 'flow', label: '▶ In', type: 'flow' }];
    let outputs = [{ id: 'flow', label: 'Out ▶', type: 'flow' }];
    let data = {};

    let defaultTargetId = '';
    if (this.currentScope.startsWith('object:')) {
      defaultTargetId = this.currentScope.replace('object:', '');
    }

    if (type === 'OnUpdate') {
      category = 'event';
      title = 'On Update (Tick)';
      inputs = [];
      outputs = [
        { id: 'flow', label: 'Out ▶', type: 'flow' },
        { id: 'dt', label: 'Delta Time ▶', type: 'number' }
      ];
    } else if (type.startsWith('On')) {
      category = 'event';
      inputs = [];
      if (type === 'OnInteract') {
        title = 'On Interact';
        data = { targetId: defaultTargetId || 'any' };
      } else if (type === 'OnTriggerEnter') {
        title = 'On Trigger Enter';
        data = { targetId: defaultTargetId || '' };
      } else if (type === 'OnTriggerExit') {
        title = 'On Trigger Exit';
        data = { targetId: defaultTargetId || '' };
      } else if (type === 'OnVariableChanged') {
        title = 'On Variable Changed';
        data = { varName: 'any' };
      } else if (type === 'OnStart') {
        title = 'On Start';
      }
    } else if (type === 'InputAxis') {
      category = 'input';
      title = 'Input Axis (WASD)';
      inputs = [{ id: 'flow', label: '▶ In', type: 'flow' }];
      outputs = [
        { id: 'flow', label: 'Out ▶', type: 'flow' },
        { id: 'horizontal', label: 'Horizontal ▶', type: 'number' },
        { id: 'vertical', label: 'Vertical ▶', type: 'number' },
        { id: 'jump', label: 'Jump ▶', type: 'boolean' },
        { id: 'sprint', label: 'Sprint ▶', type: 'boolean' },
        { id: 'crouch', label: 'Crouch ▶', type: 'boolean' },
        { id: 'interact', label: 'Interact ▶', type: 'boolean' },
        { id: 'attack', label: 'Attack (LMB) ▶', type: 'boolean' },
        { id: 'aim', label: 'Aim (RMB) ▶', type: 'boolean' }
      ];
    } else if (type === 'MouseLookInput') {
      category = 'input';
      title = 'Mouse Look Input';
      inputs = [{ id: 'flow', label: '▶ In', type: 'flow' }];
      outputs = [
        { id: 'flow', label: 'Out ▶', type: 'flow' },
        { id: 'lookX', label: 'Mouse X ▶', type: 'number' },
        { id: 'lookY', label: 'Mouse Y ▶', type: 'number' },
        { id: 'wheel', label: 'Wheel Y ▶', type: 'number' }
      ];
    } else if (type === 'MovementDirection') {
      category = 'movement';
      title = 'Movement Direction';
      inputs = [
        { id: 'flow', label: '▶ In', type: 'flow' },
        { id: 'horizontal', label: '▶ Horizontal', type: 'number' },
        { id: 'vertical', label: '▶ Vertical', type: 'number' },
        { id: 'sprint', label: '▶ Sprint', type: 'boolean' },
        { id: 'speed', label: '▶ Speed', type: 'number' },
        { id: 'sprintMultiplier', label: '▶ Sprint Mul', type: 'number' },
        { id: 'lerpSpeed', label: '▶ Lerp Speed', type: 'number' }
      ];
      outputs = [
        { id: 'flow', label: 'Out ▶', type: 'flow' },
        { id: 'moveX', label: 'Move X ▶', type: 'number' },
        { id: 'moveZ', label: 'Move Z ▶', type: 'number' },
        { id: 'isMoving', label: 'Is Moving ▶', type: 'boolean' }
      ];
      data = { speed: 5, sprintMultiplier: 1.6, lerpSpeed: 10 };
    } else if (type === 'CharacterPhysics') {
      category = 'physics';
      title = 'Character Physics';
      inputs = [
        { id: 'flow', label: '▶ In', type: 'flow' },
        { id: 'jump', label: '▶ Jump', type: 'boolean' },
        { id: 'jumpForce', label: '▶ Jump Force', type: 'number' },
        { id: 'gravity', label: '▶ Gravity', type: 'number' }
      ];
      outputs = [
        { id: 'flow', label: 'Out ▶', type: 'flow' },
        { id: 'velocityY', label: 'Velocity Y ▶', type: 'number' },
        { id: 'isGrounded', label: 'Grounded ▶', type: 'boolean' }
      ];
      data = { jumpForce: 8, gravity: -15 };
    } else if (type === 'CharacterMoveOutput') {
      category = 'output';
      title = 'Character Move Output';
      inputs = [
        { id: 'flow', label: '▶ In', type: 'flow' },
        { id: 'moveX', label: '▶ Move X', type: 'number' },
        { id: 'velocityY', label: '▶ Velocity Y', type: 'number' },
        { id: 'moveZ', label: '▶ Move Z', type: 'number' }
      ];
      outputs = [
        { id: 'flow', label: 'Out ▶', type: 'flow' }
      ];
      data = { radius: 0.3, height: 1.7 };
    } else if (type === 'RotateCameraOutput') {
      category = 'output';
      title = 'Rotate Camera Output';
      inputs = [
        { id: 'flow', label: '▶ In', type: 'flow' },
        { id: 'lookX', label: '▶ Look X', type: 'number' },
        { id: 'lookY', label: '▶ Look Y', type: 'number' },
        { id: 'targetCamera', label: '▶ Target Cam', type: 'object' },
        { id: 'sensitivity', label: '▶ Sensitivity', type: 'number' }
      ];
      outputs = [
        { id: 'flow', label: 'Out ▶', type: 'flow' }
      ];
      data = { sensitivity: 0.002 };
    } else if (type === 'Parameter' || type.endsWith('Parameter')) {
      category = 'parameter';
      let dType = 'float';
      let dVal = 1.0;
      if (type === 'FloatParameter') {
        title = 'Float Parameter';
        dType = 'float';
        dVal = 5.0;
      } else if (type === 'IntParameter') {
        title = 'Int Parameter';
        dType = 'int';
        dVal = 1;
      } else if (type === 'StringParameter') {
        title = 'String Parameter';
        dType = 'string';
        dVal = 'Text';
      } else if (type === 'BooleanParameter') {
        title = 'Boolean Parameter';
        dType = 'boolean';
        dVal = true;
      } else if (type === 'Vector3Parameter') {
        title = 'Vector3 Parameter';
        dType = 'vector3';
        dVal = { x: 0, y: 0, z: 0 };
      } else if (type === 'ListParameter') {
        title = 'List Parameter';
        dType = 'list';
        dVal = '["item1", "item2"]';
      } else if (type === 'DictionaryParameter') {
        title = 'Dictionary Parameter';
        dType = 'dictionary';
        dVal = '{"key": "value"}';
      } else {
        title = 'Parameter';
        dType = 'float';
        dVal = 1.0;
      }
      inputs = [
        { id: 'flow', label: '▶ In', type: 'flow' }
      ];
      outputs = [
        { id: 'flow', label: 'Out ▶', type: 'flow' },
        { id: 'val', label: 'Value ▶', type: 'any' }
      ];
      data = {
        name: 'param',
        dataType: dType,
        value: (typeof dVal === 'string' || typeof dVal === 'number' || typeof dVal === 'boolean') ? dVal : (dType === 'vector3' ? '' : JSON.stringify(dVal)),
        x: dType === 'vector3' ? 0 : undefined,
        y: dType === 'vector3' ? 0 : undefined,
        z: dType === 'vector3' ? 0 : undefined
      };
    } else if (type === 'GetChildComponent') {
      category = 'hierarchy';
      title = 'Get Child Component';
      inputs = [
        { id: 'flow', label: '▶ In', type: 'flow' },
        { id: 'parent', label: '▶ Parent', type: 'object' }
      ];
      outputs = [
        { id: 'flow', label: 'Out ▶', type: 'flow' },
        { id: 'child', label: 'Child ID ▶', type: 'object' },
        { id: 'component', label: 'Component ▶', type: 'object' }
      ];
      data = {
        parentId: defaultTargetId || 'current',
        childId: '',
        childName: '',
        componentType: 'camera'
      };
    } else if (type === 'DynamicInterface') {
      category = 'interface';
      title = 'Dynamic Interface (Public Vars)';
      inputs = [
        { id: 'flow', label: '▶ In', type: 'flow' }
      ];
      outputs = [
        { id: 'flow', label: 'Out ▶', type: 'flow' }
      ];
      data = {
        values: {},
        customInputs: [],
        customOutputs: []
      };
    } else if (['CheckCondition', 'FlipFlop', 'CounterGate', 'Delay', 'GetVariable'].includes(type)) {
      category = 'condition';
      if (type === 'CheckCondition') {
        title = 'Check Condition';
        outputs = [
          { id: 'true', label: 'True ▶', type: 'flow' },
          { id: 'false', label: 'False ▶', type: 'flow' }
        ];
        data = { varName: 'hasKey', operator: '==', value: 'true' };
      } else if (type === 'GetVariable') {
        title = 'Get Variable';
        data = { varName: 'coins' };
      } else if (type === 'FlipFlop') {
        title = 'Flip-Flop (Toggle)';
        outputs = [
          { id: 'A', label: 'A (Open) ▶', type: 'flow' },
          { id: 'B', label: 'B (Close) ▶', type: 'flow' }
        ];
      } else if (type === 'CounterGate') {
        title = 'Counter Gate';
        inputs = [
          { id: 'flow', label: '▶ In', type: 'flow' },
          { id: 'reset', label: '↺ Reset', type: 'flow' }
        ];
        outputs = [
          { id: 'reached', label: 'Reached ▶', type: 'flow' },
          { id: 'not_reached', label: 'Pending ▶', type: 'flow' }
        ];
        data = { targetCount: 3 };
      } else if (type === 'Delay') {
        title = 'Delay';
        data = { seconds: 1.0 };
      }
    } else {
      category = 'action';
      if (type === 'RotateObject') {
        title = 'Rotate Object';
        data = { targetId: defaultTargetId, axis: 'y', angle: 90, duration: 1.0 };
      } else if (type === 'SetActive') {
        title = 'Set GameObject Active';
        data = { targetId: defaultTargetId, mode: 'toggle' };
      } else if (type === 'MoveObject') {
        title = 'Move Object';
        data = { targetId: defaultTargetId, dx: 0, dy: 2, dz: 0, duration: 1.0 };
      } else if (type === 'SetVariable') {
        title = 'Set Variable';
        data = { varName: 'hasKey', op: 'set', val: 'true' };
      } else if (type === 'SetUIText') {
        title = 'Set UI Text';
        data = { uiId: '', text: 'Score: {score}' };
      } else if (type === 'SetUIActive') {
        title = 'Set UI Active';
        data = { uiId: '', mode: 'toggle' };
      } else if (type === 'ChangeColor') {
        title = 'Change Color';
        data = { targetId: defaultTargetId, color: '#ffd700' };
      } else if (type === 'InspectItem') {
        title = 'Inspect Item';
        data = { targetId: defaultTargetId };
      }
    }

    const node = { id, type, category, title, scope: this.currentScope || 'global', x, y, inputs, outputs, data };
    this.runtime.nodes.set(id, node);
    if (!skipRender) this._render();
    this._syncAssetGraph();
    return node;
  }

  _createPlayerPreset() {
    this.currentScope = 'player';
    const existing = Array.from(this.runtime.nodes.values()).filter(n => n.scope === 'player');
    existing.forEach(n => {
      this.runtime.connections = this.runtime.connections.filter(c => c.fromNode !== n.id && c.toNode !== n.id);
      this.runtime.nodes.delete(n.id);
    });

    const nUpdate = this._createNode('OnUpdate', 60, 100, true);
    const nInput = this._createNode('InputAxis', 270, 100, true);
    const nMove = this._createNode('MovementDirection', 560, 60, true);
    const nPhys = this._createNode('CharacterPhysics', 560, 340, true);
    const nMoveOut = this._createNode('CharacterMoveOutput', 880, 180, true);

    const nMouse = this._createNode('MouseLookInput', 270, 480, true);
    const nChildCam = this._createNode('GetChildComponent', 560, 480, true);
    nChildCam.data.parentId = 'current';
    nChildCam.data.childName = 'MainCamera';
    nChildCam.data.componentType = 'camera';

    const nRotOut = this._createNode('RotateCameraOutput', 880, 480, true);
    const nParamSpeed = this._createNode('FloatParameter', 270, 320, true);
    nParamSpeed.data.name = 'MoveSpeed';
    nParamSpeed.data.value = 6.0;

    this.runtime.connections.push(
      { id: crypto.randomUUID(), fromNode: nUpdate.id, fromPort: 'flow', toNode: nInput.id, toPort: 'flow' },
      { id: crypto.randomUUID(), fromNode: nInput.id, fromPort: 'flow', toNode: nMove.id, toPort: 'flow' },
      { id: crypto.randomUUID(), fromNode: nInput.id, fromPort: 'horizontal', toNode: nMove.id, toPort: 'horizontal' },
      { id: crypto.randomUUID(), fromNode: nInput.id, fromPort: 'vertical', toNode: nMove.id, toPort: 'vertical' },
      { id: crypto.randomUUID(), fromNode: nInput.id, fromPort: 'sprint', toNode: nMove.id, toPort: 'sprint' },
      { id: crypto.randomUUID(), fromNode: nParamSpeed.id, fromPort: 'val', toNode: nMove.id, toPort: 'speed' },
      { id: crypto.randomUUID(), fromNode: nMove.id, fromPort: 'flow', toNode: nPhys.id, toPort: 'flow' },
      { id: crypto.randomUUID(), fromNode: nInput.id, fromPort: 'jump', toNode: nPhys.id, toPort: 'jump' },
      { id: crypto.randomUUID(), fromNode: nPhys.id, fromPort: 'flow', toNode: nMoveOut.id, toPort: 'flow' },
      { id: crypto.randomUUID(), fromNode: nMove.id, fromPort: 'moveX', toNode: nMoveOut.id, toPort: 'moveX' },
      { id: crypto.randomUUID(), fromNode: nMove.id, fromPort: 'moveZ', toNode: nMoveOut.id, toPort: 'moveZ' },
      { id: crypto.randomUUID(), fromNode: nPhys.id, fromPort: 'velocityY', toNode: nMoveOut.id, toPort: 'velocityY' },

      { id: crypto.randomUUID(), fromNode: nInput.id, fromPort: 'flow', toNode: nMouse.id, toPort: 'flow' },
      { id: crypto.randomUUID(), fromNode: nMouse.id, fromPort: 'flow', toNode: nChildCam.id, toPort: 'flow' },
      { id: crypto.randomUUID(), fromNode: nChildCam.id, fromPort: 'flow', toNode: nRotOut.id, toPort: 'flow' },
      { id: crypto.randomUUID(), fromNode: nMouse.id, fromPort: 'lookX', toNode: nRotOut.id, toPort: 'lookX' },
      { id: crypto.randomUUID(), fromNode: nMouse.id, fromPort: 'lookY', toNode: nRotOut.id, toPort: 'lookY' },
      { id: crypto.randomUUID(), fromNode: nChildCam.id, fromPort: 'child', toNode: nRotOut.id, toPort: 'targetCamera' }
    );

    this._renderTabBar();
    this._render();
  }

  _createDoorPreset() {
    const allObjs = this.sceneManager.getAllObjects();
    const interactObj = allObjs.find(o => o.userData.primitiveType === 'cube') || allObjs[0];
    const doorObj = allObjs.find(o => o.userData.primitiveType === 'cube' && o !== interactObj) || interactObj;

    const n1 = this._createNode('OnInteract', 100, 100);
    if (interactObj) n1.data.targetId = interactObj.userData.id;

    const n2 = this._createNode('FlipFlop', 400, 100);
    const n3 = this._createNode('RotateObject', 700, 50);
    n3.data.targetId = doorObj?.userData.id || '';
    n3.data.axis = 'y';
    n3.data.angle = 90;

    const n4 = this._createNode('RotateObject', 700, 260);
    n4.data.targetId = doorObj?.userData.id || '';
    n4.data.axis = 'y';
    n4.data.angle = -90;

    this.runtime.connections.push(
      { id: crypto.randomUUID(), fromNode: n1.id, fromPort: 'flow', toNode: n2.id, toPort: 'flow' },
      { id: crypto.randomUUID(), fromNode: n2.id, fromPort: 'A', toNode: n3.id, toPort: 'flow' },
      { id: crypto.randomUUID(), fromNode: n2.id, fromPort: 'B', toNode: n4.id, toPort: 'flow' }
    );

    this._render();
  }

  _deleteNode(nodeId) {
    this.runtime.connections = this.runtime.connections.filter(c => c.fromNode !== nodeId && c.toNode !== nodeId);
    this.runtime.nodes.delete(nodeId);
    if (this._selectedNodeId === nodeId) this._selectedNodeId = null;
    this._render();
    this._syncAssetGraph();
  }

  _deleteConnection(connId) {
    this.runtime.connections = this.runtime.connections.filter(c => c.id !== connId);
    if (this._selectedWireId === connId) this._selectedWireId = null;
    this._renderWires();
    this._syncAssetGraph();
  }

  _syncAssetGraph(assetId = null) {
    if (!this.assetManager) return;
    const targetAssetId = assetId || (this.currentScope.startsWith('asset:') ? this.currentScope.replace('asset:', '') : null);
    if (!targetAssetId) return;

    const asset = this.assetManager.getNodeGraph(targetAssetId);
    if (!asset) return;

    const scope = 'asset:' + targetAssetId;
    const nodes = Array.from(this.runtime.nodes.values()).filter(n => n.scope === scope);
    const nodeIds = new Set(nodes.map(n => n.id));
    const connections = this.runtime.connections.filter(c => nodeIds.has(c.fromNode) && nodeIds.has(c.toNode));

    asset.graphData = {
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        category: n.category,
        title: n.title,
        scope: n.scope,
        x: n.x,
        y: n.y,
        data: { ...n.data },
        inputs: n.inputs,
        outputs: n.outputs
      })),
      connections: connections.map(c => ({ ...c }))
    };
    asset.updatedAt = new Date().toISOString();
  }

  _render() {
    this.nodesLayer.innerHTML = '';
    const currentScope = this.currentScope || 'global';
    for (const node of this.runtime.nodes.values()) {
      const nodeScope = node.scope || 'global';
      if (nodeScope !== currentScope) continue;
      const el = this._renderNodeElement(node);
      this.nodesLayer.appendChild(el);
    }
    this._updateTransform();
  }

  _renderNodeElement(node) {
    const isSelected = this._selectedNodeIds.has(node.id);
    const card = document.createElement('div');
    card.className = `nodegraph-card cat-${node.category} ${isSelected ? 'selected' : ''}`;
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;
    card.dataset.nodeId = node.id;

    card.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.port-bullet') || e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) {
        return;
      }
      this._selectedWireId = null;

      const isShift = (e.shiftKey || e.ctrlKey);
      if (!this._selectedNodeIds.has(node.id)) {
        if (!isShift) {
          this._selectedNodeIds.clear();
          this.nodesLayer.querySelectorAll('.nodegraph-card.selected').forEach(c => c.classList.remove('selected'));
        }
        this._selectedNodeIds.add(node.id);
        card.classList.add('selected');
      } else if (isShift) {
        this._selectedNodeIds.delete(node.id);
        card.classList.remove('selected');
      }
    });

    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `<span>${node.title}</span>`;

    const delBtn = document.createElement('button');
    delBtn.className = 'card-del-btn';
    delBtn.title = 'Delete Node';
    delBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._deleteNode(node.id);
    });
    header.appendChild(delBtn);
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'card-body';

    const portsArea = document.createElement('div');
    portsArea.className = 'ports-area';

    const inCol = document.createElement('div');
    inCol.className = 'ports-column in';
    (node.inputs || []).forEach(port => {
      const item = document.createElement('div');
      item.className = 'port-item in';

      const bullet = document.createElement('div');
      bullet.className = `port-bullet port-type-${port.type || 'flow'}`;
      bullet.dataset.port = port.id;
      item.appendChild(bullet);

      const label = document.createElement('span');
      label.className = 'port-label';
      label.textContent = port.label;
      item.appendChild(label);

      inCol.appendChild(item);
    });
    portsArea.appendChild(inCol);

    const outCol = document.createElement('div');
    outCol.className = 'ports-column out';
    (node.outputs || []).forEach(port => {
      const item = document.createElement('div');
      item.className = 'port-item out';

      const label = document.createElement('span');
      label.className = 'port-label';
      label.textContent = port.label;
      item.appendChild(label);

      const bullet = document.createElement('div');
      bullet.className = `port-bullet port-type-${port.type || 'flow'}`;
      bullet.dataset.port = port.id;

      bullet.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this._startWire(node.id, port.id, bullet);
      });

      item.appendChild(bullet);
      outCol.appendChild(item);
    });
    portsArea.appendChild(outCol);
    body.appendChild(portsArea);

    const customFields = document.createElement('div');
    customFields.className = 'node-custom-fields';
    this._buildNodeBody(node, customFields);
    body.appendChild(customFields);

    card.appendChild(body);

    this._setupDrag(card, node);

    return card;
  }

  _setupDrag(card, node) {
    let startX = 0, startY = 0;
    const initialPositions = new Map();
    let isDragging = false;

    const onPointerDown = (e) => {
      if (e.target.closest('.port-bullet') || e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) {
        return;
      }
      if (e.button !== 0) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      initialPositions.clear();
      for (const id of this._selectedNodeIds) {
        const n = this.runtime.nodes.get(id);
        if (n) {
          initialPositions.set(id, { x: n.x, y: n.y });
        }
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const dx = (e.clientX - startX) / this._zoom;
      const dy = (e.clientY - startY) / this._zoom;

      for (const [id, pos] of initialPositions.entries()) {
        const n = this.runtime.nodes.get(id);
        if (!n) continue;
        n.x = Math.round(pos.x + dx);
        n.y = Math.round(pos.y + dy);
        const c = this.nodesLayer.querySelector(`[data-node-id="${id}"]`);
        if (c) {
          c.style.left = `${n.x}px`;
          c.style.top = `${n.y}px`;
        }
      }
      this._renderWires();
    };

    const onPointerUp = () => {
      isDragging = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      this._syncAssetGraph();
    };

    card.addEventListener('pointerdown', onPointerDown);
  }

  _buildNodeBody(node, container) {
    const addObjSelect = (label, currentVal, onChange) => {
      const row = document.createElement('div');
      row.className = 'node-field-row';
      row.innerHTML = `<span class="field-lbl">${label}</span>`;
      const select = document.createElement('select');
      select.className = 'node-select';

      const defOpt = document.createElement('option');
      defOpt.value = 'any';
      defOpt.textContent = '-- Any Object --';
      select.appendChild(defOpt);

      const objs = this.sceneManager.getAllObjects();
      for (const o of objs) {
        const opt = document.createElement('option');
        opt.value = o.userData.id;
        opt.textContent = o.userData.name || o.name || 'Object';
        if (o.userData.id === currentVal) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', (e) => onChange(e.target.value));
      row.appendChild(select);
      container.appendChild(row);
    };

    switch (node.type) {
      case 'OnInteract':
      case 'OnTriggerEnter':
      case 'OnTriggerExit': {
        addObjSelect('Filter', node.data.targetId, val => node.data.targetId = val);
        break;
      }

      case 'OnVariableChanged': {
        const row = document.createElement('div');
        row.className = 'node-field-row';
        row.innerHTML = `<span class="field-lbl">Variable</span><input class="node-input" type="text" value="${node.data.varName || 'any'}">`;
        row.querySelector('input').addEventListener('input', e => node.data.varName = e.target.value);
        container.appendChild(row);
        break;
      }

      case 'MovementDirection': {
        const r1 = document.createElement('div');
        r1.className = 'node-field-row';
        r1.innerHTML = `<span class="field-lbl">Speed</span><input class="node-input" type="number" step="0.5" value="${node.data.speed ?? 5}">`;
        r1.querySelector('input').addEventListener('input', e => node.data.speed = parseFloat(e.target.value) || 0);
        container.appendChild(r1);

        const r2 = document.createElement('div');
        r2.className = 'node-field-row';
        r2.innerHTML = `<span class="field-lbl">Lerp Speed</span><input class="node-input" type="number" step="1" value="${node.data.lerpSpeed ?? 10}">`;
        r2.querySelector('input').addEventListener('input', e => node.data.lerpSpeed = parseFloat(e.target.value) || 0);
        container.appendChild(r2);
        break;
      }

      case 'CharacterPhysics': {
        const r1 = document.createElement('div');
        r1.className = 'node-field-row';
        r1.innerHTML = `<span class="field-lbl">Jump Force</span><input class="node-input" type="number" step="0.5" value="${node.data.jumpForce ?? 8}">`;
        r1.querySelector('input').addEventListener('input', e => node.data.jumpForce = parseFloat(e.target.value) || 0);
        container.appendChild(r1);

        const r2 = document.createElement('div');
        r2.className = 'node-field-row';
        r2.innerHTML = `<span class="field-lbl">Gravity</span><input class="node-input" type="number" step="1" value="${node.data.gravity ?? -15}">`;
        r2.querySelector('input').addEventListener('input', e => node.data.gravity = parseFloat(e.target.value) || 0);
        container.appendChild(r2);
        break;
      }

      case 'CharacterMoveOutput': {
        addObjSelect('Target', node.data.targetId, val => node.data.targetId = val);
        const r1 = document.createElement('div');
        r1.className = 'node-field-row';
        r1.innerHTML = `<span class="field-lbl">Radius</span><input class="node-input" type="number" step="0.05" value="${node.data.radius ?? 0.3}">`;
        r1.querySelector('input').addEventListener('input', e => node.data.radius = parseFloat(e.target.value) || 0.3);
        container.appendChild(r1);
        break;
      }

      case 'RotateCameraOutput': {
        addObjSelect('Camera', node.data.cameraId, val => node.data.cameraId = val);
        const r1 = document.createElement('div');
        r1.className = 'node-field-row';
        r1.innerHTML = `<span class="field-lbl">Sensitivity</span><input class="node-input" type="number" step="0.0005" value="${node.data.sensitivity ?? 0.002}">`;
        r1.querySelector('input').addEventListener('input', e => node.data.sensitivity = parseFloat(e.target.value) || 0.002);
        container.appendChild(r1);
        break;
      }

      case 'CheckCondition': {
        const r1 = document.createElement('div');
        r1.className = 'node-field-row';
        r1.innerHTML = `<span class="field-lbl">Variable</span><input class="node-input" type="text" value="${node.data.varName || 'hasKey'}">`;
        r1.querySelector('input').addEventListener('input', e => node.data.varName = e.target.value);
        container.appendChild(r1);

        const r2 = document.createElement('div');
        r2.className = 'node-field-row';
        r2.innerHTML = `
          <span class="field-lbl">Operator</span>
          <select class="node-select">
            <option value="==">== (Equals)</option>
            <option value="!=">!= (Not Equal)</option>
            <option value=">">&gt; (Greater)</option>
            <option value="<">&lt; (Less)</option>
            <option value=">=">&gt;= (Greater/Eq)</option>
            <option value="<=">&lt;= (Less/Eq)</option>
          </select>
        `;
        const opSel = r2.querySelector('select');
        opSel.value = node.data.operator || '==';
        opSel.addEventListener('change', e => node.data.operator = e.target.value);
        container.appendChild(r2);

        const r3 = document.createElement('div');
        r3.className = 'node-field-row';
        r3.innerHTML = `<span class="field-lbl">Value</span><input class="node-input" type="text" value="${node.data.value || 'true'}">`;
        r3.querySelector('input').addEventListener('input', e => node.data.value = e.target.value);
        container.appendChild(r3);
        break;
      }

      case 'GetVariable': {
        const r1 = document.createElement('div');
        r1.className = 'node-field-row';
        r1.innerHTML = `<span class="field-lbl">Variable</span><input class="node-input" type="text" value="${node.data.varName || 'coins'}">`;
        r1.querySelector('input').addEventListener('input', e => node.data.varName = e.target.value);
        container.appendChild(r1);
        break;
      }

      case 'CounterGate': {
        const r1 = document.createElement('div');
        r1.className = 'node-field-row';
        r1.innerHTML = `<span class="field-lbl">Count</span><input class="node-input" type="number" min="1" value="${node.data.targetCount || 3}">`;
        r1.querySelector('input').addEventListener('input', e => node.data.targetCount = parseInt(e.target.value, 10) || 1);
        container.appendChild(r1);
        break;
      }

      case 'Delay': {
        const r1 = document.createElement('div');
        r1.className = 'node-field-row';
        r1.innerHTML = `<span class="field-lbl">Seconds</span><input class="node-input" type="number" step="0.1" value="${node.data.seconds || 1.0}">`;
        r1.querySelector('input').addEventListener('input', e => node.data.seconds = parseFloat(e.target.value) || 1.0);
        container.appendChild(r1);
        break;
      }

      case 'RotateObject': {
        addObjSelect('Target', node.data.targetId, val => node.data.targetId = val);
        const r1 = document.createElement('div');
        r1.className = 'node-field-row';
        r1.innerHTML = `
          <span class="field-lbl">Axis</span>
          <select class="node-select">
            <option value="y">Y Axis (Turn/Spin)</option>
            <option value="x">X Axis (Pitch/Hinge)</option>
            <option value="z">Z Axis (Roll)</option>
          </select>
        `;
        const ax = r1.querySelector('select');
        ax.value = node.data.axis || 'y';
        ax.addEventListener('change', e => node.data.axis = e.target.value);
        container.appendChild(r1);

        const r2 = document.createElement('div');
        r2.className = 'node-field-row';
        r2.innerHTML = `<span class="field-lbl">Angle</span><input class="node-input" type="number" value="${node.data.angle || 90}">`;
        r2.querySelector('input').addEventListener('input', e => node.data.angle = parseFloat(e.target.value) || 0);
        container.appendChild(r2);

        const r3 = document.createElement('div');
        r3.className = 'node-field-row';
        r3.innerHTML = `<span class="field-lbl">Duration</span><input class="node-input" type="number" step="0.1" value="${node.data.duration || 1.0}">`;
        r3.querySelector('input').addEventListener('input', e => node.data.duration = parseFloat(e.target.value) || 1.0);
        container.appendChild(r3);
        break;
      }

      case 'MoveObject': {
        addObjSelect('Target', node.data.targetId, val => node.data.targetId = val);
        const r1 = document.createElement('div');
        r1.className = 'node-field-row';
        r1.innerHTML = `
          <span class="field-lbl">Offset</span>
          <div style="display:flex;gap:4px;flex:1;">
            <input class="node-input" style="width:33%" placeholder="X" type="number" value="${node.data.dx || 0}">
            <input class="node-input" style="width:33%" placeholder="Y" type="number" value="${node.data.dy || 0}">
            <input class="node-input" style="width:33%" placeholder="Z" type="number" value="${node.data.dz || 0}">
          </div>
        `;
        const inputs = r1.querySelectorAll('input');
        inputs[0].addEventListener('input', e => node.data.dx = parseFloat(e.target.value) || 0);
        inputs[1].addEventListener('input', e => node.data.dy = parseFloat(e.target.value) || 0);
        inputs[2].addEventListener('input', e => node.data.dz = parseFloat(e.target.value) || 0);
        container.appendChild(r1);

        const r2 = document.createElement('div');
        r2.className = 'node-field-row';
        r2.innerHTML = `<span class="field-lbl">Duration</span><input class="node-input" type="number" step="0.1" value="${node.data.duration || 1.0}">`;
        r2.querySelector('input').addEventListener('input', e => node.data.duration = parseFloat(e.target.value) || 1.0);
        container.appendChild(r2);
        break;
      }

      case 'SetActive': {
        addObjSelect('Target', node.data.targetId, val => node.data.targetId = val);
        const r = document.createElement('div');
        r.className = 'node-field-row';
        r.innerHTML = `
          <span class="field-lbl">Action</span>
          <select class="node-select">
            <option value="toggle">Toggle</option>
            <option value="show">Show / Enable</option>
            <option value="hide">Hide / Disable</option>
          </select>
        `;
        const s = r.querySelector('select');
        s.value = node.data.mode || 'toggle';
        s.addEventListener('change', e => node.data.mode = e.target.value);
        container.appendChild(r);
        break;
      }

      case 'SetVariable': {
        const r1 = document.createElement('div');
        r1.className = 'node-field-row';
        r1.innerHTML = `<span class="field-lbl">Variable</span><input class="node-input" type="text" value="${node.data.varName || 'coins'}">`;
        r1.querySelector('input').addEventListener('input', e => node.data.varName = e.target.value);
        container.appendChild(r1);

        const r2 = document.createElement('div');
        r2.className = 'node-field-row';
        r2.innerHTML = `
          <span class="field-lbl">Operation</span>
          <select class="node-select">
            <option value="set">Set =</option>
            <option value="add">Add +</option>
            <option value="subtract">Subtract -</option>
            <option value="toggle">Toggle Bool</option>
          </select>
        `;
        const op = r2.querySelector('select');
        op.value = node.data.op || 'set';
        op.addEventListener('change', e => node.data.op = e.target.value);
        container.appendChild(r2);

        const r3 = document.createElement('div');
        r3.className = 'node-field-row';
        r3.innerHTML = `<span class="field-lbl">Value</span><input class="node-input" type="text" value="${node.data.val || '1'}">`;
        r3.querySelector('input').addEventListener('input', e => node.data.val = e.target.value);
        container.appendChild(r3);
        break;
      }

      case 'SetUIActive': {
        const row = document.createElement('div');
        row.className = 'node-field-row';
        row.innerHTML = `<span class="field-lbl">UI Target</span>`;
        const select = document.createElement('select');
        select.className = 'node-select';

        const baseOpts = [
          { id: 'base:crosshair', name: 'Base: Crosshair' },
          { id: 'base:joystick', name: 'Base: Joystick' },
          { id: 'base:prompt', name: 'Base: Prompt' },
        ];
        baseOpts.forEach(b => {
          const opt = document.createElement('option');
          opt.value = b.id;
          opt.textContent = b.name;
          if (b.id === node.data.uiId) opt.selected = true;
          select.appendChild(opt);
        });

        const uis = this.uiManager ? this.uiManager.getAllElements() : [];
        uis.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.id;
          opt.textContent = u.name || 'Custom UI';
          if (u.id === node.data.uiId) opt.selected = true;
          select.appendChild(opt);
        });
        if (!node.data.uiId) {
          node.data.uiId = baseOpts[0].id;
        }

        select.addEventListener('change', e => node.data.uiId = e.target.value);
        row.appendChild(select);
        container.appendChild(row);

        const r2 = document.createElement('div');
        r2.className = 'node-field-row';
        r2.innerHTML = `
          <span class="field-lbl">State</span>
          <select class="node-select">
            <option value="toggle">Toggle</option>
            <option value="show">Show</option>
            <option value="hide">Hide</option>
          </select>
        `;
        const s2 = r2.querySelector('select');
        s2.value = node.data.mode || 'toggle';
        s2.addEventListener('change', e => node.data.mode = e.target.value);
        container.appendChild(r2);
        break;
      }

      case 'SetUIText': {
        const row = document.createElement('div');
        row.className = 'node-field-row';
        row.innerHTML = `<span class="field-lbl">UI Target</span>`;
        const select = document.createElement('select');
        select.className = 'node-select';

        const uis = this.uiManager ? this.uiManager.getAllElements().filter(u => u.type === 'text') : [];
        uis.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.id;
          opt.textContent = u.name || 'Text UI';
          if (u.id === node.data.uiId) opt.selected = true;
          select.appendChild(opt);
        });
        if (!node.data.uiId && uis.length > 0) {
          node.data.uiId = uis[0].id;
        }
        select.addEventListener('change', e => node.data.uiId = e.target.value);
        row.appendChild(select);
        container.appendChild(row);

        const r2 = document.createElement('div');
        r2.className = 'node-field-row';
        r2.innerHTML = `<span class="field-lbl">Template</span><input class="node-input" type="text" value="${node.data.text || 'Score: {score}'}">`;
        r2.querySelector('input').addEventListener('input', e => node.data.text = e.target.value);
        container.appendChild(r2);
        break;
      }

      case 'ChangeColor': {
        addObjSelect('Target', node.data.targetId, val => node.data.targetId = val);
        const r1 = document.createElement('div');
        r1.className = 'node-field-row';
        r1.innerHTML = `<span class="field-lbl">Color</span><input class="node-input" type="color" value="${node.data.color || '#ffd700'}">`;
        r1.querySelector('input').addEventListener('input', e => node.data.color = e.target.value);
        container.appendChild(r1);
        break;
      }

      case 'InspectItem':
        addObjSelect('Target', node.data.targetId, val => node.data.targetId = val);
        break;

      case 'Parameter':
      case 'FloatParameter':
      case 'IntParameter':
      case 'StringParameter':
      case 'BooleanParameter':
      case 'Vector3Parameter':
      case 'ListParameter':
      case 'DictionaryParameter': {
        const rName = document.createElement('div');
        rName.className = 'node-field-row';
        rName.innerHTML = `<span class="field-lbl">Name</span><input class="node-input" type="text" value="${node.data.name || 'param'}">`;
        rName.querySelector('input').addEventListener('input', e => node.data.name = e.target.value.trim());
        container.appendChild(rName);

        const rType = document.createElement('div');
        rType.className = 'node-field-row';
        rType.innerHTML = `
          <span class="field-lbl">Type</span>
          <select class="node-select">
            <option value="float">Float / Double</option>
            <option value="int">Integer (Int)</option>
            <option value="string">String (Text)</option>
            <option value="boolean">Boolean (Toggle)</option>
            <option value="vector3">Vector3 (X, Y, Z)</option>
            <option value="list">List / Array</option>
            <option value="dictionary">Dictionary / Map</option>
          </select>
        `;
        const typeSel = rType.querySelector('select');
        typeSel.value = node.data.dataType || 'float';
        container.appendChild(rType);

        const valWrap = document.createElement('div');
        container.appendChild(valWrap);

        const refreshValUI = () => {
          valWrap.innerHTML = '';
          const curType = node.data.dataType || 'float';

          if (curType === 'float') {
            const r = document.createElement('div');
            r.className = 'node-field-row';
            r.innerHTML = `<span class="field-lbl">Value</span><input class="node-input" type="number" step="0.01" value="${node.data.value ?? 0}">`;
            r.querySelector('input').addEventListener('input', e => node.data.value = parseFloat(e.target.value) || 0);
            valWrap.appendChild(r);
          } else if (curType === 'int') {
            const r = document.createElement('div');
            r.className = 'node-field-row';
            r.innerHTML = `<span class="field-lbl">Value</span><input class="node-input" type="number" step="1" value="${node.data.value ?? 0}">`;
            r.querySelector('input').addEventListener('input', e => node.data.value = parseInt(e.target.value, 10) || 0);
            valWrap.appendChild(r);
          } else if (curType === 'string') {
            const r = document.createElement('div');
            r.className = 'node-field-row';
            r.innerHTML = `<span class="field-lbl">Value</span><input class="node-input" type="text" value="${node.data.value ?? ''}">`;
            r.querySelector('input').addEventListener('input', e => node.data.value = e.target.value);
            valWrap.appendChild(r);
          } else if (curType === 'boolean') {
            const r = document.createElement('div');
            r.className = 'node-field-row';
            const isChecked = Boolean(node.data.value === true || node.data.value === 'true' || node.data.value === 1);
            r.innerHTML = `<span class="field-lbl">Value</span><input type="checkbox" ${isChecked ? 'checked' : ''} style="cursor:pointer;">`;
            r.querySelector('input').addEventListener('change', e => node.data.value = e.target.checked);
            valWrap.appendChild(r);
          } else if (curType === 'vector3') {
            const r = document.createElement('div');
            r.className = 'node-field-row';
            r.innerHTML = `
              <span class="field-lbl">Vector3</span>
              <div style="display:flex;gap:4px;flex:1;">
                <input class="node-input" style="width:33%" placeholder="X" type="number" step="0.1" value="${node.data.x ?? 0}">
                <input class="node-input" style="width:33%" placeholder="Y" type="number" step="0.1" value="${node.data.y ?? 0}">
                <input class="node-input" style="width:33%" placeholder="Z" type="number" step="0.1" value="${node.data.z ?? 0}">
              </div>
            `;
            const inputs = r.querySelectorAll('input');
            inputs[0].addEventListener('input', e => node.data.x = parseFloat(e.target.value) || 0);
            inputs[1].addEventListener('input', e => node.data.y = parseFloat(e.target.value) || 0);
            inputs[2].addEventListener('input', e => node.data.z = parseFloat(e.target.value) || 0);
            valWrap.appendChild(r);
          } else if (curType === 'list') {
            const r = document.createElement('div');
            r.className = 'node-field-row-col';
            let initialVal = node.data.value;
            if (typeof initialVal !== 'string') {
              initialVal = JSON.stringify(initialVal || ['item1', 'item2']);
            }
            r.innerHTML = `
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--text-muted);margin-bottom:2px;">
                <span>List / Array (JSON or a, b)</span>
              </div>
              <textarea class="node-textarea" rows="2" placeholder='["a", "b"] or 1, 2, 3'>${initialVal}</textarea>
            `;
            const ta = r.querySelector('textarea');
            ta.addEventListener('input', e => node.data.value = e.target.value);
            valWrap.appendChild(r);
          } else if (curType === 'dictionary') {
            const r = document.createElement('div');
            r.className = 'node-field-row-col';
            let initialVal = node.data.value;
            if (typeof initialVal !== 'string') {
              initialVal = JSON.stringify(initialVal || { key: 'value' });
            }
            r.innerHTML = `
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--text-muted);margin-bottom:2px;">
                <span>Dictionary / Map (JSON)</span>
              </div>
              <textarea class="node-textarea" rows="2" placeholder='{"key": "value"}'>${initialVal}</textarea>
            `;
            const ta = r.querySelector('textarea');
            ta.addEventListener('input', e => node.data.value = e.target.value);
            valWrap.appendChild(r);
          }
        };

        typeSel.addEventListener('change', (e) => {
          node.data.dataType = e.target.value;
          if (node.data.dataType === 'vector3') {
            if (node.data.x === undefined) node.data.x = 0;
            if (node.data.y === undefined) node.data.y = 0;
            if (node.data.z === undefined) node.data.z = 0;
          } else if (node.data.dataType === 'list' && !node.data.value) {
            node.data.value = '["item1", "item2"]';
          } else if (node.data.dataType === 'dictionary' && !node.data.value) {
            node.data.value = '{"key": "value"}';
          }
          refreshValUI();
        });

        refreshValUI();
        break;
      }

      case 'GetChildComponent': {
        const rParent = document.createElement('div');
        rParent.className = 'node-field-row';
        rParent.innerHTML = `<span class="field-lbl">Parent</span><select class="node-select"></select>`;
        const parentSel = rParent.querySelector('select');

        const curOpt = document.createElement('option');
        curOpt.value = 'current';
        curOpt.textContent = '-- Current Object / Scope --';
        parentSel.appendChild(curOpt);

        const allObjs = this.sceneManager.getAllObjects();
        for (const o of allObjs) {
          const opt = document.createElement('option');
          opt.value = o.userData.id;
          opt.textContent = o.userData.name || o.name || 'Object';
          if (o.userData.id === node.data.parentId) opt.selected = true;
          parentSel.appendChild(opt);
        }
        container.appendChild(rParent);

        const rChild = document.createElement('div');
        rChild.className = 'node-field-row';
        rChild.innerHTML = `<span class="field-lbl">Child</span><select class="node-select"></select>`;
        const childSel = rChild.querySelector('select');
        container.appendChild(rChild);

        const rComp = document.createElement('div');
        rComp.className = 'node-field-row';
        rComp.innerHTML = `<span class="field-lbl">Component</span><select class="node-select"></select>`;
        const compSel = rComp.querySelector('select');
        container.appendChild(rComp);

        const refreshChildAndComp = () => {
          childSel.innerHTML = '';
          let pId = node.data.parentId;
          let pObj = null;
          if (pId && pId !== 'current') {
            pObj = this.sceneManager.getObject(pId);
          }
          if (!pObj && this.currentScope && this.currentScope.startsWith('object:')) {
            pObj = this.sceneManager.getObject(this.currentScope.replace('object:', ''));
          }
          if (!pObj) {
            pObj = allObjs.find(o => o.userData?.type === 'player_controller') || allObjs[0];
          }

          let children = [];
          if (pObj) {
            children = this.sceneManager.getChildren(pObj.userData.id);
            if (children.length === 0 && pObj.children) {
              children = pObj.children.filter(c => !c.userData?.isGizmo);
            }
          }

          if (children.length === 0) {
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '-- No Children Found --';
            childSel.appendChild(emptyOpt);
          } else {
            for (const ch of children) {
              const opt = document.createElement('option');
              const chId = ch.userData?.id || ch.id;
              opt.value = chId;
              opt.textContent = ch.userData?.name || ch.name || 'Child Object';
              if (chId === node.data.childId || (!node.data.childId && ch === children[0])) {
                opt.selected = true;
                node.data.childId = chId;
                node.data.childName = ch.userData?.name || ch.name || '';
              }
              childSel.appendChild(opt);
            }
          }

          refreshComponents();
        };

        const refreshComponents = () => {
          compSel.innerHTML = '';
          const chObj = this.sceneManager.getObject(node.data.childId) || allObjs.find(o => o.userData?.id === node.data.childId || o.name === node.data.childId);
          const compList = ['camera', 'playerController', 'collider', 'mesh', 'interaction', 'nodeGraph'];
          const availableComps = [];

          if (chObj && chObj.userData?.components) {
            for (const k of Object.keys(chObj.userData.components)) {
              if (!availableComps.includes(k)) availableComps.push(k);
            }
          }
          if (chObj && (chObj.isCamera || chObj.userData?.type === 'camera')) {
            if (!availableComps.includes('camera')) availableComps.push('camera');
          }
          compList.forEach(c => {
            if (!availableComps.includes(c)) availableComps.push(c);
          });

          for (const cName of availableComps) {
            const opt = document.createElement('option');
            opt.value = cName;
            opt.textContent = cName.charAt(0).toUpperCase() + cName.slice(1);
            if (cName === node.data.componentType) opt.selected = true;
            compSel.appendChild(opt);
          }
          if (!node.data.componentType && availableComps.length > 0) {
            node.data.componentType = availableComps[0];
          }
        };

        parentSel.addEventListener('change', (e) => {
          node.data.parentId = e.target.value;
          node.data.childId = '';
          refreshChildAndComp();
        });

        childSel.addEventListener('change', (e) => {
          node.data.childId = e.target.value;
          const selectedChild = allObjs.find(o => o.userData?.id === node.data.childId);
          node.data.childName = selectedChild?.userData?.name || selectedChild?.name || '';
          refreshComponents();
        });

        compSel.addEventListener('change', (e) => {
          node.data.componentType = e.target.value;
        });

        refreshChildAndComp();
        break;
      }

      case 'DynamicInterface': {
        if (!node.data.customInputs) node.data.customInputs = [];
        if (!node.data.customOutputs) node.data.customOutputs = [];
        if (!node.data.values) node.data.values = {};

        const btnRow = document.createElement('div');
        btnRow.className = 'node-field-row';
        btnRow.style.gap = '6px';
        btnRow.style.marginTop = '2px';

        const addInBtn = document.createElement('button');
        addInBtn.className = 'node-btn-small';
        addInBtn.textContent = '+ Add Input';
        addInBtn.title = 'Add dynamic input port';

        const addOutBtn = document.createElement('button');
        addOutBtn.className = 'node-btn-small';
        addOutBtn.textContent = '+ Add Output';
        addOutBtn.title = 'Add dynamic output port';

        btnRow.appendChild(addInBtn);
        btnRow.appendChild(addOutBtn);
        container.appendChild(btnRow);

        const listWrap = document.createElement('div');
        listWrap.className = 'dynamic-ports-list';
        container.appendChild(listWrap);

        const rebuildPortsAndRender = () => {
          node.inputs = [
            { id: 'flow', label: '▶ In', type: 'flow' },
            ...node.data.customInputs.map(p => ({
              id: p.id,
              label: `▶ ${p.name}`,
              type: p.type || 'any'
            }))
          ];

          node.outputs = [
            { id: 'flow', label: 'Out ▶', type: 'flow' },
            ...node.data.customOutputs.map(p => ({
              id: p.id,
              label: `${p.name} ▶`,
              type: p.type || 'any'
            }))
          ];

          this._render();
        };

        const renderPortRows = () => {
          listWrap.innerHTML = '';

          if (node.data.customInputs.length > 0) {
            const inHead = document.createElement('div');
            inHead.className = 'dynamic-section-lbl';
            inHead.textContent = 'Inputs (Public Receive)';
            listWrap.appendChild(inHead);

            node.data.customInputs.forEach((p, idx) => {
              const row = document.createElement('div');
              row.className = 'node-port-def-row';
              row.innerHTML = `
                <input class="node-input-mini" type="text" value="${p.name}">
                <select class="node-select-mini">
                  <option value="number" ${p.type === 'number' ? 'selected' : ''}>Num</option>
                  <option value="string" ${p.type === 'string' ? 'selected' : ''}>Str</option>
                  <option value="boolean" ${p.type === 'boolean' ? 'selected' : ''}>Bool</option>
                  <option value="any" ${p.type === 'any' ? 'selected' : ''}>Any</option>
                </select>
                <button class="node-btn-mini-del" title="Remove Port"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              `;
              const nameInp = row.querySelector('input');
              const typeSel = row.querySelector('select');
              const delBtn = row.querySelector('.node-btn-mini-del');

              nameInp.addEventListener('change', () => {
                p.name = nameInp.value.trim() || `in_${idx + 1}`;
                p.id = p.name.replace(/\s+/g, '_');
                rebuildPortsAndRender();
              });
              typeSel.addEventListener('change', () => {
                p.type = typeSel.value;
                rebuildPortsAndRender();
              });
              delBtn.addEventListener('click', () => {
                this.runtime.connections = this.runtime.connections.filter(c => !(c.toNode === node.id && c.toPort === p.id));
                node.data.customInputs.splice(idx, 1);
                delete node.data.values[p.id];
                rebuildPortsAndRender();
              });
              listWrap.appendChild(row);
            });
          }

          if (node.data.customOutputs.length > 0) {
            const outHead = document.createElement('div');
            outHead.className = 'dynamic-section-lbl';
            outHead.textContent = 'Outputs (Public Expose)';
            listWrap.appendChild(outHead);

            node.data.customOutputs.forEach((p, idx) => {
              const row = document.createElement('div');
              row.className = 'node-port-def-row';
              row.innerHTML = `
                <input class="node-input-mini" type="text" value="${p.name}">
                <select class="node-select-mini">
                  <option value="number" ${p.type === 'number' ? 'selected' : ''}>Num</option>
                  <option value="string" ${p.type === 'string' ? 'selected' : ''}>Str</option>
                  <option value="boolean" ${p.type === 'boolean' ? 'selected' : ''}>Bool</option>
                  <option value="any" ${p.type === 'any' ? 'selected' : ''}>Any</option>
                </select>
                <button class="node-btn-mini-del" title="Remove Port"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              `;
              const nameInp = row.querySelector('input');
              const typeSel = row.querySelector('select');
              const delBtn = row.querySelector('.node-btn-mini-del');

              nameInp.addEventListener('change', () => {
                p.name = nameInp.value.trim() || `out_${idx + 1}`;
                p.id = p.name.replace(/\s+/g, '_');
                rebuildPortsAndRender();
              });
              typeSel.addEventListener('change', () => {
                p.type = typeSel.value;
                rebuildPortsAndRender();
              });
              delBtn.addEventListener('click', () => {
                this.runtime.connections = this.runtime.connections.filter(c => !(c.fromNode === node.id && c.fromPort === p.id));
                node.data.customOutputs.splice(idx, 1);
                delete node.data.values[p.id];
                rebuildPortsAndRender();
              });
              listWrap.appendChild(row);
            });
          }
        };

        addInBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const count = node.data.customInputs.length + 1;
          const pName = `input_${count}`;
          node.data.customInputs.push({ id: pName, name: pName, type: 'number' });
          rebuildPortsAndRender();
        });

        addOutBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const count = node.data.customOutputs.length + 1;
          const pName = `output_${count}`;
          node.data.customOutputs.push({ id: pName, name: pName, type: 'number' });
          rebuildPortsAndRender();
        });

        renderPortRows();
        break;
      }
    }
  }

  _startWire(fromNodeId, fromPortId, bulletEl) {
    const rect = bulletEl.getBoundingClientRect();
    const wrapRect = this.canvasWrap.getBoundingClientRect();

    const startX = (rect.left + rect.width / 2 - wrapRect.left);
    const startY = (rect.top + rect.height / 2 - wrapRect.top);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'wire-path active');
    this.svg.appendChild(path);

    this._activeWire = {
      fromNode: fromNodeId,
      fromPort: fromPortId,
      startX,
      startY,
      pathEl: path
    };
  }

  _updateActiveWire(e) {
    const wrapRect = this.canvasWrap.getBoundingClientRect();
    const curX = e.clientX - wrapRect.left;
    const curY = e.clientY - wrapRect.top;

    const d = this._calcBezier(this._activeWire.startX, this._activeWire.startY, curX, curY);
    this._activeWire.pathEl.setAttribute('d', d);
  }

  _cancelActiveWire(e) {
    if (!this._activeWire) return;

    const clientX = e?.clientX ?? (window.event?.clientX || 0);
    const clientY = e?.clientY ?? (window.event?.clientY || 0);
    const hovered = document.elementFromPoint(clientX, clientY);
    const inBullet = hovered?.closest('.port-item.in .port-bullet');
    if (inBullet) {
      const card = inBullet.closest('.nodegraph-card');
      const toNode = card?.dataset.nodeId;
      const toPort = inBullet.dataset.port;

      if (toNode && toPort && toNode !== this._activeWire.fromNode) {
        this.runtime.connections = this.runtime.connections.filter(
          c => !(c.fromNode === this._activeWire.fromNode && c.fromPort === this._activeWire.fromPort && c.toNode === toNode && c.toPort === toPort)
        );

        this.runtime.connections.push({
          id: crypto.randomUUID(),
          fromNode: this._activeWire.fromNode,
          fromPort: this._activeWire.fromPort,
          toNode,
          toPort
        });
      }
    }

    this._activeWire.pathEl.remove();
    this._activeWire = null;
    this._renderWires();
    this._syncAssetGraph();
  }

  _calcBezier(x1, y1, x2, y2) {
    const dx = Math.max(30, Math.abs(x2 - x1) * 0.5);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  }

  _renderWires() {
    this.svg.innerHTML = '';
    const wrapRect = this.canvasWrap.getBoundingClientRect();

    this.runtime.connections.forEach(conn => {
      const fromCard = this.nodesLayer.querySelector(`[data-node-id="${conn.fromNode}"]`);
      const toCard = this.nodesLayer.querySelector(`[data-node-id="${conn.toNode}"]`);
      if (!fromCard || !toCard) return;

      const fromBullet = fromCard.querySelector(`.port-item.out [data-port="${conn.fromPort}"]`);
      const toBullet = toCard.querySelector(`.port-item.in [data-port="${conn.toPort}"]`);
      if (!fromBullet || !toBullet) return;

      const r1 = fromBullet.getBoundingClientRect();
      const r2 = toBullet.getBoundingClientRect();

      const x1 = r1.left + r1.width / 2 - wrapRect.left;
      const y1 = r1.top + r1.height / 2 - wrapRect.top;
      const x2 = r2.left + r2.width / 2 - wrapRect.left;
      const y2 = r2.top + r2.height / 2 - wrapRect.top;

      const d = this._calcBezier(x1, y1, x2, y2);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const isSelected = (this._selectedWireId === conn.id);
      path.setAttribute('class', `wire-path ${isSelected ? 'selected' : ''}`);
      path.setAttribute('d', d);
      path.dataset.wireId = conn.id;

      path.style.pointerEvents = 'stroke';
      path.style.cursor = 'pointer';

      path.addEventListener('click', (e) => {
        e.stopPropagation();
        this._selectedWireId = conn.id;
        this._selectedNodeId = null;
        this._renderWires();
      });

      path.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._deleteConnection(conn.id);
      });

      this.svg.appendChild(path);
    });
  }
  //#endregion
}

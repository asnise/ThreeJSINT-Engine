import * as THREE from 'three';
import { Primitives } from '../engine/Primitives.js';

const CUBE_ICON_SVG = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0;"><path d="M8 1.5 L14.5 5.25 L14.5 12.75 L8 16.5 L1.5 12.75 L1.5 5.25 Z"/><path d="M8 1.5 L8 16.5"/><path d="M1.5 5.25 L8 9 L14.5 5.25"/></svg>';
const PLAYER_ICON_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0;color:#06b6d4;"><circle cx="12" cy="7" r="4"/><path d="M5.5 21v-2a6.5 6.5 0 0 1 13 0v2"/></svg>';
const CAMERA_ICON_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0;color:#818cf8;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

export class Hierarchy {
  //#region [Variables/Fields]
  container = null;
  sceneManager = null;
  assetManager = null;
  callbacks = null;
  panelHeader = null;
  content = null;
  _collapsedNodes = new Set();
  _contextMenu = null;
  _contextTargetId = null;
  //#endregion

  //#region [Properties]
  get selectedObject() {
    return this.sceneManager ? this.sceneManager.selectedObject : null;
  }
  //#endregion

  //#region [Unity Methods]
  constructor(container, sceneManager, callbacks = {}, assetManager = null) {
    this.container = container;
    this.sceneManager = sceneManager;
    this.callbacks = callbacks;
    this.assetManager = assetManager;

    this.panelHeader = document.createElement('div');
    this.panelHeader.className = 'panel-header';
    this.panelHeader.textContent = 'Hierarchy';
    this.container.appendChild(this.panelHeader);

    this.content = document.createElement('div');
    this.content.className = 'panel-content';
    this.container.appendChild(this.content);

    this._contextMenu = this._createContextMenu();

    this.sceneManager.on('sceneChanged', () => this.refresh());
    this.sceneManager.on('objectSelected', () => this.refresh());

    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const item = e.target.closest('.hierarchy-item');
      const targetId = item ? item._objectId : null;
      if (targetId) {
        this.sceneManager.selectObject(targetId);
      }
      this._showContextMenu(e.clientX, e.clientY, targetId);
    });

    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.context-menu')) {
        this._hideContextMenu();
      }
    });

    window.addEventListener('blur', () => this._hideContextMenu());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._hideContextMenu();
      }
    });
  }
  //#endregion

  //#region [Public Methods]
  refresh() {
    this.content.innerHTML = '';
    const roots = this.sceneManager.getRootObjects();

    if (roots.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'no-selection';
      empty.textContent = 'No objects in scene';
      this.content.appendChild(empty);
      return;
    }

    for (const root of roots) {
      this._renderItem(root, 0);
    }
  }
  //#endregion

  //#region [Private Methods]
  _createContextMenu() {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    document.body.appendChild(menu);
    return menu;
  }

  _showContextMenu(x, y, targetId) {
    this._contextTargetId = targetId;
    this._contextMenu.innerHTML = '';

    const targetObj = targetId ? this.sceneManager.getObject(targetId) : null;

    if (targetObj) {
      const title = document.createElement('div');
      title.className = 'context-menu-title';
      title.textContent = targetObj.userData.name || targetObj.name || 'GameObject';
      this._contextMenu.appendChild(title);

      this._addMenuItem('Create Empty', () => this._handleCreateEmpty(null));
      this._addMenuItem('Create Empty Child', () => this._handleCreateEmpty(targetId));
      this._addSubmenu3D(targetId);

      this._addSeparator();

      this._addMenuItem('Rename', () => this._handleRename(targetId), 'F2');
      this._addMenuItem('Duplicate', () => this._handleDuplicate(targetId), 'Ctrl+D');
      this._addMenuItem('Delete', () => this._handleDelete(targetId), 'Del');
      this._addMenuItem('Focus Camera', () => this._handleFocus(targetId), 'F');

      this._addSeparator();

      const isActive = this.sceneManager.isActiveInHierarchy(targetId);
      this._addMenuItem(isActive ? 'Disable (Hide)' : 'Enable (Show)', () => this._handleToggleActive(targetId));

      if (targetObj.userData.parentId) {
        this._addMenuItem('Unparent', () => this._handleUnparent(targetId));
      }

      if (targetObj.userData?.type === 'imported_mesh' && targetObj.children.length > 0) {
        this._addMenuItem('Separate Sub-Objects', () => {
          if (this.assetManager) {
            this.assetManager.setupSeparatedObjects(targetObj, targetObj.userData.meshAssetId);
            targetObj.children.forEach(c => {
              if (c.userData?.id) {
                this.sceneManager.addObject(c);
              }
            });
            this.sceneManager._emit('sceneChanged');
            this.refresh();
          }
        });
      }
    } else {
      this._addMenuItem('Create Empty', () => this._handleCreateEmpty(null));
      this._addSubmenu3D(null);

      this._addSeparator();

      this._addMenuItem('Deselect All', () => this.sceneManager.selectObject(null));
    }

    this._contextMenu.style.display = 'block';
    const rect = this._contextMenu.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;

    this._contextMenu.style.left = `${Math.max(8, Math.min(x, maxX))}px`;
    this._contextMenu.style.top = `${Math.max(8, Math.min(y, maxY))}px`;
  }

  _hideContextMenu() {
    if (this._contextMenu) {
      this._contextMenu.style.display = 'none';
    }
  }

  _addMenuItem(label, action, shortcut = '') {
    const btn = document.createElement('button');
    btn.className = 'context-menu-item';
    btn.innerHTML = `<span>${label}</span>${shortcut ? `<span class="shortcut">${shortcut}</span>` : ''}`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._hideContextMenu();
      action();
    });
    this._contextMenu.appendChild(btn);
  }

  _addSubmenu3D(parentId) {
    const wrapper = document.createElement('div');
    wrapper.className = 'context-menu-submenu';

    const trigger = document.createElement('button');
    trigger.className = 'context-menu-item';
    trigger.innerHTML = `<span>3D Object</span><span class="shortcut">▶</span>`;
    wrapper.appendChild(trigger);

    const subContent = document.createElement('div');
    subContent.className = 'context-submenu-content';

    const primitives = [
      { type: 'empty', label: 'Empty GameObject' },
      { type: 'cube', label: 'Cube' },
      { type: 'sphere', label: 'Sphere' },
      { type: 'plane', label: 'Plane' },
      { type: 'cylinder', label: 'Cylinder' },
      { type: 'player_controller', label: 'Player Controller' },
      { type: 'camera', label: 'Camera' }
    ];

    primitives.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'context-menu-item';
      btn.innerHTML = `<span>${p.label}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._hideContextMenu();
        this._handleCreatePrimitive(p.type, parentId);
      });
      subContent.appendChild(btn);
    });

    wrapper.appendChild(subContent);
    this._contextMenu.appendChild(wrapper);
  }

  _addSeparator() {
    const sep = document.createElement('div');
    sep.className = 'context-menu-separator';
    this._contextMenu.appendChild(sep);
  }

  _handleCreatePrimitive(type, parentId = null) {
    const obj = Primitives.createFromType(type);
    if (parentId) {
      const parent = this.sceneManager.getObject(parentId);
      if (parent) {
        const worldPos = new THREE.Vector3();
        parent.getWorldPosition(worldPos);
        obj.position.copy(worldPos);
      }
    } else {
      obj.position.set(0, (type === 'player_controller' || type === 'empty') ? 0 : 0.5, 0);
    }

    this.sceneManager.addObject(obj);
    if (parentId) {
      this.sceneManager.setParent(obj.userData.id, parentId);
    }
    this.sceneManager.selectObject(obj.userData.id);
  }

  _handleCreateEmpty(parentId = null) {
    const count = this.sceneManager.getAllObjects().filter(o => (o.userData?.name || '').startsWith('GameObject')).length + 1;
    const name = `GameObject_${String(count).padStart(3, '0')}`;
    const group = Primitives.createEmpty(name);

    if (parentId) {
      const parent = this.sceneManager.getObject(parentId);
      if (parent) {
        const worldPos = new THREE.Vector3();
        parent.getWorldPosition(worldPos);
        group.position.copy(worldPos);
      }
    } else {
      group.position.set(0, 0, 0);
    }

    this.sceneManager.addObject(group);
    if (parentId) {
      this.sceneManager.setParent(group.userData.id, parentId);
    }
    this.sceneManager.selectObject(group.userData.id);
  }

  _handleRename(id) {
    const obj = this.sceneManager.getObject(id);
    if (!obj) return;
    const currentName = obj.userData.name || obj.name || 'GameObject';
    const newName = prompt('Rename Object:', currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      obj.userData.name = newName.trim();
      obj.name = newName.trim();
      this.sceneManager._emit('sceneChanged');
    }
  }

  _handleDuplicate(id) {
    const selected = this.sceneManager.getObject(id);
    if (!selected) return;
    const clone = selected.clone(true);
    clone.userData = JSON.parse(JSON.stringify(selected.userData));
    clone.userData.id = crypto.randomUUID();
    clone.userData.name = (selected.userData.name || 'Object') + '_copy';
    clone.name = clone.userData.name;
    clone.position.x += 1;
    this.sceneManager.addObject(clone);
    if (selected.userData.parentId) {
      this.sceneManager.setParent(clone.userData.id, selected.userData.parentId);
    }
    this.sceneManager.selectObject(clone.userData.id);
  }

  _handleDelete(id) {
    this.sceneManager.removeObject(id);
  }

  _handleFocus(id) {
    const obj = this.sceneManager.getObject(id);
    if (obj && this.callbacks.onFocusObject) {
      this.callbacks.onFocusObject(obj);
    }
  }

  _handleToggleActive(id) {
    const next = !this.sceneManager.isActiveInHierarchy(id);
    this.sceneManager.setActive(id, next);
  }

  _handleUnparent(id) {
    this.sceneManager.setParent(id, null);
  }

  _renderItem(obj, depth) {
    const selected = this.sceneManager.selectedObject;
    const children = this.sceneManager.getChildren(obj.userData.id);
    const hasChildren = children.length > 0;
    const isCollapsed = this._collapsedNodes.has(obj.userData.id);
    const isActive = this.sceneManager.isActiveInHierarchy(obj.userData.id);

    const item = document.createElement('div');
    item.className = 'hierarchy-item';
    item._objectId = obj.userData.id;
    item.style.paddingLeft = `${depth * 14 + 6}px`;
    if (!isActive) item.classList.add('inactive');
    if (selected && selected.userData.id === obj.userData.id) {
      item.classList.add('selected');
    }

    if (hasChildren) {
      const expander = document.createElement('span');
      expander.className = 'hierarchy-expander';
      expander.style.width = '12px';
      expander.style.display = 'inline-block';
      expander.style.cursor = 'pointer';
      expander.style.fontSize = '9px';
      expander.textContent = isCollapsed ? '▶' : '▼';
      expander.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._collapsedNodes.has(obj.userData.id)) {
          this._collapsedNodes.delete(obj.userData.id);
        } else {
          this._collapsedNodes.add(obj.userData.id);
        }
        this.refresh();
      });
      item.appendChild(expander);
    } else {
      const spacer = document.createElement('span');
      spacer.style.width = '12px';
      spacer.style.display = 'inline-block';
      item.appendChild(spacer);
    }

    const icon = document.createElement('span');
    icon.className = 'icon';
    if (obj.userData?.type === 'player_controller') {
      icon.innerHTML = PLAYER_ICON_SVG;
    } else if (obj.userData?.type === 'camera' || obj.isCamera) {
      icon.innerHTML = CAMERA_ICON_SVG;
    } else {
      icon.innerHTML = CUBE_ICON_SVG;
    }
    item.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = obj.userData.name || obj.name || 'GameObject';
    item.appendChild(label);

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sceneManager.selectObject(obj.userData.id);
    });

    item.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this._handleFocus(obj.userData.id);
    });

    this.content.appendChild(item);

    if (hasChildren && !isCollapsed) {
      for (const child of children) {
        this._renderItem(child, depth + 1);
      }
    }
  }
  //#endregion
}

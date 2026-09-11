const CUBE_ICON_SVG = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0;"><path d="M8 1.5 L14.5 5.25 L14.5 12.75 L8 16.5 L1.5 12.75 L1.5 5.25 Z"/><path d="M8 1.5 L8 16.5"/><path d="M1.5 5.25 L8 9 L14.5 5.25"/></svg>';

export class Hierarchy {
  constructor(container, sceneManager) {
    this.container = container;
    this.sceneManager = sceneManager;
    this._collapsedNodes = new Set();

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

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.context-menu')) {
        this._contextMenu.style.display = 'none';
      }
    });
  }

  _createContextMenu() {
    const menu = document.createElement('div');
    menu.className = 'context-menu';

    const items = [
      { label: 'Toggle Active', action: 'toggleActive' },
      { label: 'Unparent', action: 'unparent' },
      { label: 'Duplicate', action: 'duplicate' },
      { label: 'Delete', action: 'delete' },
    ];

    items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'context-menu-item';
      btn.textContent = item.label;
      btn.addEventListener('click', () => {
        this._handleContextAction(item.action);
        menu.style.display = 'none';
      });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    return menu;
  }

  _handleContextAction(action) {
    const selected = this.sceneManager.selectedObject;
    if (!selected) return;

    switch (action) {
      case 'toggleActive': {
        const next = !this.sceneManager.isActiveInHierarchy(selected.userData.id);
        this.sceneManager.setActive(selected.userData.id, next);
        break;
      }
      case 'unparent': {
        this.sceneManager.setParent(selected.userData.id, null);
        break;
      }
      case 'duplicate': {
        const clone = selected.clone(true);
        clone.userData = JSON.parse(JSON.stringify(selected.userData));
        clone.userData.id = crypto.randomUUID();
        clone.userData.name = (selected.userData.name || 'Object') + '_copy';
        clone.name = clone.userData.name;
        clone.position.x += 1;
        this.sceneManager.addObject(clone);
        this.sceneManager.selectObject(clone.userData.id);
        break;
      }
      case 'delete':
        this.sceneManager.removeObject(selected.userData.id);
        break;
    }
  }

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

  _renderItem(obj, depth) {
    const selected = this.sceneManager.selectedObject;
    const children = this.sceneManager.getChildren(obj.userData.id);
    const hasChildren = children.length > 0;
    const isCollapsed = this._collapsedNodes.has(obj.userData.id);
    const isActive = this.sceneManager.isActiveInHierarchy(obj.userData.id);

    const item = document.createElement('div');
    item.className = 'hierarchy-item';
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
    icon.innerHTML = CUBE_ICON_SVG;
    item.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = obj.userData.name || obj.name || 'GameObject';
    item.appendChild(label);

    item.addEventListener('click', () => {
      this.sceneManager.selectObject(obj.userData.id);
    });

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.sceneManager.selectObject(obj.userData.id);
      this._contextMenu.style.left = e.clientX + 'px';
      this._contextMenu.style.top = e.clientY + 'px';
      this._contextMenu.style.display = 'block';
    });

    this.content.appendChild(item);

    if (hasChildren && !isCollapsed) {
      for (const child of children) {
        this._renderItem(child, depth + 1);
      }
    }
  }
}

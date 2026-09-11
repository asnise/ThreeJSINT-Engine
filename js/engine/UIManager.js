export class UIManager {
  constructor(assetManager) {
    this.assetManager = assetManager;

    this.baseUI = {
      crosshair: {
        active: true,
        anchor: 'middle-center',
        offsetX: 0,
        offsetY: 0,
        size: 16,
        thickness: 2,
        color: '#ffffff'
      },
      prompt: {
        active: true,
        anchor: 'bottom-center',
        offsetX: 0,
        offsetY: -80,
        fontSize: 14,
        bg: 'rgba(0,0,0,0.7)',
        color: '#cccccc'
      },
      joystick: {
        active: true,
        anchor: 'bottom-left',
        offsetX: 40,
        offsetY: -40,
        baseSize: 100,
        thumbSize: 40
      }
    };

    this.elements = new Map();
    this.container = null;
    this._domNodes = new Map();
    this.onUIChanged = null;
    this.onBaseUIChanged = null;
  }

  setBaseUIActive(key, active) {
    if (this.baseUI[key]) {
      this.baseUI[key].active = Boolean(active);
      if (this.onBaseUIChanged) this.onBaseUIChanged(key, this.baseUI[key]);
      if (this.onUIChanged) this.onUIChanged();
    }
  }

  updateBaseUI(key, props) {
    if (this.baseUI[key]) {
      Object.assign(this.baseUI[key], props);
      if (this.onBaseUIChanged) this.onBaseUIChanged(key, this.baseUI[key]);
      if (this.onUIChanged) this.onUIChanged();
    }
  }

  createDefaultElement(type = 'label') {
    const id = crypto.randomUUID();
    const count = this.elements.size + 1;
    if (type === 'label') {
      return {
        id,
        name: `Label_${count}`,
        type: 'label',
        visible: true,
        anchor: 'top-left',
        offsetX: 20,
        offsetY: 20,
        width: 160,
        height: 36,
        text: 'Hello World',
        fontSize: 14,
        textColor: '#ffffff',
        bgColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 4,
        textAlign: 'center',
        padding: 6
      };
    } else {
      return {
        id,
        name: `Image_${count}`,
        type: 'image',
        visible: true,
        anchor: 'top-right',
        offsetX: 20,
        offsetY: 20,
        width: 64,
        height: 64,
        textureAssetId: null,
        imageSrc: '',
        opacity: 1.0,
        borderRadius: 4,
        bgColor: 'transparent',
        fit: 'contain'
      };
    }
  }

  addElement(type = 'label', customProps = {}) {
    const el = { ...this.createDefaultElement(type), ...customProps };
    this.elements.set(el.id, el);
    this._refreshDOM();
    if (this.onUIChanged) this.onUIChanged();
    return el;
  }

  removeElement(id) {
    const node = this._domNodes.get(id);
    if (node && node.parentElement) {
      node.parentElement.removeChild(node);
    }
    this._domNodes.delete(id);
    this.elements.delete(id);
    if (this.onUIChanged) this.onUIChanged();
  }

  getElement(id) {
    return this.elements.get(id) || null;
  }

  getAllElements() {
    return Array.from(this.elements.values());
  }

  updateElement(id, props) {
    const el = this.elements.get(id);
    if (!el) return;
    Object.assign(el, props);
    this._updateNodeStyle(el);
    if (this.onUIChanged) this.onUIChanged();
  }

  setElementText(id, text) {
    const el = this.elements.get(id);
    if (!el || el.type !== 'label') return;
    el.text = String(text);
    const node = this._domNodes.get(id);
    if (node) node.textContent = el.text;
  }

  setElementVisible(id, visible) {
    if (this.baseUI[id]) {
      this.setBaseUIActive(id, visible);
      return;
    }
    const el = this.elements.get(id);
    if (!el) return;
    el.visible = Boolean(visible);
    const node = this._domNodes.get(id);
    if (node) node.style.display = el.visible ? 'flex' : 'none';
  }

  mount(container) {
    this.container = container;
    this._refreshDOM();
  }

  _refreshDOM() {
    if (!this.container) return;

    for (const [id, node] of this._domNodes) {
      if (!this.elements.has(id)) {
        node.remove();
        this._domNodes.delete(id);
      }
    }

    for (const el of this.elements.values()) {
      let node = this._domNodes.get(el.id);
      if (!node) {
        node = document.createElement(el.type === 'image' ? 'div' : 'div');
        node.className = `custom-ui-element custom-ui-${el.type}`;
        node.dataset.uiId = el.id;
        this.container.appendChild(node);
        this._domNodes.set(el.id, node);
      }
      this._updateNodeStyle(el);
    }
  }

  _updateNodeStyle(el) {
    const node = this._domNodes.get(el.id);
    if (!node) return;

    node.style.position = 'absolute';
    node.style.display = el.visible ? 'flex' : 'none';
    node.style.alignItems = 'center';
    node.style.justifyContent = el.textAlign === 'left' ? 'flex-start' : (el.textAlign === 'right' ? 'flex-end' : 'center');
    node.style.width = typeof el.width === 'number' ? `${el.width}px` : el.width;
    node.style.height = typeof el.height === 'number' ? `${el.height}px` : el.height;
    node.style.borderRadius = `${el.borderRadius || 0}px`;
    node.style.backgroundColor = el.bgColor || 'transparent';
    node.style.pointerEvents = 'none';
    node.style.boxSizing = 'border-box';
    node.style.zIndex = '50';

    node.style.top = '';
    node.style.bottom = '';
    node.style.left = '';
    node.style.right = '';
    node.style.transform = '';

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

    if (el.type === 'label') {
      node.textContent = el.text || '';
      node.style.color = el.textColor || '#ffffff';
      node.style.fontSize = `${el.fontSize || 14}px`;
      node.style.padding = `${el.padding || 4}px`;
      node.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      node.style.fontWeight = '500';
    } else if (el.type === 'image') {
      let src = el.imageSrc || '';
      if (el.textureAssetId && this.assetManager) {
        const asset = this.assetManager.getTexture(el.textureAssetId);
        if (asset && asset.preview) src = asset.preview;
      }
      node.innerHTML = '';
      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = el.fit || 'contain';
        img.style.opacity = String(el.opacity ?? 1);
        node.appendChild(img);
      }
    }
  }

  serialize() {
    return {
      baseUI: JSON.parse(JSON.stringify(this.baseUI)),
      elements: Array.from(this.elements.values()).map(el => JSON.parse(JSON.stringify(el)))
    };
  }

  deserialize(data) {
    if (!data) return;
    if (data.baseUI) {
      this.baseUI = { ...this.baseUI, ...data.baseUI };
    }
    this.elements.clear();
    if (Array.isArray(data.elements)) {
      for (const el of data.elements) {
        this.elements.set(el.id, el);
      }
    }
    this._refreshDOM();
    if (this.onUIChanged) this.onUIChanged();
  }
}

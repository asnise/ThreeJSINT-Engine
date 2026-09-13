const promptEl = document.createElement('div');
promptEl.className = 'interact-prompt';
document.body.appendChild(promptEl);

const crosshairEl = document.createElement('div');
crosshairEl.className = 'crosshair';
document.body.appendChild(crosshairEl);

const jArea = document.createElement('div');
jArea.className = 'mobile-joystick-area';
const jBase = document.createElement('div');
jBase.className = 'mobile-joystick-base';
const jThumb = document.createElement('div');
jThumb.className = 'mobile-joystick-thumb';
jBase.appendChild(jThumb);
jArea.appendChild(jBase);
document.body.appendChild(jArea);

const lArea = document.createElement('div');
lArea.className = 'mobile-look-area';
document.body.appendChild(lArea);

const mBtn = document.createElement('button');
mBtn.className = 'mobile-interact-btn';
mBtn.textContent = 'E';
mBtn.style.display = 'none';
document.body.appendChild(mBtn);

const customUIElements = new Map();

function buildCustomUI() {
  const layer = document.getElementById('customUILayer');
  if (!layer || !UI_DATA.elements) return;

  for (const el of UI_DATA.elements) {
    const node = document.createElement('div');
    node.id = 'custom-ui-' + el.id;
    node.className = 'custom-ui-element custom-ui-' + el.type;

    node.style.position = 'absolute';
    node.style.display = el.visible !== false ? 'flex' : 'none';
    node.style.alignItems = 'center';
    node.style.justifyContent = el.textAlign === 'left' ? 'flex-start' : (el.textAlign === 'right' ? 'flex-end' : 'center');
    if (el.width !== undefined) node.style.width = typeof el.width === 'number' ? el.width + 'px' : el.width;
    if (el.height !== undefined) node.style.height = typeof el.height === 'number' ? el.height + 'px' : el.height;
    if (el.borderRadius) node.style.borderRadius = el.borderRadius + 'px';
    if (el.bgColor) node.style.backgroundColor = el.bgColor;
    node.style.pointerEvents = el.type === 'button' ? 'auto' : 'none';
    node.style.boxSizing = 'border-box';
    node.style.zIndex = '50';
    node.style.opacity = el.opacity !== undefined ? el.opacity : 1;
    if (el.borderWidth) {
      node.style.border = el.borderWidth + 'px solid ' + (el.borderColor || '#ffffff');
    }

    applyAnchor(node, el.anchor || 'top-left', el.offsetX || 0, el.offsetY || 0);

    if (el.type === 'label') {
      node.textContent = el.text || '';
      node.style.color = el.textColor || el.color || '#ffffff';
      node.style.fontSize = (el.fontSize || 14) + 'px';
      node.style.fontWeight = el.fontWeight || '500';
      node.style.padding = (el.padding || 4) + 'px';
      node.style.fontFamily = el.fontFamily || 'system-ui, -apple-system, sans-serif';
    } else if (el.type === 'button') {
      node.textContent = el.text || '';
      node.style.color = el.textColor || '#ffffff';
      node.style.fontSize = (el.fontSize || 14) + 'px';
      node.style.fontWeight = el.fontWeight || '600';
      node.style.padding = (el.padding || 8) + 'px';
      node.style.fontFamily = el.fontFamily || 'system-ui, -apple-system, sans-serif';
      node.style.cursor = 'pointer';
      node.addEventListener('click', () => {
        nodeRuntime.triggerEvent('OnButtonClick', el.id);
      });
    } else if (el.type === 'progressbar') {
      node.innerHTML = '';
      const val = Math.max(0, Math.min(el.maxValue || 100, el.value || 0));
      const pct = (val / (el.maxValue || 100)) * 100;
      const fill = document.createElement('div');
      fill.style.width = pct + '%';
      fill.style.height = '100%';
      fill.style.background = el.fillColor || '#ef4444';
      fill.style.borderRadius = Math.max(0, (el.borderRadius || 4) - 1) + 'px';
      fill.style.transition = 'width 0.2s ease';
      node.appendChild(fill);
      if (el.showText) {
        const textSpan = document.createElement('span');
        textSpan.style.position = 'absolute';
        textSpan.style.inset = '0';
        textSpan.style.display = 'flex';
        textSpan.style.alignItems = 'center';
        textSpan.style.justifyContent = 'center';
        textSpan.style.fontSize = (el.fontSize || 11) + 'px';
        textSpan.style.color = el.textColor || '#ffffff';
        textSpan.style.fontWeight = 'bold';
        textSpan.textContent = el.text || Math.round(pct) + '%';
        node.appendChild(textSpan);
      }
    } else if (el.type === 'image') {
      let src = el.imageSrc || el.src || '';
      const assetId = el.textureAssetId || el.assetId;
      if (assetId && ASSETS_DATA.textures?.[assetId]?.data) {
        src = ASSETS_DATA.textures[assetId].data;
      }
      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.pointerEvents = 'none';
        node.appendChild(img);
      }
    }

    layer.appendChild(node);
    customUIElements.set(el.id, node);
  }
}

function applyBaseUI() {
  const base = UI_DATA.baseUI;
  if (!base) return;

  if (base.crosshair) {
    if (base.crosshair.active === false) crosshairEl.style.display = 'none';
    if (base.crosshair.size) {
      crosshairEl.style.width = base.crosshair.size + 'px';
      crosshairEl.style.height = base.crosshair.size + 'px';
    }
  }

  if (base.prompt) {
    if (base.prompt.active === false) promptEl.style.display = 'none';
    if (base.prompt.fontSize) promptEl.style.fontSize = base.prompt.fontSize + 'px';
    if (base.prompt.color) promptEl.style.color = base.prompt.color;
    if (base.prompt.bg) promptEl.style.background = base.prompt.bg;
  }

  if (base.joystick) {
    if (base.joystick.active === false) jArea.style.display = 'none';
    if (base.joystick.baseSize) {
      jBase.style.width = base.joystick.baseSize + 'px';
      jBase.style.height = base.joystick.baseSize + 'px';
    }
    if (base.joystick.thumbSize) {
      jThumb.style.width = base.joystick.thumbSize + 'px';
      jThumb.style.height = base.joystick.thumbSize + 'px';
    }
  }
}

function applyAnchor(el, anchor, ox, oy) {
  el.style.top = ''; el.style.bottom = ''; el.style.left = ''; el.style.right = '';
  let trans = '';
  switch (anchor) {
    case 'top-left': el.style.top = oy + 'px'; el.style.left = ox + 'px'; break;
    case 'top-center': el.style.top = oy + 'px'; el.style.left = '50%'; trans = 'translateX(calc(-50% + ' + ox + 'px))'; break;
    case 'top-right': el.style.top = oy + 'px'; el.style.right = (-ox) + 'px'; break;
    case 'middle-left': el.style.top = '50%'; el.style.left = ox + 'px'; trans = 'translateY(calc(-50% + ' + oy + 'px))'; break;
    case 'middle-center': el.style.top = '50%'; el.style.left = '50%'; trans = 'translate(calc(-50% + ' + ox + 'px), calc(-50% + ' + oy + 'px))'; break;
    case 'middle-right': el.style.top = '50%'; el.style.right = (-ox) + 'px'; trans = 'translateY(calc(-50% + ' + oy + 'px))'; break;
    case 'bottom-left': el.style.bottom = (-oy) + 'px'; el.style.left = ox + 'px'; break;
    case 'bottom-center': el.style.bottom = (-oy) + 'px'; el.style.left = '50%'; trans = 'translateX(calc(-50% + ' + ox + 'px))'; break;
    case 'bottom-right': el.style.bottom = (-oy) + 'px'; el.style.right = (-ox) + 'px'; break;
  }
  el.style.transform = trans;
}

const sceneManagerAdapter = {
  getObject: (id) => {
    if (!id) return null;
    return allObjects.find(o => o.userData?.id === id || o.name === id) || null;
  },
  getAllObjects: () => allObjects,
  getRootObjects: () => allObjects.filter(o => !o.parent || o.parent === scene),
  getChildren: (parentId) => {
    return allObjects.filter(o => o.userData?.parentId === parentId || (o.parent && o.parent.userData?.id === parentId));
  },
  setActive: (id, active) => {
    const obj = allObjects.find(o => o.userData?.id === id || o.name === id);
    if (obj) {
      obj.userData.active = active;
      obj.visible = active;
      updateHierarchyVisibility(obj);
    }
  },
  isActiveInHierarchy: (id) => {
    const obj = typeof id === 'string' ? allObjects.find(o => o.userData?.id === id) : id;
    return obj ? isActiveInHierarchy(obj) : true;
  }
};

const uiManagerAdapter = {
  setElementText: (id, text) => {
    const el = customUIElements.get(id);
    if (el) el.textContent = text;
  },
  setElementVisible: (id, visible) => {
    let targetEl = null;
    if (id === 'base:crosshair') targetEl = crosshairEl;
    else if (id === 'base:joystick') targetEl = jArea;
    else if (id === 'base:prompt') targetEl = promptEl;
    else targetEl = customUIElements.get(id);
    if (targetEl) targetEl.style.display = visible ? '' : 'none';
  },
  isElementVisible: (id) => {
    let targetEl = null;
    if (id === 'base:crosshair') targetEl = crosshairEl;
    else if (id === 'base:joystick') targetEl = jArea;
    else if (id === 'base:prompt') targetEl = promptEl;
    else targetEl = customUIElements.get(id);
    return targetEl ? targetEl.style.display !== 'none' : false;
  }
};

const itemInspectorAdapter = {
  inspect: (target) => {
    if (target) startInspect(target);
  }
};

export class NodeGraphEditor {
  constructor(container, nodeRuntime, sceneManager, uiManager) {
    this.container = container;
    this.runtime = nodeRuntime;
    this.sceneManager = sceneManager;
    this.uiManager = uiManager;

    this.isOpen = false;
    this.currentScope = 'global';
    this._pan = { x: 50, y: 50 };
    this._zoom = 1.0;
    this._isPanning = false;
    this._panStart = { x: 0, y: 0 };

    this._activeWire = null;
    this._selectedNodeId = null;

    this._build();
  }

  _build() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'nodegraph-modal';
    this.overlay.style.display = 'none';

    this.header = document.createElement('div');
    this.header.className = 'nodegraph-header';
    this.header.innerHTML = `
      <div class="nodegraph-title">
        <span>Visual Logic & Condition Node Graph</span>
        <span class="nodegraph-subtitle">Connect Events -> Conditions -> Actions (No-Code)</span>
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

    const presetBtn = document.createElement('button');
    presetBtn.className = 'toolbar-btn';
    presetBtn.textContent = 'Preset: Open Door / Toggle';
    presetBtn.addEventListener('click', () => this._createDoorPreset());
    controls.appendChild(presetBtn);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'toolbar-btn';
    clearBtn.textContent = 'Clear All';
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
    closeBtn.className = 'ui-editor-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.close());
    controls.appendChild(closeBtn);

    this.header.appendChild(controls);
    this.overlay.appendChild(this.header);

    // Layer / Scope Bar
    this.layerBar = document.createElement('div');
    this.layerBar.className = 'nodegraph-layer-bar';

    const layerLabel = document.createElement('span');
    layerLabel.textContent = 'Graph Layer:';
    layerLabel.style.color = 'var(--text-muted)';
    layerLabel.style.fontSize = '11px';
    layerLabel.style.fontWeight = 'bold';
    this.layerBar.appendChild(layerLabel);

    this.globalTabBtn = document.createElement('button');
    this.globalTabBtn.className = 'nodegraph-layer-btn active';
    this.globalTabBtn.textContent = 'Global / System';
    this.globalTabBtn.addEventListener('click', () => this.switchScope('global'));
    this.layerBar.appendChild(this.globalTabBtn);

    this.playerTabBtn = document.createElement('button');
    this.playerTabBtn.className = 'nodegraph-layer-btn';
    this.playerTabBtn.textContent = 'Player Controller';
    this.playerTabBtn.addEventListener('click', () => this.switchScope('player'));
    this.layerBar.appendChild(this.playerTabBtn);

    const objSep = document.createElement('div');
    objSep.style.width = '1px';
    objSep.style.height = '16px';
    objSep.style.background = 'var(--border)';
    this.layerBar.appendChild(objSep);

    const objLabel = document.createElement('span');
    objLabel.textContent = 'GameObject Component:';
    objLabel.style.color = 'var(--text-muted)';
    objLabel.style.fontSize = '11px';
    this.layerBar.appendChild(objLabel);

    this.objSelect = document.createElement('select');
    this.objSelect.className = 'inspector-select';
    this.objSelect.style.width = '180px';
    this.objSelect.style.fontSize = '11px';
    this.objSelect.addEventListener('change', () => {
      if (this.objSelect.value) {
        this.switchScope('object:' + this.objSelect.value);
      }
    });
    this.layerBar.appendChild(this.objSelect);

    this.overlay.appendChild(this.layerBar);

    // Canvas Container
    this.canvasWrap = document.createElement('div');
    this.canvasWrap.className = 'nodegraph-canvas-wrap';

    // SVG layer for wires
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'nodegraph-svg');
    this.canvasWrap.appendChild(this.svg);

    // Nodes container
    this.nodesLayer = document.createElement('div');
    this.nodesLayer.className = 'nodegraph-nodes-layer';
    this.canvasWrap.appendChild(this.nodesLayer);

    this.overlay.appendChild(this.canvasWrap);
    this.container.appendChild(this.overlay);

    this._setupPanAndZoom();
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    this.overlay.style.display = 'flex';
    this._refreshLayerBar();
    this._render();
  }

  close() {
    this.isOpen = false;
    this.overlay.style.display = 'none';
  }

  switchScope(scope) {
    this.currentScope = scope;
    this._refreshLayerBar();
    this._render();
  }

  openForObject(objectId) {
    this.currentScope = 'object:' + objectId;
    this.open();
  }

  _refreshLayerBar() {
    this.globalTabBtn.classList.toggle('active', this.currentScope === 'global');
    this.playerTabBtn.classList.toggle('active', this.currentScope === 'player');

    this.objSelect.innerHTML = '';
    const defOpt = document.createElement('option');
    defOpt.value = '';
    defOpt.textContent = '-- Select GameObject Component --';
    this.objSelect.appendChild(defOpt);

    const objs = this.sceneManager.getAllObjects();
    let found = false;
    for (const o of objs) {
      const opt = document.createElement('option');
      opt.value = o.userData.id;
      opt.textContent = o.userData.name || o.name || 'GameObject';
      if (this.currentScope === 'object:' + o.userData.id) {
        opt.selected = true;
        found = true;
      }
      this.objSelect.appendChild(opt);
    }
    if (this.currentScope.startsWith('object:') && found) {
      this.objSelect.style.borderColor = 'var(--accent)';
    } else {
      this.objSelect.style.borderColor = '';
    }
  }

  _setupPanAndZoom() {
    this.canvasWrap.addEventListener('mousedown', (e) => {
      if (e.target === this.canvasWrap || e.target === this.svg || e.target.classList.contains('nodegraph-nodes-layer')) {
        this._isPanning = true;
        this._panStart = { x: e.clientX - this._pan.x, y: e.clientY - this._pan.y };
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this._isPanning) {
        this._pan.x = e.clientX - this._panStart.x;
        this._pan.y = e.clientY - this._panStart.y;
        this._updateTransform();
      }
      if (this._activeWire) {
        this._updateActiveWire(e);
      }
    });

    window.addEventListener('mouseup', () => {
      this._isPanning = false;
      if (this._activeWire) {
        this._cancelActiveWire();
      }
    });
  }

  _updateTransform() {
    this.nodesLayer.style.transform = `translate(${this._pan.x}px, ${this._pan.y}px)`;
    this._renderWires();
  }

  _showAddNodeMenu(btn) {
    const existing = document.querySelector('.nodegraph-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'nodegraph-context-menu';

    const categories = [
      {
        cat: 'Events',
        items: [
          { type: 'OnInteract', label: 'OnInteract (Press E)' },
          { type: 'OnTriggerEnter', label: 'OnTriggerEnter (Walk In)' },
          { type: 'OnTriggerExit', label: 'OnTriggerExit (Walk Out)' },
          { type: 'OnVariableChanged', label: 'OnVariableChanged (Var Updated)' },
          { type: 'OnStart', label: '▶ OnStart (Play Begin)' },
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
          { type: 'RotateObject', label: 'Rotate Object (Open Door)' },
          { type: 'SetActive', label: 'Set GameObject Active (Show/Hide)' },
          { type: 'MoveObject', label: 'Move Object (Slide/Elevator)' },
          { type: 'SetVariable', label: 'Set Variable (hasKey = true)' },
          { type: 'SetUIActive', label: 'Set UI Active (Show/Hide UI)' },
          { type: 'SetUIText', label: 'Set UI Text (Template {var})' },
          { type: 'ChangeColor', label: 'Change Color' },
          { type: 'InspectItem', label: 'Inspect Item' },
        ]
      }
    ];

    categories.forEach(group => {
      const header = document.createElement('div');
      header.className = 'context-menu-header';
      header.textContent = group.cat;
      menu.appendChild(header);

      group.items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'context-menu-item';
        row.textContent = item.label;
        row.addEventListener('click', () => {
          this._createNode(item.type, -this._pan.x + 300, -this._pan.y + 200);
          menu.remove();
        });
        menu.appendChild(row);
      });
    });

    const rect = btn.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.left}px`;
    document.body.appendChild(menu);

    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
  }

  _createNode(type, x, y) {
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

    if (type.startsWith('On')) {
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
        title = '▶ On Start';
      }
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
    this._render();
    return node;
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
    const card = document.createElement('div');
    card.className = `nodegraph-card cat-${node.category}`;
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;
    card.dataset.nodeId = node.id;

    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `<span>${node.title}</span>`;

    const delBtn = document.createElement('button');
    delBtn.className = 'card-del-btn';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.runtime.connections = this.runtime.connections.filter(c => c.fromNode !== node.id && c.toNode !== node.id);
      this.runtime.nodes.delete(node.id);
      this._render();
    });
    header.appendChild(delBtn);
    card.appendChild(header);

    // Draggable card
    header.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      let startX = e.clientX, startY = e.clientY;
      const initX = node.x, initY = node.y;

      const onMove = (me) => {
        node.x = initX + (me.clientX - startX);
        node.y = initY + (me.clientY - startY);
        card.style.left = `${node.x}px`;
        card.style.top = `${node.y}px`;
        this._renderWires();
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    const body = document.createElement('div');
    body.className = 'card-body';

    // Inputs & Outputs ports row
    const portsRow = document.createElement('div');
    portsRow.className = 'card-ports';

    const inCol = document.createElement('div');
    inCol.className = 'ports-col-in';
    node.inputs.forEach(p => {
      const portEl = document.createElement('div');
      portEl.className = 'port-item in';
      portEl.dataset.port = p.id;
      portEl.innerHTML = `<span class="port-bullet" data-port="${p.id}"></span><span class="port-label">${p.label}</span>`;
      inCol.appendChild(portEl);
    });
    portsRow.appendChild(inCol);

    const outCol = document.createElement('div');
    outCol.className = 'ports-col-out';
    node.outputs.forEach(p => {
      const portEl = document.createElement('div');
      portEl.className = 'port-item out';
      portEl.dataset.port = p.id;
      portEl.innerHTML = `<span class="port-label">${p.label}</span><span class="port-bullet" data-port="${p.id}"></span>`;

      const bullet = portEl.querySelector('.port-bullet');
      bullet.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this._startWire(node.id, p.id, bullet);
      });
      outCol.appendChild(portEl);
    });
    portsRow.appendChild(outCol);
    body.appendChild(portsRow);

    // Custom configuration parameters row
    const content = document.createElement('div');
    content.className = 'card-content';
    this._renderNodeFields(node, content);
    body.appendChild(content);

    card.appendChild(body);
    return card;
  }

  _renderNodeFields(node, container) {
    const allObjects = this.sceneManager.getAllObjects();

    const addObjSelect = (label, currentVal, onChange, includeAny = false) => {
      const row = document.createElement('div');
      row.className = 'node-field-row';
      row.innerHTML = `<span class="field-lbl">${label}</span>`;
      const select = document.createElement('select');
      select.className = 'node-select';

      if (includeAny) {
        const o = document.createElement('option');
        o.value = 'any';
        o.textContent = '-- Any Object --';
        select.appendChild(o);
      }

      allObjects.forEach(obj => {
        const o = document.createElement('option');
        o.value = obj.userData.id;
        o.textContent = obj.userData.name || obj.name;
        if (obj.userData.id === currentVal) o.selected = true;
        select.appendChild(o);
      });
      select.addEventListener('change', () => onChange(select.value));
      row.appendChild(select);
      container.appendChild(row);
    };

    switch (node.type) {
      case 'OnInteract':
        addObjSelect('Target', node.data.targetId, val => node.data.targetId = val, true);
        break;

      case 'OnTriggerEnter':
      case 'OnTriggerExit':
        addObjSelect('Trigger', node.data.targetId, val => node.data.targetId = val);
        break;

      case 'CheckCondition': {
        const r1 = document.createElement('div');
        r1.className = 'node-field-row';
        r1.innerHTML = `<span class="field-lbl">Variable</span><input class="node-input" type="text" value="${node.data.varName || ''}">`;
        r1.querySelector('input').addEventListener('input', e => node.data.varName = e.target.value);
        container.appendChild(r1);

        const r2 = document.createElement('div');
        r2.className = 'node-field-row';
        r2.innerHTML = `
          <span class="field-lbl">Operator</span>
          <select class="node-select">
            <option value="==">==</option>
            <option value="!=">!=</option>
            <option value=">">&gt;</option>
            <option value="<">&lt;</option>
            <option value=">=">&gt;=</option>
            <option value="<=">&lt;=</option>
          </select>
        `;
        const s = r2.querySelector('select');
        s.value = node.data.operator || '==';
        s.addEventListener('change', e => node.data.operator = e.target.value);
        container.appendChild(r2);

        const r3 = document.createElement('div');
        r3.className = 'node-field-row';
        r3.innerHTML = `<span class="field-lbl">Value</span><input class="node-input" type="text" value="${node.data.value || ''}">`;
        r3.querySelector('input').addEventListener('input', e => node.data.value = e.target.value);
        container.appendChild(r3);
        break;
      }

      case 'CounterGate': {
        const r = document.createElement('div');
        r.className = 'node-field-row';
        r.innerHTML = `<span class="field-lbl">Target Count</span><input class="node-input" type="number" min="1" value="${node.data.targetCount || 3}">`;
        r.querySelector('input').addEventListener('input', e => node.data.targetCount = Number(e.target.value) || 1);
        container.appendChild(r);
        break;
      }

      case 'Delay': {
        const r = document.createElement('div');
        r.className = 'node-field-row';
        r.innerHTML = `<span class="field-lbl">Seconds</span><input class="node-input" type="number" step="0.5" min="0.1" value="${node.data.seconds || 1}">`;
        r.querySelector('input').addEventListener('input', e => node.data.seconds = Number(e.target.value) || 1);
        container.appendChild(r);
        break;
      }

      case 'OnVariableChanged': {
        const r = document.createElement('div');
        r.className = 'node-field-row';
        r.innerHTML = `<span class="field-lbl">Variable</span><input class="node-input" type="text" value="${node.data.varName || 'any'}">`;
        r.querySelector('input').addEventListener('input', e => node.data.varName = e.target.value);
        container.appendChild(r);
        break;
      }

      case 'GetVariable': {
        const r = document.createElement('div');
        r.className = 'node-field-row';
        r.innerHTML = `<span class="field-lbl">Variable</span><input class="node-input" type="text" value="${node.data.varName || 'coins'}">`;
        r.querySelector('input').addEventListener('input', e => node.data.varName = e.target.value);
        container.appendChild(r);
        break;
      }

      case 'RotateObject': {
        addObjSelect('Target', node.data.targetId, val => node.data.targetId = val);
        const r = document.createElement('div');
        r.className = 'node-field-row';
        r.innerHTML = `
          <span class="field-lbl">Axis/Angle</span>
          <select class="node-select" style="width: 50px;">
            <option value="y">Y</option>
            <option value="x">X</option>
            <option value="z">Z</option>
          </select>
          <input class="node-input" type="number" style="width: 65px;" value="${node.data.angle || 90}">
        `;
        const ax = r.querySelector('select');
        ax.value = node.data.axis || 'y';
        ax.addEventListener('change', e => node.data.axis = e.target.value);
        const deg = r.querySelector('input');
        deg.addEventListener('input', e => node.data.angle = Number(e.target.value) || 0);
        container.appendChild(r);
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
        select.value = node.data.uiId || '';
        select.addEventListener('change', () => node.data.uiId = select.value);
        row.appendChild(select);
        container.appendChild(row);

        const rMode = document.createElement('div');
        rMode.className = 'node-field-row';
        rMode.innerHTML = `
          <span class="field-lbl">Action</span>
          <select class="node-select">
            <option value="toggle">Toggle</option>
            <option value="show">Show</option>
            <option value="hide">Hide</option>
          </select>
        `;
        const sMode = rMode.querySelector('select');
        sMode.value = node.data.mode || 'toggle';
        sMode.addEventListener('change', e => node.data.mode = e.target.value);
        container.appendChild(rMode);
        break;
      }

      case 'SetUIText': {
        const row = document.createElement('div');
        row.className = 'node-field-row';
        row.innerHTML = `<span class="field-lbl">UI Label</span>`;
        const select = document.createElement('select');
        select.className = 'node-select';

        const uis = this.uiManager ? this.uiManager.getAllElements().filter(u => u.type === 'label') : [];
        uis.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.id;
          opt.textContent = u.name || 'Label';
          if (u.id === node.data.uiId) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener('change', () => node.data.uiId = select.value);
        row.appendChild(select);
        container.appendChild(row);

        const r = document.createElement('div');
        r.className = 'node-field-row';
        r.innerHTML = `<span class="field-lbl">Text</span><input class="node-input" type="text" value="${node.data.text || ''}">`;
        r.querySelector('input').addEventListener('input', e => node.data.text = e.target.value);
        container.appendChild(r);

        const tip = document.createElement('div');
        tip.style.fontSize = '9px';
        tip.style.color = 'var(--text-dim)';
        tip.style.marginTop = '-4px';
        tip.textContent = 'Tip: Use {varName} to insert variable value';
        container.appendChild(tip);
        break;
      }

      case 'ChangeColor': {
        addObjSelect('Target', node.data.targetId, val => node.data.targetId = val);
        const r = document.createElement('div');
        r.className = 'node-field-row';
        r.innerHTML = `<span class="field-lbl">Color</span><input class="node-color" type="color" value="${node.data.color || '#ffd700'}">`;
        r.querySelector('input').addEventListener('input', e => node.data.color = e.target.value);
        container.appendChild(r);
        break;
      }

      case 'InspectItem':
        addObjSelect('Target', node.data.targetId, val => node.data.targetId = val);
        break;
    }
  }

  _startWire(fromNodeId, fromPortId, bulletEl) {
    const rect = bulletEl.getBoundingClientRect();
    const wrapRect = this.canvasWrap.getBoundingClientRect();

    const startX = rect.left + rect.width / 2 - wrapRect.left;
    const startY = rect.top + rect.height / 2 - wrapRect.top;

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

  _cancelActiveWire() {
    if (!this._activeWire) return;

    // Check if mouse released over an input port bullet
    const hovered = document.elementFromPoint(window.event?.clientX || 0, window.event?.clientY || 0);
    const inBullet = hovered?.closest('.port-item.in .port-bullet');
    if (inBullet) {
      const card = inBullet.closest('.nodegraph-card');
      const toNode = card?.dataset.nodeId;
      const toPort = inBullet.dataset.port;

      if (toNode && toPort && toNode !== this._activeWire.fromNode) {
        // Prevent duplicate wire
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

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'wire-path');
      path.setAttribute('d', this._calcBezier(x1, y1, x2, y2));

      path.addEventListener('click', () => {
        this.runtime.connections = this.runtime.connections.filter(c => c.id !== conn.id);
        this._renderWires();
      });

      this.svg.appendChild(path);
    });
  }
}

export class NodeGraphRuntime {
  constructor(sceneManager, uiManager, itemInspector) {
    this.sceneManager = sceneManager;
    this.uiManager = uiManager;
    this.itemInspector = itemInspector;

    this.nodes = new Map();
    this.connections = [];
    this.variables = new Map();

    this._activeTweens = [];
  }

  setVariable(name, val, op = 'set') {
    let current = this.variables.get(name);
    let nextVal = val;
    if (op === 'set') {
      nextVal = val;
    } else if (op === 'add') {
      nextVal = (Number(current) || 0) + Number(val);
    } else if (op === 'subtract') {
      nextVal = (Number(current) || 0) - Number(val);
    } else if (op === 'toggle') {
      nextVal = !Boolean(current);
    }
    this.variables.set(name, nextVal);
    if (current !== nextVal) {
      this.triggerEvent('OnVariableChanged', { varName: name, value: nextVal });
    }
  }

  getVariable(name) {
    return this.variables.get(name);
  }

  update(dt) {
    for (let i = this._activeTweens.length - 1; i >= 0; i--) {
      const tween = this._activeTweens[i];
      tween.elapsed += dt;
      const progress = Math.min(tween.elapsed / tween.duration, 1.0);
      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      if (tween.type === 'rotate') {
        tween.target.rotation[tween.axis] = tween.startVal + tween.deltaVal * ease;
      } else if (tween.type === 'move') {
        tween.target.position.x = tween.startX + tween.deltaX * ease;
        tween.target.position.y = tween.startY + tween.deltaY * ease;
        tween.target.position.z = tween.startZ + tween.deltaZ * ease;
      }

      if (tween.target.updateMatrixWorld) tween.target.updateMatrixWorld(true);

      if (progress >= 1.0) {
        this._activeTweens.splice(i, 1);
        if (tween.onComplete) tween.onComplete();
      }
    }
  }

  get activeTweens() {
    return this._activeTweens;
  }

  reset() {
    this._activeTweens = [];
    for (const node of this.nodes.values()) {
      node._flipState = false;
      node._count = 0;
    }
  }

  triggerEvent(eventType, eventData = {}) {
    const targetId = eventData?.userData?.id || eventData?.targetId || (typeof eventData === 'string' ? eventData : null);

    for (const node of this.nodes.values()) {
      if (node.type !== eventType) continue;
      const data = node.data || {};

      if (eventType === 'OnInteract') {
        if (data.targetId && data.targetId !== 'any' && data.targetId !== targetId) {
          continue;
        }
      } else if (eventType === 'OnTriggerEnter' || eventType === 'OnTriggerExit') {
        if (data.targetId && data.targetId !== 'any' && data.targetId !== targetId) {
          continue;
        }
      } else if (eventType === 'OnVariableChanged') {
        if (data.varName && data.varName !== 'any' && data.varName !== eventData?.varName) {
          continue;
        }
      }

      this._firePort(node.id, 'flow', { targetId, eventData });
    }
  }

  _firePort(nodeId, portName, context = {}) {
    const matchingConns = this.connections.filter(c => c.fromNode === nodeId && c.fromPort === portName);
    for (const conn of matchingConns) {
      const targetNode = this.nodes.get(conn.toNode);
      if (targetNode) {
        this._executeNode(targetNode, conn.toPort, context);
      }
    }
  }

  _executeNode(node, inPort, context) {
    if (!node.data) node.data = {};
    switch (node.type) {
      // Conditions
      case 'CheckCondition': {
        const varName = node.data.varName || '';
        const op = node.data.operator || '==';
        const expected = node.data.value;
        const current = this.getVariable(varName);

        let pass = false;
        if (op === '==') pass = String(current) === String(expected) || current == expected;
        else if (op === '!=') pass = String(current) !== String(expected);
        else if (op === '>') pass = Number(current) > Number(expected);
        else if (op === '<') pass = Number(current) < Number(expected);
        else if (op === '>=') pass = Number(current) >= Number(expected);
        else if (op === '<=') pass = Number(current) <= Number(expected);

        this._firePort(node.id, pass ? 'true' : 'false', context);
        break;
      }

      case 'FlipFlop': {
        node._flipState = !node._flipState;
        const port = node._flipState ? 'A' : 'B';
        this._firePort(node.id, port, context);
        break;
      }

      case 'CounterGate': {
        if (inPort === 'reset') {
          node._count = 0;
          return;
        }
        node._count = (node._count || 0) + 1;
        const target = Number(node.data.targetCount) || 1;
        if (node._count >= target) {
          this._firePort(node.id, 'reached', context);
        } else {
          this._firePort(node.id, 'not_reached', context);
        }
        break;
      }

      case 'Delay': {
        const sec = Number(node.data.seconds) || 1.0;
        setTimeout(() => {
          this._firePort(node.id, 'flow', context);
        }, sec * 1000);
        break;
      }

      // Actions
      case 'SetActive': {
        const targetId = node.data.targetId;
        const target = this.sceneManager.getObject(targetId);
        if (target) {
          const mode = node.data.mode || 'show';
          let active = true;
          if (mode === 'toggle') active = !target.visible;
          else active = (mode === 'show');

          if (typeof this.sceneManager.setActive === 'function') {
            this.sceneManager.setActive(targetId, active);
          } else {
            target.visible = active;
          }
        }
        this._firePort(node.id, 'flow', context);
        break;
      }

      case 'RotateObject': {
        const target = this.sceneManager.getObject(node.data.targetId);
        if (target) {
          const axis = node.data.axis || 'y';
          const angleDeg = Number(node.data.angle) || 90;
          const duration = Math.max(0.01, Number(node.data.duration) || 1.0);
          const deltaRad = (angleDeg * Math.PI) / 180;

          this._activeTweens.push({
            type: 'rotate',
            target,
            axis,
            startVal: target.rotation[axis],
            deltaVal: deltaRad,
            duration,
            elapsed: 0,
            onComplete: () => this._firePort(node.id, 'flow', context)
          });
        } else {
          this._firePort(node.id, 'flow', context);
        }
        break;
      }

      case 'MoveObject': {
        const target = this.sceneManager.getObject(node.data.targetId);
        if (target) {
          const duration = Math.max(0.01, Number(node.data.duration) || 1.0);
          const dx = Number(node.data.dx) || 0;
          const dy = Number(node.data.dy) || 0;
          const dz = Number(node.data.dz) || 0;

          this._activeTweens.push({
            type: 'move',
            target,
            startX: target.position.x,
            startY: target.position.y,
            startZ: target.position.z,
            deltaX: dx,
            deltaY: dy,
            deltaZ: dz,
            duration,
            elapsed: 0,
            onComplete: () => this._firePort(node.id, 'flow', context)
          });
        } else {
          this._firePort(node.id, 'flow', context);
        }
        break;
      }

      case 'SetVariable': {
        const varName = node.data.varName;
        if (varName) {
          this.setVariable(varName, node.data.val, node.data.op || 'set');
        }
        this._firePort(node.id, 'flow', context);
        break;
      }

      case 'GetVariable': {
        const varName = node.data.varName;
        const val = this.getVariable(varName);
        this._firePort(node.id, 'flow', { ...context, varName, value: val });
        break;
      }

      case 'SetUIText': {
        if (this.uiManager && node.data.uiId) {
          let text = node.data.text || '';
          text = text.replace(/\{([a-zA-Z0-9_-]+)\}/g, (_, vName) => {
            const v = this.getVariable(vName);
            return v !== undefined ? v : `{${vName}}`;
          });
          this.uiManager.setElementText(node.data.uiId, text);
        }
        this._firePort(node.id, 'flow', context);
        break;
      }

      case 'SetUIActive': {
        if (this.uiManager && node.data.uiId) {
          const mode = node.data.mode || 'toggle';
          let visible = true;
          if (mode === 'toggle') {
            visible = !this.uiManager.isElementVisible(node.data.uiId);
          } else {
            visible = (mode === 'show');
          }
          this.uiManager.setElementVisible(node.data.uiId, visible);
        }
        this._firePort(node.id, 'flow', context);
        break;
      }

      case 'InspectItem': {
        const target = this.sceneManager.getObject(node.data.targetId);
        if (target && this.itemInspector) {
          this.itemInspector.inspect(target);
        }
        this._firePort(node.id, 'flow', context);
        break;
      }

      case 'ChangeColor': {
        const target = this.sceneManager.getObject(node.data.targetId);
        if (target && node.data.color) {
          const applyColor = (m) => {
            if (m.isMesh && m.material && m.material.color) {
              m.material.color.set(node.data.color);
            }
          };
          if (target.isMesh) applyColor(target);
          else target.traverse(applyColor);
        }
        this._firePort(node.id, 'flow', context);
        break;
      }

      default:
        this._firePort(node.id, 'flow', context);
        break;
    }
  }

  serialize() {
    return {
      variables: Object.fromEntries(this.variables),
      nodes: Array.from(this.nodes.values()).map(n => ({
        id: n.id,
        type: n.type,
        category: n.category,
        title: n.title,
        scope: n.scope || 'global',
        x: n.x,
        y: n.y,
        data: { ...n.data },
        inputs: n.inputs,
        outputs: n.outputs
      })),
      connections: this.connections.map(c => ({ ...c }))
    };
  }

  deserialize(data) {
    if (!data) return;
    this.nodes.clear();
    this.connections = [];
    this.variables.clear();
    this._activeTweens = [];

    if (data.variables) {
      for (const [k, v] of Object.entries(data.variables)) {
        this.variables.set(k, v);
      }
    }

    if (Array.isArray(data.nodes)) {
      for (const n of data.nodes) {
        this.nodes.set(n.id, {
          ...n,
          scope: n.scope || 'global'
        });
      }
    }

    if (Array.isArray(data.connections)) {
      this.connections = [...data.connections];
    }
  }
}

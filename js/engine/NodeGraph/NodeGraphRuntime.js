import * as THREE from 'three';

export class NodeGraphRuntime {
  //#region [Variables/Fields]
  sceneManager = null;
  uiManager = null;
  itemInspector = null;
  collisionSystem = null;

  nodes = new Map();
  connections = [];
  variables = new Map();

  _activeTweens = [];
  _keys = new Set();
  _mouseButtons = new Set();
  _mouseDelta = { x: 0, y: 0 };
  _wheelDelta = 0;
  _lastMousePos = null;
  _isMouseDown = false;
  _isInputEnabled = false;
  _domElement = null;
  _boundKeyDown = null;
  _boundKeyUp = null;
  _boundMouseMove = null;
  _boundMouseDown = null;
  _boundMouseUp = null;
  _boundWheel = null;
  //#endregion

  //#region [Properties]
  get activeTweens() {
    return this._activeTweens;
  }
  //#endregion

  //#region [Unity Methods]
  constructor(sceneManager, uiManager, itemInspector, collisionSystem = null) {
    this.sceneManager = sceneManager;
    this.uiManager = uiManager;
    this.itemInspector = itemInspector;
    this.collisionSystem = collisionSystem;

    this._boundKeyDown = (e) => this._onKeyDown(e);
    this._boundKeyUp = (e) => this._onKeyUp(e);
    this._boundMouseMove = (e) => this._onMouseMove(e);
    this._boundMouseDown = (e) => this._onMouseDown(e);
    this._boundMouseUp = (e) => this._onMouseUp(e);
    this._boundWheel = (e) => this._onWheel(e);
  }
  //#endregion

  //#region [Public Methods]
  enableInput(domElement) {
    this._domElement = domElement;
    this._isInputEnabled = true;
    this._keys.clear();
    this._mouseButtons.clear();
    this._mouseDelta.x = 0;
    this._mouseDelta.y = 0;
    this._wheelDelta = 0;
    this._lastMousePos = null;
    this._isMouseDown = false;

    window.addEventListener('keydown', this._boundKeyDown);
    window.addEventListener('keyup', this._boundKeyUp);
    window.addEventListener('mousemove', this._boundMouseMove);
    window.addEventListener('mousedown', this._boundMouseDown);
    window.addEventListener('mouseup', this._boundMouseUp);
    window.addEventListener('wheel', this._boundWheel, { passive: true });
  }

  disableInput() {
    this._isInputEnabled = false;
    this._keys.clear();
    this._mouseButtons.clear();
    this._mouseDelta.x = 0;
    this._mouseDelta.y = 0;
    this._wheelDelta = 0;
    this._lastMousePos = null;
    this._isMouseDown = false;

    window.removeEventListener('keydown', this._boundKeyDown);
    window.removeEventListener('keyup', this._boundKeyUp);
    window.removeEventListener('mousemove', this._boundMouseMove);
    window.removeEventListener('mousedown', this._boundMouseDown);
    window.removeEventListener('mouseup', this._boundMouseUp);
    window.removeEventListener('wheel', this._boundWheel);
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

    if (this._isInputEnabled) {
      this.triggerEvent('OnUpdate', { dt });
      this._mouseDelta.x = 0;
      this._mouseDelta.y = 0;
      this._wheelDelta = 0;
    }
  }

  reset() {
    this._activeTweens = [];
    for (const node of this.nodes.values()) {
      node._flipState = false;
      node._count = 0;
      node._currentVel = { x: 0, z: 0 };
      node._velocityY = 0;
      node._isGrounded = false;
      node._outputs = {};
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

      this._firePort(node.id, 'flow', { targetId, eventData, dt: eventData?.dt || 0.016 });
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
  //#endregion

  //#region [Private Methods]
  _onKeyDown(e) {
    if (e.code) this._keys.add(e.code);
    if (e.key) {
      this._keys.add(e.key.toLowerCase());
      this._keys.add(e.key);
    }
  }

  _onKeyUp(e) {
    if (e.code) this._keys.delete(e.code);
    if (e.key) {
      this._keys.delete(e.key.toLowerCase());
      this._keys.delete(e.key);
    }
  }

  _onMouseDown(e) {
    this._isMouseDown = true;
    this._mouseButtons.add(e.button);
    this._lastMousePos = { x: e.clientX, y: e.clientY };
  }

  _onMouseUp(e) {
    this._isMouseDown = false;
    this._mouseButtons.delete(e.button);
    this._lastMousePos = null;
  }

  _onMouseMove(e) {
    if (document.pointerLockElement) {
      this._mouseDelta.x += e.movementX || 0;
      this._mouseDelta.y += e.movementY || 0;
    } else if (this._isMouseDown || (e.buttons & 1) || (e.buttons & 2)) {
      const curX = e.clientX;
      const curY = e.clientY;
      if (this._lastMousePos) {
        this._mouseDelta.x += curX - this._lastMousePos.x;
        this._mouseDelta.y += curY - this._lastMousePos.y;
      }
      this._lastMousePos = { x: curX, y: curY };
    }
  }

  _onWheel(e) {
    this._wheelDelta += Math.sign(e.deltaY);
  }

  _hasKey(...keys) {
    for (const k of keys) {
      if (this._keys.has(k)) return true;
    }
    return false;
  }

  _resolveInput(node, portId, context, defaultVal) {
    const conn = this.connections.find(c => c.toNode === node.id && c.toPort === portId);
    if (conn) {
      const srcNode = this.nodes.get(conn.fromNode);
      if (srcNode) {
        if (srcNode._outputs && srcNode._outputs[conn.fromPort] !== undefined) {
          return srcNode._outputs[conn.fromPort];
        }
        if (this._isParameterNode(srcNode.type)) {
          return this._evaluateParameterValue(srcNode);
        }
        if (srcNode.type === 'GetChildComponent') {
          return this._evaluateChildComponentOutput(srcNode, conn.fromPort);
        }
        if (srcNode.type === 'DynamicInterface' && srcNode.data?.values?.[conn.fromPort] !== undefined) {
          return srcNode.data.values[conn.fromPort];
        }
      }
      if (context && context[conn.fromPort] !== undefined) {
        return context[conn.fromPort];
      }
    }
    if (context && context[portId] !== undefined) {
      return context[portId];
    }
    if (node.data && node.data[portId] !== undefined) {
      return node.data[portId];
    }
    return defaultVal;
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
    if (!node._outputs) node._outputs = {};

    switch (node.type) {
      case 'OnUpdate': {
        node._outputs = { dt: context.dt || 0.016 };
        this._firePort(node.id, 'flow', context);
        break;
      }

      case 'InputAxis': {
        const h = (this._hasKey('KeyD', 'd', 'ArrowRight') ? 1 : 0) - (this._hasKey('KeyA', 'a', 'ArrowLeft') ? 1 : 0);
        const v = (this._hasKey('KeyW', 'w', 'ArrowUp') ? 1 : 0) - (this._hasKey('KeyS', 's', 'ArrowDown') ? 1 : 0);
        const jump = this._hasKey('Space', ' ');
        const sprint = this._hasKey('ShiftLeft', 'ShiftRight', 'Shift', 'shift');
        const crouch = this._hasKey('ControlLeft', 'ControlRight', 'Control', 'ctrl', 'KeyC', 'c');
        const interact = this._hasKey('KeyE', 'e', 'Enter');
        const attack = this._mouseButtons.has(0);
        const aim = this._mouseButtons.has(2);
        const reload = this._hasKey('KeyR', 'r');

        node._outputs = {
          horizontal: h,
          vertical: v,
          jump,
          sprint,
          crouch,
          interact,
          attack,
          aim,
          reload
        };

        const nextContext = {
          ...context,
          horizontal: h,
          vertical: v,
          jump,
          sprint,
          crouch,
          interact,
          attack,
          aim,
          reload
        };

        this._firePort(node.id, 'flow', nextContext);
        break;
      }

      case 'MouseLookInput': {
        const lookX = this._mouseDelta.x;
        const lookY = this._mouseDelta.y;
        const wheel = this._wheelDelta;
        node._outputs = { lookX, lookY, wheel };
        const nextContext = { ...context, lookX, lookY, wheel };
        this._firePort(node.id, 'flow', nextContext);
        break;
      }

      case 'MovementDirection': {
        const h = Number(this._resolveInput(node, 'horizontal', context, 0));
        const v = Number(this._resolveInput(node, 'vertical', context, 0));
        const isSprinting = Boolean(this._resolveInput(node, 'sprint', context, false));
        let speed = Number(this._resolveInput(node, 'speed', context, node.data.speed ?? 5));
        const sprintMul = Number(this._resolveInput(node, 'sprintMultiplier', context, node.data.sprintMultiplier ?? 1.6));
        if (isSprinting) speed *= sprintMul;

        const lerpSpeed = Number(this._resolveInput(node, 'lerpSpeed', context, node.data.lerpSpeed ?? 10));
        const dt = Number(context.dt || 0.016);

        let targetObj = null;
        if (node.data.targetId && node.data.targetId !== 'any') {
          targetObj = this.sceneManager.getObject(node.data.targetId);
        }
        if (!targetObj) {
          targetObj = this.sceneManager.getAllObjects().find(o => o.userData?.type === 'player_controller');
        }

        let yaw = 0;
        if (targetObj) {
          yaw = targetObj.rotation.y;
        }

        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).normalize();
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).normalize();

        const moveDir = new THREE.Vector3();
        moveDir.addScaledVector(forward, v);
        moveDir.addScaledVector(right, h);
        if (moveDir.lengthSq() > 1) moveDir.normalize();

        const targetVX = moveDir.x * speed;
        const targetVZ = moveDir.z * speed;

        if (!node._currentVel) node._currentVel = { x: 0, z: 0 };
        const lerpFactor = Math.min(1.0, lerpSpeed * dt);
        node._currentVel.x += (targetVX - node._currentVel.x) * lerpFactor;
        node._currentVel.z += (targetVZ - node._currentVel.z) * lerpFactor;

        const isMoving = Math.abs(node._currentVel.x) > 0.05 || Math.abs(node._currentVel.z) > 0.05;

        node._outputs = {
          moveX: node._currentVel.x,
          moveZ: node._currentVel.z,
          isMoving
        };

        const nextContext = {
          ...context,
          moveX: node._currentVel.x,
          moveZ: node._currentVel.z,
          isMoving
        };

        this._firePort(node.id, 'flow', nextContext);
        break;
      }

      case 'CharacterPhysics': {
        const jump = Boolean(this._resolveInput(node, 'jump', context, false));
        const jumpForce = Number(this._resolveInput(node, 'jumpForce', context, node.data.jumpForce ?? 8));
        const gravity = Number(this._resolveInput(node, 'gravity', context, node.data.gravity ?? -15));
        const dt = Number(context.dt || 0.016);

        if (node._velocityY === undefined) node._velocityY = 0;
        if (node._isGrounded === undefined) node._isGrounded = false;

        if (jump && node._isGrounded) {
          node._velocityY = jumpForce;
          node._isGrounded = false;
        }

        node._velocityY += gravity * dt;
        if (node._velocityY < -50) node._velocityY = -50;

        node._outputs = {
          velocityY: node._velocityY,
          isGrounded: node._isGrounded
        };

        const nextContext = {
          ...context,
          velocityY: node._velocityY,
          isGrounded: node._isGrounded
        };

        this._firePort(node.id, 'flow', nextContext);
        break;
      }

      case 'CharacterMoveOutput': {
        const moveX = Number(this._resolveInput(node, 'moveX', context, 0));
        const velocityY = Number(this._resolveInput(node, 'velocityY', context, 0));
        const moveZ = Number(this._resolveInput(node, 'moveZ', context, 0));
        const radius = Number(node.data.radius ?? 0.3);
        const height = Number(node.data.height ?? 1.7);
        const dt = Number(context.dt || 0.016);

        let target = null;
        if (node.data.targetId && node.data.targetId !== 'any') {
          target = this.sceneManager.getObject(node.data.targetId);
        }
        if (!target) {
          target = this.sceneManager.getAllObjects().find(o => o.userData?.type === 'player_controller');
        }

        if (target) {
          const newPos = target.position.clone();
          newPos.x += moveX * dt;
          newPos.y += velocityY * dt;
          newPos.z += moveZ * dt;

          let grounded = false;
          if (this.collisionSystem) {
            const res = this.collisionSystem.resolvePlayerCollision(newPos, radius, height);
            newPos.copy(res.position);
            grounded = res.grounded;
          }

          if (newPos.y <= 0) {
            newPos.y = 0;
            grounded = true;
          }

          target.position.copy(newPos);
          if (target.updateMatrixWorld) target.updateMatrixWorld(true);

          for (const otherNode of this.nodes.values()) {
            if (otherNode.type === 'CharacterPhysics') {
              otherNode._isGrounded = grounded;
              if (grounded && otherNode._velocityY < 0) {
                otherNode._velocityY = 0;
              }
            }
          }
        }

        this._firePort(node.id, 'flow', context);
        break;
      }

      case 'RotateCameraOutput': {
        const lookX = Number(this._resolveInput(node, 'lookX', context, 0));
        const lookY = Number(this._resolveInput(node, 'lookY', context, 0));
        const sensitivity = Number(this._resolveInput(node, 'sensitivity', context, node.data.sensitivity ?? 0.002));

        let player = null;
        if (node.data.playerId && node.data.playerId !== 'any') {
          player = this.sceneManager.getObject(node.data.playerId);
        }
        if (!player) {
          player = this.sceneManager.getAllObjects().find(o => o.userData?.type === 'player_controller');
        }

        let camera = null;
        const targetCameraInput = this._resolveInput(node, 'targetCamera', context, null)
          || this._resolveInput(node, 'camera', context, null);
        if (targetCameraInput) {
          camera = (typeof targetCameraInput === 'string')
            ? this.sceneManager.getObject(targetCameraInput)
            : (targetCameraInput.isCamera || targetCameraInput.isObject3D ? targetCameraInput : null);
        }
        if (!camera && node.data.cameraId && node.data.cameraId !== 'any') {
          camera = this.sceneManager.getObject(node.data.cameraId);
        }
        if (!camera && player) {
          camera = player.children.find(c => (c.isCamera || c.userData?.type === 'camera') && !c.userData?.isGizmo)
            || this.sceneManager.getChildren(player.userData.id).find(c => (c.isCamera || c.userData?.type === 'camera') && !c.userData?.isGizmo);
        }

        if (player && lookX !== 0) {
          player.rotation.y -= lookX * sensitivity;
          if (player.updateMatrixWorld) player.updateMatrixWorld(true);
        }

        if (camera && lookY !== 0) {
          camera.rotation.x -= lookY * sensitivity;
          camera.rotation.x = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, camera.rotation.x));
          if (camera.updateMatrixWorld) camera.updateMatrixWorld(true);
        }

        this._firePort(node.id, 'flow', context);
        break;
      }

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
            return v !== undefined ? v : ('{' + vName + '}');
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

      case 'Parameter':
      case 'FloatParameter':
      case 'IntParameter':
      case 'StringParameter':
      case 'BooleanParameter':
      case 'Vector3Parameter':
      case 'ListParameter':
      case 'DictionaryParameter': {
        const val = this._evaluateParameterValue(node);
        node._outputs = { val, value: val };
        const paramName = node.data.name || 'param';
        this._firePort(node.id, 'flow', { ...context, [paramName]: val, val, value: val });
        break;
      }

      case 'GetChildComponent': {
        const parentId = this._resolveInput(node, 'parent', context, node.data.parentId);
        let parentObj = null;
        if (parentId && parentId !== 'current' && parentId !== 'player') {
          parentObj = this.sceneManager.getObject(parentId);
        }
        if (!parentObj && node.scope && node.scope.startsWith('object:')) {
          parentObj = this.sceneManager.getObject(node.scope.replace('object:', ''));
        }
        if (!parentObj) {
          parentObj = this.sceneManager.getAllObjects().find(o => o.userData?.type === 'player_controller') || this.sceneManager.getRootObjects()[0];
        }

        let childObj = null;
        if (parentObj) {
          const children = this.sceneManager.getChildren(parentObj.userData.id);
          if (node.data.childId) {
            childObj = children.find(c => c.userData?.id === node.data.childId || c.name === node.data.childId);
          }
          if (!childObj && node.data.childName) {
            childObj = children.find(c => c.name === node.data.childName || c.userData?.name === node.data.childName);
          }
          if (!childObj && children.length > 0) {
            childObj = children[0];
          }
        }

        let compData = null;
        if (childObj) {
          const compType = node.data.componentType || 'camera';
          compData = childObj.userData?.components?.[compType] || childObj.userData?.[compType] || null;
        }

        node._outputs = {
          child: childObj ? childObj.userData.id : null,
          childObj: childObj,
          component: compData
        };

        const nextContext = {
          ...context,
          child: childObj ? childObj.userData.id : null,
          childObj: childObj,
          component: compData
        };
        this._firePort(node.id, 'flow', nextContext);
        break;
      }

      case 'DynamicInterface': {
        if (!node.data.values) node.data.values = {};
        const inPorts = node.inputs || [];
        const outPorts = node.outputs || [];

        for (const p of inPorts) {
          if (p.id === 'flow') continue;
          const val = this._resolveInput(node, p.id, context, node.data.values[p.id]);
          if (val !== undefined) {
            node.data.values[p.id] = val;
          }
        }

        const outMap = {};
        for (const outP of outPorts) {
          if (outP.id === 'flow') continue;
          if (node.data.values[outP.id] !== undefined) {
            outMap[outP.id] = node.data.values[outP.id];
          } else if (node.data.values[outP.mappedInput || outP.id] !== undefined) {
            outMap[outP.id] = node.data.values[outP.mappedInput || outP.id];
          }
        }
        node._outputs = { ...node.data.values, ...outMap };
        this._firePort(node.id, 'flow', { ...context, ...node._outputs });
        break;
      }

      default:
        this._firePort(node.id, 'flow', context);
        break;
    }
  }

  _isParameterNode(type) {
    return [
      'Parameter',
      'FloatParameter',
      'IntParameter',
      'StringParameter',
      'BooleanParameter',
      'Vector3Parameter',
      'ListParameter',
      'DictionaryParameter'
    ].includes(type);
  }

  _evaluateParameterValue(node) {
    if (!node || !node.data) return 0;
    const type = node.data.dataType || this._inferParamType(node.type);
    const raw = node.data.value;

    switch (type) {
      case 'float':
      case 'double':
      case 'number':
        return parseFloat(raw) || 0;
      case 'int':
      case 'integer':
        return parseInt(raw, 10) || 0;
      case 'string':
      case 'text':
        return raw !== undefined && raw !== null ? String(raw) : '';
      case 'boolean':
      case 'bool':
        return Boolean(raw === true || raw === 'true' || raw === 1 || raw === '1');
      case 'vector3':
        return {
          x: parseFloat(node.data.x) || 0,
          y: parseFloat(node.data.y) || 0,
          z: parseFloat(node.data.z) || 0
        };
      case 'list':
      case 'array':
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
          } catch (_) {
            return raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
          }
        }
        return [];
      case 'dictionary':
      case 'map':
      case 'dict':
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
          } catch (_) {}
        }
        return {};
      default:
        return raw;
    }
  }

  _inferParamType(nodeType) {
    if (nodeType === 'FloatParameter') return 'float';
    if (nodeType === 'IntParameter') return 'int';
    if (nodeType === 'StringParameter') return 'string';
    if (nodeType === 'BooleanParameter') return 'boolean';
    if (nodeType === 'Vector3Parameter') return 'vector3';
    if (nodeType === 'ListParameter') return 'list';
    if (nodeType === 'DictionaryParameter') return 'dictionary';
    return 'float';
  }

  _evaluateChildComponentOutput(node, portId) {
    if (!node || !node.data) return null;
    let parentObj = null;
    const parentId = node.data.parentId;
    if (parentId && parentId !== 'current' && parentId !== 'player') {
      parentObj = this.sceneManager.getObject(parentId);
    }
    if (!parentObj && node.scope && node.scope.startsWith('object:')) {
      parentObj = this.sceneManager.getObject(node.scope.replace('object:', ''));
    }
    if (!parentObj) {
      parentObj = this.sceneManager.getAllObjects().find(o => o.userData?.type === 'player_controller') || this.sceneManager.getRootObjects()[0];
    }

    if (!parentObj) return null;

    const children = this.sceneManager.getChildren(parentObj.userData.id);
    let childObj = null;
    if (node.data.childId) {
      childObj = children.find(c => c.userData?.id === node.data.childId || c.name === node.data.childId);
    }
    if (!childObj && node.data.childName) {
      childObj = children.find(c => c.name === node.data.childName || c.userData?.name === node.data.childName);
    }
    if (!childObj && children.length > 0) {
      childObj = children[0];
    }

    if (!childObj) return null;

    if (portId === 'child' || portId === 'target' || portId === 'targetCamera') {
      return childObj.userData.id;
    }
    if (portId === 'childObj') {
      return childObj;
    }
    if (portId === 'component') {
      const compType = node.data.componentType || 'camera';
      return childObj.userData?.components?.[compType] || childObj.userData?.[compType] || null;
    }
    return childObj.userData.id;
  }
  //#endregion
}

import * as THREE from 'three';

export class FPSController {
  constructor(camera, domElement, collisionSystem) {
    this.camera = camera;
    this.domElement = domElement;
    this.collisionSystem = collisionSystem;

    this.enabled = false;
    this.moveSpeed = 5;
    this.lookSensitivity = 0.002;
    this.playerHeight = 1.7;
    this.playerRadius = 0.3;
    this.gravity = -15;

    this.velocity = new THREE.Vector3();
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._moveVec = new THREE.Vector3();

    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.isGrounded = false;

    this._lockState = 'None';
    this._mobileMove = { x: 0, z: 0 };
    this._usingMobileMove = false;

    this.onInteractKeyPress = null;

    this._boundKeyDown = (e) => this._onKeyDown(e);
    this._boundKeyUp = (e) => this._onKeyUp(e);
    this._boundMouseMove = (e) => this._onMouseMove(e);
    this._boundPointerLockChange = () => this._onPointerLockChange();
    this._boundClick = () => this._onClick();
  }

  get lockState() { return this._lockState; }

  setLockState(val) {
    if (val === 'Locked') {
      this.domElement.requestPointerLock();
    } else {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      this._lockState = 'None';
    }
  }

  get cursorVisible() { return this._lockState === 'None'; }

  enable(spawnPos, spawnRot) {
    this.enabled = true;

    if (spawnPos) {
      this.camera.position.copy(spawnPos);
    }
    if (spawnRot) {
      this._euler.set(spawnRot.x, spawnRot.y, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(this._euler);
    }

    this.velocity.set(0, 0, 0);
    this.moveForward = this.moveBackward = this.moveLeft = this.moveRight = false;

    document.addEventListener('keydown', this._boundKeyDown);
    document.addEventListener('keyup', this._boundKeyUp);
    document.addEventListener('mousemove', this._boundMouseMove);
    document.addEventListener('pointerlockchange', this._boundPointerLockChange);
    this.domElement.addEventListener('click', this._boundClick);

    this.setLockState('Locked');
  }

  disable() {
    this.enabled = false;

    document.removeEventListener('keydown', this._boundKeyDown);
    document.removeEventListener('keyup', this._boundKeyUp);
    document.removeEventListener('mousemove', this._boundMouseMove);
    document.removeEventListener('pointerlockchange', this._boundPointerLockChange);
    this.domElement.removeEventListener('click', this._boundClick);

    this.setLockState('None');
    this.moveForward = this.moveBackward = this.moveLeft = this.moveRight = false;
  }

  update(dt) {
    if (!this.enabled) return;

    this.velocity.y += this.gravity * dt;

    this._euler.setFromQuaternion(this.camera.quaternion, 'YXZ');

    this._forward.set(0, 0, -1);
    this._forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this._euler.y);
    this._forward.normalize();

    this._right.set(1, 0, 0);
    this._right.applyAxisAngle(new THREE.Vector3(0, 1, 0), this._euler.y);
    this._right.normalize();

    this._moveVec.set(0, 0, 0);

    if (this._usingMobileMove) {
      this._moveVec.addScaledVector(this._forward, -this._mobileMove.z);
      this._moveVec.addScaledVector(this._right, this._mobileMove.x);
    } else {
      if (this.moveForward) this._moveVec.add(this._forward);
      if (this.moveBackward) this._moveVec.sub(this._forward);
      if (this.moveRight) this._moveVec.add(this._right);
      if (this.moveLeft) this._moveVec.sub(this._right);
    }

    if (this._moveVec.lengthSq() > 0) {
      this._moveVec.normalize();
    }

    const newPos = this.camera.position.clone();
    newPos.addScaledVector(this._moveVec, this.moveSpeed * dt);
    newPos.y += this.velocity.y * dt;

    if (this.collisionSystem) {
      const result = this.collisionSystem.resolvePlayerCollision(
        newPos, this.playerRadius, this.playerHeight
      );
      newPos.copy(result.position);
      if (result.grounded) {
        this.velocity.y = 0;
        this.isGrounded = true;
      } else {
        this.isGrounded = false;
      }
    }

    if (newPos.y < this.playerHeight) {
      newPos.y = this.playerHeight;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    this.camera.position.copy(newPos);
  }

  setMoveInput(x, z) {
    this._mobileMove.x = x;
    this._mobileMove.z = z;
    this._usingMobileMove = (x !== 0 || z !== 0);
  }

  setLookInput(dx, dy) {
    if (!this.enabled) return;
    this._euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this._euler.y -= dx * this.lookSensitivity * 5;
    this._euler.x -= dy * this.lookSensitivity * 5;
    this._euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this._euler.x));
    this.camera.quaternion.setFromEuler(this._euler);
  }

  _onKeyDown(e) {
    switch (e.code) {
      case 'KeyW': this.moveForward = true; break;
      case 'KeyS': this.moveBackward = true; break;
      case 'KeyA': this.moveLeft = true; break;
      case 'KeyD': this.moveRight = true; break;
      case 'KeyE':
        if (this.onInteractKeyPress) this.onInteractKeyPress();
        break;
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': this.moveForward = false; break;
      case 'KeyS': this.moveBackward = false; break;
      case 'KeyA': this.moveLeft = false; break;
      case 'KeyD': this.moveRight = false; break;
    }
  }

  _onMouseMove(e) {
    if (this._lockState !== 'Locked') return;
    this._euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this._euler.y -= e.movementX * this.lookSensitivity;
    this._euler.x -= e.movementY * this.lookSensitivity;
    this._euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this._euler.x));
    this.camera.quaternion.setFromEuler(this._euler);
  }

  _onPointerLockChange() {
    this._lockState = (document.pointerLockElement === this.domElement) ? 'Locked' : 'None';
  }

  _onClick() {
    if (this._lockState === 'None' && this.enabled) {
      this.setLockState('Locked');
    }
  }
}

export class MobileControls {
  constructor(container) {
    this.container = container;
    this._touchUsed = false;
    this.enabled = false;
    this.onInteract = null;

    this._moveX = 0;
    this._moveZ = 0;
    this._joystickTouch = null;
    this._lookTouch = null;
    this._joystickCenter = { x: 0, y: 0 };
    this._lookPrev = { x: 0, y: 0 };
    this._maxRadius = 40;
    this._lookCallback = null;

    window.addEventListener('touchstart', () => {
      this._touchUsed = true;
      if (this.enabled) {
        this.joystickArea.style.display = 'block';
        this.lookArea.style.display = 'block';
      }
    }, { passive: true });

    this._createElements();
  }

  get isMobile() {
    const isMobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isSmallTouch = (window.innerWidth <= 768) && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
    return isMobileUA || isSmallTouch || this._touchUsed;
  }

  _createElements() {
    this.joystickArea = document.createElement('div');
    this.joystickArea.className = 'mobile-joystick-area';

    this.joystickBase = document.createElement('div');
    this.joystickBase.className = 'mobile-joystick-base';

    this.joystickThumb = document.createElement('div');
    this.joystickThumb.className = 'mobile-joystick-thumb';

    this.joystickBase.appendChild(this.joystickThumb);
    this.joystickArea.appendChild(this.joystickBase);
    this.container.appendChild(this.joystickArea);

    this.lookArea = document.createElement('div');
    this.lookArea.className = 'mobile-look-area';
    this.container.appendChild(this.lookArea);

    this.interactBtn = document.createElement('button');
    this.interactBtn.className = 'mobile-interact-btn';
    this.interactBtn.textContent = 'E';
    this.interactBtn.style.display = 'none';
    this.container.appendChild(this.interactBtn);

    this.joystickArea.addEventListener('touchstart', (e) => this._onJoystickStart(e), { passive: false });
    this.joystickArea.addEventListener('touchmove', (e) => this._onJoystickMove(e), { passive: false });
    this.joystickArea.addEventListener('touchend', (e) => this._onJoystickEnd(e), { passive: false });
    this.joystickArea.addEventListener('touchcancel', (e) => this._onJoystickEnd(e), { passive: false });

    this.lookArea.addEventListener('touchstart', (e) => this._onLookStart(e), { passive: false });
    this.lookArea.addEventListener('touchmove', (e) => this._onLookMove(e), { passive: false });
    this.lookArea.addEventListener('touchend', () => this._onLookEnd(), { passive: false });
    this.lookArea.addEventListener('touchcancel', () => this._onLookEnd(), { passive: false });

    this.interactBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.onInteract) this.onInteract();
    }, { passive: false });
  }

  enable(lookCallback) {
    this.enabled = true;
    this._lookCallback = lookCallback;
    if (this.isMobile) {
      this.joystickArea.style.display = 'block';
      this.lookArea.style.display = 'block';
    } else {
      this.joystickArea.style.display = 'none';
      this.lookArea.style.display = 'none';
    }
  }

  disable() {
    this.enabled = false;
    this._lookCallback = null;
    this.joystickArea.style.display = 'none';
    this.lookArea.style.display = 'none';
    this.interactBtn.style.display = 'none';
    this._resetJoystick();
  }

  showInteractButton(text) {
    if (!this.isMobile || !this.enabled) return;
    this.interactBtn.textContent = text || 'E';
    this.interactBtn.style.display = 'flex';
    this.interactBtn.style.alignItems = 'center';
    this.interactBtn.style.justifyContent = 'center';
  }

  hideInteractButton() {
    this.interactBtn.style.display = 'none';
  }

  getMoveInput() {
    return { x: this._moveX, z: this._moveZ };
  }

  _onJoystickStart(e) {
    e.preventDefault();
    if (this._joystickTouch !== null) return;
    const touch = e.changedTouches[0];
    this._joystickTouch = touch.identifier;
    const rect = this.joystickBase.getBoundingClientRect();
    this._joystickCenter.x = rect.left + rect.width / 2;
    this._joystickCenter.y = rect.top + rect.height / 2;
  }

  _onJoystickMove(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier !== this._joystickTouch) continue;

      let dx = touch.clientX - this._joystickCenter.x;
      let dy = touch.clientY - this._joystickCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > this._maxRadius) {
        dx = (dx / dist) * this._maxRadius;
        dy = (dy / dist) * this._maxRadius;
      }

      this.joystickThumb.style.transform = `translate(${dx}px, ${dy}px)`;
      this._moveX = dx / this._maxRadius;
      this._moveZ = dy / this._maxRadius;
    }
  }

  _onJoystickEnd(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === this._joystickTouch) {
        this._resetJoystick();
      }
    }
  }

  _resetJoystick() {
    this._joystickTouch = null;
    this._moveX = 0;
    this._moveZ = 0;
    this.joystickThumb.style.transform = 'translate(0, 0)';
  }

  _onLookStart(e) {
    e.preventDefault();
    if (this._lookTouch !== null) return;
    const touch = e.changedTouches[0];
    this._lookTouch = touch.identifier;
    this._lookPrev.x = touch.clientX;
    this._lookPrev.y = touch.clientY;
  }

  _onLookMove(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier !== this._lookTouch) continue;

      const dx = touch.clientX - this._lookPrev.x;
      const dy = touch.clientY - this._lookPrev.y;
      this._lookPrev.x = touch.clientX;
      this._lookPrev.y = touch.clientY;

      if (this._lookCallback) {
        this._lookCallback(dx, dy);
      }
    }
  }

  _onLookEnd() {
    this._lookTouch = null;
  }
}

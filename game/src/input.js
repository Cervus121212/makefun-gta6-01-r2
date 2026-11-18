// Keyboard + mouse input with edge detection and a scripted-input hook for autopilot tests.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false; this.clicked = false;
    this.dragging = false; this.lastX = 0; this.lastY = 0;
    this.scripted = new Set(); // keys injected by autopilot
    this.smoothX = 0; this.smoothY = 0; // eased axis values (no more binary steering)
    this.mouseSens = 1.0;
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseDown = (e) => {
      this.mouseDown = true; this.clicked = true; this.dragging = true;
      this.lastX = e.clientX; this.lastY = e.clientY;
    };
    this._onMouseUp = () => { this.mouseDown = false; this.dragging = false; };
    this._onMouseMove = (e) => {
      if (!this.dragging) return;
      // Deadzone + damping: sub-pixel jitter never reaches the camera, and a
      // flick of the wrist does not whip the view around.
      const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
      if (Math.abs(dx) >= 1) this.mouseDX += dx * 0.85 * this.mouseSens;
      if (Math.abs(dy) >= 1) this.mouseDY += dy * 0.85 * this.mouseSens;
      this.lastX = e.clientX; this.lastY = e.clientY;
    };
    this._onWheel = (e) => { this.wheel = (this.wheel || 0) + e.deltaY; };
    this._onBlur = () => { this.keys.clear(); this.mouseDown = false; this.dragging = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('wheel', this._onWheel, { passive: true });
    window.addEventListener('blur', this._onBlur);
  }
  down(code) { return this.keys.has(code) || this.scripted.has(code); }
  pressed(code) { return this.justPressed.has(code); }
  // Autopilot: hold / release a key code through the same path the game reads.
  scriptDown(code) { this.scripted.add(code); }
  scriptUp(code) { this.scripted.delete(code); }
  scriptClick() { this.clicked = true; }
  axis() {
    let x = 0, y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    // Ease toward the target: full lock in ~0.12s, release in ~0.2s. Steering
    // and throttle stop snapping from 0 to 1 in a single frame.
    const k = 1 - Math.exp(-(x !== 0 || y !== 0 ? 22 : 14) * 0.016);
    this.smoothX += (x - this.smoothX) * k;
    this.smoothY += (y - this.smoothY) * k;
    return { x: this.smoothX, y: this.smoothY };
  }
  endFrame() {
    this.justPressed.clear();
    this.mouseDX = 0; this.mouseDY = 0;
    this.clicked = false;
    this.wheel = 0;
  }
}

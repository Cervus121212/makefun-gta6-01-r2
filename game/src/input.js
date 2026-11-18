// Keyboard + mouse input with edge detection and a scripted-input hook for autopilot tests.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false; this.clicked = false;
    this.dragging = false; this.lastX = 0; this.lastY = 0;
    this.scripted = new Set(); // keys injected by autopilot
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
      this.mouseDX += e.clientX - this.lastX; this.mouseDY += e.clientY - this.lastY;
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
    return { x, y };
  }
  endFrame() {
    this.justPressed.clear();
    this.mouseDX = 0; this.mouseDY = 0;
    this.clicked = false;
    this.wheel = 0;
  }
}

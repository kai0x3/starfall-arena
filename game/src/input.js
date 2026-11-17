// input.js — the player's hands: which keys are held, where the mouse points in
// arena coordinates, and which keys were pressed since the last frame. The game
// loop reads this and nothing else touches the DOM events.

import { VIEW_WIDTH, VIEW_HEIGHT } from './config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keysDown = new Set();
    this.keysPressed = new Set();
    this.mouseX = VIEW_WIDTH / 2;
    this.mouseY = VIEW_HEIGHT / 3;
    this.mouseDown = false;

    window.addEventListener('keydown', (event) => {
      if (!event.repeat) this.keysPressed.add(event.code);
      this.keysDown.add(event.code);
      // Keep the page itself still: arrows and space would otherwise scroll it.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keysDown.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keysDown.clear();
      this.mouseDown = false;
    });

    canvas.addEventListener('mousemove', (event) => this.#trackMouse(event));
    canvas.addEventListener('mousedown', (event) => {
      this.#trackMouse(event);
      if (event.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
    this.mouseClicked = false;
  }

  // The canvas is scaled by CSS to fit the window; convert the event's page
  // position back into the arena's own 1280x800 coordinates.
  #trackMouse(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
    this.mouseY = ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT;
  }

  isDown(code) {
    return this.keysDown.has(code);
  }

  // Edge-triggered: true only on the first frame after the key went down.
  wasPressed(code) {
    return this.keysPressed.has(code);
  }

  // The movement axis the held keys ask for, each component -1, 0 or 1.
  moveAxis() {
    const x = (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0)
      - (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
    const y = (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0)
      - (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0);
    return { x, y };
  }

  firing() {
    return this.mouseDown || this.isDown('Space');
  }

  // Called once at the end of each frame so presses and clicks live one frame.
  endFrame() {
    this.keysPressed.clear();
    this.mouseClicked = false;
  }
}

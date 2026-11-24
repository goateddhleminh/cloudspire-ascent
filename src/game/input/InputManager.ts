export interface UiGamepadCommand {
  navDelta: number; // -1 prev/up/left, +1 next/down/right
  confirm: boolean;
  back: boolean;
}

export class InputManager {
  private heldKeys = new Set<string>();
  private justPressedKeys = new Set<string>();
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private primaryHeld = false;
  private primaryJustPressed = false;
  private rightMouseHeld = false;
  private lastClientX = 0;
  private lastClientY = 0;
  private suspended = false;
  public pointerLocked = false;
  public freeMouseMode = false;
  private suppressNextUnlockPause = false;
  public gamepadConnected = false;

  // Gamepad per-frame state
  private gpMoveX = 0;
  private gpMoveZ = 0;
  private gpLookX = 0;
  private gpLookY = 0;
  private prevGpButtons: boolean[] = [];
  private gpJustPressed = new Set<number>();
  private gpHeld = new Set<number>();
  private gpNavRepeatCooldown = 0;

  private onEscapeCallback?: () => void;
  private onFreeMouseToggleCallback?: (free: boolean) => void;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clearInputState);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  setEscapeHandler(fn: () => void): void {
    this.onEscapeCallback = fn;
  }

  setFreeMouseToggleHandler(fn: (free: boolean) => void): void {
    this.onFreeMouseToggleCallback = fn;
  }

  setSuspended(value: boolean): void {
    this.suspended = value;
    if (value) {
      this.clearInputState();
      this.exitPointerLock();
    }
  }

  isSuspended(): boolean {
    return this.suspended;
  }

  /**
   * Polls connected standard Gamepad (if any) once per frame for both gameplay & modal UI focus!
   */
  pollGamepad(dt: number): UiGamepadCommand {
    const cmd: UiGamepadCommand = { navDelta: 0, confirm: false, back: false };
    this.gpJustPressed.clear();
    this.gpHeld.clear();
    this.gpMoveX = 0;
    this.gpMoveZ = 0;
    this.gpLookX = 0;
    this.gpLookY = 0;

    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      this.gamepadConnected = false;
      return cmd;
    }

    const pads = navigator.getGamepads();
    const gp = pads ? Array.from(pads).find((p) => p && p.connected) : null;
    this.gamepadConnected = Boolean(gp);
    if (!gp) {
      this.prevGpButtons = [];
      return cmd;
    }

    const deadzone = 0.18;
    const applyDz = (v: number) => (Math.abs(v) < deadzone ? 0 : (v - Math.sign(v) * deadzone) / (1 - deadzone));

    this.gpMoveX = applyDz(gp.axes[0] ?? 0);
    this.gpMoveZ = applyDz(gp.axes[1] ?? 0);
    this.gpLookX = applyDz(gp.axes[2] ?? 0);
    this.gpLookY = applyDz(gp.axes[3] ?? 0);

    gp.buttons.forEach((btn, idx) => {
      const pressed = Boolean(btn?.pressed || (btn?.value ?? 0) > 0.55);
      if (pressed) {
        this.gpHeld.add(idx);
        if (!this.prevGpButtons[idx]) {
          this.gpJustPressed.add(idx);
        }
      }
      this.prevGpButtons[idx] = pressed;
    });

    // Start (9) always toggles Pause/Back
    if (this.gpJustPressed.has(9)) {
      this.onEscapeCallback?.();
    }

    if (this.suspended) {
      if (this.gpNavRepeatCooldown > 0) {
        this.gpNavRepeatCooldown = Math.max(0, this.gpNavRepeatCooldown - dt);
      }
      const dpadPrev = this.gpJustPressed.has(12) || this.gpJustPressed.has(14);
      const dpadNext = this.gpJustPressed.has(13) || this.gpJustPressed.has(15);
      if (dpadPrev) cmd.navDelta = -1;
      else if (dpadNext) cmd.navDelta = 1;
      else if (this.gpNavRepeatCooldown <= 0) {
        if (this.gpMoveZ < -0.55 || this.gpMoveX < -0.55) {
          cmd.navDelta = -1;
          this.gpNavRepeatCooldown = 0.21;
        } else if (this.gpMoveZ > 0.55 || this.gpMoveX > 0.55) {
          cmd.navDelta = 1;
          this.gpNavRepeatCooldown = 0.21;
        }
      }

      if (this.gpJustPressed.has(0)) cmd.confirm = true;
      if (this.gpJustPressed.has(1)) cmd.back = true;
    }

    return cmd;
  }

  requestPointerLock(): void {
    if (this.suspended || document.pointerLockElement === this.canvas) return;
    try {
      const maybePromise = this.canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {});
      }
    } catch {
      // Ignore
    }
  }

  exitPointerLock(): void {
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock?.();
      } catch {
        // Ignore
      }
    }
    this.pointerLocked = false;
  }

  private onPointerLockChange = (): void => {
    const wasLocked = this.pointerLocked;
    this.pointerLocked = document.pointerLockElement === this.canvas;
    if (wasLocked && !this.pointerLocked) {
      if (this.suppressNextUnlockPause) {
        this.suppressNextUnlockPause = false;
        return;
      }
      if (!this.suspended && !this.freeMouseMode) {
        this.onEscapeCallback?.();
      }
    }
  };

  private toggleFreeMouseMode(): void {
    this.freeMouseMode = !this.freeMouseMode;
    if (this.freeMouseMode) {
      if (document.pointerLockElement === this.canvas) {
        this.suppressNextUnlockPause = true;
        this.exitPointerLock();
      }
    } else {
      this.requestPointerLock();
    }
    this.onFreeMouseToggleCallback?.(this.freeMouseMode);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      if (e.code === 'Escape') {
        this.onEscapeCallback?.();
      }
      return;
    }

    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      this.onEscapeCallback?.();
      return;
    }

    if (this.suspended) return;

    if (e.code === 'AltLeft') {
      e.preventDefault();
      if (!e.repeat) {
        this.toggleFreeMouseMode();
      }
      return;
    }

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }

    if (!this.heldKeys.has(e.code)) {
      this.justPressedKeys.add(e.code);
    }
    this.heldKeys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'AltLeft') {
      e.preventDefault();
    }
    this.heldKeys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.suspended) return;

    if (e.button === 0) {
      if (!this.pointerLocked && !this.freeMouseMode) {
        this.requestPointerLock();
      }
      this.primaryHeld = true;
      this.primaryJustPressed = true;
    } else if (e.button === 2) {
      this.rightMouseHeld = true;
      this.lastClientX = e.clientX;
      this.lastClientY = e.clientY;
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.primaryHeld = false;
    } else if (e.button === 2) {
      this.rightMouseHeld = false;
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.suspended) return;

    if (this.pointerLocked) {
      this.mouseDeltaX += e.movementX || 0;
      this.mouseDeltaY += e.movementY || 0;
    } else if (this.rightMouseHeld) {
      const dx = e.clientX - this.lastClientX;
      const dy = e.clientY - this.lastClientY;
      this.lastClientX = e.clientX;
      this.lastClientY = e.clientY;
      this.mouseDeltaX += dx * 1.6;
      this.mouseDeltaY += dy * 1.6;
    }
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  public clearInputState = (): void => {
    this.heldKeys.clear();
    this.justPressedKeys.clear();
    this.primaryHeld = false;
    this.primaryJustPressed = false;
    this.rightMouseHeld = false;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
  };

  getMoveAxes(): { x: number; z: number } {
    if (this.suspended) return { x: 0, z: 0 };
    let x = this.gpMoveX;
    let z = this.gpMoveZ;
    if (this.heldKeys.has('KeyA')) x -= 1;
    if (this.heldKeys.has('KeyD')) x += 1;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) z -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) z += 1;

    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }

  getKeyboardCameraSpin(): number {
    if (this.suspended) return 0;
    let turn = -this.gpLookX * 1.35;
    if (this.heldKeys.has('ArrowLeft')) turn += 1;
    if (this.heldKeys.has('ArrowRight')) turn -= 1;
    return turn;
  }

  consumeLookDelta(dt = 0.016): { dx: number; dy: number } {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY + this.gpLookY * 420 * dt;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return { dx, dy };
  }

  wasJumpPressed(): boolean {
    return this.justPressedKeys.has('Space') || this.gpJustPressed.has(0);
  }

  wasAttackPressed(): boolean {
    return (
      this.primaryJustPressed ||
      this.justPressedKeys.has('KeyJ') ||
      this.heldKeys.has('KeyJ') ||
      this.gpJustPressed.has(2) ||
      this.gpJustPressed.has(7)
    );
  }

  isAttackHeld(): boolean {
    return (
      this.primaryHeld ||
      this.heldKeys.has('KeyJ') ||
      this.gpHeld.has(2) ||
      this.gpHeld.has(7)
    );
  }

  wasSkill1Pressed(): boolean {
    return (
      this.justPressedKeys.has('KeyQ') ||
      this.justPressedKeys.has('ShiftLeft') ||
      this.justPressedKeys.has('ShiftRight') ||
      this.gpJustPressed.has(4) ||
      this.gpJustPressed.has(1)
    );
  }

  wasSkill2Pressed(): boolean {
    return this.justPressedKeys.has('KeyE') || this.gpJustPressed.has(5);
  }

  wasInteractPressed(): boolean {
    return this.justPressedKeys.has('KeyF') || this.gpJustPressed.has(3);
  }

  wasConsumablePressed(): boolean {
    return (
      this.justPressedKeys.has('KeyC') ||
      this.justPressedKeys.has('Digit1') ||
      this.gpJustPressed.has(6) ||
      this.gpJustPressed.has(13)
    );
  }

  endFrame(): void {
    this.justPressedKeys.clear();
    this.primaryJustPressed = false;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clearInputState);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }
}

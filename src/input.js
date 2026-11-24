// 키보드·마우스·게임패드를 추상 액션으로 바꾼다. 봇과 테스트도 같은 주입 API를 쓴다.
const TAPS = ['light', 'heavy', 'dodge', 'heal', 'start'];
const KEYS = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyJ: 'light', KeyK: 'heavy', Space: 'dodge', ShiftLeft: 'block', ShiftRight: 'block', KeyL: 'block', KeyR: 'heal', KeyE: 'heal', Enter: 'start',
};
const PAD = { 5: 'light', 7: 'heavy', 1: 'dodge', 4: 'block', 2: 'heal', 9: 'start', 0: 'start' };

export class Input {
  constructor(target) {
    this.held = new Set();   // 누르고 있는 액션
    this.taps = new Set();   // 다음 스텝에서 한 번 소비될 누름
    this.padHeld = new Set();
    this.autopilot = null;   // (sim) => 액션. 설정되면 사람 입력 대신 쓴다
    addEventListener('keydown', (e) => { const a = KEYS[e.code]; if (!a) return; e.preventDefault(); if (!e.repeat) this.press(a); });
    addEventListener('keyup', (e) => { const a = KEYS[e.code]; if (a) this.release(a); });
    addEventListener('blur', () => this.held.clear());
    target.addEventListener('mousedown', (e) => { this.press(e.button === 2 ? 'heavy' : 'light'); this.press('start'); });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** 주입 API: 액션을 누른다(뗄 때까지 유지). */
  press(action) { this.held.add(action); if (TAPS.includes(action)) this.taps.add(action); }
  release(action) { this.held.delete(action); }

  /** 한 번 누른 'start'가 있었는지 확인하고 소비한다. */
  takeStart() { this.#pad(); const had = this.taps.has('start'); this.taps.delete('start'); return had; }

  #pad() {
    const pad = navigator.getGamepads?.().find((p) => p && p.mapping === 'standard');
    this.stick = pad ? [pad.axes[0], -pad.axes[1]].map((v) => (Math.abs(v) < 0.2 ? 0 : v)) : [0, 0];
    for (const [i, a] of Object.entries(PAD)) {
      const down = !!pad?.buttons[i]?.pressed, key = i + a;
      if (down && !this.padHeld.has(key)) { this.padHeld.add(key); this.press(a); }
      if (!down && this.padHeld.has(key)) { this.padHeld.delete(key); this.release(a); }
    }
  }

  /** 시뮬레이션 한 스텝에 줄 입력. 이동은 "보스를 바라보는 방향" 기준을 월드 좌표로 바꾼다. */
  read(sim) {
    if (this.autopilot) { this.taps.clear(); return this.autopilot(sim); }
    this.#pad();
    const h = this.held, { player: p, boss: b } = sim;
    const x = (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0) + this.stick[0];
    const y = (h.has('up') ? 1 : 0) - (h.has('down') ? 1 : 0) + this.stick[1];
    const d = Math.hypot(b.x - p.x, b.z - p.z) || 1, fx = (b.x - p.x) / d, fz = (b.z - p.z) / d;
    const out = {
      moveX: fx * y - fz * x, moveZ: fz * y + fx * x, block: h.has('block'),
      light: this.taps.has('light'), heavy: this.taps.has('heavy'), dodge: this.taps.has('dodge'), heal: this.taps.has('heal'),
    };
    for (const t of TAPS) if (t !== 'start') this.taps.delete(t);
    return out;
  }
}

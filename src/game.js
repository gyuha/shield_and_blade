// 화면 흐름(타이틀 → 결투 → 승리/사망 → 재도전)과 고정 스텝 루프.
import { Sim } from './sim/sim.js';
import { bots } from './sim/bot.js';
import { DT } from './sim/rules.js';
import { Input } from './input.js';
import { View } from './view.js';
import { Hud } from './hud.js';

const FLASH = { parry: '패 링', poisebreak: '체간 붕괴', guardbreak: '가드 붕괴', phase2: '파수꾼이 포효한다' };

export class Game {
  constructor({ canvas, ui, params }) {
    this.params = params;
    this.state = 'title'; // 'title' | 'fight' | 'victory' | 'dead'
    this.input = new Input(canvas);
    this.view = new View(canvas);
    this.hud = new Hud(ui);
    this.sim = new Sim({ seed: 1 });
    // 자동 조종(?auto=skilled|masher|idle)과 빨리 감기(?speed=N): 봇은 입력 계층에 입력만 넣는다
    this.input.autopilot = bots[params.get('auto')] || null;
    this.speed = Math.min(60, Number(params.get('speed')) || 1);
    this.hitstop = 0;
    this.acc = 0;
    this.last = 0;
    canvas.focus();
  }

  start() {
    const seed = Number(this.params.get('seed')) || (Date.now() & 0xffff) + 1;
    this.sim = new Sim({ seed });
    this.state = 'fight';
    this.acc = 0;
  }

  /** 시뮬레이션을 한 스텝 진행하고 그 스텝의 사건을 화면에 전한다. */
  step() {
    if (this.hitstop > 0) { this.hitstop--; return; }
    const sim = this.sim;
    sim.step(this.input.read(sim));
    for (const ev of sim.events) {
      if (FLASH[ev]) this.hud.flash(FLASH[ev]);
      if (ev === 'hit') { this.hud.hurt(); this.view.shake = 0.5; this.hitstop = 5; }
      if (ev === 'bosshit') this.hitstop = 3;
      if (ev === 'parry') { this.view.shake = 0.3; this.hitstop = 6; }
    }
    if (sim.state !== 'fight') this.state = sim.state;
  }

  frame(now) {
    const elapsed = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.state === 'fight') {
      this.input.takeStart();
      this.acc += elapsed * this.speed;
      while (this.acc >= DT && this.state === 'fight') { this.step(); this.acc -= DT; }
    } else if (this.input.takeStart()) this.start();
    this.render(now / 1000);
  }

  render(seconds = performance.now() / 1000) {
    this.view.draw(this.sim, this.state, seconds);
    this.hud.update(this.state, this.sim);
  }

  run() {
    const loop = (now) => { this.frame(now); requestAnimationFrame(loop); };
    this.last = performance.now();
    this.ready = true;
    requestAnimationFrame(loop);
  }
}

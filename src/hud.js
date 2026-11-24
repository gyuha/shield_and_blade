import { P, B } from './sim/rules.js';

const CARDS = {
  title: ['SHIELD AND BLADE', 'Enter 또는 클릭으로 결투 시작'],
  victory: ['파수꾼을 쓰러뜨렸다', 'Enter로 다시 도전'],
  dead: ['쓰러졌다', 'Enter로 다시 일어서기'],
};

export class Hud {
  constructor(root) {
    root.innerHTML = `
      <div id="hurt"></div>
      <div id="boss"><div class="name">고갯마루의 파수꾼</div><div class="bar hp"><i></i></div><div class="bar poise"><i></i></div></div>
      <div id="me"><div class="bar hp"><i></i></div><div class="bar st"><i></i></div><div class="flasks"></div></div>
      <div id="keys">이동 WASD · 약공격 J/좌클릭 · 강공격 K/우클릭<br>구르기 Space · 방어 Shift (맞기 직전에 올리면 패링) · 회복 R</div>
      <div id="flash"></div>
      <div id="card"><div><h1></h1><p></p></div></div>`;
    const q = (s) => root.querySelector(s);
    this.el = { boss: q('#boss'), me: q('#me'), keys: q('#keys'), bossHp: q('#boss .hp i'), poise: q('#boss .poise i'), hp: q('#me .hp i'), st: q('#me .st i'),
      flasks: q('#me .flasks'), flash: q('#flash'), hurt: q('#hurt'), card: q('#card'), h1: q('#card h1'), p: q('#card p') };
  }

  update(state, sim) {
    const e = this.el, fight = state === 'fight';
    for (const el of [e.boss, e.me, e.keys]) el.classList.toggle('hidden', state === 'title');
    e.card.classList.toggle('hidden', fight);
    if (!fight) [e.h1.textContent, e.p.textContent] = CARDS[state];
    const w = (el, v) => { el.style.transform = `scaleX(${Math.max(0, v)})`; };
    w(e.bossHp, sim.boss.hp / B.hp); w(e.poise, sim.boss.poise / B.poise);
    w(e.hp, sim.player.hp / P.hp); w(e.st, sim.player.stamina / P.stamina);
    e.flasks.textContent = '회복약 ' + '◆'.repeat(sim.player.flasks) + '◇'.repeat(P.heal.flasks - sim.player.flasks);
  }

  flash(text) {
    const f = this.el.flash; f.textContent = text; f.style.opacity = 1;
    clearTimeout(this.flashTimer); this.flashTimer = setTimeout(() => { f.style.opacity = 0; }, 500);
  }

  hurt() {
    const h = this.el.hurt; h.style.transition = 'none'; h.style.opacity = 0.8;
    requestAnimationFrame(() => { h.style.transition = ''; h.style.opacity = 0; });
  }
}
